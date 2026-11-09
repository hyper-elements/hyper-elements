// The skill suite's checker: runs each check the brief's spec names, and passes when every one passes.
//
//   node tools/check.mjs            prints PASS/FAIL per check, exits 1 on any failure
//   node tools/check.mjs --json     machine-readable, for the harness
//
// A check's spec is tools/checks/<check>/spec.json, except the email checker's, tools/spec.json, which it reads as the
// email suite's does. A check that crashes (no JSON result) makes this crash too, so the harness counts the run as a
// harness error, not a task failure. It prints the harness's signed result line, `[check] pass …` or `[check] fail …`
// (bench-runtime.mjs), before the JSON or after the summary.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inputsHash, resultLine, takeSecret } from "./bench-runtime.mjs";

const secret = takeSecret();
const tools = dirname(fileURLToPath(import.meta.url));
const run = resolve(tools, "..");
const inputs = inputsHash(run);
const json = process.argv.includes("--json");
const CHECKERS = {
  email: "email-check.mjs",
  page: "check-page.mjs",
  styles: "check-styles.mjs",
  text: "check-text.mjs",
  pdf: "check-pdf.mjs",
  change: "check-change.mjs",
  open: "check-open.mjs",
  image: "image-check.mjs",
};

const named = [
  ...(existsSync(join(tools, "spec.json")) ? ["email"] : []),
  ...(existsSync(join(tools, "checks")) ? readdirSync(join(tools, "checks")).filter((c) => existsSync(join(tools, "checks", c, "spec.json"))) : []),
];
const unknown = named.filter((c) => !CHECKERS[c] || !existsSync(join(tools, CHECKERS[c])));
if (!named.length || unknown.length) {
  console.error(named.length ? `no checker for ${unknown.join(", ")}` : "no check is named: tools/spec.json and tools/checks/ are missing");
  process.exit(2);
}

const results = [];
for (const c of named) {
  // The image suite's checker reads its spec where BENCH_SPEC says.
  const env = { ...process.env, ...(c === "image" ? { BENCH_SPEC: join(tools, "checks/image/spec.json") } : {}) };
  const r = spawnSync(process.execPath, [join(tools, CHECKERS[c]), "--json"], { cwd: run, env, encoding: "utf8", timeout: 170_000, maxBuffer: 1 << 26 });
  let verdict;
  try { verdict = JSON.parse(r.stdout.trim().split("\n").pop()); } catch {}
  if (!verdict || !Array.isArray(verdict.results)) {
    console.error(`the ${c} check crashed:\n${(r.stderr || r.stdout || r.error?.message || "").slice(0, 2000)}`);
    process.exit(2);
  }
  for (const x of verdict.results) results.push({ ...x, name: `${c}: ${x.name}` });
}

const failed = results.filter((r) => !r.ok);
const line = resultLine(secret, "check", failed.length ? "fail" : "pass", inputs);
if (json) {
  console.log(line);
  console.log(JSON.stringify({ pass: failed.length === 0, total: results.length, failed: failed.length, results }));
} else {
  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.ok ? "" : ` — ${r.detail}`}`);
  console.log(failed.length ? `\n${failed.length} of ${results.length} checks failed.` : `\nAll ${results.length} checks passed.`);
  console.log(line);
}
process.exit(failed.length ? 1 : 0);
