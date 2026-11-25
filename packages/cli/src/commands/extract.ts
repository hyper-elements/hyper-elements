/**
 * `template extract <design> --id <template id> --field <name>… -o <templates/x.tsx>`: a design a person approved,
 * turned into a template by a codemod on its source (TypeScript's compiler API), in the parent: no design code runs.
 * Themes, variants and components stay as written.
 *
 * - Each `--field` names an `id` in the design. A literal text child (a Heading's, a Text's, a Button's) becomes a
 *   `prop.text` field, and an Image's literal `src` (`{ src, width, height }`) a `field.image`; the literal becomes the
 *   field's `example`, and the node keeps its `id` (it's output) and gains `field="<name>"`.
 * - Siblings with ids `<name>-0`, `<name>-1`, … become one `prop.list`, bound as `<name>[0]`, `<name>[1]`, ….
 * - A value that isn't a literal is `extract/not-literal`, with its place: nothing is written until every field is
 *   extracted.
 * - Relative imports and `src` paths are rewritten for the template's folder.
 *
 * The author then adds rules and formats and sets `version`; `check templates/` is the template's CI.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import type ts from "typescript";
import { UsageError, type Args } from "../args";
import { writeAtomically } from "../destinations";
import { displayPath } from "../inputs";
import type { Io } from "../run";

const ROOTS = new Set(["Email", "Page", "Document", "Canvas"]);

export interface ExtractDiagnostic {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  /** `file:line:column`, where there's a place. */
  at?: string;
}

interface Field {
  name: string;
  kind: "text" | "image";
  list: boolean;
  /** One value per node bound (one, or a list's items). */
  values: unknown[];
}

interface Edit {
  start: number;
  end: number;
  text: string;
}

