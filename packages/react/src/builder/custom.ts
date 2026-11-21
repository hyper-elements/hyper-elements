/**
 * A template's own elements in the builder. Each is a custom tool of the builder's, named by its type
 * (`acme.ProductCard`: `acme_product_card`), with a property for each prop: edited with the builder's editor for its
 * kind, registerTools()'s own text field, or the control of the property of the team's own it is, each keeping only
 * a value its prop takes (`field.ts`). toDesign() writes one as that
 * tool's block, its props the block's values (`customTools`); fromDesign() reads the block back as the element
 * (`elements`); registerTools() gives a builder the tools, each drawn by Elements itself.
 */
import { checkDocument, ElementsError, expandDocument, propertyOf, registryOf, renderTemplate, type CustomDefinition, type Json, type LinkValue, type Node } from "@hyper-elements/core";
import type { PropertyDefinition } from "../primitives/properties";
import { DECIMAL, listsEmpty } from "../primitives/properties/check";
import { link } from "./blocks";
import { block, type Block, type Hiding } from "./design";
import { checkedControl, textField, unkeptValues } from "./field";
import { composed, listField } from "./list";
import { font, fontWeight, givenId, hidden as hiddenOn, px, sides, TEMPLATE_ID, webLink, type Sides, type Values } from "./read-values";
import { make, obj, placed, type Context } from "./reading";
import { sayUnread } from "./unread";
import { builderFont, builderLink, cssSides, decode, encode } from "./values";

/** A template's own element, as `defineElement()` makes one. */
export interface WithDefinition {
  definition: CustomDefinition<any>;
}

/** The builder's name for an element's tool, from the element or its type: the type in the builder's words (`acme.ProductCard`: `acme_product_card`). */
export function toolName(element: string | WithDefinition): string {
  const type = typeof element === "string" ? element : element?.definition?.type;
  if (typeof type !== "string") throw new Error("[Elements] toolName takes a template's own element (made with defineElement()) or its type");
  return type
    .replace(/[.-]/g, "_")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase();
}

/** Each element's definition by its tool's name. Two with one name is an error: a block would be either's. */
export function toolsOf(elements: readonly WithDefinition[] = []): Map<string, CustomDefinition<any>> {
  const tools = new Map<string, CustomDefinition<any>>();
  for (const element of elements) {
    const definition = element?.definition;
    if (!definition?.custom) throw new Error("[Elements] elements takes a template's own elements (made with defineElement())");
    const name = toolName(definition.type);
    const other = tools.get(name);
    if (other && other !== definition) throw new Error(`[Elements] ${other.type} and ${definition.type} are one tool in the builder (${name}): rename one`);
    tools.set(name, definition);
  }
  return tools;
}

/** Whether an element is placed where a Section goes: a band across the window, which no block in a column is, so it's no tool. */
const inSection = (definition: CustomDefinition<any>): boolean => definition.categories.includes("section");

/** A block's values that are the builder's own: its spacing, its place, and what its user may do with it. */
const BLOCK_VALUES = ["containerPadding", "anchor", "displayCondition", "hideDesktop", "hideMobile", "selectable", "draggable", "duplicatable", "deletable", "hideable", "locked"];
/** Whether a block's value is the builder's own, by its name: one of those, or one that starts as its own do (`_…`). */
const builders = (key: string): boolean => key.startsWith("_") || BLOCK_VALUES.includes(key);
/** A prop that a block can't keep under its name, which is one of the builder's own there: none where it keeps them all. */
export const unkept = (definition: CustomDefinition<any>): string | undefined => Object.keys(definition.props).find(builders);

type Spec = CustomDefinition<any>["props"][string];
type Schema = { type?: string; minimum?: number; maximum?: number; enum?: Json[]; anyOf?: Schema[] };

/** One of the builder's property editors for a prop: its name there, what it takes besides the value, and the value as it keeps one and as that's read back. */
interface PropertyEditor {
  widget: string;
  /** Edited with registerTools()'s own text field (`field.ts`) in its place, which keeps only a value the prop takes. */
  field?: true;
  /** Edited with registerTools()'s own field for a list, an object or a list of blocks (`list.ts`). */
  list?: true;
  data?: Values;
  store?(value: Json): unknown;
  read?(value: unknown, say: (message: string) => void): unknown;
}

