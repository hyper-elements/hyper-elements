// The skill suite's replay (lib/replay.mjs), on sessions played without a model: each command really run in a run
// directory with the run's secret and pinned clock, recorded as Claude Code's transcript records it, then replayed at
// the same path.
//
//   node --test test/skill-replay.test.mjs
import { spawnSync } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, realpathSync } from "node:fs";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import { makeRun } from "../lib/make-run.mjs";
import { mistakeKey, parseCommand, replayFields, replayRun, tsErrorsOf } from "../lib/replay.mjs";
import { rereplayRow } from "../lib/rereplay.mjs";
import { sessionEnv } from "../lib/claude.mjs";
import { browsersPath } from "../lib/setup.mjs";

const bench = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = realpathSync(mkdtempSync(join(tmpdir(), "skill-replay-")));
test.after(() => rm(root, { recursive: true, force: true }));
const REFERENCE = readFileSync(join(bench, "suites/skill/reference/event/src/template.tsx"), "utf8");
const browsers = existsSync(browsersPath()) ? browsersPath() : process.env.PLAYWRIGHT_BROWSERS_PATH;
let reps = 0;

/** A template: the event reference, with `edit` applied (a [from, to] pair) and `head` code before it. */
const template = ({ edit, head = "" } = {}) => head + (edit ? REFERENCE.replace(edit[0], edit[1]) : REFERENCE);
const BOLD = ["A day of talks and workshops on building for every surface.", "A day of talks and workshops on <b>building</b> for every surface."];
const MOBILE = ['<Heading level={1} style={{ fontSize: 28 }}>', '<Heading level={1} style={{ fontSize: 28 }} mobile={{ fontSize: 20 }}>'];

/**
 * Plays a session: each action is { write, content }, { edit, old, new, all }, { read }, { bash, output? } (output: what
 * the session's tool printed instead of what it prints, as a swapped tool would), or { tool, input } (any other tool).
 * Returns the replay's result.
 */
async function play(actions, { brief = "event" } = {}) {
  const rep = `r${reps++}`;
  const runRoot = join(root, rep);
  const dir = await makeRun("skill", "candidate", brief, rep, runRoot, { isolated: true });
  const secret = randomBytes(32).toString("hex");
  const clock = String(Date.parse("2026-01-01T00:00:00Z"));
  await mkdir(join(dir, ".tmp"), { recursive: true });
  const env = { ...sessionEnv(process.env, { browsers, tmp: join(dir, ".tmp") }), BENCH_SECRET: secret, BENCH_CLOCK: clock };
  const events = [];
  let id = 0;
  // The shell's folder, kept from call to call as Claude Code keeps it.
  let cwd = dir;
  const cwdFile = join(dir, ".tmp", "cwd");
  const record = (name, input, content, isError = false) => {
    const tool_use_id = `t${id++}`;
    events.push({ type: "assistant", message: { content: [{ type: "tool_use", id: tool_use_id, name, input }] } });
    events.push({ type: "user", message: { content: [{ type: "tool_result", tool_use_id, content, ...(isError ? { is_error: true } : {}) }] } });
  };
  for (const a of actions) {
    if (a.write) {
      await mkdir(dirname(join(dir, a.write)), { recursive: true });
      await writeFile(join(dir, a.write), a.content);
      record("Write", { file_path: join(dir, a.write), content: a.content }, "File created successfully");
    } else if (a.edit) {
      const text = existsSync(join(dir, a.edit)) ? await readFile(join(dir, a.edit), "utf8") : "";
      if (!text.includes(a.old)) { record("Edit", { file_path: join(dir, a.edit), old_string: a.old, new_string: a.new }, "String to replace not found in file.", true); continue; }
      await writeFile(join(dir, a.edit), a.all ? text.split(a.old).join(a.new) : text.replace(a.old, () => a.new));
      record("Edit", { file_path: join(dir, a.edit), old_string: a.old, new_string: a.new, replace_all: !!a.all }, "The file has been updated successfully.");
    } else if (a.read) {
      const text = await readFile(join(dir, a.read), "utf8");
      record("Read", { file_path: join(dir, a.read) }, text.split("\n").map((l, i) => `${i + 1}\t${a.lie && i === 0 ? "// not this" : l}`).join("\n"));
    } else if (a.refused) {
      // A command Claude Code refused to run: an error with its message and no exit code. `ran: true` runs it anyway
      // (a session whose record says refused though the command ran).
      if (a.ran) spawnSync("bash", ["-c", a.refused], { cwd: dir, env, encoding: "utf8" });
      record("Bash", { command: a.refused }, "Contains brace with quote character (expansion obfuscation)", true);
    } else if (a.bash) {
      const command = typeof a.bash === "function" ? a.bash(dir) : a.bash;
      const r = spawnSync("bash", ["-c", 'eval "$1"; s=$?; pwd > "$2"; exit $s', "_", command, cwdFile], { cwd, env, encoding: "utf8", timeout: 240_000 });
      cwd = readFileSync(cwdFile, "utf8").trim();
      const out = a.output ? a.output(`${r.stdout}${r.stderr}`, { secret, dir }) : `${r.stdout}${r.stderr}`;
      const code = a.code ?? r.status;
      record("Bash", { command, ...(a.background ? { run_in_background: true } : {}) }, `${code ? `Exit code ${code}\n` : ""}${out}`, code !== 0);
    } else record(a.tool, a.input, a.result ?? "ok");
    if (a.then) await a.then(dir);
  }
  const result = await replayRun({ kit: "candidate", brief, rep, root: runRoot, dir, events, env });
  return Object.assign(result, { session: { rep, dir, runRoot, secret, clock, events } });
}

