// Stands in for `@napi-rs/canvas` in tools/render.mjs's bundle: the real module, with fillText, strokeText and font
// registration recorded, so tools/check.mjs reads the exact text, its font and color, and the font files given, as it
// reads Satori's input in the other kits.
//
// The text drawn becomes a tree like Satori's: one block per line (calls on the same baseline, in the same font and
// color, close together), its pieces in order from the left, with a space where there's a gap between them (a
// word drawn on its own) and none where there isn't (letters drawn one by one for letter spacing).
import * as real from "@napi-rs/canvas";
import { readFileSync } from "node:fs";
import { fontInfo } from "./font-info.mjs";

export * from "@napi-rs/canvas";
export default real.default ?? real;

const calls = [];
const fonts = [];
let canvases = 0;
globalThis.__benchCanvas = { calls, fonts };

// Fonts: what the agent registers, each read from its file.
const G = real.GlobalFonts;
const register = (data, alias) => {
  const info = fontInfo(data);
  fonts.push({ name: alias || info.family, weight: info.weight ?? 400, style: info.style ?? "normal", format: info.format, sha256: info.sha256 });
};
const origRegister = G.register.bind(G);
G.register = (data, alias) => { try { register(data, alias); } catch {} return origRegister(data, alias); };
const origFromPath = G.registerFromPath.bind(G);
G.registerFromPath = (path, alias) => { try { register(readFileSync(path), alias); } catch {} return origFromPath(path, alias); };
if (typeof G.loadFontsFromDir === "function") {
  const origDir = G.loadFontsFromDir.bind(G);
  G.loadFontsFromDir = (dir) => { calls.push({ note: `loadFontsFromDir(${dir})` }); return origDir(dir); };
}

// "italic bold 72px Inter, sans-serif" → its parts.
function parseFont(font) {
  const m = /^\s*((?:(?:normal|italic|oblique|small-caps|bold|bolder|lighter|[1-9]00)\s+)*)([\d.]+)px(?:\s*\/\s*\S+)?\s+(.+)$/i.exec(font ?? "");
  if (!m) return { fontFamily: font, fontSize: 10, fontWeight: 400, fontStyle: "normal" };
  const words = m[1].toLowerCase().split(/\s+/).filter(Boolean);
  const weight = words.find((w) => /^[1-9]00$/.test(w)) ?? (words.includes("bold") ? "700" : "400");
  return { fontFamily: m[3].trim(), fontSize: Number(m[2]), fontWeight: Number(weight), fontStyle: words.includes("italic") || words.includes("oblique") ? "italic" : "normal" };
}

const colorOf = (style) => (typeof style === "string" ? style : "gradient or pattern");

function wrap(proto, name) {
  const orig = proto[name];
  proto[name] = function (text, x, y, maxWidth) {
    try {
      const t = this.getTransform?.() ?? { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
      const width = this.measureText(String(text)).width;
      const align = this.textAlign ?? "start";
      const left0 = align === "center" ? x - width / 2 : align === "right" || align === "end" ? x - width : x;
      const font = parseFont(this.font);
      const scale = Math.hypot(t.a, t.b) || 1;
      calls.push({
        op: name, text: String(text),
        left: t.a * left0 + t.c * y + t.e, right: t.a * (left0 + width) + t.c * y + t.e, y: t.b * x + t.d * y + t.f,
        ...font, fontSize: font.fontSize * scale,
        color: colorOf(name === "strokeText" ? this.strokeStyle : this.fillStyle),
        letterSpacing: this.letterSpacing,
      });
    } catch (e) { calls.push({ note: `couldn't record ${name}: ${e.message}` }); }
    return maxWidth === undefined ? orig.call(this, text, x, y) : orig.call(this, text, x, y, maxWidth);
  };
}
const ctxProto = Object.getPrototypeOf(real.createCanvas(1, 1).getContext("2d"));
wrap(ctxProto, "fillText");
wrap(ctxProto, "strokeText");
const origCreate = real.createCanvas;
export const createCanvas = (...a) => { canvases++; return origCreate(...a); };

/** The calls as Satori's tree would give them: one block per line, its pieces in order. */
export function traceOf() {
  const draws = calls.filter((c) => c.op === "fillText" && c.text.length);
  const lines = [];
  for (const c of draws) {
    const same = (l) => Math.abs(l.y - c.y) < 0.5 && l.fontFamily === c.fontFamily && l.fontSize === c.fontSize && l.fontWeight === c.fontWeight && l.fontStyle === c.fontStyle && l.color === c.color;
    const line = lines.find((l) => same(l) && c.left <= l.right + c.fontSize * 1.5 && c.right >= l.left - c.fontSize * 1.5);
    if (line) { line.pieces.push(c); line.left = Math.min(line.left, c.left); line.right = Math.max(line.right, c.right); }
    else lines.push({ y: c.y, left: c.left, right: c.right, fontFamily: c.fontFamily, fontSize: c.fontSize, fontWeight: c.fontWeight, fontStyle: c.fontStyle, color: c.color, pieces: [c] });
  }
  lines.sort((a, b) => a.y - b.y || a.left - b.left);
  const tree = { type: "div", style: {}, children: lines.map((l) => {
    const pieces = [...l.pieces].sort((a, b) => a.left - b.left);
    let text = "";
    pieces.forEach((p, i) => {
      if (i > 0 && p.left - pieces[i - 1].right > l.fontSize * 0.15 && !text.endsWith(" ") && !p.text.startsWith(" ")) text += " ";
      text += p.text;
    });
    return { type: "div", style: { fontFamily: l.fontFamily, fontSize: l.fontSize, fontWeight: l.fontWeight, fontStyle: l.fontStyle, color: l.color }, children: [text] };
  }) };
  return { engine: "@napi-rs/canvas", canvases, fonts, tree, notes: calls.filter((c) => c.note).map((c) => c.note) };
}

globalThis.__benchTraceOf = traceOf;
