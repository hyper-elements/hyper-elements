// Runs a coding agent (Claude Code, headless) on each brief with each kit, and records what it cost to
// reach the suite's shared quality bar (tools/check.mjs): wall time, turns, tokens, dollars, and whether it got there.
//
//   node lib/bench.mjs --suite email --kits he,react-email,html --briefs reset,launch --reps 2 --model sonnet --concurrency 3
//   node lib/bench.mjs --suite image --kits he,playwright,canvas --briefs all --reps 3 --model sonnet --concurrency 4
//   node lib/bench.mjs --suite multi --kits he,stack --briefs all --reps 4 --model sonnet --concurrency 4
//
// A suite with a `changePrompt` (multi) runs in two phases: the build, then, in a new session on the finished
// project, the brief's change (CHANGES.md and the changed checks). The row has each phase's numbers and the totals.
//
// Each run gets a fresh directory (runs/<stamp>/<kit>__<brief>__<rep>/) and the suite's prompt. The agent's
// whole transcript is kept there (transcript.jsonl), and one row per run is appended to results/<stamp>-<suite>-<model>.jsonl.
import { execFileSync, spawn } from "node:child_process";
import { appendFile, cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync, mkdtempSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { arch, platform, release } from "node:os";
import { getEncoding } from "js-tiktoken";
import { applyChanges, briefOf, briefsOf, docsDirOf, ENGINES, jobsOf, kitOf, makeRun, runOf, runRootOf, suiteOf } from "./make-run.mjs";
import { browsersPath, fingerprint } from "./setup.mjs";
import { outsideAccess } from "./audit.mjs";
import { claudeArgs, deniedPaths, eventsOf, sandboxOf, sessionEnv, settingsOf, skillsOf } from "./claude.mjs";
import { changedGuards, gradingPass, guardHashes, scanSources, unlock } from "./grade.mjs";
import { replayFields, replayRun } from "./replay.mjs";
import { randomBytes } from "node:crypto";
import { preflight, sandboxProbe, skillDiscovery } from "./preflight.mjs";
import { resumeOf, resumeProblems } from "./resume.mjs";

const bench = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
};
const suiteName = arg("suite", "email");
const suite = await suiteOf(suiteName);
const model = arg("model", "sonnet");
const concurrency = Number(arg("concurrency", "3"));
const timeoutMin = Number(arg("timeout", "20"));
// --resume (the skill suite, with the batch's --stamp and --model): the stopped batch's plan.json gives the kits,
// tasks, reps and clock, and only its jobs without a row run. --max-cost-usd then counts the whole batch.
const resuming = process.argv.includes("--resume");
if (resuming && (suiteName !== "skill" || arg("stamp") === undefined)) throw new Error("--resume takes the skill suite and the batch's --stamp");
if (resuming && ["kits", "briefs", "reps"].some((a) => arg(a) !== undefined)) throw new Error("--resume takes the kits, tasks and reps from plan.json");
const stamp = arg("stamp", new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19));
const runsDir = join(bench, "runs", stamp);
const resultsFile = join(bench, "results", `${stamp}-${suiteName}-${model}.jsonl`);
const planFile = resultsFile.replace(/\.jsonl$/, ".plan.json");
await mkdir(dirname(resultsFile), { recursive: true });
const plan = resuming ? JSON.parse(await readFile(planFile, "utf8")) : null;
const before = resuming ? resumeOf(plan, existsSync(resultsFile) ? await readFile(resultsFile, "utf8") : "") : null;
const kits = plan?.kits ?? arg("kits", { email: "he,react-email,mjml,html", image: "he,playwright,canvas", multi: "he,stack", skill: "candidate,release" }[suiteName]).split(",");
const briefs = plan?.briefs ?? await briefsOf(suiteName, arg("briefs", suite.groups ? "core" : "all"));
const reps = plan?.reps ?? Number(arg("reps", "1"));

const enc = getEncoding("o200k_base");

