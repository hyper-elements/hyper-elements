// The shared quality bar for images. Every kit (Hyper Elements, Playwright, @napi-rs/canvas) is checked by this same script
// against out/card.png, with no browser: the trace tools/render.mjs wrote (what reached Satori: the exact text, its
// fonts and styles) says what was drawn, and the pixels (OCR, colors, images found by cross-correlation) say what shows.
//
//   node tools/check.mjs            prints PASS/FAIL per check, exits 1 on any failure
//   node tools/check.mjs --json     machine-readable, for the harness
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { closeOcr, readWords } from "./ocr.mjs";
import { assetPixel, deltaE, findImage, hex, inkMask, lab, median, parseColor, pixel, readPng, ring, sampleColors } from "./pixels.mjs";
import { findText, fontFor, runsOf, weightOf } from "./trace.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const runDir = process.env.BENCH_RUN ? resolve(process.env.BENCH_RUN) : resolve(here, "..");
const spec = JSON.parse(readFileSync(process.env.BENCH_SPEC ?? join(here, "spec.json"), "utf8"));
const json = process.argv.includes("--json");
const pngPath = join(runDir, "out/card.png");
const tracePath = join(runDir, "out/card.trace.json");

const results = [];
const measures = {};
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail: ok ? "" : detail });

