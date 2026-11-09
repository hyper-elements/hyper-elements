// The `change` checks (task 7): the agent's render of a changed template against the start template's render.
//
//   node tools/check-change.mjs --baseline <file>   measures out/email.html (the start's render) into <file>
//   node tools/check-change.mjs [--json]            checks out/email.html against tools/checks/change/baseline.json
//
// tools/checks/change/spec.json:
//   { "widths": [800, 375],
//     "allow":  [{ "text", "property", "width"? }],   the asked changes: left out of "unchanged"
//     "styles", "hovers": as the styles checker's      the asked changes hold
//     "grows":  [{ "above", "below", "width", "min" }] the space between two texts grew by at least min px }
//
// At each width the shown texts are the same, in the same order, and each keeps its font size, weight, color and
// background, apart from the asked changes. Positions may change.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { open, reporter, styleChecks } from "./check-lib.mjs";

const tools = dirname(fileURLToPath(import.meta.url));
const run = resolve(tools, "..");
const spec = JSON.parse(readFileSync(join(tools, "checks/change/spec.json"), "utf8"));
const widths = spec.widths ?? [800, 375];
const PROPS = ["fontSize", "fontWeight", "color", "backgroundColor"];
const file = join(run, "out/email.html");

/** What's measured at each width: every shown text with its look, and the space for each `grows` pair. */
async function measure(page, at) {
  const out = {};
  for (const w of widths) {
    await at(w);
    const texts = await page.evaluate(() => __texts());
    const gaps = await page.evaluate((pairs) => pairs.map((g) => { const a = __find(g.above), b = __find(g.below); return a && b ? __textRect(b).top - __textRect(a).bottom : null; }), (spec.grows ?? []).filter((g) => g.width === w));
    out[w] = { texts, gaps };
  }
  return out;
}

const b = process.argv.indexOf("--baseline");
if (b > -1) {
  const { browser, page, at } = await open(file);
  writeFileSync(process.argv[b + 1], JSON.stringify(await measure(page, at), null, 2));
  await browser.close();
  process.exit(0);
}

const { check, finish } = reporter();
if (!existsSync(file)) {
  check("output exists", false, "out/email.html was not found");
  finish();
}
const baseline = JSON.parse(readFileSync(join(tools, "checks/change/baseline.json"), "utf8"));
const { browser, page, at } = await open(file);
const now = await measure(page, at);
const allowed = (text, property, width) => (spec.allow ?? []).some((a) => text.includes(a.text) && a.property === property && (a.width === undefined || a.width === width));

for (const w of widths) {
  const before = baseline[w].texts, after = now[w].texts;
  const same = before.length === after.length && before.every((t, i) => t.text === after[i].text);
  check(`same text, in the same order, at ${w}px`, same, (() => {
    const i = before.findIndex((t, k) => t.text !== after[k]?.text);
    return i < 0 ? `${after.length - before.length} more text runs` : `"${before[i].text}" became ${after[i] ? `"${after[i].text}"` : "nothing"}`;
  })());
  if (!same) continue;
  const changed = [];
  before.forEach((t, i) => {
    for (const p of PROPS) if (t[p] !== after[i][p] && !allowed(t.text, p, w)) changed.push(`"${t.text}" ${p} ${t[p]} → ${after[i][p]}`);
  });
  check(`nothing else changed at ${w}px`, changed.length === 0, changed.slice(0, 4).join("; "));
}

await styleChecks(page, at, spec, check, "asked: ");
for (const g of spec.grows ?? []) {
  const i = (spec.grows ?? []).filter((x) => x.width === g.width).indexOf(g);
  const was = baseline[g.width].gaps[i], is = now[g.width].gaps[i];
  check(`asked: more space between "${g.above}" and "${g.below}" at ${g.width}px`, was !== null && is !== null && is - was >= g.min - 0.5,
    was === null || is === null ? "one of the texts isn't shown" : `${Math.round(was)}px → ${Math.round(is)}px, not ${g.min}px more`);
}
await browser.close();
finish();
