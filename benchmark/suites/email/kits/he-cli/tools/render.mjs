// Checks emails/email.tsx with the Hyper Elements CLI, then renders it to out/email.html (--base emails), and prints its problems.
//   npx hyper-elements check emails/email.tsx --rendered --json
//   npx hyper-elements render emails/email.tsx --json
// --json: also prints the problems as JSON, on the last line, as the `he` kit's render tool does.
//
// `check --rendered` gives render()'s diagnostics, with the email client checks where @hyper-elements/email-clients is
// installed (as the `he` kit's tool passes its plugin), so the harness reads the same set from both kits. The problems
// are printed as the CLI's own text output prints them: one in the template with the engine's formatDiagnostics(), and
// one of the CLI's own, at no path (`cli/…`), without a place (`info cli/not-a-template: …`, not `at :`).
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const run = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const json = process.argv.includes("--json");
const { formatDiagnostics } = createRequire(join(run, "package.json"))("@hyper-elements/react");

/** A diagnostic as the CLI prints it (packages/cli/src/format.ts). */
const format = (d) =>
  d.path
    ? formatDiagnostics([d])
    : `${d.severity} ${d.code}: ${d.message}${d.clients ? ` [${d.clients.join(", ")}]` : ""}${d.fix ? ` Fix: ${d.fix}` : ""}${d.see ? ` See: ${d.see}` : ""}`;

/** Ends the run: the problems printed (and, with --json, as the last line), exit 0 when nothing stops the email. */
function end(ok, diagnostics, message) {
  if (diagnostics.length) (ok ? console.log : console.error)(diagnostics.map(format).join("\n"));
  if (message) (ok ? console.log : console.error)(message);
  if (json) console.log(JSON.stringify({ ok, diagnostics }));
  process.exit(ok ? 0 : 1);
}

/** One CLI command on the email: its line for the template and its exit code. `--no`: never fetch the CLI from npm. */
function cli(command, ...flags) {
  const r = spawnSync("npx", ["--no", "hyper-elements", command, "emails/email.tsx", ...flags, "--json"], { cwd: run, encoding: "utf8", maxBuffer: 1 << 26 });
  const lines = (r.stdout ?? "").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } });
  const line = lines.find((l) => l?.file !== undefined);
  const summary = lines.find((l) => l?.summary);
  if (!line || !summary) end(false, [], `hyper-elements ${command} failed (exit ${r.status ?? r.signal}):\n${(r.stderr || r.stdout || r.error?.message || "").trim()}`);
  return { line, exitCode: summary.exitCode, stderr: r.stderr ?? "" };
}

const check = cli("check", "--rendered");
const problems = check.line.diagnostics ?? [];
// A template that didn't load, or whose default export isn't a template, is skipped or an error: it isn't rendered.
if (check.line.status !== "ok" || check.exitCode !== 0) {
  end(false, problems, check.line.error ?? (check.line.status === "skipped" ? "emails/email.tsx wasn't rendered: its default export must be a component that renders an <Email>." : check.stderr.trim()));
}
const render = cli("render", "--base", "emails");
if (render.line.status !== "ok" || render.exitCode !== 0) end(false, problems.length ? problems : (render.line.diagnostics ?? []), render.line.error ?? render.stderr.trim());
const html = render.line.outputs?.find((o) => o.endsWith(".html"));
if (html !== "out/email.html") end(false, problems, `hyper-elements render wrote ${render.line.outputs?.join(", ") || "nothing"}, not out/email.html.`);
end(true, problems, "Rendered out/email.html.");