async function finish(extra = {}) {
  await closeOcr();
  const failed = results.filter((r) => !r.ok);
  if (json) {
    console.log(JSON.stringify({ pass: failed.length === 0, total: results.length, failed: failed.length, results, measures, ...extra }));
  } else {
    for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.ok ? "" : ` — ${r.detail}`}`);
    console.log(failed.length ? `\n${failed.length} of ${results.length} checks failed.` : `\nAll ${results.length} checks passed.`);
  }
  process.exit(failed.length ? 1 : 0);
}

if (!existsSync(pngPath)) {
  check("output exists", false, "out/card.png was not found: run node tools/render.mjs");
  await finish();
}
const bytes = readFileSync(pngPath);
let img;
try { img = readPng(bytes); } catch (e) { check("output exists", false, `out/card.png isn't a PNG: ${e.message}`); await finish(); }
check("output exists", true);

// ─── The trace ───────────────────────────────────────────────────────────

const trace = existsSync(tracePath) ? JSON.parse(readFileSync(tracePath, "utf8")) : null;
const sha = createHash("sha256").update(bytes).digest("hex");
check("rendered by tools/render.mjs", trace && trace.png === sha && trace.calls > 0 && trace.tree,
  !trace ? "out/card.trace.json is missing: render with node tools/render.mjs"
    : trace.png !== sha ? "out/card.png isn't the image tools/render.mjs wrote last: render again"
      : "the render didn't draw with Satori or ImageResponse");
const [W, H] = spec.size;
check("size", img.width === W && img.height === H, `the image is ${img.width}×${img.height}, not ${W}×${H}`);
if (results.some((r) => !r.ok)) await finish({ warnings: trace?.warnings?.length ?? 0 });

// The font files in fonts/, by their hash: which file a trace's font is.
const fontFiles = new Map();
for (const f of readdirSync(join(runDir, "fonts"))) fontFiles.set(createHash("sha256").update(readFileSync(join(runDir, "fonts", f))).digest("hex"), f);
const runs = runsOf(trace.tree);
for (const t of spec.texts) {
  const found = findText(runs, t.text);
  check(`copy "${t.id}"`, found, `"${t.text}" isn't in the image's text, exactly (whitespace aside)`);
  if (!found) { check(`font "${t.id}"`, false, "its text isn't in the image"); continue; }
  const s = found.style;
  const problems = [];
  const face = fontFor(s, trace.fonts ?? [], { fallback: (trace.engine ?? "satori") === "satori" });
  const file = face && fontFiles.get(face.sha256);
  if (!face) problems.push(`no font file in fonts/ is loaded for "${s.fontFamily}": it's drawn in a system font`);
  // The same face in another format (Inter-Regular.woff2 for Inter-Regular.ttf) is the same font, where the engine
  // reads it (Satori doesn't read WOFF2; Chromium and Skia do).
  else if (file?.replace(/\.[^.]+$/, "") !== t.font.replace(/\.[^.]+$/, "")) problems.push(`it's drawn with ${file ?? `a font file not in fonts/ (${face.name} ${face.weight})`}, not ${t.font}`);
  if (weightOf(s.fontWeight) !== t.weight) problems.push(`fontWeight is ${s.fontWeight ?? 400}, not ${t.weight}`);
  if ((s.fontStyle ?? "normal") !== t.style) problems.push(`fontStyle is ${s.fontStyle ?? "normal"}, not ${t.style}`);
  if (Math.abs(s.fontSize - t.size) > 0.5) problems.push(`fontSize is ${s.fontSize}px, not ${t.size}px`);
  const c = parseColor(s.color);
  if (!c || deltaE(lab(c), lab(parseColor(t.color))) > 2) problems.push(`color is ${s.color ?? "black"}, not ${t.color}`);
  check(`font "${t.id}"`, problems.length === 0, problems.join("; "));
}

// ─── Background and edges ────────────────────────────────────────────────

const assets = join(runDir, "assets");
const assetImg = (file) => readPng(join(assets, file));
const bgImage = spec.background.image ? assetImg(spec.background.image) : null;
const bgColor = spec.background.color ? parseColor(spec.background.color) : null;
const edges = spec.edges ?? {};
const edgeW = (side) => edges[side]?.width ?? 0;
const near = (a, b, d) => deltaE(lab(a), lab(b)) <= d;

if (bgColor) {
  const inset = 16;
  const patches = [
    [inset + edgeW("left"), inset + edgeW("top")], [W - inset - 16 - edgeW("right"), inset + edgeW("top")],
    [inset + edgeW("left"), H - inset - 16 - edgeW("bottom")], [W - inset - 16 - edgeW("right"), H - inset - 16 - edgeW("bottom")],
  ].map(([x, y]) => median(img, { left: x, top: y, right: x + 16, bottom: y + 16 }));
  const off = patches.filter((p) => !near(p, bgColor, 3));
  check("background", off.length === 0, `the corners are ${[...new Set(patches.map(hex))].join(", ")}, not ${spec.background.color}`);
} else {
  const pts = [[24, 24], [W - 24, 24], [24, H - 24], [W - 24, H - 24], [W / 2, 12], [W / 2, H - 12]];
  const off = pts.filter(([x, y]) => !near(pixel(img, x, y), pixel(bgImage, (x * bgImage.width) / W, (y * bgImage.height) / H), 4));
  check("background", off.length === 0, `${spec.background.image} doesn't fill the card: at ${off.map(([x, y]) => `(${x}, ${y})`).join(", ")} the pixels aren't the image's`);
}

// The outer 8px band: only the background (or a declared edge), so nothing is cut off at the edges.
{
  let total = 0, wrong = 0;
  const band = 8;
  const edgeColors = Object.fromEntries(Object.entries(edges).map(([k, v]) => [k, parseColor(v.color)]));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (x >= band && x < W - band && y >= band && y < H - band) continue;
      const p = pixel(img, x, y);
      let want;
      if (x < edgeW("left")) want = edgeColors.left;
      else if (x >= W - edgeW("right")) want = edgeColors.right;
      else if (y < edgeW("top")) want = edgeColors.top;
      else if (y >= H - edgeW("bottom")) want = edgeColors.bottom;
      else want = bgColor ?? pixel(bgImage, (x * bgImage.width) / W, (y * bgImage.height) / H);
      total++;
      if (!near(p, want, bgColor ? 3 : 5)) wrong++;
    }
  }
  measures.edgeWrong = wrong / total;
  const declared = Object.keys(edges);
  check("edges", wrong / total <= 0.005, `${(100 * wrong / total).toFixed(1)}% of the outer 8px isn't the background${declared.length ? ` (or the ${declared.join(", ")} edge)` : ""}: something reaches the edge or is cut off there`);
}

// ─── Images ──────────────────────────────────────────────────────────────

