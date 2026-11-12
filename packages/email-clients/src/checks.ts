/**
 * The open checks (moved from core in 0.4.0, with their codes and messages): what email clients do with an Email,
 * from public sources. `treeChecks` reads core's laid-out tree (a plugin's `check`), `outputChecks` the written HTML
 * (its `checkOutput`). Both return every client's diagnostics; the plugin keeps the clients asked for.
 */
import type { PluginInput, PluginNode, PluginOutput } from "@hyper-elements/react";
import { caniemail, type ClientDiagnostic } from "./email-clients";
import { htmlNotes } from "./html";
import { GMAIL_CLIP_BYTES, GMAIL_STYLE_BYTES, GMAILS, HOVER_LIMIT, imageFormatOf, NO_PHONE_STYLES, NO_WEB_FONTS, ROOT_LIMITS, STYLE_LIMITS, type Limit } from "./limits";

type Json = PluginNode["props"][string];

const isNode = (child: PluginNode | string): child is PluginNode => typeof child !== "string";
/** Shown on phones or on desktop: not hidden on both. */
const shownAnywhere = (node: PluginNode) => !(node.hidden?.mobile && node.hidden?.desktop);
const same = (a: Json | undefined, b: Json | undefined) => JSON.stringify(a) === JSON.stringify(b);

class Found {
  readonly list: ClientDiagnostic[] = [];
  add(code: string, severity: "info" | "warning", message: string, path: string, nodeId: string | undefined, extra: { clients?: readonly string[]; fix?: string; see?: string } = {}): void {
    const d: ClientDiagnostic = { code, severity, message, path };
    if (nodeId !== undefined) d.nodeId = nodeId;
    if (extra.clients) d.clients = extra.clients;
    if (extra.fix !== undefined) d.fix = extra.fix;
    if (extra.see !== undefined) d.see = extra.see;
    this.list.push(d);
  }
}

/**
 * A limit's diagnostics for a value at `at` (`key` names it in the message), on this node, as core 0.3 reported them.
 * Classic Outlook's are left out where `outlook` is false (a block it never applies: phone and hover styles).
 */
function reportLimits(d: Found, node: PluginNode, at: string, key: string, value: Json, limits: readonly Limit[] | undefined, outlook = true): void {
  for (const limit of limits ?? []) {
    if (limit.level === "outlook" && !outlook) continue;
    if (limit.values && !limit.values.some((v) => same(v, value))) continue;
    const asked = typeof value === "string" ? `${key}: "${value}"` : key;
    const [code, message] =
      limit.level === "partial" ? ["email/degraded", `${asked} on this ${node.type} in some email clients: ${limit.shows}`] : ["email/outlook-degraded", `${asked} on this ${node.type} in classic Outlook: ${limit.shows}`];
    d.add(code, "info", message, at, node.id, { clients: limit.clients ?? ["outlook"], ...(limit.feature ? { see: caniemail(limit.feature) } : {}) });
  }
}

/** What the author set on each shown node, against the clients' limits: styles, the Email's props, phone and hover blocks. */
function limits(root: PluginNode, d: Found): void {
  const visit = (node: PluginNode) => {
    const { defaults } = node;
    const byProp = defaults.styleBy ? defaults.styleBy.values[String(node.props[defaults.styleBy.prop])] : undefined;
    for (const [key, value] of Object.entries(node.style)) {
      if (same(value, byProp?.[key] ?? defaults.style[key])) continue;
      reportLimits(d, node, `${node.path}.style.${key}`, key, value, STYLE_LIMITS[key]);
    }
    if (node === root) {
      for (const [key, value] of Object.entries(node.props)) {
        if (same(value, defaults.props[key])) continue;
        reportLimits(d, node, `${node.path}.props.${key}`, key, value, ROOT_LIMITS[key]);
      }
    }
    // Phone styles: the block itself is Elements' to write; what's in it, as on desktop (classic Outlook never applies it).
    if (node.mobile && Object.keys(node.mobile).length && !node.hidden?.mobile) {
      for (const [key, value] of Object.entries(node.mobile)) reportLimits(d, node, `${node.path}.mobile.${key}`, key, value, STYLE_LIMITS[key], false);
    }
    if (node.hover && Object.keys(node.hover).length) {
      reportLimits(d, node, `${node.path}.hover`, "hover", node.hover, [HOVER_LIMIT]);
      for (const [key, value] of Object.entries(node.hover)) reportLimits(d, node, `${node.path}.hover.${key}`, key, value, STYLE_LIMITS[key], false);
    }
    for (const child of node.children) if (isNode(child) && shownAnywhere(child)) visit(child);
  };
  visit(root);
}

