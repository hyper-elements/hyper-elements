// The `pdf` checks, on out/document.pdf read with pdf.js. tools/checks/pdf/spec.json:
//
//   { "pages": 1, "size": "A4",
//     "texts": ["…"],                                   the copy, in reading order
//     "table": { "header": ["Item", …], "firstItem": "…", "prices": ["$…"], "totals": ["$…"] },
//     "fonts": ["Inter"] }                              every embedded font's name starts with one of these
//
// The header's texts share one line (±2pt) above the first item; each total's right edge is within 2pt of the line
// items' prices' right edge.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { reporter } from "./check-lib.mjs";

const tools = dirname(fileURLToPath(import.meta.url));
const run = resolve(tools, "..");
const spec = JSON.parse(readFileSync(join(tools, "checks/pdf/spec.json"), "utf8"));
const SIZES = { A4: [595.28, 841.89], Letter: [612, 792], A5: [419.53, 595.28], Legal: [612, 1008] };
const { check, finish } = reporter();
const file = join(run, "out/document.pdf");
if (!existsSync(file)) {
  check("output exists", false, "out/document.pdf was not found");
  finish();
}
const bytes = new Uint8Array(readFileSync(file));
const norm = (s) => s.replace(/[   ]/g, " ").replace(/\s+/g, " ").trim();

const doc = await getDocument({ data: bytes.slice(), useSystemFonts: false, disableFontFace: true, verbosity: 0 }).promise;
const pages = [];
for (let n = 1; n <= doc.numPages; n++) {
  const p = await doc.getPage(n);
  const [x0, y0, x1, y1] = p.view;
  const items = (await p.getTextContent()).items.filter((i) => i.str.trim()).map((i) => ({ str: norm(i.str), x: i.transform[4], y: i.transform[5], right: i.transform[4] + i.width }));
  pages.push({ width: x1 - x0, height: y1 - y0, items });
}

if (spec.pages !== undefined) check("page count", pages.length === spec.pages, `${pages.length} pages, not ${spec.pages}`);
if (spec.size) {
  const [w, h] = SIZES[spec.size];
  const wrong = pages.filter((p) => Math.abs(p.width - w) > 1 || Math.abs(p.height - h) > 1);
  check(`${spec.size} pages`, wrong.length === 0, wrong.map((p) => `${p.width.toFixed(2)} × ${p.height.toFixed(2)} pt`).join(", "));
}

// The copy, in reading order: each text found after the one before it, across the pages' text runs.
const all = pages.flatMap((p) => p.items.map((i) => i.str)).join(" ");
let from = 0;
const unordered = [];
for (const t of spec.texts ?? []) {
  const at = all.indexOf(norm(t), from);
  if (at < 0) unordered.push(all.includes(norm(t)) ? `"${t}" (out of order)` : `"${t}"`);
  else from = at + norm(t).length;
}
check("required copy, in order", unordered.length === 0, `missing: ${unordered.join(", ")}`);

// The table, on the first page: a run whose text is exactly the label.
const items = pages[0]?.items ?? [];
const find = (label) => items.find((i) => i.str === norm(label));
if (spec.table) {
  const { header, firstItem, prices = [], totals = [] } = spec.table;
  const hs = header.map(find);
  const first = find(firstItem);
  if (hs.some((h) => !h) || !first) check("table header", false, `not found: ${[...header.filter((_, i) => !hs[i]), ...(first ? [] : [firstItem])].join(", ")}`);
  else check("table header", hs.every((h) => Math.abs(h.y - hs[0].y) <= 2) && hs[0].y > first.y + 2, "the header's texts aren't on one line above the first item");
  const column = prices.map(find);
  if (column.some((p) => !p)) check("price column", false, `not found: ${prices.filter((_, i) => !column[i]).join(", ")}`);
  else {
    const edge = Math.max(...column.map((p) => p.right));
    for (const t of totals) {
      const x = find(t);
      check(`total ${t} on the right`, x && Math.abs(x.right - edge) <= 2, x ? `its right edge is at ${x.right.toFixed(1)}pt, the prices' at ${edge.toFixed(1)}pt` : "not found");
    }
  }
}

// The fonts it embeds, by their /BaseFont names (a subset's tag aside): none of the standard fonts in their place.
if (spec.fonts) {
  const names = [...new Set([...Buffer.from(bytes).toString("latin1").matchAll(/\/BaseFont\s*\/(?:[A-Z]{6}\+)?([\w-]+)/g)].map((m) => m[1]))];
  const other = names.filter((n) => !spec.fonts.some((f) => n.startsWith(f)));
  check(`fonts: ${spec.fonts.join(", ")}`, names.length > 0 && other.length === 0, names.length ? `also embeds ${other.join(", ")}` : "no font found");
}
finish();
