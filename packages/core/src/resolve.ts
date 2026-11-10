/**
 * Resolving a document: what every target needs worked out the same way
 * before it writes anything. Defaults applied, text styles inherited, and
 * every box's width on desktop in px, from the root's width down. Targets
 * only turn this into markup; none of them decides layout on its own.
 */
import type { ComponentDefinition, Target } from "./define";
import { Diagnostics, type Diagnostic } from "./diagnostics";
import { assetParts, readLength, type Asset, type Border, type BorderSide, type FontFamily, type Insets, type LineHeight } from "./kinds";
import { evalLength, MAX_REPEAT, readTerms, termLength, type Term } from "./css-kinds";
import { BLOCKLIKE, pageLayout } from "./css-serialize";
import { isNode, type ElementsDocument, type Json, type Node } from "./model";
import { pageBox } from "./document";
import { expandDocument, templatePathsOf, type TemplatePaths } from "./expand";
import { propsWithDefaults, registryOf, type ComponentsOption, type Registry } from "./registry";

/** Text styles as they apply to a node: its own, its component's defaults, else its parent's. */
export interface ResolvedText {
  color: string;
  fontFamily: FontFamily;
  fontSize: number;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  lineHeight: LineHeight;
  /** The line height in px at this node's font size. */
  lineHeightPx: number;
  letterSpacing: number;
  textAlign: "left" | "center" | "right" | "justify";
  textTransform: "none" | "uppercase" | "lowercase" | "capitalize";
  /**
   * On a Page, a text metric set in rem, em, %, a viewport unit or calc(), as it was set: what's written. Its value
   * above is the px it comes to at the base sample (Decision 19), what layout and the PDF read.
   */
  authored?: { fontSize?: string; lineHeight?: string; letterSpacing?: string };
}

export interface ResolvedNode {
  /** The author's id, if any. */
  id?: string;
  /**
   * Where it is in the tree as laid out ("root.children[2]"): its place in the template, but inside a Grid (laid out
   * as Rows of cells) and inside what a custom component renders. The document's `templatePath` gives the template's.
   */
  path: string;
  type: string;
  definition: ComponentDefinition;
  /** Its props, with the definition's defaults where not given. */
  props: Record<string, Json>;
  /** Its component's default style under its own (inherited text styles are in `text`). */
  style: Record<string, Json>;
  hover?: Record<string, Json>;
  mobile?: Record<string, Json>;
  hidden?: { mobile?: boolean; desktop?: boolean };
  /** On a Page, the theme's tokens its element carries as CSS custom properties (a root's every one, a scope's that differ). */
  customProperties?: Record<string, string>;
  text: ResolvedText;
  /** The width its parent gives it on desktop, in px (null inside text). */
  available: number | null;
  /**
   * Its width on desktop in px, padding and border included; null where it
   * takes its own size and that size isn't known (a Button's text, an Image
   * without its size, text inside text).
   */
  width: number | null;
  /** Its width inside its padding and border, in px, or null. */
  contentWidth: number | null;
  children: Array<ResolvedNode | string>;
  /** A Table's column widths in px, each column's from its cells, the rest shared (null where the table's width isn't known). */
  columns?: number[] | null;
  /** On a Table and its rows, where a column of its own px sits beside one with no width: how each column is written. "px" stays that wide in a narrower window, "share" stays its share of the table, "free" takes what they leave (otherwise, none: every column is a share of the table). */
  columnSizes?: Array<"px" | "share" | "free"> | null;
}

export interface ResolvedDocument {
  root: ResolvedNode;
  /** At their places in the template. */
  diagnostics: Diagnostic[];
  /** A path in the tree as laid out (a node's `path`, and what follows it: ".props.src") as the template's, for messages. */
  templatePath?: (path: string) => string;
}

/**
 * The laid-out tree's format (ResolvedNode), as prepare() gives it to the packages that write a PDF or an image: each
 * reads the version it's built with and refuses another. Raise it only where a reader of the tree would break (a
 * field renamed, removed or meaning something else), not for one added.
 */
export const LAYOUT_VERSION = 1;

/** What a root's text styles start from, under its own defaults. */
const INITIAL_TEXT: Omit<ResolvedText, "lineHeightPx"> = {
  color: "#000000",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: 16,
  fontWeight: 400,
  fontStyle: "normal",
  lineHeight: 1.5,
  letterSpacing: 0,
  textAlign: "left",
  textTransform: "none",
};

const INHERITED = Object.keys(INITIAL_TEXT) as Array<keyof typeof INITIAL_TEXT>;

/**
 * The viewport a Page's lengths are worked out at, the base sample V0 (Decision 19): the larger of its width and one
 * more than its phone width, 800px tall. Set while a document resolves; another root's is its own width.
 */
let viewport = { width: 0, height: 800 };

/** The viewport a document is resolved at: a Page's V0, else its root's width. */
export function baseViewport(root: { type: string; props: Record<string, Json> }): { width: number; height: number } {
  const width = typeof root.props.width === "number" ? root.props.width : 0;
  if (root.type !== "Page") return { width, height: 800 };
  const mobile = (root.props.breakpoints as { mobile?: number } | undefined)?.mobile ?? 480;
  return { width: Math.max(width, mobile + 1), height: 800 };
}

/**
 * A length in px: a number, px, %, pt, mm or in as `toPx` reads them, and on a Page rem, em (of `fontSize`), viewport
 * units and calc(), min(), max() and clamp() of them. Null where it depends on something unknown, and for a word.
 */
export function lengthPx(value: Json | undefined, of: number | null, fontSize = 16, at: { width: number; height: number } = viewport): number | null {
  const plain = toPx(value, of);
  if (plain !== null || typeof value !== "string") return plain;
  return evalLength(value, { percentOf: of, fontSize, viewport: at });
}

/** A length in px, given the width a percentage is of. */
export function toPx(value: Json | undefined, of: number | null): number | null {
  const length = readLength(value);
  if (!length) return null;
  switch (length.unit) {
    case "px":
      return length.value;
    case "%":
      return of === null ? null : (of * length.value) / 100;
    case "pt":
      return (length.value * 96) / 72;
    case "mm":
      return (length.value * 96) / 25.4;
    case "in":
      return length.value * 96;
  }
}

export function lineHeightPx(lineHeight: LineHeight, fontSize: number): number {
  // A font's own ("normal") is about this: for what can't leave it to the font (a PDF's lines, an estimate of a height).
  if (lineHeight === "normal") return Math.round(1.2 * fontSize * 100) / 100;
  return typeof lineHeight === "number" ? Math.round(lineHeight * fontSize * 100) / 100 : Number.parseFloat(lineHeight);
}

