/**
 * A template's own components in the builder. Each is a custom tool of the builder's, named by its type
 * (`acme.ProductCard`: `acme_product_card`), with a property for each prop: edited with the builder's editor for its
 * kind, or with the control of the property of the team's own it is. toDesign() writes one as that
 * tool's block, its props the block's values (`customTools`); fromDesign() reads the block back as the component
 * (`components`); registerTools() gives a builder the tools, each drawn by Elements itself.
 */
import { ElementsError, propertyOf, renderTemplate, type CustomDefinition, type Json, type LinkValue, type Node } from "@hyper-elements/core";
import type { PropertyDefinition } from "../primitives/custom";
import { link } from "./blocks";
import { block, type Block, type Hiding } from "./design";
import { font, fontWeight, givenId, hidden as hiddenOn, px, sides, webLink, type Sides, type Values } from "./read-values";
import { make, obj, placed, type Context } from "./reading";
import { sayUnread } from "./unread";
import { builderFont, builderLink, cssSides, decode, encode } from "./values";

/** A template's own component, as `component()` makes one. */
export interface WithDefinition {
  definition: CustomDefinition<any>;
}

/** The builder's name for a component's tool, from the component or its type: the type in the builder's words (`acme.ProductCard`: `acme_product_card`). */
export function toolName(component: string | WithDefinition): string {
  const type = typeof component === "string" ? component : component?.definition?.type;
  if (typeof type !== "string") throw new Error("[Elements] toolName takes a template's own component (made with component()) or its type");
  return type
    .replace(/[.-]/g, "_")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase();
}

/** Each component's definition by its tool's name. Two with one name is an error: a block would be either's. */
export function toolsOf(components: readonly WithDefinition[] = []): Map<string, CustomDefinition<any>> {
  const tools = new Map<string, CustomDefinition<any>>();
  for (const component of components) {
    const definition = component?.definition;
    if (!definition?.custom) throw new Error("[Elements] components takes a template's own components (made with component())");
    const name = toolName(definition.type);
    const other = tools.get(name);
    if (other && other !== definition) throw new Error(`[Elements] ${other.type} and ${definition.type} are one tool in the builder (${name}): rename one`);
    tools.set(name, definition);
  }
  return tools;
}

/** Whether a component is placed where a Section goes: a band across the window, which no block in a column is, so it's no tool. */
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
  data?: Values;
  store?(value: Json): unknown;
  read?(value: unknown, say: (message: string) => void): unknown;
}

/** A number as a field of the builder's keeps one: the number, or its digits. */
const numeric = (value: unknown): unknown => (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value)) ? Number(value) : value);
const options = (values: readonly Json[]): Values => ({ options: values.map((value) => ({ label: String(value), value: String(value) })) });
/** The builder's counter, which keeps whole numbers: from `min` (where there's none, below zero too, where its own floor is). */
const counter = (min?: number, max?: number): PropertyEditor => ({ widget: "counter", data: { minValue: min ?? -1e9, ...(max === undefined ? {} : { maxValue: max }) }, read: numeric });
/** The builder's text field, for a number that isn't whole and a length with a unit: it keeps text (and gives a tool nothing for a number, so one is written as text). */
const typed: PropertyEditor = { widget: "text", store: String, read: numeric };
const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

/**
 * The builder's editor for a prop, by its kind, and so how its value is kept in a block (a property of a team's own
 * keeps its value as its kind's does, whatever edits it). None for a kind it has no way to keep: its value stays in
 * the block, with no field.
 */
function editorOf(spec: Spec): PropertyEditor | undefined {
  const schema = spec.kind.jsonSchema() as Schema;
  switch (spec.kind.editor) {
    case "text":
      return { widget: "text" };
    case "color":
      return { widget: "color_picker" };
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
    default:
      return undefined;
  }
}