const sign = (secret, body) => `${body} mac=${createHmac("sha256", secret).update(body).digest("hex")}`;
const RENDER = "node tools/render.mjs", TSC = "npx tsc --noEmit", CHECK = "node tools/check.mjs";
const src = "src/template.tsx";

test("the command parser: steps, operators, and what it refuses", () => {
  assert.deepEqual(parseCommand("npx tsc --noEmit && node tools/render.mjs 2>&1").steps.map((s) => [s.op, s.words.join(" ")]), [[null, "npx tsc --noEmit"], ["&&", "node tools/render.mjs"]]);
  for (const c of ["echo $HOME", "(cd src && ls)", "cat <<EOF", "node tools/render.mjs &", "ls ~", "echo x > src/template.tsx", "cat >> src/template.tsx <<'EOF'\nx\nEOF", "cat > a <<EOF\n$HOME\nEOF", 'grep "$x" BRIEF.md', "ls |"]) assert.ok(parseCommand(c).error, c);
  // A pipeline is a step's stages; `2>&1` anywhere; a backslash in double quotes is itself unless it escapes $ ` " \\.
  assert.deepEqual(parseCommand('ls src 2>&1; cat src/template.tsx 2>&1 | head -50').steps.map((s) => [s.words.join(" "), (s.pipe ?? []).map((w) => w.join(" "))]), [["ls src", []], ["cat src/template.tsx", ["head -50"]]]);
  assert.deepEqual(parseCommand('grep -n "a\\|b \\"c\\"" docs/REFERENCE.md').steps[0].words, ["grep", "-n", 'a\\|b "c"', "docs/REFERENCE.md"]);
  // A heredoc's later lines are more steps, as if joined by ;. A heredoc with no end is refused.
  assert.deepEqual(parseCommand("cat > src/a.tsx <<'EOF'\nx\nEOF\nnode tools/render.mjs && npx tsc --noEmit\nls").steps.map((s) => [s.op, s.words.join(" ")]), [[null, "cat > src/a.tsx"], [";", "node tools/render.mjs"], ["&&", "npx tsc --noEmit"], [";", "ls"]]);
  assert.ok(parseCommand("cat > src/a.tsx <<'EOF'\nx\nEO").error);
  // `2>&1 |` marks a pipe both streams go through.
  assert.deepEqual(parseCommand("node tools/render.mjs 2>&1 | tail -5").steps[0].merged, [true]);
  assert.deepEqual(parseCommand("node tools/render.mjs | tail -5").steps[0].merged, [false]);
  // A quoted heredoc feeds `cat > <file>`: the file's text, with its last line break.
  const doc = parseCommand("mkdir -p src && cat > src/template.tsx <<'EOF'\nconst a = `${b}`;\nEOF");
  assert.deepEqual(doc.steps.map((s) => s.words), [["mkdir", "-p", "src"], ["cat", ">", "src/template.tsx"]]);
  assert.equal(doc.steps[1].heredoc, "const a = `${b}`;\n");
});

test("TypeScript's errors: the property from a continuation line", () => {
  const out = `src/template.tsx(12,7): error TS2322: Type '{ children: string; level: 1; mobile: { fontSize: number; }; }' is not assignable to type 'IntrinsicAttributes & HeadingProps'.\n  Property 'mobile' does not exist on type 'IntrinsicAttributes & HeadingProps'.\nsrc/x.tsx(1,1): error TS2307: Cannot find module 'y'.`;
  assert.deepEqual(tsErrorsOf(out).map((e) => mistakeKey({ ...e, code: e.code })), ["ts/TS2322 mobile", "ts/TS2307"]);
  // TS2353 and TS2561 (one with a "did you mean"), as Haiku's runs printed them.
  const literal = `src/template.tsx(10,71): error TS2353: Object literal may only specify known properties, and 'margin' does not exist in type 'TextStyle'.\nsrc/template.tsx(9,20): error TS2561: Object literal may only specify known properties, but 'borderTop' does not exist in type 'SectionStyle'. Did you mean to write 'border'?`;
  assert.deepEqual(tsErrorsOf(literal).map(mistakeKey), ["ts/TS2353 margin", "ts/TS2561 borderTop"]);
});

