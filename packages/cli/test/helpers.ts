/**
 * The CLI's tests run the built CLI (dist/bin.js) as a child process, on the runtime CLI_RUNTIME names ("node", the
 * default, or "bun"), against projects written to the temporary folder whose node_modules link to this repository's
 * Elements, React and email-clients.
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
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
  // Windows doesn't remove a folder a process still has open (EBUSY) a moment after that process ends: tried again, for
  // up to 5 s (a killed dev's children take over 2 s on CI's runners to let theirs go).
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: WINDOWS ? 50 : 0, retryDelay: 100 });
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
  /** What the CLI reads on stdin (`-`); nothing where it's not given. */
  input?: string;
  /** The runtime's own arguments, before the CLI's (`--import`, `--preload`). */
  runtimeArgs?: string[];
}

/**
 * The environment the CLI runs in: this one's, without NODE_PATH, which pnpm sets for the test runner (to its store's
 * hoisted packages) and Bun reads for ES modules too: a project's resolution would find packages it doesn't have.
 */
export function cliEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, ...extra };
  if (!("NODE_PATH" in extra)) delete env.NODE_PATH;
  return env;
}

/** Runs the CLI in `cwd`. */
export function cli(cwd: string, args: string[], options: RunOptions = {}): Promise<Ran> {
  const runtime = options.runtime ?? RUNTIME;
  return new Promise((resolve, reject) => {
    const child = spawn(runtime === "bun" ? "bun" : process.execPath, [...(options.runtimeArgs ?? []), BIN, ...args], {
      cwd,
      env: cliEnv(options.env),
      stdio: [options.input === undefined ? "ignore" : "pipe", "pipe", "pipe"] as ["pipe", "pipe", "pipe"],
    });
    if (options.input !== undefined) child.stdin.end(options.input);
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

/** A project's modules with email-clients, for `check` and `preview`. */
export const WITH_CLIENTS = ["react", "react-dom", "@hyper-elements/react", "@hyper-elements/email-clients"];

/** No browser can be found: CHROME_PATH leads nowhere, Playwright's browsers folder is empty, and no channel is tried. */
export function noBrowserEnv(): Record<string, string> {
  const empty = mkdtempSync(join(tmpdir(), "hyper-elements-cli-no-browsers-"));
  made.push(empty);
  return { CHROME_PATH: join(empty, "no-such-chrome"), PLAYWRIGHT_BROWSERS_PATH: empty, HYPER_ELEMENTS_CLI_BROWSER_CHANNELS: "" };
}

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Whether a process is running. */
export function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** The processes `pid` started that are running: pgrep on macOS and Linux, the process table on Windows. */
export function childrenOf(pid: number): number[] {
  const out = WINDOWS
    ? spawnSync("powershell", ["-NoProfile", "-Command", `Get-CimInstance Win32_Process -Filter "ParentProcessId=${pid}" | ForEach-Object { $_.ProcessId }`], { encoding: "utf8", windowsHide: true }).stdout
    : spawnSync("pgrep", ["-P", String(pid)], { encoding: "utf8" }).stdout;
  return (out ?? "").split(/\s+/).filter(Boolean).map(Number);
}

/** Waits until `check` holds, up to `ms`. */
export async function until(check: () => boolean, ms = 10_000): Promise<boolean> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (check()) return true;
    await wait(25);
  }
  return check();
}

/** The CLI's fixtures: Inter (SIL OFL, its licence beside it), PNG images, and Documents and Canvases that use them. */
export const FIXTURES = join(CLI_ROOT, "test", "fixtures");

/** A fixture file's bytes. */
export const fixture = (path: string) => readFileSync(join(FIXTURES, path));

/** Copies the fixtures' fonts and images into `dir` (as `fonts/` and `images/`, or under `into`). */
export function withFixtures(dir: string, into = ""): string {
  for (const sub of ["fonts", "images"]) cpSync(join(FIXTURES, sub), join(dir, into, sub), { recursive: true });
  return dir;
}

/**
 * A copy of this repository's built Elements as a project's own `node_modules/@hyper-elements/react` (a folder, not a
 * link), so it resolves its peers (React, the PDF and image engines) from the project: only those the project links.
 * With `templateAssets: false`, its `/pdf` and `/image` are those of an Elements from before templateAssets().
 */
export function copyElements(dir: string, options: { templateAssets?: boolean } = {}): void {
  const from = join(REPO, "packages", "react");
  const to = join(dir, "node_modules", "@hyper-elements", "react");
  mkdirSync(join(to, "dist"), { recursive: true });
  cpSync(join(from, "package.json"), join(to, "package.json"));
  for (const name of readdirSync(join(from, "dist"))) {
    if (!name.endsWith(".js")) continue;
    let text = readFileSync(join(from, "dist", name), "utf8");
    if (options.templateAssets === false && (name === "pdf.js" || name === "image.js")) {
      text = text
        .replace(/export \{([^}]*)\};\s*$/, (_, names: string) => `export {${names.split(",").filter((n) => n.trim() !== "templateAssets").join(",")} };\n`)
        .replaceAll("templateAssets", "listedAssets");
    }
    writeFileSync(join(to, "dist", name), text);
  }
}

/** The PDF and image engines this repository's Elements has, for a project to link (`modules`). */
export const ENGINES: Record<string, string> = {
  "@react-pdf/renderer": join(REPO, "packages", "react", "node_modules", "@react-pdf", "renderer"),
  satori: join(REPO, "packages", "react", "node_modules", "satori"),
  "@resvg/resvg-js": join(REPO, "packages", "react", "node_modules", "@resvg", "resvg-js"),
};

