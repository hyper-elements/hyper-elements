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
import { laysOutAsRow, pageLayout } from "./css-serialize";
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

/**
 * Whether the document resolving is a Page: there a border side styled "none" takes no width, as the browser draws it.
 * Another root keeps the width it always counted (its layout is held by the compatibility baseline).
 */
let resolvingPage = false;

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

/**
 * A size in px (a width, a padding, a gap, a border, a basis, a track), as `lengthPx` reads it; a calc(), min(), max()
 * or clamp() that comes out below 0 is 0, as CSS range-checks a property's value (css-values-4, "Range Checking"). A
 * writer that puts the value inside an expression of its own (a Section's gutter, a List's indent) range-checks the
 * whole: those use `lengthPx` and clamp the sum.
 */
function sizePx(value: Json | undefined, of: number | null, fontSize = 16, at: { width: number; height: number } = viewport): number | null {
  const px = lengthPx(value, of, fontSize, at);
  // Only a math function's result (a Page's): a plain value keeps what it gave before, in every root.
  return px === null || typeof value !== "string" || !value.includes("(") ? px : Math.max(0, px);
}

/** The same for one term of a value (a track). */
function sizeTerm(term: Term, context: Parameters<typeof termLength>[1]): number | null {
  const px = termLength(term, context);
  return px === null || term.t !== "fn" ? px : Math.max(0, px);
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
  return frameOf(style, of, fontSize, true) as number;
}

/**
 * The same, or null where a side can't be known (a percentage of an unknown width, a length in ch); `lenient`, such a
 * side counts as 0 (for an estimate).
 */
function frameOf(style: Record<string, Json>, of: number | null, fontSize: number, lenient = false): number | null {
  const padding = style.padding as Record<keyof Insets, number | string> | undefined;
  const side = (value: Json | undefined) => (value === undefined ? 0 : sizePx(value, of, fontSize));
  const border = borderWidths(style, fontSize);
  const parts = [side(style.paddingLeft ?? padding?.left), side(style.paddingRight ?? padding?.right), border.left, border.right];
  if (!lenient && parts.includes(null)) return null;
  return parts.reduce<number>((sum, part) => sum + (part ?? 0), 0);
}

/**
 * A box's left and right border widths: its border's, then its page styles' in the order they're written (each after
 * the one before, as CSS reads them): borderLeft and borderRight, borderWidth (one to four widths), and borderStyle
 * ("none" takes the border away; another style without a width is CSS's medium, 3px). A width with no style shows none.
 */
