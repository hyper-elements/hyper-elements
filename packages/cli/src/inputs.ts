/**
 * The templates a run is given: a file is one template; a folder is searched with the loader's walk(), leaving out
 * folders starting with `_` too (React Email's convention for shared parts), and a file in it is a template if it
 * has a default export (found with TypeScript's parser; it's loaded to find out the rest).
 */
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { walk } from "@unlayer-internal/template-loader";
import { UsageError } from "./args";

export interface Input {
  id: number;
  /** Its absolute path, as given (links not followed). */
  file: string;
  /** Its real path. */
  real: string;
  /** As output names it: relative to the current folder, with `/`. */
  display: string;
}

export interface Found {
  inputs: Input[];
  /** The nearest folder holding every input: outputs keep their paths relative to it. */
  base: string;
  /** Folders' symbolic links to folders, not followed. */
  links: string[];
}

/** A file a template may be, given by name. */
const MODULE = /\.(tsx|ts|jsx|js|mts|mjs|cts|cjs)$/;

export function displayPath(cwd: string, file: string): string {
  return relative(cwd, file).split(sep).join("/") || ".";
}

function real(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

/** The deepest folder holding all of `folders`. */
export function commonFolder(folders: string[]): string {
  let common = folders[0];
  for (const folder of folders.slice(1)) {
    while (common !== dirname(common) && !(folder === common || folder.startsWith(common.endsWith(sep) ? common : common + sep))) common = dirname(common);
  }
  return common;
}

/** Whether a module has a default export (`export default`, `export { x as default }`, or CommonJS's `module.exports`). */
export async function hasDefaultExport(path: string, source: string): Promise<boolean> {
  if (!/\bdefault\b|module\.exports|exports\./.test(source)) return false;
  const ts = (await import("typescript")).default;
  const kind = /\.[cm]?tsx$|\.jsx$/.test(path) ? ts.ScriptKind.TSX : /\.[cm]?ts$/.test(path) ? ts.ScriptKind.TS : ts.ScriptKind.JSX;
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, false, kind);
  for (const statement of file.statements) {
    if (ts.isExportAssignment(statement)) return true;
    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
    if (modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) && modifiers.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) return true;
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause) && statement.exportClause.elements.some((e) => e.name.text === "default")) return true;
    if (ts.isExpressionStatement(statement) && ts.isBinaryExpression(statement.expression) && statement.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const target = statement.expression.left.getText(file);
      if (target === "module.exports" || target === "exports.default" || target === "module.exports.default") return true;
    }
  }
  return false;
}

export async function findInputs(positional: string[], cwd: string, folderSkip = (name: string) => name.startsWith("_")): Promise<Found> {
  const inputs: Input[] = [];
  const seen = new Set<string>();
  const holders: string[] = [];
  const links: string[] = [];
  const add = (file: string) => {
    const realPath = real(file);
    // The same file given twice, or through a link, is one input.
    if (seen.has(realPath)) return;
    seen.add(realPath);
    inputs.push({ id: inputs.length, file, real: realPath, display: displayPath(cwd, file) });
  };
  for (const given of positional) {
    const path = resolve(cwd, given);
    if (!existsSync(path)) throw new UsageError(`${given} doesn't exist.`);
    if (statSync(path).isDirectory()) {
      holders.push(path);
      const files = (await walk(path, links, false, { skip: folderSkip })).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      let templates = 0;
      for (const file of files) {
        let source: string;
        try {
          source = await readFile(file, "utf8");
        } catch {
          continue;
        }
        if (!(await hasDefaultExport(file, source))) continue;
        templates++;
        add(file);
      }
      if (!templates) throw new UsageError(`${given} holds no template: a template is a module whose default export is a component.`);
    } else {
      if (/\.html?$/i.test(path)) throw new UsageError(`${given} is HTML: the CLI takes templates (.tsx, .jsx, .ts, .js), and HTML input comes in a later release.`);
      if (!MODULE.test(path)) throw new UsageError(`${given} isn't a template: give a .tsx, .jsx, .ts or .js file (or .mts, .mjs, .cts, .cjs).`);
      holders.push(dirname(path));
      add(path);
    }
  }
  return { inputs, base: commonFolder(holders), links };
}

/** The TypeScript file tsx would load in place of a JavaScript template, where there's one. */
export function typeScriptTwin(file: string): string | undefined {
  const ext = extname(file);
  const stem = join(dirname(file), basename(file, ext));
  const twins = ext === ".js" || ext === ".jsx" ? [".ts", ".tsx"] : ext === ".mjs" ? [".mts"] : ext === ".cjs" ? [".cts"] : [];
  for (const twin of twins) if (existsSync(stem + twin)) return stem + twin;
  return undefined;
}

/** How a template loads on Node: as a CommonJS module, or an ES module (as tsx decides, from its package's type). */
export function moduleFormat(file: string): "esm" | "cjs" {
  if (/\.c[jt]s$/.test(file)) return "cjs";
  if (/\.m[jt]s$/.test(file)) return "esm";
  for (let dir = dirname(file); ; dir = dirname(dir)) {
    const manifest = join(dir, "package.json");
    if (existsSync(manifest)) {
      try {
        return JSON.parse(readFileSync(manifest, "utf8")).type === "module" ? "esm" : "cjs";
      } catch {
        return "cjs";
      }
    }
    if (dirname(dir) === dir) return "cjs";
  }
}

/** The folder of the nearest package.json at or above `dir`, if there is one. */
export function packageFolder(dir: string): string | null {
  for (let current = dir; ; current = dirname(current)) {
    if (existsSync(join(current, "package.json"))) return current;
    if (dirname(current) === current) return null;
  }
}
