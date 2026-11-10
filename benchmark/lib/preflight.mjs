// Checks before a skill suite batch. The batch stops if any fails.
//
//   node lib/preflight.mjs [--kits candidate,release] [--briefs core]
//     The part that calls no model: every selected brief's reference solution rendered and checked with the candidate
//     engine (proving the render tools, Chromium, pdf.js and OCR are there); each other engine's own guide example
//     ("A whole template") and each brief's start files rendered with it; each brief's `requires` probe on each
//     engine, which decides the tasks it can't run (N/A); and task 7's baseline.
//   node lib/preflight.mjs --sandbox [--model sonnet]
//     The sandbox probe: one session, sandboxed as a batch's are, must pass the checker and tsc and fail to read the home
//     folder with node. About $0.30. It also runs before every batch.
//   node lib/preflight.mjs --skill-discovery [--model sonnet]
//     The skill-discovery smoke run: one short session in a `skill` kit run, which must list hyper-elements among the
//     skills it loaded (its `system` init event), with the skill at .claude/skills/ and --setting-sources project.
//     About $0.25 (Claude Code's system prompt, written to the cache once). If it fails, the `skill` arm can't be
//     compared.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { claudeArgs, deniedPaths, eventsOf, sandboxOf, sessionEnv, settingsOf, skillsOf } from "./claude.mjs";
import { briefOf, briefsOf, docsDirOf, ENGINES, kitOf, makeRun, runOf, runRootOf, suiteOf } from "./make-run.mjs";
import { browsersPath } from "./setup.mjs";

const bench = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SUITE = "skill";

