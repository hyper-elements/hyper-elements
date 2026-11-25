// The template suite's wiring, without a model call or a browser: each production kit is its authoring kit plus
// the maintainers' brand files, each brief runs in its own kits, a run gets the checkers the harness counts, and the
// report reads its rows. `npm run selftest:template` checks the checkers themselves.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import { briefOf, briefsOf, jobsOf, kitOf, makeRun, suiteOf } from "../lib/make-run.mjs";

const bench = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = realpathSync(mkdtempSync(join(tmpdir(), "template-kits-")));
test.after(() => rm(root, { recursive: true, force: true }));
const KITS = ["he", "react-email", "mjml", "html"];

test("each production kit extends its authoring kit, with the maintainers' brand files and its brand reference", async () => {
  for (const kit of KITS) {
    const k = await kitOf("template", kit);
    assert.deepEqual(k.dirs.map((d) => d.split("/").pop()), [`${kit}-author`, kit], kit);
    assert.ok(existsSync(join(k.dir, "tools/brand-reference.json")), `${kit}: tools/brand-reference.json`);
    const parts = JSON.parse(readFileSync(join(k.dir, "tools/brand-reference.json"), "utf8"));
    assert.match(parts.header, /orbit-logo\.png/, kit);
    assert.match(parts.footer, /Unsubscribe/, kit);
    const author = await kitOf("template", `${kit}-author`);
    assert.ok(existsSync(join(author.dir, "tools/adapter.mjs")), `${kit}-author: its adapter`);
    for (const body of ["reference", "color", "raw", "offsite", "nocta"]) assert.ok(existsSync(join(author.dir, `tools/bodies/${body}.json`)), `${kit}-author: ${body}`);
  }
});

test("the newsletter briefs run in the production kits, the authoring brief in the authoring kits", async () => {
  const suite = await suiteOf("template");
  assert.deepEqual(Object.keys(suite.groups).slice(0, 2), ["email", "authoring"]);
  const email = await briefsOf("template", "email");
  assert.equal(email.length, 5);
  await assert.rejects(briefsOf("template", "all"), /takes a group/);
  const all = [...KITS, ...KITS.map((k) => `${k}-author`)];
  const briefKits = Object.fromEntries(await Promise.all([...email, "authoring"].map(async (b) => [b, (await briefOf("template", b)).run?.kits ?? null])));
  const jobs = jobsOf(all, [...email, "authoring"], 1, briefKits);
  assert.equal(jobs.length, 5 * 4 + 4);
  assert.ok(jobs.filter(([, b]) => b === "authoring").every(([k]) => k.endsWith("-author")));
  assert.ok(jobs.filter(([, b]) => b !== "authoring").every(([k]) => !k.endsWith("-author")));
});

test("a newsletter run gets the email check and the guardrails; an authoring run the authoring check, without the brand files", async () => {
  const run = await makeRun("template", "he", "news-launch", "0", root);
  for (const f of ["tools/check.mjs", "tools/guardrails.mjs", "tools/brand.json", "tools/brand-reference.json", "tools/spec.json", "templates/newsletter.tsx", "CLAUDE.md"]) assert.ok(existsSync(join(run, f)), f);
  assert.match(readFileSync(join(run, "tools/check.mjs"), "utf8"), /The shared quality bar/);
  assert.match(readFileSync(join(run, "BRIEF.md"), "utf8"), /Orbit 3\.0 is here/);
  const author = await makeRun("template", "react-email-author", "authoring", "0", root);
  assert.match(readFileSync(join(author, "tools/check.mjs"), "utf8"), /authoring check/);
  for (const f of ["tools/email-check.mjs", "tools/guardrails.mjs", "tools/adapter.mjs", "tools/bodies/raw.json"]) assert.ok(existsSync(join(author, f)), f);
  assert.ok(!existsSync(join(author, "emails/brand.tsx")), "the authoring agent writes the brand files itself");
  assert.ok(!existsSync(join(author, "tools/brand-reference.json")));
});

