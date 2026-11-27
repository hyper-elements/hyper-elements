/**
 * What no tool shows (a Layer, an Svg, a Table, a box in a column, a custom element): the new engine's own
 * markup for it, in an HTML block of the builder's. It can be moved, duplicated or deleted there, not edited; it
 * comes back as an `Html` block.
 */
import { pictureUrl, renderTemplate, type EmailAssetsOption, type Json, type Node } from "@hyper-elements/core";
import { block, type Block } from "./design";
import { withParagraphMargin } from "./text";
import { cssSides } from "./values";

type Sides = { top: number; right: number; bottom: number; left: number };

/**
 * An HTML block of the node's own markup, drawn at its width, with `around` its place's spacing and `inherited` the
 * text styles its ancestors give it (beyond the root's).
 */
export function lockedHtml(node: Node, width: number, root: Node, components: unknown, around: Sides, inherited: Record<string, Json> = {}, inPlace: InPlace = {}): Block {
  return { ...block("html"), values: { html: renderSubtree(node, width, root, components, inherited, inPlace), containerPadding: cssSides(around) } };
}

/** What a block drawn on its own takes from where it is in the template. */
export interface InPlace {
  /** The template's theme (read already), and the tokens of each scope around the node, outermost first. */
  theme?: { [key: string]: Json };
  scopes?: ReadonlyArray<{ [key: string]: Json }>;
  /**
   * In an Email, where its pictures' files are (render()'s `assets`); the node's place as laid out (`at`); and the
   * pictures the whole template's render cut out of it, at their places as laid out: its markup links their files.
   */
  assets?: EmailAssetsOption;
  at?: string;
  pictures?: ReadonlyArray<{ name: string; laidOut: string; width: number; height: number }>;
}

/** A node drawn on its own by the new engine, at its width, in the root's output: its HTML, with its stylesheet. */
function renderSubtree(node: Node, width: number, root: Node, components: unknown, inherited: Record<string, Json>, { theme, scopes = [], assets, at = "", pictures = [] }: InPlace): string {
  // Drawn at its width in a page at least as wide as a root can be (a Document's block as a page's), the root's text
  // styles around it, and the text styles its ancestors give it in a Column around it.
  const drawn = Math.round(width);
  // A Document's page numbers as the builder's tokens, which a Page can hold.
  const tokens = (n: Node): Node =>
    n.type === "PageNumber" ? { type: "MergeTag", props: { name: n.props?.total ? "page_count" : "page_number" } } : n.children ? { ...n, children: n.children.map((child) => (typeof child === "string" ? child : tokens(child))) } : n;
  const subtree = tokens(node);
  const around = { ...inherited, ...(drawn < 200 ? { width: drawn } : {}) };
  const wrapped = Object.keys(around).length > 0;
  // A Page's own phone width, so the block's phone styles switch where the page's do.
  const breakpoints: Record<string, Json> = root.type === "Page" && root.props?.breakpoints ? { breakpoints: root.props.breakpoints } : {};
  // The theme it sees where it is: the template's, with each scope around it in a Column of its tokens, read as they
  // are in place, so what a custom element in it renders is themed as it was there.
  const placed = scopes.reduceRight<Node>((inner, tokens) => ({ type: "Column", tokens, children: [inner] }), wrapped ? { type: "Column", style: around, children: [subtree] } : subtree);
  // The node's place in what's drawn: in the holder, in a Column for each scope, in one of its text styles.
  const subtreeAt = `root${".children[0]".repeat(1 + scopes.length + (wrapped ? 1 : 0))}`;
  // The root's text styles, not its background: the builder draws the body's color, and its rows' and columns', behind
  // the block, so the block painting the body's over them would hide a Section's own.
  const { backgroundColor: _, ...rootStyle } = root.style ?? {};
  const page: Node = { type: root.type === "Email" ? "Email" : "Page", props: { width: Math.max(200, drawn), ...breakpoints }, style: rootStyle, children: [placed] };
  const written = renderTemplate(theme ? { root: page, theme, merged: true } : { root: page }, { components: components as never, ...(assets ? { assets } : {}) });
  const { head } = written;
  // Its pictures, drawn on their own here (without the template's fonts and language around them), link the files the
  // whole template's render names: each the one cut out at its place in the node, at its size.
  let { body } = written;
  const own = written.pictures ?? [];
  const templates = new Map(pictures.map((picture) => [picture.laidOut.slice(at.length), picture]));
  // As the HTML writes a URL: its & as &amp; (a baseUrl has no quote or angle bracket).
  const inHtml = (url: string) => url.replace(/&/g, "&amp;");
  const files = new Map<string, string>();
  for (const picture of own) {
    const template = picture.laidOut.startsWith(subtreeAt) ? templates.get(picture.laidOut.slice(subtreeAt.length)) : undefined;
    if (!template || template.width !== picture.width || template.height !== picture.height) {
      throw new Error(`[Elements] This block's picture at ${at}${picture.laidOut.slice(subtreeAt.length)} isn't the template's there: it can't link the file render() returns`);
    }
    files.set(inHtml(pictureUrl(assets!.baseUrl, picture.name)), inHtml(pictureUrl(assets!.baseUrl, template.name)));
  }
  if (own.length !== pictures.length) throw new Error(`[Elements] This block's pictures (${own.length}) aren't the template's here (${pictures.length}): it can't link the files render() returns`);
  // In one pass: a file put in isn't swapped again.
  if (files.size) body = body.replace(new RegExp([...files.keys()].map((url) => url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g"), (url) => files.get(url)!);
  const style = /<style>[\s\S]*?<\/style>/.exec(head)?.[0] ?? "";
  // A page's <main> is centered by its margins: in a flex box, which the builder may draw a block in, those shrink it to its words. It fills its block.
  const filled = body.replace(/^<main style="/, '<main style="width:100%;');
  return withParagraphMargin(style + filled, "margin-top:1em;margin-bottom:1em");
}
