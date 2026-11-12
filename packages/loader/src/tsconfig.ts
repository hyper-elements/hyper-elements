/**
 * The tsconfig a template compiles with: the project's own, extended, with what a template run needs on top of it.
 */
import { existsSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";

export interface ProjectTsconfigOptions {
  /**
   * Whose project settings (the tsconfig, its paths) apply: by default `path`'s. The config comes from this file's
   * folder, falling back to `path`'s; `path` still decides the folders `include` lists and the workspace.
   */
  configFrom?: string;
  /** The current folder: included, and the base of `paths` where the project has no tsconfig. */
  cwd: string;
  /** Aliases added to the project's (absolute paths), over any of the same name. */
  paths?: Record<string, string[]>;
  /** Other folders whose files need the same JSX settings (each is included, with its real path). */
  include?: string[];
  /** Where to write it: by default a new file in the temporary folder. Never written over. */
  file?: string;
  /** A first line, as a comment (tsconfig files are JSON with comments): who wrote the file. */
  header?: string;
}

export interface ProjectTsconfig {
  /** The file written. */
  file: string;
  /** The base config it extends, if the project has one. */
  base: string | undefined;
  /** Deletes it (nothing happens when it's already gone). */
  remove(): void;
}

/**
 * Writes a tsconfig for the template at `path`: it extends the project's (the nearest tsconfig.json or jsconfig.json
 * above `configFrom`, else above `path`), keeps its `paths` resolved to absolute paths, sets React's automatic JSX
 * runtime, and includes the current folder, the template's folder, the tsconfig's and the workspace root, so a
 * workspace package's TSX (outside the app) compiles with the same settings. tsx applies the JSX settings only to the
 * files `include` lists, by their real paths.
 */
export async function projectTsconfig(path: string, options: ProjectTsconfigOptions): Promise<ProjectTsconfig> {
  const { cwd, configFrom = path } = options;
  const base = projectConfig(dirname(configFrom)) ?? projectConfig(dirname(path));
  const ts = (await import("typescript")).default;
  const compiler = base
    ? ts.parseJsonConfigFileContent(ts.readConfigFile(base, ts.sys.readFile).config ?? {}, ts.sys, dirname(base)).options
    : {};
  const paths = { ...compiler.paths };
  const pathBase = compiler.baseUrl ?? (compiler as { pathsBasePath?: string }).pathsBasePath ?? (base ? dirname(base) : cwd);
  for (const [alias, entries] of Object.entries(paths)) paths[alias] = entries.map((entry) => resolve(pathBase, entry));
  Object.assign(paths, options.paths);
  const workspace = workspaceRoot(dirname(path));
  const roots = [cwd, dirname(path), ...(base ? [dirname(base)] : []), ...(workspace ? [workspace] : []), ...(options.include ?? [])];
  const include = [...new Set(roots.flatMap((root) => [root, realpathOr(root)]))];
  const file = options.file ?? join(tmpdir(), `hyper-elements-migrate-tsconfig-${randomUUID()}.json`);
  const config = JSON.stringify({
    ...(base ? { extends: base } : {}),
    compilerOptions: {
      allowJs: true,
      jsx: "react-jsx",
      jsxImportSource: "react",
      ...(Object.keys(paths).length ? { paths } : {}),
    },
    // Imports outside the template folder need the same JSX runtime too.
    include: include.map((root) => join(root, "**/*").split(sep).join("/")),
  });
  // Written at once, never over a file: nothing else's, and no moment where it exists half written.
  writeFileSync(file, options.header === undefined ? config : `// ${options.header}\n${config}`, { flag: "wx" });
  return { file, base, remove: () => rmSync(file, { force: true }) };
}

/** The nearest tsconfig.json, or jsconfig.json (JavaScript projects, Next.js), at or above `dir`. */
export function projectConfig(dir: string): string | undefined {
  for (let current = dir; ; current = dirname(current)) {
    for (const name of ["tsconfig.json", "jsconfig.json"]) if (existsSync(join(current, name))) return join(current, name);
    if (dirname(current) === current) return undefined;
  }
}

/** The monorepo `dir` is in: the nearest folder with pnpm-workspace.yaml, or a package.json with workspaces. */
export function workspaceRoot(dir: string): string | undefined {
  for (let current = dir; ; current = dirname(current)) {
    if (existsSync(join(current, "pnpm-workspace.yaml"))) return current;
    try {
      if (JSON.parse(readFileSync(join(current, "package.json"), "utf8")).workspaces) return current;
    } catch {
      // no package.json here, or not one that parses
    }
    if (dirname(current) === current) return undefined;
  }
}

export function realpathOr(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}