/** A number as a field of the builder's keeps one: the number, or its digits as it's written in decimal ("0x10" isn't one, as its field says). */
const numeric = (value: unknown): unknown => (typeof value === "string" && DECIMAL.test(value.trim()) ? Number(value) : value);
const options = (values: readonly Json[]): Values => ({ options: values.map((value) => ({ label: String(value), value: String(value) })) });
/** The builder's counter, which keeps whole numbers: from `min` (where there's none, below zero too, where its own floor is). */
const counter = (min?: number, max?: number): PropertyEditor => ({ widget: "counter", data: { minValue: min ?? -1e9, ...(max === undefined ? {} : { maxValue: max }) }, read: numeric });
/** A text field, for a number that isn't whole and a length with a unit: it keeps text (and the builder gives a tool nothing for a number, so one is written as text). */
const typed: PropertyEditor = { widget: "text", field: true, store: String, read: numeric };
const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

/**
 * What the builder keeps for a prop, as the JSON schema its AI fills a field by: the prop's own, or text where it keeps
 * the value as text (a number that isn't whole, a choice as its text), with the choices as text. None where it keeps a
 * value its own way (a link, an image, a font), which the prop's schema doesn't describe.
 */
function keptSchema(spec: Spec, editor: PropertyEditor | undefined): unknown {
  if (editor?.store === String) {
    if (spec.kind.editor === "text") return spec.kind.jsonSchema();
    const choices = (spec.kind.jsonSchema() as Schema).enum;
    return choices ? { type: "string", enum: choices.map(String) } : { type: "string" };
  }
  return editor?.store ? undefined : spec.kind.jsonSchema();
}

/**
 * The builder's editor for a prop, by its kind, and so how its value is kept in a block (a property of a team's own
 * keeps its value as its kind's does, whatever edits it). None for a kind it has no way to keep: its value stays in
 * the block, with no field.
 */
function editorOf(spec: Spec): PropertyEditor | undefined {
  const schema = spec.kind.jsonSchema() as Schema;
  switch (spec.kind.editor) {
    case "text":
      return { widget: "text", field: true };
    case "color":
      // A color that can't be see-through (`transparency: false`): the builder's picker is told so, and has no
      // opacity to set and no "transparent" to pick, where it takes that (`allowTransparent`). One that doesn't keeps
      // what's picked, and the block says why it can't be drawn, as a value saved so would.
      return spec.kind.parse("transparent").ok ? { widget: "color_picker" } : { widget: "color_picker", data: { allowTransparent: false } };
    case "toggle":
      return { widget: "toggle" };
    case "number":
      return schema.type === "integer" ? counter(schema.minimum, schema.maximum) : typed;
    case "length":
      // Px alone (a number) is the counter's; with another unit ("50%"), text.
      return ["%", "pt", "mm", "in"].some((unit) => spec.kind.parse(`99999${unit}`).ok) ? typed : counter(schema.anyOf?.[0]?.minimum);
    case "fontWeight":
      return { widget: "dropdown", data: options(WEIGHTS), store: (value) => String(fontWeight(value) ?? value), read: (value) => fontWeight(value) ?? value };
    case "choice": {
      // The builder's dropdown keeps text: a number among the choices is that number.
      const values = schema.enum ?? [];
      return { widget: "dropdown", data: options(values), store: String, read: (value) => values.find((choice) => String(choice) === String(value)) ?? value };
    }
    case "link":
      return { widget: "link", store: (value) => builderLink(value as LinkValue), read: (value, say) => link(value, say) };
    case "image":
      return { widget: "image", store: (value) => encode("asset", value), read: (value) => (obj(value).url ? decode("asset", value) : undefined) };
    case "fontFamily":
      return { widget: "font_family", store: (value) => builderFont(String(value)), read: font };
    case "items":
      // A list, an object or a list of blocks, which none of the builder's editors holds: registerTools()'s own.
      return composed(spec) ? { widget: "elements_list", list: true } : undefined;
    default:
      return undefined;
  }
}

/**
 * An element's props as its tool's values: each as the builder's editor for it keeps one. A prop that isn't given is
 * written as its default, as the builder writes a tool's defaults, so its field shows what's drawn (toolProps() leaves
 * a default out again).
 */
export function toolValues(definition: CustomDefinition<any>, props: Record<string, Json> = {}): Values {
  const values: Values = {};
  for (const [key, spec] of Object.entries(definition.props) as Array<[string, Spec]>) {
    const editor = editorOf(spec);
    const value = props[key] ?? (editor ? (spec.default as Json | undefined) : undefined);
    if (value !== undefined) values[key] = editor?.store?.(value) ?? value;
  }
  return values;
}

/** A value of a tool's that its prop doesn't take: the prop, the value as the block keeps it, and why. */
export interface Refused {
  key: string;
  kept: unknown;
  reason: string;
}