// What made these results: the agent's version, the engine's commit, every package a kit uses, and the machine.
const version = (pkg) => { try { return JSON.parse(readFileSync(join(bench, "node_modules", pkg, "package.json"), "utf8")).version; } catch { return null; } };
const provenance = {
  claudeVersion: execFileSync("claude", ["--version"], { encoding: "utf8" }).trim(),
  engine: existsSync(join(bench, "node_modules/@hyper-elements/react/source.json")) ? JSON.parse(await readFile(join(bench, "node_modules/@hyper-elements/react/source.json"), "utf8")) : null,
  packages: Object.fromEntries(["@hyper-elements/react", "@react-email/components", "@react-email/render", "satori", "@resvg/resvg-js", "playwright", "@napi-rs/canvas", "mjml", "tesseract.js", "react", "typescript", "esbuild"].map((p) => [p, version(p)])),
  node: process.version, os: `${platform()} ${release()} ${arch()}`,
};

// Isolation. An agent finds what it can reach: in a run directory beside the others, agents globbed the benchmark
// and copied its reference solutions and other runs' work. So each run is a directory of its own in the system's
// temporary folder (its own copy of node_modules, no link out), and Claude Code is told to deny reading or editing
// the repository, the home folder (Claude Code's own session logs are there) and /tmp. Those rules cover the file
// tools, not what a node command opens: the audit below catches a path a tool call names (a run that reached outside its
// directory is kept but marked invalid), not one a command builds. The skill suite runs Bash in the OS sandbox for that.
const denied = deniedPaths(bench);

const settings = settingsOf(denied);
// Where runs are made while their session lasts: BENCH_RUN_ROOT, else the system's temporary folder. Never under a
// denied path (on Linux the temporary folder is /tmp), where the session couldn't read its own run.
const runRoot = runRootOf(process.env.BENCH_RUN_ROOT, denied);
// The skill suite's sessions read Playwright's browsers at the run root (`setup.mjs --browsers`): its usual place is under
// the home folder, which they're denied. The preflight, the sessions and the grading pass all use these.
const browsers = browsersPath();
if (suiteName === "skill") {
  if (!existsSync(browsers)) throw new Error(`no browsers at ${browsers}: install them with \`node lib/setup.mjs --browsers\``);
  process.env.PLAYWRIGHT_BROWSERS_PATH = browsers;
  process.env.BENCH_CHROMIUM_ARGS = sessionEnv({}, { browsers }).BENCH_CHROMIUM_ARGS;
}

// The skill suite's kits name an engine and a docs set, recorded per row. A `candidate` engine must be what the
// checkout would build now: the same fingerprint as when `setup.mjs --as candidate` installed it.
const kitInfo = Object.fromEntries(await Promise.all(kits.map(async (k) => [k, await kitOf(suiteName, k)])));
const sourceOf = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null);
const runProvenance = Object.fromEntries(Object.entries(kitInfo).map(([name, k]) => {
  if (!k.engine) return [name, null];
  const engine = sourceOf(join(ENGINES, k.engine, "source.json"));
  if (!engine) throw new Error(`kit ${name}: no engine "${k.engine}". Install it with \`HYPER_ELEMENTS_PACKAGE=… node lib/setup.mjs --as ${k.engine}\`.`);
  const docs = k.docsFrom ? sourceOf(join(docsDirOf(k), "source.json")) : { engine: k.engine, files: engine.docs };
  if (!docs) throw new Error(`kit ${name}: no docs set "${k.docsFrom}". Write it with \`node lib/setup.mjs --docs-from <ref> --as ${k.docsFrom}\`.`);
  return [name, { engine, docs: { ...docs, given: k.allowSkill ? "skill" : k.docs.includes("GUIDE.md") ? "import" : "none" } }];
}));
for (const [name, p] of Object.entries(runProvenance)) {
  if (p?.engine.name !== "candidate") continue;
  if (fingerprint(p.engine.checkout) !== p.engine.fingerprint) throw new Error(`kit ${name}: the candidate engine is stale (the checkout changed since it was installed). Run \`node lib/setup.mjs --as candidate\` again.`);
}
// The rows record the checkout relative to this repository ("." for this checkout), not as a path on this machine.
for (const p of Object.values(runProvenance)) {
  if (p?.engine.checkout) p.engine = { ...p.engine, checkout: relative(resolve(bench, ".."), p.engine.checkout) || "." };
}

const dryRun = process.argv.includes("--dry-run");
// The batch's start, in ms: the clock every render in it reads (the skill suite pins it), recorded in plan.json. A
// resumed batch keeps its own.
const batchClock = plan ? Date.parse(plan.startedAt) : Date.now();
const maxCost = arg("max-cost-usd") === undefined ? Infinity : Number(arg("max-cost-usd"));
const skillSuite = suiteName === "skill";

