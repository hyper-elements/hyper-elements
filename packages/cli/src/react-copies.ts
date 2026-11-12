/**
 * The copies of React a process has loaded. React is CommonJS, so every copy is in `require.cache`, whatever imported
 * it, on Node and on Bun. Copies are told apart by the real path of their package folder, so pnpm's links to one copy
 * count once. Two copies in one template's process break hooks and context between them.
 */
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

export interface ReactCopy {
  /** The package folder (its real path). */
  folder: string;
  version: string | undefined;
  /** The modules that required it (their files), where a CommonJS module did; empty when only ES modules imported it. */
  requiredBy: string[];
}

interface CachedModule {
  filename?: string;
  id?: string;
  children?: CachedModule[];
}

const packages = new Map<string, { name: string; version?: string; folder: string } | null>();

/** The package a file is in: the nearest package.json with a name, above it. */
function packageOf(file: string): { name: string; version?: string; folder: string } | null {
  const start = dirname(file);
  if (packages.has(start)) return packages.get(start)!;
  let found: { name: string; version?: string; folder: string } | null = null;
  for (let dir = start; ; dir = dirname(dir)) {
    const manifest = join(dir, "package.json");
    if (existsSync(manifest)) {
      try {
        const json = JSON.parse(readFileSync(manifest, "utf8"));
        if (typeof json.name === "string") {
          found = { name: json.name, version: json.version, folder: dir };
          break;
        }
      } catch {
        // not one that parses: keep looking
      }
    }
    if (dirname(dir) === dir) break;
  }
  packages.set(start, found);
  return found;
}

function real(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

/** The copies of React in `cache` (by default this process's `require.cache`). */
export function reactCopies(cache: Record<string, CachedModule | undefined> = createRequire(import.meta.url).cache as Record<string, CachedModule | undefined>): ReactCopy[] {
  const copies = new Map<string, ReactCopy>();
  const modules = Object.entries(cache);
  for (const [key, module] of modules) {
    const file = module?.filename ?? key;
    if (!file || !/[\\/]/.test(file)) continue;
    const pkg = packageOf(file);
    if (pkg?.name !== "react") continue;
    const folder = real(pkg.folder);
    let copy = copies.get(folder);
    if (!copy) copies.set(folder, (copy = { folder, version: pkg.version, requiredBy: [] }));
    // Who required it: a module outside React's own folder whose children hold it.
    for (const [otherKey, other] of modules) {
      const otherFile = other?.filename ?? otherKey;
      if (!other?.children?.includes(module!) || real(dirname(otherFile)).startsWith(folder)) continue;
      if (!copy.requiredBy.includes(otherFile)) copy.requiredBy.push(otherFile);
    }
  }
  return [...copies.values()];
}