/**
 * The horizontal space a box's padding and border take: on a Page a side may be in rem, em or % (of `of`), and a page
 * style's own side (paddingLeft, borderRight) is over padding's and border's.
 */
export function horizontalFrame(style: Record<string, Json>, of: number | null = null, fontSize = 16): number {
  const padding = style.padding as Record<keyof Insets, number | string> | undefined;
  const border = style.border as Border | undefined;
  const side = (value: Json | undefined) => (value === undefined ? 0 : (lengthPx(value, of, fontSize) ?? 0));
  const line = (value: Json | undefined) => (value && typeof value === "object" && "width" in value ? Number((value as BorderSide).width) : undefined);
  const left = side(style.paddingLeft ?? padding?.left) + (line(style.borderLeft) ?? border?.left?.width ?? 0);
  const right = side(style.paddingRight ?? padding?.right) + (line(style.borderRight) ?? border?.right?.width ?? 0);
  return left + right;
}

interface Context {
  d: Diagnostics;
  registry: Registry;
  /** The root's type: Rows stack on phones by default in a responsive one. */
  responsive: boolean;
  /** The root's type: a Row wraps on a Page, and in an Email where it stays side by side on phones. A PDF and an image draw one line. */
  root: string;
}

/**
 * Resolves a valid document (see `checkDocument`), its custom components
 * expanded first: what's resolved is primitives only.
 */
export function resolveDocument(input: ElementsDocument, options?: ComponentsOption | Registry): ResolvedDocument {
  const registry = registryOf(options);
  const expanded = expandDocument(input, registry);
  const resolved = resolveExpanded(expanded.document, registry, expanded.paths);
  return { ...resolved, diagnostics: [...expanded.diagnostics, ...resolved.diagnostics] };
}

/**
 * Resolves a document whose custom components are already expanded (`expandDocument`): primitives only. With the
 * expansion's `paths`, its messages (and its `templatePath`) say where things are in the template.
 */
export function resolveExpanded(document: ElementsDocument, options?: ComponentsOption | Registry, paths?: TemplatePaths): ResolvedDocument {
  const around = viewport;
  try {
    viewport = baseViewport({ type: document.root.type, props: propsWithDefaults(registryOf(options).get(document.root.type)!, document.root.props) });
    return resolveAtViewport(document, options, paths);
  } finally {
    viewport = around;
  }
}

function resolveAtViewport(document: ElementsDocument, options?: ComponentsOption | Registry, paths?: TemplatePaths): ResolvedDocument {
  const registry = registryOf(options);
  const d = new Diagnostics();
  const definition = registry.get(document.root.type)!;
  const context: Context = { d, registry, responsive: !!definition.responsive, root: document.root.type };
  const root = resolveNode(document.root, "root", { ...INITIAL_TEXT, lineHeightPx: 24 }, null, context);
  // A Document's content is as wide as its page inside the margins; a Canvas's, as it inside its padding.
  const width = root.type === "Document" ? pageBox(root.props).contentWidth : toPx(root.props.width, null);
  root.width = width;
  root.contentWidth = width === null ? null : width - horizontalFrame(root.style);
  root.children = resolveChildren(document.root, "root", root, root.contentWidth, "stack", context);
  const templatePath = paths ? templatePathsOf(document, paths) : (path: string) => path;
  return { root, diagnostics: d.list.map((diagnostic) => ({ ...diagnostic, path: templatePath(diagnostic.path) })), templatePath };
}

function styleOf(node: Node, definition: ComponentDefinition, props: Record<string, Json>, context: Context): Record<string, Json> {
  const style: Record<string, Json> = { ...((definition.defaultStyle ?? {}) as Record<string, Json>) };
  const by = definition.defaultStyleBy;
  if (by) Object.assign(style, by.values[String(props[by.prop])] ?? {});
  return { ...style, ...node.style };
}

function textOf(parent: ResolvedText, style: Record<string, Json>): ResolvedText {
  const text = { ...parent } as Record<string, unknown>;
  const authored: NonNullable<ResolvedText["authored"]> = { ...parent.authored };
  for (const key of INHERITED) {
    if (style[key] === undefined) continue;
    text[key] = style[key];
    if (key === "fontSize" || key === "lineHeight" || key === "letterSpacing") delete authored[key];
  }
  // On a Page: a size in em or % is of the parent's font size, a line height's and a letter spacing's in em of its own.
  const rich = (value: Json | undefined) => typeof value === "string" && value !== "normal" && readLength(value)?.unit !== "px";
  if (rich(style.fontSize)) {
    authored.fontSize = style.fontSize as string;
    text.fontSize = evalLength(style.fontSize, { percentOf: parent.fontSize, fontSize: parent.fontSize, viewport }) ?? parent.fontSize;
  }
  const fontSize = text.fontSize as number;
  if (rich(style.letterSpacing)) {
    authored.letterSpacing = style.letterSpacing as string;
    text.letterSpacing = evalLength(style.letterSpacing, { percentOf: null, fontSize, viewport }) ?? 0;
  }
  if (rich(style.lineHeight)) {
    authored.lineHeight = style.lineHeight as string;
    const px = evalLength(style.lineHeight, { percentOf: fontSize, fontSize, viewport });
    text.lineHeight = px === null ? "normal" : (`${Math.round(px * 100) / 100}px` as LineHeight);
  }
  // A line height in em or a multiple inherited by a bigger font: CSS passes down the px, as computed.
  const out = text as unknown as ResolvedText;
  if (Object.keys(authored).length) out.authored = authored;
  else delete out.authored;
  out.lineHeightPx = lineHeightPx(out.lineHeight, out.fontSize);
  return out;
}

/** A direction of its own (a block's, or the root's) sets where its text starts, unless its author aligned it. */
function directed(text: ResolvedText, dir: Json | undefined, ownAlign: Json | undefined): ResolvedText {
  if (ownAlign !== undefined || (dir !== "rtl" && dir !== "ltr")) return text;
  return { ...text, textAlign: dir === "rtl" ? "right" : "left" };
}

