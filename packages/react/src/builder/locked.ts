/**
 * What no tool shows (a Layer, an Svg, a Table, a box in a column, a custom element, a Document's Menu or Video):
 * the new engine's own markup for it, in an HTML block of the builder's. It can be moved, duplicated or deleted there,
 * not edited; it comes back as an `Html` block. The builder's document mode draws one from editor 1.544.0.
 */
import { renderTemplate, videoParts, videoTitle, type Json, type Node } from "@hyper-elements/core";
import { block, type Block } from "./design";
import { withParagraphMargin } from "./text";
import { cssSides } from "./values";

type Sides = { top: number; right: number; bottom: number; left: number };

/**
 * An HTML block of the node's own markup, drawn at its width, with `around` its place's spacing and `inherited` the
 * text styles its ancestors give it (beyond the root's).
 */
export function lockedHtml(node: Node, width: number, root: Node, components: unknown, around: Sides, inherited: Record<string, Json> = {}, themed: Themed = {}): Block {
  return { ...block("html"), values: { html: renderSubtree(node, width, root, components, inherited, themed), containerPadding: cssSides(around) } };
}

/** The template's theme (read already), and the tokens of each scope around a node, outermost first. */
export interface Themed {
  theme?: { [key: string]: Json };
  scopes?: ReadonlyArray<{ [key: string]: Json }>;
}

/** A node drawn on its own by the new engine, at its width, in the root's output: its HTML, with its stylesheet. */
function renderSubtree(node: Node, width: number, root: Node, components: unknown, inherited: Record<string, Json>, { theme, scopes = [] }: Themed): string {
  // Drawn at its width in a page at least as wide as a root can be (a Document's block as a page's), the root's text
  // styles around it, and the text styles its ancestors give it in a Column around it.
  const drawn = Math.round(width);
  // A Document's page numbers as the builder's tokens, which a Page can hold.
  const tokens = (n: Node): Node =>
    n.type === "PageNumber" ? { type: "MergeTag", props: { name: n.props?.total ? "page_count" : "page_number" } } : n.children ? { ...n, children: n.children.map((child) => (typeof child === "string" ? child : tokens(child))) } : n;
  const own = tokens(node);
  const around = { ...inherited, ...(drawn < 200 ? { width: drawn } : {}) };
  // A Page's own phone width, so the block's phone styles switch where the page's do.
  const breakpoints: Record<string, Json> = root.type === "Page" && root.props?.breakpoints ? { breakpoints: root.props.breakpoints } : {};
  // The theme it sees where it is: the template's, with each scope around it in a Column of its tokens, read as they
  // are in place, so what a custom element in it renders is themed as it was there.
  const placed = scopes.reduceRight<Node>((inner, tokens) => ({ type: "Column", tokens, children: [inner] }), Object.keys(around).length ? { type: "Column", style: around, children: [own] } : own);
  // The root's text styles, not its background: the builder draws the body's color, and its rows' and columns', behind
  // the block, so the block painting the body's over them would hide a Section's own.
  const { backgroundColor: _, ...rootStyle } = root.style ?? {};
  const page: Node = { type: root.type === "Email" ? "Email" : "Page", props: { width: Math.max(200, drawn), ...breakpoints }, style: rootStyle, children: [placed] };
  // A Document's PDF can't play a video: each Video in the block as a PDF can show it. (Its theme is merged in already;
  // one a custom element renders is its player, as before: core expands it, after this.)
  const shown = root.type === "Document" ? printVideos(page) : page;
  const { head, body } = renderTemplate(theme ? { root: shown, theme, merged: true } : { root: shown }, { components: components as never });
  const style = /<style>[\s\S]*?<\/style>/.exec(head)?.[0] ?? "";
  // A page's <main> is centered by its margins: in a flex box, which the builder may draw a block in, those shrink it to its words. It fills its block.
  // Its play icons let clicks through to their video's link.
  const filled = clickThrough(body.replace(/^<main style="/, '<main style="width:100%;'));
  return withParagraphMargin(style + filled, "margin-top:1em;margin-bottom:1em");
}

/** A Video's thumbnail: its own, else a YouTube video's (a Vimeo video's can't be found without the network). */
export const thumbnailOf = (video: Node): Json | undefined => video.props?.thumbnail ?? videoParts(String(video.props?.src))?.thumbnail;

/** Each Video in a node as a PDF can show it. */
const printVideos = (node: Node): Node =>
  node.type === "Video" ? printedVideo(node) : node.children ? { ...node, children: node.children.map((child) => (typeof child === "string" ? child : printVideos(child))) } : node;

/** A play icon, as the builder's own video draws one on its thumbnail: here a dark round button with a white triangle. */
const PLAY_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill-opacity="0.6"/><path d="M26 20v24l20-12z" fill="#fff"/></svg>';

const PLAY_ICON_SRC = `data:image/svg+xml,${encodeURIComponent(PLAY_ICON_SVG)}`;

/**
 * The play icon, 64px wide but no wider than a quarter of the thumbnail, so a small video's isn't covered by it. It's
 * only drawn: no alternate text, so screen readers read the one link under it, and its markup lets clicks through to
 * that link (`clickThrough`).
 */
const PLAY_ICON: Node = { type: "Image", props: { src: PLAY_ICON_SRC, alt: "" }, style: { width: 64, maxWidth: "25%" } };

/**
 * Markup whose play icons let clicks through to the thumbnail's link under each: `pointer-events: none`, which no
 * style of Elements' writes, at the start of each icon image's style (its other attributes, a width among them, are
 * as the page writer writes them). The video's one link then takes a click anywhere on it.
 */
const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ICON_STYLE = new RegExp(`(<img src="${escaped(PLAY_ICON_SRC)}" alt=""[^>]*? style=")`, "g");
const clickThrough = (html: string): string => html.replace(ICON_STYLE, "$1pointer-events:none;");

/**
 * A Video as a PDF can show it: its thumbnail linked to it, with a play icon in its middle, else a link with its title.
 * (Elements' own PDF and Email draw the thumbnail without the icon.) A Column takes the Video's place, with its size,
 * and what's in it fills it.
 */
function printedVideo(video: Node): Node {
  const href = String(video.props?.src);
  const title = videoTitle(video.props?.title);
  const thumbnail = thumbnailOf(video);
  const shown: Node = thumbnail
    ? thumbnailWithIcon({ type: "Link", props: { href, title }, children: [{ type: "Image", props: { src: thumbnail, alt: title }, style: { width: "100%" } }] })
    : { type: "Text", children: [{ type: "Link", props: { href }, children: [title] }] };
  return { type: "Column", ...(video.id ? { id: video.id } : {}), style: { ...video.style, alignItems: "stretch" }, ...(video.mobile ? { mobile: video.mobile } : {}), children: [shown] };
}

/**
 * A linked thumbnail with the play icon in its middle. A Link holds only text or an Image, so the icon is over it in a
 * Layer: the link fills the Layer (in a Column, which a Layer stretches to its width), and the icon, of its own size, is
 * centered on it.
 */
const thumbnailWithIcon = (link: Node): Node => ({
  type: "Layer",
  style: { alignItems: "center", justifyItems: "center" },
  children: [{ type: "Column", style: { alignItems: "stretch" }, children: [link] }, PLAY_ICON],
});