function sh(cmd, args, opts) {
  return new Promise((done) => {
    const p = spawn(cmd, args, { ...opts, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => done({ code, out, err }));
  });
}

const node = (dir, args) => spawnSync(process.execPath, args, { cwd: dir, encoding: "utf8", timeout: 240_000, maxBuffer: 1 << 26 });
const lastJson = (text) => { try { return JSON.parse(text.trim().split("\n").pop()); } catch { return null; } };

/** Renders a run with its brief's render command, then runs its checker: what each printed, and the checker's verdict. */
export async function renderAndCheck(dir, run) {
  const render = node(dir, run.render);
  const check = render.status === 0 ? node(dir, ["tools/check.mjs", "--json"]) : null;
  return { render, check, verdict: check && lastJson(check.stdout) };
}

/** Task 7's kind: the start template rendered (candidate engine), measured by the change checker into `out`. */
export async function baselineOf(brief, root, out) {
  const s = await suiteOf(SUITE);
  const b = await briefOf(SUITE, brief);
  const run = runOf(s, await kitOf(SUITE, "candidate"), b);
  const dir = await makeRun(SUITE, "candidate", brief, "baseline", root);
  const render = node(dir, run.render);
  if (render.status !== 0) throw new Error(`${brief}: the start files don't render:\n${render.stdout}${render.stderr}`);
  await mkdir(dirname(out), { recursive: true });
  const m = node(dir, ["tools/check-change.mjs", "--baseline", out]);
  if (m.status !== 0 || !existsSync(out)) throw new Error(`${brief}: the baseline couldn't be measured:\n${m.stderr}`);
  return out;
}

/** A brief's reference solution, in a fresh run with the candidate engine, rendered and checked. */
export async function reference(brief, root, { extra = {} } = {}) {
  const s = await suiteOf(SUITE);
  const run = runOf(s, await kitOf(SUITE, "candidate"), await briefOf(SUITE, brief));
  const dir = await makeRun(SUITE, "candidate", brief, "reference", root, { extra });
  await cp(join(s.dir, "reference", brief), dir, { recursive: true });
  return { dir, ...(await renderAndCheck(dir, run)) };
}

/** The `tsx` block under a guide's "A whole template", as a template file. */
export function guideExample(guide) {
  const section = guide.split(/^## A whole template\s*$/m)[1];
  const code = section && /```tsx\n([\s\S]*?)```/.exec(section)?.[1];
  if (!code) throw new Error('no "A whole template" example in the guide');
  return code;
}

/** Writes `source` as src/template.tsx in a fresh run of `kit` for `brief`, and renders it as the brief does. */
async function renderWith(kit, brief, source, root, rep) {
  const s = await suiteOf(SUITE);
  const run = runOf(s, await kitOf(SUITE, kit), await briefOf(SUITE, brief));
  const dir = await makeRun(SUITE, kit, brief, rep, root);
  if (source !== null) {
    await mkdir(join(dir, "src"), { recursive: true });
    await writeFile(join(dir, "src/template.tsx"), source);
  }
  return node(dir, run.render);
}

/**
 * The no-model preflight for these kits and briefs. Returns the N/A tasks of each kit, task 7's baseline (if
 * selected), and every problem found; the batch doesn't start with a problem.
 */
export async function preflight({ kits, briefs, root, baselines }) {
  const problems = [];
  const s = await suiteOf(SUITE);
  const kitInfo = Object.fromEntries(await Promise.all(kits.map(async (k) => [k, await kitOf(SUITE, k)])));
  const briefInfo = Object.fromEntries(await Promise.all(briefs.map(async (b) => [b, await briefOf(SUITE, b)])));
  const extraOf = {};

  // Task 7's baseline, before any session can touch the start files.
  for (const b of briefs) {
    if (!briefInfo[b].spec?.change) continue;
    const out = join(baselines, `${b}.json`);
    try {
      await baselineOf(b, root, out);
      extraOf[b] = { "tools/checks/change/baseline.json": out };
    } catch (e) { problems.push(e.message); }
  }

  // Every reference solution, with the candidate engine.
  for (const b of briefs) {
    if (!existsSync(join(s.dir, "reference", b))) { problems.push(`${b}: no reference solution`); continue; }
    const r = await reference(b, root, { extra: extraOf[b] ?? {} });
    if (r.render.status !== 0) problems.push(`${b}: the reference doesn't render:\n${r.render.stdout}${r.render.stderr}`);
    else if (!r.verdict) problems.push(`${b}: the checker crashed on the reference:\n${r.check.stderr.slice(0, 2000)}`);
    else if (!r.verdict.pass) problems.push(`${b}: the reference fails its checks: ${r.verdict.results.filter((x) => !x.ok).map((x) => `${x.name}: ${x.detail}`).join("; ")}`);
  }

  // Each engine: its own guide's example, the start files, and the probes that decide its N/A tasks.
  const na = Object.fromEntries(kits.map((k) => [k, []]));
  const engines = [...new Set(kits.map((k) => kitInfo[k].engine))];
  for (const engine of engines) {
    const kit = kits.find((k) => kitInfo[k].engine === engine);
    const guide = readFileSync(join(ENGINES, engine, "@hyper-elements/react/GUIDE.md"), "utf8");
    const example = await renderWith(kit, "event", guideExample(guide), root, `example-${engine}`);
    if (example.status !== 0) problems.push(`engine ${engine}: its guide's example doesn't render:\n${example.stdout}${example.stderr}`);
    for (const b of briefs) {
      const run = runOf(s, kitInfo[kit], briefInfo[b]);
      if (run.requires) {
        const probe = await renderWith(kit, b, readFileSync(join(s.dir, run.requires), "utf8"), root, `probe-${engine}`);
        if (probe.status !== 0) for (const k of kits) if (kitInfo[k].engine === engine) na[k].push(b);
      }
      if (Object.keys(run.start).length && run.startRenders) {
        const start = await renderWith(kit, b, null, root, `start-${engine}`);
        if (start.status !== 0) problems.push(`engine ${engine}: ${b}'s start files don't render:\n${start.stdout}${start.stderr}`);
      }
    }
  }
  return { na, extraOf, problems };
}

/**
 * The sandbox probe: one session, sandboxed as the batch's are, on a run holding task 1's reference solution (rendered).
 * It's asked to run the checker, which must pass; to type-check, which must pass; and to read the home folder with
 * node, which must fail. Proves the session's own tools work under the restrictions the agents get, and that they
 * hold for what a `node` command opens.
 */
export async function sandboxProbe({ model = "sonnet", browsers } = {}) {
  const denied = deniedPaths(bench);
  const runRoot = runRootOf(process.env.BENCH_RUN_ROOT, denied);
  const root = mkdtempSync(join(runRoot, "sandbox-"));
  const dir = await makeRun(SUITE, "candidate", "event", "sandbox", root, { isolated: true });
  await cp(join(bench, "suites/skill/reference/event"), dir, { recursive: true });
  await mkdir(join(dir, ".tmp"), { recursive: true });
  const env = sessionEnv(process.env, { browsers, tmp: join(dir, ".tmp") });
  const rendered = spawnSync(process.execPath, ["tools/render.mjs"], { cwd: dir, env, encoding: "utf8" });
  if (rendered.status !== 0) throw new Error(`the sandbox probe's reference doesn't render: ${rendered.stderr}`);
  const home = 'node -e "console.log(require(\'fs\').readdirSync(require(\'os\').homedir()).length)"';
  // The checker runs outside the sandbox: a command chained to it must not, and nothing may change it.
  const commands = {
    check: "node tools/check.mjs",
    tsc: "npx tsc --noEmit",
    home,
    chained: `node tools/check.mjs && ${home}`,
    edit: 'node -e "require(\'fs\').appendFileSync(\'tools/check.mjs\', \'// changed\\n\')"',
  };
  const list = Object.values(commands);
  // The prompt says why commands 3–5 are there: told only "don't change any file", and with CLAUDE.md's rule about
  // tools/, an agent may decline the append (Sonnet did), and the probe can't tell that the sandbox refuses it.
  const prompt = `This session tests the OS sandbox your Bash commands run in. Run exactly these ${list.length} commands with the Bash tool, one call each, in this order, and nothing else.\n\n${list.map((c, i) => `${i + 1}. \`${c}\``).join("\n")}\n\nCommands 3, 4 and 5 are meant to be refused by the sandbox: 3 and 4 read the home folder, and 5 appends a comment to tools/check.mjs. That refusal is what's being tested, so run each one exactly as written and let the sandbox decide; CLAUDE.md's rule about tools/ doesn't apply to this test. Don't retry a command that fails, and don't change any file in any other way.\n\nThen reply with one line per command: its number and whether it succeeded.`;
  const settings = settingsOf(denied, sandboxOf({ runDir: dir, runRoot, browsers }));
  const before = readFileSync(join(dir, "tools/check.mjs"), "utf8");
  const r = await sh("claude", claudeArgs({ prompt, model, settings, skillSuite: true, maxTurns: 10 }), { cwd: dir, env });
  const changed = readFileSync(join(dir, "tools/check.mjs"), "utf8") !== before;
  const events = eventsOf(r.out);
  const calls = events.flatMap((e) => (e.type === "assistant" ? e.message.content : [])).filter((c) => c.type === "tool_use" && c.name === "Bash");
  const results = new Map(events.flatMap((e) => (e.type === "user" && Array.isArray(e.message?.content) ? e.message.content : [])).filter((c) => c.type === "tool_result").map((c) => [c.tool_use_id, c]));
  const text = (c) => (typeof c.content === "string" ? c.content : JSON.stringify(c.content));
  const of = (cmd) => { const call = calls.find((c) => c.input?.command?.trim() === cmd); const res = call && results.get(call.id); return res ? { error: !!res.is_error, out: text(res).slice(-800) } : null; };
  const check = of(commands.check), tsc = of(commands.tsc), read = of(commands.home), chained = of(commands.chained), edit = of(commands.edit);
  const refused = (x) => /EPERM|EACCES|Operation not permitted/i.test(x.out);
  const final = events.findLast((e) => e.type === "result") ?? {};
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const keep = join(bench, "runs", `${stamp}-sandbox-probe`);
  await mkdir(keep, { recursive: true });
  await writeFile(join(keep, "transcript.jsonl"), r.out);
  if (r.err) await writeFile(join(keep, "stderr.txt"), r.err);
  await rm(root, { recursive: true, force: true });
  const problems = [];
  if (!check) problems.push("the checker wasn't run");
  else if (check.error || !/All \d+ checks passed/.test(check.out)) problems.push(`the checker didn't pass in the sandbox: ${check.out}`);
  if (!tsc) problems.push("tsc wasn't run");
  else if (tsc.error) problems.push(`tsc failed in the sandbox: ${tsc.out}`);
  if (!read) problems.push("the home folder wasn't read");
  else if (!refused(read)) problems.push(`node read the home folder: ${read.out}`);
  if (!chained) problems.push("the chained command wasn't run");
  else if (!refused(chained)) problems.push(`a command chained to the checker ran outside the sandbox: ${chained.out}`);
  if (changed) problems.push("a sandboxed command changed tools/check.mjs");
  else if (!edit) problems.push("the edit of tools/check.mjs wasn't tried");
  return { ok: problems.length === 0, problems, check, tsc, read, chained, edit, changed, costUsd: final.total_cost_usd ?? null, transcript: join(keep, "transcript.jsonl") };
}