/**
 * A component's props as its tool's values: each as the builder's editor for it keeps one. A prop that isn't given is
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

/** A tool's values as its component's props: each read back and checked by its kind; one it doesn't take is left out, and said. */
export function toolProps(definition: CustomDefinition<any>, values: Values, say: (message: string) => void = () => {}): Record<string, Json> {
  const props: Record<string, Json> = {};
  for (const [key, spec] of Object.entries(definition.props) as Array<[string, Spec]>) {
    const kept = values[key];
    if (!Object.hasOwn(values, key) || kept === undefined || kept === null) continue;
    const editor = editorOf(spec);
    let given = editor?.read ? editor.read(kept, say) : kept;
    // A link its user emptied, where the prop has one by default, is a link to nothing: not its default again.
    if (given === undefined && spec.kind.editor === "link" && spec.default !== undefined && webLink(kept) === null) given = { href: "" };
    if (given === undefined) continue;
    const parsed = spec.kind.parse(given);
    // Its default is what the component takes anyway: not written, as a template wouldn't. One it needs is given
    // either way (a template has to give it), its default too.
    if (parsed.ok && !spec.required && JSON.stringify(parsed.value) === JSON.stringify(spec.default)) continue;
    if (parsed.ok) props[key] = parsed.value;
    // A field its user emptied is the prop not given.
    else if (given !== "") say(`its ${key} ${JSON.stringify(kept)} (${parsed.message}) isn't one a ${definition.type} takes: left out`);
  }
  return props;
}

/** A template's own component as its tool's block in a design. */
export function customBlock(node: Node, definition: CustomDefinition<any>, around: Sides, hiding: Hiding): Block {
  const name = toolName(definition.type);
  const id = node.id ? { _meta: { htmlID: node.id, htmlClassNames: `u_content_custom_${name}` } } : {};
  return { ...block("custom", hiding), custom: name, values: { ...toolValues(definition, node.props), containerPadding: cssSides(around), ...id } };
}

