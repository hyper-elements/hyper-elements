// The trace for tools/check.mjs: what reached Satori (out/card.trace.json, written by tools/render.mjs), read as
// text runs with the styles Satori gives them (inherited as it inherits them), and the font file each is drawn in.

const INHERITED = ["fontFamily", "fontSize", "fontWeight", "fontStyle", "color", "textTransform", "letterSpacing", "lineHeight"];

function px(value, parent) {
  if (value === undefined || value === null || value === "") return parent;
  if (typeof value === "number") return value;
  const m = /^(-?[\d.]+)\s*(px|rem|em|%|pt)?$/.exec(String(value).trim());
  if (!m) return parent;
  const n = Number(m[1]);
  switch (m[2]) {
    case "rem": return n * 16;
    case "em": return n * parent;
    case "%": return (n / 100) * parent;
    case "pt": return (n * 4) / 3;
    default: return n;
  }
}

export function weightOf(value) {
  if (value === undefined || value === null) return 400;
  if (typeof value === "number") return value;
  const s = String(value).trim().toLowerCase();
  if (s === "bold") return 700;
  if (s === "normal") return 400;
  const n = Number(s);
  return Number.isFinite(n) ? n : 400;
}

function transform(text, how) {
  switch (how) {
    case "uppercase": return text.toUpperCase();
    case "lowercase": return text.toLowerCase();
    case "capitalize": return text.replace(/(^|\s)(\S)/g, (_, a, b) => a + b.toUpperCase());
    default: return text;
  }
}

/** The tree's text runs in order: { text, style, block }, `block` the nearest ancestor that isn't a span. */
export function runsOf(tree) {
  const runs = [];
  let blocks = 0;
  const visit = (node, inherited, block) => {
    if (typeof node === "string") {
      runs.push({ text: transform(node, inherited.textTransform), style: inherited, block });
      return;
    }
    if (!node || typeof node !== "object") return;
    if (node.type === "img" || node.type === "svg") return;
    const own = node.style ?? {};
    const style = { ...inherited };
    for (const k of INHERITED) if (own[k] !== undefined && own[k] !== null) style[k] = own[k];
    style.fontSize = px(own.fontSize, inherited.fontSize);
    const id = node.type === "span" ? block : ++blocks;
    for (const child of node.children ?? []) visit(child, style, id);
  };
  visit(tree, { fontSize: 16, fontWeight: 400, fontStyle: "normal", color: "#000000", fontFamily: undefined }, 0);
  return runs;
}

const SPACES = /[    - 　]/g;
const INVISIBLE = /[​-‍⁠﻿­]/g;
const clean = (s) => s.replace(SPACES, " ").replace(INVISIBLE, "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
export const normalize = (s) => clean(s).replace(/\s+/g, " ").trim();

/** The runs as one string (blocks apart by a space, whitespace collapsed), and each character's run. */
export function textOf(runs) {
  let out = "";
  const owner = [];
  let lastBlock = null;
  const push = (ch, i) => {
    if (/\s/.test(ch)) {
      if (!out.length || out.endsWith(" ")) return;
      out += " "; owner.push(i);
      return;
    }
    out += ch; owner.push(i);
  };
  runs.forEach((run, i) => {
    if (lastBlock !== null && run.block !== lastBlock) push(" ", i);
    lastBlock = run.block;
    for (const ch of clean(run.text)) push(ch, i);
  });
  return { text: out.trimEnd(), owner };
}

/** Where a spec text is in the runs, and the style of the run that draws most of it; null if it isn't there. */
export function findText(runs, wanted) {
  const { text, owner } = textOf(runs);
  const at = text.indexOf(normalize(wanted));
  if (at < 0) return null;
  const count = new Map();
  for (let i = at; i < at + normalize(wanted).length; i++) count.set(owner[i], (count.get(owner[i]) ?? 0) + 1);
  const [run] = [...count.entries()].sort((a, b) => b[1] - a[1])[0];
  return { style: runs[run].style };
}

/**
 * The font file a style is drawn in: the first family of its stack that a given font is named, else (Satori, which
 * uses the fonts given) the fonts given in order, or (Chromium, Skia: a system font) none; then the face of the same
 * style and the nearest weight.
 */
export function fontFor(style, fonts, { fallback = true } = {}) {
  const stack = String(style.fontFamily ?? "").split(",").map((s) => s.trim().replace(/^["']|["']$/g, "").toLowerCase()).filter(Boolean);
  let faces = [];
  for (const family of stack) {
    faces = fonts.filter((f) => String(f.name).toLowerCase() === family);
    if (faces.length) break;
  }
  if (!faces.length && fallback) faces = fonts;
  if (!faces.length) return null;
  const want = weightOf(style.fontWeight);
  const italic = String(style.fontStyle ?? "normal") === "italic";
  const same = faces.filter((f) => (f.style === "italic") === italic);
  const pool = same.length ? same : faces;
  return [...pool].sort((a, b) => Math.abs(weightOf(a.weight) - want) - Math.abs(weightOf(b.weight) - want) || weightOf(b.weight) - weightOf(a.weight))[0];
}
