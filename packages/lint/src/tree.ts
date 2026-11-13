/**
 * What a reader gets of each node of the laid-out tree, at desktop and at phone width, worked out once, top down, the
 * way Elements' writers write it: whether it's shown, its text's size, color and weight, and what's behind it. Every
 * rule reads this, so linting is linear in the tree's size.
 *
 * Only `fontSize` can be a phone style of what lint reads (`color`, `fontWeight` and `backgroundColor` can't), so
 * those are the same at both widths. How a phone size reaches a node depends on the writer:
 * - an Email's blocks take their parent's phone value unless their own style sets the key (`mobileTextOf`), then their
 *   own `mobile` value wins;
 * - a Page's nodes, and an Email's nodes inside text, write a desktop declaration only where they differ from their
 *   parent (or for a key their writer always writes), so CSS carries the parent's phone value to them otherwise;
 * - a Page root's phone text styles aren't written.
 */
import type { PluginNode } from "@hyper-elements/react";
import { over, parseColor, type Rgba } from "./color";

export type Width = "desktop" | "mobile";
export const WIDTHS: readonly Width[] = ["desktop", "mobile"];

/** What's under a node's content: a color, an image (a Layer's), or something lint can't read. */
export type Under = Rgba | "image" | "unknown";

export interface Info {
  node: PluginNode;
  parent: Info | null;
  /** Shown at each width (a node hidden at both is left out of the tree lint reads, with everything in it). */
  visible: Record<Width, boolean>;
  /** Its text's size in px at each width, as the browser computes it. */
  size: Record<Width, number>;
  /** What's behind its content at each width. */
  under: Record<Width, Under>;
  /** An Email block's phone font size passed down to its children (`mobileTextOf`), undefined where none. */
  phoneDown: number | undefined;
}

export interface Tree {
  root: Info;
  /** Every node lint reads, in reading order (depth first, children in order), the root first. */
  nodes: Info[];
  /** The root's type: Email or Page. */
  rootType: "Email" | "Page";
}

const isNode = (child: PluginNode | string): child is PluginNode => typeof child !== "string";

/** The Email components that write their children inside text (`text()` in the email writer). */
const WRITES_TEXT = new Set(["Text", "Heading", "Span", "Link", "Button", "TableCell"]);
/** Sizes Elements writes even where they're inherited: a Page heading's (the browser has its own). */
const ALWAYS_SIZE = new Set(["Heading"]);
/** `smaller`, for a `<sup>` or `<sub>`: the factor browsers use. */
const SMALLER = 1.2;

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const raised = (node: PluginNode) => node.type === "Span" && (node.style.verticalAlign === "super" || node.style.verticalAlign === "sub");

/** An Email writes a node inside text where its parent writes its children through `text()`, or a ListItem's text part. */
export function insideText(node: PluginNode, parent: PluginNode | null, rootType: string): boolean {
  if (rootType !== "Email" || !parent) return false;
  if (parent.type === "ListItem") return node.type !== "List";
  if (!WRITES_TEXT.has(parent.type)) return false;
  // A block Link holding only images writes them as blocks.
  if (parent.type === "Link" && parent.children.every((c) => isNode(c) && c.type === "Image")) return false;
  return true;
}

/** Whether a node's own hiding is written: an Email doesn't hide a TableCell (its row would lose a column). */
function hiddenAt(node: PluginNode, width: Width, rootType: string): boolean {
  if (rootType === "Email" && node.type === "TableCell") return false;
  return !!node.hidden?.[width];
}

/** A Layer's first child, where it's an Image: drawn under what's over it. */
function layerImage(node: PluginNode): PluginNode | undefined {
  if (node.type !== "Layer") return undefined;
  const first = node.children.find(isNode);
  return first?.type === "Image" ? first : undefined;
}

/** Whether a Layer's image is drawn at a width: an Email draws it on desktop always, and on phones unless it's hidden there; a Page where it's shown. */
function imageDrawn(image: PluginNode, width: Width, rootType: string): boolean {
  if (rootType === "Email") return width === "desktop" || !image.hidden?.mobile;
  return !image.hidden?.[width];
}

const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };

/** What's behind a node's content: its own background over what's behind its parent's, or over its Layer's image. */
function underOf(node: PluginNode, below: Under): Under {
  const own = node.style.backgroundColor;
  if (own === undefined) return below;
  const color = parseColor(own);
  if (!color) return "unknown";
  if (color.a === 1) return color;
  if (color.a === 0 || typeof below === "string") return below;
  return over(color, below);
}

