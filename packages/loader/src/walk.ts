/**
 * Finding templates in a folder.
 */
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

/** The source files a template can be. */
export const SOURCE = /\.(tsx|jsx|ts|js|mts|mjs)$/;
/** Folders never looked in: dependencies, build output, caches. */
export const IGNORED = new Set(["node_modules", ".git", ".next", "dist", "build", "out", ".turbo", "coverage"]);

export interface WalkOptions {
  /** Also leaves out the folders whose name this returns true for. */
  skip?: (name: string) => boolean;
  /** The files that count, by name (`SOURCE` where it isn't given). */
  sources?: RegExp;
}

/**
 * The source files in a folder and the ones in it, without tests, stories and `.d.ts` files, `IGNORED` folders and
 * folders whose name starts with `.`. A symbolic link to a folder isn't followed, but goes in `links`. `all`: every
 * module, tests and CommonJS (.cjs, .cts) too.
 */
export async function walk(dir: string, links: string[] = [], all = false, options: WalkOptions = {}): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || IGNORED.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isSymbolicLink() && (await stat(path).catch(() => undefined))?.isDirectory()) links.push(path);
    else if (entry.isDirectory()) {
      if (!options.skip?.(entry.name)) out.push(...(await walk(path, links, all, options)));
    } else if ((all ? /\.[cm]?[jt]sx?$/ : (options.sources ?? SOURCE)).test(entry.name) && (all || !/\.(test|spec|stories)\.[^.]+$/.test(entry.name)) && !/\.d\.[cm]?ts$/.test(entry.name)) out.push(path);
  }
  return out;
}