/** A family list, unquoted (core's fontStack). */
const fontStack = (stack: string) =>
  stack
    .split(",")
    .map((family) => family.trim().replace(/^(["'])(.*)\1$/, "$2"))
    .filter(Boolean);

function imageFormat(node: PluginNode, key: "src" | "thumbnail", d: Found): void {
  const asset = node.props[key];
  const src = typeof asset === "string" ? asset : asset && typeof asset === "object" && !Array.isArray(asset) && typeof asset.src === "string" ? asset.src : "";
  const known = imageFormatOf(src);
  if (!known) return;
  const what = key === "src" ? "This Image is" : "This Video's thumbnail is";
  d.add("email/image-format", "warning", `${what} ${known.name} file, which these email clients don't show`, `${node.path}.props.${key}`, node.id, {
    clients: known.clients,
    fix: "use a PNG, JPEG or GIF file",
    see: caniemail(known.feature),
  });
}

/** A stack that ends on a web font leaves the client to choose a font where that one doesn't load. */
function fallback(node: PluginNode, webFonts: Set<string>, d: Found): void {
  const stack = node.style.fontFamily;
  if (typeof stack !== "string" || !webFonts.size) return;
  const families = fontStack(stack);
  const last = families[families.length - 1];
  if (!last || !webFonts.has(last.toLowerCase())) return;
  d.add("email/font-fallback", "warning", `This font stack ends with the web font "${last}": where it doesn't load, the email client picks its own font`, `${node.path}.style.fontFamily`, node.id, {
    clients: NO_WEB_FONTS,
    fix: `end it with a font the client has: "${stack}, Arial, sans-serif"`,
    see: caniemail("css-at-font-face"),
  });
}

/** How classic Outlook lays out: a Row kept side by side, a box in a Row without a width, an Image without one. */
function outlookLayout(node: PluginNode, input: PluginInput, d: Found): void {
  if (node.type === "Row") {
    // A Row kept side by side wraps its children in every client but classic Outlook (a Menu's links): said where they
    // look too wide for one line.
    const past = node.props.stackOnMobile === false ? input.estimate.wrapsPastIts(node.path) : null;
    if (past !== null) {
      d.add(
        "email/outlook-degraded",
        "info",
        `What it holds looks about ${past}px wide on one line, wider than its ${node.contentWidth}px (an estimate: text isn't measured yet): classic Outlook can't wrap it onto another line as other clients do, and draws it wider`,
        node.path,
        node.id,
        { clients: ["outlook"], fix: "put less in it, or let it stack on phones (stackOnMobile)" }
      );
    }
    // A Link or a line of text in a Text is as wide as its text in a cell of its own, in Outlook too: only a box whose
    // size isn't known needs a width.
    for (const child of node.children.filter(isNode).filter(shownAnywhere)) {
      if (child.width === null && child.type !== "Link" && child.type !== "Text") {
        d.add("email/width", "warning", `This ${child.type} takes its own size in a Row, and its size isn't known: give it a width, so Outlook can lay the Row out`, `${child.path}.style.width`, child.id, { clients: ["outlook"] });
      }
    }
  }
  if (node.type === "Image" && node.width === null) {
    d.add("email/image-width", "warning", "This Image has no width: Outlook shows it at the size of its file, however wide that is. Give it a width, or the file's width in src", `${node.path}.props.src`, node.id, { clients: ["outlook"] });
  }
}

/**
 * Said once for the email: a warning where it hides something on desktop (shown only on phones, it then shows
 * nowhere), a note otherwise (what's hidden on phones shows, its phone styles change nothing).
 */
function phoneStyles(root: PluginNode, phone: { styled: boolean; phoneHidden: boolean; desktopHidden: boolean }, d: Found): void {
  const parts = [phone.desktopHidden && "what's hidden on desktop shows nowhere", phone.phoneHidden && "what's hidden on phones shows", phone.styled && "it keeps its desktop styles"].filter(Boolean);
  if (!parts.length) return;
  d.add("email/phone-styles", phone.desktopHidden ? "warning" : "info", `On phones, the email's phone styles don't apply: ${parts.join(", ")} (Rows still stack)`, root.path, root.id, {
    clients: NO_PHONE_STYLES,
    ...(phone.desktopHidden ? { fix: "show what a reader needs on desktop too, and hide on phones only what they can do without" } : {}),
    see: caniemail("css-at-media"),
  });
}

/** Every open check on an Email's laid-out tree, for every client, in core 0.3's order. */
export function treeChecks(input: PluginInput): ClientDiagnostic[] {
  const { root } = input;
  const d = new Found();
  limits(root, d);
  const fonts = Array.isArray(root.props.fonts) ? root.props.fonts : [];
  const webFonts = new Set(fonts.flatMap((face) => (face && typeof face === "object" && !Array.isArray(face) && typeof face.family === "string" ? [face.family.toLowerCase()] : [])));
  const phone = { styled: false, phoneHidden: false, desktopHidden: false };
  const visit = (node: PluginNode) => {
    outlookLayout(node, input, d);
    fallback(node, webFonts, d);
    if (node.type === "Html" && typeof node.props.html === "string") d.list.push(...htmlNotes(node.props.html, `${node.path}.props.html`, node.id));
    if (node.type === "Image") imageFormat(node, "src", d);
    if (node.type === "Video" && node.props.thumbnail !== undefined) imageFormat(node, "thumbnail", d);
    // What a built-in component hides itself (a Menu's separators on phones) is its own, not the author's to change.
    if (node.mobile && Object.keys(node.mobile).length) phone.styled = true;
    if (node.hidden?.mobile && !input.builtIn(input.templatePath(node.path))) phone.phoneHidden = true;
    if (node.hidden?.desktop && !input.builtIn(input.templatePath(node.path))) phone.desktopHidden = true;
    for (const child of node.children) if (isNode(child) && shownAnywhere(child)) visit(child);
  };
  visit(root);
  phoneStyles(root, phone, d);
  return d.list;
}

const utf8Bytes = (text: string) => new TextEncoder().encode(text).length;

/** Gmail's limits, on the written email. */
export function outputChecks(output: PluginOutput): ClientDiagnostic[] {
  const d = new Found();
  const bytes = utf8Bytes(output.html);
  if (bytes > GMAIL_CLIP_BYTES) {
    d.add("email/size", "warning", `The email is ${Math.round(bytes / 1024)} KB; Gmail clips a message after ${GMAIL_CLIP_BYTES / 1024} KB ("[Message clipped]")`, "root", undefined, {
      clients: GMAILS,
      fix: "shorten the email, or move long sections to a page: what follows the clip is behind a link",
    });
  }
  const styleBytes = utf8Bytes(output.stylesheet);
  if (styleBytes > GMAIL_STYLE_BYTES) {
    d.add("email/style-size", "warning", `The stylesheet is ${Math.round(styleBytes / 1024)} KB; Gmail reads ${GMAIL_STYLE_BYTES / 1024} KB of a <style>`, "root", undefined, {
      clients: GMAILS,
      fix: "use fewer phone and hover styles: each one adds a rule",
    });
  }
  return d.list;
}
