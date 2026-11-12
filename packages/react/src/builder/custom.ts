/**
 * A template's own components in the builder. Each is a custom tool of the builder's, named by its type
 * (`acme.ProductCard`: `acme_product_card`), with a property for each prop the builder has an editor for. toDesign()
 * writes one as that tool's block, its props the block's values (`customTools`); fromDesign() reads the block back as
 * the component (`components`); registerTools() gives a builder the tools, each drawn by Elements itself.
 */
import { ElementsError, renderTemplate, type CustomDefinition, type Json, type LinkValue, type Node } from "@unlayer-internal/elements-core";
import { link } from "./blocks";
import { block, type Block, type Hiding } from "./design";
import { font, givenId, hidden as hiddenOn, px, sides, type Sides, type Values } from "./read-values";
import { make, obj, placed, type Context } from "./reading";
import { builderFont, builderLink, cssSides } from "./values";

/** A template's own component, as `component()` makes one. */
export interface WithDefinition {
  definition: CustomDefinition<any>;
}

/** The builder's name for a component's tool: its type in the builder's words (`acme.ProductCard`: `acme_product_card`). */
export const toolName = (type: string): string =>
  type
    .replace(/[.-]/g, "_")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase();

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

/** One of the builder's property editors: its name there, and a prop's value as it stores one and as it's read back. */
interface PropertyEditor {
  widget: string;
  store?(value: Json): unknown;
  read?(value: unknown, say: (message: string) => void): unknown;
}

const image = (value: Json): Values => {
  const { src, width, height } = (typeof value === "string" ? { src: value } : value) as { src: string; width?: number; height?: number };
  return { url: src, ...(width ? { width } : {}), ...(height ? { height } : {}) };
};
const asset = (value: unknown): unknown => {
  const { url, width, height } = obj(value);
  if (typeof url !== "string" || !url) return undefined;
  return typeof width === "number" && typeof height === "number" ? { src: url, width, height } : url;
};

/** The builder's property editor for each of a kind's editors. A kind with none here keeps its value, with no editor. */
const EDITORS: Record<string, PropertyEditor> = {
  text: { widget: "text" },
  color: { widget: "color_picker" },
  toggle: { widget: "toggle" },
  // The builder's counter stores a number or its digits.
  number: { widget: "counter", read: (value) => (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value)) ? Number(value) : value) },
  choice: { widget: "dropdown", store: String },
  link: { widget: "link", store: (value) => builderLink(value as LinkValue), read: (value, say) => link(value, say) },
  image: { widget: "image", store: image, read: asset },
  fontFamily: { widget: "font_family", store: (value) => builderFont(String(value)), read: font },
};

type Spec = CustomDefinition<any>["props"][string];
const editorOf = (spec: Spec): PropertyEditor | undefined => (Object.hasOwn(EDITORS, spec.kind.editor) ? EDITORS[spec.kind.editor] : undefined);
/** A choice's values, from its schema. */
const choices = (spec: Spec): Json[] => ((spec.kind.jsonSchema() as { enum?: Json[] }).enum ?? []) as Json[];

/**
 * A component's props as its tool's values: each as the builder's editor for it stores one. A prop that isn't given is
 * written as its default where the builder has an editor for it, as the builder writes a tool's defaults, so its field
 * shows what's drawn (toolProps() leaves a default out again).
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
    if (!Object.hasOwn(values, key) || values[key] === undefined || values[key] === null) continue;
    let given = editorOf(spec)?.read ? editorOf(spec)!.read!(values[key], say) : values[key];
    // The builder's dropdown stores text: a number among the choices is that number.
    if (spec.kind.editor === "choice") given = choices(spec).find((choice) => String(choice) === String(given)) ?? given;
    if (given === undefined) continue;
    const parsed = spec.kind.parse(given);
    // Its default is what the component takes anyway: not written, as a template wouldn't.
    if (parsed.ok && JSON.stringify(parsed.value) === JSON.stringify(spec.default)) continue;
    if (parsed.ok) props[key] = parsed.value;
    // A field its user emptied is the prop not given.
    else if (given !== "") say(`its ${key} ${JSON.stringify(values[key])} (${parsed.message}) isn't one a ${definition.type} takes: left out`);
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
  const node = make(definition.type, { id: givenId(values), props: toolProps(definition, values, context.say) });
  return [placed(node, sides(values.containerPadding ?? "10px"), undefined, sides(obj(obj(values._override).mobile).containerPadding), hiddenOn(values))];
}

// ─── The tools, in a builder ─────────────────────────────────────────────────

/** The part of the builder's `unlayer` object registerTools() uses. */
export interface Builder {
  registerTool(tool: Record<string, unknown>): void;
  createViewer(viewer: { render(values: Values, body?: Values, place?: { columnIndex?: number; rowCells?: number[] }): string }): unknown;
}

