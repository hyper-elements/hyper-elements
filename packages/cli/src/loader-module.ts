/**
 * The loader module written beside each template, so the CLI loads Elements, React and email-clients as the template
 * does: from the same folder, with the same tsconfig, module type and resolver, on Node and on Bun.
 *
 *   // hyper-elements-cli <owner token>
 *   import * as template from "file:///…/emails/welcome.tsx";
 *   export { template };
 *   export const load = (specifier: string) => import(specifier);
 *
 * Its name is `.hyper-elements-<pid>-<n>.<ext>` (the CLI's, never the template's), written with `wx` (never over a
 * file) and deleted as soon as its import settles. Every file the CLI writes starts with an owner token naming the
 * host, the process and its start time: a later run deletes a file left behind (a run killed with SIGKILL) only if
 * the token names this host and a process that isn't running any more.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, openSync, readSync, closeSync, rmSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { join, extname } from "node:path";
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";

/** What every file the CLI writes starts with, after the comment marker. */
export const TOKEN_PREFIX = "hyper-elements-cli";
/** A loader module's name. */
export const LOADER_NAME = /^\.hyper-elements-(\d+)-(\d+)\.(tsx|ts|jsx|js|mts|mjs|cts|cjs)$/;
/** A group's tsconfig's name, in the temporary folder. */
export const TSCONFIG_NAME = /^hyper-elements-cli-tsconfig-(\d+)-(\d+)\.json$/;

export interface Owner {
  host: string;
  pid: number;
  /** When the process started, as the system says ("-" where it can't be read). */
  start: string;
  random: string;
}

export function formatToken(owner: Owner): string {
  return `${TOKEN_PREFIX} ${owner.host} ${owner.pid} ${owner.start} ${owner.random}`;
}

export function parseToken(line: string): Owner | undefined {
  const match = /^\/\/ hyper-elements-cli (\S+) (\d+) (\S+) (\S+)\s*$/.exec(line);
  if (!match) return undefined;
  return { host: match[1], pid: Number(match[2]), start: match[3], random: match[4] };
}

/** This host's name, as tokens carry it (one word). */
export function hostName(): string {
  return encodeURIComponent(hostname()) || "-";
}

/** The owner token for files this process writes. */
export function ownToken(): string {
  return formatToken({ host: hostName(), pid: process.pid, start: startTime(process.pid) ?? "-", random: randomBytes(8).toString("hex") });
}

/** Whether a process with this id is running (one we may not signal still is). */
export function running(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * When a process started, as a string that's the same each time it's read for the same process, and differs for a
 * later one with its id: its start in clock ticks since boot on Linux, `ps`'s start time on macOS and the BSDs.
 * Undefined where it can't be read (Windows, or the process is gone).
 */
export function startTime(pid: number): string | undefined {
  if (process.platform === "win32") return undefined;
  if (process.platform === "linux") {
    try {
      const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
      // The command name (field 2) is in parentheses and may hold spaces: count from after it.
      const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
      return fields[19];
    } catch {
      return undefined;
    }
  }
  try {
    const out = execFileSync("ps", ["-o", "lstart=", "-p", String(pid)], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], env: { ...process.env, LC_ALL: "C", TZ: "UTC" } }).trim();
    return out ? out.replace(/\s+/g, "_") : undefined;
  } catch {
    return undefined;
  }
}

