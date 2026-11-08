/**
 * What email can't do as a template asks, found in one pass before the
 * email is written: what each style and prop declares for email (the shared
 * pass, `shared/support.ts`), and what no single style or prop says: a Row
 * child whose size isn't known, a wrapped Row's gap between its lines, an image
 * without a width, a hidden table cell, a font stack that ends on a web font,
 * phone styles where a client doesn't apply them, an image format a client
 * doesn't show, CSS in an Html block that an email client removes.
 * Size budgets are checked on the written email (index.tsx).
 */
import { Diagnostics, type Diagnostic } from "../../diagnostics";
import { addForClients, caniemail, type EmailClient } from "../../email-clients";
import { assetParts, fontStack, videoParts, type Asset, type FontFace } from "../../kinds";
import { NO_WEB_FONTS } from "../../roots";
import type { ResolvedNode } from "../../resolve";
import { support } from "../shared/support";
import { wrapsPastIts, wrapsWithGap } from "../shared/estimate";
import { isNode, shown } from "./context";
import { layerShape } from "./layout";

export function emailSupport(root: ResolvedNode): Diagnostic[] {
  const d = new Diagnostics();
  d.list.push(...support(root, "email"));
  const webFonts = new Set(((root.props.fonts as FontFace[] | undefined) ?? []).map((face) => face.family.toLowerCase()));
  const phone = { styled: false, phoneHidden: false, desktopHidden: false };
  const visit = (node: ResolvedNode) => {
    structure(node, d);
    fallback(node, webFonts, d);
    if (node.type === "Html") htmlBlock(node, d);
    if (node.type === "Image") imageFormat(node, d);
    if (node.mobile && Object.keys(node.mobile).length) phone.styled = true;
    if (node.hidden?.mobile) phone.phoneHidden = true;
    if (node.hidden?.desktop) phone.desktopHidden = true;
    for (const child of node.children) if (isNode(child) && shown(child)) visit(child);
  };
  visit(root);
  phoneStyles(root, phone, d);
  return d.list;
}

/**
 * The clients that show an email on a phone without its phone styles (caniemail's css-at-media and html-style): with
 * another account in the Gmail app, and in some webmail, the email's <style> or its media queries are removed; Samsung
 * Email with an Outlook account. What Elements does without them (a Row stacks) still happens.
 */
export const NO_PHONE_STYLES: readonly EmailClient[] = ["gmail-app-other", "samsung-email", "sfr", "laposte", "gmx", "web-de", "rainloop"];

/**
 * Said once for the email: a warning where it hides something on desktop (shown only on phones, it then shows
 * nowhere), a note otherwise (what's hidden on phones shows, its phone styles change nothing).
 */
function phoneStyles(root: ResolvedNode, phone: { styled: boolean; phoneHidden: boolean; desktopHidden: boolean }, d: Diagnostics): void {
  const parts = [phone.desktopHidden && "what's hidden on desktop shows nowhere", phone.phoneHidden && "what's hidden on phones shows", phone.styled && "it keeps its desktop styles"].filter(Boolean);
  if (!parts.length) return;
  addForClients(d, "email/phone-styles", phone.desktopHidden ? "warning" : "info", `On phones, the email's phone styles don't apply: ${parts.join(", ")} (Rows still stack)`, root.path, root.id, {
    clients: NO_PHONE_STYLES,
    fix: phone.desktopHidden ? "show what a reader needs on desktop too, and hide on phones only what they can do without" : undefined,
    see: caniemail("css-at-media"),
  });
}

/** Image formats some clients don't show (caniemail's image-webp, image-avif, image-svg), by the file's extension or data: type. */
export const IMAGE_FORMATS: Readonly<Record<string, { clients: readonly EmailClient[]; feature: string }>> = {
  webp: { clients: ["outlook"], feature: "image-webp" },
  avif: { clients: ["outlook", "fastmail", "gmx", "web-de", "orange", "sfr", "mail-ru", "ionos"], feature: "image-avif" },
  svg: { clients: ["mail-ru"], feature: "image-svg" },
};

