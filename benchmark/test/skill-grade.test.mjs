// The skill suite's grading: the grading pass, tamper hashes and the static scan. No model call.
//
//   node --test test/skill-grade.test.mjs
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { cp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import { changedGuards, gradingPass, guardHashes, scanSources, unlock } from "../lib/grade.mjs";
import { makeRun } from "../lib/make-run.mjs";
import { settingsOf } from "../lib/claude.mjs";

const bench = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = realpathSync(mkdtempSync(join(tmpdir(), "skill-grade-")));
test.after(async () => { await unlock(root); await rm(root, { recursive: true, force: true }); });
const reference = (brief) => join(bench, "suites/skill/reference", brief);

/** A session's directory: the brief's run, with `src/template.tsx` as given (or the reference's). */
async function sessionDir(brief, rep, template) {
  const dir = await makeRun("skill", "candidate", brief, rep, join(root, "sessions"));
  await cp(reference(brief), dir, { recursive: true });
  if (template !== undefined) writeFileSync(join(dir, "src/template.tsx"), template);
  return dir;
}
const grade = (brief, from, env) => gradingPass({ kit: "candidate", brief, sourcesFrom: from, root: mkdtempSync(join(root, "grade-")), ...(env ? { env } : {}) });

test("the grading pass passes a reference, and records what its render found", async () => {
  const g = await grade("event", await sessionDir("event", "ok"));
  assert.equal(g.pass, true, JSON.stringify(g.failed ?? g.render));
  assert.deepEqual(g.sources, ["src/template.tsx"]);
  assert.ok(Array.isArray(g.diagnostics));
  assert.equal(g.warningsLeft, 0);
});

test("sources that don't render fail the grading pass, whatever the session's own out/ holds", async () => {
  const good = await sessionDir("event", "good");
  const bad = await sessionDir("event", "bad", readFileSync(join(reference("event"), "src/template.tsx"), "utf8").replace("<Heading level={1}", "<Heading level={1} marginBottom={8}"));
  // The session's out/ holds a passing email, rendered from the good sources.
  assert.equal(spawnSync(process.execPath, ["tools/render.mjs"], { cwd: good }).status, 0);
  await cp(join(good, "out"), join(bad, "out"), { recursive: true });
  assert.equal(spawnSync(process.execPath, ["tools/check.mjs"], { cwd: bad }).status, 0, "the session's own check passes");
  const g = await grade("event", bad);
  assert.equal(g.pass, false);
  assert.equal(g.rendered, false);
  assert.match(g.render.err, /^error prop\/unknown at \S+marginBottom/m);
});

test("the grading pass's checker isn't there while the render runs, and the render can't write outside out/ and .cache/", async () => {
  const probe = (body) => `import { existsSync, writeFileSync } from "node:fs";\n${body}\n` + readFileSync(join(reference("event"), "src/template.tsx"), "utf8");
  const absent = await grade("event", await sessionDir("event", "absent", probe('if (existsSync("tools/check.mjs") || existsSync("tools/spec.json")) throw new Error("the checker is there");')));
  assert.equal(absent.pass, true, JSON.stringify(absent.render));
  const swap = await grade("event", await sessionDir("event", "swap", probe('writeFileSync("tools/check.mjs", "console.log(JSON.stringify({ pass: true, results: [] }))");')));
  assert.equal(swap.rendered, false);
  assert.match(swap.render.err, /EACCES|EPERM|permission denied/i);
  const write = await grade("event", await sessionDir("event", "write", probe('writeFileSync("out/extra.txt", "x");')));
  assert.equal(write.pass, true, "out/ stays writable");
});

test("a checker that gives no result is a harness error, not the task's failure", async () => {
  const g = await grade("event", await sessionDir("event", "nobrowser"), { ...process.env, PLAYWRIGHT_BROWSERS_PATH: mkdtempSync(join(root, "none-")) });
  assert.equal(g.pass, false);
  assert.match(g.harnessError, /^the checker gave no result/);
});

test("tamper hashes: a changed render tool, spec, doc or engine file; not out/ or .cache/", async () => {
  const dir = await sessionDir("event", "tamper");
  const before = await guardHashes(dir);
  writeFileSync(join(dir, "out/email.html"), "<p>x</p>");
  await mkdir(join(dir, ".cache"), { recursive: true });
  writeFileSync(join(dir, ".cache/bundle.mjs"), "x");
  assert.deepEqual(changedGuards(before, await guardHashes(dir)), []);
  writeFileSync(join(dir, "tools/render.mjs"), readFileSync(join(dir, "tools/render.mjs"), "utf8") + "\n// changed\n");
  writeFileSync(join(dir, "tools/spec.json"), "{}");
  writeFileSync(join(dir, "node_modules/@hyper-elements/react/dist/new.js"), "x");
  assert.deepEqual(changedGuards(before, await guardHashes(dir)), ["node_modules/@hyper-elements/react/dist/new.js", "tools/render.mjs", "tools/spec.json"]);
});

test("the static scan marks what no template needs as tampered", () => {
  const scan = (text) => scanSources({ "src/template.tsx": text });
  assert.deepEqual(scan('import { writeFile } from "node:fs/promises";\nawait writeFile("out/email.html", "x");').tampered, ["src/template.tsx:2: writeFile()"]);
  assert.deepEqual(scan('import fs from "fs";\nfs.writeFileSync("x", "y");').tampered, ["src/template.tsx:2: fs.writeFileSync()"]);
  assert.deepEqual(scan('import * as fs from "node:fs";\nfs.promises.rm("x");').tampered, ["src/template.tsx:2: fs.promises.rm()"]);
  assert.deepEqual(scan('const fs = require("fs");\nfs.unlinkSync("x");').tampered, ["src/template.tsx:2: fs.unlinkSync()"]);
  assert.deepEqual(scan('import { execSync } from "node:child_process";').tampered, ['src/template.tsx:1: imports node:child_process']);
  assert.deepEqual(scan('const w = await import("worker_threads");').tampered, ["src/template.tsx:1: imports worker_threads"]);
  assert.deepEqual(scan("process.on('exit', () => {});\nprocess.exit(0);").tampered, ["src/template.tsx:1: process.on()", "src/template.tsx:2: process.exit()"]);
  assert.deepEqual(scan('const m = "child_" + "process";\nrequire(m);').tampered, ["src/template.tsx:2: an import of a computed module"]);
});

test("the static scan passes what templates do, and records what the replay doesn't pin", () => {
  const scan = (text) => scanSources({ "src/template.tsx": text });
  const copy = scan('import { Text } from "@hyper-elements/react";\nexport default () => <Text>rm -rf, writeFile and process.exit are only words here</Text>;');
  assert.deepEqual(copy, { tampered: [], readsUnpinned: [] });
  const canvas = scanSources({ "cards/render.tsx": readFileSync(join(bench, "suites/skill/reference/launch/cards/render.tsx"), "utf8") });
  assert.deepEqual(canvas.tampered, [], "a Canvas reads its fonts and images with fs");
  assert.ok(canvas.readsUnpinned.some((r) => /imports node:fs\/promises/.test(r)));
  const reads = scan("const a = performance.now();\nconst b = process.env.X;\nconst c = new Error().stack;\nconst d = URL.createObjectURL(new Blob([]));\nconst e = import.meta.url;\nconst f = crypto.randomUUID();\nconst g = { process: 1, performance: 2 };\nconst { process: p } = g;");
  assert.deepEqual(reads.tampered, []);
  assert.deepEqual(reads.readsUnpinned, [
    "src/template.tsx:1: performance", "src/template.tsx:2: process", "src/template.tsx:3: .stack",
    "src/template.tsx:4: URL.createObjectURL()", "src/template.tsx:5: import.meta", "src/template.tsx:6: crypto",
  ]);
});

test("the sandbox's settings: writes only in the run and never to its guarded files, the denied paths and /proc unreadable, no network, nothing outside it", () => {
  const run = "/runs/run-1/candidate__event__0";
  const s = JSON.parse(settingsOf(["/repo", "/Users", "/tmp", "/private/tmp"], { runDir: run, runRoot: "/runs", allowRead: ["/Users/me/node", "/runs/.browsers"], guarded: ["tools", "CLAUDE.md"] }, "linux"));
  assert.equal(s.sandbox.enabled, true);
  assert.equal(s.sandbox.allowUnsandboxedCommands, false);
  assert.equal(s.sandbox.failIfUnavailable, true);
  assert.equal(s.sandbox.excludedCommands, undefined, "an excluded command takes the whole chained command out of the sandbox");
  assert.deepEqual(s.sandbox.network.allowedDomains, []);
  assert.deepEqual(s.sandbox.filesystem.allowWrite, [run]);
  assert.deepEqual(s.sandbox.filesystem.denyWrite, [`${run}/tools`, `${run}/CLAUDE.md`]);
  assert.deepEqual(s.sandbox.filesystem.denyRead, ["/repo", "/Users", "/proc"], "not the run root (node reads its run's parent folders), not /tmp (Claude Code writes there)");
  assert.deepEqual(JSON.parse(settingsOf(["/repo"], { runDir: "/r", runRoot: "/" }, "darwin")).sandbox.filesystem.denyRead, ["/repo"], "no /proc on macOS");
  assert.deepEqual(s.sandbox.filesystem.allowRead, [run, "/Users/me/node", "/runs/.browsers"]);
  assert.ok(s.permissions.deny.includes("Read(//repo/**)"));
  assert.ok(s.permissions.deny.includes(`Edit(/${run}/tools/**)`), "the file tools can't change the checker either");
  assert.ok(!s.permissions.deny.some((r) => r.includes("//tmp")), "permission rules are merged into the sandbox's");
  const plain = JSON.parse(settingsOf(["/repo", "/tmp"]));
  assert.equal(plain.sandbox, undefined, "the email and image suites: as before");
  assert.ok(plain.permissions.deny.includes("Read(//tmp/**)"));
});