test("a render that fails with prop/unknown at …mobile, then passes: not a valid first try, one fix round, the mistake", async () => {
  const r = await play([{ write: src, content: template({ edit: MOBILE }) }, { bash: RENDER }, { edit: src, old: " mobile={{ fontSize: 20 }}", new: "" }, { bash: RENDER }]);
  assert.equal(r.cutoff, null, JSON.stringify(r.cutoff));
  assert.deepEqual(r.firstTry, { verified: true, valid: false });
  assert.deepEqual(r.fixRounds, { verified: true, rounds: 1, neverValid: false });
  assert.deepEqual(r.mistakes.map((m) => m.key), ["prop/unknown mobile"]);
  assert.equal(r.sourcesMatch, true);
});

test("TS2322 on a mobile prop gives ts/TS2322 mobile; a clean tsc then a failing render isn't a valid first try", async () => {
  const ts = await play([{ write: src, content: template({ edit: MOBILE }) }, { bash: TSC }]);
  assert.deepEqual(ts.mistakes.map((m) => m.key), ["ts/TS2322 mobile"]);
  assert.equal(ts.firstTry.valid, null, "no render attempt");
  assert.equal(ts.firstTry.verified, true);
  const r = await play([{ write: src, content: template({ edit: BOLD }) }, { bash: TSC }, { bash: RENDER }]);
  assert.deepEqual(r.firstTry, { verified: true, valid: false });
  assert.deepEqual(r.mistakes.map((m) => m.key), ["jsx/markup"]);
});

test('"tsc passes, render fails with jsx/markup, fixed, render passes" is one fix round; tsc and render in one command are one attempt', async () => {
  const r = await play([{ write: src, content: template({ edit: BOLD }) }, { bash: TSC }, { bash: RENDER }, { edit: src, old: BOLD[1], new: BOLD[0] }, { bash: `${TSC} && ${RENDER}` }]);
  assert.equal(r.cutoff, null, JSON.stringify(r.cutoff));
  assert.equal(r.attempts.length, 3);
  assert.deepEqual(r.fixRounds, { verified: true, rounds: 1, neverValid: false });
});

test("a render that fails on a syntax error, with no diagnostic, is the mistake build/syntax", async () => {
  // As a Sonnet run did: an edit that lost the space in `<Row stackOnMobile`.
  const r = await play([{ write: src, content: template().replace("<Heading level={1}", "<Headinglevel={1}") }, { bash: RENDER }]);
  assert.equal(r.cutoff, null, JSON.stringify(r.cutoff));
  assert.deepEqual(r.firstTry, { verified: true, valid: false });
  assert.deepEqual(r.mistakes.map((m) => m.key), ["build/syntax"]);
  assert.match(r.mistakes[0].text, /^src\/template\.tsx:\d+ /);
});

test("Write and Edit rebuild the final sources byte for byte, with replace_all, skipping an Edit that failed", async () => {
  const r = await play([
    { write: src, content: template() },
    { write: "src/data.ts", content: "export const a = 1;\nexport const b = 1;\n" },
    { edit: "src/data.ts", old: "= 1", new: "= 2", all: true },
    { edit: src, old: "not in the file", new: "x" },
    { bash: RENDER },
  ]);
  assert.equal(r.cutoff, null, JSON.stringify(r.cutoff));
  assert.equal(r.sourcesMatch, true);
});

test("pinned inputs: a template branching on the clock, Intl's clock or Math.random renders the same in the replay", async () => {
  const head = `const late = Date.now() > ${Date.parse("2026-01-01T00:00:00Z") + 1000};\nconst day = new Intl.DateTimeFormat("en-US", { timeZone: "UTC" }).format();\nconst roll = Math.random();\n`;
  const content = template({ head, edit: ["Orbit Summit 2026</Heading>", "Orbit Summit 2026 {day} {String(roll)}{late ? <b>late</b> : null}</Heading>"] });
  const r = await play([{ write: src, content }, { bash: RENDER, then: () => new Promise((ok) => setTimeout(ok, 1200)) }]);
  assert.equal(r.cutoff, null, JSON.stringify(r.cutoff));
  assert.deepEqual(r.firstTry, { verified: true, valid: true }, "the pinned clock is before the deadline in both");
});

test("a path in the output (an Error's stack) is the same in the session and the replay", async () => {
  const content = template({ edit: ["Orbit Summit 2026</Heading>", "Orbit Summit 2026 {String(new Error().stack).split(\"\\n\")[1]}</Heading>"] });
  const r = await play([{ write: src, content }, { bash: RENDER }]);
  assert.equal(r.cutoff, null, JSON.stringify(r.cutoff));
});

test("what the replay can't reproduce is a mismatch and the cutoff, never tampered: performance.timeOrigin, a blob URL", async () => {
  for (const expr of ["String(performance.timeOrigin)", 'URL.createObjectURL(new Blob(["x"]))']) {
    const content = template({ edit: ["Orbit Summit 2026</Heading>", `Orbit Summit 2026 {${expr}}</Heading>`] });
    const r = await play([{ write: src, content }, { bash: RENDER }]);
    assert.equal(r.cutoff?.mismatch, true, `${expr}: ${JSON.stringify(r.cutoff)}`);
    assert.equal(r.cutoff.call, 1);
    assert.equal(r.firstTry.verified, false);
    assert.equal(r.tampered, undefined);
  }
});