const boxes = {};
for (const im of spec.images) {
  const src = assetImg(im.file);
  const found = findImage(img, src, im.width, { circle: !!(im.round || im.rounded) });
  measures[`image:${im.id}`] = { score: +found.score.toFixed(3), color: found.color, box: found.box };
  const problems = [];
  if (found.score < 0.85 || !found.colorOk) {
    check(`image "${im.id}"`, false, `${im.file} wasn't found at about ${im.width}px wide (best match ${found.score.toFixed(2)}${found.colorOk === false ? `, its colors ${found.color} ΔE off` : ""})`);
    continue;
  }
  const b = found.box;
  boxes[im.id] = b;
  if (Math.abs(b.width - im.width) > 3) problems.push(`it's ${b.width}px wide, not ${im.width}px`);
  const cx = (b.left + b.right) / 2, cy = (b.top + b.bottom) / 2;
  if (im.region === "top-left" && !(cx < W / 2 && cy < H / 2)) problems.push("it isn't in the top left");
  if (im.region === "bottom-right" && !(cx > W / 2 && cy > H / 2)) problems.push("it isn't in the bottom right");
  if (im.align === "center" && Math.abs(cx - W / 2) > 12) problems.push(`it isn't centered (its center is ${Math.round(cx - W / 2)}px off)`);
  // Corners: a round image's 10% in from each corner, a rounded one's first pixel, aren't the image.
  if (im.round || im.rounded) {
    const k = im.round ? 0.1 : 0;
    const corners = [[k, k], [1 - k, k], [k, 1 - k], [1 - k, 1 - k]].map(([fx, fy]) => [b.left + 1 + fx * (b.width - 3), b.top + 1 + fy * (b.height - 3)]);
    const square = corners.filter(([x, y]) => near(pixel(img, x, y), assetPixel(src, b, x, y), 12));
    if (square.length) problems.push(im.round ? "it isn't round: its corners are drawn" : "its corners aren't rounded");
  }
  check(`image "${im.id}"`, problems.length === 0, problems.join("; "));
}

// ─── Text as shown: OCR on the ink mask ──────────────────────────────────

const inks = [...new Map(spec.texts.map((t) => [t.color.toLowerCase(), parseColor(t.color)])).values()];
const grounds = [bgColor, ...spec.fills.map((f) => parseColor(f.color)), ...Object.values(edges).map((e) => parseColor(e.color)), ...(bgImage ? sampleColors(bgImage) : [])]
  .filter(Boolean).filter((g) => !inks.some((i) => near(i, g, 1)));
const mask = inkMask(img, inks, grounds);
// The images found aren't text: blanked, so OCR doesn't read a picture beside a line into the line.
for (const b of Object.values(boxes)) {
  for (let y = Math.max(0, b.top - 2); y < Math.min(H, b.bottom + 2); y++) for (let x = Math.max(0, b.left - 2); x < Math.min(W, b.right + 2); x++) mask[y * W + x] = 0;
}
const inImage = (w) => Object.values(boxes).some((b) => { const cx = (w.box.left + w.box.right) / 2, cy = (w.box.top + w.box.bottom) / 2; return cx >= b.left - 2 && cx <= b.right + 2 && cy >= b.top - 2 && cy <= b.bottom + 2; });

const tokens = (s) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/[-‐-―]/g, " ").split(/\s+/).map((w) => w.replace(/[^a-z0-9]/g, "")).filter(Boolean);
function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const like = (a, b) => (a.length <= 2 || b.length <= 2 ? a === b : 1 - lev(a, b) / Math.max(a.length, b.length) >= (Math.max(a.length, b.length) <= 3 ? 0.66 : 0.75));

/** OCR words as tokens, letter-spaced single letters on a line joined into one. */
function ocrTokens(words) {
  const out = [];
  for (const w of words) {
    for (const t of tokens(w.text)) {
      const last = out.at(-1);
      if (t.length === 1 && last && last.single && last.line === w.line) { last.text += t; last.box = union(last.box, w.box); continue; }
      out.push({ text: t, box: w.box, line: w.line, single: t.length === 1 });
    }
  }
  return out;
}
const union = (a, b) => ({ left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom) });

/** The best place a text's words are read, in order: { matched, of, words }. */
function match(text, toks) {
  const want = tokens(text);
  let best = { matched: 0, of: want.length, words: [] };
  // A word OCR split in two ("in cremental") or two it ran together ("halfwith"): joined only where no single word
  // matches, and only when they're nearly the same.
  const joined = (a, b) => 1 - lev(a, b) / Math.max(a.length, b.length) >= 0.85;
  for (let start = 0; start < toks.length; start++) {
    if (!want.some((w) => like(w, toks[start].text))) continue;
    let k = start, matched = 0;
    const words = [];
    for (let j = 0; j < want.length; j++) {
      let hit = -1, span = 1;
      for (let look = 0; look <= 2 && k + look < toks.length && hit < 0; look++) if (like(want[j], toks[k + look].text)) hit = k + look;
      for (let look = 0; look <= 2 && k + look < toks.length && hit < 0; look++) {
        const t = toks[k + look];
        if (k + look + 1 < toks.length && joined(want[j], t.text + toks[k + look + 1].text)) { hit = k + look; span = 2; }
        else if (j + 1 < want.length && joined(want[j] + want[j + 1], t.text)) { hit = k + look; j++; matched++; }
      }
      if (hit >= 0) {
        matched++;
        for (let s = 0; s < span; s++) words.push(toks[hit + s]);
        k = hit + span;
      }
    }
    if (matched > best.matched) best = { matched, of: want.length, words };
    if (matched === want.length) break;
  }
  return best;
}

