/** What a test reads of a PNG resvg wrote: its size, and a pixel's color. */
import { inflateSync } from "node:zlib";

/** A PNG's size, from its IHDR chunk. */
export const pngSize = (bytes: Uint8Array) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  expect(Array.from(bytes.slice(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return [view.getUint32(16), view.getUint32(20)];
};

/** A PNG's pixel at x, y: RGBA, decoded with zlib (8-bit RGBA, no interlace: what resvg writes). */
export async function pixel(bytes: Uint8Array, x: number, y: number): Promise<number[]> {
  const [width] = pngSize(bytes);
  const chunks: Uint8Array[] = [];
  for (let at = 8; at < bytes.length; ) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + at);
    const length = view.getUint32(0);
    const type = String.fromCharCode(...bytes.slice(at + 4, at + 8));
    if (type === "IDAT") chunks.push(bytes.slice(at + 8, at + 8 + length));
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width! * 4 + 1;
  // Undo each row's filter up to the row asked for.
  const rows: Uint8Array[] = [];
  for (let row = 0; row <= y; row++) {
    const filter = raw[row * stride]!;
    const line = Uint8Array.from(raw.subarray(row * stride + 1, (row + 1) * stride));
    const above = rows[row - 1] ?? new Uint8Array(line.length);
    for (let i = 0; i < line.length; i++) {
      const left = i >= 4 ? line[i - 4]! : 0;
      const up = above[i]!;
      const upLeft = i >= 4 ? above[i - 4]! : 0;
      const p = left + up - upLeft;
      const paeth = Math.abs(p - left) <= Math.abs(p - up) && Math.abs(p - left) <= Math.abs(p - upLeft) ? left : Math.abs(p - up) <= Math.abs(p - upLeft) ? up : upLeft;
      line[i] = (line[i]! + [0, left, up, (left + up) >> 1, paeth][filter]!) & 0xff;
    }
    rows.push(line);
  }
  return Array.from(rows[y]!.slice(x * 4, x * 4 + 4));
}
