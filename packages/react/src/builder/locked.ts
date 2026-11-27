/**
 * What no tool shows (a Layer, an Svg, a Table, a box in a column, a custom element): the new engine's own
 * markup for it, in an HTML block of the builder's. It can be moved, duplicated or deleted there, not edited; it
 * comes back as an `Html` block.
 */
import { renderTemplate, type Json, type Node } from "@hyper-elements/core";
import { block, type Block } from "./design";
import { withParagraphMargin } from "./text";
import { cssSides } from "./values";

type Sides = { top: number; right: number; bottom: number; left: number };

/**
 * An HTML block of the node's own markup, drawn at its width, with `around` its place's spacing and `inherited` the
 * text styles its ancestors give it (beyond the root's).
 */
export function lockedHtml(node: Node, width: number, root: Node, components: unknown, around: Sides, inherited: Record<string, Json> = {}, where: Where = {}): Block {
  return { ...block("html"), values: { html: renderSubtree(node, width, root, components, inherited, where), containerPadding: cssSides(around) } };
}

/** Where a node is in its template, which its markup drawn on its own keeps. */
export interface Where {
  /** The template's theme (read already). */
  theme?: { [key: string]: Json };
  /** The tokens of each scope around it, outermost first. */
  scopes?: ReadonlyArray<{ [key: string]: Json }>;
  /** The alignItems of the stack it's in, which places a block of its own width (a Button) there. */
  alignItems?: Json;
  /**
   * The window's width at and below which its root is on a phone (an Email's width and 20px, a Page's breakpoint): drawn
   * narrower than its root (a block in a column), it's on a phone there all the same, its phone styles and hiding
   * switch there, and it fills its block there, as its column does.
   */
  phoneWidth?: number;
  /**
   * It's a Row's child, in its column as in its cell: drawn as the only child of a Row, which it fills, as Elements
   * draws a Row's child, taking none of the sizes its Row took already to give it its cell (core's `cell`, applied to
   * what it renders where it's a custom element). `stacksOnPhones: false` where its Row stays side by side on phones.
   */
  cell?: { stacksOnPhones: boolean };
}

/** A node drawn on its own by the new engine, at its width, in the root's output: its HTML, with its stylesheet. */
function renderSubtree(node: Node, width: number, root: Node, components: unknown, inherited: Record<string, Json>, { theme, scopes = [], alignItems, phoneWidth, cell }: Where): string {
  // Drawn at its width in a page at least as wide as a root can be (a Document's block as a page's), the root's text
  // styles around it, and the text styles its ancestors give it and its place in its stack, in a Column around it.
  const drawn = Math.round(width);
  // A Document's page numbers as the builder's tokens, which a Page can hold.
  const tokens = (n: Node): Node =>
    n.type === "PageNumber" ? { type: "MergeTag", props: { name: n.props?.total ? "page_count" : "page_number" } } : n.children ? { ...n, children: n.children.map((child) => (typeof child === "string" ? child : tokens(child))) } : n;
  const own = tokens(node);
  const inCell: Node = cell ? { type: "Row", children: [own] } : own;
  const around = { ...inherited, ...(drawn < 200 ? { width: drawn } : {}), ...(alignItems !== undefined ? { alignItems } : {}) };
  const wrapped = Object.keys(around).length > 0;
  // Narrower than a page can be, its width is the Column's around it, which fills its block on phones, as the page does.
  const phone = drawn < 200 && phoneWidth !== undefined ? { mobile: { width: "100%" } } : {};
  // The theme it sees where it is: the template's, with each scope around it in a Column of its tokens, read as they
  // are in place, so what a custom element in it renders is themed as it was there.
  const placed = scopes.reduceRight<Node>((inner, tokens) => ({ type: "Column", tokens, children: [inner] }), wrapped ? { type: "Column", style: around, ...phone, children: [inCell] } : inCell);
  // Its place in the page drawn: in each scope, in the Column around it, in its Row.
  const at = `root${".children[0]".repeat(1 + scopes.length + (wrapped ? 1 : 0) + (cell ? 1 : 0))}`;
  // The root's text styles, not its background: the builder draws the body's color, and its rows' and columns', behind
  // the block, so the block painting the body's over them would hide a Section's own. Nor its alignItems, which places
  // the root's own children only: the stack the block is in gives it its place (`alignItems`, above).
  const { backgroundColor: _, alignItems: _alignItems, ...rootStyle } = root.style ?? {};
  // Its root's direction, which its text and its place in its stack run in (a Document's too: it's drawn as a Page).
  const dir: Record<string, Json> = root.props?.dir === "rtl" || root.props?.dir === "ltr" ? { dir: root.props.dir } : {};
  const page: Node = { type: root.type === "Email" ? "Email" : "Page", props: { width: Math.max(200, drawn), ...dir }, style: rootStyle, children: [placed] };
  const part = { ...(phoneWidth !== undefined ? { phoneBelow: phoneWidth } : {}), ...(cell ? { cell: { path: at, stacksOnPhones: cell.stacksOnPhones } } : {}) };
  const { head, body } = renderTemplate(theme ? { root: page, theme, merged: true } : { root: page }, { components: components as never, ...part });
  const style = /<style>[\s\S]*?<\/style>/.exec(head)?.[0] ?? "";
  // A page's <main> is centered by its margins: in a flex box, which the builder may draw a block in, those shrink it to its words. It fills its block.
  const filled = body.replace(/^<main( class="[^"]*")? style="/, '<main$1 style="width:100%;');
  return withParagraphMargin(style + filled, "margin-top:1em;margin-bottom:1em");
}
