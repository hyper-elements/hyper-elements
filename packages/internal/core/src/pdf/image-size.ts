/**
 * An image file's own size in pixels, read from its header as react-pdf reads it (@react-pdf/image): a PNG's IHDR, a
 * JPEG's frame, its width and height swapped where its EXIF turns it on its side. What react-pdf sizes an image by
 * where its style gives no height: its width over this ratio. Plain bytes, no DOM: the same in Node and a browser.
 */
import { SourceCache } from "./source-cache";

/** A data URI's bytes (base64), its first `limit` of them at most, or undefined where it isn't one. */
function bytesOf(src: string, limit: number): Uint8Array | undefined {
  const comma = src.indexOf(",");
  if (!src.startsWith("data:") || comma < 0 || !src.slice(0, comma).endsWith(";base64")) return undefined;
  try {
    const data = src.slice(comma + 1);
    // Whole groups of four characters (three bytes each), or all of it.
    const binary = atob(data.length > (limit / 3) * 4 ? data.slice(0, Math.floor(limit / 3) * 4) : data);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return undefined;
  }
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function png(bytes: Uint8Array): { width: number; height: number } | undefined {
  if (bytes.length < 24 || PNG.some((byte, i) => bytes[i] !== byte)) return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/** A JPEG's EXIF orientation (1 to 8), from its APP1 segment's first IFD; undefined where it has none. */
function orientation(view: DataView, start: number, length: number): number | undefined {
  // "Exif\0\0", then a TIFF header: its byte order, 42, and where its first IFD is.
  if (length < 14 || view.getUint32(start) !== 0x45786966 || view.getUint16(start + 4) !== 0) return undefined;
  const tiff = start + 6;
  const little = view.getUint16(tiff) === 0x4949;
  const ifd = tiff + view.getUint32(tiff + 4, little);
  if (ifd + 2 > start + length) return undefined;
  const count = view.getUint16(ifd, little);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > start + length) return undefined;
    if (view.getUint16(entry, little) === 0x0112) return view.getUint16(entry + 8, little);
  }
  return undefined;
}

function jpeg(bytes: Uint8Array): { width: number; height: number } | undefined {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let turned: number | undefined;
  let at = 2;
  while (at + 4 <= bytes.length) {
    if (bytes[at] !== 0xff) return undefined;
    const marker = bytes[at + 1];
    // Fill bytes, and markers with no length.
    if (marker === 0xff) {
      at++;
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      at += 2;
      continue;
    }
    const length = view.getUint16(at + 2);
    if (marker === 0xe1) turned ??= orientation(view, at + 4, length - 2);
    // A frame (SOF0 to SOF15, not DHT, JPG or DAC): its height, then its width.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (at + 9 > bytes.length) return undefined;
      const height = view.getUint16(at + 5);
      const width = view.getUint16(at + 7);
      return (turned ?? 1) > 4 ? { width: height, height: width } : { width, height };
    }
    if (marker === 0xda || marker === 0xd9) return undefined;
    at += 2 + length;
  }
  return undefined;
}

/** A file's header read, or undefined where it's neither, or cut short (a truncated file isn't an error here: react-pdf leaves it out). */
function read(bytes: Uint8Array): { width: number; height: number } | undefined {
  try {
    return png(bytes) ?? jpeg(bytes);
  } catch {
    return undefined;
  }
}

const IEND = [0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];

/**
 * Whether a PNG is whole: it ends in its IEND chunk. One cut short (an upload cut off) react-pdf can't decode, and
 * leaves out (0 tall): its size isn't known here either, so it's measured as react-pdf draws it. A JPEG react-pdf
 * embeds as it is, from its header: any with a header is drawn (padding after its end, or cut short after its frame).
 * Its last bytes only are read.
 */
function whole(src: string): boolean {
  const data = src.slice(src.indexOf(",") + 1).trimEnd();
  // Its last 24 characters or so, from a group of four's start: its last 15 bytes at least.
  const start = Math.max(0, data.length - 24);
  const end = bytesOf(`data:;base64,${data.slice(start - (start % 4))}`, Infinity);
  if (!end) return false;
  const head = bytesOf(src, 3);
  if (!head) return false;
  if (head[0] === 0x89) return IEND.every((byte, i) => end[end.length - IEND.length + i] === byte);
  return true;
}

/** The files read, the last used (source-cache.ts: a server sees many). */
const sizes = new SourceCache<{ width: number; height: number } | null>();

/** A PNG's or a JPEG's size in pixels (a data URI's), or undefined where it's neither or can't be read. Read once a file. */
export function imageSize(src: string): { width: number; height: number } | undefined {
  let size = sizes.get(src);
  if (size === undefined) {
    // Its first 64KB (21,845 groups of three bytes), where its header is (a JPEG's frame after a large EXIF or color profile: all of it).
    const head = bytesOf(src, 65_535);
    let found = head && read(head);
    if (!found && head && head.length === 65_535) {
      const all = bytesOf(src, Infinity);
      found = all && read(all);
    }
    size = found && found.width > 0 && found.height > 0 && whole(src) ? found : null;
    sizes.set(src, size);
  }
  return size ?? undefined;
}
