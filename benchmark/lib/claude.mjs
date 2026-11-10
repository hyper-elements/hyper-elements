// How the harness starts Claude Code (headless) in a run directory: the arguments every session gets, the paths it's
// denied, and the transcript's events.
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { dirname } from "node:path";

/** The tools every session may use without asking. A brief's `run.allowedTools` adds to these, never replaces them. */
export const ALLOWED = ["Read", "Write", "Edit", "Glob", "Grep", "Bash(node:*)", "Bash(npx tsc:*)", "Bash(ls:*)", "Bash(cat:*)"];
/**
 * The tools no session may use. The skill suite also takes away MultiEdit and NotebookEdit: --allowedTools grants
 * permissions, it doesn't limit the tools there are, and the replay reads only Write and Edit. A kit with `allowSkill`
 * keeps the Skill tool.
 */
export function disallowedOf({ allowSkill = false, skillSuite = false } = {}) {
  return ["WebFetch", "WebSearch", "Agent", "Task", ...(allowSkill ? [] : ["Skill"]), ...(skillSuite ? ["MultiEdit", "NotebookEdit"] : [])];
}

/** The repository, the home folder (Claude Code's own session logs are there) and /tmp. */
export function deniedPaths(cwd) {
  const repoRoot = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd, encoding: "utf8" }).trim().replace(/\/\.git$/, "");
  return [...new Set([repoRoot, homedir(), "/Users", "/home", "/tmp", "/private/tmp"])];
}

/**
 * A session's settings: Claude Code's file tools denied the paths above. With `sandbox` (the skill suite), Bash also
 * runs in Claude Code's OS-level sandbox: writes only in the run, no reads of the denied paths or, on Linux, of /proc
 * (where a process's environment shows), no network, no retry outside the sandbox, and no session at all where the
 * sandbox isn't available. `allowRead` is what a command needs from the denied paths: node's own install.
 *
 * The run root itself isn't denied: a command must read its run's parent folders (node resolves its script's real
 * path through them, and a denied one stops node at startup), and a sandbox rule denies a folder with everything in
 * it. So a sandboxed command can read another run in progress; the audit catches one that names it.
 *
 * `guarded` (the run's tools, docs, engine…) is denied to the file tools' edits, which the sandbox also takes as its
 * own write rules: nothing in the session can change the checker or the render tool. Nothing runs outside the
 * sandbox: Claude Code's `excludedCommands` would take a whole command out of it when any step matched
 * (`node tools/render.mjs && node tools/check.mjs` runs the agent's template unsandboxed), so the checker's Chromium
 * runs single-process instead (`sessionEnv`), which works in the sandbox.
 */
export function settingsOf(denied, sandbox = null, platform = process.platform) {
  // Permission rules are merged into the sandbox's: with it, /tmp isn't denied, or Claude Code's Bash tool can't write
  // each call's working directory to /tmp/claude-<uid>. The audit still invalidates a run whose tools read there.
  const paths = sandbox ? denied.filter((p) => !["/tmp", "/private/tmp"].includes(p)) : denied;
  const settings = { permissions: { deny: paths.flatMap((p) => [`Read(/${p}/**)`, `Edit(/${p}/**)`]) } };
  if (sandbox) {
    for (const g of sandbox.guarded ?? []) settings.permissions.deny.push(`Edit(/${sandbox.runDir}/${g})`, `Edit(/${sandbox.runDir}/${g}/**)`);
    settings.sandbox = {
      enabled: true,
      autoAllowBashIfSandboxed: true,
      allowUnsandboxedCommands: false,
      failIfUnavailable: true,
      network: { allowedDomains: [] },
      filesystem: {
        allowWrite: [sandbox.runDir],
        denyWrite: (sandbox.guarded ?? []).map((g) => `${sandbox.runDir}/${g}`),
        denyRead: [...paths, ...(platform === "linux" ? ["/proc"] : [])],
        allowRead: [sandbox.runDir, ...(sandbox.allowRead ?? [])],
      },
    };
  }
  return JSON.stringify(settings);
}

/** What node itself needs to be read from: its install folder (bin/node's parent's parent). */
export const nodeHome = () => dirname(dirname(process.execPath));

/**
 * What the agent is told not to change, relative to the run: denied to its edits, and hashed before and after the
 * session (a change is `tampered`). Not out/ or .cache/, which the render tools write.
 */
export const GUARDED = ["tools", "docs", "fonts", "assets", "images", ".claude", "node_modules", "CLAUDE.md", "BRIEF.md", "tsconfig.json", "package.json"];

/** A skill suite session's sandbox: its run, node's install and the browsers readable; the guarded files not writable. */
export const sandboxOf = ({ runDir, runRoot, browsers }) => ({ runDir, runRoot, allowRead: [dirname(nodeHome()), browsers], guarded: GUARDED });

/**
 * The environment of a session and of every render, check and type-check the harness runs for it: the same in the
 * session's sandbox, the replay and the grading pass. TZ and LANG fixed, Playwright's browsers at the run root, and the
 * checkers' Chromium single-process: on macOS its other processes need a Mach service Claude Code's sandbox refuses.
 */
export function sessionEnv(base, { browsers, tmp }) {
  // Node's system certificates: on macOS, reading them in the sandbox prints "ERROR: failed to copy trust settings"
  // on every node start, which agents then filter with a pipe (the replay's cutoff). Sessions have no network.
  const { NODE_USE_SYSTEM_CA, ...rest } = base;
  const options = (rest.NODE_OPTIONS ?? "").split(/\s+/).filter((o) => o && o !== "--use-system-ca").join(" ");
  return {
    ...rest, ...(rest.NODE_OPTIONS !== undefined ? { NODE_OPTIONS: options } : {}),
    TZ: "UTC", LANG: "C.UTF-8", LC_ALL: "C.UTF-8", PLAYWRIGHT_BROWSERS_PATH: browsers, BENCH_CHROMIUM_ARGS: "--single-process",
    // A temporary folder in the run (Chromium's profile is made there), which the sandbox lets a session write.
    ...(tmp ? { TMPDIR: tmp } : {}),
  };
}

export function claudeArgs({ prompt, model, settings, allowedTools = [], allowSkill = false, skillSuite = false, maxTurns }) {
  return [
    "-p", prompt,
    "--model", model,
    "--output-format", "stream-json", "--verbose",
    "--no-session-persistence",
    "--setting-sources", "project",
    "--permission-mode", "acceptEdits",
    ...(maxTurns ? ["--max-turns", String(maxTurns)] : []),
    "--allowedTools", ...ALLOWED, ...(allowSkill ? ["Skill"] : []), ...allowedTools.filter((t) => !ALLOWED.includes(t)),
    "--disallowedTools", ...disallowedOf({ allowSkill, skillSuite }),
    "--settings", settings,
  ];
}

/** A transcript's events (stream-json, one a line), skipping lines that aren't JSON. */
export const eventsOf = (text) => text.split("\n").filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });

/** The skills a session loaded, from its `system` init event: null when there's no init event. */
export function skillsOf(events) {
  const init = events.find((e) => e.type === "system" && e.subtype === "init");
  if (!init) return null;
  return (init.skills ?? []).map((s) => (typeof s === "string" ? s : s.name));
}