// The skill suite's preflight, before any job: the part with no model call (references, engines, probes, task 7's
// baseline), then the skill-discovery smoke run where the `skill` kit is selected. Any problem stops the batch.
let na = Object.fromEntries(kits.map((k) => [k, []]));
let extraOf = {};
if (skillSuite && !dryRun) {
  const root = mkdtempSync(join(runRoot, "preflight-"));
  // A resumed batch's task 7 baselines are written again; they must come out the same.
  const baselinesBefore = resuming && existsSync(join(runsDir, "baselines"))
    ? Object.fromEntries(await Promise.all((await readdir(join(runsDir, "baselines"))).map(async (f) => [f, await readFile(join(runsDir, "baselines", f), "utf8")])))
    : {};
  console.log("Preflight…");
  const pre = await preflight({ kits, briefs, root, baselines: join(runsDir, "baselines") });
  await rm(root, { recursive: true, force: true });
  if (pre.problems.length) {
    for (const p of pre.problems) console.error(`FAIL ${p}`);
    console.error(`Preflight failed: ${pre.problems.length} problem(s). Nothing was run.`);
    process.exit(1);
  }
  ({ na, extraOf } = pre);
  for (const [f, text] of Object.entries(baselinesBefore)) {
    if ((await readFile(join(runsDir, "baselines", f), "utf8")) !== text) {
      console.error(`FAIL --resume: the baseline ${f} differs from the batch's. Nothing was run.`);
      process.exit(1);
    }
  }
  const box = await sandboxProbe({ model, browsers });
  if (!box.ok) {
    console.error(`FAIL sandbox probe: ${box.problems.join("; ")} (${box.transcript}). Nothing was run.`);
    process.exit(1);
  }
  console.log(`Sandbox probe passed ($${(box.costUsd ?? 0).toFixed(2)}).`);
  if (kits.includes("skill")) {
    const smoke = await skillDiscovery({ model });
    if (!smoke.ok) {
      console.error(`FAIL skill discovery: the session's skills are ${JSON.stringify(smoke.skills)} (${smoke.transcript}). Leave the skill kit out.`);
      process.exit(1);
    }
    console.log(`Skill discovery passed ($${(smoke.costUsd ?? 0).toFixed(2)}).`);
  }
  for (const [k, list] of Object.entries(na)) if (list.length) console.log(`N/A for ${k}: ${list.join(", ")}`);
}


// A command that runs a tool, not one that only reads it (`cat tools/check.mjs`).
const runs = (cmd, tool) => new RegExp(`(^|[;&|(]\\s*)node\\s+(\\./)?${tool.replace(/[./]/g, "\\$&")}\\b`).test(cmd);