export interface Server {
  /** Its origin, `http://127.0.0.1:<port>`. */
  url: string;
  /** Requests by path. */
  hits: Map<string, number>;
  close(): Promise<void>;
}

/** A local HTTP server: each path's handler (`*` for any other), or 404. */
export async function serve(routes: Record<string, (req: IncomingMessage, res: ServerResponse) => void>): Promise<Server> {
  const hits = new Map<string, number>();
  const server = createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0];
    hits.set(path, (hits.get(path) ?? 0) + 1);
    const route = routes[path] ?? routes["*"];
    if (route) return route(req, res);
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    hits,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

/** A handler answering with a file's bytes. */
export const answer =
  (bytes: Buffer | string, type = "application/octet-stream") =>
  (_req: IncomingMessage, res: ServerResponse) => {
    res.writeHead(200, { "content-type": type, "content-length": Buffer.byteLength(bytes) });
    res.end(bytes);
  };

/** A Canvas template (300 by 150, its text in Inter) with these fonts (a TSX expression) and children. */
export function canvas(fonts: string, children = "<Text>Card</Text>", imports = ""): string {
  return `import { Canvas, Image, Text } from "@hyper-elements/react";
${imports}
export default function Card() {
  return <Canvas width={300} height={150} fonts={${fonts}} style={{ fontFamily: "Inter", padding: 16, gap: 8 }}>${children}</Canvas>;
}
`;
}

/** A Document template (its text in Inter) with these fonts and children. */
export function documentTemplate(fonts: string, children = "<Text>Invoice</Text>", imports = ""): string {
  return `import { Document, Image, Text } from "@hyper-elements/react";
${imports}
export default function Invoice() {
  return <Document fonts={${fonts}} style={{ fontFamily: "Inter, sans-serif" }}>${children}</Document>;
}
`;
}

/** The width and height a PNG says it is. */
export function pngSize(bytes: Buffer): { width: number; height: number } {
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/** `dev`, running: its URL, what it has said, and how to read what it serves. */
export interface Dev {
  /** `http://127.0.0.1:<port>/<prefix>/`. */
  base: string;
  port: number;
  prefix: string;
  child: ChildProcess;
  stdout(): string;
  stderr(): string;
  /** The state the page reads. */
  state(): Promise<any>;
  /** A file it serves, by its URL relative to the page, as text. */
  text(url: string): Promise<string>;
  /** Resolves with its exit code once it has exited. */
  exited: Promise<number | null>;
}

const devs: ChildProcess[] = [];
// (Before the folders are removed: Vitest runs afterEach hooks last registered first.)
afterEach(async () => {
  await Promise.all(devs.splice(0).map((child) => endTree(child)));
});

/**
 * Ends `child` and every process it started, and resolves once it has exited. On Windows, ending a process leaves its
 * children running (holding the project folder open), so its tree is ended with taskkill.
 */
export async function endTree(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const closed = new Promise<void>((resolve) => child.once("close", () => resolve()));
  if (WINDOWS && child.pid) spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  else child.kill("SIGKILL");
  await Promise.race([closed, new Promise((resolve) => setTimeout(resolve, 10_000))]);
}

/** Starts `hyper-elements dev` in `cwd` and waits for its URL and its first render. */
export async function startDev(cwd: string, args: string[], options: { runtime?: "node" | "bun"; env?: Record<string, string> } = {}): Promise<Dev> {
  const runtime = options.runtime ?? RUNTIME;
  const child = spawn(runtime === "bun" ? "bun" : process.execPath, [BIN, "dev", ...args], { cwd, env: cliEnv(options.env), stdio: ["ignore", "pipe", "pipe"] });
  devs.push(child);
  let out = "";
  let err = "";
  child.stdout.on("data", (d) => (out += d));
  child.stderr.on("data", (d) => (err += d));
  const exited = new Promise<number | null>((resolve) => child.on("close", (code) => resolve(code)));
  await until(() => / until Ctrl-C\n/.test(out) || child.exitCode !== null, 30_000);
  const match = /(http:\/\/127\.0\.0\.1:(\d+)\/([0-9a-f]{32})\/)/.exec(out);
  if (!match) throw new Error(`dev printed no URL:\n${out}\n${err}`);
  const base = match[1];
  const dev: Dev = {
    base,
    port: Number(match[2]),
    prefix: match[3],
    child,
    stdout: () => out,
    stderr: () => err,
    state: async () => (await fetch(`${base}state.json`)).json(),
    text: async (url) => (await fetch(base + url)).text(),
    exited,
  };
  if (!(await until(() => /Rendered \d+ templates?|✗ /.test(err), 30_000))) throw new Error(`dev didn't render:\n${out}\n${err}`);
  return dev;
}

/**
 * Waits until what `dev` serves for `file` (its plain text, or its error) satisfies `check`, reading its state as
 * often as it can; resolves with the state then, or throws with the last one.
 */
export async function devUntil(dev: Dev, check: (template: any, text: string) => boolean, file: string, ms = 15_000): Promise<any> {
  const end = Date.now() + ms;
  let last: any;
  while (Date.now() < end) {
    try {
      last = await dev.state();
      const template = last.templates?.find((t: any) => t.file === file);
      if (template) {
        const text = template.files?.txt ? await dev.text(template.files.txt) : "";
        if (check(template, text)) return last;
      }
    } catch {
      // A render in between: the next read.
    }
    await wait(20);
  }
  throw new Error(`dev never showed what was expected for ${file}: ${JSON.stringify(last)}\n${dev.stderr()}`);
}