/** "launchDate" → "Launch date"; "acme.LaunchGraphic" → "Launch graphic". */
export function labelOf(name: string): string {
  const words = name
    .split(".")
    .pop()!
    .replace(/[-_]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** JSX text as React reads it: each line trimmed (the first's start and the last's end kept), blank lines dropped, joined by spaces. */
export function jsxText(raw: string): string {
  const lines = raw.split(/\r\n|\n|\r/);
  if (lines.length === 1) return raw;
  return lines
    .map((line, i) => {
      let text = line.replace(/\t/g, " ");
      if (i !== 0) text = text.replace(/^ +/, "");
      if (i !== lines.length - 1) text = text.replace(/ +$/, "");
      return text;
    })
    .filter(Boolean)
    .join(" ");
}

/** A relative path written from one folder, rewritten for another (`./x` and `../x` only), with `/`. */
function rebasePath(path: string, from: string, to: string): string {
  if (!path.startsWith("./") && !path.startsWith("../")) return path;
  const moved = relative(to, resolve(from, path)).split(sep).join("/");
  return moved.startsWith(".") ? moved : `./${moved}`;
}

export async function runExtract(args: Args, io: Io): Promise<number> {
  const { cwd } = io;
  const options = args.extract!;
  const file = resolve(cwd, args.positional[1]);
  if (!existsSync(file)) throw new UsageError(`${args.positional[1]} isn't there: template extract takes a design's file.`);
  const output = resolve(cwd, options.output);
  if (existsSync(output) && !options.force) throw new UsageError(`${options.output} is there already: give another -o, or --force to replace it.`);
  const source = readFileSync(file, "utf8");
  const result = await extract(source, file, output, options);
  const shown = displayPath(cwd, output);
  const place = (d: ExtractDiagnostic) => (d.at ? `${d.at}: ` : "");
  if (!result.text) {
    if (args.json) await io.stdout(`${JSON.stringify({ version: 1, command: "template", file: displayPath(cwd, file), status: "error", diagnostics: result.diagnostics })}\n`);
    else io.stderr(`✗ ${shown}: not written\n${result.diagnostics.map((d) => `    ${place(d)}${d.severity} ${d.code}: ${d.message}\n`).join("")}`);
    return 1;
  }
  writeAtomically(output, result.text);
  if (args.json) {
    await io.stdout(`${JSON.stringify({ version: 1, command: "template", file: displayPath(cwd, file), status: "ok", output: shown, template: { id: options.id }, fields: result.fields.map((f) => ({ name: f.name, kind: f.kind, ...(f.list ? { items: f.values.length } : {}) })), diagnostics: result.diagnostics })}\n`);
  } else {
    const fields = result.fields.map((f) => `${f.name}${f.list ? ` (a list of ${f.values.length})` : ""}`).join(", ");
    await io.stdout(`✓ ${shown}: ${options.id}, its fields ${fields}\n  Next: add its rules and formats, set its version, then: npx hyper-elements check ${shown}\n`);
  }
  return 0;
}

/** The codemod: the template module's text, or why not (nothing to write). */
export async function extract(
  source: string,
  file: string,
  output: string,
  options: { id: string; fields: string[]; label?: string },
): Promise<{ text?: string; fields: Field[]; diagnostics: ExtractDiagnostic[] }> {
  const ts = (await import("typescript")).default;
  const diagnostics: ExtractDiagnostic[] = [];
  const parse = (text: string) => ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const sf = parse(source);
  const at = (node: ts.Node) => {
    const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    return `${displayFile(file)}:${line + 1}:${character + 1}`;
  };
  const fail = (code: string, message: string, node?: ts.Node) => diagnostics.push({ code, severity: "error", message, ...(node ? { at: at(node) } : {}) });

  const design = defaultExport(ts, sf);
  if (!design) {
    fail("extract/no-design", "Its default export isn't a component written here (export default function Design() { … }, or an arrow function)");
    return { fields: [], diagnostics };
  }
  if (design.fn.parameters.length) fail("extract/props", "The design takes props: a template's values are its fields, so extract a design that takes none", design.fn.parameters[0]);

  // Each element with a literal id, and the design's root.
  const byId = new Map<string, ts.JsxElement | ts.JsxSelfClosingElement>();
  let root: string | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      const tag = opening.tagName.getText(sf);
      if (!root && ROOTS.has(tag)) root = tag;
      const id = literalAttribute(ts, opening, "id");
      if (id !== undefined && !byId.has(id)) byId.set(id, node);
    }
    ts.forEachChild(node, visit);
  };
  visit(design.fn.body!);
  if (!root) fail("extract/no-root", "The design's JSX has no root Elements knows (an Email, a Page, a Document or a Canvas)", design.fn);

  const edits: Edit[] = [];
  const fields: Field[] = [];
  const names = new Set<string>();
  for (const name of options.fields) {
    if (names.has(name)) {
      fail("extract/field", `--field ${name} is given twice`);
      continue;
    }
    names.add(name);
    if (!/^[A-Za-z_$][\w$]*$/.test(name) || ["format", "key", "ref", "children"].includes(name)) {
      fail("extract/field", `--field ${name}: a field's name is an identifier (headline, launchDate), and not format, key, ref or children`);
      continue;
    }
    const nodes: Array<ts.JsxElement | ts.JsxSelfClosingElement> = [];
    let list = false;
    if (byId.has(name)) nodes.push(byId.get(name)!);
    else {
      for (let i = 0; byId.has(`${name}-${i}`); i++) nodes.push(byId.get(`${name}-${i}`)!);
      list = true;
    }
    if (!nodes.length) {
      fail("extract/no-id", `No element in the design has id="${name}" (or ids ${name}-0, ${name}-1, … for a list)`);
      continue;
    }
    const field: Field = { name, kind: "text", list, values: [] };
    const kinds = new Set<string>();
    nodes.forEach((node, index) => {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      const path = list ? `${name}[${index}]` : name;
      const value = `{v.${name}${list ? `[${index}]` : ""}}`;
      if (literalAttribute(ts, opening, "field") !== undefined || opening.attributes.properties.some((p) => ts.isJsxAttribute(p) && p.name.getText(sf) === "field")) {
        fail("extract/field", `${path}'s element is bound already (it has a field)`, opening);
        return;
      }
      if (opening.tagName.getText(sf) === "Image") {
        kinds.add("image");
        const src = opening.attributes.properties.find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(sf) === "src");
        const literal = src ? imageLiteral(ts, src) : undefined;
        if (!src || !literal) {
          fail("extract/not-literal", `${path}'s src isn't a literal { src, width, height }: an image field's example is the image as written`, src ?? opening);
          return;
        }
        // Its example is the template's own, so its path is the template's folder's.
        field.values.push({ ...literal, src: rebasePath(literal.src, dirname(file), dirname(output)) });
        edits.push({ start: src.initializer!.getStart(sf), end: src.initializer!.getEnd(), text: value });
      } else {
        kinds.add("text");
        const text = ts.isJsxElement(node) ? textLiteral(ts, sf, node) : undefined;
        if (text === undefined) {
          fail("extract/not-literal", `${path}'s text isn't literal (a string, with nothing computed and no elements in it): a text field's example is the text as written`, node);
          return;
        }
        field.values.push(text.value);
        edits.push({ start: text.start, end: text.end, text: value });
      }
      edits.push({ start: opening.tagName.getEnd(), end: opening.tagName.getEnd(), text: ` field="${path}"` });
    });
    if (kinds.size > 1) fail("extract/field", `${name}'s elements are text and images: a list's items are one kind`, nodes[0]);
    field.kind = kinds.has("image") ? "image" : "text";
    fields.push(field);
  }
  if (diagnostics.some((d) => d.severity === "error")) return { fields, diagnostics };

  // Relative paths, for the template's folder: imports and `src` strings.
  const from = dirname(file);
  const to = dirname(output);
  const rebase = (node: ts.Node) => {
    if (ts.isStringLiteral(node) && /^\.\.?\//.test(node.text)) {
      const parent = node.parent;
      const isImport = (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) && parent.moduleSpecifier === node;
      const isSrc = (ts.isPropertyAssignment(parent) && parent.name.getText(sf) === "src") || (ts.isJsxAttribute(parent) && parent.name.getText(sf) === "src");
      if (isImport || isSrc) edits.push({ start: node.getStart(sf), end: node.getEnd(), text: JSON.stringify(rebasePath(node.text, from, to)) });
    }
    ts.forEachChild(node, rebase);
  };
  rebase(sf);

  const edited = apply(source, edits);
  // Again, edited: the default export replaced by the template, its body the design's.
  const sf2 = parse(edited);
  const again = defaultExport(ts, sf2)!;
  const body = ts.isBlock(again.fn.body!) ? again.fn.body.getText(sf2) : `{\n    return ${again.fn.body!.getText(sf2)};\n  }`;
  const label = options.label ?? labelOf(options.id);
  const spec = fields
    .map((f) => {
      const item = f.kind === "image" ? `field.image({ label: ${JSON.stringify(labelOf(f.name))}, required: true })` : `prop.text({ label: ${JSON.stringify(labelOf(f.name))}, required: true })`;
      return f.list ? `    ${f.name}: prop.list(${item.replace(/, required: true/, "")}, { label: ${JSON.stringify(labelOf(f.name))}, required: true, min: ${f.values.length}, max: ${f.values.length} }),` : `    ${f.name}: ${item},`;
    })
    .join("\n");
  // As written by hand: `["a", "b"]`, `{ src: "…", width: 64, height: 64 }`.
  const literal = (value: unknown): string =>
    Array.isArray(value) ? `[${value.map(literal).join(", ")}]` : value && typeof value === "object" ? `{ ${Object.entries(value).map(([k, v]) => `${k}: ${literal(v)}`).join(", ")} }` : JSON.stringify(value);
  const example = fields.map((f) => `    ${f.name}: ${literal(f.list ? f.values : f.values[0])},`).join("\n");
  const templateText = [
    `export default template({`,
    `  id: ${JSON.stringify(options.id)},`,
    `  // Extracted from ${displayFile(file)}: add its rules (and formats), then set its version ("1.0.0") once it's reviewed.`,
    `  version: "0.1.0",`,
    `  label: ${JSON.stringify(label)},`,
    `  root: ${JSON.stringify(root)},`,
    `  fields: {`,
    spec,
    `  },`,
    `  example: {`,
    example,
    `  },`,
    `  render(v) ${body.replace(/\n/g, "\n  ")},`,
    `});`,
  ].join("\n");
  const replaced = apply(edited, [
    { start: again.statement.getStart(sf2), end: again.statement.getEnd(), text: templateText },
    ...(again.declaration ? [{ start: again.declaration.getFullStart(), end: again.declaration.getEnd(), text: "" }] : []),
  ]);
  // What the template needs from Elements: prop (text fields, lists), and /template's template and field.
  const needsProp = fields.some((f) => f.kind === "text" || f.list);
  const imports = [`import { ${fields.some((f) => f.kind === "image") ? "field, " : ""}template } from "@hyper-elements/react/template";`];
  let withProp = replaced;
  if (needsProp && !importsName(ts, sf2, "@hyper-elements/react", "prop")) {
    // Beside what it imports from Elements already, where it names imports from it; else an import of its own.
    const sf3 = parse(replaced);
    const named = sf3.statements.find((s): s is ts.ImportDeclaration => ts.isImportDeclaration(s) && ts.isStringLiteral(s.moduleSpecifier) && s.moduleSpecifier.text === "@hyper-elements/react" && !s.importClause?.isTypeOnly && !!s.importClause?.namedBindings && ts.isNamedImports(s.importClause.namedBindings));
    const bindings = named?.importClause?.namedBindings as ts.NamedImports | undefined;
    if (bindings?.elements.length) {
      const last = bindings.elements[bindings.elements.length - 1];
      withProp = apply(replaced, [{ start: last.getEnd(), end: last.getEnd(), text: ", prop" }]);
    } else imports.unshift(`import { prop } from "@hyper-elements/react";`);
  }
  const text = withImports(ts, withProp, imports, parse);
  return { text: text.endsWith("\n") ? text : `${text}\n`, fields, diagnostics };

  function displayFile(path: string) {
    return relative(process.cwd(), path).split(sep).join("/") || path;
  }
}

