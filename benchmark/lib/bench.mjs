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
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { arch, homedir, platform, release, tmpdir } from "node:os";
import { getEncoding } from "js-tiktoken";
import { applyChanges, briefsOf, kitOf, makeRun, suiteOf } from "./make-run.mjs";
import { outsideAccess } from "./audit.mjs";

const bench = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
};
const suiteName = arg("suite", "email");
const suite = await suiteOf(suiteName);
const kits = arg("kits", { email: "he,react-email,mjml,html", image: "he,playwright,canvas", multi: "he,stack" }[suiteName]).split(",");
const briefs = arg("briefs", "all") === "all" ? await briefsOf(suiteName) : arg("briefs").split(",");
const reps = Number(arg("reps", "1"));
const model = arg("model", "sonnet");
const concurrency = Number(arg("concurrency", "3"));
const timeoutMin = Number(arg("timeout", "20"));
const stamp = arg("stamp", new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19));
const runsDir = join(bench, "runs", stamp);
const resultsFile = join(bench, "results", `${stamp}-${suiteName}-${model}.jsonl`);
await mkdir(dirname(resultsFile), { recursive: true });

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
// the repository, the home folder (Claude Code's own session logs are there) and /tmp. What a rule can't stop (node
// reading a file) the audit below catches: a run that reached outside its directory is kept but marked invalid.
const repoRoot = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: bench, encoding: "utf8" }).trim().replace(/\/\.git$/, "");
const denied = [...new Set([repoRoot, homedir(), "/Users", "/home", "/tmp", "/private/tmp"])];
const settings = JSON.stringify({ permissions: { deny: denied.flatMap((p) => [`Read(/${p}/**)`, `Edit(/${p}/**)`]) } });


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
async function session(dir, prompt, transcript) {
  const t0 = Date.now();
  const r = await sh(
    "claude",
    [
      "-p", prompt,
      "--model", model,
      "--output-format", "stream-json", "--verbose",
      "--no-session-persistence",
      "--setting-sources", "project",
      "--permission-mode", "acceptEdits",
      "--allowedTools", "Read", "Write", "Edit", "Glob", "Grep", "Bash(node:*)", "Bash(npx tsc:*)", "Bash(ls:*)", "Bash(cat:*)",
      "--disallowedTools", "WebFetch", "WebSearch", "Agent", "Task", "Skill",
      "--settings", settings,
    ],
    { cwd: dir, timeout: timeoutMin * 60_000, env: { ...process.env } },
  );
  const wall = Date.now() - t0;
  await writeFile(join(dir, transcript), r.out);
  if (r.err) await writeFile(join(dir, transcript.replace(/\.jsonl$/, ".stderr.txt").replace(/^transcript\./, "")), r.err);

  const events = r.out.split("\n").filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
  const final = events.findLast((e) => e.type === "result") ?? {};
  // Every tool call the agent made, and how the first check went.
  const commands = events.flatMap((e) => (e.type === "assistant" ? e.message.content : []))
    .filter((c) => c.type === "tool_use").map((c) => ({ id: c.id, name: c.name, input: c.input ?? {}, cmd: c.input?.command ?? "", file: c.input?.file_path ?? "" }));
  const toolResults = new Map(events.flatMap((e) => (e.type === "user" && Array.isArray(e.message?.content) ? e.message.content : []))
    .filter((c) => c.type === "tool_result").map((c) => [c.tool_use_id, c]));
  const checks = commands.filter((c) => c.name === "Bash" && runs(c.cmd, "tools/check.mjs"));
  const firstCheck = checks[0] ? toolResults.get(checks[0].id) : null;
  const firstCheckPassed = firstCheck ? !firstCheck.is_error && /All \d+ checks passed/.test(JSON.stringify(firstCheck.content)) : null;
  const renders = commands.filter((c) => c.name === "Bash" && runs(c.cmd, suite.render));
  const renderErrors = renders.filter((c) => toolResults.get(c.id)?.is_error).length;

  const verdict = await sh("node", ["tools/check.mjs", "--json"], { cwd: dir, timeout: 180_000 });
  let check = {};
  try { check = JSON.parse(verdict.out.trim().split("\n").pop()); } catch { check = { pass: false, error: verdict.err.slice(0, 400) }; }

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
    modelUsage: final.modelUsage,
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
  const dir = await makeRun(suiteName, kit, brief, rep, mkdtempSync(join(tmpdir(), "run-")), { isolated: true });
  const { sources, diagnostics } = await kitOf(suiteName, kit);
  const build = await session(dir, suite.prompt, "transcript.jsonl");
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
  row.valid = !row.outside.some((o) => o.got && !o.own);
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

// Interleave the kits so a slow patch of the API doesn't land on one of them.
const jobs = [];
for (let rep = 0; rep < reps; rep++) for (const brief of briefs) for (const kit of kits) jobs.push([kit, brief, rep]);
console.log(`${jobs.length} runs (${suiteName}), ${concurrency} at a time, model ${model}. Results: ${resultsFile}`);
let next = 0;
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (next < jobs.length) {
    const job = jobs[next++];
    try { await one(...job); } catch (e) { console.error(`ERROR ${job.join(" ")}: ${e.message}`); }
  }
}));
console.log("Done.", resultsFile);