/** Whether a field's value is what the builder keeps for one its user emptied: nothing for its prop. */
const emptied = (spec: Spec, kept: unknown): boolean =>
  kept === "" || (spec.kind.editor === "link" && webLink(kept) === null) || (spec.kind.editor === "image" && !obj(kept).url) || (spec.kind.editor === "fontFamily" && font(kept) === undefined && (typeof kept !== "object" || obj(kept).value === ""));

/**
 * A tool's values as its element's props: each read back and checked by its kind. One it doesn't take is left out,
 * and given to `refuse`.
 */
export function toolProps(definition: CustomDefinition<any>, values: Values, say: (message: string) => void = () => {}, refuse: (refused: Refused) => void = () => {}): Record<string, Json> {
  const props: Record<string, Json> = {};
  for (const [key, spec] of Object.entries(definition.props) as Array<[string, Spec]>) {
    const kept = values[key];
    if (!Object.hasOwn(values, key) || kept === undefined || kept === null) continue;
    const editor = editorOf(spec);
    // What reading it says is said once it's taken: of one refused, the refusal says it all.
    const heard: string[] = [];
    let given = editor?.read ? editor.read(kept, (message) => heard.push(message)) : kept;
    // A link its user emptied, where the prop has one by default, is a link to nothing: not its default again.
    if (given === undefined && spec.kind.editor === "link" && spec.default !== undefined && webLink(kept) === null) given = { href: "" };
    if (given === undefined) {
      // One that holds something its field can't read as its kind (a link with a target or a class of its own) isn't
      // taken: read as nothing, the block would be drawn with the prop's default instead.
      if (!emptied(spec, kept)) refuse({ key, kept, reason: spec.kind.editor === "link" ? "a link Elements draws is a URL, opened in the same tab or a new one, with no class, attributes or click handler of its own" : `it isn't a ${spec.kind.editor} Elements reads` });
      else heard.forEach(say);
      continue;
    }
    heard.forEach(say);
    // A text its element needs, left empty (as a block dragged in starts), is none: its field says it's needed. Where
    // the empty text is one of the values the prop lists, it's that value.
    if (given === "" && spec.required && !listsEmpty(spec)) continue;
    const parsed = spec.kind.parse(given);
    // Its default is what the element takes anyway: not written, as a template wouldn't. One it needs is given
    // either way (a template has to give it), its default too.
    if (parsed.ok && !spec.required && JSON.stringify(parsed.value) === JSON.stringify(spec.default)) continue;
    if (parsed.ok) props[key] = parsed.value;
    // A field its user emptied is the prop not given.
    else if (given !== "") refuse({ key, kept, reason: parsed.message });
  }
  return props;
}

/** A template's own element as its tool's block in a design. */
export function customBlock(node: Node, definition: CustomDefinition<any>, around: Sides, hiding: Hiding): Block {
  const name = toolName(definition.type);
  const id = node.id ? { _meta: { htmlID: node.id, htmlClassNames: `u_content_custom_${name}` } } : {};
  return { ...block("custom", hiding), custom: name, values: { ...toolValues(definition, node.props), containerPadding: cssSides(around), ...id } };
}