const passes = [];
const read = async (scale) => {
  const words = (await readWords(mask, W, H, scale, `s${scale}:`)).filter((w) => !inImage(w));
  passes.push({ scale, words, toks: ocrTokens(words) });
};
await read(1);
const found = {};
for (const t of spec.texts) found[t.id] = match(t.text, passes[0].toks);
for (const scale of [0.5, 1.5]) {
  if (spec.texts.every((t) => found[t.id].matched >= Math.ceil(0.9 * found[t.id].of))) break;
  await read(scale);
  for (const t of spec.texts) {
    const m = match(t.text, passes.at(-1).toks);
    if (m.matched > found[t.id].matched) found[t.id] = m;
  }
}
measures.ocrPasses = passes.length;
const lineBoxes = {};
for (const t of spec.texts) {
  const m = found[t.id];
  measures[`ocr:${t.id}`] = `${m.matched}/${m.of}`;
  const problems = [];
  if (m.matched < Math.ceil(0.9 * m.of)) {
    const read = passes[0].words.map((w) => w.text).join(" ").slice(0, 240);
    check(`shows "${t.id}"`, false, `only ${m.matched} of its ${m.of} words can be read in the image (it reads: "${read}")`);
    continue;
  }
  const box = m.words.map((w) => w.box).reduce(union);
  boxes[t.id] = box;
  // Lines by where the words sit (OCR's own lines aren't the drawn ones in sparse mode): a word joins a line whose
  // middle is within half its height of its own.
  const lines = [];
  for (const w of [...m.words].sort((a, b) => a.box.top - b.box.top)) {
    const mid = (w.box.top + w.box.bottom) / 2, h = w.box.bottom - w.box.top;
    const line = lines.find((l) => Math.abs((l.top + l.bottom) / 2 - mid) <= Math.max(h, l.bottom - l.top) / 2);
    if (line) Object.assign(line, union(line, w.box));
    else lines.push({ ...w.box });
  }
  lineBoxes[t.id] = lines;
  measures[`lines:${t.id}`] = lines.map((l) => [l.left, l.top, l.right, l.bottom].map(Math.round));
  measures[`words:${t.id}`] = m.words.map((w) => w.text);
  const margin = spec.safeMargin;
  if (box.left < margin || box.top < margin || box.right > W - margin || box.bottom > H - margin) problems.push(`it's within ${margin}px of an edge`);
  // Drawn in its color: some of the pixels in its words are that color.
  const want = lab(parseColor(t.color));
  let inked = 0, area = 0;
  for (const w of m.words) {
    for (let y = Math.floor(w.box.top); y < Math.ceil(w.box.bottom); y++) for (let x = Math.floor(w.box.left); x < Math.ceil(w.box.right); x++) {
      area++;
      if (deltaE(lab(pixel(img, x, y)), want) <= 12) inked++;
    }
  }
  measures[`ink:${t.id}`] = +(inked / Math.max(1, area)).toFixed(3);
  if (inked / Math.max(1, area) < 0.02) problems.push(`it isn't drawn in ${t.color}`);
  if (t.maxLines && lines.length > t.maxLines) problems.push(`it's on ${lines.length} lines, more than ${t.maxLines}`);
  if (t.align === "center") {
    const off = lines.map((l) => Math.round((l.left + l.right) / 2 - W / 2)).filter((d) => Math.abs(d) > 16);
    if (off.length) problems.push(`it isn't centered (${off.map((d) => `${d}px`).join(", ")} off)`);
  }
  if (t.align === "left" && lines.length > 1) {
    const lefts = lines.map((l) => l.left);
    if (Math.max(...lefts) - Math.min(...lefts) > 8) problems.push("its lines aren't left-aligned");
  }
  check(`shows "${t.id}"`, problems.length === 0, problems.join("; "));
}

