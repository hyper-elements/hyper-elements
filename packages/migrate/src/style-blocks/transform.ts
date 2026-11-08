/**
 * `style-blocks`: a Hyper Elements template's `mobile={…}` and `hover={…}` props moved into its `style`, as
 * `style={{ …, mobile: { … }, hover: { … } }}`. Only what's sure to mean the same and to type-check is moved: an object
 * of styles the component takes there (written in place, or a `const` of this file that's an object literal), into a
 * `style` that's an object literal, a `const` like that, or none; what a style spreads must be such a `const` too, with
 * no block of its own. Keys set to `undefined` and blocks left empty, which never did anything, go. Anything else is
 * left as it is, and reported.
 * The rest of the file is kept as it was, character for character.
 */
import ts from "typescript";
import { CONDITION_STYLES } from "./allowed";

const CONDITIONS = ["mobile", "hover"] as const;
type Condition = (typeof CONDITIONS)[number];

export interface StyleBlocksOptions {
  /** Whether an import specifier is the Hyper Elements package (default: "@hyper-elements/react"). */
  isPackage?: (specifier: string) => boolean;
  /** Parse as TypeScript (default) or JavaScript. */
  typescript?: boolean;
}

export interface StyleBlocksResult {
  code: string;
  /** What was left as it was, and why, each "line N: …". */
  report: string[];
  /** How many props were moved into a style, or dropped as doing nothing. */
  moved: number;
  /** Whether the file imports Hyper Elements' components at all. */
  template: boolean;
}

interface Edit {
  start: number;
  end: number;
  text: string;
}