function sh(cmd, args, opts) {
  return new Promise((done) => {
    const p = spawn(cmd, args, { ...opts, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    const t = opts.timeout ? setTimeout(() => p.kill("SIGTERM"), opts.timeout) : null;
    p.on("close", (code, signal) => (t && clearTimeout(t), done({ code, signal, out, err })));
  });
}

/** The files a kit's agent writes: each path in its kit.json, or every file under a folder ("src/"). */
async function sourcesOf(dir, sources) {
  const files = [];
  for (const f of sources) {
    if (!f.endsWith("/")) { if (existsSync(join(dir, f))) files.push(f); continue; }
    if (!existsSync(join(dir, f))) continue;
    for (const e of await readdir(join(dir, f), { recursive: true, withFileTypes: true })) if (e.isFile()) files.push(join(e.parentPath ?? e.path, e.name).slice(dir.length + 1));
  }
  return Object.fromEntries(await Promise.all(files.sort().map(async (f) => [f, await readFile(join(dir, f), "utf8")])));
}

/** Lines added and removed between two versions of the sources (as multisets of lines: moves don't count). */
function diffOf(before, after) {
  const files = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((f) => before[f] !== after[f]);
  let added = 0, removed = 0;
  for (const f of files) {
    const count = new Map();
    for (const l of (before[f] ?? "").split("\n")) count.set(l, (count.get(l) ?? 0) + 1);
    for (const l of (after[f] ?? "").split("\n")) { const n = count.get(l) ?? 0; if (n > 0) count.set(l, n - 1); else added++; }
    for (const n of count.values()) removed += n;
  }
  return { filesChanged: files.length, linesAdded: added, linesRemoved: removed };
}

/**
 * How many times the brief's copy is written in the sources: for each text the checks look for (over 12 characters,
 * so not "Agenda" or a time), the number of source files that contain it. 1 is written once; descriptive only.
 */
async function copiesOf(dir, built) {
  const specs = [];
  for (const f of ["tools/spec.json", "tools/checks/email/spec.json", "tools/checks/card/spec.json", "tools/checks/pdf/spec.json"]) if (existsSync(join(dir, f))) specs.push(JSON.parse(await readFile(join(dir, f), "utf8")));
  const texts = [...new Set(specs.flatMap((s) => (s.texts ?? []).map((t) => (typeof t === "string" ? t : t.text))).filter((t) => t.length > 12))];
  if (!texts.length) return null;
  const counts = texts.map((t) => Object.values(built).reduce((n, src) => n + (src.includes(t) ? 1 : 0), 0));
  return { texts: texts.length, inOneFile: counts.filter((n) => n === 1).length, inSeveral: counts.filter((n) => n > 1).length, inNone: counts.filter((n) => n === 0).length, max: Math.max(...counts) };
}

/** One agent session in a run directory, until it stops: what it did, what it cost, and the check after it. */
async function session(dir, prompt, transcript, { render = [suite.render], allowedTools = [], allowSkill = false, settings: own = settings, env = process.env } = {}) {
  const t0 = Date.now();
  const r = await sh(
    "claude",
    claudeArgs({ prompt, model, settings: own, allowedTools, allowSkill, skillSuite: suiteName === "skill" }),
    { cwd: dir, timeout: timeoutMin * 60_000, env: { ...env } },
  );
  const wall = Date.now() - t0;
  await writeFile(join(dir, transcript), r.out);
  if (r.err) await writeFile(join(dir, transcript.replace(/\.jsonl$/, ".stderr.txt").replace(/^transcript\./, "")), r.err);

  const events = eventsOf(r.out);
  const final = events.findLast((e) => e.type === "result") ?? {};
  // Every tool call the agent made, and how the first check went.
  const commands = events.flatMap((e) => (e.type === "assistant" ? e.message.content : []))
    .filter((c) => c.type === "tool_use").map((c) => ({ id: c.id, name: c.name, input: c.input ?? {}, cmd: c.input?.command ?? "", file: c.input?.file_path ?? "" }));
  const toolResults = new Map(events.flatMap((e) => (e.type === "user" && Array.isArray(e.message?.content) ? e.message.content : []))
    .filter((c) => c.type === "tool_result").map((c) => [c.tool_use_id, c]));
  const checks = commands.filter((c) => c.name === "Bash" && runs(c.cmd, "tools/check.mjs"));
  const firstCheck = checks[0] ? toolResults.get(checks[0].id) : null;
  const firstCheckPassed = firstCheck ? !firstCheck.is_error && /All \d+ checks passed/.test(JSON.stringify(firstCheck.content)) : null;
  const renders = commands.filter((c) => c.name === "Bash" && runs(c.cmd, render[0]));
  const renderErrors = renders.filter((c) => toolResults.get(c.id)?.is_error).length;

  const verdict = await sh("node", ["tools/check.mjs", "--json"], { cwd: dir, timeout: 180_000, env });
  let check = {};
  try { check = JSON.parse(verdict.out.trim().split("\n").pop()); } catch { check = { pass: false, error: verdict.err.slice(0, 400), crashed: true }; }

  const u = final.usage ?? {};
  return {
    pass: !!check.pass, parts: check.parts ?? null, failed: check.results?.filter((x) => !x.ok).map((x) => `${x.name}: ${x.detail}`) ?? [check.error],
    exit: r.code, signal: r.signal, isError: !!final.is_error, result: String(final.result ?? "").slice(0, 300),
    wallMs: wall, durationMs: final.duration_ms, apiMs: final.duration_api_ms, turns: final.num_turns, costUsd: final.total_cost_usd,
    inputTokens: u.input_tokens ?? 0, cacheWriteTokens: u.cache_creation_input_tokens ?? 0, cacheReadTokens: u.cache_read_input_tokens ?? 0, outputTokens: u.output_tokens ?? 0,
    toolCalls: commands.length, checkRuns: checks.length, firstCheckPassed,
    renderRuns: renders.length, renderErrors, firstRenderOk: renders[0] ? !toolResults.get(renders[0].id)?.is_error : null,
    imageReads: commands.filter((c) => c.name === "Read" && /\.(png|jpe?g|gif|webp)$/i.test(c.file)).length,
    warnings: check.warnings ?? null,
    // The checker exited without its JSON result (a crash, a timeout, a missing browser): not the task's failure.
    checkerCrashed: !!check.crashed,
    modelUsage: final.modelUsage,
    // The skills the session loaded, and whether it used the Skill tool (the skill kit's runs).
    skills: skillsOf(events),
    skillCalls: commands.filter((c) => c.name === "Skill").map((c) => c.input.skill ?? c.input.command ?? null),
    // Reached outside its run directory: tried (denied) doesn't invalidate a run; got does.
    outside: outsideAccess(dir, commands, toolResults, t0),
  };
}

/**
 * The email client problems left in a finished email, from the kit's render tool (`diagnostics` in its kit.json, run
 * with --json): warnings and notes that name email clients, and how many of each code.
 */
async function emailClientsOf(dir, tool) {
  const r = await sh("node", [tool, "--json"], { cwd: dir, timeout: 120_000 });
  let diagnostics;
  try { ({ diagnostics } = JSON.parse(r.out.trim().split("\n").pop())); } catch { return { error: (r.err || r.out).slice(0, 300) }; }
  const about = diagnostics.filter((d) => d.clients?.length);
  const codes = {};
  for (const d of about) codes[d.code] = (codes[d.code] ?? 0) + 1;
  return { warnings: about.filter((d) => d.severity === "warning").length, notes: about.filter((d) => d.severity === "info").length, codes };
}

const SUMMED = ["wallMs", "durationMs", "apiMs", "turns", "costUsd", "inputTokens", "cacheWriteTokens", "cacheReadTokens", "outputTokens", "toolCalls", "checkRuns", "renderRuns", "renderErrors", "imageReads"];

async function one(kit, brief, rep) {
  const dir = await makeRun(suiteName, kit, brief, rep, mkdtempSync(join(runRoot, "run-")), { isolated: true, extra: extraOf[brief] ?? {} });
  const k = kitInfo[kit];
  const run = runOf(suite, k, await briefOf(suiteName, brief));
  const { sources } = run;
  const { diagnostics } = k;
  // The skill suite: Bash in the OS sandbox, a fixed environment, and the guarded files hashed before and after.
  const own = skillSuite ? settingsOf(denied, sandboxOf({ runDir: dir, runRoot, browsers })) : settings;
  // The sandbox lets a session write only in its run, so its temporary folder is there too.
  if (skillSuite) await mkdir(join(dir, ".tmp"), { recursive: true });
  // The run's secret (the render tools and checker sign their result lines with it) and the batch's start as the
  // pinned clock, in the session's environment only: no file holds them.
  const env = skillSuite
    ? { ...sessionEnv(process.env, { browsers, tmp: join(dir, ".tmp") }), BENCH_SECRET: randomBytes(32).toString("hex"), BENCH_CLOCK: String(batchClock) }
    : process.env;
  const guardsBefore = skillSuite ? await guardHashes(dir) : null;
  const build = await session(dir, run.prompt, "transcript.jsonl", { render: run.render, allowedTools: run.allowedTools, allowSkill: !!k.allowSkill, settings: own, env });
  const built = await sourcesOf(dir, sources);
  const source = Object.values(built).join("\n");
  const copies = await copiesOf(dir, built); // against the build's specs, before a change replaces them
  let row = { stamp, suite: suiteName, kit, brief, rep, model, ...build };

  // Phase 2: the change, in a new session on the finished project; only after a passing build (a change to a
  // project that doesn't pass would measure the build again).
  if (suite.changePrompt) {
    let change = null;
    if (build.pass) {
      await applyChanges(suiteName, brief, dir);
      change = await session(dir, suite.changePrompt, "transcript-change.jsonl");
      Object.assign(change, diffOf(built, await sourcesOf(dir, sources)));
    }
    row = {
      stamp, suite: suiteName, kit, brief, rep, model,
      pass: build.pass && !!change?.pass,
      failed: build.pass ? (change?.failed ?? []).map((f) => `change: ${f}`) : build.failed.map((f) => `build: ${f}`),
      ...Object.fromEntries(SUMMED.map((k) => [k, (build[k] ?? 0) + (change?.[k] ?? 0)])),
      firstCheckPassed: build.firstCheckPassed,
      outside: [...build.outside, ...(change?.outside ?? [])],
      build, change,
    };
  }
  if (diagnostics) row.emailClients = await emailClientsOf(dir, diagnostics);
  Object.assign(row, { sourceTokens: enc.encode(source).length, sourceChars: source.length, sourceFiles: Object.keys(built).length, copies, ...provenance });
  // The skill suite: this run's own engine and docs, in place of the global engine.
  if (runProvenance[kit]) Object.assign(row, { engine: runProvenance[kit].engine, docs: runProvenance[kit].docs });
  row.valid = !row.outside.some((o) => o.got && !o.own);
  if (skillSuite) {
    // Tampering: a guarded file changed, or the sources call what no template needs. Only these, and a maintainer,
    // mark a row `tampered`.
    const guarded = changedGuards(guardsBefore, await guardHashes(dir));
    const scan = scanSources(built);
    row.tampered = [...guarded.map((p) => `changed ${p}`), ...scan.tampered];
    row.readsUnpinned = scan.readsUnpinned;
    // The attempts, recomputed over the verified prefix: the session replayed at its own path, its directory aside.
    const events = eventsOf(await readFile(join(dir, "transcript.jsonl"), "utf8"));
    const rp = await replayRun({ kit, brief, rep, root: dirname(dir), dir, events, env, extra: extraOf[brief] ?? {} });
    // The secret too, now the session is over: `lib/rereplay.mjs` replays the batch again with it, after a change to
    // the replay, without new sessions.
    Object.assign(row, replayFields(rp, events), { secret: env.BENCH_SECRET });
    // The grade: the sources rendered and checked again in a pristine directory, the checker copied in after the
    // render. The session's own check is kept, but doesn't decide.
    const gradeRoot = mkdtempSync(join(runRoot, "grade-"));
    const grade = await gradingPass({ kit, brief, sourcesFrom: dir, root: gradeRoot, extra: extraOf[brief] ?? {}, env: sessionEnv(process.env, { browsers }) });
    row.sessionCheck = { pass: row.pass, failed: row.failed, crashed: row.checkerCrashed };
    Object.assign(row, {
      pass: grade.pass, failed: grade.failed ?? [], rendered: grade.rendered, warningsLeft: grade.warningsLeft ?? null,
      gradeRender: grade.rendered ? null : grade.render,
    });
    if (grade.harnessError) row.harnessError = grade.harnessError;
    await unlock(gradeRoot);
    await rm(gradeRoot, { recursive: true, force: true });
    row.valid = row.valid && row.tampered.length === 0 && !row.harnessError;
  }
  await appendFile(resultsFile, JSON.stringify(row) + "\n");
  // Kept in runs/<stamp>/ (everything but node_modules), out of the temporary folder.
  const keep = join(runsDir, `${kit}__${brief}__${rep}`);
  await rm(keep, { recursive: true, force: true });
  await mkdir(dirname(keep), { recursive: true });
  await cp(dir, keep, { recursive: true, filter: (f) => !f.startsWith(join(dir, "node_modules")) });
  await rm(dirname(dir), { recursive: true, force: true });
  const phases = row.build ? `  (build ${(row.build.wallMs / 1000).toFixed(0)}s${row.change ? `, change ${(row.change.wallMs / 1000).toFixed(0)}s` : ""})` : "";
  console.log(`${row.pass ? "PASS" : "FAIL"}${row.valid ? "" : " INVALID"} ${kit} ${brief} #${rep}  ${(row.wallMs / 1000).toFixed(0)}s${phases}  ${row.turns} turns  ${row.outputTokens} out  $${(row.costUsd ?? 0).toFixed(3)}${row.pass ? "" : "  " + row.failed.slice(0, 2).join(" / ")}${row.valid ? "" : "  reached " + row.outside.filter((o) => o.got).map((o) => o.path).slice(0, 2).join(", ")}`);
  return row;
}

// The kits interleaved; a brief with `run.kits` only in those, and no N/A task (its `requires` probe failed).
const briefKits = Object.fromEntries(await Promise.all(briefs.map(async (b) => [b, (await briefOf(suiteName, b)).run?.kits ?? null])));
const planned = jobsOf(kits, briefs, reps, briefKits, na);
if (resuming && !dryRun) {
  const problems = resumeProblems({ plan, rows: before.rows, jobs: planned, na, claudeVersion: provenance.claudeVersion, kits: runProvenance });
  if (problems.length) {
    for (const p of problems) console.error(`FAIL --resume: ${p}`);
    console.error("Nothing was run.");
    process.exit(1);
  }
}
const jobs = resuming ? before.left : planned;

if (dryRun) {
  // An estimate from measured medians with Sonnet. The email and image suites: $0.43 an email or page task, $0.60 a
  // Canvas task. The skill suite's sessions cost more (its sandbox and checks): $0.80 a task (the negative control,
  // 2026-11-09), Canvas scaled the same, plus the sandbox probe. The `none` arm about 1.5×; Opus scaled by its price.
  // These are the costs Claude Code reports, which --max-cost-usd counts. Claude Code 2.1.238 reports Haiku 5.5 at
  // about twice Sonnet 5.5 ($1.60 a skill task, 2026-11-09): it prices both above their list prices.
  const perModel = /haiku/.test(model) ? 2 : /opus/.test(model) ? 1.67 : 1;
  const [task, canvas] = skillSuite ? [0.8, 1.12] : [0.43, 0.6];
  const estimate = (skillSuite ? 0.75 * perModel : 0) + jobs.reduce((sum, [kit, brief]) => sum + (brief === "launch" ? canvas : task) * (kit === "none" ? 1.5 : 1) * perModel, 0);
  for (const [kit, brief, rep] of jobs) console.log(`${kit} ${brief} #${rep}`);
  console.log(`${jobs.length} runs (${suiteName}), model ${model}: about $${estimate.toFixed(0)} (an estimate; the N/A tasks are known after the preflight).`);
  process.exit(0);
}

// The planned matrix, before any job starts, so a partial report knows which cells it's missing.
// A resumed batch keeps its plan, adding when it resumed, the stops it resumed from and its new cap, and its results
// file loses those stops' markers.
if (skillSuite && resuming) {
  const resumes = [...(plan.resumes ?? []), { at: new Date().toISOString(), after: before.stops, rows: before.rows.length, maxCostUsd: Number.isFinite(maxCost) ? maxCost : null }];
  await writeFile(planFile, JSON.stringify({ ...plan, maxCostUsd: Number.isFinite(maxCost) ? maxCost : null, resumes }, null, 2) + "\n");
  await writeFile(resultsFile, before.text);
  console.log(`Resuming ${stamp}: ${before.rows.length} rows ($${before.spentUsd.toFixed(2)}), ${jobs.length} runs left.`);
} else if (skillSuite) {
  await writeFile(planFile, JSON.stringify({
    stamp, suite: suiteName, model, kits, briefs, reps, startedAt: new Date(batchClock).toISOString(), maxCostUsd: Number.isFinite(maxCost) ? maxCost : null, na, jobs: jobs.map(([kit, brief, rep]) => ({ kit, brief, rep })),
  }, null, 2) + "\n");
}
console.log(`${jobs.length} runs (${suiteName}), ${concurrency} at a time, model ${model}. Results: ${resultsFile}`);
let next = 0, spent = before?.spentUsd ?? 0, stopped = false;
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (next < jobs.length) {
    // --max-cost-usd: once the finished rows' cost reaches it, no new job starts; running ones finish.
    if (spent >= maxCost) { stopped = true; break; }
    const job = jobs[next++];
    let row = null;
    for (let attempt = 0; attempt < (skillSuite ? 2 : 1) && !row; attempt++) {
      try { row = await one(...job); } catch (e) { console.error(`ERROR ${job.join(" ")}${skillSuite ? ` (attempt ${attempt + 1})` : ""}: ${e.message}`); }
    }
    // A job that threw twice is a harness error: counted, and left out.
    if (!row && skillSuite) {
      const [kit, brief, rep] = job;
      await appendFile(resultsFile, JSON.stringify({ stamp, suite: suiteName, kit, brief, rep, model, harnessError: "the job threw twice", pass: false, valid: false, costUsd: 0 }) + "\n");
    }
    spent += row?.costUsd ?? 0;
  }
}));
if (stopped) {
  await appendFile(resultsFile, JSON.stringify({ partial: true, reason: "cost", spentUsd: spent, maxCostUsd: maxCost }) + "\n");
  console.log(`Stopped at $${spent.toFixed(2)} of $${maxCost}: ${jobs.length - next} runs not started.`);
}
console.log("Done.", resultsFile);