/** The design's component: the function exported as default, and the statements to replace. */
function defaultExport(ts: typeof import("typescript"), sf: ts.SourceFile): { fn: ts.FunctionLikeDeclaration & { body?: ts.ConciseBody }; statement: ts.Statement; declaration?: ts.Statement } | undefined {
  const functionOf = (node: ts.Node | undefined): (ts.FunctionLikeDeclaration & { body?: ts.ConciseBody }) | undefined => {
    let current = node;
    while (current && (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isSatisfiesExpression(current))) current = current.expression;
    return current && (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) && current.body ? current : undefined;
  };
  for (const statement of sf.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.body) {
      const modifiers = ts.getModifiers(statement) ?? [];
      if (modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) && modifiers.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) return { fn: statement, statement };
    }
    if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      const fn = functionOf(statement.expression);
      if (fn) return { fn, statement };
      if (ts.isIdentifier(statement.expression)) {
        const name = statement.expression.text;
        for (const declaration of sf.statements) {
          if (ts.isFunctionDeclaration(declaration) && declaration.name?.text === name && declaration.body) return { fn: declaration, statement, declaration };
          if (ts.isVariableStatement(declaration)) {
            const found = declaration.declarationList.declarations.find((d) => ts.isIdentifier(d.name) && d.name.text === name);
            const fn = functionOf(found?.initializer);
            if (fn && declaration.declarationList.declarations.length === 1) return { fn, statement, declaration };
          }
        }
      }
    }
  }
  return undefined;
}

