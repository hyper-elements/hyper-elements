/** PNG files made for tests: plain gray pixels, any size. */
import { deflateSync } from "node:zlib";

/** A PNG `width` by `height` pixels, gray (or noise), as a data URI. */
export function png(width: number, height: number, noise = false): string {
  const chunk = (type: string, data: Buffer) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, "latin1");
    data.copy(out, 8);
    let crc = ~0;
    for (const byte of out.subarray(4, 8 + data.length)) {
      crc ^= byte;
      for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    out.writeUInt32BE(~crc >>> 0, 8 + data.length);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 0, 0, 0, 0], 8);
  const rows = Buffer.alloc((width + 1) * height, 0x80);
  // Noise (xorshift, seeded) where asked: a file as large as its pixels, as a photo is.
  let seed = 2463534242;
  if (noise)
    for (let i = 0; i < rows.length; i++) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      rows[i] = seed & 0xff;
    }
  for (let y = 0; y < height; y++) rows[y * (width + 1)] = 0;
  const file = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", header), chunk("IDAT", deflateSync(rows)), chunk("IEND", Buffer.alloc(0))]);
  return `data:image/png;base64,${file.toString("base64")}`;
}
