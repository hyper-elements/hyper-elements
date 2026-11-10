// The skill suite's run setup, without a model call: kits, engines, docs sets, briefs and their groups, the run root,
// and each reference solution through the suite's own render and check.
//
//   node --test test/
//
// Needs `node lib/setup.mjs --as candidate`, `--docs-from v0.3.0 --as release` and `--docs-from 23e3b258 --as negative`.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, realpathSync } from "node:fs";
import { cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import { briefOf, briefsOf, jobsOf, kitOf, makeRun, runOf, runRootOf, suiteOf } from "../lib/make-run.mjs";
import { guideExample, preflight } from "../lib/preflight.mjs";
import { claudeArgs, disallowedOf, skillsOf } from "../lib/claude.mjs";

const bench = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = realpathSync(mkdtempSync(join(tmpdir(), "skill-setup-")));
test.after(() => rm(root, { recursive: true, force: true }));
const read = (...p) => readFileSync(join(...p), "utf8");
const node = (dir, ...args) => spawnSync(process.execPath, args, { cwd: dir, encoding: "utf8", timeout: 180_000 });

test("each kit gets its engine, its docs and its conventions", async () => {
  const guide = (dir) => read(dir, "docs/GUIDE.md");
  const engineSource = JSON.parse(read(bench, "engines/candidate/source.json"));

  const candidate = await makeRun("skill", "candidate", "event", 0, root);
  assert.match(read(candidate, "CLAUDE.md"), /src\/template\.tsx[\s\S]*\n@docs\/GUIDE\.md\n$/);
  assert.equal(guide(candidate), read(bench, "engines/candidate/@hyper-elements/react/GUIDE.md"));
  assert.equal(read(candidate, "node_modules/@hyper-elements/react/GUIDE.md"), guide(candidate), "the engine over the run's node_modules");
  assert.ok(Object.keys(engineSource.dist).every((f) => existsSync(join(candidate, "node_modules/@hyper-elements/react/dist", f))));
  assert.ok(!existsSync(join(candidate, ".claude")));

  const releaseDocs = await makeRun("skill", "release-docs", "event", 0, root);
  assert.equal(guide(releaseDocs), read(bench, "docs-sets/release/GUIDE.md"));
  assert.equal(read(releaseDocs, "node_modules/@hyper-elements/react/GUIDE.md"), guide(candidate), "the candidate's engine, the release's docs");
  assert.match(guide(releaseDocs), /mobile=\{\{/, "v0.3.0's guide teaches the mobile prop");

  const negative = await makeRun("skill", "negative", "event", 0, root);
  assert.equal(guide(negative), read(bench, "docs-sets/negative/GUIDE.md"));

  const skill = await makeRun("skill", "skill", "event", 0, root);
  assert.equal(read(skill, ".claude/skills/hyper-elements/SKILL.md"), read(bench, "engines/candidate/@hyper-elements/react/SKILL.md"));
  assert.match(read(skill, ".claude/skills/hyper-elements/SKILL.md"), /^---\nname: hyper-elements\n/);
  assert.ok(!existsSync(join(skill, "docs")));
  assert.doesNotMatch(read(skill, "CLAUDE.md"), /@docs/);

  const none = await makeRun("skill", "none", "event", 0, root);
  assert.ok(!existsSync(join(none, "docs")) && !existsSync(join(none, ".claude")));
  assert.doesNotMatch(read(none, "CLAUDE.md"), /GUIDE|@docs/);
  assert.equal(read(none, "CLAUDE.md"), read(skill, "CLAUDE.md"), "the same conventions, apart from the guide's import");
});

test("an email brief's images are copied into the run, and its checker reads them there", async () => {
  const dir = await makeRun("skill", "candidate", "event", 1, root);
  assert.ok(existsSync(join(dir, "images/event-hero.png")));
  assert.match(read(dir, "tools/email-check.mjs"), new RegExp(`\\?\\? ${JSON.stringify(join(dir, "images")).replace(/[/.]/g, "\\$&")};`));
  assert.ok(existsSync(join(dir, "tools/spec.json")), "the email check's spec, where the email checker reads it");
});

test("the Skill tool: allowed only with allowSkill; MultiEdit and NotebookEdit off in the skill suite", () => {
  assert.ok(disallowedOf({}).includes("Skill"));
  assert.ok(!disallowedOf({ allowSkill: true }).includes("Skill"));
  assert.deepEqual(disallowedOf({ skillSuite: true }).slice(-2), ["MultiEdit", "NotebookEdit"]);
  const args = claudeArgs({ prompt: "p", model: "m", settings: "{}", allowedTools: ["Bash(git:*)"], allowSkill: true, skillSuite: true });
  const allowed = args.slice(args.indexOf("--allowedTools") + 1, args.indexOf("--disallowedTools"));
  assert.ok(allowed.includes("Skill") && allowed.includes("Bash(git:*)") && allowed.includes("Read"), "a brief's tools add to the allowlist");
  assert.deepEqual(skillsOf([{ type: "system", subtype: "init", skills: ["hyper-elements", { name: "other" }] }]), ["hyper-elements", "other"]);
  assert.equal(skillsOf([]), null);
});

test("a brief's run replaces the suite's settings", async () => {
  const s = await suiteOf("skill");
  const k = await kitOf("skill", "candidate");
  const plain = runOf(s, k, await briefOf("skill", "event"));
  assert.deepEqual(plain.render, ["tools/render.mjs"]);
  assert.deepEqual(plain.sources, ["src/"]);
  const custom = runOf(s, k, { run: { render: ["tools/render.mjs", "--pdf"], allowedTools: ["Bash(git:*)"], kits: ["candidate"], specs: null } });
  assert.deepEqual(custom.render, ["tools/render.mjs", "--pdf"]);
  assert.deepEqual(custom.kits, ["candidate"]);
  assert.equal(custom.specs, null, "null replaces the suite's spec layout with one tools/spec.json");
  assert.equal(custom.prompt, s.prompt);
});

test("--briefs takes a group or a list, not all, in a suite with groups", async () => {
  const s = await suiteOf("skill");
  assert.deepEqual(await briefsOf("skill", "core"), s.groups.core);
  assert.deepEqual(await briefsOf("skill", "receipt"), ["receipt"]);
  await assert.rejects(briefsOf("skill", "all"), /not "all"/);
  await assert.rejects(briefsOf("skill", "nope"), /no brief nope/);
  assert.ok((await briefsOf("email", "all")).includes("event"), "a suite without groups still takes all");
});

test("jobs: the core group, less N/A tasks, and a brief only in its run.kits", async () => {
  const core = await briefsOf("skill", "core");
  assert.equal(core.length, 10);
  assert.equal(jobsOf(["candidate", "release"], core, 3).length, 60);
  const jobs = jobsOf(["candidate", "release"], core, 3, {}, { release: ["landing"] });
  assert.equal(jobs.length, 57, "the change check's 57 runs: (10 + 9) × 3");
  assert.ok(!jobs.some(([k, b]) => k === "release" && b === "landing"));
  assert.deepEqual(jobs.slice(0, 2), [["candidate", "event", 0], ["release", "event", 0]], "the kits interleaved");
  const only = jobsOf(["candidate", "release", "none"], ["migrate", "event"], 1, { migrate: ["candidate", "release"] });
  assert.deepEqual(only.filter(([, b]) => b === "migrate").map(([k]) => k), ["candidate", "release"]);
});

test("the guide's example is the tsx block under \"A whole template\"", () => {
  const guide = read(bench, "engines/candidate/@hyper-elements/react/GUIDE.md");
  assert.match(guideExample(guide), /^import \{[^}]*Email[^}]*\} from "@hyper-elements\/react";\n[\s\S]*export default function/);
  assert.throws(() => guideExample("# Nothing here"), /no "A whole template"/);
});

test("preflight: the release engine can't run the landing page (no breakpoints); both render the change task's start", async () => {
  const pre = await preflight({ kits: ["candidate", "release"], briefs: ["landing", "change"], root, baselines: join(root, "baselines") });
  assert.deepEqual(pre.problems, []);
  assert.deepEqual(pre.na, { candidate: [], release: ["landing"] });
  assert.ok(existsSync(pre.extraOf.change["tools/checks/change/baseline.json"]));
});

test("a run root under a denied path is refused", () => {
  const denied = ["/tmp", "/private/tmp", "/Users"];
  assert.throws(() => runRootOf("/tmp/bench", denied), /under \/tmp/);
  assert.throws(() => runRootOf("/private/tmp/x", denied), /under \/private\/tmp/);
  assert.equal(runRootOf("/opt/bench-runs", denied), "/opt/bench-runs");
  assert.equal(runRootOf("/tmpfoo", denied), "/tmpfoo", "a sibling with the same prefix isn't under it");
});

for (const brief of ["event", "receipt"]) {
  test(`${brief}: the reference solution renders, type-checks and passes its checks`, async () => {
    const dir = await makeRun("skill", "candidate", brief, `ref-${brief}`, root);
    await cp(join(bench, "suites/skill/reference", brief), dir, { recursive: true });
    const render = node(dir, "tools/render.mjs");
    assert.equal(render.status, 0, render.stdout + render.stderr);
    assert.match(render.stdout, /Rendered out\/email\.html/);
    assert.ok(existsSync(join(dir, "out/email.txt")));
    const tsc = spawnSync(join(dir, "node_modules/.bin/tsc"), ["--noEmit"], { cwd: dir, encoding: "utf8" });
    assert.equal(tsc.status, 0, tsc.stdout);
    const check = node(dir, "tools/check.mjs", "--json");
    const verdict = JSON.parse(check.stdout.trim().split("\n").pop());
    assert.ok(verdict.pass, JSON.stringify(verdict.results.filter((r) => !r.ok)));
    assert.ok(verdict.results.every((r) => r.name.startsWith("email: ")));
  });
}

test("a render with errors prints each as `severity code at path: message` and exits 1", async () => {
  const dir = await makeRun("skill", "candidate", "event", "broken", root);
  await cp(join(bench, "suites/skill/reference/event"), dir, { recursive: true });
  const src = join(dir, "src/template.tsx");
  const { writeFile } = await import("node:fs/promises");
  await writeFile(src, read(src).replace("<Heading level={1} style={{ fontSize: 28 }}>", "<Heading level={1} style={{ fontSize: 28, marginBottom: 8 }}>"));
  const render = node(dir, "tools/render.mjs");
  assert.equal(render.status, 1);
  assert.match(render.stderr, /^error style\/unknown at \S+marginBottom: /m);
  assert.ok(!existsSync(join(dir, "out/email.html")), "no output left from a failed render");
});
