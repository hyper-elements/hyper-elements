// `bench.mjs --resume` (lib/resume.mjs): the jobs a stopped batch has left, and the checks that the batch resumed is
// the same one.
import assert from "node:assert/strict";
import { test } from "node:test";
import { resumeOf, resumeProblems } from "../lib/resume.mjs";
import { parseResults } from "../lib/report-skill.mjs";

const jobs = [["candidate", "a", 0], ["release", "a", 0], ["candidate", "b", 0], ["release", "b", 0], ["candidate", "a", 1], ["release", "a", 1]];
const plan = { kits: ["candidate", "release"], briefs: ["a", "b"], reps: 2, na: { candidate: [], release: ["b"] }, jobs: jobs.filter(([k, b]) => !(k === "release" && b === "b")).map(([kit, brief, rep]) => ({ kit, brief, rep })) };
const engine = { candidate: { name: "candidate", fingerprint: "f1" }, release: { name: "release", version: "0.3.0" } };
const docs = { candidate: { given: "import" }, release: { given: "import", ref: "v0.3.0" } };
const row = (kit, brief, rep, extra = {}) => ({ suite: "skill", kit, brief, rep, costUsd: 1.5, claudeVersion: "2.1.238", engine: engine[kit], docs: docs[kit], ...extra });

test("a stopped batch's jobs left are the plan's without a row, in the plan's order; its stops come out of the results", () => {
  const lines = [row("release", "a", 0), row("candidate", "a", 0), row("candidate", "a", 1, { harnessError: "the job threw twice", costUsd: 0 })];
  const text = lines.map((l) => JSON.stringify(l)).join("\n") + "\n" + JSON.stringify({ partial: true, reason: "cost", spentUsd: 3, maxCostUsd: 2 }) + "\n";
  const r = resumeOf(plan, text);
  assert.deepEqual(r.left, [["candidate", "b", 0], ["release", "a", 1]], "a harness error counts as run; N/A jobs aren't planned");
  assert.equal(r.rows.length, 3);
  assert.equal(r.spentUsd, 3);
  assert.deepEqual(r.stops, [{ partial: true, reason: "cost", spentUsd: 3, maxCostUsd: 2 }]);
  // The rows are kept byte for byte, and the report no longer reads the batch as stopped.
  assert.equal(r.text, lines.map((l) => JSON.stringify(l) + "\n").join(""));
  assert.deepEqual(parseResults([r.text]).partial, []);
  // A batch that wrote nothing has every job left.
  assert.equal(resumeOf(plan, "").left.length, plan.jobs.length);
});

test("a resumed batch is refused when it isn't the batch the plan started", () => {
  const rows = [row("candidate", "a", 0), row("release", "a", 0)];
  const planned = jobs.filter(([k, b]) => !(k === "release" && b === "b"));
  const same = { plan, rows, jobs: planned, na: plan.na, claudeVersion: "2.1.238", kits: { candidate: { engine: engine.candidate, docs: docs.candidate }, release: { engine: engine.release, docs: docs.release } } };
  assert.deepEqual(resumeProblems(same), []);
  const problems = (over) => resumeProblems({ ...same, ...over });
  assert.match(problems({ claudeVersion: "2.1.240" }).join(), /Claude Code is 2\.1\.240; the batch's rows ran on 2\.1\.238/);
  assert.match(problems({ kits: { ...same.kits, candidate: { engine: { ...engine.candidate, fingerprint: "f2" }, docs: docs.candidate } } }).join(), /kit candidate: its engine differs/);
  assert.match(problems({ kits: { ...same.kits, release: { engine: engine.release, docs: { given: "skill" } } } }).join(), /kit release: its docs differs/);
  assert.match(problems({ na: { candidate: [], release: [] } }).join(), /N\/A tasks differ/);
  assert.match(problems({ jobs: planned.slice(1) }).join(), /job list differs/);
});