/** A file's first line, or undefined where it can't be read. */
export function firstLine(path: string): string | undefined {
  let fd: number | undefined;
  try {
    fd = openSync(path, "r");
    const buffer = Buffer.alloc(256);
    const read = readSync(fd, buffer, 0, buffer.length, 0);
    return buffer.subarray(0, read).toString("utf8").split(/\r?\n/)[0];
  } catch {
    return undefined;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/**
 * Whether a file left behind may be deleted: its token names this host and a process that isn't running with the
 * start time it names. A file without a token, or another host's, is never deleted; nor one of a running process
 * whose start time can't be compared.
 */
export function stale(owner: Owner | undefined, host = hostName(), isRunning = running, started = startTime): boolean {
  if (!owner || owner.host !== host) return false;
  if (!isRunning(owner.pid)) return true;
  if (owner.start === "-") return false;
  const now = started(owner.pid);
  return now !== undefined && now !== owner.start;
}

export interface CleanupProblem {
  file: string;
  folder: string;
  message: string;
}

/**
 * Deletes the files a CLI run left in `folders` (loader modules) and in the temporary folder (tsconfigs): those
 * `select` picks by their token. Returns the ones it couldn't delete.
 */
export function cleanFiles(folders: Iterable<string>, select: (owner: Owner | undefined) => boolean, remove: (path: string) => void = (path) => rmSync(path)): CleanupProblem[] {
  const problems: CleanupProblem[] = [];
  const sweep = (folder: string, name: RegExp) => {
    let entries: string[];
    try {
      entries = readdirSync(folder);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!name.test(entry)) continue;
      const file = join(folder, entry);
      if (!select(parseToken(firstLine(file) ?? ""))) continue;
      try {
        remove(file);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") problems.push({ file, folder, message: (error as Error).message.split("\n")[0] });
      }
    }
  };
  for (const folder of new Set(folders)) sweep(folder, LOADER_NAME);
  sweep(tmpdir(), TSCONFIG_NAME);
  return problems;
}

/** The text of a loader module for `template`. */
export function loaderModuleText(template: string, token: string, format: "esm" | "cjs", bun: boolean): string {
  // A CommonJS module on Node requires: tsx compiles its imports to require, and import() would pick the other build.
  const cjs = format === "cjs" && !bun;
  // The exact file (no other extension can be picked instead), as a JSON string: quotes, backslashes and line breaks
  // stay a string. A file URL escapes `#`, `%` and spaces.
  const specifier = JSON.stringify(cjs ? template : pathToFileURL(template).href);
  const ts = /\.[cm]?tsx?$/.test(template);
  const type = ts ? ": string" : "";
  if (template.endsWith(".cjs")) {
    // A .cjs file is CommonJS as written: no import statements in it. Its exports are its default, as an import of
    // it would have them.
    return [
      `// ${token}`,
      `module.exports.template = { default: require(${JSON.stringify(template)}) };`,
      bun ? `module.exports.load = (specifier) => import(specifier);` : `module.exports.load = (specifier) => require(specifier);`,
      `module.exports.resolve = (specifier) => require.resolve(specifier);`,
      "",
    ].join("\n");
  }
  return [
    `// ${token}`,
    `import * as template from ${specifier};`,
    `export { template };`,
    cjs ? `export const load = (specifier${type}) => require(specifier);` : `export const load = (specifier${type}) => import(specifier);`,
    cjs ? `export const resolve = (specifier${type}) => require.resolve(specifier);` : `export const resolve = (specifier${type}) => import.meta.resolve(specifier);`,
    "",
  ].join("\n");
}

/**
 * The text of a loader module that loads no template, for `describe`: Elements as a TypeScript module in that folder
 * would load it. It's a `.ts` file: tsx compiles it as its package's type says (`require` in a CommonJS package).
 */
export function elementsLoaderText(token: string, format: "esm" | "cjs", bun: boolean): string {
  const cjs = format === "cjs" && !bun;
  return [
    `// ${token}`,
    `export const template = {};`,
    cjs ? `export const load = (specifier: string) => require(specifier);` : `export const load = (specifier: string) => import(specifier);`,
    cjs ? `export const resolve = (specifier: string) => require.resolve(specifier);` : `export const resolve = (specifier: string) => import.meta.resolve(specifier);`,
    "",
  ].join("\n");
}

/** A loader module's name for a template, beside it. */
export function loaderModulePath(folder: string, template: string, pid: number, n: number): string {
  return join(folder, `.hyper-elements-${pid}-${n}${extname(template)}`);
}
