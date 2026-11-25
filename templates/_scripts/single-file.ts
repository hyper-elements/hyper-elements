/**
 * A template as the site gives it to copy, in a brand: as one self-contained file (the `Brand` type written locally, the
 * brand's block between `// brand: start` and `// brand: end`, the template, the imports merged), or as the template
 * beside its `brand.ts`, with each design made from it beside them.
 *
 * It relies on how the folder's files are written: a template imports only packages, `_brand.ts`'s types and its
 * default brand, with no renamed imports, and a brand file is one `export const brand: Brand = { … }`.
 *
 *   pnpm --filter ./templates single-file <root folder>/<name> <brand> [out-file]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";
import { ROOT } from "./assets";

const PACKAGE = /^(react|@hyper-elements\/[a-z-]+(\/[a-z-]+)?)$/;

interface Imports {
  /** By module: its named values, and its named types. */
  values: Map<string, Set<string>>;
  types: Map<string, Set<string>>;
}

const parse = (file: string) => ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

/** A file's package imports, added to `into`, and its local imports by resolved path. */
function importsOf(source: ts.SourceFile, into: Imports): string[] {
  const local: string[] = [];
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const from = (statement.moduleSpecifier as ts.StringLiteral).text;
    const clause = statement.importClause;
    if (!PACKAGE.test(from)) {
      local.push(resolve(dirname(source.fileName), from));
      continue;
    }
    if (!clause || clause.name || !clause.namedBindings || !ts.isNamedImports(clause.namedBindings)) throw new Error(`${source.fileName}: import named bindings only from ${from}`);
    for (const element of clause.namedBindings.elements) {
      if (element.propertyName) throw new Error(`${source.fileName}: no renamed imports (${element.propertyName.text} as ${element.name.text})`);
      const typeOnly = clause.isTypeOnly || element.isTypeOnly;
      const map = typeOnly ? into.types : into.values;
      if (!map.has(from)) map.set(from, new Set());
      map.get(from)!.add(element.name.text);
    }
  }
  return local;
}

/** The brand's block: its one declaration as `const brand: Brand = { … };`, between the markers. */
export function brandBlock(brandFile: string, into?: Imports): string {
  const source = parse(brandFile);
  if (into) importsOf(source, into);
  const declarations = source.statements.filter((s) => !ts.isImportDeclaration(s));
  const statement = declarations[0];
  if (declarations.length !== 1 || !statement || !ts.isVariableStatement(statement)) throw new Error(`${brandFile}: a brand file is one \`export const brand: Brand = { … }\``);
  const declaration = statement.declarationList.declarations[0];
  if (!ts.isIdentifier(declaration.name) || declaration.name.text !== "brand" || !declaration.initializer) throw new Error(`${brandFile}: the declaration is \`brand\``);
  return `// brand: start (replace with your own; every value below is used)\nconst brand: Brand = ${declaration.initializer.getText(source)};\n// brand: end`;
}

/** `_brand.ts`'s `BrandFont` and `Brand` types, as the file declares them. */
function brandTypes(into: Imports): string {
  const source = parse(join(ROOT, "_brand.ts"));
  importsOf(source, into);
  const text = source.getFullText();
  return source.statements
    .filter((s): s is ts.TypeAliasDeclaration => ts.isTypeAliasDeclaration(s) && ["BrandFont", "Brand"].includes(s.name.text))
    .map((s) => text.slice(s.getFullStart(), s.getEnd()).replace(/^(\s*(?:\/\*\*[\s\S]*?\*\/\s*)?)export\s+/, "$1").trim())
    .join("\n\n");
}

/** The import lines for what `imports` holds: React's first, then by module. */
function importLines(imports: Imports): string {
  const lines: string[] = [];
  const modules = [...new Set([...imports.values.keys(), ...imports.types.keys()])].sort((a, b) => (a === "react" ? -1 : b === "react" ? 1 : a.localeCompare(b)));
  for (const from of modules) {
    const values = [...(imports.values.get(from) ?? [])].sort();
    const typeNames = [...(imports.types.get(from) ?? [])].filter((name) => !values.includes(name)).sort();
    if (values.length) lines.push(`import { ${values.join(", ")} } from "${from}";`);
    if (typeNames.length) lines.push(`import type { ${typeNames.join(", ")} } from "${from}";`);
  }
  return lines.join("\n");
}

