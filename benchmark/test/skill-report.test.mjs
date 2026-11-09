// The skill suite's report (lib/report-skill.mjs), on fixtures: partial batches against plan.json, rows left out,
// unverified first tries, the paired interval, the coverage rule, N/A tasks, the mismatch list and the negative
// control.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { formatSkillReport, histogram, pairedInterval, parseResults, skillReport, wilson } from "../lib/report-skill.mjs";

const bench = fileURLToPath(new URL("..", import.meta.url));

/** A skill row: `ft` is the first try's validity (null: no render), verified unless `verified: false`. */
const row = (kit, brief, rep, { ft = true, verified = true, pass = true, mistakes = [], ...rest } = {}) => ({
  stamp: "s", suite: "skill", kit, brief, rep, model: "m", valid: true, tampered: [], readsUnpinned: [],
  firstTry: { verified, valid: ft }, fixRounds: { verified, rounds: ft ? 0 : 1, neverValid: false },
  pass, failed: pass ? [] : ["x"], mistakes: mistakes.map((key) => ({ key, severity: "error", text: key })),
  replay: { calls: 5, verified: verified ? 5 : 2, cutoff: verified ? null : { call: 3, tool: "Bash", input: "file out/a.png", reason: "a step that isn't replayable: file out/a.png" }, sourcesMatch: true, unverified: false },
  mismatch: false, lookedElsewhere: 0, warningsLeft: 0, turns: 8, outputTokens: 2000, inputTokens: 10, cacheReadTokens: 100, cacheWriteTokens: 50, costUsd: 0.12, wallMs: 30000,
  ...rest,
});
/** Rows for one task: a list of first-try results (true, false, null), one row each. */
const runs = (kit, brief, results, opts = {}) => results.map((ft, rep) => row(kit, brief, rep, { ft, ...opts }));
const planOf = (kits, briefs, reps, na = {}) => ({
  kits, briefs, reps, na,
  jobs: kits.flatMap((kit) => briefs.filter((b) => !(na[kit] ?? []).includes(b)).flatMap((brief) => Array.from({ length: reps }, (_, rep) => ({ kit, brief, rep })))),
});

test("Wilson's interval", () => {
  const [lo, hi] = wilson(8, 10);
  assert.ok(Math.abs(lo - 0.4902) < 1e-3 && Math.abs(hi - 0.9433) < 1e-3, `${lo} ${hi}`);
  assert.deepEqual(wilson(0, 0), null);
});

test("the paired interval: a known answer over three tasks, and relabelling one arm's tasks changes it where an unpaired rate can't", () => {
  // release 2/3, 0/3, 1/3; candidate 3/3, 2/3, 1/3: differences +1/3, +2/3, 0.
  const release = [...runs("release", "a", [true, true, false]), ...runs("release", "b", [false, false, false]), ...runs("release", "c", [true, false, false])];
  const candidate = [...runs("candidate", "a", [true, true, true]), ...runs("candidate", "b", [true, true, false]), ...runs("candidate", "c", [true, false, false])];
  const one = skillReport({ rows: [...release, ...candidate] });
  const c1 = one.comparisons[0];
  assert.equal(c1.base, "release");
  assert.equal(c1.other, "candidate");
  // The mean of the differences; with three tasks each resample's mean is at least the smallest difference, and one
  // resample in 27 is all of it, so the 2.5% and 97.5% points are the smallest and the largest.
  assert.ok(Math.abs(c1.delta.mean - 1 / 3) < 1e-9);
  assert.ok(Math.abs(c1.delta.lo - 0) < 1e-9 && Math.abs(c1.delta.hi - 2 / 3) < 1e-9, JSON.stringify(c1.delta));
  assert.equal(c1.verdict, "no clear difference");

  // The candidate's rows for b and c swapped: 3/3, 1/3, 2/3. Differences +1/3 each: the same pooled rates, a clear
  // difference.
  const swapped = candidate.map((r) => ({ ...r, brief: r.brief === "b" ? "c" : r.brief === "c" ? "b" : r.brief }));
  const two = skillReport({ rows: [...release, ...swapped] });
  const c2 = two.comparisons[0];
  assert.deepEqual([one.arms.candidate.firstTry.valid, one.arms.candidate.firstTry.of], [two.arms.candidate.firstTry.valid, two.arms.candidate.firstTry.of]);
  assert.ok(Math.abs(c2.delta.mean - 1 / 3) < 1e-9);
  assert.ok(Math.abs(c2.delta.lo - 1 / 3) < 1e-9 && Math.abs(c2.delta.hi - 1 / 3) < 1e-9);
  assert.equal(c2.verdict, "a clear difference: candidate higher");
  // Seeded: the same results give the same interval.
  assert.deepEqual(pairedInterval([0.1, -0.2, 0.4, 0]), pairedInterval([0.1, -0.2, 0.4, 0]));
});