test("masking: `render ; tsc` where the session's render said failed and the replay's says ok is a mismatch, never a clean first try", async () => {
  const swapped = (out, { secret }) => out.replace(/^\[render\] ok [0-9a-f]{64} (in=[0-9a-f]{64}) mac=[0-9a-f]{64}$/m, (_, i) => sign(secret, `[render] failed ${i}`));
  const r = await play([{ write: src, content: template() }, { bash: `${RENDER} ; ${TSC}`, output: swapped }]);
  assert.equal(r.cutoff?.mismatch, true, JSON.stringify(r.cutoff));
  assert.equal(r.firstTry.verified, false);
  // A different output hash, with nothing unpinned read: also a mismatch, for a maintainer.
  const other = (out, { secret }) => out.replace(/^\[render\] ok [0-9a-f]{64} (in=[0-9a-f]{64}) mac=[0-9a-f]{64}$/m, (_, i) => sign(secret, `[render] ok ${"0".repeat(64)} ${i}`));
  const r2 = await play([{ write: src, content: template() }, { bash: RENDER, output: other }]);
  assert.equal(r2.cutoff?.mismatch, true);
});

test("forged result lines: a wrong HMAC, more lines than steps, a copied line printed by cat", async () => {
  const bad = (out) => out.replace(/mac=[0-9a-f]{64}$/m, `mac=${"f".repeat(64)}`);
  assert.match((await play([{ write: src, content: template() }, { bash: RENDER, output: bad }])).cutoff.reason, /isn't the harness's/);
  const twice = (out) => `${out}\n${out.split("\n").find((l) => l.startsWith("[render]"))}`;
  assert.match((await play([{ write: src, content: template() }, { bash: RENDER, output: twice }])).cutoff.reason, /more result lines/);
  // A good line saved in a source, then printed by cat when the render fails: the call isn't determined.
  let line = "";
  const r = await play([
    { write: src, content: template() },
    { bash: RENDER, output: (out) => ((line = out.split("\n").find((l) => l.startsWith("[render]"))), out) },
    { write: "src/notes.txt", content: "later" },
    { edit: src, old: BOLD[0], new: BOLD[1], then: (dir) => writeFile(join(dir, "src/notes.txt"), line) },
    { bash: `${RENDER} || cat src/notes.txt` },
  ]);
  assert.equal(r.cutoff?.call, 4, JSON.stringify(r.cutoff));
});

test("the secret: a template that prints process.env doesn't print it; a Read of /proc/self/environ is the cutoff", async () => {
  let printed = "";
  const content = template({ head: "console.log(JSON.stringify(process.env));\n" });
  const r = await play([{ write: src, content }, { bash: RENDER, output: (out, { secret }) => ((printed = out.includes(secret) ? "yes" : "no"), out) }]);
  assert.equal(printed, "no");
  assert.equal(r.cutoff, null, JSON.stringify(r.cutoff));
  const p = await play([{ write: src, content: template() }, { tool: "Read", input: { file_path: "/proc/self/environ" } }]);
  assert.match(p.cutoff.reason, /outside the run/);
});

test("compound commands recompute only the steps that ran, and match the session", async () => {
  const tscFails = await play([{ write: src, content: template({ edit: MOBILE }) }, { bash: `${TSC} && ${RENDER}` }]);
  assert.equal(tscFails.cutoff, null);
  assert.deepEqual(tscFails.verified.at(-1).steps.map((s) => s.kind), ["tsc"]);
  const renderFails = await play([{ write: src, content: template({ edit: BOLD }) }, { bash: `${TSC} && ${RENDER}` }]);
  assert.deepEqual(renderFails.verified.at(-1).steps.map((s) => [s.kind, s.code]), [["tsc", 0], ["render", 1]]);
  const checkFails = await play([{ write: src, content: template({ edit: ["Orbit Summit 2026</Heading>", "Orbit Summit</Heading>"] }) }, { bash: `${TSC} && ${RENDER} && ${CHECK}` }]);
  assert.equal(checkFails.cutoff, null, JSON.stringify(checkFails.cutoff));
  assert.deepEqual(checkFails.verified.at(-1).steps.map((s) => [s.kind, s.code]), [["tsc", 0], ["render", 0], ["check", 1]]);
  const split = await play([{ write: src, content: template() }, { bash: RENDER }, { bash: `${CHECK} && ${TSC}` }]);
  assert.equal(split.cutoff, null, "call 2's check runs on call 1's replayed output");
  const orTsc = await play([{ write: src, content: template({ edit: BOLD }) }, { bash: `${TSC} || ${RENDER}` }, { bash: RENDER }]);
  assert.equal(orTsc.cutoff, null);
  assert.deepEqual(orTsc.verified[1].steps.map((s) => s.kind), ["tsc"], "the render was skipped");
  assert.deepEqual(orTsc.firstTry, { verified: true, valid: false }, "decided by the next call in which a render ran");
});

