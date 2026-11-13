/**
 * Lint's options from the project: `"hyperElements": { "lint": { … } }` in the package.json nearest the current folder,
 * read once when the run (or `dev`) starts. This process checks only their shape (a bad one is a usage error, exit 2,
 * before any template runs); the copy of `@hyper-elements/lint` that runs checks what they mean, so a project's own
 * copy, older or newer than the CLI's, is the one whose rules count.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { UsageError } from "./args";

/** What `lint()` takes, as far as the CLI checks it. */
export interface LintConfig {
  rules?: Record<string, string>;
  kind?: string;
}

/** The nearest package.json at or above `cwd`, if any. */
function nearestManifest(cwd: string): string | undefined {
  for (let dir = cwd; ; dir = dirname(dir)) {
    const path = join(dir, "package.json");
    if (existsSync(path)) return path;
    if (dirname(dir) === dir) return undefined;
  }
}

const kindOf = (v: unknown) => (v === null ? "null" : Array.isArray(v) ? "an array" : typeof v);

/** Lint's options for a run in `cwd`: `{}` where the project gives none. A shape lint can't take throws a UsageError. */
export function readLintConfig(cwd: string): LintConfig {
  const path = nearestManifest(cwd);
  if (!path) return {};
  let manifest: unknown;
  try {
    manifest = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    // Not lint's to judge: the project's tools say what's wrong with it.
    return {};
  }
  const value = (manifest as { hyperElements?: { lint?: unknown } } | null)?.hyperElements?.lint;
  if (value === undefined) return {};
  const where = `${relative(cwd, path) || "package.json"}'s hyperElements.lint`;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new UsageError(`${where} is lint's options, an object ({ "rules": { … }, "kind": "marketing" }), not ${kindOf(value)}.`);
  const { rules, kind } = value as { rules?: unknown; kind?: unknown };
  if (rules !== undefined) {
    if (!rules || typeof rules !== "object" || Array.isArray(rules)) throw new UsageError(`${where}.rules is an object of rule ids to "off", "info" or "warning", not ${kindOf(rules)}.`);
    for (const [id, setting] of Object.entries(rules)) {
      if (typeof setting !== "string") throw new UsageError(`${where}.rules[${JSON.stringify(id)}] is "off", "info" or "warning", not ${kindOf(setting)}.`);
    }
  }
  if (kind !== undefined && typeof kind !== "string") throw new UsageError(`${where}.kind is "marketing" or "transactional", not ${kindOf(kind)}.`);
  return value as LintConfig;
}