/** `brand.ts`: a brand's `Brand` type and its block, for the template beside it. */
function brandFileOf(brandFile: string): string {
  const brandImports: Imports = { values: new Map(), types: new Map() };
  const types = brandTypes(brandImports).replace(/^((?:\/\*\*[\s\S]*?\*\/\s*)?)type /gm, "$1export type ");
  const block = brandBlock(brandFile, brandImports)
    .replace("const brand: Brand", "export const brand: Brand")
    .replace(/^\/\/ brand: (start|end).*\n?/gm, "")
    .trim();
  return [`// brand.ts: your brand, which the template is made from. Every value below is used.`, importLines(brandImports), types, block].join("\n\n") + "\n";
}

/**
 * A template's copyable files in a brand (`<root folder>/<name>/template.tsx`, a sample brand's file): the template as
 * one file with the brand written in (`single`), the template beside its `brand.ts` (`code`, `brand`), and each design
 * made from it, beside the template (`designs`). The template imports its brand's type from `_brand.ts` and its
 * default brand from `_brands/`; the copies take both from the brand block or `./brand`.
 */
export function templateFiles(templateFile: string, brandFile: string, designFiles: readonly string[]): { single: string; code: string; brand: string; designs: Record<string, string> } {
  const imports: Imports = { values: new Map(), types: new Map() };
  const source = parse(templateFile);
  for (const local of importsOf(source, imports)) {
    const rel = relative(ROOT, local);
    if (rel !== "_brand" && !/^_(brands|companies)\/[a-z0-9-]+$/.test(rel)) throw new Error(`${templateFile}: a template imports only packages, _brand.ts's types and its default brand`);
  }
  const text = source.getFullText();
  const body = source.statements
    .filter((statement) => !ts.isImportDeclaration(statement))
    .map((statement) => text.slice(statement.getFullStart(), statement.getEnd()))
    .join("")
    .replace(/^\n+/, "");
  const where = relative(ROOT, templateFile);
  const types = brandTypes(imports);
  const block = brandBlock(brandFile, imports);
  const single = [`// ${where}, from hyperelements.dev/templates. Replace the brand block with your own brand.`, importLines(imports), types, block, body.trim()].join("\n\n") + "\n";
  const code = `// ${where}, from hyperelements.dev/templates: the template, made from your brand in ./brand.ts.\n\n${readFileSync(templateFile, "utf8")
    .replace('import type { Brand } from "../../_brand";\n', "")
    .replace(/import \{ brand \} from "\.\.\/\.\.\/_(?:brands|companies)\/[a-z0-9-]+";/, 'import { brand, type Brand } from "./brand";')}`;
  const designs = Object.fromEntries(
    designFiles.map((file) => [file, `// ${relative(ROOT, file)}: a design made from the template.\n\n${readFileSync(file, "utf8").replace('from "../template";', 'from "./template";')}`]),
  );
  return { single, code, brand: brandFileOf(brandFile), designs };
}

/** The text between a file's markers, replaced with another brand's block: what the playground's Brand menu does. */
export function swapBrand(file: string, block: string): string {
  const start = file.indexOf("// brand: start");
  const end = file.indexOf("// brand: end");
  if (start < 0 || end < start) throw new Error("no brand block");
  return file.slice(0, start) + block + file.slice(end + "// brand: end".length);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(ROOT, "_scripts", "single-file.ts")) {
  const [path, brandId, out] = process.argv.slice(2);
  if (!path || !brandId) throw new Error("usage: single-file <root folder>/<name> <brand> [out-file]");
  const file = templateFiles(join(ROOT, path, "template.tsx"), join(ROOT, "_brands", `${brandId}.ts`), []).single;
  if (out) writeFileSync(out, file);
  else process.stdout.write(file);
}