test("coverage: an arm with 79% of its rows verified is inconclusive; 80% is compared", () => {
  const tasks = ["a", "b", "c"];
  // 24 rows, 19 verified (79.2%), against an arm with all verified.
  const low = tasks.flatMap((t, i) => Array.from({ length: 8 }, (_, rep) => row("candidate", t, rep, { verified: !(i * 8 + rep < 5) })));
  const base = tasks.flatMap((t) => runs("release", t, Array(8).fill(true)));
  const r79 = skillReport({ rows: [...base, ...low] });
  assert.match(r79.comparisons[0].verdict, /^inconclusive: coverage \(candidate 79% verified\)/);
  assert.equal(r79.arms.candidate.verified, 19);
  // 25 rows, 20 verified: 80%.
  const ok = [...low, row("candidate", "c", 8)];
  const r80 = skillReport({ rows: [...base, ...ok, row("release", "c", 8)] });
  assert.equal(r80.comparisons[0].verdict, "no clear difference");
  assert.match(formatSkillReport(r79), /inconclusive: coverage/);
});

test("an unverified first try counts in final pass, not in the first-try rate; a row cut off after its first render keeps it", () => {
  const rows = [
    row("candidate", "a", 0, { ft: false, verified: false, pass: true }), // cut off before its first render
    row("candidate", "a", 1, { ft: true, replay: { calls: 9, verified: 4, cutoff: { call: 5, tool: "Bash", input: "file out/a.png", reason: "a step that isn't replayable: file out/a.png" }, sourcesMatch: true } }),
    row("candidate", "a", 2, { ft: null }), // no render
  ];
  const a = skillReport({ rows }).arms.candidate;
  assert.deepEqual([a.firstTry.valid, a.firstTry.of], [1, 1]);
  assert.equal(a.finalPass, 3);
  assert.equal(a.verified, 2);
  assert.equal(a.noRender, 1);
  assert.deepEqual(a.cutoffs, [["a step that isn't replayable: file", 2]]);
});

