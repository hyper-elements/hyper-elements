/**
 * Finding a project's own copy of a package the CLI also carries (email-clients, lint): whether a `node_modules` holds
 * it, and the ES module file an export of it names.
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Whether a node_modules at or above `folder` holds `name`. Bun resolves a package no node_modules holds (from its cache
 * or npm, or the CLI's own from its store), which isn't the project's: on Bun, a copy counts only where this holds.
 */
export function installedAbove(folder: string, name: string): boolean {
  for (let dir = folder; ; dir = dirname(dir)) {
    if (existsSync(join(dir, "node_modules", name, "package.json"))) return true;
    if (dirname(dir) === dir) return false;
  }
}

/** The ES module file of a package's export `subpath` ("." or "./html"): its `import` condition, else `default`. */
export function esmExport(folder: string, manifest: Record<string, unknown>, subpath: string): string | undefined {
  const exports = manifest.exports as Record<string, unknown> | string | undefined;
  const conditions = exports && typeof exports === "object" ? exports : undefined;
  const exported = conditions && subpath in conditions ? conditions[subpath] : subpath === "." && !(conditions && Object.keys(conditions).some((k) => k.startsWith("."))) ? exports : undefined;
  const pick = (value: unknown): string | undefined => {
    if (typeof value === "string") return value;
    if (value && typeof value === "object") {
      const choices = value as Record<string, unknown>;
      return pick(choices.import) ?? pick(choices.default);
    }
    return undefined;
  };
  const entry = pick(exported);
  return entry ? join(folder, entry) : undefined;
}

/** The conditions Node resolves an `import` with. */
const IMPORT_CONDITIONS = new Set(["import", "node", "module-sync", "node-addons", "default"]);

/**
 * Whether an `import` of a package's export `subpath` ("." or "./en-us") finds a file in its `exports`: the entry for
 * the subpath, or the `*` pattern Node matches it with, under the conditions an import is resolved with. A subpath the
 * package doesn't export finds none, imported or required, whatever its other entries are.
 */
export function importFinds(exports: unknown, subpath: string): boolean {
  const entries =
    exports !== null && typeof exports === "object" && !Array.isArray(exports) && Object.keys(exports).some((key) => key.startsWith("."))
      ? (exports as Record<string, unknown>)
      : { ".": exports };
  // As Node matches a pattern: one `*`, the subpath at least as long as the key, the longest part before the `*` first.
  const pattern = Object.keys(entries)
    .filter((key) => {
      const star = key.indexOf("*");
      return star >= 0 && star === key.lastIndexOf("*") && subpath.length >= key.length && subpath.startsWith(key.slice(0, star)) && subpath.endsWith(key.slice(star + 1));
    })
    .sort((a, b) => b.indexOf("*") - a.indexOf("*") || b.length - a.length)[0];
  const entry = Object.hasOwn(entries, subpath) && !subpath.includes("*") ? entries[subpath] : pattern === undefined ? undefined : entries[pattern];
  // A target: a path finds a file, null is a subpath taken out, a list takes its first that finds one, and conditions
  // their first that applies and finds one or is null.
  const finds = (target: unknown): boolean | undefined => {
    if (typeof target === "string") return true;
    if (target === null) return false;
    if (Array.isArray(target)) return target.some((held) => finds(held) === true) || undefined;
    if (typeof target === "object") {
      for (const [condition, held] of Object.entries(target as Record<string, unknown>)) {
        if (!IMPORT_CONDITIONS.has(condition)) continue;
        const found = finds(held);
        if (found !== undefined) return found;
      }
    }
    return undefined;
  };
  return finds(entry) === true;
}
