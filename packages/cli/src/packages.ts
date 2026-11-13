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