test("read steps run in the replay, whose files are the session's: their status decides what runs, as in the session", async () => {
  const failing = await play([{ write: src, content: template({ edit: BOLD }) }, { bash: `${RENDER} && cat out/typo.html` }]);
  assert.equal(failing.cutoff, null, "the render fails, so the cat never runs");
  // The report task's check of its plain text, after the tools: the cat's status is the call's.
  for (const cmd of [`${RENDER} && cat out/typo.html`, `${RENDER} ; cat out/email.html`, `${RENDER} && ${TSC} && ${CHECK}; cat out/email.txt`, `cat missing.txt || ${RENDER}`]) {
    const r = await play([{ write: src, content: template() }, { bash: cmd }]);
    assert.equal(r.cutoff, null, `${cmd}: ${JSON.stringify(r.cutoff)}`);
    assert.deepEqual(r.firstTry, { verified: true, valid: true }, cmd);
  }
  // A read that succeeds skips the render after ||: no attempt.
  const skipped = await play([{ write: src, content: template() }, { bash: `cat src/template.tsx || ${RENDER}` }]);
  assert.equal(skipped.cutoff, null);
  assert.equal(skipped.attempts.length, 0);
  // A read whose status in the session isn't the replay's: the call's status differs, a mismatch.
  const differs = await play([{ write: src, content: template() }, { bash: `${RENDER} ; cat out/email.html`, code: 1 }]);
  assert.match(differs.cutoff?.reason ?? "", /the call's status differs/);
  assert.equal(differs.cutoff?.mismatch, true);
  // Only read steps: nothing runs and nothing changes, whatever they print or exit with.
  const looks = await play([
    { bash: "ls -la" }, { bash: "cat missing.txt" }, { bash: "ls src out && cat BRIEF.md" },
    { bash: 'ls -la cards/ 2>/dev/null || echo "no cards/"' }, { bash: 'ls fonts && echo "---" && ls tools' },
    { bash: "wc -l BRIEF.md tools/*" }, { bash: "head -n 5 BRIEF.md && tail -3 BRIEF.md" },
    { write: src, content: template() }, { bash: `${RENDER} && echo done` },
  ]);
  assert.equal(looks.cutoff, null, JSON.stringify(looks.cutoff));
  assert.deepEqual(looks.firstTry, { verified: true, valid: true });
  // echo printing a copied result line: one more line than the call's tool steps.
  let line = "";
  const copied = await play([
    { write: src, content: template() },
    { bash: RENDER, output: (out) => ((line = out.split("\n").find((l) => l.startsWith("[render]"))), out) },
    { bash: "echo copied", output: () => line },
  ]);
  assert.match(copied.cutoff?.reason ?? "", /more result lines/);
});

test("mkdir -p in the run is replayed (the folder made there too); outside the run, or without -p, it's the cutoff", async () => {
  // As agents do: the folder made, then the template written into it.
  const made = await play([
    { bash: "mkdir -p cards" }, { bash: "ls cards" },
    { write: src, content: template() }, { bash: `${RENDER} && ${CHECK}` },
  ]);
  assert.equal(made.cutoff, null, JSON.stringify(made.cutoff));
  assert.deepEqual(made.firstTry, { verified: true, valid: true });
  const abs = await play([{ bash: "mkdir -p \"$PWD/src\"" }]);
  assert.match(abs.cutoff?.reason ?? "", /a command with/, "an expansion is still refused");
  // In a call with a tool, the folder is made before the tool runs, as in the session.
  const chained = await play([{ write: src, content: template() }, { bash: `mkdir -p cards && ${RENDER}` }]);
  assert.equal(chained.cutoff, null, JSON.stringify(chained.cutoff));
  assert.match((await play([{ bash: "mkdir -p ../elsewhere" }])).cutoff?.reason ?? "", /isn't replayable: mkdir/);
  assert.match((await play([{ bash: "mkdir cards" }])).cutoff?.reason ?? "", /isn't replayable: mkdir/, "only -p, which can't fail on an existing folder");
});

test("a first look as Sonnet takes it: ls, cat, grep and sed -n through head, before any write, is verified", async () => {
  const look = await play([
    { bash: "ls src docs tools out 2>&1; cat src/template.tsx 2>&1 | head -50" },
    { bash: "ls -R . -I node_modules | head -50" },
    { bash: 'ls src docs tools; cat BRIEF.md; grep -n -i "hover\\|mobile\\|640" docs/REFERENCE.md | head -50' },
    { bash: 'grep -n -i -B2 -A10 "hover" docs/GUIDE.md | head -150' },
    { bash: "ls tools/checks; cat tools/checks/*/spec.json; sed -n 1,60p docs/REFERENCE.md" },
    { write: src, content: template() }, { bash: `${RENDER} && ${TSC} && ${CHECK}` },
  ]);
  assert.equal(look.cutoff, null, JSON.stringify(look.cutoff));
  assert.deepEqual(look.firstTry, { verified: true, valid: true });
  // A pipeline with a tool in it can hide the tool's status: the cutoff.
  assert.match((await play([{ write: src, content: template() }, { bash: `${RENDER} 2>&1 | head -5` }])).cutoff?.reason ?? "", /isn't replayable: node tools\/render\.mjs \| head -5/);
  // A grep outside the run, or a pipeline into something that isn't a read.
  assert.equal((await play([{ bash: "grep -r mobile ../ | head" }])).cutoff?.call, 0);
  assert.equal((await play([{ bash: "cat BRIEF.md | tee copy.md" }])).cutoff?.call, 0);
});

test("a heredoc written with cat and a sed -i of substitutions are made in the replay, in order with the tools", async () => {
  const body = template();
  const sedEdit = process.platform === "darwin" ? "sed -i ''" : "sed -i";
  const done = await play([
    { bash: `mkdir -p src && cat > ${src} <<'EOF'\n${body.replace(/\n$/, "")}\nEOF` },
    { bash: `${RENDER} && ${CHECK}` },
    { bash: `${sedEdit} -e 's/A day of talks/A day of <b>talks<\\/b>/' ${src} && ${RENDER}` },
    { bash: `${sedEdit} 's/<b>talks<\\/b>/talks/g' ${src} && ${RENDER} && ${CHECK}` },
  ]);
  assert.equal(done.cutoff, null, JSON.stringify(done.cutoff));
  assert.equal(done.sourcesMatch, true, "the replay's sources are the session's");
  assert.deepEqual(done.firstTry, { verified: true, valid: true });
  assert.deepEqual(done.attempts.map((a) => a.error), [false, true, false]);
  assert.deepEqual(done.mistakes.map((m) => m.key), ["jsx/markup"]);
  // What isn't replayed: sed -i of a file that isn't a source, a flag that writes, and a heredoc into out/. (BSD
  // sed's misread -i form is replayed as a failure: see below.)
  for (const bash of [`${sedEdit} 's/a/b/' BRIEF.md`, `${sedEdit} 's/a/b/w copy' ${src}`, "cat > out/email.html <<'EOF'\n<p>x</p>\nEOF"]) {
    assert.equal((await play([{ write: src, content: body }, { bash }])).cutoff?.call, 1, bash);
  }
});

test("as Sonnet writes and checks: a heredoc then commands on the next line; each tool piped with 2>&1 into tail", async () => {
  const body = template({ edit: MOBILE }).replace(/\n$/, "");
  const run = await play([
    { bash: `mkdir -p src && cat > ${src} <<'EOF'\n${body}\nEOF\n${RENDER} 2>&1 | tail -5; ${TSC} 2>&1 | tail; ${CHECK} 2>&1 | tail -40` },
    { edit: src, old: MOBILE[1], new: MOBILE[0] },
    { bash: `${RENDER} 2>&1 | tail -n 20 && ${TSC} 2>&1 | tail -20 && ${CHECK} 2>&1 | tail -40` },
  ]);
  assert.equal(run.cutoff, null, JSON.stringify(run.cutoff));
  assert.equal(run.sourcesMatch, true);
  // The first call's render failed (tail's status hid it from `;`), so it's an attempt with an error, from the tool's
  // own exit code; its mistakes come from the whole output, not the tail.
  assert.deepEqual(run.attempts.map((a) => a.error), [true, false]);
  assert.deepEqual(run.firstTry, { verified: true, valid: false });
  assert.ok(run.mistakes.some((m) => m.key === "ts/TS2322 mobile"), JSON.stringify(run.mistakes));
  // tail hiding a step's result line (the check's line comes before its JSON): nothing to compare it by.
  const hidden = await play([{ write: src, content: template() }, { bash: `${RENDER} && ${CHECK} --json 2>&1 | tail -1` }]);
  assert.match(hidden.cutoff?.reason ?? "", /a pipeline that hides a result line/);
  // Into head (which can stop the tool), or without 2>&1 (stderr skips the tail): the cutoff.
  for (const bash of [`${RENDER} 2>&1 | head -5`, `${RENDER} | tail -5`, `${RENDER} 2>&1 | tail -5 | grep ok`]) {
    assert.equal((await play([{ write: src, content: template() }, { bash }])).cutoff?.call, 1, bash);
  }
  // A forged line still can't pass through a tail.
  const forged = await play([
    { write: src, content: template({ edit: BOLD }) },
    { bash: `${RENDER} 2>&1 | tail -5`, output: (out, { secret }) => out.replace(/\[render\] failed .*/, () => sign(secret, `[render] ok ${"0".repeat(64)} in=${"0".repeat(64)}`)) },
  ]);
  assert.ok(forged.cutoff, "a line the replay didn't print");
});

test("a command Claude Code refused to run changed nothing; one recorded as refused that did run is caught", async () => {
  const broken = template({ edit: BOLD }).replace(/\n$/, "");
  const refused = await play([
    { write: src, content: template() },
    { refused: `cat > ${src} <<'EOF'\n${broken}\nEOF\n${RENDER} && ${CHECK}` },
    { bash: `${RENDER} && ${CHECK}` },
  ]);
  assert.equal(refused.cutoff, null, JSON.stringify(refused.cutoff));
  assert.equal(refused.sourcesMatch, true);
  assert.deepEqual(refused.firstTry, { verified: true, valid: true }, "the refused call isn't an attempt");
  const ran = await play([
    { write: src, content: template() },
    { refused: `cat > ${src} <<'EOF'\n${broken}\nEOF`, ran: true },
    { bash: RENDER },
  ]);
  assert.match(ran.cutoff?.reason ?? "", /inputs differ/);
});

test("tsc piped into head; BSD sed's misread -i form fails and changes nothing", async () => {
  const r = await play([
    { write: src, content: template({ edit: MOBILE }) },
    { bash: `${TSC} 2>&1 | head -3; ${RENDER} 2>&1 | tail -20` },
  ]);
  assert.equal(r.cutoff, null, JSON.stringify(r.cutoff));
  assert.deepEqual(r.attempts.map((a) => a.error), [true]);
  assert.ok(r.mistakes.some((m) => m.key === "ts/TS2322 mobile"), "from tsc's whole output, not head's");
  assert.equal((await play([{ write: src, content: template() }, { bash: `${RENDER} 2>&1 | head -3` }])).cutoff?.call, 1, "head after a tool that writes files");
  if (process.platform === "darwin") {
    const bsd = await play([
      { write: src, content: template() },
      { bash: `sed -i 's/A day of talks/A day/' ${src} && ${RENDER}; ${RENDER}` },
    ]);
    assert.equal(bsd.cutoff, null, JSON.stringify(bsd.cutoff));
    assert.equal(bsd.sourcesMatch, true);
    assert.equal(bsd.attempts.length, 1, "the && skipped the first render");
  }
});

test("how Haiku looks around: file, find, cut, a literal $, echo of $?, >/dev/null, a trailing ;, P=<path>, and cd kept from call to call", async () => {
  const r = await play([
    // Claude Code's own folder, made in the session only: the replay makes it too, so `ls .claude` succeeds there.
    { write: src, content: template(), then: (d) => mkdir(join(d, ".claude/.cc-writes"), { recursive: true }) },
    { bash: "ls out .claude .tmp" },
    { bash: "file images/event-hero.png; find images tools -maxdepth 1 -type f | head -5; ls node_modules/@hyper-elements/react >/dev/null && echo \"engine ok\";" },
    // A `$` before `\|` or a closing quote is itself; the folder is docs after this call.
    { bash: 'cd docs && grep -n -i "^### Table$\\|^### Row$" REFERENCE.md | head -5; grep -rn "Section" . --include=*.md | cut -c1-40 | head -3' },
    // From docs: `cd docs` fails (there's no docs/docs), the reads after `;` run in docs.
    { bash: "cd docs && ls; sed -n 1,3p REFERENCE.md | cut -c1-40" },
    { bash: (d) => `P=${d}; ls $P/src; cd $P && ${RENDER}; echo "render exit $?"; ${TSC}; echo "tsc exit $?"` },
  ]);
  assert.equal(r.cutoff, null, JSON.stringify(r.cutoff));
  assert.deepEqual(r.firstTry, { verified: true, valid: true });
  assert.equal(r.attempts.length, 1);
  // A tool run from a folder other than the run: the cutoff.
  const sub = await play([{ write: src, content: template() }, { bash: "cd src" }, { bash: RENDER }]);
  assert.equal(sub.cutoff?.call, 2);
  assert.match(sub.cutoff.reason, /a tool run from src/);
  // A step that isn't replayable after a && that skipped it: not the cutoff, since it never ran.
  const skipped = await play([{ write: src, content: template() }, { bash: `cat missing.txt && node -e "1" ; ${RENDER}` }]);
  assert.equal(skipped.cutoff, null, JSON.stringify(skipped.cutoff));
  assert.deepEqual(skipped.firstTry, { verified: true, valid: true });
  // `$P` in single quotes isn't expanded: no assignment is taken, and `P=src` is a step that isn't replayable.
  assert.deepEqual(parseCommand("P=src; ls '$P'").steps?.map((s) => s.words), [["P=src"], ["ls", "$P"]]);
  assert.deepEqual(parseCommand("P=src; ls $P/x ${P}").steps?.map((s) => s.words), [["ls", "src/x", "src"]]);
});

test("mkdir -p in a guarded folder fails as the sandbox fails it; one that exists succeeds", async () => {
  // Haiku's release invoice #1: still in docs from an earlier cd, `mkdir -p src` failed (the sandbox denies writes to
  // docs). This session runs unsandboxed, so it's recorded as the sandbox reported it.
  const r = await play([
    { bash: "cd docs && ls" },
    { bash: "mkdir -p src && ls src", code: 1, output: () => "mkdir: src: Operation not permitted\n" },
    { bash: "mkdir -p ../docs && ls" },
    { bash: (d) => `cd ${d} && mkdir -p src` },
    { write: src, content: template() },
    { bash: RENDER },
  ]);
  assert.equal(r.cutoff, null, JSON.stringify(r.cutoff));
  assert.deepEqual(r.firstTry, { verified: true, valid: true });
});

test("a kept run replays again offline with its row's secret: the same figures, and the session's path free again", async () => {
  const played = await play([
    { bash: "ls src 2>&1; cat BRIEF.md | head -5" }, { write: src, content: template({ edit: BOLD }) },
    { bash: `${RENDER} && ${CHECK}` }, { write: src, content: template() }, { bash: `${RENDER} && ${CHECK}` },
  ]);
  const { rep, dir, runRoot, secret, clock, events } = played.session;
  // As bench.mjs keeps it: the run (here with node_modules) and its transcript, under runs/<stamp>/.
  const runsDir = join(root, `kept-${rep}`);
  await writeFile(join(dir, "transcript.jsonl"), [{ type: "system", subtype: "init", cwd: dir }, ...events].map((e) => JSON.stringify(e)).join("\n"));
  await cp(dir, join(runsDir, `candidate__event__${rep}`), { recursive: true, filter: (f) => !f.includes("/node_modules") });
  await rm(runRoot, { recursive: true, force: true });
  const row = { suite: "skill", kit: "candidate", brief: "event", rep, secret, ...replayFields(played, events) };
  const again = await rereplayRow(row, { clock, runsDir });
  assert.deepEqual(again, row);
  assert.equal(existsSync(runRoot), false);
  await assert.rejects(rereplayRow({ ...row, secret: "0".repeat(64) }, { clock, runsDir }).then((r) => { if (r.replay.cutoff) throw new Error(r.replay.cutoff.reason); }), /isn't the harness's/, "another secret: the session's lines don't verify");
});

test("sessions don't load the system's certificates (in the sandbox, node prints an error for each)", () => {
  const env = sessionEnv({ NODE_USE_SYSTEM_CA: "1", NODE_OPTIONS: "--use-system-ca --max-old-space-size=4096", PATH: "/bin" }, { browsers: "/b" });
  assert.equal("NODE_USE_SYSTEM_CA" in env, false);
  assert.equal(env.NODE_OPTIONS, "--max-old-space-size=4096");
  assert.equal(env.PATH, "/bin");
  assert.equal("NODE_OPTIONS" in sessionEnv({}, { browsers: "/b" }), false);
});

test("the cutoff: each of these, and nothing after it is verified", async () => {
  const cases = [
    { bash: `${RENDER} 2>&1 | tee render.log` },
    { bash: `node -e "require('fs').appendFileSync('src/template.tsx', '\\n')"` },
    { write: "out/email.html", content: "<p>x</p>" },
    { read: src, lie: true },
    { bash: "npx @hyper-elements/migrate src --from unlayer-elements" },
    { bash: "cd .. && ls" },
    { bash: `${RENDER} >/dev/null` },
    { bash: `grep "$?" BRIEF.md` },
    { bash: "find . -name '*.tsx' -delete" },
    { bash: "npx tsc .cache/entry.tsx --noEmit" },
    { bash: "pwd" },
    { bash: RENDER, background: true },
    { tool: "WebFetch", input: { url: "https://example.com" } },
  ];
  for (const c of cases) {
    const r = await play([{ write: src, content: template() }, c, { bash: RENDER }]);
    assert.equal(r.cutoff?.call, 1, `${JSON.stringify(c)}: ${JSON.stringify(r.cutoff)}`);
    assert.ok(!r.cutoff.mismatch, "a cutoff, not a mismatch");
    assert.deepEqual(r.firstTry, { verified: false, valid: null });
  }
});

test("what a prefix grades: the first try before the cutoff, fix rounds only with their first clean render, neverValid with no cutoff", async () => {
  const after = await play([{ write: src, content: template() }, { bash: RENDER }, { bash: "pwd" }]);
  assert.deepEqual(after.firstTry, { verified: true, valid: true });
  const beforeClean = await play([{ write: src, content: template({ edit: BOLD }) }, { bash: RENDER }, { bash: "pwd" }]);
  assert.deepEqual(beforeClean.firstTry, { verified: true, valid: false });
  assert.equal(beforeClean.fixRounds.verified, false);
  const never = await play([{ write: src, content: template({ edit: BOLD }) }, { bash: RENDER }, { bash: TSC }]);
  assert.deepEqual(never.fixRounds, { verified: true, rounds: 1, neverValid: true });
});

test("a session whose final sources aren't the replay's is unverified as a whole", async () => {
  const r = await play([{ write: src, content: template() }, { bash: RENDER, then: (dir) => writeFile(join(dir, src), template({ edit: BOLD })) }]);
  assert.equal(r.cutoff, null);
  assert.equal(r.sourcesMatch, false);
  assert.equal(r.unverified, true);
  assert.equal(r.firstTry.verified, false);
});