/** A custom tool's block as its element, where it's one of those given; none where it isn't, and said. */
export function readCustom(slug: unknown, values: Values, context: Context, tools: Map<string, CustomDefinition<any>>, root: "Email" | "Page" | "Document" = "Email"): Node[] {
  const definition = typeof slug === "string" ? tools.get(slug) : undefined;
  if (!definition) {
    context.say(`${typeof slug === "string" ? `the custom tool ${JSON.stringify(slug)}` : "a custom tool"} of the builder's is none of the elements given (fromDesign()'s elements): left out`);
    return [];
  }
  const tool = `the custom tool ${JSON.stringify(slug)}`;
  // Registered before registerTools() left these out, or written by hand: a block in a column, where it can't go.
  if (inSection(definition)) {
    context.say(`${tool} is a ${definition.type}'s, which goes where a Section does, not in a column: left out`);
    return [];
  }
  // (registerTools() refuses one: written by hand.)
  const taken = unkept(definition);
  if (taken) {
    context.say(`${tool} is a ${definition.type}'s, whose prop ${taken} is the builder's own in a block: left out`);
    return [];
  }
  const refused: Refused[] = [];
  const props = toolProps(definition, values, context.say, (one) => refused.push(one));
  // A block with a value its prop doesn't take, which the builder can't draw or export (registerTools()): drawn with
  // the prop's default instead, it would be another block than the one its user set.
  if (refused.length) {
    context.say(`${tool} has ${refused.map((one) => `its ${one.key} ${JSON.stringify(one.kept)} (${one.reason})`).join(" and ")}, which a ${definition.type} doesn't take: left out`);
    return [];
  }
  // A block dragged in and not filled yet, whose export fails in the builder too: with it, the template
  // wouldn't render.
  const missing = Object.keys(definition.props).filter((key) => definition.props[key].required && !Object.hasOwn(props, key));
  if (missing.length) {
    context.say(`${tool} has no ${missing.join(" or ")}, which a ${definition.type} needs: left out`);
    return [];
  }
  // The element as it's placed in the template (in a Column, where its block has padding).
  const placeAs = (node: Node) => placed(node, sides(values.containerPadding ?? "10px"), undefined, sides(obj(obj(values._override).mobile).containerPadding), hiddenOn(values));
  // Values its props each take that its element's render doesn't (two that don't go together), or what it draws that
  // can't be where it's placed (a page break in a Column), which the builder's canvas, audit and export say: with it,
  // the template wouldn't render. Checked without its id, which is read as fromDesign() reads ids (one a template
  // doesn't take is left out).
  const problem = renderProblem([...tools.values()], root, placeAs(make(definition.type, { props })));
  if (problem) {
    context.say(`${tool} can't be drawn with its values (${problem}): left out`);
    return [];
  }
  // What the builder keeps on any block that an element has no place for is said, as a built-in block's is: a display
  // condition, an anchor, a prop's value on phones. A value that's neither the builder's own nor a prop's is the
  // tool's own (registerTools()'s `properties`): it stays in the block, and isn't the element's.
  const read = Object.keys(definition.props);
  const its = (kept: unknown): Values => Object.fromEntries(Object.entries(obj(kept)).filter(([key]) => read.includes(key) || builders(key)));
  const devices = obj(values._override);
  sayUnread("custom", { ...its(values), _override: { ...devices, mobile: its(devices.mobile) } }, undefined, context.say, { values: [...read, "containerPadding"], phone: ["containerPadding", "hideMobile"] });
  return [placeAs(make(definition.type, { id: givenId(values), props }))];
}

// ─── The tools, in a builder ─────────────────────────────────────────────────

/** The part of the builder's `unlayer` object registerTools() uses. */
export interface Builder {
  registerTool(tool: Record<string, unknown>): void;
  /** `place` is where the block is: its row's cells and its column's index. The builder gives a canvas no values of its column (it gives them to what it exports): where one does, `columnValues`, they're read. */
  createViewer(viewer: { render(values: Values, body?: Values, place?: { columnIndex?: number; rowCells?: number[]; columnValues?: Values }): string }): unknown;
  /** For registerTools()'s own text fields, and the editors given as they're written (`editors`). */
  registerPropertyEditor(editor: { name: string; Widget: unknown }): void;
  createWidget(widget: { render(value: unknown, update: (value: unknown) => void, data?: unknown): string; mount(node: HTMLElement, value: unknown, update: (value: unknown) => void, data?: unknown): void; schema?: unknown }): unknown;
}

/** What an editor of a team's own is given besides the value: its prop's label, and its options as the prop has them. */
export type EditorOptions<D = unknown> = { label: string } & (D extends PropertyDefinition<any, infer O> ? O : { [name: string]: Json });
type Edited<D> = D extends PropertyDefinition<infer V, any> ? V : Json;

/**
 * A property editor of a team's own, as the builder takes one: the control of a property a template defines
 * (`EditorWidget<typeof currency>` types its value and options as the property's). It's given its prop's value as
 * the prop has it (a price as a number), none where the block has one the prop doesn't take, and gives back the same.
 * What it gives back is kept only where the prop takes it (checkValue()): where it doesn't, the block keeps the value
 * it had, and the builder says why under the control. So a control that shows what its user typed may show a value
 * that isn't kept yet, with why.
 */
export interface EditorWidget<D = unknown> {
  /** Its markup. The builder draws nothing around an editor that isn't its own: its label is here too. */
  render(value: Edited<D> | undefined, update: (value: Edited<D> | undefined) => void, options: EditorOptions<D>): string;
  /** Once its markup is in the page: where it listens, and calls `update` with the new value. */
  mount?(node: HTMLElement, value: Edited<D> | undefined, update: (value: Edited<D> | undefined) => void, options: EditorOptions<D>): void;
}

