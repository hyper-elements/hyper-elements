// What a font file is, read from its own tables: its family, weight, style, format and sha256. The canvas and
// Playwright taps use it for the fonts an agent registers, as the Satori tap reads them from Satori's options.
import { createHash } from "node:crypto";
import { brotliDecompressSync } from "node:zlib";

const bytesOf = (data) => (data instanceof Uint8Array ? data : new Uint8Array(data instanceof ArrayBuffer ? data : data.buffer ?? data));

export function formatOf(data) {
  const b = bytesOf(data);
  const tag = String.fromCharCode(...b.subarray(0, 4));
  if (tag === "wOF2") return "woff2";
  if (tag === "wOFF") return "woff";
  if (tag === "OTTO") return "otf";
  if (tag === "true" || (b[0] === 0 && b[1] === 1 && b[2] === 0 && b[3] === 0)) return "ttf";
  return "unknown";
}

/** The tables of a TTF/OTF ({ tag: DataView }), or null (WOFF2's tables are compressed together: not read here). */
function tables(b) {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const n = v.getUint16(4);
  const out = {};
  for (let i = 0; i < n; i++) {
    const at = 12 + i * 16;
    const tag = String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3]);
    const off = v.getUint32(at + 8), len = v.getUint32(at + 12);
    out[tag] = new DataView(b.buffer, b.byteOffset + off, len);
  }
  return out;
}

function familyOf(name) {
  if (!name) return null;
  const count = name.getUint16(2), strings = name.getUint16(4);
  const found = {};
  for (let i = 0; i < count; i++) {
    const r = 6 + i * 12;
    const platform = name.getUint16(r), id = name.getUint16(r + 6), len = name.getUint16(r + 8), off = name.getUint16(r + 10);
    if (id !== 1 && id !== 16) continue;
    let s = "";
    if (platform === 3 || platform === 0) for (let k = 0; k < len; k += 2) s += String.fromCharCode(name.getUint16(strings + off + k));
    else for (let k = 0; k < len; k++) s += String.fromCharCode(name.getUint8(strings + off + k));
    if (!found[id] || platform === 3) found[id] = s;
  }
  return found[16] ?? found[1] ?? null;
}

/** { family, weight, style, format, sha256 } of a font file (family, weight and style null where unreadable). */
export function fontInfo(data) {
  const b = bytesOf(data);
  const format = formatOf(b);
  const info = { family: null, weight: null, style: null, format, sha256: createHash("sha256").update(b).digest("hex") };
  try {
    let t = null;
    if (format === "ttf" || format === "otf") t = tables(b);
    else if (format === "woff2") t = woff2Tables(b);
    if (!t) return info;
    info.family = familyOf(t.name);
    if (t["OS/2"]) {
      info.weight = t["OS/2"].getUint16(4);
      info.style = t["OS/2"].getUint16(62) & 1 ? "italic" : "normal";
    }
  } catch {}
  return info;
}

/** WOFF2's name and OS/2 tables (both stored as they are, after the brotli stream's other tables). */
function woff2Tables(b) {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const numTables = v.getUint16(12);
  const compressedLength = v.getUint32(20);
  const KNOWN = ["cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt ", "fpgm", "glyf", "loca", "prep", "CFF ", "VORG", "EBDT", "EBLC", "gasp", "hdmx", "kern", "LTSH", "PCLT", "VDMX", "vhea", "vmtx", "BASE", "GDEF", "GPOS", "GSUB", "EBSC", "JSTF", "MATH", "CBDT", "CBLC", "COLR", "CPAL", "SVG ", "sbix", "acnt", "avar", "bdat", "bloc", "bsln", "cvar", "fdsc", "feat", "fmtx", "fvar", "gvar", "hsty", "just", "lcar", "mort", "morx", "opbd", "prop", "trak", "Zapf", "Silf", "Glat", "Gloc", "Feat", "Sill"];
  let p = 48;
  const base128 = () => { let n = 0; for (let i = 0; i < 5; i++) { const x = b[p++]; n = (n << 7) | (x & 0x7f); if (!(x & 0x80)) return n; } return n; };
  const entries = [];
  for (let i = 0; i < numTables; i++) {
    const flags = b[p++];
    const tag = (flags & 0x3f) === 0x3f ? String.fromCharCode(b[p++], b[p++], b[p++], b[p++]) : KNOWN[flags & 0x3f];
    const transform = (flags >> 6) & 3;
    const origLength = base128();
    const transformed = (tag === "glyf" || tag === "loca") ? transform === 0 : transform !== 0;
    const length = transformed ? base128() : origLength;
    entries.push({ tag, length });
  }
  const data = brotliDecompressSync(b.subarray(p, p + compressedLength));
  const out = {};
  let off = 0;
  for (const e of entries) { out[e.tag] = new DataView(data.buffer, data.byteOffset + off, e.length); off += e.length; }
  return out;
}
