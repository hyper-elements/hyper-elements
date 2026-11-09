// The skill suite's checkers pass every reference solution, and fail references broken on purpose, each on the check
// named for it (the image selftest's pattern). No model call.
//
//   node --test test/skill-checkers.test.mjs
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { baselineOf, preflight, reference, renderAndCheck } from "../lib/preflight.mjs";
import { briefOf, briefsOf, kitOf, runOf, suiteOf } from "../lib/make-run.mjs";

const root = realpathSync(mkdtempSync(join(tmpdir(), "skill-checkers-")));
test.after(() => rm(root, { recursive: true, force: true }));
const s = await suiteOf("skill");
const k = await kitOf("skill", "candidate");
const baseline = await baselineOf("change", root, join(root, "baselines/change.json"));
const extraOf = (brief) => (brief === "change" ? { "tools/checks/change/baseline.json": baseline } : {});

for (const brief of await briefsOf("skill", "core")) {
  test(`${brief}: the reference passes every check`, async () => {
    const r = await reference(brief, root, { extra: extraOf(brief) });
    assert.equal(r.render.status, 0, r.render.stdout + r.render.stderr);
    assert.ok(r.verdict, r.check?.stderr);
    assert.ok(r.verdict.pass, JSON.stringify(r.verdict.results.filter((x) => !x.ok)));
    assert.ok(r.verdict.total >= 4, `only ${r.verdict.total} checks ran`);
    const tsc = spawnSync(join(r.dir, "node_modules/.bin/tsc"), ["--noEmit"], { cwd: r.dir, encoding: "utf8" });
    assert.equal(tsc.status, 0, tsc.stdout);
  });
}

test("the preflight fails when Chromium is missing", async () => {
  const before = process.env.PLAYWRIGHT_BROWSERS_PATH;
  process.env.PLAYWRIGHT_BROWSERS_PATH = mkdtempSync(join(root, "no-browsers-"));
  try {
    const pre = await preflight({ kits: ["candidate"], briefs: ["event"], root, baselines: join(root, "baselines") });
    assert.equal(pre.problems.length, 1);
    assert.match(pre.problems[0], /^event: the checker crashed on the reference/);
  } finally {
    if (before === undefined) delete process.env.PLAYWRIGHT_BROWSERS_PATH;
    else process.env.PLAYWRIGHT_BROWSERS_PATH = before;
  }
});

/**
 * Each broken reference: the brief, what's changed in its source (a [from, to] replacement, each of which must
 * apply), and the checks that must fail (every other check may pass or fail).
 */