export interface RegisterToolsOptions {
  /**
   * The builder's display mode, which says what the canvas draws: an Email's markup ("email", the default), or a Page's
   * ("web", and "document", where the builder prints what it exports).
   */
  displayMode?: "email" | "web" | "document";
  /** Each tool's icon in the builder's panel, by its element's type: a Font Awesome class, an image's URL or an SVG. */
  icons?: Record<string, string>;
  /**
   * The property editors of a team's own, by name (`{ [currency.name]: … }`, the name its property has): each as
   * it's written (`{ render, mount }`), which registerTools() registers in the builder; or `true` for one registered
   * there already (`unlayer.registerPropertyEditor`), which is given the value as the builder keeps it. A property
   * with no control here is edited with its kind's editor, as any other prop is. A name here that's the property of
   * no prop of the elements is refused: a name mistyped, or one of the builder's own editors, which are its kinds'.
   */
  editors?: { readonly [name: string]: EditorWidget | true };
  /** The builder's own settings for an element's tool, by the element's type. */
  tools?: Record<string, ToolSettings>;
}

/** What a tool has in the builder beside what its element gives it. */
export interface ToolSettings {
  /**
   * Properties of the tool that aren't the element's props, shown above its own, each as the builder takes one
   * (`{ label, widget, defaultValue }`): a picker that fills several props at once, with the tool's `transformer`.
   * Their values are kept in the block; they aren't the element's.
   */
  properties?: Record<string, Record<string, unknown>>;
  /**
   * Any other setting the builder's `registerTool()` takes (`transformer`, `position`, `usageLimit`…), passed as it
   * is. A `validator` runs after the tool's own, which says what stops a block from being drawn, and its errors
   * follow. What the element gives its tool is none of them, and is refused: its name, label, fields and drawing,
   * its icon (`icons`), and what a block starts with (each prop's `default`).
   */
  [setting: string]: unknown;
}

/** What an element gives its tool, which is no setting of the builder's for it. */
const GIVEN = ["name", "label", "icon", "supportedDisplayModes", "options", "values", "renderer"];

const escape = (text: string) => text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * The room a block has where the builder draws it: its column's share of the content width, less the column's own
 * padding and border (`column`, its values, where the builder gives them) and the block's own spacing. Rounded down:
 * drawn any wider than its room, a Row in it has its columns one under the other.
 */
function roomOf(values: Values, content: number, cells: number[] | undefined, index: number | undefined, column: Values): number {
  const total = (cells ?? []).reduce((sum, cell) => sum + cell, 0);
  const share = total && cells && index !== undefined && cells[index] ? cells[index] / total : 1;
  const own = sides(values.containerPadding ?? "10px");
  const around = sides(column.padding);
  const lines = obj(column.border);
  const taken = [own?.left, own?.right, around?.left, around?.right, px(lines.borderLeftWidth), px(lines.borderRightWidth)].reduce<number>((sum, part) => sum + (part ?? 0), 0);
  return Math.max(1, Math.floor(content * share - taken));
}

/**
 * An element drawn on its own from its tool's values, as an Email's markup or a Page's, with its stylesheet: at the
 * room its block has, which is its column's share (`cells`, `index`) of the builder's content width (`body`), less
 * what's around it there (`column`).
 */
