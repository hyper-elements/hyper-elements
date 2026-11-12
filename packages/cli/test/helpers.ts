/**
 * The CLI's tests run the built CLI (dist/bin.js) as a child process, on the runtime CLI_RUNTIME names ("node", the
 * default, or "bun"), against projects written to the temporary folder whose node_modules link to this repository's
 * Elements, React and email-clients.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach } from "vitest";

export const CLI_ROOT = fileURLToPath(new URL("..", import.meta.url));
export const BIN = join(CLI_ROOT, "dist", "bin.js");
export const REPO = join(CLI_ROOT, "..", "..");
export const RUNTIME = process.env.CLI_RUNTIME === "bun" ? "bun" : "node";
export const ON_BUN = RUNTIME === "bun";
export const WINDOWS = process.platform === "win32";

/** The packages a project can link to, from this package's own node_modules. */
export const MODULES: Record<string, string> = {
  react: join(CLI_ROOT, "node_modules", "react"),
  "react-dom": join(CLI_ROOT, "node_modules", "react-dom"),
  react19: join(CLI_ROOT, "node_modules", "react19"),
  "react-dom19": join(CLI_ROOT, "node_modules", "react-dom19"),
  "@hyper-elements/react": join(REPO, "packages", "react"),
  "@hyper-elements/email-clients": join(REPO, "packages", "email-clients"),
};

const made: string[] = [];
afterEach(() => {
  // (A test that makes a folder read-only makes it writable again itself. rmSync removes links, not what they lead to.)
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Links `node_modules/<name>` in `folder` to `target` (a folder). */
export function link(folder: string, name: string, target: string): void {
  const path = join(folder, "node_modules", name);
  mkdirSync(dirname(path), { recursive: true });
  symlinkSync(realpathSync(target), path, WINDOWS ? "junction" : "dir");
}

export interface ProjectOptions {
  /** `node_modules` links: by default React, React DOM and Elements. A name maps to a package or a folder. */
  modules?: Record<string, string> | string[];
  /** The project's package.json (by default `{ "name": "fixture", "type": "module" }`); null for none. */
  packageJson?: Record<string, unknown> | null;
}

/** A project in the temporary folder, its files written. Returns its folder (a real path). */
export function project(files: Record<string, string>, options: ProjectOptions = {}): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "hyper-elements-cli-test-")));
  made.push(dir);
  const pkg = options.packageJson === undefined ? { name: "fixture", private: true, type: "module" } : options.packageJson;
  if (pkg) writeFileSync(join(dir, "package.json"), JSON.stringify(pkg, null, 2));
  const modules = options.modules ?? ["react", "react-dom", "@hyper-elements/react"];
  const entries: Array<[string, string]> = Array.isArray(modules) ? modules.map((name) => [name, MODULES[name]]) : Object.entries(modules).map(([name, target]) => [name, MODULES[target] ?? target]);
  for (const [name, target] of entries) link(dir, name, target);
  write(dir, files);
  return dir;
}

export function write(dir: string, files: Record<string, string>): void {
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), text);
  }
}

export interface Ran {
  code: number | null;
  signal: NodeJS.Signals | null;
  /** The CLI's process id. */
  pid: number;
  stdout: string;
  stderr: string;
}

export interface RunOptions {
  env?: Record<string, string>;
  /** Called once the process has started. */
  started?: (child: ChildProcess) => void;
  runtime?: "node" | "bun";
  timeout?: number;
  /** Reads nothing from stdout for this long (milliseconds): a slow pipe, which the CLI's writes wait on. */
  slowStdout?: number;
}

/**
 * The environment the CLI runs in: this one's, without NODE_PATH, which pnpm sets for the test runner (to its store's
 * hoisted packages) and Bun reads for ES modules too: a project's resolution would find packages it doesn't have.
 */
export function cliEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, ...extra };
  delete env.NODE_PATH;
  return env;
}

/** Runs the CLI in `cwd`. */
export function cli(cwd: string, args: string[], options: RunOptions = {}): Promise<Ran> {
  const runtime = options.runtime ?? RUNTIME;
  return new Promise((resolve, reject) => {
    const child = spawn(runtime === "bun" ? "bun" : process.execPath, [BIN, ...args], { cwd, env: cliEnv(options.env), stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    if (options.slowStdout) {
      child.stdout.pause();
      setTimeout(() => child.stdout.resume(), options.slowStdout);
    }
    child.stderr.on("data", (d) => (stderr += d));
    const timer = setTimeout(() => child.kill("SIGKILL"), options.timeout ?? 50_000);
    child.on("error", reject);
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, pid: child.pid!, stdout, stderr });
    });
    options.started?.(child);
  });
}

/** The `--json` lines of a run. */
export function lines(ran: Ran): any[] {
  return ran.stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

/** The files the CLI leaves only while it runs: loader modules beside templates. */
export function leftovers(dir: string): string[] {
  const found: string[] = [];
  const visit = (folder: string) => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      // Not into node_modules, nor through links (they lead out of the project).
      if (entry.isSymbolicLink() || entry.name === "node_modules") continue;
      if (entry.isDirectory()) visit(join(folder, entry.name));
      else if (/^\.hyper-elements-\d+-\d+\./.test(entry.name)) found.push(join(folder, entry.name));
    }
  };
  visit(dir);
  return found;
}

/** The CLI's tsconfigs in the temporary folder, for a process id. */
export function tsconfigsOf(pid: number): string[] {
  return readdirSync(tmpdir()).filter((name) => name.startsWith(`hyper-elements-cli-tsconfig-${pid}-`));
}

export const exists = existsSync;

/** A simple Email template. */
export function email(text = "Hello", extra = ""): string {
  return `import { Email, Text } from "@hyper-elements/react";
${extra}
export default function Template() {
  return <Email><Text>${text}</Text></Email>;
}
`;
}

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Waits until `check` holds, up to `ms`. */
export async function until(check: () => boolean, ms = 10_000): Promise<boolean> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (check()) return true;
    await wait(25);
  }
  return check();
}
