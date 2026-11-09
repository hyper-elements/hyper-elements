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
import { COMPONENTS } from "../../components";
import { caniemail, type EmailClient } from "../../email-clients";
import { assetParts, fontStack, videoParts, type Asset, type FontFace } from "../../kinds";
import { NO_WEB_FONTS } from "../../roots";
import { OUTLOOK_COM_STYLE } from "./outlook-com-style.generated";
import type { ResolvedNode } from "../../resolve";
import { support } from "../shared/support";
import { wrapsPastIts, wrapsWithGap } from "../shared/estimate";
import { isNode, shown } from "./context";
import { layerShape } from "./layout";

/** `templatePath`: a node's place in the template (inside the component that made it, where one did). */
export function emailSupport(root: ResolvedNode, templatePath: (path: string) => string = (path) => path): Diagnostic[] {
  const d = new Diagnostics();
  d.list.push(...support(root, "email"));
  const webFonts = new Set(((root.props.fonts as FontFace[] | undefined) ?? []).map((face) => face.family.toLowerCase()));
  const phone = { styled: false, phoneHidden: false, desktopHidden: false };
  const visit = (node: ResolvedNode) => {
    structure(node, d);
    fallback(node, webFonts, d);
    if (node.type === "Html") htmlBlock(node, d);
    if (node.type === "Image") imageFormat(node, "src", d);
    if (node.type === "Video" && node.props.thumbnail !== undefined) imageFormat(node, "thumbnail", d);
    // What a built-in component hides itself (a Menu's separators on phones) is its own, not the author's to change.
    if (node.mobile && Object.keys(node.mobile).length) phone.styled = true;
    if (node.hidden?.mobile && !builtIn(templatePath(node.path))) phone.phoneHidden = true;
    if (node.hidden?.desktop && !builtIn(templatePath(node.path))) phone.desktopHidden = true;
    for (const child of node.children) if (isNode(child) && shown(child)) visit(child);
  };
  visit(root);
  phoneStyles(root, phone, d);
  return d.list;
}

/** Whether a node was made by a built-in component's expansion: its place in the template is inside one, `…(Menu)…`. */
function builtIn(place: string): boolean {
  const made = [...place.matchAll(/\((\w+)\)/g)].pop()?.[1];
  return !!made && Object.prototype.hasOwnProperty.call(COMPONENTS, made);
}

/**
 * The clients that show an email on a phone without its phone styles (caniemail's css-at-media and html-style): with
 * another account in the Gmail app, and in some webmail, the email's <style> or its media queries are removed. What
 * Elements does without them (a Row stacks) still happens.
 */
export const NO_PHONE_STYLES: readonly EmailClient[] = ["gmail-app-other", "sfr", "laposte", "gmx", "web-de", "rainloop"];

/**
 * Said once for the email: a warning where it hides something on desktop (shown only on phones, it then shows
 * nowhere), a note otherwise (what's hidden on phones shows, its phone styles change nothing).
 */
function phoneStyles(root: ResolvedNode, phone: { styled: boolean; phoneHidden: boolean; desktopHidden: boolean }, d: Diagnostics): void {
  const parts = [phone.desktopHidden && "what's hidden on desktop shows nowhere", phone.phoneHidden && "what's hidden on phones shows", phone.styled && "it keeps its desktop styles"].filter(Boolean);
  if (!parts.length) return;
  d.add("email/phone-styles", phone.desktopHidden ? "warning" : "info", `On phones, the email's phone styles don't apply: ${parts.join(", ")} (Rows still stack)`, root.path, root.id, {
    clients: NO_PHONE_STYLES,
    fix: phone.desktopHidden ? "show what a reader needs on desktop too, and hide on phones only what they can do without" : undefined,
    see: caniemail("css-at-media"),
  });
}

/**
 * Image formats some clients don't show (caniemail's image-webp, image-avif, image-svg): by the file's extension, its
 * data: type, or the format an image CDN is asked for (`?fm=webp`, `?format=avif`, Cloudinary's `f_webp`).
 */
export const IMAGE_FORMATS: Readonly<Record<string, { clients: readonly EmailClient[]; feature: string; name: string }>> = {
  webp: { clients: ["outlook"], feature: "image-webp", name: "a WebP" },
  avif: { clients: ["outlook", "fastmail", "gmx", "web-de", "orange", "sfr", "mail-ru", "ionos"], feature: "image-avif", name: "an AVIF" },
  svg: { clients: ["mail-ru"], feature: "image-svg", name: "an SVG" },
};