/** A node with its own values worked out; its width and children are set by its parent's layout. */
function resolveNode(node: Node, path: string, parentText: ResolvedText, available: number | null, context: Context): ResolvedNode {
  const definition = context.registry.get(node.type)!;
  const props = propsWithDefaults(definition, node.props);
  const style = styleOf(node, definition, props, context);
  return {
    ...(node.id ? { id: node.id } : {}),
    path,
    type: node.type,
    definition,
    props,
    style,
    ...(node.hover ? { hover: node.hover } : {}),
    ...(node.mobile ? { mobile: node.mobile } : {}),
    ...(node.hidden ? { hidden: node.hidden } : {}),
    ...(node.customProperties ? { customProperties: node.customProperties } : {}),
    text: directed(textOf(parentText, style), props.dir, node.style?.textAlign),
    available,
    width: null,
    contentWidth: null,
    children: [],
  };
}

function clamp(width: number, style: Record<string, Json>, of: number | null, fontSize = 16): number {
  const min = lengthPx(style.minWidth, of, fontSize);
  const max = lengthPx(style.maxWidth, of, fontSize);
  if (max !== null) width = Math.min(width, max);
  if (min !== null) width = Math.max(width, min);
  return width;
}

/** The size a node has of its own: an image's, when its document gives it. */
function intrinsicWidth(resolved: ResolvedNode, available: number | null): number | null {
  // An Svg's drawing is as wide as it says, its padding and border around it; it's never narrowed (the Page draws it
  // so): wider than its room, it overflows it.
  if (resolved.type === "Svg" && typeof resolved.props.width === "number") return resolved.props.width + horizontalFrame(resolved.style, available, resolved.text.fontSize);
  if (resolved.type !== "Image" || resolved.props.src === undefined) return null;
  const own = assetParts(resolved.props.src as Asset).width ?? null;
  if (own === null) return null;
  return clamp(available === null ? own : Math.min(own, available), resolved.style, available, resolved.text.fontSize);
}

/** The width a node takes of `available` where its parent stacks its children. */
function stackedWidth(resolved: ResolvedNode, available: number | null): number | null {
  const fontSize = resolved.text.fontSize;
  const set = lengthPx(resolved.style.width, available, fontSize);
  if (set !== null) return clamp(set, resolved.style, available, fontSize);
  // A size its content decides ("fit-content", "max-content") isn't known.
  if (typeof resolved.style.width === "string" && /content$/.test(resolved.style.width)) return null;
  if (resolved.definition.sizing === "stretch") return available === null ? null : clamp(available, resolved.style, available, fontSize);
  if (resolved.definition.sizing === "shrink") return intrinsicWidth(resolved, available);
  return null;
}

function setWidth(resolved: ResolvedNode, width: number | null): void {
  resolved.width = width === null ? null : Math.round(width);
  resolved.contentWidth = resolved.width === null ? null : Math.max(0, resolved.width - horizontalFrame(resolved.style, resolved.available, resolved.text.fontSize));
}

/** How a node lays out its children: a stack, a Row, text, or (on a Page) a flex row or a grid its page styles make it. */
type Layout = "stack" | "row" | "text" | "flex" | "grid";

/** The layout a node's children are in: its component's, unless its page styles (display, flexDirection) say another. */
function layoutOf(resolved: ResolvedNode): Layout {
  if (resolved.type === "Table") return "stack";
  const page = pageLayout(resolved.style);
  if (page === "grid") return "grid";
  // A Row is a flex row of its own, unless its page styles make it a column or take it out of flex layout.
  if (resolved.type === "Row") {
    const { display, flexDirection } = resolved.style;
    return BLOCKLIKE.has(display as string) || flexDirection === "column" || flexDirection === "column-reverse" ? "stack" : "row";
  }
  if (resolved.definition.children.text) return "text";
  return page === "flex" ? "flex" : "stack";
}

/** A page alignSelf that places a child rather than stretching it. */
const PLACED = new Set(["start", "center", "end", "baseline"]);

/** Taken out of its parent's flow (position absolute or fixed): its width is its own, or unknown. */
const outOfFlow = (resolved: ResolvedNode) => resolved.style.position === "absolute" || resolved.style.position === "fixed";

function resolveChildren(node: Node, path: string, parent: ResolvedNode, available: number | null, layout: Layout, context: Context): Array<ResolvedNode | string> {
  const out: Array<ResolvedNode | string> = [];
  const nodes: Array<{ source: Node; resolved: ResolvedNode; at: string }> = [];
  (node.children ?? []).forEach((child, index) => {
    if (!isNode(child)) {
      out.push(child);
      return;
    }
    const at = `${path}.children[${index}]`;
    // Inside text, text takes no width of its own; what isn't text (an Image, a nested List) does.
    const inText = layout === "text" && !!context.registry.get(child.type)?.categories.includes("inline");
    // A Box directly in a Page spans the window: its width is the base sample's (Decision 19), not the content's.
    const spans = child.type === "Box" && context.root === "Page" && parent.path === "root";
    const resolved = resolveNode(child, at, parent.text, inText ? null : spans ? viewport.width : available, context);
    if (resolved.style.flex !== undefined && layout !== "row" && layout !== "flex") {
      context.d.warning("style/ignored", `flex only applies to a child of a Row, or of a flex row on a Page; this ${child.type} is in a ${parent.type}`, `${at}.style.flex`, child.id);
    }
    nodes.push({ source: child, resolved, at });
    out.push(resolved);
  });

  // Out of the flow, a child takes its own width or none known, and no room from the others.
  const flowing = nodes.filter(({ resolved }) => {
    if (!outOfFlow(resolved)) return true;
    const width = lengthPx(resolved.style.width, resolved.available, resolved.text.fontSize);
    setWidth(resolved, width === null ? null : clamp(width, resolved.style, resolved.available, resolved.text.fontSize));
    return false;
  });
  if (layout === "row") layOutRow(parent, flowing, available, path, context);
  else if (layout === "flex") layOutFlex(parent, flowing, available);
  else if (layout === "grid") layOutGrid(parent, flowing, available);
  else {
    for (const { resolved, at, source } of flowing) {
      if (resolved.available === null && layout === "text") continue;
      // A stack that stretches its children widens those that take their own size (a Button, an Image), as flexbox does;
      // not an Svg, whose width is its drawing's. Across a Layer is its justifyItems (its alignItems is down it).
      const across = parent.type === "Layer" ? parent.style.justifyItems : parent.style.alignItems;
      const stretched = layout === "stack" && across === "stretch" && resolved.definition.sizing === "shrink" && resolved.style.width === undefined && resolved.type !== "Svg";
      // On a Page, a child that would fill the width but is placed (alignSelf center, start, end) fits its content.
      const placed = layout === "stack" && resolved.definition.sizing === "stretch" && resolved.style.width === undefined && PLACED.has(resolved.style.alignSelf as string);
      const width = placed ? null : stretched && resolved.available !== null ? clamp(resolved.available, resolved.style, resolved.available) : stackedWidth(resolved, resolved.available);
      if (width !== null && resolved.available !== null && width > resolved.available + 0.5) {
        context.d.warning("layout/overflow", `This ${source.type} is ${Math.round(width)}px wide, wider than the ${Math.round(resolved.available)}px it's in`, at, source.id);
      }
      setWidth(resolved, width);
    }
  }

  for (const { source, resolved, at } of nodes) {
    if (source.type === "Table") {
      resolved.children = resolveTable(source, at, resolved, context);
      continue;
    }
    const own = layoutOf(resolved);
    // A box without a known width (a Link around an image) gives its children what it was given; one inside text, what the text was given.
    let inner = resolved.contentWidth ?? resolved.available ?? (layout === "text" ? available : null);
    // A List's items are beside its markers' column.
    if (source.type === "List" && inner !== null) inner = Math.max(0, inner - (toPx(resolved.style.indent, null) ?? 0));
    resolved.children = resolveChildren(source, at, resolved, inner, own, context);
    // A block Link around an image is as wide as it; inside text, a Link is a run and takes no width.
    if (resolved.width === null && source.type === "Link" && layout !== "text") {
      const image = resolved.children.find((c): c is ResolvedNode => typeof c !== "string" && c.type === "Image");
      if (image && image.width !== null) setWidth(resolved, image.width + horizontalFrame(resolved.style));
    }
  }
  return out;
}