// Text over text: no line of one text overlaps a line of another.
{
  const ids = Object.keys(lineBoxes);
  const clashes = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    for (const a of lineBoxes[ids[i]]) for (const b of lineBoxes[ids[j]]) {
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w > 2 && h > 2) clashes.push(`"${ids[i]}" and "${ids[j]}"`);
    }
  }
  check("no overlapping text", clashes.length === 0, `${[...new Set(clashes)].join(", ")} overlap`);
}

// Fills: the color just around a text (a pill, a card).
for (const fill of spec.fills) {
  const b = boxes[fill.around];
  if (!b) { check(`fill around "${fill.around}"`, false, "its text wasn't found"); continue; }
  // Strips 4–9px straight above and below the text's middle, and beside its middle: not the corners, which a
  // pill's rounded ends leave out.
  const w = b.right - b.left, h = b.bottom - b.top;
  const strips = [
    { left: b.left + 0.2 * w, right: b.right - 0.2 * w, top: b.top - 9, bottom: b.top - 4 },
    { left: b.left + 0.2 * w, right: b.right - 0.2 * w, top: b.bottom + 4, bottom: b.bottom + 9 },
    { left: b.left - 9, right: b.left - 4, top: b.top + 0.3 * h, bottom: b.bottom - 0.3 * h },
    { left: b.right + 4, right: b.right + 9, top: b.top + 0.3 * h, bottom: b.bottom - 0.3 * h },
  ];
  const px = strips.flatMap((s) => ring(img, { left: 0, top: 0, right: 0, bottom: 0 }, s));
  const want = lab(parseColor(fill.color));
  const share = px.filter((p) => deltaE(lab(p), want) <= 5).length / Math.max(1, px.length);
  measures[`fill:${fill.around}`] = +share.toFixed(3);
  measures[`fillStrips:${fill.around}`] = strips.map((s) => { const p = ring(img, { left: 0, top: 0, right: 0, bottom: 0 }, s); return +(p.filter((q) => deltaE(lab(q), want) <= 5).length / Math.max(1, p.length)).toFixed(2); });
  measures[`box:${fill.around}`] = b;
  const typical = [0, 1, 2].map((c) => px.map((p) => p[c]).sort((x, y) => x - y)[px.length >> 1] ?? 0);
  check(`fill around "${fill.around}"`, share >= 0.8, `the color around it is mostly ${hex(typical)}, not ${fill.color}`);
}

// ─── Layout ──────────────────────────────────────────────────────────────

const need = (...ids) => ids.filter((id) => !boxes[id]);
const notFound = (ids) => `${ids.map((id) => `"${id}"`).join(" and ")} ${ids.length > 1 ? "weren't" : "wasn't"} found`;
for (const [a, b] of spec.order ?? []) {
  const missing = need(a, b);
  if (missing.length) { check(`"${a}" above "${b}"`, false, notFound(missing)); continue; }
  check(`"${a}" above "${b}"`, boxes[a].bottom <= boxes[b].top + 4, `"${a}" isn't above "${b}"`);
}
for (const [a, b] of spec.sideBySide ?? []) {
  const missing = need(a, b);
  if (missing.length) { check(`"${a}" left of "${b}"`, false, notFound(missing)); continue; }
  const A = boxes[a], B = boxes[b];
  // Beside: wholly on its left, and level with it (their middles within 160px).
  const level = Math.abs((A.top + A.bottom) / 2 - (B.top + B.bottom) / 2) <= 160;
  check(`"${a}" left of "${b}"`, A.right <= B.left + 4 && level, `"${a}" isn't beside "${b}", on its left`);
}
for (const id of spec.bottom ?? []) {
  if (!boxes[id]) { check(`"${id}" at the bottom`, false, `${id} wasn't found`); continue; }
  check(`"${id}" at the bottom`, (boxes[id].top + boxes[id].bottom) / 2 >= (2 * H) / 3, `"${id}" isn't in the bottom third of the card`);
}
if (spec.vcenter) {
  const [a, b] = spec.vcenter;
  const missing = need(a, b);
  if (missing.length) check("centered vertically", false, notFound(missing));
  else {
    const off = (boxes[a].top + boxes[b].bottom) / 2 - H / 2;
    check("centered vertically", Math.abs(off) <= 24, `the group from "${a}" to "${b}" is ${Math.round(off)}px off the card's middle`);
  }
}

await finish({ warnings: trace.warnings?.length ?? 0 });