export interface RegisterToolsOptions {
  /** The builder's display mode, which says what the canvas draws: an Email's markup ("email", the default) or a Page's ("web"). */
  displayMode?: "email" | "web";
  /** Each tool's icon in the builder's panel, by its component's type: a Font Awesome class, an image's URL or an SVG. */
  icons?: Record<string, string>;
  /**
   * The property editors registered in the builder besides its own (`unlayer.registerPropertyEditor`), by name: a prop
   * that names one of them (`editor: "currency"`) is edited with it. One that names any other is edited with its
   * kind's.
   */
  editors?: readonly string[];
}

/** The builder's own property editors a prop can name. */
const BUILT_IN = new Set(["text", "rich_text", "html", "color_picker", "alignment", "font_family", "border", "counter", "image", "toggle", "link", "dropdown", "datetime"]);

const escape = (text: string) => text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** A block's width where the builder draws it: its column's share of the content width, less its own spacing. */
function widthOf(values: Values, body: Values | undefined, cells: number[] | undefined, index: number | undefined): number {
  const content = px(obj(body).contentWidth) ?? 600;
  const total = (cells ?? []).reduce((sum, cell) => sum + cell, 0);
  const share = total && cells && index !== undefined && cells[index] ? cells[index] / total : 1;
  const padding = sides(values.containerPadding ?? "10px");
  return Math.max(200, Math.round(content * share) - (padding ? padding.left + padding.right : 0));
}

/** A component drawn on its own from its tool's values, as an Email's markup or a Page's, with its stylesheet. */
function draw(definition: CustomDefinition<any>, tools: readonly CustomDefinition<any>[], root: "Email" | "Page", values: Values, width: number): string {
  const node: Node = make(definition.type, { props: toolProps(definition, values) });
  const { head, body } = renderTemplate({ root: { type: root, props: { width }, children: [node] } }, { components: tools });
  const style = /<style>[\s\S]*?<\/style>/.exec(head)?.[0] ?? "";
  // A page's <main> is centered by its margins, which shrink it to its words in a flex box: it fills its block.
  return style + body.replace(/^<main style="/, '<main style="width:100%;');
}

/**
 * Registers each component as a custom tool in a builder (in its custom JavaScript, where `unlayer.registerTool` is):
 * the tool's name is its type's (`toolName()`), its properties its props, each with the builder's editor for its kind
 * (or the one its `editor` names), and it's drawn by Elements, in the canvas and in what the builder exports. Returns
 * the tools' names.
 */
export function registerTools(builder: Builder, components: readonly WithDefinition[], options: RegisterToolsOptions = {}): string[] {
  const tools = toolsOf(components);
  const all = [...tools.values()];
  const canvas = options.displayMode === "web" ? "Page" : "Email";
  for (const [name, definition] of tools) {
    const properties: Record<string, unknown> = {};
    for (const [key, spec] of Object.entries(definition.props) as Array<[string, Spec]>) {
      const editor = editorOf(spec);
      // The editor it names, where the builder has one of that name; its kind's otherwise.
      const widget = spec.editor && (BUILT_IN.has(spec.editor) || options.editors?.includes(spec.editor)) ? spec.editor : editor?.widget;
      if (!widget || spec.editable === false) continue;
      const values = spec.kind.editor === "choice" ? choices(spec) : [];
      // What a block dragged in from the panel starts with: the prop's default, as the editor stores it. With none, a
      // text is empty and a toggle is off; any other has no value, which each of the builder's editors shows as unset.
      const initial = spec.default !== undefined ? (editor?.store?.(spec.default as Json) ?? spec.default) : spec.kind.editor === "text" ? "" : spec.kind.editor === "toggle" ? false : undefined;
      properties[key] = {
        label: spec.label,
        ...(initial !== undefined ? { defaultValue: initial } : {}),
        widget,
        ...(values.length ? { data: { options: values.map((value) => ({ label: String(value), value: String(value) })) } } : {}),
      };
    }
    // What the builder exports: the component as that output's markup; nothing where its values can't be drawn.
    const written = (root: "Email" | "Page") => (values: Values, ...rest: unknown[]) => {
      const meta = obj(rest[rest.length - 1]);
      const cells = (Array.isArray(rest[2]) ? rest[2] : meta.rowCells) as number[] | undefined;
      const index = (typeof rest[1] === "number" ? rest[1] : meta.columnIndex) as number | undefined;
      try {
        return draw(definition, all, root, values, widthOf(values, obj(rest[3] ?? meta.bodyValues), cells, index));
      } catch {
        return "";
      }
    };
    builder.registerTool({
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
              return draw(definition, all, canvas, values, widthOf(values, body, place?.rowCells, place?.columnIndex));
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