export function styleBlocks(source: string, file = "template.tsx", options: StyleBlocksOptions = {}): StyleBlocksResult {
  const isPackage = options.isPackage ?? ((specifier) => specifier === "@hyper-elements/react");
  const kind = options.typescript === false ? ts.ScriptKind.JSX : ts.ScriptKind.TSX;
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);

  // The local names Hyper Elements' components go by: `import { Text, Button as Cta } from "@hyper-elements/react"`.
  const names = new Map<string, string>();
  for (const statement of sf.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || !isPackage(statement.moduleSpecifier.text)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings) || statement.importClause?.isTypeOnly) continue;
    for (const element of bindings.elements) {
      if (element.isTypeOnly) continue;
      const imported = (element.propertyName ?? element.name).text;
      if (CONDITION_STYLES[imported]) names.set(element.name.text, imported);
    }
  }
  if (!names.size) return { code: source, report: [], moved: 0, template: false };

  const edits: Edit[] = [];
  const report: string[] = [];
  let moved = 0;
  const line = (node: ts.Node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

  /** The component an element is, by its tag: `Text`, or `Document.Page`. */
  const componentOf = (tag: ts.JsxTagNameExpression): string | undefined => {
    if (ts.isIdentifier(tag)) return names.get(tag.text);
    if (ts.isPropertyAccessExpression(tag) && ts.isIdentifier(tag.expression) && names.get(tag.expression.text) === "Document" && tag.name.text === "Page") return "Document.Page";
    return undefined;
  };

  const literalOf = (attribute: ts.JsxAttribute): ts.ObjectLiteralExpression | undefined => {
    const initializer = attribute.initializer;
    if (!initializer || !ts.isJsxExpression(initializer) || !initializer.expression) return undefined;
    let expression = initializer.expression;
    while (ts.isParenthesizedExpression(expression)) expression = expression.expression;
    return ts.isObjectLiteralExpression(expression) ? expression : undefined;
  };

  const keyOf = (property: ts.ObjectLiteralElementLike): string | undefined => {
    if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) return undefined;
    const name = property.name;
    if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) return name.text;
    return undefined;
  };

  // The file's `const` objects, by name: what a spread or a name stands for, where it's written once as an object literal.
  const consts = new Map<string, ts.ObjectLiteralExpression | null>();
  const unwrap = (expression: ts.Expression): ts.Expression => {
    while (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression) || ts.isTypeAssertionExpression(expression)) expression = expression.expression;
    return expression;
  };
  const collectConsts = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const list = node.parent;
      const constant = ts.isVariableDeclarationList(list) && (list.flags & ts.NodeFlags.Const) !== 0;
      const value = node.initializer ? unwrap(node.initializer) : undefined;
      const name = node.name.text;
      consts.set(name, consts.has(name) || !constant || !value || !ts.isObjectLiteralExpression(value) ? null : value);
    } else if ((ts.isParameter(node) || ts.isBindingElement(node)) && ts.isIdentifier(node.name)) {
      // A parameter of that name could be anything.
      consts.set(node.name.text, null);
    }
    ts.forEachChild(node, collectConsts);
  };
  collectConsts(sf);
  /** An object an expression is for sure: an object literal, or the name of a `const` that's one. */
  const objectOf = (expression: ts.Expression): ts.ObjectLiteralExpression | undefined => {
    const value = unwrap(expression);
    if (ts.isObjectLiteralExpression(value)) return value;
    if (ts.isIdentifier(value)) return consts.get(value.text) ?? undefined;
    return undefined;
  };
  /** Whether an object's keys are all known (spreads of such objects included) and none is one of `names`. */
  const known = (object: ts.ObjectLiteralExpression, names: ReadonlySet<string>, seen = new Set<ts.Node>()): boolean => {
    if (seen.has(object)) return false;
    seen.add(object);
    return object.properties.every((property) => {
      if (ts.isSpreadAssignment(property)) {
        const inner = objectOf(property.expression);
        return !!inner && known(inner, names, seen);
      }
      const key = keyOf(property);
      return key !== undefined && !names.has(key);
    });
  };

  const isUndefined = (property: ts.ObjectLiteralElementLike) => ts.isPropertyAssignment(property) && ts.isIdentifier(property.initializer) && property.initializer.text === "undefined";

  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) element(node);
    ts.forEachChild(node, visit);
  };

  const element = (node: ts.JsxOpeningElement | ts.JsxSelfClosingElement) => {
    const component = componentOf(node.tagName);
    if (!component) return;
    const attributes = node.attributes.properties;
    const named = (name: string) => attributes.filter((a): a is ts.JsxAttribute => ts.isJsxAttribute(a) && ts.isIdentifier(a.name) && a.name.text === name);
    const where = `line ${line(node)}: <${component}>`;

    // Each condition prop: its block's text (null: it does nothing, so it goes), or why it stays.
    const blocks: Array<{ condition: Condition; attribute: ts.JsxAttribute; text: string | null }> = [];
    for (const condition of CONDITIONS) {
      const given = named(condition);
      if (!given.length) continue;
      const attribute = given[given.length - 1];
      if (given.length > 1) {
        report.push(`${where}: ${condition} is given more than once: left as it is`);
        continue;
      }
      const expression = attribute.initializer && ts.isJsxExpression(attribute.initializer) ? attribute.initializer.expression : undefined;
      const literal = literalOf(attribute) ?? (expression ? objectOf(expression) : undefined);
      // Given by name (a const of this file): moved by name, so only where nothing in it needs dropping.
      const byName = !literalOf(attribute) && literal && expression ? unwrap(expression).getText(sf) : undefined;
      if (!literal) {
        report.push(`${where}: ${condition}={…} isn't an object literal, so its styles can't be checked: left as it is`);
        continue;
      }
      const allowed = new Set(CONDITION_STYLES[component][condition]);
      const kept: ts.ObjectLiteralElementLike[] = [];
      let unsure: string | undefined;
      for (const property of literal.properties) {
        if (isUndefined(property)) continue;
        const key = keyOf(property);
        if (key === undefined) {
          unsure = `${condition} has ${ts.isSpreadAssignment(property) ? "a spread" : "a computed key"}, so its styles can't be checked`;
          break;
        }
        if (!allowed.has(key)) {
          unsure = `${key} can't be set ${condition === "mobile" ? "for phones" : "for hover"} on a ${component} (it fails when rendered today)`;
          break;
        }
        kept.push(property);
      }
      if (unsure) {
        report.push(`${where}: ${unsure}: left as it is`);
        continue;
      }
      if (byName && kept.length !== literal.properties.length) {
        report.push(`${where}: ${condition}={${byName}} has keys set to undefined, which a block can't take: left as it is`);
        continue;
      }
      const text = !kept.length ? null : byName ?? (kept.length === literal.properties.length ? literal.getText(sf) : `{ ${kept.map((p) => p.getText(sf)).join(", ")} }`);
      blocks.push({ condition, attribute, text });
    }
    if (!blocks.length) return;

    const remove = (attribute: ts.JsxAttribute) => edits.push({ start: attribute.getFullStart(), end: attribute.getEnd(), text: "" });
    const entries = blocks.filter((b) => b.text !== null).map((b) => `${b.condition}: ${b.text}`);

    const styles = named("style");
    if (!entries.length) {
      // Nothing to move: the props did nothing.
      for (const b of blocks) remove(b.attribute);
      moved += blocks.length;
      return;
    }
    if (styles.length > 1) {
      report.push(`${where}: style is given more than once: left as it is`);
      return;
    }
    if (!styles.length) {
      // No style yet: the first moved prop becomes it.
      const [first, ...rest] = blocks;
      edits.push({ start: first.attribute.getStart(sf), end: first.attribute.getEnd(), text: `style={{ ${entries.join(", ")} }}` });
      for (const b of rest) remove(b.attribute);
      moved += blocks.length;
      return;
    }
    const style = styles[0];
    const moving = new Set(blocks.map((b) => b.condition));
    const inStyle = blocks.find((b) => (literalOf(style)?.properties ?? []).some((p) => keyOf(p) === b.condition));
    if (inStyle) {
      report.push(`${where}: style already has ${inStyle.condition}: left as it is`);
      return;
    }
    const literal = literalOf(style);
    const styleExpression = style.initializer && ts.isJsxExpression(style.initializer) ? style.initializer.expression : undefined;
    const constStyle = !literal && styleExpression ? objectOf(styleExpression) : undefined;
    if (!literal && !constStyle) {
      report.push(`${where}: style={…} isn't an object literal, so ${blocks.map((b) => b.condition).join(" and ")} can't be added to it: left as it is`);
      return;
    }
    if (!known(literal ?? constStyle!, moving)) {
      report.push(`${where}: style spreads an object that isn't a const of this file, or may hold ${blocks.map((b) => b.condition).join(" or ")} already: left as it is`);
      return;
    }
    if (constStyle) {
      // style={NAMED}: spread into a literal that adds the blocks.
      edits.push({ start: styleExpression!.getStart(sf), end: styleExpression!.getEnd(), text: `{ ...${unwrap(styleExpression!).getText(sf)}, ${entries.join(", ")} }` });
    } else {
      const last = literal!.properties[literal!.properties.length - 1];
      if (last) edits.push({ start: last.getEnd(), end: last.getEnd(), text: `, ${entries.join(", ")}` });
      else edits.push({ start: literal!.getStart(sf), end: literal!.getEnd(), text: `{ ${entries.join(", ")} }` });
    }
    for (const b of blocks) remove(b.attribute);
    moved += blocks.length;
  };

  visit(sf);
  edits.sort((a, b) => b.start - a.start);
  let code = source;
  for (const edit of edits) code = code.slice(0, edit.start) + edit.text + code.slice(edit.end);
  return { code, report, moved, template: true };
}
