/**
 * A design as the site gives it to copy: one self-contained file per design and brand (the `Brand` type written
 * locally, the brand's block between `// brand: start` and `// brand: end`, the design, the imports merged, and
 * `export default` drawing the design in the brand), or as two files, the design and its `brand.ts`.
 *
 * It relies on how the folder's files are written: a design imports only packages and `_brand.ts`'s
 * types, with no renamed imports, and a brand file is one `export const brand: Brand = { … }`.
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

/** A file's statements but its imports, with `export` taken off (and `export default` off a function). */
function bodyOf(source: ts.SourceFile): { text: string; defaultName?: string } {
  const text = source.getFullText();
  const parts: string[] = [];
  let defaultName: string | undefined;
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement)) continue;
    let chunk = text.slice(statement.getFullStart(), statement.getEnd());
    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
    const isDefault = modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
    if (isDefault) {
      if (!ts.isFunctionDeclaration(statement) || !statement.name) throw new Error(`${source.fileName}: the default export is a named function`);
      defaultName = statement.name.text;
      chunk = chunk.replace(/export\s+default\s+function/, "function");
    } else {
      chunk = chunk.replace(/^(\s*(?:\/\*\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*)export\s+/, "$1");
    }
    parts.push(chunk);
  }
  return { text: parts.join("").replace(/^\n+/, ""), ...(defaultName ? { defaultName } : {}) };
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

/** A design's component as the site gives it: taking no props, its brand from the module's scope (`./brand`, or the
 * single file's own block), as `template extract` takes one. */
const PROPS = /\(\{ brand \}: \{ brand: Brand \}\)/;
function withoutProps(text: string, file: string): string {
  if (!PROPS.test(text)) throw new Error(`${file}: the design's component takes ({ brand }: { brand: Brand })`);
  return text.replace(PROPS, "()");
}

/** A design file's imports, its statements but its imports (its default export a plain function), and the name of
 * the component it exports. */
function designPieces(designFile: string): { imports: Imports; body: string; name: string } {
  const imports: Imports = { values: new Map(), types: new Map() };
  const source = parse(designFile);
  const locals = importsOf(source, imports);
  for (const local of locals) if (resolve(local) !== resolve(ROOT, "_brand")) throw new Error(`${designFile}: a design imports only packages and _brand.ts's types`);
  const { text: body, defaultName } = bodyOf(source);
  if (!defaultName) throw new Error(`${designFile}: no default export`);
  return { imports, body: body.trim(), name: defaultName };
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

/** The copyable file for a design (`<root folder>/<name>.tsx`) in a brand (a brand file). */
export function singleFile(designFile: string, brandFile: string): string {
  const { imports, body, name } = designPieces(designFile);
  const types = brandTypes(imports);
  const block = brandBlock(brandFile, imports);
  const header = `// ${relative(ROOT, designFile)}, from hyperelements.dev/templates. Replace the brand block with your own brand.`;
  return [header, importLines(imports), types, block, `// The design\n${withoutProps(body, designFile)}`, `export default ${name};`].join("\n\n") + "\n";
}

/** The same design as two files: the design, which takes its brand from `./brand`, and that `brand.ts`. Together
 * they're the single file, with the brand kept apart (what a design's page shows). */
export function splitFiles(designFile: string, brandFile: string): { code: string; brand: string } {
  const { name } = designPieces(designFile);
  const text = withoutProps(readFileSync(designFile, "utf8").replace('import type { Brand } from "../_brand";', 'import { brand } from "./brand";'), designFile);
  const header = `// ${relative(ROOT, designFile)}, from hyperelements.dev/templates. Render it with render(<${name} />) from\n// "@hyper-elements/react"; your brand goes in ./brand.ts.`;
  const code = `${header}\n\n${text}`;
  const brandImports: Imports = { values: new Map(), types: new Map() };
  const types = brandTypes(brandImports).replace(/^((?:\/\*\*[\s\S]*?\*\/\s*)?)type /gm, "$1export type ");
  const block = brandBlock(brandFile, brandImports)
    .replace("const brand: Brand", "export const brand: Brand")
    .replace(/^\/\/ brand: (start|end).*\n?/gm, "")
    .trim();
  const brand = [`// brand.ts: your brand, which the design draws in. Every value below is used.`, importLines(brandImports), types, block].join("\n\n") + "\n";
  return { code, brand };
}

function safeRead(file: string): boolean {
  try {
    readFileSync(file);
    return true;
  } catch {
    return false;
  }
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
  const file = singleFile(join(ROOT, `${path}.tsx`), join(ROOT, "_brands", `${brandId}.ts`));
  if (out) writeFileSync(out, file);
  else process.stdout.write(file);
}

