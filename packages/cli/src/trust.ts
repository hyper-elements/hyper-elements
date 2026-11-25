/**
 * Which template modules are trusted (Decision 31): `"hyperElements": { "templates": [...] }` in the package.json
 * nearest the current folder, beside lint's options. Each entry is a path or a glob relative to that file
 * (`"templates/**"`, `"templates/newsletter.tsx"`), or a package specifier (`"@acme/brand-templates"`, which trusts
 * the package and its subpaths). The parent expands the list to real paths and package folders once, before anything
 * runs: a template module, a values file's `module` or a TSX design's template must be one of them
 * (`cli/template-untrusted` otherwise), and a template child's load guard holds them.
 *
 * Without the setting, templates load as before, reported `trusted: false` with a warning naming the setting.
 */
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve, sep } from "node:path";
import { UsageError } from "./args";
import { cliDiagnostic } from "./commands/shared";
import type { Diagnostic, TrustList } from "./protocol";

export interface Trust {
  /** The expanded list, or undefined where the project sets none. */
  list?: TrustList;
  /** The package.json it's read from, as the run shows it. */
  where?: string;
}

const GLOB = /[*?[\]{}]/;
const SKIP = new Set(["node_modules", ".git"]);

function nearestManifest(cwd: string): string | undefined {
  for (let dir = cwd; ; dir = dirname(dir)) {
    const path = join(dir, "package.json");
    if (existsSync(path)) return path;
    if (dirname(dir) === dir) return undefined;
  }
}

const realOr = (path: string) => {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
};

/** A glob as a regular expression over a `/`-separated relative path: `**` any folders, `*` and `?` within one name. */
export function globPattern(glob: string): RegExp {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      // `**/` is any folders (none too); a trailing `**` is anything below.
      if (glob[i + 2] === "/") {
        out += "(?:.*/)?";
        i += 2;
      } else {
        out += ".*";
        i += 1;
      }
    } else if (c === "*") out += "[^/]*";
    else if (c === "?") out += "[^/]";
    else out += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${out}$`);
}

/** The files under `folder` (not node_modules or .git), as `/`-separated paths relative to it. */
function filesUnder(folder: string, at = ""): string[] {
  const out: string[] = [];
  let entries;
  try {
    entries = readdirSync(join(folder, at), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue;
    const path = at ? `${at}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...filesUnder(folder, path));
    else if (entry.isFile() || entry.isSymbolicLink()) out.push(path);
  }
  return out;
}

const isPackageSpecifier = (entry: string) => !entry.startsWith(".") && !entry.startsWith("/") && !GLOB.test(entry) && /^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*(\/.*)?$/i.test(entry);

/** The run's trusted list: read and expanded once. A setting of the wrong shape is a usage error (exit 2). */
export function readTrust(cwd: string): Trust {
  const manifest = nearestManifest(cwd);
  if (!manifest) return {};
  // Read as Node reads it (a byte-order mark first is fine). One that can't be read can't say there's no list: the
  // run stops, where taking it for "no list" would load templates unguarded.
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(manifest, "utf8").replace(/^\uFEFF/, ""));
  } catch (error) {
    throw new UsageError(`${relative(cwd, manifest) || "package.json"} isn't JSON (${(error as Error).message.split("\n")[0]}): its trusted templates (hyperElements.templates) can't be read.`);
  }
  const value = (parsed as { hyperElements?: { templates?: unknown } } | null)?.hyperElements?.templates;
  if (value === undefined) return {};
  const where = `${relative(cwd, manifest) || "package.json"}'s hyperElements.templates`;
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || !entry)) {
    throw new UsageError(`${where} lists the trusted template modules: paths or globs relative to it ("templates/**") and package names ("@acme/brand-templates").`);
  }
  const folder = dirname(manifest);
  const files = new Set<string>();
  const packages = new Set<string>();
  let all: string[] | undefined;
  for (const entry of value as string[]) {
    // A package by its name: its folder, found from the manifest's folder as an import there would find it.
    if (isPackageSpecifier(entry) && !existsSync(join(folder, entry))) {
      const name = entry.startsWith("@") ? entry.split("/").slice(0, 2).join("/") : entry.split("/")[0];
      try {
        packages.add(realOr(dirname(createRequire(manifest).resolve(`${name}/package.json`))));
      } catch {
        // Its package.json may not be exported: the folder of what it resolves to, up to its package.json.
        try {
          let dir = dirname(createRequire(manifest).resolve(name));
          while (!existsSync(join(dir, "package.json")) && dirname(dir) !== dir) dir = dirname(dir);
          packages.add(realOr(dir));
        } catch {
          // Not installed: it trusts nothing yet.
        }
      }
      continue;
    }
    const path = entry.replace(/^\.\//, "");
    if (!GLOB.test(path)) {
      const file = resolve(folder, path);
      if (existsSync(file) && statSync(file).isDirectory()) for (const under of filesUnder(file)) files.add(realOr(join(file, under)));
      else if (existsSync(file)) files.add(realOr(file));
      continue;
    }
    all ??= filesUnder(folder);
    const pattern = globPattern(path);
    for (const under of all) if (pattern.test(under)) files.add(realOr(join(folder, under)));
  }
  return { list: { files: [...files], packages: [...packages] }, where };
}

/** Whether an entry module (a template module, a values file's or a design's template) is one the list holds. */
export function trusted(file: string, list: TrustList): boolean {
  const real = realOr(file);
  return list.files.includes(real) || list.packages.some((folder) => real.startsWith(folder + sep));
}

/** The diagnostic for a template module the list doesn't hold, or (no list) the warning that templates aren't checked against one. */
export function untrusted(display: string, trust: Trust): Diagnostic {
  return trust.list
    ? cliDiagnostic("template-untrusted", "error", `${display} isn't a trusted template module: ${trust.where} doesn't list it, so no template child loads it`, `add it (or its folder, "templates/**") to ${trust.where}`)
    : cliDiagnostic("template-untrusted", "warning", `${display} is loaded as a template without a list of trusted templates: a design could name any module as its template`, 'list them in package.json: "hyperElements": { "templates": ["templates/**"] }');
}