function borderWidths(style: Record<string, Json>, fontSize: number): { left: number | null; right: number | null } {
  const border = style.border as Border | undefined;
  // On a Page, a side styled "none" shows none (another root counts its width, as it always has).
  const shown = (side: BorderSide | undefined) => !!side && !(resolvingPage && side.style === "none");
  const sides = {
    left: { width: border?.left?.width as number | null | undefined, shown: shown(border?.left) },
    right: { width: border?.right?.width as number | null | undefined, shown: shown(border?.right) },
  };
  for (const [key, value] of Object.entries(style)) {
    if ((key === "borderLeft" || key === "borderRight") && value && typeof value === "object") {
      const side = sides[key === "borderLeft" ? "left" : "right"];
      side.width = Number((value as BorderSide).width);
      side.shown = (value as BorderSide).style !== "none";
    } else if (key === "borderStyle") {
      for (const side of Object.values(sides)) side.shown = value !== "none";
    } else if (key === "borderWidth") {
      const terms = typeof value === "number" ? null : readTerms(String(value));
      // A width the model can't evaluate (ch) is unknown.
      const widths = typeof value === "number" ? [value] : terms?.ok && terms.value.length === 1 ? terms.value[0].map((term) => sizeTerm(term, { percentOf: null, fontSize, viewport })) : [null];
      // CSS's shorthand by how many are given (one: all; two or three: the second is left and right; four: each).
      sides.left.width = widths.length === 4 ? widths[3] : widths.length >= 2 ? widths[1] : widths[0];
      sides.right.width = widths.length >= 2 ? widths[1] : widths[0];
    }
  }
  // A side with no style is none (CSS's initial), whatever its width; one with a style and no width is medium, 3px.
  const px = (side: { width?: number | null; shown: boolean }) => (!side.shown ? 0 : side.width === undefined ? 3 : side.width);
  return { left: px(sides.left), right: px(sides.right) };
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
  const page = resolvingPage;
  try {
    viewport = baseViewport({ type: document.root.type, props: propsWithDefaults(registryOf(options).get(document.root.type)!, document.root.props) });
    resolvingPage = document.root.type === "Page";
    return resolveAtViewport(document, options, paths);
  } finally {
    viewport = around;
    resolvingPage = page;
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
  direct(root, null);
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

/**
 * Whether a node's minWidth and maxWidth are known: not its content's (min-content), nor a length the model can't
 * evaluate (ch). A percentage of an unknown width is ignored as before, unless `strict` (out of the flow, where it's
 * of a containing block the model doesn't follow).
 */
function limitsKnown(style: Record<string, Json>, of: number | null, fontSize: number, strict = false): boolean {
  return [style.minWidth, style.maxWidth].every((limit) => {
    if (typeof limit !== "string" || limit === "none" || limit === "auto") return true;
    if (sizePx(limit, of, fontSize) !== null) return true;
    // A plain percentage of an unknown width is left out, as before; one mixed with what the model can't evaluate isn't.
    return !strict && of === null && /^\s*\d*\.?\d+%\s*$/.test(limit);
  });
}

function clamp(width: number, style: Record<string, Json>, of: number | null, fontSize = 16): number {
  const min = sizePx(style.minWidth, of, fontSize);
  const max = sizePx(style.maxWidth, of, fontSize);
  if (max !== null) width = Math.min(width, max);
  if (min !== null) width = Math.max(width, min);
  return width;
}

/**
 * The size a node has of its own: an image's, when its document gives it. `fileSize`: an Image the Page writes at its
 * file's size (in a Box, or a flex row or grid a Page's styles make), whose own maxWidth replaces the 100% that
 * otherwise keeps it inside its place; it's content-box there (the Page writes no box-sizing for it), its padding and
 * border outside that size.
 */
function intrinsicWidth(resolved: ResolvedNode, available: number | null, fileSize = false): number | null {
  // An Svg's drawing is as wide as it says, its padding and border around it; it's never narrowed (the Page draws it
  // so): wider than its room, it overflows it.
  if (resolved.type === "Svg" && typeof resolved.props.width === "number") return resolved.props.width + horizontalFrame(resolved.style, available, resolved.text.fontSize);
  if (resolved.type !== "Image" || resolved.props.src === undefined) return null;
  const own = assetParts(resolved.props.src as Asset).width ?? null;
  if (own === null) return null;
  const capped = available === null || (fileSize && resolved.style.maxWidth !== undefined) ? own : Math.min(own, available);
  const content = clamp(capped, resolved.style, available, resolved.text.fontSize);
  return fileSize ? content + horizontalFrame(resolved.style, available, resolved.text.fontSize) : content;
}

/** The width a node takes of `available` where its parent stacks its children. */
/**
 * Whether a node's width is set to one the model can't know: its content's ("fit-content", "max-content"), or a length
 * it can't evaluate (ch, ex). A percentage of an unknown width isn't one: it's as unknown as what it's of.
 */
function contentSized(resolved: ResolvedNode, available: number | null): boolean {
  const width = resolved.style.width;
  // Its limits first, whatever its width: a maxWidth in ch bounds a width in px too.
  if (!limitsKnown(resolved.style, available, resolved.text.fontSize)) return true;
  if (typeof width !== "string" || width === "auto") return false;
  if (/content$/.test(width)) return true;
  return sizePx(width, available, resolved.text.fontSize) === null && !(available === null && /%/.test(width));
}

function stackedWidth(resolved: ResolvedNode, available: number | null): number | null {
  const fontSize = resolved.text.fontSize;
  if (!limitsKnown(resolved.style, available, fontSize)) return null;
  const set = sizePx(resolved.style.width, available, fontSize);
  if (set !== null) return clamp(set, resolved.style, available, fontSize);
  if (contentSized(resolved, available)) return null;
  if (resolved.definition.sizing === "stretch") return available === null ? null : clamp(available, resolved.style, available, fontSize);
  if (resolved.definition.sizing === "shrink") return intrinsicWidth(resolved, available);
  return null;
}

function setWidth(resolved: ResolvedNode, width: number | null): void {
  resolved.width = width === null ? null : Math.round(width);
  if (resolved.width === null) {
    resolved.contentWidth = null;
    return;
  }
  const inside = resolved.type === "Section" ? sectionContent(resolved, resolved.width) : resolved.width - (frameOf(resolved.style, resolved.available, resolved.text.fontSize) ?? Number.NaN);
  // A frame not known leaves what's inside it unknown (and what that holds), though the box's own width is known.
  if (Number.isNaN(inside) || inside === null) {
    resolved.contentWidth = null;
    fitsContent.add(resolved);
  } else resolved.contentWidth = Math.max(0, inside);
}

/**
 * A Section's content width: its box spans the window (V0), each side's padding at least as given, more where the
 * window is wider than the Page (`max(p, (100% - width) / 2 + p)`, with % the window's), its borders inside that; a
 * page style's paddingLeft or paddingRight, written after, is that side's padding instead.
 */
function sectionContent(resolved: ResolvedNode, width: number): number | null {
  const { style } = resolved;
  const fontSize = resolved.text.fontSize;
  const window = Math.max(viewport.width, width);
  const padding = style.padding as Record<keyof Insets, number | string> | undefined;
  const gutter = (value: Json | undefined) => {
    // Inside the writer's max(p, (100% - width) / 2 + p): the whole is range-checked, not p.
    const own = value === undefined ? 0 : lengthPx(value, window, fontSize);
    return own === null ? null : Math.max(0, own, (window - width) / 2 + own);
  };
  const left = style.paddingLeft !== undefined ? sizePx(style.paddingLeft, window, fontSize) : gutter(padding?.left);
  const right = style.paddingRight !== undefined ? sizePx(style.paddingRight, window, fontSize) : gutter(padding?.right);
  const border = borderWidths(style, fontSize);
  if (left === null || right === null || border.left === null || border.right === null) return null;
  return window - left - right - border.left - border.right;
}

/** How a node lays out its children: a stack, a Row, text, or (on a Page) a flex row or a grid its page styles make it. */
type Layout = "stack" | "row" | "text" | "flex" | "grid";

/** The layout a node's children are in: its component's, unless its page styles (display, flexDirection) say another. */
function layoutOf(resolved: ResolvedNode): Layout {
  if (resolved.type === "Table") return "stack";
  const page = pageLayout(resolved.style);
  if (page === "grid") return "grid";
  // A Row is a flex row of its own, unless its page styles make it a column or take it out of flex layout.
  if (resolved.type === "Row") return laysOutAsRow(resolved.style) ? "row" : "stack";
  if (resolved.definition.children.text) return "text";
  return page === "flex" ? "flex" : "stack";
}

/**
 * Nodes whose width depends on their content, in a layout a Page's styles make (a flex row, a grid, out of the flow,
 * placed in a stack): what they hold has no width known from them either.
 */
const fitsContent = new WeakSet<ResolvedNode>();

/** Nodes whose text runs right to left: a `dir` of their own, or their parent's, as the writers read it. */
const rightToLeft = new WeakSet<ResolvedNode>();
function direct(resolved: ResolvedNode, parent: ResolvedNode | null): void {
  if (resolved.props.dir === "rtl" || (parent !== null && rightToLeft.has(parent) && resolved.props.dir !== "ltr")) rightToLeft.add(resolved);
}

/** A width not known: it depends on content. */
function unknownWidth(resolved: ResolvedNode): void {
  setWidth(resolved, null);
  fitsContent.add(resolved);
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
    direct(resolved, parent);
    if (resolved.style.flex !== undefined && layout !== "row" && layout !== "flex") {
      // The words as before, but where the parent is a Page's own (a Box, a page layout).
      const where = parent.type === "Box" || pageLayout(parent.style) ? "a child of a Row, or of a flex row on a Page" : "a child of a Row";
      context.d.warning("style/ignored", `flex only applies to ${where}; this ${child.type} is in a ${parent.type}`, `${at}.style.flex`, child.id);
    }
    nodes.push({ source: child, resolved, at });
    out.push(resolved);
  });

  // Out of the flow, a child takes its own width or none known, and no room from the others.
  // Its percentages are of its containing block, which the model doesn't follow (a positioned ancestor where it's
  // absolute; the window where it's fixed, unless an ancestor's transform or filter makes it that one): unknown.
  const flowing = nodes.filter(({ resolved }) => {
    if (!outOfFlow(resolved)) return true;
    resolved.available = null;
    const width = sizePx(resolved.style.width, null, resolved.text.fontSize);
    if (width === null || !limitsKnown(resolved.style, null, resolved.text.fontSize, true)) unknownWidth(resolved);
    else setWidth(resolved, clamp(width, resolved.style, null, resolved.text.fontSize));
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
      // Nor an Image in a Box with its file's size, which the Page writes as its width (a definite size isn't stretched).
      const sized = resolved.type === "Image" && parent.type === "Box" && resolved.style.width === undefined && resolved.props.src !== undefined && assetParts(resolved.props.src as Asset).width !== undefined;
      const stretched = layout === "stack" && across === "stretch" && resolved.definition.sizing === "shrink" && resolved.style.width === undefined && resolved.type !== "Svg" && !sized;
      // On a Page, a child that would fill the width but is placed (alignSelf center, start, end) fits its content.
      const placed = layout === "stack" && resolved.definition.sizing === "stretch" && resolved.style.width === undefined && PLACED.has(resolved.style.alignSelf as string);
      // Placed, or with a width or a limit the model can't evaluate (a maxWidth in ch bounds a stretched child too).
      if (placed || contentSized(resolved, resolved.available)) {
        unknownWidth(resolved);
        continue;
      }
      let width = sized ? intrinsicWidth(resolved, resolved.available, true) : stretched && resolved.available !== null ? clamp(resolved.available, resolved.style, resolved.available, resolved.text.fontSize) : stackedWidth(resolved, resolved.available);
      // An Image in a Box with a width of its own is content-box too: that width is inside its padding and border.
      if (width !== null && !sized && resolved.type === "Image" && parent.type === "Box" && sizePx(resolved.style.width, resolved.available, resolved.text.fontSize) !== null) width += horizontalFrame(resolved.style, resolved.available, resolved.text.fontSize);
      if (width === null && contentSized(resolved, resolved.available)) {
        unknownWidth(resolved);
        continue;
      }
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
    // One whose width depends on its content (in a page layout) gives them nothing known.
    let inner = resolved.contentWidth ?? (fitsContent.has(resolved) ? null : (resolved.available ?? (layout === "text" ? available : null)));
    // A List's items are beside its markers' column.
    // The writer writes the padding on the side its text starts (the right, right to left) as calc(<side> + <indent>),
    // range-checked as a whole (a page style's paddingLeft or paddingRight, written after, replaces it).
    if (source.type === "List" && inner !== null) {
      const indent = toPx(resolved.style.indent, null) ?? 0;
      const padding = resolved.style.padding as Record<keyof Insets, number | string> | undefined;
      const start = rightToLeft.has(resolved) ? "right" : "left";
      const override = start === "right" ? resolved.style.paddingRight : resolved.style.paddingLeft;
      const side = override !== undefined ? null : (lengthPx(padding?.[start], resolved.available, resolved.text.fontSize) ?? 0);
      inner = side === null ? inner : Math.max(0, inner + Math.max(0, side) - Math.max(0, side + indent));
    }
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
  // A page style's columnGap, written after the Row's gap, replaces it between its children.
  const gapValue = row.style.columnGap ?? row.style.gap;
  const gapPx = sizePx(gapValue, available, row.text.fontSize);
  // A gap the model can't evaluate (ch) leaves what's shared unknown.
  if (gapValue !== undefined && gapPx === null) {
    for (const { resolved } of nodes) unknownWidth(resolved);
    return;
  }
  const gap = gapPx ?? 0;
  const items = desktop.map(({ resolved }) => flexItem(resolved, available));
  // A Row that wraps breaks where its children no longer fit, and each line is laid out on its own.
  const wraps = row.style.flexWrap === "wrap" && (context.root === "Page" || (context.root === "Email" && row.props.stackOnMobile === false));
  // A size not known makes where the lines break unknown too: one line, whose growing and shrinking children are unknown.
  const breaks = wraps && !items.some((item) => item.strict);
  for (const line of breaks ? wrappedLines(items, gap, available) : [items.map((_, index) => index)]) {
    const room = available - gap * Math.max(0, line.length - 1);
    const ownItems = line.map((index) => items[index]);
    const widths = roundTogether(flexWidths(ownItems, room));
    // A child that takes its own size, and whose size isn't known (a Button without a width), takes no room and stays unknown.
    line.forEach((index, at) => setWidth(desktop[index].resolved, items[index].unknown ? null : widths[at]));
    // One whose flexBasis is its content's: what grows or shrinks beside it is unknown too (as in a Page's flex row).
    if (ownItems.some((item) => item.strict)) {
      line.forEach((index) => {
        const item = items[index];
        if (item.unknown || item.grow > 0 || item.shrink > 0) unknownWidth(desktop[index].resolved);
      });
      continue;
    }

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
  /** Its size isn't known because of a Page's style (flexBasis): what shares the line with it isn't known either. */
  strict?: boolean;
}

/** A Row's child as a flex item: its base and limits, as the Page writes it (`flex: 0 1 <width>`, `0 0 auto`, or `<flex> 1 0%`, with `min-width: 0`). */
function flexItem(resolved: ResolvedNode, available: number): FlexItem {
  const { style } = resolved;
  const frame = horizontalFrame(style, available, resolved.text.fontSize);
  // A frame or a limit the model can't evaluate (only a Page's styles make one): its size, and the line's, unknown.
  // A minWidth of its content's ("auto": flexbox's automatic minimum, written over the Row's min-width: 0) too.
  const contentMin = typeof style.minWidth === "string" && /^(auto|min-content|max-content|fit-content)$/.test(style.minWidth);
  const sizing = !contentMin && frameOf(style, available, resolved.text.fontSize) !== null && limitsKnown(style, available, resolved.text.fontSize);
  const width = sizePx(style.width, available, resolved.text.fontSize);
  // An Svg is the size it says in a Row too (the Page draws it `flex: none`), not a share of what's left.
  const own = style.flex === "none" || style.flex === 0 || resolved.type === "Svg";
  const intrinsic = own && width === null ? intrinsicWidth(resolved, available) : null;
  // On a Page, flexBasis, flexGrow and flexShrink are written after the Row's own flex and win over it.
  // A Row's child's width isn't written (its flex is): flexBasis auto is its content's size.
  const basis = style.flexBasis === undefined ? undefined : style.flexBasis === "auto" || style.flexBasis === "content" ? intrinsicWidth(resolved, available) : sizePx(style.flexBasis, available, resolved.text.fontSize);
  // At least its padding and border, as Chromium starts it (the layout gate measures it).
  const base = basis !== undefined ? Math.max(basis ?? frame, frame) : width !== null ? width : own ? (intrinsic ?? 0) : frame;
  // Its content can't be narrower than nothing: at least its padding and border.
  const min = Math.max(frame, sizePx(style.minWidth, available, resolved.text.fontSize) ?? 0);
  const max = Math.max(min, sizePx(style.maxWidth, available, resolved.text.fontSize) ?? Number.POSITIVE_INFINITY);
  return {
    base,
    inner: Math.max(0, base - frame),
    min,
    max,
    grow: typeof style.flexGrow === "number" ? style.flexGrow : width !== null || own ? 0 : typeof style.flex === "number" ? style.flex : 1,
    shrink: typeof style.flexShrink === "number" ? style.flexShrink : own ? 0 : 1,
    unknown: !sizing || basis === null || (basis === undefined && own && width === null && intrinsic === null),
    strict: !sizing || basis === null,
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
    for (const { resolved } of nodes) unknownWidth(resolved);
    return;
  }
  const shown = nodes.filter(({ resolved }) => !resolved.hidden?.desktop);
  for (const { resolved } of nodes) if (resolved.hidden?.desktop) unknownWidth(resolved);
  const gapValue = parent.style.columnGap ?? parent.style.gap;
  const gapPx = sizePx(gapValue, available, parent.text.fontSize);
  // A gap the model can't evaluate (ch) leaves what's shared unknown.
  if (gapValue !== undefined && gapPx === null) {
    for (const { resolved } of nodes) unknownWidth(resolved);
    return;
  }
  const gap = gapPx ?? 0;
  const ordered = [...shown].sort((a, b) => (Number(a.resolved.style.order) || 0) - (Number(b.resolved.style.order) || 0));
  const items = ordered.map(({ resolved }) => boxFlexItem(resolved, available));
  const wraps = parent.style.flexWrap === "wrap" || parent.style.flexWrap === "wrap-reverse";
  for (const line of wraps ? (items.some((item) => item.unknown) ? [items.map((_, i) => i)] : wrappedLines(items, gap, available)) : [items.map((_, index) => index)]) {
    const own = line.map((index) => items[index]);
    if (own.some((item) => item.unknown)) {
      // What's left depends on a size not known: what grows into it or shrinks out of it is unknown; what does neither
      // keeps its size.
      line.forEach((index) => {
        const item = items[index];
        if (item.grow === 0 && item.shrink === 0 && !item.unknown) setWidth(ordered[index].resolved, Math.max(item.min, Math.min(item.max, item.base)));
        else unknownWidth(ordered[index].resolved);
      });
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
  const width = sizePx(style.width, available, fontSize);
  // flex: 0 is its own size, as in a Row and as the writer writes it (0 0 auto), not a share of nothing.
  const none = style.flex === "none" || style.flex === 0;
  const share = typeof style.flex === "number" && !none ? style.flex : undefined;
  const basisValue = style.flexBasis ?? (share !== undefined ? 0 : "auto");
  const image = resolved.type === "Image";
  // An Image at its file's size (no width, or auto): that size is its base (a flex base ignores min and max). Every
  // Image's max-width (100% unless it sets one) is a limit like any other.
  const ownSize = style.width === undefined || style.width === "auto";
  const file = image && ownSize && resolved.props.src !== undefined ? (assetParts(resolved.props.src as Asset).width ?? null) : null;
  let base: number | null;
  // A width set that the model can't evaluate (ch, fit-content) leaves it unknown.
  if (basisValue === "auto") base = ownSize ? (file ?? intrinsicWidth(resolved, available, true)) : width;
  else if (basisValue === "content") base = file ?? intrinsicWidth(resolved, available, true);
  else base = sizePx(basisValue, available, fontSize);
  const grow = typeof style.flexGrow === "number" ? style.flexGrow : (share ?? 0);
  const shrink = typeof style.flexShrink === "number" ? style.flexShrink : none ? 0 : 1;
  // An Image is content-box (the Page writes no box-sizing for it): its width, limits and file size are its content's,
  // its border outside them.
  const outside = image ? frame : 0;
  if (base !== null) base += outside;
  const min = Math.max(frame, (sizePx(style.minWidth, available, fontSize) ?? 0) + outside);
  const max = Math.max(min, (sizePx(style.maxWidth, available, fontSize) ?? (image && style.maxWidth === undefined ? available : Number.POSITIVE_INFINITY)) + outside);
  // A minimum of its content's ("auto", "min-content") is its content's: unknown.
  const contentMin = typeof style.minWidth === "string" && /^(auto|min-content|max-content|fit-content)$/.test(style.minWidth);
  const known = base !== null && !contentMin && limitsKnown(style, available, fontSize) && frameOf(style, available, fontSize) !== null;
  // Its base is at least its padding and border, as Chromium sizes it (a border-box flex: 1 child with padding starts
  // from its padding, not from 0: the layout gate measures it).
  const at = known ? Math.max(base as number, frame) : frame;
  return { base: at, inner: Math.max(0, at - frame), min, max, grow, shrink, unknown: !known };
}

/**
 * A grid track: a size in px; a size between a least and a most (minmax() of lengths); a share of what's left (fr),
 * from a least (`auto`: its items' minimum widths, which a Box's `min-width: 0` makes 0 unless an item sets one); or a
 * size its content decides.
 */
type Track = { px: number } | { min: number; max: number } | { fr: number; min: number; auto: boolean } | { content: true; size?: number };

/** A grid's column tracks, and those an auto-fit repeat() made (collapsed where no item is in one). */
interface Tracks {
  tracks: Track[];
  fit: Set<number>;
}

/**
 * A grid on a Page, as CSS grid lays it out at the base sample (Decision 19): its columns from gridTemplateColumns,
 * its children placed as CSS's auto-placement places them, each the width of the tracks it spans. A width the model
 * can't know is unknown: a track its content decides (and the fr tracks beside it), a column flow or dense packing
 * of what isn't placed, an item that needs an implicit track.
 */
function layOutGrid(parent: ResolvedNode, nodes: Array<{ resolved: ResolvedNode }>, available: number | null): void {
  const shown = nodes.filter(({ resolved }) => !resolved.hidden?.desktop);
  for (const { resolved } of nodes) if (resolved.hidden?.desktop) unknownWidth(resolved);
  const fontSize = parent.text.fontSize;
  const gapValue = parent.style.columnGap ?? parent.style.gap;
  const gapPx = available === null ? 0 : sizePx(gapValue, available, fontSize);
  // A gap the model can't evaluate (ch) leaves the tracks unknown.
  if (gapValue !== undefined && gapPx === null) {
    for (const { resolved } of nodes) unknownWidth(resolved);
    return;
  }
  const gap = gapPx ?? 0;
  const ordered = [...shown].sort((a, b) => (Number(a.resolved.style.order) || 0) - (Number(b.resolved.style.order) || 0));
  const parsed = available === null ? null : gridTracks(parent.style.gridTemplateColumns, available, gap, fontSize);
  if (!parsed || available === null) {
    for (const { resolved } of ordered) unknownWidth(resolved);
    return;
  }
  const count = parsed.tracks.length;
  const areas = gridAreas(parent.style.gridTemplateAreas);
  // Lines a template names itself ([name]) aren't read: a name is then unknown.
  const named = !/\[/.test(String(parent.style.gridTemplateColumns ?? "")) && !/\[/.test(String(parent.style.gridTemplateRows ?? ""));
  const placements = ordered.map(({ resolved }) => gridPlacement(resolved, named ? areas : null, count));
  // An item whose lines the model can't read (a name no area gives, "span <name>"), or that reaches past the explicit
  // tracks (where CSS adds implicit ones, which every auto-placed item then counts), leaves every placement unknown.
  if (placements.some((placement) => placement === null || (placement.start ?? 0) + placement.span > count)) {
    for (const { resolved } of ordered) unknownWidth(resolved);
    return;
  }
  const flow = String(parent.style.gridAutoFlow ?? "row");
  const places = gridPlaces(placements as Placement[], count, flow === "row");
  // An item not placed could be in any track: which auto-fit tracks are empty, and which tracks its minimum widens,
  // aren't known, nor any width that depends on them.
  if (ordered.some(({ resolved }, index) => !places[index] && (parsed.fit.size > 0 || resolved.style.minWidth !== undefined))) {
    for (const { resolved } of ordered) unknownWidth(resolved);
    return;
  }
  // Tracks an auto-fit repeat() made that no item is in collapse, with their gaps.
  const used = new Set<number>();
  places.forEach((place) => {
    if (place) for (let c = place.column; c < place.column + place.span; c++) used.add(c);
  });
  const collapsed = new Set([...parsed.fit].filter((index) => !used.has(index)));
  // An item's minimum width (where it sets one) is the least of an auto-sized track it's alone across. One in % (of its
  // grid area, which the tracks make) or across several tracks the model doesn't share out: unknown.
  const least: Array<number | "content"> = parsed.tracks.map(() => 0);
  ordered.forEach(({ resolved }, index) => {
    const place = places[index];
    const min = resolved.style.minWidth;
    if (!place || min === undefined) return;
    const px = place.span === 1 ? sizePx(min, null, resolved.text.fontSize) : null;
    for (let c = place.column; c < Math.min(count, place.column + place.span); c++) {
      const at = least[c];
      least[c] = px === null || at === "content" ? "content" : Math.max(at, px);
    }
  });
  const widths = trackWidths(parsed.tracks, collapsed, least, available, gap);
  ordered.forEach(({ resolved }, index) => {
    const place = places[index];
    if (!place) return unknownWidth(resolved);
    // Every placement is inside the explicit tracks (checked above).
    const cells = widths.slice(place.column, place.column + place.span);
    const cell = cells.some((w) => w === null) ? null : (cells as number[]).reduce((sum, w) => sum + w, 0) + gap * (place.span - 1);
    // Its percentages (a padding in %) are of its grid area.
    resolved.available = cell;
    setWidth(resolved, gridItemWidth(resolved, parent, cell));
    if (resolved.width === null) fitsContent.add(resolved);
  });
}

/**
 * Each grid item's column, as CSS grid places them (css-grid-1, "Grid Item Placement Algorithm", sparse): first those
 * with a row and a column (a named area), then those with a row, then the rest in order, an item with a column at it
 * (on the next row if that's before the cursor), the others at the next cells free from the cursor on. Unknown (null)
 * where CSS would make an implicit track (no room in a row for an item locked to it), and for an item not placed
 * where the flow isn't row-sparse (column, dense): only those given a column are placed then.
 */
function gridPlaces(items: Placement[], count: number, rowSparse: boolean): Array<{ column: number; span: number } | null> {
  const taken = new Set<string>();
  const free = (row: number, column: number, span: number, rowSpan: number) => {
    if (column + span > count) return false;
    for (let r = row; r < row + rowSpan; r++) for (let c = column; c < column + span; c++) if (taken.has(`${r}:${c}`)) return false;
    return true;
  };
  const take = (row: number, column: number, span: number, rowSpan: number) => {
    for (let r = row; r < row + rowSpan; r++) for (let c = column; c < column + span; c++) taken.add(`${r}:${c}`);
  };
  const out: Array<{ column: number; span: number } | null> = items.map(() => null);
  const span = (item: (typeof items)[number]) => Math.max(1, Math.min(item.span, count));
  // A row and a column.
  items.forEach((item, index) => {
    if (item.start === undefined || item.row === undefined) return;
    take(item.row, item.start, span(item), item.rowSpan);
    out[index] = { column: item.start, span: item.span };
  });
  // A row: the first columns free in it, if any.
  items.forEach((item, index) => {
    if (item.start !== undefined || item.row === undefined) return;
    let column = 0;
    while (column + span(item) <= count && !free(item.row, column, span(item), item.rowSpan)) column++;
    if (column + span(item) > count) return;
    take(item.row, column, span(item), item.rowSpan);
    out[index] = { column, span: item.span };
  });
  // The rest, with the cursor (row-sparse only: another flow leaves what isn't placed unknown).
  let row = 0;
  let cursor = 0;
  items.forEach((item, index) => {
    if (item.row !== undefined) return;
    const width = span(item);
    if (item.start !== undefined) {
      if (!rowSparse) {
        out[index] = { column: item.start, span: item.span };
        return;
      }
      if (item.start < cursor) row++;
      cursor = item.start;
      for (let guard = 0; guard < 10000 && !free(row, item.start, width, item.rowSpan); guard++) row++;
      take(row, item.start, width, item.rowSpan);
      out[index] = { column: item.start, span: item.span };
      return;
    }
    if (!rowSparse) return;
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
  const own = sizePx(resolved.style.width, cell, fontSize);
  if (contentSized(resolved, cell)) return null;
  // An Image is content-box (the Page writes no box-sizing for it): its width is inside its padding and border.
  if (own !== null) return clamp(own, resolved.style, cell, fontSize) + (resolved.type === "Image" ? horizontalFrame(resolved.style, cell, fontSize) : 0);
  // auto (or none) follows the grid's justifyItems.
  const self = resolved.style.justifySelf;
  const justify = self !== undefined && self !== "auto" ? self : grid.style.justifyItems;
  const stretched = justify === undefined || justify === "stretch";
  // An image keeps its own size, no wider than its cell; what takes its own size and isn't stretched fits its content.
  if (resolved.type === "Image") return intrinsicWidth(resolved, cell, true);
  if (!stretched || resolved.definition.sizing === "shrink") return null;
  return cell === null ? null : clamp(cell, resolved.style, cell, fontSize);
}

/**
 * A grid's column tracks, repeat() expanded: a count as given, auto-fill and auto-fit as many as fit at their least
 * sizes beside the other tracks (auto-fit's marked, to collapse where empty); null where none is known.
 */
function gridTracks(template: Json | undefined, available: number, gap: number, fontSize: number): Tracks | null {
  if (template === undefined || template === "none") return { tracks: [{ px: available }], fit: new Set() };
  if (typeof template === "number") return { tracks: [{ px: template }], fit: new Set() };
  const terms = readTerms(String(template));
  if (!terms.ok || terms.value.length !== 1) return null;
  const context = { percentOf: available, fontSize, viewport };
  const one = (term: Term): Track => {
    if (term.t === "num" && term.unit === "fr") return { fr: term.value, min: 0, auto: true };
    if (term.t === "fn" && term.name === "minmax" && term.args.length === 2) {
      const [low, high] = term.args.map((seq) => seq[0]);
      const min = sizeTerm(low, context);
      // A minimum its content decides (auto, min-content): the track is unknown, but a definite most still counts its
      // repetitions.
      // An intrinsic minimum (auto, min-content, max-content) leaves a definite max to count by; a minimum that's a length
      // the model can't evaluate (ch) floors that max by an unknown amount: no count.
      const intrinsic = low.t === "word" && ["auto", "min-content", "max-content"].includes(low.name);
      if (min === null) return { content: true, size: intrinsic && !(high.t === "num" && high.unit === "fr") ? (sizeTerm(high, context) ?? undefined) : undefined };
      if (high.t === "num" && high.unit === "fr") return { fr: high.value, min, auto: false };
      const max = sizeTerm(high, context);
      return max === null ? { content: true } : { min, max: Math.max(min, max) };
    }
    const px = sizeTerm(term, context);
    return px === null ? { content: true } : { px };
  };
  // A track's size for counting repetitions (css-grid-1, "Resolving Auto Repetitions"): its max where that's definite
  // (floored by its min), else its min.
  const leastOf = (track: Track) => ("px" in track ? track.px : "max" in track ? Math.max(track.min, track.max) : "min" in track ? track.min : (track.size ?? 0));
  // The tracks, an auto repeat() kept to count once the others are known.
  const parts: Array<Track[] | { auto: "auto-fill" | "auto-fit"; inner: Track[] }> = [];
  for (const term of terms.value[0]) {
    if (term.t === "fn" && term.name === "repeat" && term.args.length === 2) {
      const [countTerm] = term.args[0];
      const inner = term.args[1].map(one);
      if (countTerm.t === "num") parts.push(Array.from({ length: Math.min(countTerm.value, MAX_REPEAT) }, () => inner).flat());
      else parts.push({ auto: countTerm.t === "word" && countTerm.name === "auto-fit" ? "auto-fit" : "auto-fill", inner });
    } else parts.push([one(term)]);
  }
  const others = parts.flatMap((part) => (Array.isArray(part) ? part : []));
  // Repetitions are counted from every track's size: one the model can't know (a length in ch) leaves the count, and
  // so every track and placement, unknown.
  const indefinite = (track: Track) => "content" in track && track.size === undefined;
  if (parts.some((part) => !Array.isArray(part)) && [...others, ...parts.flatMap((part) => (Array.isArray(part) ? [] : part.inner))].some(indefinite)) return null;
  const fixed = others.reduce((sum, track) => sum + leastOf(track), 0);
  const tracks: Track[] = [];
  const fit = new Set<number>();
  for (const part of parts) {
    if (Array.isArray(part)) {
      tracks.push(...part);
      continue;
    }
    // As many repetitions as fit beside the other tracks and every gap (css-grid-1, "Resolving Auto Repetitions").
    // n tracks have n - 1 gaps: times × (least + a gap each) fits in what the others and their gaps leave.
    const room = available - fixed - gap * (others.length - 1);
    // Each repeated track counts at least 1px (css-grid-1: the UA floors it "to avoid division by zero"; Chromium's is
    // 1px). More repetitions than the model makes leave the grid unknown.
    const step = part.inner.reduce((sum, track) => sum + Math.max(1, leastOf(track)), 0) + gap * part.inner.length;
    const fits = Math.floor(room / step);
    if (fits > MAX_REPEAT) return null;
    const times = Math.max(1, fits);
    for (let i = 0; i < times; i++) {
      for (const track of part.inner) {
        if (part.auto === "auto-fit") fit.add(tracks.length);
        tracks.push(track);
      }
    }
  }
  return tracks.length ? { tracks, fit } : null;
}

/**
 * Each track's width (css-grid-1, "Grid Sizing Algorithm", for tracks of known sizes): px as it is; a range from its
 * least, growing equally toward its most with the free space; fr sharing what's left after, none below its least
 * (an auto least: the minimum widths of its items). A collapsed track is 0, its gap too. Unknown (null) for every
 * range and fr track beside a track its content decides.
 */
function trackWidths(tracks: Track[], collapsed: ReadonlySet<number>, least: Array<number | "content">, available: number, gap: number): Array<number | null> {
  const open = tracks.map((_, index) => index).filter((index) => !collapsed.has(index));
  const gaps = gap * Math.max(0, open.length - 1);
  const out: Array<number | null> = tracks.map((track, index) => (collapsed.has(index) ? 0 : "px" in track ? track.px : null));
  const content = open.some((index) => "content" in tracks[index] || ("fr" in tracks[index] && (tracks[index] as { auto: boolean }).auto && least[index] === "content"));
  if (content) return out;
  const floor = (index: number) => {
    const track = tracks[index];
    if ("fr" in track) return Math.max(track.min, track.auto ? (least[index] as number) : 0);
    return "min" in track ? track.min : 0;
  };
  // Every track from its least; the free space grows the ranges equally toward their most.
  for (const index of open) if (!("px" in tracks[index])) out[index] = floor(index);
  let free = available - gaps - open.reduce((sum, index) => sum + (out[index] as number), 0);
  const growing = new Set(open.filter((index) => "max" in tracks[index]));
  while (free > 1e-9 && growing.size) {
    const each = free / growing.size;
    for (const index of [...growing]) {
      const max = (tracks[index] as { max: number }).max;
      const grown = Math.min(max, (out[index] as number) + each);
      free -= grown - (out[index] as number);
      out[index] = grown;
      if (grown >= max - 1e-9) growing.delete(index);
    }
  }
  // fr: shared by their factors from what the others leave; one whose share is below its least takes its least.
  const shares = new Set(open.filter((index) => "fr" in tracks[index]));
  let left = available - gaps - open.filter((index) => !shares.has(index)).reduce((sum, index) => sum + (out[index] as number), 0);
  for (let round = 0; round <= tracks.length && shares.size; round++) {
    const factors = [...shares].reduce((sum, index) => sum + (tracks[index] as { fr: number }).fr, 0);
    const unit = factors > 0 ? Math.max(0, left) / Math.max(1, factors) : 0;
    const below = [...shares].filter((index) => unit * (tracks[index] as { fr: number }).fr < floor(index));
    if (!below.length) {
      for (const index of shares) out[index] = unit * (tracks[index] as { fr: number }).fr;
      break;
    }
    for (const index of below) {
      out[index] = floor(index);
      left -= out[index] as number;
      shares.delete(index);
    }
  }
  return out;
}

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

/** Where a grid item starts (a column and a row, from 0, where it's given) and how many columns and rows it spans. */
type Placement = { start?: number; span: number; row?: number; rowSpan: number };

/** A name a grid line can have (CSS's custom-ident), not a keyword. */
const LINE_NAME = /^-?[A-Za-z_][\w-]*$/;
const lineName = (part: string | undefined) => (part !== undefined && LINE_NAME.test(part) && !/^(auto|span)$/i.test(part) ? part : undefined);

/**
 * Where a grid item is, from gridColumn, gridRow and gridArea (css-grid-1, "Line-based Placement"); null where the
 * model can't read it. A gridArea's omitted values are a name repeated (its column start the row start's, each end its
 * start's), else auto. A name is a line gridTemplateAreas makes (`<area>-start`, `<area>-end`, or the area's own name
 * for the side it's on); `areas` null: names aren't known.
 */
function gridPlacement(resolved: ResolvedNode, areas: Map<string, Area> | null, count: number): Placement | null {
  const { style } = resolved;
  const area = typeof style.gridArea === "string" || typeof style.gridArea === "number" ? String(style.gridArea).split("/").map((part) => part.trim()) : [];
  if (area.length > 4) return null;
  const [rowStart, columnStart = lineName(rowStart), rowEnd = lineName(rowStart), columnEnd = lineName(columnStart)] = area;
  const both = (start: string | undefined, end: string | undefined) => (end === undefined ? (start ?? "auto") : `${start ?? "auto"} / ${end}`);
  const lineOf = (axis: "column" | "row") => (name: string, end: boolean) => {
    if (!areas) return undefined;
    const suffixed = /^(.+)-(start|end)$/.exec(name);
    const found = suffixed && areas.get(suffixed[1]) ? { of: areas.get(suffixed[1])!, end: suffixed[2] === "end" } : areas.has(name) ? { of: areas.get(name)!, end } : null;
    if (!found) return undefined;
    return axis === "column" ? (found.end ? found.of.end : found.of.start) : found.end ? found.of.rowEnd : found.of.row;
  };
  const rows = gridLines(style.gridRow ?? (area.length ? both(rowStart, rowEnd) : undefined), Number.POSITIVE_INFINITY, lineOf("row"));
  const columns = gridLines(style.gridColumn ?? (area.length ? both(columnStart, columnEnd) : undefined), count, lineOf("column"));
  if (!rows || !columns) return null;
  return { ...(columns.start !== undefined ? { start: columns.start } : {}), span: columns.span, ...(rows.start !== undefined ? { row: rows.start } : {}), rowSpan: rows.span };
}

/**
 * A gridColumn's or gridRow's lines ("1", "1 / 3", "span 2", "2 / span 2", "span 2 / 4", "-1", "a", "a-start / b-end")
 * as a start (from 0) and a span, of `count` tracks; null where the model can't place it: a name `named` doesn't give,
 * "span <name>", a negative line where the tracks aren't counted, a line before the first. A single name is its start
 * and its end; reversed lines swap, equal ones span 1 (css-grid-1, "Grid Placement Conflict Handling").
 */
function gridLines(value: Json | undefined, count: number, named: (name: string, end: boolean) => number | undefined): { start?: number; span: number } | null {
  if (value === undefined) return { span: 1 };
  const parts = String(value).split("/").map((part) => part.trim());
  if (parts.length > 2) return null;
  const read = (part: string | undefined, end: boolean): { line?: number; span?: number } | null => {
    if (part === undefined || part === "" || /^auto$/i.test(part)) return {};
    const span = /^span\s+(\d+)$/i.exec(part);
    if (span) return Number(span[1]) > 0 ? { span: Number(span[1]) } : null;
    if (/^-?\d+$/.test(part)) {
      const line = Number(part);
      if (line > 0) return { line: line - 1 };
      if (line === 0 || !Number.isFinite(count) || count + 1 + line < 0) return null;
      return { line: count + 1 + line };
    }
    const name = lineName(part);
    const line = name === undefined ? undefined : named(name, end);
    return line === undefined ? null : { line };
  };
  const first = read(parts[0], false);
  const second = parts.length > 1 ? read(parts[1], true) : lineName(parts[0]) !== undefined ? read(parts[0], true) : {};
  if (!first || !second) return null;
  let start = first.line;
  let end = second.line;
  if (start !== undefined && end !== undefined) {
    if (end < start) [start, end] = [end, start];
    return { start, span: Math.max(1, end - start) };
  }
  if (start !== undefined) return { start, span: second.span ?? 1 };
  // "span 2 / 4", "auto / 3": the span counts back from its end line (one before the first is an implicit track).
  if (end !== undefined) {
    const span = first.span ?? 1;
    return end - span < 0 ? null : { start: end - span, span };
  }
  return { span: first.span ?? second.span ?? 1 };
}

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
    direct(row, table);
    setWidth(row, available);
    const cells = (child.children ?? []).flatMap((cell, cellIndex) => {
      if (!isNode(cell)) return [];
      const resolved = resolveNode(cell, `${at}.children[${cellIndex}]`, row.text, available, context);
      direct(resolved, row);
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