/** A custom tool's block as its component, where it's one of those given; none where it isn't, and said. */
export function readCustom(slug: unknown, values: Values, context: Context, tools: Map<string, CustomDefinition<any>>): Node[] {
  const definition = typeof slug === "string" ? tools.get(slug) : undefined;
  if (!definition) {
    context.say(`${typeof slug === "string" ? `the custom tool ${JSON.stringify(slug)}` : "a custom tool"} of the builder's is none of the components given (fromDesign()'s components): left out`);
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
  const props = toolProps(definition, values, context.say);
  // A block dragged in and not filled yet (or filled with what its prop doesn't take), which the builder leaves out of
  // what it exports too: with it, the template wouldn't render.
  const missing = Object.keys(definition.props).filter((key) => definition.props[key].required && !Object.hasOwn(props, key));
  if (missing.length) {
    context.say(`${tool} has no ${missing.join(" or ")}, which a ${definition.type} needs: left out`);
    return [];
  }
  // What the builder keeps on any block that a component has no place for is said, as a built-in block's is: a display
  // condition, an anchor, a prop's value on phones. A value that's neither the builder's own nor a prop's is the
  // tool's own (registerTools()'s `properties`): it stays in the block, and isn't the component's.
  const read = Object.keys(definition.props);
  const its = (kept: unknown): Values => Object.fromEntries(Object.entries(obj(kept)).filter(([key]) => read.includes(key) || builders(key)));
  const devices = obj(values._override);
  sayUnread("custom", { ...its(values), _override: { ...devices, mobile: its(devices.mobile) } }, undefined, context.say, { values: [...read, "containerPadding"], phone: ["containerPadding", "hideMobile"] });
  const node = make(definition.type, { id: givenId(values), props });
  return [placed(node, sides(values.containerPadding ?? "10px"), undefined, sides(obj(obj(values._override).mobile).containerPadding), hiddenOn(values))];
}

// ─── The tools, in a builder ─────────────────────────────────────────────────

/** The part of the builder's `unlayer` object registerTools() uses. */
export interface Builder {
  registerTool(tool: Record<string, unknown>): void;
  /** `place` is where the block is: its row's cells and its column's index. The builder gives a canvas no values of its column (it gives them to what it exports): where one does, `columnValues`, they're read. */
  createViewer(viewer: { render(values: Values, body?: Values, place?: { columnIndex?: number; rowCells?: number[]; columnValues?: Values }): string }): unknown;
  /** For the editors given as they're written (`editors`). */
  registerPropertyEditor?(editor: { name: string; Widget: unknown }): void;
  createWidget?(widget: { render(value: unknown, update: (value: unknown) => void): string; mount(node: HTMLElement, value: unknown, update: (value: unknown) => void): void }): unknown;
}

/** What an editor of a team's own is given besides the value: its prop's label, and its options as the prop has them. */
export type EditorOptions<D = unknown> = { label: string } & (D extends PropertyDefinition<any, infer O> ? O : { [name: string]: Json });
type Edited<D> = D extends PropertyDefinition<infer V, any> ? V : Json;

/**
 * A property editor of a team's own, as the builder takes one: the control of a property a template defines
 * (`EditorWidget<typeof currency>` types its value and options as the property's). It's given its prop's value as
 * the prop has it (a price as a number), and gives back the same.
 */
export interface EditorWidget<D = unknown> {
  /** Its markup. The builder draws nothing around an editor that isn't its own: its label is here too. */
  render(value: Edited<D> | undefined, update: (value: Edited<D> | undefined) => void, options: EditorOptions<D>): string;
  /** Once its markup is in the page: where it listens, and calls `update` with the new value. */
  mount?(node: HTMLElement, value: Edited<D> | undefined, update: (value: Edited<D> | undefined) => void, options: EditorOptions<D>): void;
}

export interface RegisterToolsOptions {
  /** The builder's display mode, which says what the canvas draws: an Email's markup ("email", the default) or a Page's ("web"). */
  displayMode?: "email" | "web";
  /** Each tool's icon in the builder's panel, by its component's type: a Font Awesome class, an image's URL or an SVG. */
  icons?: Record<string, string>;
  /**
   * The property editors of a team's own, by name (`{ [currency.name]: … }`, the name its property has): each as
   * it's written (`{ render, mount }`), which registerTools() registers in the builder; or `true` for one registered
   * there already (`unlayer.registerPropertyEditor`), which is given the value as the builder keeps it. A property
   * with no control here is edited with its kind's editor, as any other prop is. A name here that's the property of
   * no prop of the components is refused: a name mistyped, or one of the builder's own editors, which are its kinds'.
   */
  editors?: { readonly [name: string]: EditorWidget | true };
  /** The builder's own settings for a component's tool, by the component's type. */
  tools?: Record<string, ToolSettings>;
}

/** What a tool has in the builder beside what its component gives it. */
export interface ToolSettings {
  /**
   * Properties of the tool that aren't the component's props, shown above its own, each as the builder takes one
   * (`{ label, widget, defaultValue }`): a picker that fills several props at once, with the tool's `transformer`.
   * Their values are kept in the block; they aren't the component's.
   */
  properties?: Record<string, Record<string, unknown>>;
  /**
   * Any other setting the builder's `registerTool()` takes (`transformer`, `position`, `usageLimit`…), passed as it
   * is. What the component gives its tool is none of them, and is refused: its name, label, fields and drawing, its
   * icon (`icons`), and what a block starts with (each prop's `default`).
   */
  [setting: string]: unknown;
}

/** What a component gives its tool, which is no setting of the builder's for it. */
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
 * A component drawn on its own from its tool's values, as an Email's markup or a Page's, with its stylesheet: at the
 * room its block has, which is its column's share (`cells`, `index`) of the builder's content width (`body`), less
 * what's around it there (`column`).
 */
function draw(definition: CustomDefinition<any>, tools: readonly CustomDefinition<any>[], root: "Email" | "Page", values: Values, body: Values | undefined, cells: number[] | undefined, index: number | undefined, column: Values = {}): string {
  const content = px(obj(body).contentWidth) ?? 600;
  const room = roomOf(values, content, cells, index, column);
  // A root is 200px wide at least: in less room than that, the component is in a Column of the room's width.
  const width = Math.max(200, room);
  const own: Node = make(definition.type, { props: toolProps(definition, values) });
  const node: Node = room < width ? { type: "Column", style: { width: room }, children: [own] } : own;
  const written = renderTemplate({ root: { type: root, props: { width }, children: [node] } }, { components: tools });
  const style = /<style>[\s\S]*?<\/style>/.exec(written.head)?.[0] ?? "";
  // An Email is on a phone below its own width, which here is its block's: its styles for phones start where the
  // whole email's do, which is also where the builder stacks its columns.
  const queries = root === "Email" ? style.replace(/(@media \(m(?:ax|in)-width: )(\d+)(?=px\))/g, (_, query: string, at: string) => `${query}${Number(at) - width + content}`) : style;
  // A page's <main> is centered by its margins, which shrink it to its words in a flex box: it fills its block.
  return queries + written.body.replace(/^<main style="/, '<main style="width:100%;');
}

/**
 * Registers each component as a custom tool in a builder (in its custom JavaScript, where `unlayer.registerTool` is):
 * the tool's name is its type's (`toolName()`), its properties its props, each with the builder's editor for its kind
 * or the control of the property of the team's own it is (`editors`), and it's drawn by Elements, in the
 * canvas and in what the builder exports. A component placed where a Section goes is no tool (toDesign() writes it as
 * an HTML block). Returns the tools' names.
 */
export function registerTools(builder: Builder, components: readonly WithDefinition[], options: RegisterToolsOptions = {}): string[] {
  const tools = toolsOf(components);
  // Every component given, for the ones a tool's own renders.
  const all = [...tools.values()];
  for (const [name, definition] of tools) if (inSection(definition)) tools.delete(name);
  const canvas = options.displayMode === "web" ? "Page" : "Email";
  const editors = options.editors ?? {};
  // An editor given for no prop is a name mistyped: its prop would be edited with its kind's, without a word. A name
  // of the builder's own editors is none of these: those are its kinds'.
  const asked = new Set(all.flatMap((definition) => (Object.values(definition.props) as Spec[]).flatMap((spec) => propertyOf(spec)?.name ?? [])));
  for (const name of Object.keys(editors)) {
    if (!asked.has(name)) throw new Error(`[Elements] registerTools: editors has ${name}, which is the property of no prop of the components given (${asked.size ? `their props are ${[...asked].join(", ")}` : "none of their props is a property of your own"})`);
  }
  for (const type of Object.keys(options.tools ?? {})) {
    if (!all.some((definition) => definition.type === type)) throw new Error(`[Elements] registerTools: tools has settings for ${type}, which is none of the components given`);
  }
  for (const [name, definition] of tools) {
    const taken = unkept(definition);
    if (taken) throw new Error(`[Elements] registerTools: ${definition.type} has a prop named ${taken}, which is the builder's own in a block: as a tool, it takes another name`);
    const { properties: own = {}, ...settings } = options.tools?.[definition.type] ?? {};
    for (const key of Object.keys(own)) {
      if (Object.hasOwn(definition.props, key)) throw new Error(`[Elements] registerTools: ${definition.type} has a prop named ${key}: a property of the tool's own takes another name`);
    }
    const given = GIVEN.find((key) => Object.hasOwn(settings, key));
    if (given) throw new Error(`[Elements] registerTools: tools sets ${given} for ${definition.type}, which its component gives the tool: its label and props are the component's, a block starts with each prop's default, and its icon is in icons`);
    const properties: Record<string, unknown> = { ...own };
    for (const [key, spec] of Object.entries(definition.props) as Array<[string, Spec]>) {
      const editor = editorOf(spec);
      // The control of the team's own, where the prop is a property of theirs given one; the builder's otherwise.
      const named = propertyOf(spec);
      const theirs = named && Object.hasOwn(editors, named.name) ? editors[named.name] : undefined;
      let widget = theirs ? named?.name : editor?.widget;
      if (!widget || spec.editable === false) continue;
      const theirOptions: EditorOptions = { label: spec.label, ...named?.options };
      if (theirs && theirs !== true) {
        // Given as it's written: registered for this prop, which it's given as the prop's own value (a price as a
        // number, where the builder keeps one that isn't whole as text), and gives back the same.
        if (!builder.registerPropertyEditor || !builder.createWidget) throw new Error(`[Elements] registerTools: editors gives ${widget} as it's written, which takes a builder with registerPropertyEditor() and createWidget()`);
        const value = (kept: unknown) => (kept === undefined || kept === null ? undefined : ((editor?.read ? editor.read(kept, () => {}) : kept) as Json | undefined));
        const update = (keep: (value: unknown) => void) => (next: Json | undefined) => keep(next === undefined || next === null ? next : (editor?.store?.(next) ?? next));
        widget = `${widget.replace(".", "_")}__${name}__${key}`;
        builder.registerPropertyEditor({
          name: widget,
          Widget: builder.createWidget({
            render: (kept, keep) => theirs.render(value(kept), update(keep), theirOptions),
            mount: (node, kept, keep) => theirs.mount?.(node, value(kept), update(keep), theirOptions),
          }),
        });
      }
      // The builder's own editor takes what the prop's kind gives it (a number's limits); the options of a team's own
      // editor that isn't given here are that editor's alone.
      const data: Values = theirs ? theirOptions : { ...editor?.data };
      // What a block dragged in from the panel starts with: the prop's default, as the editor keeps it. With none, a
      // text is empty and a toggle is off; any other has no value, which each of the builder's editors shows as unset.
      const initial = spec.default !== undefined ? (editor?.store?.(spec.default as Json) ?? spec.default) : spec.kind.editor === "text" ? "" : spec.kind.editor === "toggle" ? false : undefined;
      properties[key] = { label: spec.label, ...(initial !== undefined ? { defaultValue: initial } : {}), widget, ...(Object.keys(data).length ? { data } : {}) };
    }
    // What the builder exports: the component as that output's markup; nothing where its values can't be drawn.
    const written = (root: "Email" | "Page") => (values: Values, ...rest: unknown[]) => {
      const meta = obj(rest[rest.length - 1]);
      const cells = (Array.isArray(rest[2]) ? rest[2] : meta.rowCells) as number[] | undefined;
      const index = (typeof rest[1] === "number" ? rest[1] : meta.columnIndex) as number | undefined;
      try {
        return draw(definition, all, root, values, obj(rest[3] ?? meta.bodyValues), cells, index, obj(meta.columnValues));
      } catch {
        return "";
      }
    };
    builder.registerTool({
      ...settings,
      name,
      label: definition.label,
      icon: options.icons?.[definition.type] ?? "fa-cube",
      supportedDisplayModes: ["web", "email"],
      options: Object.keys(properties).length ? { [name]: { title: definition.label, position: 1, options: properties } } : {},
      values: {},
      renderer: {
        // The canvas: the component as drawn, or what stops it from being (a required prop with no value yet).
        Viewer: builder.createViewer({
          render(values, body, place) {
            try {
              return draw(definition, all, canvas, values, body, place?.rowCells, place?.columnIndex, obj(place?.columnValues));
            } catch (error) {
              const problems = error instanceof ElementsError ? error.diagnostics.map((d) => d.message) : [String((error as Error)?.message ?? error)];
              return `<div style="padding:12px;border:1px dashed #b91c1c;color:#b91c1c;font:13px/1.4 sans-serif">${escape(`${definition.label}: ${problems[0]}`)}</div>`;
            }
          },
        }),
        exporters: { email: written("Email"), web: written("Page") },
        head: { css: () => "", js: () => "" },
      },
    });
  }
  return [...tools.keys()];
}