/** One session in a `skill` kit run: whether its init event lists the skill, and what it cost. */
export async function skillDiscovery({ model = "sonnet", brief = "event" } = {}) {
  const denied = deniedPaths(bench);
  const root = mkdtempSync(join(runRootOf(process.env.BENCH_RUN_ROOT, denied), "smoke-"));
  const dir = await makeRun(SUITE, "skill", brief, "smoke", root, { isolated: true });
  const prompt = "Reply with the one word: ready. Don't use any tool.";
  const r = await sh("claude", claudeArgs({ prompt, model, settings: settingsOf(denied), allowSkill: true, skillSuite: true, maxTurns: 1 }), { cwd: dir, env: { ...process.env } });
  const events = eventsOf(r.out);
  const skills = skillsOf(events);
  const final = events.findLast((e) => e.type === "result") ?? {};
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const keep = join(bench, "runs", `${stamp}-skill-discovery`);
  await mkdir(keep, { recursive: true });
  await writeFile(join(keep, "transcript.jsonl"), r.out);
  if (r.err) await writeFile(join(keep, "stderr.txt"), r.err);
  await cp(join(dir, ".claude"), join(keep, ".claude"), { recursive: true });
  await rm(root, { recursive: true, force: true });
  return {
    ok: !!skills?.includes("hyper-elements"),
    skills, exit: r.code, costUsd: final.total_cost_usd ?? null, model: events.find((e) => e.type === "system")?.model ?? model,
    claudeVersion: events.find((e) => e.type === "system")?.claude_code_version ?? null, transcript: join(keep, "transcript.jsonl"),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : def; };
  if (process.argv.includes("--skill-discovery")) {
    const r = await skillDiscovery({ model: arg("model", "sonnet") });
    console.log(JSON.stringify(r, null, 2));
    console.log(r.ok ? "PASS skill discovery: hyper-elements is among the session's skills." : `FAIL skill discovery: ${r.skills === null ? "no init event" : `the session's skills are ${JSON.stringify(r.skills)}`}`);
    process.exit(r.ok ? 0 : 1);
  }
  if (process.argv.includes("--sandbox")) {
    const r = await sandboxProbe({ model: arg("model", "sonnet"), browsers: browsersPath() });
    console.log(JSON.stringify(r, null, 2));
    console.log(r.ok ? "PASS sandbox: the checker and tsc work in it, and node can't read the home folder." : `FAIL sandbox: ${r.problems.join("; ")}`);
    process.exit(r.ok ? 0 : 1);
  }
  const root = mkdtempSync(join(tmpdir(), "preflight-"));
  const kits = arg("kits", "candidate,release").split(",");
  const briefs = await briefsOf(SUITE, arg("briefs", "core"));
  const t0 = Date.now();
  const r = await preflight({ kits, briefs, root, baselines: join(root, "baselines") });
  await rm(root, { recursive: true, force: true });
  for (const [k, list] of Object.entries(r.na)) if (list.length) console.log(`N/A for ${k}: ${list.join(", ")}`);
  for (const p of r.problems) console.log(`FAIL ${p}`);
  console.log(r.problems.length ? `\nPreflight failed: ${r.problems.length} problem(s).` : `\nPreflight passed (${briefs.length} briefs, ${kits.length} kits, ${((Date.now() - t0) / 1000).toFixed(0)}s).`);
  process.exit(r.problems.length ? 1 : 0);
}