/** Reads the laid-out tree once. Undefined for a root lint doesn't read (a Document, a Canvas). */
export function readTree(root: PluginNode): Tree | undefined {
  if (root.type !== "Email" && root.type !== "Page") return undefined;
  const rootType = root.type;
  const nodes: Info[] = [];

  const visit = (node: PluginNode, parent: Info | null) => {
    const visible = {
      desktop: (parent ? parent.visible.desktop : true) && !hiddenAt(node, "desktop", rootType),
      mobile: (parent ? parent.visible.mobile : true) && !hiddenAt(node, "mobile", rootType),
    };
    if (!visible.desktop && !visible.mobile) return;
    const inline = insideText(node, parent?.node ?? null, rootType);
    const own = node.text.fontSize;
    const ownPhone = num(node.mobile?.fontSize);
    let size: Info["size"];
    let phoneDown: number | undefined;
    if (rootType === "Email" && !inline) {
      // mobileTextOf: the parent's phone value where its own style doesn't set the key, then its own.
      phoneDown = ownPhone ?? (node.style.fontSize === undefined ? parent?.phoneDown : undefined);
      size = { desktop: own, mobile: phoneDown ?? own };
    } else if (!parent) {
      // A Page root: its phone text styles aren't written.
      size = { desktop: own, mobile: own };
    } else {
      // A desktop declaration where it differs from its parent's (or one its writer always writes).
      const written = own !== parent.node.text.fontSize || (rootType === "Page" && ALWAYS_SIZE.has(node.type));
      const inherited = (width: Width) => (raised(node) ? parent.size[width] / SMALLER : parent.size[width]);
      // A MergeTag writes no element: its text is its parent's.
      if (node.type === "MergeTag") size = { ...parent.size };
      else size = { desktop: written ? own : inherited("desktop"), mobile: ownPhone ?? (written ? own : inherited("mobile")) };
    }
    const under = {} as Info["under"];
    for (const width of WIDTHS) {
      let below: Under = parent ? parent.under[width] : WHITE;
      const image = parent ? layerImage(parent.node) : undefined;
      if (image && image !== node && imageDrawn(image, width, rootType)) below = "image";
      under[width] = underOf(node, below);
    }
    const info: Info = { node, parent, visible, size, under, phoneDown };
    nodes.push(info);
    for (const child of node.children) if (isNode(child)) visit(child, info);
  };
  visit(root, null);
  return { root: nodes[0]!, nodes, rootType };
}

/** The components whose children are words (inside text): what a node's words are made of. */
const INLINE = new Set(["Span", "Link", "LineBreak", "MergeTag", "Image"]);

/**
 * A node's words: its string children and its inline children's words, in order; a LineBreak is a space; a MergeTag its
 * name (or nothing, with `mergeTags: false`). Whitespace collapsed and trimmed.
 */
export function wordsOf(node: PluginNode, { mergeTags = true } = {}): string {
  const parts: string[] = [];
  const walk = (n: PluginNode) => {
    for (const child of n.children) {
      if (!isNode(child)) parts.push(child);
      else if (child.type === "LineBreak") parts.push(" ");
      else if (child.type === "MergeTag") parts.push(mergeTags ? ` ${String(child.props.name ?? "")} ` : " ");
      else if (INLINE.has(child.type)) walk(child);
    }
  };
  walk(node);
  return parts.join("").replace(/\s+/g, " ").trim();
}

/** The Images a node holds, in order (a Link's are its own children: no inline component holds one). */
export function imagesIn(node: PluginNode): PluginNode[] {
  return node.children.filter((child): child is PluginNode => isNode(child) && child.type === "Image");
}

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** A Link's or Button's accessible name: its aria-label, else its words, else (a Link) its images' alt, else its title. */
export function nameOf(node: PluginNode): string {
  const label = text(node.props["aria-label"]);
  if (label) return label;
  const words = wordsOf(node);
  if (words) return words;
  if (node.type === "Link") {
    const alt = imagesIn(node)
      .map((image) => text(image.props.alt))
      .filter(Boolean)
      .join(" ");
    if (alt) return alt;
  }
  return text(node.props.title);
}

/** The strings a node owns, in its own run: its string children, and its MergeTags' (which take its text). */
export function ownsText(node: PluginNode): boolean {
  return node.children.some((child) => (isNode(child) ? child.type === "MergeTag" : child.trim() !== ""));
}

/** An href's URL, unwrapped from `{ href, target }`. */
export function hrefOf(node: PluginNode): string | undefined {
  const href = node.props.href as unknown;
  if (typeof href === "string") return href;
  if (href && typeof href === "object" && typeof (href as { href?: unknown }).href === "string") return (href as { href: string }).href;
  return undefined;
}