/**
 * A Row, laid out as CSS flexbox lays out the Page's (one line, no
 * wrapping), so email gets the widths a browser gives:
 * - each child starts from its base: its width (px or %), its own size
 *   (`flex: "none"`: an image's), or, for a child sharing what's left (by its
 *   `flex`, 1 by default), its padding and border;
 * - what's left is shared by `flex`; what's missing is taken back from the
 *   children with a width, in proportion to their width inside their padding;
 * - a child that reaches its `minWidth` or `maxWidth` (or no room inside its
 *   padding) keeps it, and the rest is shared again among the others.
 * Widths are whole px. Children hidden on desktop aren't in it.
 */
function layOutRow(row: ResolvedNode, nodes: Array<{ source: Node; resolved: ResolvedNode; at: string }>, available: number | null, path: string, context: Context): void {
  if (available === null) return;
  // A child shown only on phones takes no room on desktop; on phones, where it shows, the Row's children stack: it's as wide as the Row.
  const desktop = nodes.filter(({ resolved }) => !resolved.hidden?.desktop);
  for (const { resolved } of nodes) if (resolved.hidden?.desktop) setWidth(resolved, available);
  const gap = lengthPx(row.style.gap, available, row.text.fontSize) ?? 0;
  const items = desktop.map(({ resolved }) => flexItem(resolved, available));
  // A Row that wraps breaks where its children no longer fit, and each line is laid out on its own.
  const wraps = row.style.flexWrap === "wrap" && (context.root === "Page" || (context.root === "Email" && row.props.stackOnMobile === false));
  for (const line of wraps ? wrappedLines(items, gap, available) : [items.map((_, index) => index)]) {
    const room = available - gap * Math.max(0, line.length - 1);
    const ownItems = line.map((index) => items[index]);
    const widths = roundTogether(flexWidths(ownItems, room));
    // A child that takes its own size, and whose size isn't known (a Button without a width), takes no room and stays unknown.
    line.forEach((index, at) => setWidth(desktop[index].resolved, items[index].unknown ? null : widths[at]));

    const asked = ownItems.reduce((sum, item) => sum + item.base, 0);
    const used = widths.reduce((sum, width) => sum + width, 0);
    if (used > room + 0.5) {
      context.d.warning("layout/overflow", `The Row's children need ${Math.round(used - room)}px more than the ${Math.round(available)}px it has, at their minimum widths`, path, row.id);
    } else if (asked > room + 0.5 && ownItems.some((item) => item.shrink > 0 && item.inner > 0)) {
      context.d.warning("layout/shrunk", `The Row's children's widths add up to ${Math.round(asked)}px, more than the ${Math.round(room)}px it has: they're narrowed to fit, as a browser does`, path, row.id);
    }
  }
}

/** A wrapping Row's children by line, as flexbox breaks them: at the child whose size no longer fits beside the others. */
function wrappedLines(items: FlexItem[], gap: number, available: number): number[][] {
  const lines: number[][] = [];
  let used = 0;
  items.forEach((item, index) => {
    const size = Math.max(item.min, Math.min(item.max, item.base));
    const line = lines[lines.length - 1];
    if (line && used + gap + size <= available + 0.5) {
      line.push(index);
      used += gap + size;
    } else {
      lines.push([index]);
      used = size;
    }
  });
  return lines;
}

interface FlexItem {
  /** Where it starts from, padding and border included. */
  base: number;
  /** Its base inside its padding and border: what shrinking takes from. */
  inner: number;
  min: number;
  max: number;
  grow: number;
  shrink: number;
  /** It takes its own size, and that size isn't known. */
  unknown: boolean;
}

/** A Row's child as a flex item: its base and limits, as the Page writes it (`flex: 0 1 <width>`, `0 0 auto`, or `<flex> 1 0%`, with `min-width: 0`). */
function flexItem(resolved: ResolvedNode, available: number): FlexItem {
  const { style } = resolved;
  const frame = horizontalFrame(style, available, resolved.text.fontSize);
  const width = lengthPx(style.width, available, resolved.text.fontSize);
  // An Svg is the size it says in a Row too (the Page draws it `flex: none`), not a share of what's left.
  const own = style.flex === "none" || style.flex === 0 || resolved.type === "Svg";
  const intrinsic = own && width === null ? intrinsicWidth(resolved, available) : null;
  const base = width !== null ? width : own ? (intrinsic ?? 0) : frame;
  // Its content can't be narrower than nothing: at least its padding and border.
  const min = Math.max(frame, lengthPx(style.minWidth, available, resolved.text.fontSize) ?? 0);
  const max = Math.max(min, lengthPx(style.maxWidth, available, resolved.text.fontSize) ?? Number.POSITIVE_INFINITY);
  return {
    base,
    inner: Math.max(0, base - frame),
    min,
    max,
    grow: width !== null || own ? 0 : typeof style.flex === "number" ? style.flex : 1,
    shrink: own ? 0 : 1,
    unknown: own && width === null && intrinsic === null,
  };
}

