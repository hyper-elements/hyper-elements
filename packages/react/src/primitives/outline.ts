/**
 * A laid-out template as text, for an author or an agent to check its layout without reading the HTML: each block on
 * a line under what holds it, with its width on desktop and what it shows (a heading's level and words, a link's
 * URL, an image's alt text). A Row says how many sit side by side and whether they stack on phones.
 *
 *   Email 600px
 *     Image 120px [Acme] https://example.com/logo.png
 *     Column 600px, background #ffffff
 *       Heading h1 536px "Thanks for your order, {{first_name}}"
 *       Row 536px: 2 side by side, stacked on phones
 *
 * On a Page, a Box (and a container its page styles lay out) says its layout, and a block in one whose width depends
 * on its content says it fits its content:
 *
 *   Box header 1280px: flex row, sticky
 *     Image 120px [Acme] https://example.com/logo.png
 *     Button: fits its content "Sign in" → https://example.com/login
 */
import { linkParts, pageLayout as layoutOf, shownAnywhere, type LinkValue, type ResolvedNode } from "@unlayer-internal/elements-core";

const LONGEST = 80;
const clip = (text: string) => (text.length > LONGEST ? `${text.slice(0, LONGEST - 1)}…` : text);
const shown = (node: ResolvedNode) => shownAnywhere(node);
const blocks = (node: ResolvedNode) => node.children.filter((child): child is ResolvedNode => typeof child !== "string" && shown(child));

/** The words a node shows, a merge tag as `{{name}}`, a link's URL after its words, an image as its alt text; Lists in it are lines of their own. */
function words(node: ResolvedNode): string {
  return node.children
    .map((child) => {
      if (typeof child === "string") return child;
      if (!shown(child) || child.type === "List") return "";
      if (child.type === "MergeTag") return `{{${child.props.name}}}`;
      if (child.type === "LineBreak") return " / ";
      if (child.type === "Image") return `[${child.props.alt ?? ""}]`;
      if (child.type === "Link") return `${words(child)} (${linkParts(child.props.href as LinkValue).href})`;
      return words(child);
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/** How a node's page styles lay out its children: a grid with its columns as written, a flex row (wrapping), or none. */
function pageLayout(node: ResolvedNode): string | undefined {
  const { flexWrap, gridTemplateColumns } = node.style;
  const layout = layoutOf(node.style);
  if (layout === "grid") return gridTemplateColumns !== undefined ? `grid ${String(gridTemplateColumns)}` : "grid";
  if (layout === "flex") return `flex row${flexWrap === "wrap" || flexWrap === "wrap-reverse" ? ", wraps" : ""}`;
  return undefined;
}

/** Whether a node's width depends on its content, in a Box or a layout a Page's styles make (unknown to the resolver). */
const fits = (node: ResolvedNode, parent: ResolvedNode | undefined) =>
  node.width === null && node.available !== null && !!parent && (parent.type === "Box" || pageLayout(parent) !== undefined || node.type === "Box");

function describe(node: ResolvedNode, parent?: ResolvedNode): string {
  const parts: string[] = [node.type === "DocumentPage" ? "Document.Page" : node.type];
  if (node.type === "Heading") parts.push(`h${node.props.level}`);
  if (node.type === "Box" && node.props.as !== undefined && node.props.as !== "div") parts.push(String(node.props.as));
  if (node.width !== null) parts.push(`${Math.round(node.width)}px`);
  const details: string[] = [];
  if (fits(node, parent)) details.push("fits its content");
  const layout = pageLayout(node);
  if (layout) details.push(layout);
  if (node.style.position === "sticky" || node.style.position === "fixed" || node.style.position === "absolute") details.push(String(node.style.position));
  const children = blocks(node);
  // A Grid, a Menu and a Social are laid out as Rows (a Menu's and a Social's of Links), so they show as those.
  if (node.type === "Row") details.push(`${children.length} side by side${node.props.stackOnMobile === false ? "" : ", stacked on phones"}`);
  if (typeof node.style.backgroundColor === "string") details.push(`background ${node.style.backgroundColor}`);
  if (node.hidden?.desktop) details.push("phones only");
  if (node.hidden?.mobile) details.push("desktop only");
  const head = `${parts.join(" ")}${details.length ? `: ${details.join(", ")}` : ""}`;
  switch (node.type) {
    case "Image":
      return `${head} [${node.props.alt ?? ""}] ${clip(String((node.props.src as { src?: string })?.src ?? node.props.src))}`;
    case "Link":
    case "Button":
      return `${head} "${clip(words(node))}" → ${linkParts(node.props.href as LinkValue).href}`;
    case "Video":
      return `${head} "${clip(String(node.props.title ?? ""))}" ${node.props.src}`;
    case "Svg":
      return `${head} (${children.length} shapes)`;
    default:
      return node.definition.children.text && words(node) ? `${head} "${clip(words(node))}"` : head;
  }
}

/** The lines of a node and what it holds, indented under it. Text and its inline parts are its line; Lists in it go under it. */
function lines(node: ResolvedNode, indent: string, parent?: ResolvedNode): string[] {
  const own = `${indent}${describe(node, parent)}`;
  if (node.type === "Svg") return [own];
  const under = node.definition.children.text ? blocks(node).filter((child) => child.type === "List") : blocks(node);
  return [own, ...under.flatMap((child) => lines(child, `${indent}  `, node))];
}

export function outlineOf(root: ResolvedNode): string {
  return lines(root, "").join("\n");
}
