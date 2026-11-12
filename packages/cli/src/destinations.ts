/**
 * Where `render` writes, worked out before anything runs. Each output goes under `--out` at its input's path relative
 * to the inputs' base, named for the file. The CLI writes only the files it renders and never empties a folder; it
 * refuses an `--out` that is the filesystem root, the home folder, a project root or a folder holding an input, and
 * two outputs with one destination, compared by real path, Unicode-normalized and case-folded whatever the disk does.
 * Each file is written to a temporary file beside it and renamed over it, so an interrupted run leaves whole files.
 */
import { existsSync, mkdirSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { UsageError } from "./args";
import { displayPath, packageFolder, type Input } from "./inputs";

/** A path's real form: the real path of its nearest existing folder, and the rest as written. */
export function canonicalPath(path: string): string {
  const rest: string[] = [];
  let current = resolve(path);
  for (;;) {
    if (existsSync(current)) {
      let realPath: string;
      try {
        realPath = realpathSync.native(current);
      } catch {
        realPath = current;
      }
      return rest.length ? join(realPath, ...rest.reverse()) : realPath;
    }
    const parent = dirname(current);
    if (parent === current) return resolve(path);
    rest.push(basename(current));
    current = parent;
  }
}

/** How destinations are compared: NFC, lower case, each name without the trailing dots and spaces Windows drops. */
export function foldPath(path: string): string {
  return path
    .normalize("NFC")
    .toLowerCase()
    .split(/[\\/]/)
    .map((part, index) => (index === 0 ? part : part.replace(/[. ]+$/, "")))
    .join("/");
}

function inside(child: string, folder: string): boolean {
  const f = foldPath(folder);
  const c = foldPath(child);
  return c === f || c.startsWith(f.endsWith("/") ? f : `${f}/`);
}

export interface Planned {
  /** By input id: each output's destination, by extension. */
  byInput: Map<number, Record<string, string>>;
}

/** Checks `--out` and reserves every destination `extensions` could take, for every input. */
export function planDestinations(inputs: Input[], base: string, out: string, cwd: string, extensions: string[]): Planned {
  const target = canonicalPath(resolve(cwd, out));
  const said = displayPath(cwd, resolve(cwd, out));
  const refuse = (why: string) => {
    throw new UsageError(`--out ${said} is ${why}: the CLI won't write there. Give a folder of its own, such as out/.`);
  };
  if (dirname(target) === target) refuse("the filesystem root");
  if (foldPath(target) === foldPath(canonicalPath(homedir()))) refuse("your home folder");
  const projects = new Set<string>();
  for (const folder of [cwd, ...inputs.map((input) => dirname(input.file))]) {
    const project = packageFolder(folder);
    if (project) projects.add(canonicalPath(project));
  }
  for (const project of projects) if (foldPath(project) === foldPath(target)) refuse("a project's root (it holds a package.json)");
  for (const input of inputs) if (inside(input.real, target) || inside(canonicalPath(input.file), target)) refuse(`a folder holding an input (${input.display})`);

  const byInput = new Map<number, Record<string, string>>();
  const taken = new Map<string, Input>();
  const inputsByKey = new Map<string, Input>();
  for (const input of inputs) {
    inputsByKey.set(foldPath(input.real), input);
    inputsByKey.set(foldPath(canonicalPath(input.file)), input);
  }
  for (const input of inputs) {
    const folder = relative(base, dirname(input.file));
    const stem = basename(input.file, extname(input.file));
    const paths: Record<string, string> = {};
    for (const extension of extensions) {
      const path = join(resolve(cwd, out), folder, `${stem}.${extension}`);
      const key = foldPath(canonicalPath(path));
      const other = taken.get(key);
      if (other && other !== input) {
        throw new UsageError(`${other.display} and ${input.display} would both write ${displayPath(cwd, path)}: rename one, or render them in separate runs. Nothing was written.`);
      }
      const source = inputsByKey.get(key);
      if (source) throw new UsageError(`${input.display}'s output ${displayPath(cwd, path)} is an input (${source.display}): give another --out. Nothing was written.`);
      taken.set(key, input);
      paths[extension] = path;
    }
    byInput.set(input.id, paths);
  }
  return { byInput };
}

/** Temporary outputs being written, deleted on an interrupt. */
export const temporaries = new Set<string>();
let written = 0;

/** Writes `text` to `path` through a temporary file beside it, renamed over it. */
export function writeAtomically(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = join(dirname(path), `.${basename(path)}.hyper-elements-${process.pid}-${written++}.tmp`);
  temporaries.add(temporary);
  try {
    writeFileSync(temporary, text, { flag: "wx" });
    renameSync(temporary, path);
  } finally {
    try {
      rmSync(temporary, { force: true });
    } catch {
      // renamed, or it can't be deleted: nothing more to do
    }
    temporaries.delete(temporary);
  }
}

export function removeTemporaries(): void {
  for (const temporary of temporaries) {
    try {
      rmSync(temporary, { force: true });
    } catch {
      // the rest still go
    }
  }
  temporaries.clear();
}