/** An attribute's literal string value (`id="x"`, `id={"x"}`), or undefined. */
function literalAttribute(ts: typeof import("typescript"), opening: ts.JsxOpeningLikeElement, name: string): string | undefined {
  for (const property of opening.attributes.properties) {
    if (!ts.isJsxAttribute(property) || property.name.getText() !== name || !property.initializer) continue;
    const init = property.initializer;
    if (ts.isStringLiteral(init)) return init.text;
    if (ts.isJsxExpression(init) && init.expression && (ts.isStringLiteral(init.expression) || ts.isNoSubstitutionTemplateLiteral(init.expression))) return init.expression.text;
  }
  return undefined;
}

/** An Image's `src={{ src: "…", width: n, height: n }}`, every value literal, or undefined. */
function imageLiteral(ts: typeof import("typescript"), attribute: ts.JsxAttribute): { src: string; width: number; height: number } | undefined {
  const init = attribute.initializer;
  if (!init || !ts.isJsxExpression(init) || !init.expression || !ts.isObjectLiteralExpression(init.expression)) return undefined;
  const out: Record<string, unknown> = {};
  for (const property of init.expression.properties) {
    if (!ts.isPropertyAssignment(property)) return undefined;
    const key = property.name.getText().replace(/^["']|["']$/g, "");
    const value = property.initializer;
    if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) out[key] = value.text;
    else if (ts.isNumericLiteral(value)) out[key] = Number(value.text);
    else return undefined;
  }
  return typeof out.src === "string" && typeof out.width === "number" && typeof out.height === "number" && Object.keys(out).length === 3 ? (out as { src: string; width: number; height: number }) : undefined;
}

/** An element's children when they're one literal string (text, or `{"…"}`): its value, and the range to replace. */
function textLiteral(ts: typeof import("typescript"), sf: ts.SourceFile, element: ts.JsxElement): { value: string; start: number; end: number } | undefined {
  const children = element.children.filter((child) => !(ts.isJsxText(child) && child.containsOnlyTriviaWhiteSpaces));
  if (children.length !== 1) return undefined;
  const [child] = children;
  const range = { start: element.openingElement.getEnd(), end: element.closingElement.getStart(sf) };
  if (ts.isJsxText(child)) {
    const value = jsxText(child.text);
    return value ? { value, ...range } : undefined;
  }
  if (ts.isJsxExpression(child) && child.expression && (ts.isStringLiteral(child.expression) || ts.isNoSubstitutionTemplateLiteral(child.expression))) {
    // The whitespace around it is JSX's to drop as it does now.
    const around = element.children.every((c) => c === child || (ts.isJsxText(c) && c.containsOnlyTriviaWhiteSpaces && /\n/.test(c.text)));
    return around ? { value: child.expression.text, ...range } : undefined;
  }
  return undefined;
}

function apply(text: string, edits: Edit[]): string {
  // An edit inside another's range (a path rewritten in a src a field replaces) gives way to it.
  const kept = edits.filter((edit) => !edits.some((other) => other !== edit && other.start <= edit.start && other.end >= edit.end && other.end - other.start > edit.end - edit.start));
  let out = text;
  for (const edit of kept.sort((a, b) => b.start - a.start || b.end - a.end)) out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  return out;
}

function importsName(ts: typeof import("typescript"), sf: ts.SourceFile, module: string, name: string): boolean {
  return sf.statements.some(
    (s) =>
      ts.isImportDeclaration(s) &&
      ts.isStringLiteral(s.moduleSpecifier) &&
      s.moduleSpecifier.text === module &&
      !!s.importClause?.namedBindings &&
      ts.isNamedImports(s.importClause.namedBindings) &&
      s.importClause.namedBindings.elements.some((e) => e.name.text === name && !e.isTypeOnly),
  );
}

/** The text with `lines` after its last import (or at its top). */
function withImports(ts: typeof import("typescript"), text: string, lines: string[], parse: (text: string) => ts.SourceFile): string {
  const sf = parse(text);
  const last = [...sf.statements].reverse().find((s) => ts.isImportDeclaration(s));
  const at = last ? last.getEnd() : 0;
  return `${text.slice(0, at)}${last ? "\n" : ""}${lines.join("\n")}${last ? "" : "\n"}${text.slice(at)}`;
}