/**
 * A flex row on a Page (a Box, or a container whose page styles make it one), as Chromium lays it out with the
 * `min-width: 0` the writer gives each child (Decision 19): each child from its basis (flexBasis, else its width, else
 * its own size), growing by flexGrow (or its `flex` share, from 0) and shrinking by flexShrink. A child whose basis is
 * its content's is unknown, and so is every child on its line that grows into what's left; one of a known size that
 * doesn't grow keeps it (taking the line to fit, as a page laid out to fit does).
 */
function layOutFlex(parent: ResolvedNode, nodes: Array<{ resolved: ResolvedNode }>, available: number | null): void {
  if (available === null) {
    for (const { resolved } of nodes) setWidth(resolved, null);
    return;
  }
  const shown = nodes.filter(({ resolved }) => !resolved.hidden?.desktop);
  for (const { resolved } of nodes) if (resolved.hidden?.desktop) setWidth(resolved, null);
  const gap = lengthPx(parent.style.columnGap ?? parent.style.gap, available, parent.text.fontSize) ?? 0;
  const ordered = [...shown].sort((a, b) => (Number(a.resolved.style.order) || 0) - (Number(b.resolved.style.order) || 0));
  const items = ordered.map(({ resolved }) => boxFlexItem(resolved, available));
  const wraps = parent.style.flexWrap === "wrap" || parent.style.flexWrap === "wrap-reverse";
  for (const line of wraps ? (items.some((item) => item.unknown) ? [items.map((_, i) => i)] : wrappedLines(items, gap, available)) : [items.map((_, index) => index)]) {
    const own = line.map((index) => items[index]);
    if (own.some((item) => item.unknown)) {
      // What's left depends on a size not known: what grows into it is unknown; what doesn't keeps its size.
      line.forEach((index) => setWidth(ordered[index].resolved, items[index].grow === 0 && !items[index].unknown ? Math.max(items[index].min, Math.min(items[index].max, items[index].base)) : null));
      continue;
    }
    const widths = roundTogether(flexWidths(own, available - gap * Math.max(0, line.length - 1)));
    line.forEach((index, at) => setWidth(ordered[index].resolved, widths[at]));
  }
}

/** A child of a flex row on a Page as a flex item: CSS's initial `0 1 auto`, its `flex` share as `<n> 1 0%`. */
function boxFlexItem(resolved: ResolvedNode, available: number): FlexItem {
  const { style } = resolved;
  const fontSize = resolved.text.fontSize;
  const frame = horizontalFrame(style, available, fontSize);
  const width = lengthPx(style.width, available, fontSize);
  // flex: 0 is its own size, as in a Row and as the writer writes it (0 0 auto), not a share of nothing.
  const none = style.flex === "none" || style.flex === 0;
  const share = typeof style.flex === "number" && !none ? style.flex : undefined;
  const basisValue = style.flexBasis ?? (share !== undefined ? 0 : "auto");
  let base: number | null;
  if (basisValue === "auto") base = width ?? intrinsicWidth(resolved, available);
  else if (basisValue === "content") base = intrinsicWidth(resolved, available);
  else base = lengthPx(basisValue, available, fontSize);
  const grow = typeof style.flexGrow === "number" ? style.flexGrow : (share ?? 0);
  const shrink = typeof style.flexShrink === "number" ? style.flexShrink : none ? 0 : 1;
  const min = Math.max(frame, lengthPx(style.minWidth, available, fontSize) ?? 0);
  const max = Math.max(min, lengthPx(style.maxWidth, available, fontSize) ?? Number.POSITIVE_INFINITY);
  // A minimum of its content's ("auto", "min-content") is its content's: unknown.
  const contentMin = typeof style.minWidth === "string" && /^(auto|min-content|max-content|fit-content)$/.test(style.minWidth);
  const known = base !== null && !contentMin;
  const at = known ? Math.max(base as number, frame) : frame;
  return { base: at, inner: Math.max(0, at - frame), min, max, grow, shrink, unknown: !known };
}

/** A grid track: a size in px, a share of what's left (fr, from a minimum), or a size its content decides. */
type Track = { px: number } | { fr: number; min: number } | { content: true };

/**
 * A grid on a Page, as CSS grid lays it out at the base sample (Decision 19): its columns from gridTemplateColumns
 * (px and the other lengths, %, fr, minmax() of a length and fr, repeat() with a count, auto-fill or auto-fit), its
 * children placed row by row in order, each spanning `gridColumn: "span n"`, lines or a named area. A track its
 * content decides (auto, min-content, max-content, fit-content()) is unknown, and fr tracks beside it too.
 */
function layOutGrid(parent: ResolvedNode, nodes: Array<{ resolved: ResolvedNode }>, available: number | null): void {
  const shown = nodes.filter(({ resolved }) => !resolved.hidden?.desktop);
  for (const { resolved } of nodes) if (resolved.hidden?.desktop) setWidth(resolved, null);
  const fontSize = parent.text.fontSize;
  const gap = available === null ? 0 : (lengthPx(parent.style.columnGap ?? parent.style.gap, available, fontSize) ?? 0);
  const ordered = [...shown].sort((a, b) => (Number(a.resolved.style.order) || 0) - (Number(b.resolved.style.order) || 0));
  const tracks = available === null ? null : gridTracks(parent.style.gridTemplateColumns, available, gap, fontSize, ordered.length);
  const widths = tracks === null ? null : trackWidths(tracks, available as number, gap);
  const areas = gridAreas(parent.style.gridTemplateAreas);
  const count = widths?.length ?? 1;
  const places = gridPlaces(ordered.map(({ resolved }) => gridPlacement(resolved, areas, count)), count);
  ordered.forEach(({ resolved }, index) => {
    const { column: start, span: wanted } = places[index];
    const span = Math.max(1, Math.min(wanted, count - start));
    const cells = widths?.slice(start, start + span);
    const cell = !cells || cells.length === 0 || cells.some((w) => w === null) ? null : (cells as number[]).reduce((sum, w) => sum + w, 0) + gap * (span - 1);
    setWidth(resolved, gridItemWidth(resolved, parent, cell));
  });
}

/**
 * Each grid item's column, as CSS grid places them (css-grid-1, "Grid Item Placement Algorithm", sparse): first those
 * with a row and a column (a named area), then those with a row, then the rest in order, an item with a column at it
 * (on the next row if that's before the cursor), the others at the next cells free from the cursor on.
 */