/**
 * Where an image's format is said, first to last: its data: type, then the format an image CDN is asked for (which it
 * serves whatever the file's extension), then its extension. The first found is the format, even one every client shows.
 */
const FORMAT_IN = [/^data:image\/([a-z]+)/i, /[?&](?:fm|format|f)=(webp|avif|svg|png|jpe?g|gif)\b/i, /\/f_(webp|avif|svg|png|jpe?g|gif)[,/]/i, /\.([a-z]+)(?:[?#]|$)/i];

function imageFormat(node: ResolvedNode, key: "src" | "thumbnail", d: Diagnostics): void {
  const src = assetParts(node.props[key] as Asset).src;
  const format = FORMAT_IN.map((pattern) => pattern.exec(src)?.[1]).find(Boolean)?.toLowerCase();
  const known = format && Object.prototype.hasOwnProperty.call(IMAGE_FORMATS, format) ? IMAGE_FORMATS[format] : undefined;
  if (!known) return;
  const what = key === "src" ? "This Image is" : "This Video's thumbnail is";
  d.warning("email/image-format", `${what} ${known.name} file, which these email clients don't show`, `${node.path}.props.${key}`, node.id, {
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
  d.warning(
    "email/font-fallback",
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
/** The clients that remove a <style> in the email's body, with all it holds (caniemail's html-style). */
const BODY_STYLE_REMOVED: readonly EmailClient[] = ["gmail", "gmail-app", "gmail-app-other", "protonmail", "gmx", "web-de", "sfr", "laposte", "rainloop"];

/**
 * A negative margin: what /margin[a-z-]*\s*:([^;"'}]*\s)?-\d/i finds, in one pass (that regex was quadratic on a run
 * of `margin:`s). In each piece between `;"'}`, a colon with a negative number after it and `margin` in its name.
 */
function hasNegativeMargin(markup: string): boolean {
  for (const part of markup.split(/[;"'}]/)) {
    let lastNegative = -1;
    for (const m of part.matchAll(/\s-\d/g)) lastNegative = m.index;
    for (let colon = part.indexOf(":"); colon !== -1; colon = part.indexOf(":", colon + 1)) {
      if (lastNegative <= colon && !/^-\d/.test(part.slice(colon + 1, colon + 3))) continue;
      let start = colon;
      while (start > 0 && /\s/.test(part[start - 1]!)) start--;
      const end = start;
      while (start > 0 && /[A-Za-z-]/.test(part[start - 1]!)) start--;
      if (part.slice(start, end).toLowerCase().includes("margin")) return true;
    }
  }
  return false;
}

export const HTML_CSS: ReadonlyArray<{ pattern: { test(markup: string): boolean }; clients: readonly EmailClient[]; removes: string; fix: string; feature?: string; use?: string }> = [
  { pattern: /!\s*(?!important\b)[iI][mM][pP][oO][rR][tT][aA][nN][tT]\b/, clients: ["gmail"], removes: "!important not written in lowercase: Gmail removes the whole style attribute, or the whole <style>, that holds it", fix: "write !important in lowercase" },
  { pattern: { test: hasNegativeMargin }, clients: ["gmail", "outlook-com"], removes: "a negative margin: the client removes the whole margin declaration", fix: "move it with padding on what holds it instead" },
  {
    pattern: /(^|[\s;{"'])position\s*:\s*absolute\b/i,
    clients: ["outlook", "outlook-com", "outlook-mac", "outlook-app", "gmail", "gmail-app", "gmail-app-other", "yahoo", "aol", "hey", "sfr", "laposte", "mail-ru", "gmx", "web-de"],
    removes: "position: absolute: the client removes it",
    fix: "lay it out without position (a Layer puts content over an image)",
    feature: "css-position",
  },
  {
    // Outlook.com removes every position (captures); the others not named keep relative.
    pattern: /(^|[\s;{"'])position\s*:\s*relative\b/i,
    clients: ["outlook", "outlook-com", "outlook-mac", "outlook-app", "gmail", "gmail-app", "gmail-app-other", "mail-ru", "gmx", "web-de"],
    removes: "position: relative: the client removes it, and what it moves stays where it is",
    fix: "move it with padding instead",
    feature: "css-position",
    use: "relative",
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
    clients: ["outlook", "outlook-com", "outlook-mac", "outlook-app", "gmail-app", "gmail-app-other", "yahoo", "aol", "orange", "gmx", "web-de"],
    removes: "a gradient: the client removes it",
    fix: "give it a solid background color too, or use an image",
    feature: "css-linear-gradient",
  },
  { pattern: /\b(oklch|oklab|lch|lab|hwb|color-mix|color)\(/i, clients: ["gmail", "outlook-com"], removes: "a newer color syntax: Outlook.com removes the declaration, and Gmail every inline style on its element", fix: "write the color as hex or rgb()" },
  { pattern: /rgba?\(\s*[\d.]+%?\s+[\d.]/i, clients: ["gmail"], removes: "rgb() with spaces between its numbers: Gmail removes the whole style attribute, or the whole <style>", fix: "separate them with commas: rgb(8, 121, 161)" },
  {
    pattern: /<style[\s>]/i,
    clients: BODY_STYLE_REMOVED,
    removes: "a <style> in the email's body: the client removes it, and what it styles shows without it",
    fix: "write the styles inline, on the elements they're for",
    feature: "html-style",
  },
  { pattern: /box-shadow\s*:/i, clients: ["outlook", "gmail", "gmail-app", "yahoo", "aol", "orange", "gmx", "web-de"], removes: "box-shadow: the client removes it", fix: "draw it with a border, or leave it out", feature: "css-box-shadow" },
  { pattern: /text-shadow\s*:/i, clients: ["outlook", "outlook-com", "outlook-mac", "outlook-app", "gmail", "gmail-app", "gmail-app-other"], removes: "text-shadow: the client removes it", fix: "leave it out, and keep the text readable without it", feature: "css-text-shadow" },
  { pattern: /display\s*:\s*flex\b/i, clients: ["outlook", "gmail-app-other", "orange", "gmx", "web-de"], removes: "display: flex: the client lays it out as blocks", fix: "lay it out with a Row", feature: "css-display-flex" },
  {
    pattern: /display\s*:\s*inline-flex\b/i,
    clients: ["outlook", "gmail-app-other", "yahoo", "aol", "orange", "gmx", "web-de"],
    removes: "display: inline-flex: the client lays it out without flex",
    fix: "lay it out with a Row",
    feature: "css-display-flex",
    use: "inline",
  },
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
    pattern: /(^|[\s;{"'])aspect-ratio\s*:/i,
    clients: ["outlook", "outlook-com", "outlook-mac", "outlook-app", "gmail", "gmail-app", "gmail-app-other", "yahoo", "aol", "samsung-email", "thunderbird", "fastmail", "gmx", "web-de", "orange"],
    removes: "aspect-ratio: the client removes it",
    fix: "give it a width and a height",
    feature: "css-aspect-ratio",
  },
];

/** Each selector of each rule in `css` (not an at-rule's prelude). */
function selectorsOf(css: string): string[] {
  const out: string[] = [];
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{};]+)\{/g)) {
    const prelude = m[1]!.trim();
    if (prelude && !prelude.startsWith("@")) out.push(...prelude.split(",").map((part) => part.trim().toLowerCase()).filter(Boolean));
  }
  return out;
}

/**
 * An @media inside another: what /@media[^{]*\{[^}]*@media/i finds, in one pass (that regex was quadratic on a run of
 * @media with no `{`). Each search starts where the last one ended.
 */
function nestedMedia(css: string): boolean {
  const lower = css.toLowerCase();
  const at: number[] = [];
  for (let i = lower.indexOf("@media"); i !== -1; i = lower.indexOf("@media", i + 1)) at.push(i);
  let open = -1;
  let close = -1;
  for (let k = 0, next = 0; k < at.length; k++) {
    if (open < at[k]! + 6) {
      open = lower.indexOf("{", at[k]! + 6);
      if (open === -1) return false;
    }
    if (close <= open) {
      close = lower.indexOf("}", open + 1);
      if (close === -1) close = lower.length;
    }
    while (next < at.length && at[next]! <= open) next++;
    if (next < at.length && at[next]! < close) return true;
  }
  return false;
}

/** Whether `css` has the at-rule `name` (`supports`). */
const hasAtRule = (css: string, name: string) => new RegExp(`@${name}\\b`, "i").test(css);

/** What each at-rule Outlook.com removes does to the email; another its model adds is noted plainly. */
const AT_RULE_NOTES: Record<string, { removes: string; fix: string; feature: string }> = {
  keyframes: { removes: "@keyframes in a <style>: the client removes it, and nothing animates", fix: "make it read without the animation", feature: "css-at-keyframes" },
  supports: { removes: "@supports in a <style>: the client removes it with the rules inside it", fix: "write those rules without @supports", feature: "css-at-supports" },
  import: { removes: "@import in a <style>: the client removes it, and what it loads never arrives", fix: "put the styles in the <style> itself", feature: "css-at-import" },
};

/**
 * What the clients that keep a <style> in the body remove from inside one, read from the <style>s of an Html block's
 * markup. The clients that remove the whole <style> aren't named: the note on the <style> itself says what they do.
 * Outlook.com's rules are its model's in email-renderer (outlook-com-style.generated.ts, written when email-clients
 * moves its pin), held to the model itself by email-clients' tests.
 */
export const HTML_STYLE: ReadonlyArray<{ test: (css: string) => boolean; clients: readonly EmailClient[]; removes: string; fix: string; feature?: string }> = [
  {
    test: (css) => hasAtRule(css, "font-face"),
    clients: NO_WEB_FONTS.filter((client) => !BODY_STYLE_REMOVED.includes(client)),
    removes: "@font-face in a <style>: the client loads no web font, and the next font in each stack shows",
    fix: 'end each font stack with a font the client has: "Brand, Arial, sans-serif"',
    feature: "css-at-font-face",
  },
  ...OUTLOOK_COM_STYLE.atRules
    .filter((name) => name !== "font-face")
    .map((name) => ({
      test: (css: string) => hasAtRule(css, name),
      clients: ["outlook-com"] as const,
      ...(AT_RULE_NOTES[name] ?? { removes: `@${name} in a <style>: the client removes it`, fix: `write it without @${name}` }),
    })),
  {
    test: (css) => selectorsOf(css).some((selector) => selector.split(/[\s>+~]+/).some((compound) => OUTLOOK_COM_STYLE.onTypeOnly.test(compound) && !/^[a-z]/.test(compound))),
    clients: ["outlook-com", "outlook-mac"],
    removes: "a hover (or another state) on a class in a <style> (.promo:hover): the client takes it only on a type (a:hover), and removes the rule",
    fix: "put it on the element's type (a:hover), or leave the state out",
    feature: "css-pseudo-class-hover",
  },
  {
    test: (css) => selectorsOf(css).some((selector) => OUTLOOK_COM_STYLE.selectors.some((part) => selector.includes(part)) || (/\[[^\]]*\]/.test(selector) && /\.[\w-]+\[/.test(selector))),
    clients: ["outlook-com"],
    removes: `selectors in a <style> the client doesn't support (${OUTLOOK_COM_STYLE.selectors.map((part) => (part.endsWith("(") ? `${part})` : part)).join(", ")}, a class with an attribute): it removes those rules`,
    fix: "give the elements a class of their own, and select that",
  },
  { test: nestedMedia, clients: ["outlook-com"], removes: "an @media inside another in a <style>: the client removes it", fix: "write each query on its own", feature: "css-at-media" },
];

/** What only classic Outlook reads (`<!--[if mso]>…<![endif]-->`): the others never see it. */
const OUTLOOK_ONLY = /<!--\[if\s+(?:(?:gte?|lte?)\s+)?mso[^\]]*\]>[\s\S]*?<!\[endif\]-->/gi;

function htmlBlock(node: ResolvedNode, d: Diagnostics): void {
  if (typeof node.props.html !== "string") return;
  const markup = node.props.html.replace(OUTLOOK_ONLY, "");
  for (const check of HTML_CSS) {
    if (check.pattern.test(markup)) {
      d.add("email/html-css", "info", `This Html block's markup may have ${check.removes}`, `${node.path}.props.html`, node.id, { clients: check.clients, fix: check.fix, see: check.feature && caniemail(check.feature) });
    }
  }
  const css = [...markup.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
  if (!css) return;
  for (const check of HTML_STYLE) {
    if (check.test(css)) {
      d.add("email/html-css", "info", `This Html block's markup may have ${check.removes}`, `${node.path}.props.html`, node.id, { clients: check.clients, fix: check.fix, see: check.feature && caniemail(check.feature) });
    }
  }
}