function imageFormat(node: ResolvedNode, d: Diagnostics): void {
  const src = node.props.src === undefined ? undefined : assetParts(node.props.src as Asset).src;
  const format = src && (/^data:image\/(webp|avif|svg)/i.exec(src) ?? /\.(webp|avif|svg)(?:[?#]|$)/i.exec(src))?.[1].toLowerCase();
  const known = format ? IMAGE_FORMATS[format] : undefined;
  if (!format || !known) return;
  addForClients(d, "email/image-format", "warning", `This Image is ${format === "svg" ? "an SVG" : `a ${format.toUpperCase()}`} file, which these email clients don't show`, `${node.path}.props.src`, node.id, {
    clients: known.clients,
    fix: "use a PNG, JPEG or GIF file",
    see: caniemail(known.feature),
  });
}

/** A stack that ends on a web font leaves the client to choose a font where that one doesn't load. */
function fallback(node: ResolvedNode, webFonts: Set<string>, d: Diagnostics): void {
  const stack = node.style.fontFamily;
  if (typeof stack !== "string" || !webFonts.size) return;
  const families = fontStack(stack);
  const last = families[families.length - 1];
  if (!last || !webFonts.has(last.toLowerCase())) return;
  addForClients(
    d,
    "email/font-fallback",
    "warning",
    `This font stack ends with the web font "${last}": where it doesn't load, the email client picks its own font`,
    `${node.path}.style.fontFamily`,
    node.id,
    { clients: NO_WEB_FONTS, fix: `end it with a font the client has: "${stack}, Arial, sans-serif"`, see: caniemail("css-at-font-face") }
  );
}

/** What email can't do that no single style or prop says. */
function structure(node: ResolvedNode, d: Diagnostics): void {
  const { path, id } = node;
  if (node.type === "Row") {
    // A Row kept side by side wraps its children in every client but classic Outlook (a Menu's links): said where they
    // look too wide for one line.
    const past = node.props.stackOnMobile === false ? wrapsPastIts(node) : null;
    if (past !== null) {
      d.add(
        "email/outlook-degraded",
        "info",
        `What it holds looks about ${past}px wide on one line, wider than its ${node.contentWidth}px (an estimate: text isn't measured yet): classic Outlook can't wrap it onto another line as other clients do, and draws it wider`,
        path,
        id,
        { clients: ["outlook"], fix: "put less in it, or let it stack on phones (stackOnMobile)" }
      );
    }
    // Its children wrap as inline-blocks, whose lines touch: anything between them but no space around them takes a
    // negative margin or flex-wrap, neither of which Gmail or Yahoo reads.
    const lines = wrapsWithGap(node);
    if (lines !== null) {
      d.add(
        "email/degraded",
        "info",
        `What it holds looks too wide for one line on ${lines} (an estimate), and an email can't keep its gap between the lines it wraps onto: they touch. Give what's in it padding, or put each line in a Row of its own`,
        `${path}.style.gap`,
        id
      );
    }
    // A Link or a line of text in a Text is as wide as its text in a cell of its own, in Outlook too (today's Menu writes its
    // links so): only a box whose size isn't known needs a width.
    for (const child of node.children.filter(isNode).filter(shown)) {
      if (child.width === null && child.type !== "Link" && child.type !== "Text") {
        d.warning("email/width", `This ${child.type} takes its own size in a Row, and its size isn't known: give it a width, so Outlook can lay the Row out`, `${child.path}.style.width`, child.id);
      }
    }
  }
  if (node.type === "Layer") {
    const shape = layerShape(node);
    if ("problem" in shape) d.error("email/layer", shape.problem, shape.path, id);
    // Where its image is hidden on phones, it's as tall as what's over it there, as on a page.
    else if (node.style.height === undefined && !shape.base.hidden?.mobile) {
      d.add("email/layer-phone", "info", "On phones, the email keeps this Layer's height and cuts its image at the sides (a page scales it): give the Layer a height to draw both the same", `${path}.style.height`, id);
    }
  }
  if (node.type === "TableCell" && node.hidden) {
    d.warning("email/unsupported", "A TableCell can't be hidden in email (its row would lose a column): hide its TableRow", `${path}.hidden`, id);
  }
  if (node.type === "Video" && node.props.thumbnail === undefined && !videoParts(String(node.props.src))?.thumbnail) {
    d.warning("email/video-thumbnail", "A Vimeo video's thumbnail can't be found without the network: give this Video a thumbnail, or the email shows a link with its title", `${path}.props.thumbnail`, id);
  }
  if (node.type === "Image" && node.width === null) {
    d.warning("email/image-width", "This Image has no width: Outlook shows it at the size of its file, however wide that is. Give it a width, or the file's width in src", `${path}.props.src`, id);
  }
}

/**
 * CSS in an Html block's markup that an email client removes, found by pattern (the markup isn't parsed, so each is a
 * note that it may): what captures of Gmail and Outlook.com on the web showed them removing, and what caniemail's
 * tables say (`feature`, checked against them with what the captures add: test/caniemail.test.ts). Elements writes
 * none of these itself.
 */
export const HTML_CSS: ReadonlyArray<{ pattern: RegExp; clients: readonly EmailClient[]; removes: string; fix: string; feature?: string }> = [
  { pattern: /!\s*(?!important\b)[iI][mM][pP][oO][rR][tT][aA][nN][tT]\b/, clients: ["gmail"], removes: "!important not written in lowercase: Gmail removes the whole style attribute, or the whole <style>, that holds it", fix: "write !important in lowercase" },
  { pattern: /margin[a-z-]*\s*:([^;"'}]*\s)?-\d/i, clients: ["gmail", "outlook-com"], removes: "a negative margin: the client removes the whole margin declaration", fix: "move it with padding on what holds it instead" },
  {
    pattern: /(^|[\s;{"'])position\s*:\s*absolute\b/i,
    clients: ["outlook", "outlook-com", "outlook-mac", "outlook-app", "gmail", "gmail-app", "gmail-app-other", "yahoo", "aol", "hey", "sfr", "laposte", "mail-ru"],
    removes: "position: absolute: the client removes it",
    fix: "lay it out without position (a Layer puts content over an image)",
    feature: "css-position",
  },
  {
    pattern: /var\(\s*--|(^|[\s;{"'])--[\w-]+\s*:/i,
    clients: ["outlook", "outlook-com", "outlook-mac", "outlook-app", "gmail", "gmail-app", "gmail-app-other", "yahoo", "aol", "orange", "mail-ru", "fastmail", "gmx", "web-de"],
    removes: "CSS variables: the client removes var() and their declarations",
    fix: "write the values themselves",
    feature: "css-variables",
  },
  {
    pattern: /gradient\(/i,
    clients: ["outlook", "outlook-com", "outlook-mac", "outlook-app", "gmail-app", "gmail-app-other", "yahoo", "aol", "samsung-email", "orange", "gmx", "web-de"],
    removes: "a gradient: the client removes it",
    fix: "give it a solid background color too, or use an image",
    feature: "css-linear-gradient",
  },
  { pattern: /\b(oklch|oklab|lch|lab|hwb|color-mix|color)\(/i, clients: ["gmail", "outlook-com"], removes: "a newer color syntax: Outlook.com removes the declaration, and Gmail every inline style on its element", fix: "write the color as hex or rgb()" },
  { pattern: /rgba?\(\s*[\d.]+%?\s+[\d.]/i, clients: ["gmail"], removes: "rgb() with spaces between its numbers: Gmail removes the whole style attribute, or the whole <style>", fix: "separate them with commas: rgb(8, 121, 161)" },
  {
    pattern: /<style[\s>]/i,
    clients: ["gmail", "gmail-app", "gmail-app-other", "protonmail", "gmx", "web-de", "sfr", "laposte", "rainloop"],
    removes: "a <style> in the email's body: the client removes it, and what it styles shows without it",
    fix: "write the styles inline, on the elements they're for",
    feature: "html-style",
  },
  { pattern: /box-shadow\s*:/i, clients: ["outlook", "gmail", "gmail-app", "yahoo", "aol", "orange", "gmx", "web-de"], removes: "box-shadow: the client removes it", fix: "draw it with a border, or leave it out", feature: "css-box-shadow" },
  { pattern: /text-shadow\s*:/i, clients: ["outlook", "outlook-com", "outlook-mac", "outlook-app", "gmail", "gmail-app", "gmail-app-other"], removes: "text-shadow: the client removes it", fix: "leave it out, and keep the text readable without it", feature: "css-text-shadow" },
  { pattern: /display\s*:\s*(inline-)?flex\b/i, clients: ["outlook", "gmail-app-other", "orange", "gmx", "web-de"], removes: "display: flex: the client lays it out as blocks", fix: "lay it out with a Row", feature: "css-display-flex" },
  { pattern: /display\s*:\s*(inline-)?grid\b/i, clients: ["outlook", "gmail-app-other", "orange", "gmx", "web-de"], removes: "display: grid: the client lays it out as blocks", fix: "lay it out with a Row or a Grid", feature: "css-display-grid" },
  { pattern: /(^|[\s;{"'])opacity\s*:/i, clients: ["outlook", "aol", "orange", "mail-ru", "gmx", "web-de"], removes: "opacity: the client shows it opaque", fix: "use a lighter color instead", feature: "css-opacity" },
  {
    pattern: /object-fit\s*:/i,
    clients: ["outlook", "gmail-app-other", "yahoo", "aol", "orange", "gmx", "web-de"],
    removes: "object-fit: the client stretches the image to its box",
    fix: "crop the image file to the size it's shown at",
    feature: "css-object-fit",
  },
  {
    pattern: /aspect-ratio\s*:/i,
    clients: ["outlook", "outlook-com", "outlook-mac", "outlook-app", "gmail", "gmail-app", "gmail-app-other", "yahoo", "aol", "samsung-email", "thunderbird", "fastmail", "gmx", "web-de", "orange"],
    removes: "aspect-ratio: the client removes it",
    fix: "give it a width and a height",
    feature: "css-aspect-ratio",
  },
];

function htmlBlock(node: ResolvedNode, d: Diagnostics): void {
  const markup = node.props.html;
  if (typeof markup !== "string") return;
  for (const check of HTML_CSS) {
    if (check.pattern.test(markup)) {
      d.add("email/html-css", "info", `This Html block's markup may have ${check.removes}`, `${node.path}.props.html`, node.id, { clients: check.clients, fix: check.fix, see: check.feature && caniemail(check.feature) });
    }
  }
}