function draw(definition: CustomDefinition<any>, tools: readonly CustomDefinition<any>[], root: "Email" | "Page", values: Values, body: Values | undefined, cells: number[] | undefined, index: number | undefined, column: Values = {}): string {
  const content = px(obj(body).contentWidth) ?? 600;
  const room = roomOf(values, content, cells, index, column);
  // A root is 200px wide at least: in less room than that, the element is in a Column of the room's width.
  const width = Math.max(200, room);
  // With the id its block keeps, as fromDesign() reads it: the ids inside it are that id's (a link to one finds it). One
  // a template doesn't take is left out, as fromDesign() leaves it out, and the element is drawn without it.
  const given = givenId(values);
  // A value its prop doesn't take stops it, as a required prop with none does: drawn with the prop's default, the
  // block would show and export another value than its field holds.
  const refused: Refused[] = [];
  const props = toolProps(definition, values, undefined, (one) => refused.push(one));
  if (refused.length) throw new Error(refused.map((one) => `its ${one.key} ${JSON.stringify(one.kept)} isn't one it takes (${one.reason})`).join("; "));
  const own: Node = make(definition.type, { id: given && TEMPLATE_ID.test(given) ? given : undefined, props });
  const node: Node = room < width ? { type: "Column", style: { width: room }, children: [own] } : own;
  const written = renderTemplate({ root: { type: root, props: { width }, children: [node] } }, { components: tools });
  const style = /<style>[\s\S]*?<\/style>/.exec(written.head)?.[0] ?? "";
  // An Email is on a phone below its own width, which here is its block's: its styles for phones start where the
  // whole email's do, which is also where the builder stacks its columns.
  const queries = root === "Email" ? style.replace(/(@media \(m(?:ax|in)-width: )(\d+)(?=px\))/g, (_, query: string, at: string) => `${query}${Number(at) - width + content}`) : style;
  // A page's <main> is centered by its margins, which shrink it to its words in a flex box: it fills its block.
  return queries + written.body.replace(/^<main style="/, '<main style="width:100%;');
}

/** What stopped a drawing, in words: the first of an error's problems. */
const problemOf = (error: unknown): string => (error instanceof ElementsError ? error.diagnostics[0]?.message : undefined) ?? String((error as Error)?.message ?? error);

/**
 * A diagnostic as plain text wherever it's put. It says what a field holds, as its user typed it, and the builder
 * writes an export's error in place of its HTML, as HTML: a value there (`<img src=x onerror=…>`) would be markup. So
 * `<`, `>` and `&` are written as a JSON string writes them escaped (`<`), which is text in HTML, and that same
 * character read as JSON.
 */
const plain = (text: string): string => text.replace(/[<>&]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);

/**
 * What stops an element's tool from drawing its block (`values`, as toDesign() writes them) as the builder exports it:
 * on its own, at the room its column leaves it (`body`'s content width, the row's `cells`, the column's `index` and
 * values), with no template around it, so with no theme (a theme's token in its render is none there). None where it
 * draws.
 */
export function toolProblem(definition: CustomDefinition<any>, tools: readonly CustomDefinition<any>[], root: "Email" | "Page", values: Values, body: Values, cells: number[], index: number, column: Values): string | undefined {
  try {
    draw(definition, tools, root, values, body, cells, index, column);
    return undefined;
  } catch (error) {
    return problemOf(error);
  }
}

/**
 * What stops a block (its values as the design keeps them, as typed) from being drawn at any room: a value its prop
 * doesn't take, none for a prop its element needs, or what its element's render does with them (an error it throws,
 * a theme's token, which the builder has no theme for). Checked and expanded, not laid out: what depends on the room
 * a block has (an image wider than it) isn't said, as the builder gives a validator no place to draw the block at.
 */
function auditProblem(definition: CustomDefinition<any>, tools: readonly CustomDefinition<any>[], root: "Email" | "Page", values: Values): string | undefined {
  const refused: Refused[] = [];
  const props = toolProps(definition, values, undefined, (one) => refused.push(one));
  if (refused.length) return refused.map((one) => `its ${one.key} ${JSON.stringify(one.kept)} isn't one it takes (${one.reason})`).join("; ");
  const missing = Object.keys(definition.props).filter((key) => definition.props[key].required && !Object.hasOwn(props, key));
  if (missing.length) return `it has no ${missing.join(" or ")}, which it needs`;
  return renderProblem(tools, root, make(definition.type, { props }));
}

/**
 * What stops an element (`child`, as it's placed) from rendering under a root: what its render does with its props (an
 * error it throws for two that don't go together, a theme's token), or what it draws that can't be where it's placed.
 * None where it renders.
 */
function renderProblem(tools: readonly CustomDefinition<any>[], root: "Email" | "Page" | "Document", child: Node): string | undefined {
  const registry = registryOf({ components: [...tools] });
  // Under the root it's read in: a prop may be one some roots alone take. A Document has no width of its own.
  const checked = checkDocument({ root: { type: root, props: root === "Document" ? {} : { width: 600 }, children: [child] } }, registry);
  const found = [...checked.diagnostics];
  if (checked.document && !found.some((d) => d.severity === "error")) found.push(...expandDocument(checked.document, registry, root === "Email" ? "email" : "web").diagnostics);
  return found.find((d) => d.severity === "error")?.message;
}

/** An error of the builder's audit, as a tool's validator gives one. */
interface AuditError {
  id: string;
  icon: string;
  severity: "ERROR" | "WARNING";
  title: string;
  description: string;
}

/**
 * Registers each element as a custom tool in a builder (in its custom JavaScript, where `unlayer.registerTool` is):
 * the tool's name is its type's (`toolName()`), its properties its props, each with the builder's editor for its kind
 * or the control of the property of the team's own it is (`editors`), and it's drawn by Elements, in the
 * canvas and in what the builder exports. An element placed where a Section goes is no tool (toDesign() writes it as
 * an HTML block). Returns the tools' names.
 */
export function registerTools(builder: Builder, elements: readonly WithDefinition[], options: RegisterToolsOptions = {}): string[] {
  const tools = toolsOf(elements);
  // Every element given, for the ones a tool's own renders.
  const all = [...tools.values()];
  for (const [name, definition] of tools) if (inSection(definition)) tools.delete(name);
  // A document's blocks are drawn as a page's: the builder prints what it exports, with its own page size and margins,
  // which a Document's markup would set again.
  const canvas = options.displayMode === "web" || options.displayMode === "document" ? "Page" : "Email";
  const editors = options.editors ?? {};
  // An editor given for no prop is a name mistyped: its prop would be edited with its kind's, without a word. A name
  // of the builder's own editors is none of these: those are its kinds'.
  const asked = new Set(all.flatMap((definition) => (Object.values(definition.props) as Spec[]).flatMap((spec) => propertyOf(spec)?.name ?? [])));
  for (const name of Object.keys(editors)) {
    if (!asked.has(name)) throw new Error(`[Elements] registerTools: editors has ${name}, which is the property of no prop of the elements given (${asked.size ? `their props are ${[...asked].join(", ")}` : "none of their props is a property of your own"})`);
  }
  for (const type of Object.keys(options.tools ?? {})) {
    if (!all.some((definition) => definition.type === type)) throw new Error(`[Elements] registerTools: tools has settings for ${type}, which is none of the elements given`);
  }
  for (const [name, definition] of tools) {
    const taken = unkept(definition);
    if (taken) throw new Error(`[Elements] registerTools: ${definition.type} has a prop named ${taken}, which is the builder's own in a block: as a tool, it takes another name`);
    const { properties: own = {}, ...settings } = options.tools?.[definition.type] ?? {};
    for (const key of Object.keys(own)) {
      if (Object.hasOwn(definition.props, key)) throw new Error(`[Elements] registerTools: ${definition.type} has a prop named ${key}: a property of the tool's own takes another name`);
    }
    const given = GIVEN.find((key) => Object.hasOwn(settings, key));
    if (given) throw new Error(`[Elements] registerTools: tools sets ${given} for ${definition.type}, which its element gives the tool: its label and props are the element's, a block starts with each prop's default, and its icon is in icons`);
    const properties: Record<string, unknown> = { ...own };
    for (const [key, spec] of Object.entries(definition.props) as Array<[string, Spec]>) {
      const editor = editorOf(spec);
      // The control of the team's own, where the prop is a property of theirs given one; the builder's otherwise.
      const named = propertyOf(spec);
      const theirs = named && Object.hasOwn(editors, named.name) ? editors[named.name] : undefined;
      let widget = theirs ? named?.name : editor?.widget;
      if (!widget || spec.editable === false) continue;
      const theirOptions: EditorOptions = { label: spec.label, ...named?.options };
      // The value as the builder keeps it, as the prop has it (a price as a number, where the builder keeps one that
      // isn't whole as text), and the other way.
      const read = (kept: unknown) => (editor?.read ? editor.read(kept, () => {}) : kept);
      const store = (value: Json) => editor?.store?.(value) ?? value;
      if (theirs && theirs !== true) {
        // Given as it's written: registered for this prop, checked (field.ts).
        if (typeof builder.registerPropertyEditor !== "function" || typeof builder.createWidget !== "function") throw new Error(`[Elements] registerTools: editors gives ${widget} as it's written, which takes a builder with registerPropertyEditor() and createWidget()`);
        widget = `${widget.replace(".", "_")}__${name}__${key}`;
        builder.registerPropertyEditor({ name: widget, Widget: builder.createWidget(checkedControl(spec, spec.label, definition.label, theirs, theirOptions, read, store, keptSchema(spec, editor))) });
      } else if (!theirs && editor?.field) {
        // A text, and a number or a length the builder keeps as text: registerTools()'s own field (field.ts).
        if (typeof builder.registerPropertyEditor !== "function" || typeof builder.createWidget !== "function") throw new Error(`[Elements] registerTools: ${definition.type}'s ${key} is edited with a text field of its own, which takes a builder with registerPropertyEditor() and createWidget()`);
        widget = `elements_text__${name}__${key}`;
        builder.registerPropertyEditor({ name: widget, Widget: builder.createWidget(textField(spec, spec.label, definition.label, (value) => String(store(value)))) });
      } else if (!theirs && editor?.list && composed(spec)) {
        // A list, an object or a list of blocks: registerTools()'s own field (list.ts), its value the prop's as it is.
        if (typeof builder.registerPropertyEditor !== "function" || typeof builder.createWidget !== "function") throw new Error(`[Elements] registerTools: ${definition.type}'s ${key} is edited with a field of its own, which takes a builder with registerPropertyEditor() and createWidget()`);
        widget = `elements_list__${name}__${key}`;
        builder.registerPropertyEditor({ name: widget, Widget: builder.createWidget(listField(spec, spec.label, definition.label)) });
      }
      // The builder's own editor takes what the prop's kind gives it (a number's limits); the options of a team's own
      // editor that isn't given here are that editor's alone.
      const data: Values = theirs ? theirOptions : { ...editor?.data };
      // What a block dragged in from the panel starts with: the prop's default, as the editor keeps it. With none, a
      // text is empty and a toggle is off; any other has no value, which each of the builder's editors shows as unset.
      const initial =
        spec.default !== undefined
          ? (editor?.store?.(spec.default as Json) ?? spec.default)
          : spec.kind.editor === "text"
            ? ""
            : spec.kind.editor === "toggle"
              ? false
              : editor?.list && (spec as { fields?: unknown }).fields === undefined
                ? []
                : undefined;
      properties[key] = { label: spec.label, ...(initial !== undefined ? { defaultValue: initial } : {}), widget, ...(Object.keys(data).length ? { data } : {}) };
    }
    // What the builder exports: the element as that output's markup. Where its values can't be drawn, the export
    // fails, saying which block and why (the builder writes that in place of the HTML): left out, the block would be
    // missing from an export that looks whole. It fails too while a field holds a value that isn't kept: the block
    // has the value it had, not the one its user sees. What it says is plain text (plain()).
    const written = (root: "Email" | "Page") => (values: Values, ...rest: unknown[]) => {
      const held = unkeptValues();
      if (held.length) throw new Error(plain(`[Elements] ${held.join("; ")}: correct it to export`));
      const meta = obj(rest[rest.length - 1]);
      const cells = (Array.isArray(rest[2]) ? rest[2] : meta.rowCells) as number[] | undefined;
      const index = (typeof rest[1] === "number" ? rest[1] : meta.columnIndex) as number | undefined;
      try {
        return draw(definition, all, root, values, obj(rest[3] ?? meta.bodyValues), cells, index, obj(meta.columnValues));
      } catch (error) {
        throw new Error(plain(`[Elements] ${definition.label} (${definition.type}) can't be drawn: ${problemOf(error)}`));
      }
    };
    builder.registerTool({
      ...settings,
      name,
      label: definition.label,
      icon: options.icons?.[definition.type] ?? "fa-cube",
      supportedDisplayModes: ["web", "email", "document"],
      options: Object.keys(properties).length ? { [name]: { title: definition.label, position: 1, options: properties } } : {},
      values: {},
      renderer: {
        // The canvas: the element as drawn, or what stops it from being: a value a design was saved with that its prop
        // doesn't take (its field says which, to be corrected), a required prop with no value yet.
        Viewer: builder.createViewer({
          render(values, body, place) {
            try {
              return draw(definition, all, canvas, values, body, place?.rowCells, place?.columnIndex, obj(place?.columnValues));
            } catch (error) {
              return `<div style="padding:12px;border:1px dashed #b91c1c;color:#b91c1c;font:13px/1.4 sans-serif">${escape(`${definition.label}: ${problemOf(error)}`)}</div>`;
            }
          },
        }),
        exporters: { email: written("Email"), web: written("Page"), document: written("Page") },
        head: { css: () => "", js: () => "" },
      },
      // The builder's audit (its Audit tab, unlayer.audit()): a block that can't be drawn at any room, which the
      // canvas says and whose export fails, is an error at the block's place (auditProblem()). A
      // validator given in `tools` runs too, and its errors follow.
      validator(data: { values?: Values; defaultErrors?: unknown[] } = {}) {
        const problem = auditProblem(definition, all, canvas, obj(data.values));
        const ours: AuditError[] = problem ? [{ id: "HYPER_ELEMENTS_TOOL_VALUES", icon: "fa-exclamation-triangle", severity: "ERROR", title: `${definition.label} can't be drawn`, description: problem }] : [];
        const theirs = typeof settings.validator === "function" ? (settings.validator as (data: unknown) => unknown)(data) : (data.defaultErrors ?? []);
        const after = (errors: unknown) => [...ours, ...(Array.isArray(errors) ? errors : [])];
        const pending = theirs as PromiseLike<unknown> | undefined;
        return typeof pending?.then === "function" ? pending.then(after) : after(theirs);
      },
    });
  }
  return [...tools.keys()];
}