test("a harness error, a tampered row and one that reached outside are counted and left out", () => {
  const rows = [
    ...runs("candidate", "a", [true, true]),
    { stamp: "s", suite: "skill", kit: "candidate", brief: "a", rep: 2, model: "m", harnessError: "the job threw twice", pass: false, valid: false, costUsd: 0 },
    row("candidate", "a", 3, { valid: false, tampered: ["changed tools/render.mjs"] }),
    row("candidate", "a", 4, { valid: false, outside: [{ path: "/Users/x/.ssh", got: true, own: false }] }),
  ];
  const rep = skillReport({ rows, plan: planOf(["candidate"], ["a"], 5) });
  const a = rep.arms.candidate;
  assert.equal(rep.partial, null, "every planned run has a row");
  assert.equal(a.runs, 2);
  assert.equal(a.finalPass, 2);
  assert.deepEqual(a.leftOut, { total: 3, "harness error": 1, tampered: 1, "reached outside": 1 });
  assert.deepEqual(rep.leftOut.map((l) => l.as), ["harness error", "tampered", "reached outside"]);
  assert.match(formatSkillReport(rep), /candidate a #2: harness error: the job threw twice/);
});

test("a partial batch is reported against its plan.json, rated over complete cells only, even when no cell finished", () => {
  const plan = planOf(["release", "candidate"], ["a", "b"], 3);
  const rows = [...runs("release", "a", [true, true, true]), ...runs("candidate", "a", [true, false, true]), ...runs("release", "b", [true])];
  const rep = skillReport({ rows, partial: [{ partial: true, reason: "cost", spentUsd: 4.1, maxCostUsd: 4 }], plan });
  assert.deepEqual(rep.partial.incomplete, [{ kit: "release", brief: "b", finished: 1, planned: 3 }, { kit: "candidate", brief: "b", finished: 0, planned: 3 }]);
  assert.deepEqual(rep.arms.release.tasks, ["a"]);
  assert.equal(rep.arms.release.runs, 3, "b's one finished run isn't rated");
  assert.deepEqual(rep.comparisons[0].tasks, ["a"]);
  assert.deepEqual(rep.comparisons[0].notCompared, [{ task: "b", why: "incomplete in release, incomplete in candidate" }]);
  const text = formatSkillReport(rep);
  assert.match(text, /^PARTIAL: 7 of 12 planned runs finished \(stopped: cost, \$4\.10 of \$4\)/);

  // A batch stopped before any cell finished.
  const none = skillReport({ rows: runs("release", "a", [true]), partial: [{ partial: true, reason: "cost", spentUsd: 1, maxCostUsd: 1 }], plan });
  assert.equal(none.partial.finished, 1);
  assert.deepEqual(none.arms.release.tasks, []);
  assert.equal(none.comparisons[0].verdict, "nothing to compare");
  assert.match(formatSkillReport(none), /No cell finished: nothing to rate\./);

  // Rows missing against the plan, with no partial line (the batch died): still partial.
  assert.ok(skillReport({ rows: runs("release", "a", [true]), plan }).partial);
});

test("a task N/A for one engine is left out of the paired comparison and named", () => {
  // Two engines with the same version; only the candidate accepts the landing page's probe (preflight: na).
  const plan = planOf(["release", "candidate"], ["a", "landing"], 2, { release: ["landing"] });
  const engine = (commit) => ({ engine: { name: "x", version: "0.3.0", commit, dirty: false } });
  const rows = [
    ...runs("release", "a", [true, true], engine("aaaaaaa1")),
    ...runs("candidate", "a", [true, true], engine("bbbbbbb2")), ...runs("candidate", "landing", [false, true], engine("bbbbbbb2")),
  ];
  const rep = skillReport({ rows, plan });
  assert.equal(rep.partial, null);
  assert.deepEqual(rep.comparisons[0].tasks, ["a"]);
  assert.deepEqual(rep.comparisons[0].notCompared, [{ task: "landing", why: "N/A for release" }]);
  assert.deepEqual(rep.arms.candidate.tasks, ["a", "landing"]);
  const text = formatSkillReport(rep);
  assert.match(text, /Not compared \(candidate − release\): landing \(N\/A for release\)/);
  assert.match(text, /release \(0\.3\.0 aaaaaaa\)/);
  assert.match(text, /landing\s+N\/A\s+1\/2/);
});

test("the mistake histogram counts each key once a run, per arm and per task", () => {
  const rows = [
    row("negative", "a", 0, { ft: false, mistakes: ["prop/unknown mobile", "prop/unknown mobile", "ts/TS2322 hover"] }),
    row("negative", "a", 1, { ft: false, mistakes: ["prop/unknown mobile"] }),
    row("negative", "b", 0, { ft: true, mistakes: [] }),
  ];
  assert.deepEqual(histogram(rows), [{ key: "prop/unknown mobile", runs: 2 }, { key: "ts/TS2322 hover", runs: 1 }]);
  const rep = skillReport({ rows });
  assert.deepEqual(rep.arms.negative.byTask.a.mistakes, [{ key: "prop/unknown mobile", runs: 2 }, { key: "ts/TS2322 hover", runs: 1 }]);
  assert.match(formatSkillReport(rep), /negative: prop\/unknown mobile ×2, ts\/TS2322 hover ×1\n {4}a: prop\/unknown mobile ×2/);
});

test("the mismatch list: the call, both results, the transcript and what the template read unpinned; a maintainer's mark leaves the row out", () => {
  const cutoff = { call: 4, tool: "Bash", input: "node tools/render.mjs", reason: "a step whose result differs from the replay's", mismatch: true, session: "[render] ok aaa in=x mac=1", replay: "[render] ok bbb in=x mac=2", output: "[render] ok aaa in=x mac=1" };
  const mm = row("candidate", "a", 1, { mismatch: true, readsUnpinned: ["src/template.tsx:3: performance"], replay: { calls: 6, verified: 3, cutoff, sourcesMatch: true, unverified: false } });
  const rows = [row("candidate", "a", 0), mm];
  const rep = skillReport({ rows });
  assert.deepEqual(rep.mismatches, [{
    id: "candidate a #1", call: 4, command: "node tools/render.mjs", reason: cutoff.reason, session: cutoff.session, replay: cutoff.replay,
    output: cutoff.output, readsUnpinned: ["src/template.tsx:3: performance"], transcript: "runs/s/candidate__a__1/transcript.jsonl", marked: null,
  }]);
  assert.equal(rep.arms.candidate.runs, 2, "a mismatch row is counted, cut off at that call");
  assert.deepEqual(rep.arms.candidate.cutoffs, [["mismatch", 1]]);
  assert.equal(rep.arms.candidate.leftOut.tampered, 0, "never tampered by itself");
  const text = formatSkillReport(rep);
  assert.match(text, /candidate a #1: call 4: a step whose result differs/);
  assert.match(text, /session: \[render\] ok aaa/);
  assert.match(text, /replay: {2}\[render\] ok bbb/);

  const marked = skillReport({ rows, marks: { "candidate a #1": { tampered: "ran a swapped render tool" } } });
  assert.equal(marked.arms.candidate.runs, 1);
  assert.equal(marked.arms.candidate.leftOut.tampered, 1);
  assert.equal(marked.mismatches[0].marked, "ran a swapped render tool");
  assert.deepEqual(marked.leftOut, [{ id: "candidate a #1", as: "tampered", why: "maintainer: ran a swapped render tool" }]);
});

test("the negative control: passed, failed, and inconclusive on coverage", () => {
  const tasks = ["digest", "landing", "change", "tailwind"];
  const plan = planOf(["candidate", "negative"], tasks, 5);
  const candidate = tasks.flatMap((t) => runs("candidate", t, [true, true, true, true, false]));
  const negative = tasks.flatMap((t) => runs("negative", t, [false, false, false, true, true], { mistakes: ["prop/unknown mobile"] }));
  const ok = skillReport({ rows: [...candidate, ...negative], plan }).negative;
  assert.equal(ok.verdict, "passed", JSON.stringify(ok.checks));

  // The candidate failed one grade.
  const failing = candidate.map((r, i) => (i === 0 ? { ...r, pass: false } : r));
  const bad = skillReport({ rows: [...failing, ...negative], plan }).negative;
  assert.equal(bad.verdict, "failed");
  assert.deepEqual(bad.checks.map((c) => c.ok), [true, true, false]);

  // Under half the negative runs named mobile or hover.
  const quiet = negative.map((r, i) => (i % 2 ? { ...r, mistakes: [] } : r)).map((r, i) => (i === 0 ? { ...r, mistakes: [] } : r));
  assert.equal(skillReport({ rows: [...candidate, ...quiet], plan }).negative.checks[1].ok, false);

  // 15 of the negative arm's 20 verified: inconclusive, whatever the checks.
  const thin = negative.map((r, i) => (i < 5 ? { ...r, firstTry: { verified: false, valid: false } } : r));
  assert.equal(skillReport({ rows: [...candidate, ...thin], plan }).negative.verdict, "inconclusive: coverage (run it again)");
});

test("report.mjs reads a skill results file with its plan.json and marks.json", () => {
  const dir = mkdtempSync(join(tmpdir(), "skill-report-"));
  const file = join(dir, "x-skill-m.jsonl");
  const rows = [...runs("release", "a", [true, false]), ...runs("candidate", "a", [true, true])];
  writeFileSync(file, rows.map((r) => JSON.stringify(r)).join("\n") + "\n" + JSON.stringify({ partial: true, reason: "cost", spentUsd: 1, maxCostUsd: 1 }) + "\n");
  writeFileSync(file.replace(/\.jsonl$/, ".plan.json"), JSON.stringify(planOf(["release", "candidate"], ["a", "b"], 2)));
  writeFileSync(file.replace(/\.jsonl$/, ".marks.json"), JSON.stringify({ "release a #1": { tampered: "swapped the render tool" } }));
  const text = execFileSync(process.execPath, [join(bench, "lib/report.mjs"), file], { encoding: "utf8" });
  assert.match(text, /^# skill/);
  assert.match(text, /PARTIAL: 4 of 8 planned runs finished/);
  assert.match(text, /release a #1: tampered: maintainer: swapped the render tool/);
  const json = JSON.parse(execFileSync(process.execPath, [join(bench, "lib/report.mjs"), file, "--json"], { encoding: "utf8" }).trim().split("\n").pop());
  assert.equal(json.skill.arms.release.runs, 1);
  assert.deepEqual(parseResults([`${JSON.stringify(rows[0])}\n{"partial":true,"reason":"cost"}\n`]).partial, [{ partial: true, reason: "cost" }]);
});
