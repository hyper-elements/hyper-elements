/**
 * The templates a run is given: a file is one template; a folder is searched with the loader's walk(), leaving out
 * folders starting with `_` too (React Email's convention for shared parts), and a file in it is a template if it
 * has a default export (found with TypeScript's parser; it's loaded to find out the rest).
 *
 * `check` and `preview` also take an HTML email: an `.html` or `.htm` file given by name, or `-` for stdin. A
 * folder's HTML files aren't picked up (a folder holds templates, and often the HTML rendered from them).
 */
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { walk } from "@hyper-elements/template-loader";
import { UsageError } from "./args";

export interface Input {
  id: number;
  /** Its absolute path, as given (links not followed). */
  file: string;
  /** Its real path. */
  real: string;
  /** As output names it: relative to the current folder, with `/`. */
  display: string;
  /** "html": an HTML email (a file given by name, or stdin), checked and previewed as it is; "values": a values file. */
  kind?: "template" | "html" | "values";
  /**
   * A values file's input, once expanded per format: its `file` is the template module, `display` the values file,
   * and this the values file and its JSON (shape-checked), and the format it's for.
   */
  values?: { file: string; envelope: Record<string, unknown> };
  templateFormat?: string;
  /** A TSX template design's expansion: the template module's export that's its template, and what it must be. */
  templateExport?: string;
  expect?: { id: string; version: string; formats: string[] };
  /** Where its outputs are named from, where that isn't its `file`: a values file's folder and stem (`launch`). */
  output?: { folder: string; stem: string };
  /** `-`: the HTML read from stdin, named `stdin` (its `file` is `stdin` in the current folder, which isn't read). */
  stdin?: boolean;
}

export interface Found {
  inputs: Input[];
  /** Folders' symbolic links to folders, not followed. */
  links: string[];
}

/** A file a template may be: given by name, found in a folder, and watched by `dev`. */
export const MODULE = /\.(tsx|ts|jsx|js|mts|mjs|cts|cjs)$/;
/** An HTML email, given by name. */
export const HTML = /\.html?$/i;
/** A values file (a design as data), given by name. */
export const VALUES = /\.values\.json$/i;

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

export interface FindOptions {
  /** HTML emails are taken (`check`, `preview`); otherwise one is a usage error. */
  html?: boolean;
  /** Values files are taken, and folders walk them (`render`, `check`, `inspect`, `outline`); otherwise one given is a usage error. */
  values?: boolean;
}

export async function findInputs(positional: string[], cwd: string, folderSkip = (name: string) => name.startsWith("_"), options: FindOptions = {}): Promise<Found> {
  const inputs: Input[] = [];
  const seen = new Set<string>();
  const links: string[] = [];
  const add = (file: string, kind?: "html" | "values") => {
    const realPath = real(file);
    // The same file given twice, or through a link, is one input.
    if (seen.has(realPath)) return;
    seen.add(realPath);
    inputs.push({ id: inputs.length, file, real: realPath, display: displayPath(cwd, file), ...(kind ? { kind } : {}) });
  };
  let stdin = false;
  for (const given of positional) {
    if (given === "-") {
      if (!options.html) throw new UsageError("- reads an HTML email from stdin, which only check and preview take: this command takes designs (.tsx, .jsx, .ts, .js).");
      if (stdin) throw new UsageError("- (stdin) is given twice.");
      stdin = true;
      const file = join(cwd, "stdin");
      inputs.push({ id: inputs.length, file, real: file, display: "stdin", kind: "html", stdin: true });
      continue;
    }
    const path = resolve(cwd, given);
    if (!existsSync(path)) throw new UsageError(`${given} doesn't exist.`);
    if (statSync(path).isDirectory()) {
      const sources = options.values ? new RegExp(`${MODULE.source}|${VALUES.source}`, "i") : MODULE;
      const files = (await walk(path, links, false, { skip: folderSkip, sources })).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      let templates = 0;
      for (const file of files) {
        if (options.values && VALUES.test(file)) {
          templates++;
          add(file, "values");
          continue;
        }
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
      if (!templates) {
        throw new UsageError(
          `${given} holds no design: a design file is a module whose default export is a component${options.values ? ", or a values file (name.values.json)" : ""}.${options.html ? " A folder's HTML files aren't checked: give them by name (emails/*.html)." : ""}`,
        );
      }
    } else {
      if (HTML.test(path)) {
        if (!options.html) throw new UsageError(`${given} is HTML: it's already HTML. render, outline, inspect and dev take designs (.tsx, .jsx, .ts, .js); check and preview take an HTML email too.`);
        add(path, "html");
        continue;
      }
      if (VALUES.test(path)) {
        if (!options.values) throw new UsageError(`${given} is a values file: render, check, inspect and outline take values files; this command takes designs (.tsx, .jsx, .ts, .js).`);
        add(path, "values");
        continue;
      }
      if (!MODULE.test(path)) throw new UsageError(`${given} isn't a design file: give a .tsx, .jsx, .ts or .js file (or .mts, .mjs, .cts, .cjs)${options.html ? ", or an HTML email (.html, .htm)" : ""}.`);
      add(path);
    }
  }
  return { inputs, links };
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

/** A module's static import specifiers (`import … from`, `export … from`, `import x = require(…)`), in order, once each. */
export async function staticImports(path: string, source: string): Promise<string[]> {
  const ts = (await import("typescript")).default;
  const kind = /\.[cm]?tsx$|\.jsx$/.test(path) ? ts.ScriptKind.TSX : /\.[cm]?ts$/.test(path) ? ts.ScriptKind.TS : ts.ScriptKind.JSX;
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, false, kind);
  const out = new Set<string>();
  for (const statement of file.statements) {
    if ((ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) out.add(statement.moduleSpecifier.text);
    else if (ts.isImportEqualsDeclaration(statement) && ts.isExternalModuleReference(statement.moduleReference) && ts.isStringLiteral(statement.moduleReference.expression)) out.add(statement.moduleReference.expression.text);
  }
  return [...out];
}

const EXTENSIONS = [".tsx", ".ts", ".jsx", ".js", ".mts", ".mjs", ".cts", ".cjs"];

/**
 * The file an import of `specifier` from `from` loads, as tsx resolves it: a relative path with or without its
 * extension (or a `.js` that names a `.ts` file), a folder's index, or a package (from `from`'s folder). Undefined where
 * none resolves; an absolute path is never one (a design names its template relatively, or by package).
 */
export function resolveImport(from: string, specifier: string): string | undefined {
  if (specifier.startsWith("/") || /^[A-Za-z]:[\\/]/.test(specifier) || specifier.startsWith("file:")) return undefined;
  const isFile = (path: string) => {
    try {
      return statSync(path).isFile();
    } catch {
      return false;
    }
  };
  if (specifier.startsWith("./") || specifier.startsWith("../") || specifier === "." || specifier === "..") {
    const base = resolve(dirname(from), specifier);
    const twins = /\.([cm]?)js$/.test(base) ? [base.replace(/\.([cm]?)js$/, ".$1ts"), base.replace(/\.js$/, ".tsx")] : [];
    for (const candidate of [base, ...twins, ...EXTENSIONS.map((ext) => base + ext), ...EXTENSIONS.map((ext) => join(base, `index${ext}`))]) if (isFile(candidate)) return candidate;
    return undefined;
  }
  try {
    return createRequire(from).resolve(specifier);
  } catch {
    return undefined;
  }
}