test("the launch kits: each production kit extends its authoring kit, each revise kit its production kit, with its start", async () => {
  for (const kit of ["launch-he", "launch-satori", "launch-playwright"]) {
    assert.deepEqual((await kitOf("template", kit)).dirs.map((d) => d.split("/").pop()), [`${kit}-author`, kit]);
    const revise = await kitOf("template", `${kit}-revise`);
    assert.deepEqual(revise.dirs.map((d) => d.split("/").pop()), [`${kit}-author`, kit, `${kit}-revise`]);
    assert.ok(existsSync(join(revise.dir, "tools/start/designs")), `${kit}-revise: its start`);
  }
  const groups = (await suiteOf("template")).groups;
  assert.equal(groups.launch.length, 5);
  assert.equal(groups["launch-hostile"].length, 7);
  assert.deepEqual(groups["launch-revision"], ["launch-r-date", "launch-r-feature"]);
});

test("a launch run gets both formats' specs, the image checker, the launch check and the two-format render tool", async () => {
  const run = await makeRun("template", "launch-satori", "launch-launch", "0", root);
  for (const f of ["tools/check.mjs", "tools/image-check.mjs", "tools/ocr.mjs", "tools/pixels.mjs", "tools/trace.mjs", "tools/render.mjs", "tools/render-launch.mjs", "tools/brand-launch.json", "tools/spec-square.json", "tools/spec-landscape.json", "templates/launch.tsx", "cards/render.tsx", "fonts/Inter-Bold.ttf", "assets/orbit-logo-white.png", "art/shot-launch.png"]) assert.ok(existsSync(join(run, f)), f);
  assert.ok(!existsSync(join(run, "art/MANIFEST.json")) && !existsSync(join(run, "art/make.mjs")));
  assert.match(readFileSync(join(run, "tools/check.mjs"), "utf8"), /launch graphic check/);
  assert.deepEqual(JSON.parse(readFileSync(join(run, "tools/spec-landscape.json"), "utf8")).size, [1200, 630]);
  const nobold = await makeRun("template", "launch-he", "launch-h-nobold", "0", root);
  assert.ok(existsSync(join(nobold, "fonts/Inter-Regular.ttf")) && !existsSync(join(nobold, "fonts/Inter-Bold.ttf")), "no bold file");
  const revision = await makeRun("template", "launch-he-revise", "launch-r-date", "0", root);
  assert.match(readFileSync(join(revision, "tools/check.mjs"), "utf8"), /revision check/);
  assert.ok(existsSync(join(revision, "tools/check-launch.mjs")) && existsSync(join(revision, "designs/launch.tsx")));
  const authoring = await makeRun("template", "launch-playwright-author", "launch-authoring", "0", root);
  assert.ok(existsSync(join(authoring, "tools/values.json")) && existsSync(join(authoring, "tools/reference-design.mjs")));
  assert.ok(!existsSync(join(authoring, "templates/launch.ts")), "the authoring agent writes the template itself");
});

test("the report gives the guardrails each issue broke, and the authoring runs' hostile bodies", () => {
  const rows = [
    { suite: "template", kit: "he", brief: "news-launch", rep: 0, pass: true, failed: [], valid: true, violations: [], wallMs: 1000, inputTokens: 1, cacheWriteTokens: 0, cacheReadTokens: 0, outputTokens: 1, costUsd: 0.1, turns: 3, checkRuns: 1, toolCalls: 4 },
    { suite: "template", kit: "html", brief: "news-launch", rep: 0, pass: true, failed: [], valid: true, violations: ["palette colors", "UTM parameter"], wallMs: 2000, inputTokens: 1, cacheWriteTokens: 0, cacheReadTokens: 0, outputTokens: 1, costUsd: 0.1, turns: 3, checkRuns: 1, toolCalls: 4 },
    { suite: "template", kit: "he-author", brief: "authoring", rep: 0, pass: true, failed: [], valid: true, measures: { hostile: 4, held: 4, escaped: 0, sourceFindings: 0, bodies: [] }, wallMs: 3000, inputTokens: 1, cacheWriteTokens: 0, cacheReadTokens: 0, outputTokens: 1, costUsd: 0.1, turns: 3, checkRuns: 1, toolCalls: 4 },
  ];
  const file = join(root, "rows.jsonl");
  writeFileSync(file, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  const r = spawnSync(process.execPath, [join(bench, "lib/report.mjs"), file, "--json"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout.trim().split("\n").pop());
  assert.deepEqual(out.template.escapes.map((e) => [e.kit, e.violations]), [["he", 0], ["html", 2]]);
  assert.deepEqual(out.template.authoring.map((a) => [a.kit, a.medHeld, a.medEscaped]), [["he-author", 4, 0]]);
});