function gridPlaces(items: Array<{ start?: number; span: number; row?: number; rowSpan: number }>, count: number): Array<{ column: number; span: number }> {
  const taken = new Set<string>();
  const free = (row: number, column: number, span: number, rowSpan: number) => {
    for (let r = row; r < row + rowSpan; r++) for (let c = column; c < column + span; c++) if (taken.has(`${r}:${c}`)) return false;
    return true;
  };
  const take = (row: number, column: number, span: number, rowSpan: number) => {
    for (let r = row; r < row + rowSpan; r++) for (let c = column; c < column + span; c++) taken.add(`${r}:${c}`);
  };
  const out: Array<{ column: number; span: number }> = items.map((item) => ({ column: item.start ?? 0, span: item.span }));
  const span = (item: (typeof items)[number]) => Math.max(1, Math.min(item.span, count));
  // A row and a column.
  for (const item of items) if (item.start !== undefined && item.row !== undefined) take(item.row, item.start, span(item), item.rowSpan);
  // A row: the first column free in it.
  items.forEach((item, index) => {
    if (item.start !== undefined || item.row === undefined) return;
    let column = 0;
    while (column + span(item) < count && !free(item.row, column, span(item), item.rowSpan)) column++;
    take(item.row, column, span(item), item.rowSpan);
    out[index] = { column, span: item.span };
  });
  // The rest, with the cursor.
  let row = 0;
  let cursor = 0;
  items.forEach((item, index) => {
    if (item.row !== undefined) return;
    const width = span(item);
    if (item.start !== undefined) {
      if (item.start < cursor) row++;
      cursor = item.start;
      while (!free(row, item.start, width, item.rowSpan)) row++;
      take(row, item.start, width, item.rowSpan);
      return;
    }
    for (let guard = 0; guard < 10000; guard++) {
      if (cursor + width > count) {
        row++;
        cursor = 0;
      }
      if (free(row, cursor, width, item.rowSpan)) break;
      cursor++;
    }
    take(row, cursor, width, item.rowSpan);
    out[index] = { column: cursor, span: item.span };
    cursor += width;
  });
  return out;
}

/** A grid item's width in its cell: its own, or the cell's (stretched), or its own size where it isn't stretched. */
function gridItemWidth(resolved: ResolvedNode, grid: ResolvedNode, cell: number | null): number | null {
  const fontSize = resolved.text.fontSize;
  const own = lengthPx(resolved.style.width, cell, fontSize);
  if (own !== null) return clamp(own, resolved.style, cell, fontSize);
  const justify = resolved.style.justifySelf ?? grid.style.justifyItems;
  const stretched = justify === undefined || justify === "stretch" || justify === "auto";
  // An image keeps its own size, no wider than its cell; what takes its own size and isn't stretched fits its content.
  if (resolved.type === "Image") return intrinsicWidth(resolved, cell);
  if (!stretched || resolved.definition.sizing === "shrink") return null;
  return cell === null ? null : clamp(cell, resolved.style, cell, fontSize);
}

/** A grid's column tracks, repeat() expanded (auto-fill and auto-fit by what fits), or null where none is known. */
function gridTracks(template: Json | undefined, available: number, gap: number, fontSize: number, items: number): Track[] | null {
  if (template === undefined || template === "none") return [{ px: available }];
  if (typeof template === "number") return [{ px: template }];
  const terms = readTerms(String(template));
  if (!terms.ok || terms.value.length !== 1) return null;
  const context = { percentOf: available, fontSize, viewport };
  const one = (term: Term): Track => {
    if (term.t === "num" && term.unit === "fr") return { fr: term.value, min: 0 };
    if (term.t === "fn" && term.name === "minmax" && term.args.length === 2) {
      const [low, high] = term.args.map((seq) => seq[0]);
      const min = termLength(low, context);
      if (min === null) return { content: true };
      if (high.t === "num" && high.unit === "fr") return { fr: high.value, min };
      const max = termLength(high, context);
      return max === null ? { content: true } : { px: Math.max(min, max) };
    }
    const px = termLength(term, context);
    return px === null ? { content: true } : { px };
  };
  const out: Track[] = [];
  for (const term of terms.value[0]) {
    if (term.t === "fn" && term.name === "repeat" && term.args.length === 2) {
      const [countTerm] = term.args[0];
      const inner = term.args[1].map(one);
      let times: number;
      if (countTerm.t === "num") times = countTerm.value;
      else {
        // As many as fit at their least sizes; auto-fit drops those no child is in.
        const least = inner.map((track) => ("px" in track ? track.px : "fr" in track ? track.min : 0)).reduce((a, b) => a + b, 0) + gap * Math.max(0, inner.length - 1);
        const fixed = out.reduce((sum, track) => sum + ("px" in track ? track.px + gap : gap), 0);
        times = least > 0 ? Math.max(1, Math.floor((available - fixed + gap) / (least + gap))) : 1;
        if (countTerm.t === "word" && countTerm.name === "auto-fit") times = Math.max(1, Math.min(times, Math.ceil(items / Math.max(1, inner.length))));
      }
      for (let i = 0; i < Math.min(times, MAX_REPEAT); i++) out.push(...inner);
    } else out.push(one(term));
  }
  return out.length ? out : null;
}

/** Each track's width: px as it is, fr sharing what's left (none below its minimum); null for every fr beside a content track. */
function trackWidths(tracks: Track[], available: number, gap: number): Array<number | null> {
  const content = tracks.some((track) => "content" in track);
  const fixed = tracks.reduce((sum, track) => sum + ("px" in track ? track.px : 0), 0);
  let free = available - fixed - gap * Math.max(0, tracks.length - 1);
  const out: Array<number | null> = tracks.map((track) => ("px" in track ? track.px : null));
  if (content) return out;
  // fr: shared by their factors; one whose share is below its minimum takes its minimum, and the rest share again.
  const open = new Set(tracks.map((track, index) => ("fr" in track ? index : -1)).filter((index) => index >= 0));
  for (let round = 0; round <= tracks.length && open.size; round++) {
    const factors = [...open].reduce((sum, index) => sum + (tracks[index] as { fr: number }).fr, 0);
    const unit = factors > 0 ? Math.max(0, free) / Math.max(1, factors) : 0;
    const below = [...open].filter((index) => unit * (tracks[index] as { fr: number }).fr < (tracks[index] as { min: number }).min);
    if (!below.length) {
      for (const index of open) out[index] = unit * (tracks[index] as { fr: number }).fr;
      break;
    }
    for (const index of below) {
      out[index] = (tracks[index] as { min: number }).min;
      free -= out[index] as number;
      open.delete(index);
    }
  }
  return out;
}

/** The columns each named area of gridTemplateAreas spans. */
type Area = { start: number; end: number; row: number; rowEnd: number };