const BROKEN = [
  ["page: no breakpoints, so it stacks at 375 but not at 600", "landing", [["breakpoints={{ mobile: 640 }} ", ""]], [/^page: columns stacked at 600px/]],
  ["styles: landing without its link hover", "landing", [[", hover: { color: \"#4c3df0\" }", ""]], [/^styles: hover color of "Docs"/]],
  ["styles: tailwind without mb-4", "tailwind", [["<Column style={{ gap: 16 }}>", "<Column style={{ gap: 4 }}>"]], [/^styles: space between "Orbit 3.0 is here" and "Faster renders/]],
  ["styles: tailwind without md:text-lg", "tailwind", [["fontSize: 18, mobile: { fontSize: 16 }", "fontSize: 16"]], [/^styles: font-size of "Faster renders, a new editor and dark mode." at 1200px/]],
  ["styles: tailwind without hover:bg-indigo-700", "tailwind", [[", hover: { backgroundColor: \"#4338ca\" }", ""]], [/^styles: hover background-color of "Upgrade now"/]],
  ["styles: tailwind without mt-8", "tailwind", [["padding: 48, gap: 32", "padding: 48, gap: 4"]], [/^styles: space between "Upgrade now" and "Orbit Labs/]],
  ["styles: digest's heading not smaller on phones", "digest", [["fontSize: 32, mobile: { fontSize: 24 }", "fontSize: 32"]], [/^styles: font-size of "Three things shipped this week" at 375px/]],
  ["styles: digest's tip not hidden on phones", "digest", [["hidden={{ mobile: true }} ", ""]], [/^styles: "Reading on a desktop\? .*" hidden at 375px/]],
  ["pdf: a Letter page", "invoice", [['size="A4"', 'size="Letter"']], [/^pdf: A4 pages/]],
  ["pdf: two pages", "invoice", [["      <Text style={{ fontSize: 9", "      <PageBreak />\n      <Text style={{ fontSize: 9"], ["import { Document,", "import { Document, PageBreak,"]], [/^pdf: page count/]],
  ["pdf: totals aligned left", "invoice", [["<TableCell style={right}>{amount}</TableCell>", "<TableCell>{amount}</TableCell>"]], [/^pdf: total \$4,550\.00 on the right/, /^pdf: total \$364\.00 on the right/]],
  ["pdf: a missing word", "invoice", [["Bill to: Northwind Traders", "Bill to: Northwind"]], [/^pdf: required copy, in order/]],
  ["pdf: Helvetica, not Inter", "invoice", [['fontFamily: "Inter", ', ""]], [/^pdf: fonts: Inter/]],
  ["change: another color changed", "change", [['<Text style={{ color: "#374151" }}>Dark mode', '<Text style={{ color: "#111827" }}>Dark mode']], [/^change: nothing else changed at 800px/, /^change: nothing else changed at 375px/]],
  ["change: a word changed", "change", [["Read the update", "Read the news"]], [/^change: same text, in the same order, at 800px/]],
  ["change: the heading changed on desktop too", "change", [["fontSize: 28, color: \"#111827\", mobile: { fontSize: 20 }", "fontSize: 20, color: \"#111827\""]], [/^change: nothing else changed at 800px/, /^change: asked: font-size of "What's new in Orbit" at 800px/]],
  ["change: the paragraphs no further apart", "change", [["<Column style={{ gap: 20 }}>", "<Column style={{ gap: 8 }}>"]], [/^change: asked: more space between/]],
  ["text: a missing item", "report", [['{ name: "Emails sent", value: "48,902" },\n', ""]], [/^text: plain text has "Emails sent"/, /^text: plain text has "48,902"/]],
  ["open: an image with no size (neither the file's nor one shown)", "welcome", [['src={{ src: "https://assets.orbit.dev/img/orbit-logo.png", width: 252, height: 128 }} alt="Orbit" style={{ width: 126 }}', 'src="https://assets.orbit.dev/img/orbit-logo.png" alt="Orbit"']], [/^open: no errors or warnings/]],
  ["open: no MergeTag", "welcome", [['Welcome to Orbit, <MergeTag name="first_name" />', "Welcome to Orbit"], [" MergeTag,", ""]], [/^open: uses MergeTag/]],
];

for (const [name, brief, edits, mustFail] of BROKEN) {
  test(`fails a reference broken on purpose: ${name}`, async () => {
    const r0 = await reference(brief, root, { extra: extraOf(brief) });
    const file = join(r0.dir, "src/template.tsx");
    let src = readFileSync(file, "utf8");
    for (const [from, to] of edits) {
      assert.ok(src.includes(from), `the edit doesn't apply: ${from}`);
      src = src.replace(from, to);
    }
    writeFileSync(file, src);
    const { render, verdict } = await renderAndCheck(r0.dir, runOf(s, k, await briefOf("skill", brief)));
    assert.equal(render.status, 0, render.stdout + render.stderr);
    assert.ok(verdict, "the checker crashed");
    assert.equal(verdict.pass, false, "it passed");
    const failed = verdict.results.filter((x) => !x.ok).map((x) => x.name);
    for (const re of mustFail) assert.ok(failed.some((f) => re.test(f)), `${re} didn't fail; failed: ${JSON.stringify(failed)}`);
  });
}