/** The columns and rows each named area of gridTemplateAreas spans. */
function gridAreas(template: Json | undefined): Map<string, Area> {
  const out = new Map<string, Area>();
  if (!Array.isArray(template)) return out;
  template.forEach((line, row) => {
    String(line)
      .split(/\s+/)
      .forEach((name, index) => {
        if (name.startsWith(".")) return;
        const area = out.get(name);
        if (!area) out.set(name, { start: index, end: index + 1, row, rowEnd: row + 1 });
        else {
          area.end = Math.max(area.end, index + 1);
          area.rowEnd = Math.max(area.rowEnd, row + 1);
        }
      });
  });
  return out;
}

/** Where a grid item starts (a column and a row, from 0) and how many it spans, from gridColumn, gridRow, gridArea or none. */
function gridPlacement(resolved: ResolvedNode, areas: Map<string, Area>, count: number): { start?: number; span: number; row?: number; rowSpan: number } {
  const area = typeof resolved.style.gridArea === "string" ? areas.get(resolved.style.gridArea.trim()) : undefined;
  if (area && resolved.style.gridColumn === undefined && resolved.style.gridRow === undefined) return { start: area.start, span: area.end - area.start, row: area.row, rowSpan: area.rowEnd - area.row };
  const rows = gridLines(resolved.style.gridRow ?? (typeof resolved.style.gridArea === "string" && resolved.style.gridArea.includes("/") ? resolved.style.gridArea.split("/")[0] + "/" + (resolved.style.gridArea.split("/")[2] ?? "") : undefined));
  const columns = gridColumnPlacement(resolved, count);
  return { ...columns, ...(rows.start !== undefined ? { row: rows.start } : {}), rowSpan: rows.span };
}

/** A gridRow's lines as a start (from 0, rows counted from the first only) and a span. */
function gridLines(value: Json | undefined): { start?: number; span: number } {
  if (value === undefined) return { span: 1 };
  if (typeof value === "number") return value > 0 ? { start: value - 1, span: 1 } : { span: 1 };
  const parts = String(value).split("/").map((part) => part.trim());
  const spanOf = (part: string | undefined) => (part && /^span \d+$/.test(part) ? Number(part.slice(5)) : undefined);
  const lineOf = (part: string | undefined) => (part && /^\d+$/.test(part) && Number(part) > 0 ? Number(part) - 1 : undefined);
  const start = lineOf(parts[0]);
  const end = lineOf(parts[1]);
  const span = spanOf(parts[0]) ?? spanOf(parts[1]) ?? (start !== undefined && end !== undefined ? Math.max(1, end - start) : 1);
  return start !== undefined ? { start, span } : { span };
}

/** Where a grid item starts (a column, from 0) and how many it spans, from gridColumn, gridArea or neither. */
function gridColumnPlacement(resolved: ResolvedNode, count: number): { start?: number; span: number } {
  const column = resolved.style.gridColumn ?? (typeof resolved.style.gridArea === "string" ? resolved.style.gridArea.split("/").map((part) => part.trim()).filter((_, i) => i % 2 === 1).join(" / ") || resolved.style.gridArea : undefined);
  if (column === undefined) return { span: 1 };
  if (typeof column === "number") return { start: lineIndex(column, count), span: 1 };
  const parts = String(column).split("/").map((part) => part.trim());
  const spanOf = (part: string | undefined) => (part && /^span \d+$/.test(part) ? Number(part.slice(5)) : undefined);
  const lineOf = (part: string | undefined) => (part && /^-?\d+$/.test(part) ? lineIndex(Number(part), count) : undefined);
  const start = lineOf(parts[0]);
  const end = lineOf(parts[1]);
  const span = spanOf(parts[0]) ?? spanOf(parts[1]) ?? (start !== undefined && end !== undefined ? Math.max(1, end - start) : 1);
  return start !== undefined ? { start, span } : { span };
}

/** A grid line (1 first, -1 last) as a column index from 0. */
const lineIndex = (line: number, count: number) => Math.max(0, line > 0 ? line - 1 : count + 1 + line);

/** CSS flexbox's widths for one line of items in `room` px (css-flexbox-1, "Resolving Flexible Lengths"). */
function flexWidths(items: FlexItem[], room: number): number[] {
  const clamp = (item: FlexItem, width: number) => Math.max(item.min, Math.min(item.max, width));
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  const hypothetical = items.map((item) => clamp(item, item.base));
  const growing = sum(hypothetical) <= room;
  const factor = (item: FlexItem) => (growing ? item.grow : item.shrink);
  const target = items.map((item) => item.base);
  const frozen = items.map((item, index) => {
    const inflexible = factor(item) === 0 || (growing ? item.base > hypothetical[index] : item.base < hypothetical[index]);
    if (inflexible) target[index] = hypothetical[index];
    return inflexible;
  });
  const initialFree = room - sum(items.map((item, index) => (frozen[index] ? target[index] : item.base)));

  for (let round = 0; round <= items.length && frozen.includes(false); round++) {
    const open = items.map((_, index) => index).filter((index) => !frozen[index]);
    let free = room - sum(items.map((item, index) => (frozen[index] ? target[index] : item.base)));
    // Flex factors that add up to less than 1 share only that part of the space.
    const factors = sum(open.map((index) => factor(items[index])));
    if (factors < 1 && Math.abs(initialFree * factors) < Math.abs(free)) free = initialFree * factors;
    const weights = open.map((index) => (growing ? items[index].grow : items[index].shrink * items[index].inner));
    const total = sum(weights);
    open.forEach((index, k) => {
      target[index] = items[index].base + (total > 0 ? (free * weights[k]) / total : 0);
    });
    // Clamp to the limits; freeze those that went past one, the side that went past most.
    const violation = open.map((index) => clamp(items[index], target[index]) - target[index]);
    const net = sum(violation);
    open.forEach((index, k) => {
      const past = Math.abs(net) < 1e-9 || (net > 0 ? violation[k] > 0 : violation[k] < 0);
      target[index] = clamp(items[index], target[index]);
      if (past) frozen[index] = true;
    });
  }
  return target;
}

/** Widths in whole px that add up to their rounded total (the largest remainders get the leftover px). */
function roundTogether(widths: number[]): number[] {
  const floors = widths.map(Math.floor);
  let left = Math.round(widths.reduce((sum, width) => sum + width, 0)) - floors.reduce((sum, width) => sum + width, 0);
  const order = widths.map((width, index) => ({ index, rest: width - Math.floor(width) })).sort((a, b) => b.rest - a.rest || a.index - b.index);
  for (const { index } of order) {
    if (left <= 0) break;
    floors[index] += 1;
    left -= 1;
  }
  return floors;
}

/** `free` px shared by `weights`, in whole px that add up to it (the largest remainders get the leftover px). */
function share(free: number, weights: number[]): number[] {
  const total = weights.reduce((sum, w) => sum + w, 0);
  const room = Math.floor(free);
  const exact = weights.map((w) => (total ? (room * w) / total : 0));
  const widths = exact.map(Math.floor);
  let left = room - widths.reduce((a, b) => a + b, 0);
  const order = exact.map((value, index) => ({ index, rest: value - Math.floor(value) })).sort((a, b) => b.rest - a.rest || a.index - b.index);
  for (const { index } of order) {
    if (left <= 0) break;
    widths[index] += 1;
    left -= 1;
  }
  return widths;
}

/**
 * A Table: its rows as wide as its content, its columns as wide as their
 * cells say (a cell spanning one column, the first that has a width), the
 * rest sharing what's left; each cell as wide as the columns it spans, its
 * padding its own or the table's `cellPadding`, its bottom border its own or
 * the table's `rowBorder` (but in the last row).
 */
function resolveTable(source: Node, path: string, table: ResolvedNode, context: Context): Array<ResolvedNode | string> {
  const available = table.contentWidth;
  const rows = (source.children ?? []).flatMap((child, index) => {
    if (!isNode(child)) return [];
    const at = `${path}.children[${index}]`;
    const row = resolveNode(child, at, table.text, available, context);
    setWidth(row, available);
    const cells = (child.children ?? []).flatMap((cell, cellIndex) => {
      if (!isNode(cell)) return [];
      const resolved = resolveNode(cell, `${at}.children[${cellIndex}]`, row.text, available, context);
      if (resolved.style.padding === undefined && table.style.cellPadding !== undefined) resolved.style.padding = table.style.cellPadding;
      return [{ source: cell, resolved, at: `${at}.children[${cellIndex}]` }];
    });
    return [{ row, cells }];
  });

  const span = (cell: ResolvedNode) => Math.max(1, Number(cell.props.colSpan) || 1);
  const count = Math.max(0, ...rows.map(({ cells }) => cells.reduce((sum, { resolved }) => sum + span(resolved), 0)));
  let columns: number[] | null = null;
  if (available !== null && count > 0) {
    const set: Array<number | null> = new Array(count).fill(null);
    const own: boolean[] = new Array(count).fill(false);
    for (const { cells } of rows) {
      let column = 0;
      for (const { resolved } of cells) {
        if (span(resolved) === 1 && set[column] === null) {
          const width = toPx(resolved.style.width, available);
          set[column] = width === null ? null : Math.round(width);
          own[column] = typeof resolved.style.width === "number";
        }
        column += span(resolved);
      }
    }
    const fixed = set.reduce<number>((sum, width) => sum + (width ?? 0), 0);
    // (Each column's width is rounded: by half a pixel at most.)
    if (fixed > available + count / 2) {
      context.d.warning("layout/overflow", `The Table's columns are ${Math.round(fixed - available)}px wider than the ${Math.round(available)}px it has`, path, table.id);
    }
    const free = set.map((width, index) => (width === null ? index : -1)).filter((index) => index >= 0);
    const shared = share(Math.max(0, available - fixed), free.map(() => 1));
    columns = set.map((width, index) => (width === null ? shared[free.indexOf(index)] : width));
    // Every column has a width and they don't add up to the table: they grow or shrink in proportion to fill it, as
    // the writers' shares of the table draw them (too wide is still warned about, above).
    if (free.length === 0 && fixed > 0 && Math.abs(fixed - available) > 0.5) columns = share(available, columns);
    // A column of its own px stays that wide in a narrower window, the others taking what's left: as a share of the
    // table it would shrink past its words. With no other to take it, the whole table would run past the window.
    if (free.length > 0 && own.some(Boolean)) {
      const sizes = set.map<"px" | "share" | "free">((width, index) => (own[index] ? "px" : width === null ? "free" : "share"));
      table.columnSizes = sizes;
      for (const { row } of rows) row.columnSizes = sizes;
    }
  }
  table.columns = columns;

  // The line between rows is each cell's bottom border, but in the last row and where a cell sets its own.
  const rowBorder = table.style.rowBorder as BorderSide | undefined;
  rows.forEach(({ cells }, index) => {
    if (!rowBorder || index === rows.length - 1) return;
    for (const { resolved } of cells) {
      const own = resolved.style.border as Border | undefined;
      if (!own?.bottom) resolved.style.border = { ...own, bottom: rowBorder };
    }
  });

  for (const { row, cells } of rows) {
    let column = 0;
    for (const { source: cell, resolved, at } of cells) {
      const width = columns ? columns.slice(column, column + span(resolved)).reduce((sum, w) => sum + w, 0) : null;
      column += span(resolved);
      resolved.available = width;
      setWidth(resolved, width);
      resolved.children = resolveChildren(cell, at, resolved, resolved.contentWidth, "text", context);
    }
    row.children = cells.map(({ resolved }) => resolved);
  }
  return rows.map(({ row }) => row);
}

/** Errors for each component the target doesn't render (custom components: for what they're made of). */
export function checkTarget(input: ElementsDocument, target: Target, options?: ComponentsOption | Registry): Diagnostic[] {
  const registry = registryOf(options);
  const expanded = expandDocument(input, registry);
  return checkTargetExpanded(expanded.document, target, registry, expanded.paths);
}

/** `checkTarget` for a document whose custom components are already expanded (its `paths`: each node's place in the template). */
export function checkTargetExpanded(document: ElementsDocument, target: Target, options?: ComponentsOption | Registry, paths?: TemplatePaths): Diagnostic[] {
  const registry = registryOf(options);
  const d = new Diagnostics();
  const visit = (node: Node, path: string) => {
    const definition = registry.get(node.type);
    if (definition && !definition.targets[target]) {
      const why = definition.unsupported?.[target];
      d.error("target/unsupported", `A ${node.type} can't be rendered to ${target}${why ? `: ${why}` : ""}`, path, node.id);
      // What's in it goes with it: one error.
      return;
    }
    node.children?.forEach((child, index) => isNode(child) && visit(child, `${path}.children[${index}]`));
  };
  visit(document.root, "root");
  const templatePath = paths ? templatePathsOf(document, paths) : (path: string) => path;
  return d.list.map((diagnostic) => ({ ...diagnostic, path: templatePath(diagnostic.path) }));
}
