/**
 * CSS in an Html block's markup that an email client removes, found by pattern (the markup isn't parsed, so each is a
 * note that it may), from caniemail's tables (`feature`). Elements writes none of these itself. What only captures
 * found is the models package's (`check` in @hyper-elements/email-client-models).
 *
 * Each scan reads the markup in one pass: an Html block's markup is the author's, and can be long.
 */
import { caniemail, type ClientDiagnostic, type EmailClient } from "./email-clients";
import { GMAIL_CLIP_BYTES, GMAIL_STYLE_BYTES, GMAILS, imageFormatOf, NO_MEDIA_QUERIES, NO_WEB_FONTS, STYLE_REMOVED } from "./limits";

/** The clients that remove a <style> in the email's body, with all it holds (caniemail's html-style). */
export const BODY_STYLE_REMOVED: readonly EmailClient[] = ["gmail", "gmail-app", "gmail-app-other", "protonmail", "gmx", "web-de", "sfr", "laposte", "rainloop"];

export interface HtmlCheck {
  /** On the markup (HTML_CSS), or on the <style>s' text and its selectors, read once (HTML_STYLE). */
  test(markup: string, selectors: readonly string[]): boolean;
  clients: readonly EmailClient[];
  removes: string;
  fix: string;
  /** caniemail's feature, its slug. */
  feature?: string;
  /** Where one feature is read two ways, which (test/caniemail.test.ts reads the table so). */
  use?: string;
}

const pattern = (regex: RegExp) => (markup: string) => regex.test(markup);

/** CSS anywhere in the markup (inline styles and <style>s alike). */
export const HTML_CSS: readonly HtmlCheck[] = [
  {
    test: pattern(/(^|[\s;{"'])position\s*:\s*absolute\b/i),
    clients: ["outlook", "outlook-com", "outlook-mac", "outlook-app", "gmail", "gmail-app", "gmail-app-other", "yahoo", "aol", "hey", "sfr", "laposte", "mail-ru", "gmx", "web-de"],
    removes: "position: absolute: the client removes it",
    fix: "lay it out without position (a Layer puts content over an image)",
    feature: "css-position",
  },
  {
    test: pattern(/(^|[\s;{"'])position\s*:\s*relative\b/i),
    clients: ["outlook", "outlook-com", "outlook-mac", "outlook-app", "gmail", "gmail-app", "gmail-app-other", "mail-ru", "gmx", "web-de"],
    removes: "position: relative: the client removes it, and what it moves stays where it is",
    fix: "move it with padding instead",
    feature: "css-position",
    use: "relative",
  },
  {
    test: pattern(/var\(\s*--|(^|[\s;{"'])--[\w-]+\s*:/i),
    clients: ["outlook", "outlook-com", "outlook-mac", "outlook-app", "gmail", "gmail-app", "gmail-app-other", "yahoo", "aol", "orange", "mail-ru", "fastmail", "gmx", "web-de"],
    removes: "CSS variables: the client removes var() and their declarations",
    fix: "write the values themselves",
    feature: "css-variables",
  },
  {
    test: pattern(/gradient\(/i),
    clients: ["outlook", "outlook-com", "outlook-mac", "outlook-app", "gmail-app", "gmail-app-other", "yahoo", "aol", "orange", "gmx", "web-de"],
    removes: "a gradient: the client removes it",
    fix: "give it a solid background color too, or use an image",
    feature: "css-linear-gradient",
  },
  {
    test: pattern(/<style[\s>]/i),
    clients: BODY_STYLE_REMOVED,
    removes: "a <style> in the email's body: the client removes it, and what it styles shows without it",
    fix: "write the styles inline, on the elements they're for",
    feature: "html-style",
  },
  { test: pattern(/box-shadow\s*:/i), clients: ["outlook", "gmail", "gmail-app", "yahoo", "aol", "orange", "gmx", "web-de"], removes: "box-shadow: the client removes it", fix: "draw it with a border, or leave it out", feature: "css-box-shadow" },
  { test: pattern(/text-shadow\s*:/i), clients: ["outlook", "outlook-com", "outlook-mac", "outlook-app", "gmail", "gmail-app", "gmail-app-other"], removes: "text-shadow: the client removes it", fix: "leave it out, and keep the text readable without it", feature: "css-text-shadow" },
  { test: pattern(/display\s*:\s*flex\b/i), clients: ["outlook", "gmail-app-other", "orange", "gmx", "web-de"], removes: "display: flex: the client lays it out as blocks", fix: "lay it out with a Row", feature: "css-display-flex" },
  {
    test: pattern(/display\s*:\s*inline-flex\b/i),
    clients: ["outlook", "gmail-app-other", "yahoo", "aol", "orange", "gmx", "web-de"],
    removes: "display: inline-flex: the client lays it out without flex",
    fix: "lay it out with a Row",
    feature: "css-display-flex",
    use: "inline",
  },
  { test: pattern(/display\s*:\s*(inline-)?grid\b/i), clients: ["outlook", "gmail-app-other", "orange", "gmx", "web-de"], removes: "display: grid: the client lays it out as blocks", fix: "lay it out with a Row or a Grid", feature: "css-display-grid" },
  { test: pattern(/(^|[\s;{"'])opacity\s*:/i), clients: ["outlook", "aol", "orange", "mail-ru", "gmx", "web-de"], removes: "opacity: the client shows it opaque", fix: "use a lighter color instead", feature: "css-opacity" },
  {
    test: pattern(/object-fit\s*:/i),
    clients: ["outlook", "gmail-app-other", "yahoo", "aol", "orange", "gmx", "web-de"],
    removes: "object-fit: the client stretches the image to its box",
    fix: "crop the image file to the size it's shown at",
    feature: "css-object-fit",
  },
  {
    test: pattern(/(^|[\s;{"'])aspect-ratio\s*:/i),
    clients: ["outlook", "outlook-com", "outlook-mac", "outlook-app", "gmail", "gmail-app", "gmail-app-other", "yahoo", "aol", "samsung-email", "thunderbird", "fastmail", "gmx", "web-de", "orange"],
    removes: "aspect-ratio: the client removes it",
    fix: "give it a width and a height",
    feature: "css-aspect-ratio",
  },
];

/**
 * What Outlook.com removes from a <style> it keeps: the selectors caniemail's tables say it doesn't support (`:not()`,
 * `:has()`, `::marker`, the `nth-` ones), the at-rules it drops, and the states it takes only on a type.
 */
export const OUTLOOK_COM_STYLE: { selectors: readonly string[]; atRules: readonly string[]; onTypeOnly: RegExp } = {
  /** The selectors it drops wherever they are: a part each holds, in lowercase (`:not(`). */
  selectors: ["::marker", ":focus-within", ":has(", ":lang(", ":not(", ":nth-child(", ":nth-last-child(", ":nth-last-of-type(", ":nth-of-type("],
  /** The at-rules it removes, by name (`supports` for @supports). */
  atRules: ["font-face", "import", "keyframes", "supports"],
  /** What a compound selector (in lowercase) takes only after a type: `a:hover`, not `.promo:hover`. */
  onTypeOnly:
    /:(?:active|checked|first-child|first-of-type|focus|focus-visible|hover|last-child|last-of-type|link|only-child|only-of-type|target|visited)\b|::?(?:before|after|first-letter|first-line|placeholder)\b/,
};

/** Each selector of each rule in `css` (not an at-rule's prelude), in one pass. */
export function selectorsOf(css: string): string[] {
  const parts = css.replace(/\/\*[\s\S]*?(?:\*\/|$)/g, "").split(/([{};])/);
  return parts.flatMap((prelude, i) => (parts[i + 1] === "{" && !prelude.trim().startsWith("@") ? prelude.split(",").map((part) => part.trim().toLowerCase()).filter(Boolean) : []));
}

/** An @media inside another, in one pass: each search starts where the last one ended. */
export function nestedMedia(css: string): boolean {
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

/** What each at-rule Outlook.com removes does to the email; another is noted plainly. */
const AT_RULE_NOTES: Record<"keyframes" | "supports" | "import", { removes: string; fix: string; feature: string }> = {
  keyframes: { removes: "@keyframes in a <style>: the client removes it, and nothing animates", fix: "make it read without the animation", feature: "css-at-keyframes" },
  supports: { removes: "@supports in a <style>: the client removes it with the rules inside it", fix: "write those rules without @supports", feature: "css-at-supports" },
  import: { removes: "@import in a <style>: the client removes it, and what it loads never arrives", fix: "put the styles in the <style> itself", feature: "css-at-import" },
};

/**
 * What the clients that keep a <style> in the body remove from inside one, read from the <style>s of an Html block's
 * markup. The clients that remove the whole <style> aren't named: the note on the <style> itself says what they do.
 */
export const HTML_STYLE: readonly HtmlCheck[] = [
  {
    test: (css) => hasAtRule(css, "font-face"),
    clients: NO_WEB_FONTS.filter((client) => !BODY_STYLE_REMOVED.includes(client)),
    removes: "@font-face in a <style>: the client loads no web font, and the next font in each stack shows",
    fix: 'end each font stack with a font the client has: "Brand, Arial, sans-serif"',
    feature: "css-at-font-face",
  },
  ...OUTLOOK_COM_STYLE.atRules
    .filter((name) => name !== "font-face")
    .map((name): HtmlCheck => ({
      test: (css) => hasAtRule(css, name),
      clients: ["outlook-com"],
      ...AT_RULE_NOTES[name as keyof typeof AT_RULE_NOTES],
    })),
  {
    test: (_css, selectors) => selectors.some((selector) => selector.split(/[\s>+~]+/).some((compound) => OUTLOOK_COM_STYLE.onTypeOnly.test(compound) && !/^[a-z]/.test(compound))),
    clients: ["outlook-com", "outlook-mac"],
    removes: "a hover (or another state) on a class in a <style> (.promo:hover): the client takes it only on a type (a:hover), and removes the rule",
    fix: "put it on the element's type (a:hover), or leave the state out",
    feature: "css-pseudo-class-hover",
  },
  {
    test: (_css, selectors) => selectors.some((selector) => OUTLOOK_COM_STYLE.selectors.some((part) => selector.includes(part)) || (/\[[^\]]*\]/.test(selector) && /\.[\w-]+\[/.test(selector))),
    clients: ["outlook-com"],
    removes: `selectors in a <style> the client doesn't support (${OUTLOOK_COM_STYLE.selectors.map((part) => (part.endsWith("(") ? `${part})` : part)).join(", ")}, a class with an attribute): it removes those rules`,
    fix: "give the elements a class of their own, and select that",
  },
  { test: nestedMedia, clients: ["outlook-com"], removes: "an @media inside another in a <style>: the client removes it", fix: "write each query on its own", feature: "css-at-media" },
];

/**
 * `markup` without what only classic Outlook reads (`<!--[if mso]>…<![endif]-->`): the others never see it. What
 * /<!--\[if\s+(?:(?:gte?|lte?)\s+)?mso[^\]]*\]>[\s\S]*?<!\[endif\]-->/gi removes, in one pass (that regex rescans to
 * the end from each `<!--[if` when nothing closes them).
 */
export function withoutOutlookOnly(markup: string): string {
  return outlookOnly(markup, false);
}

/**
 * `markup` with what only classic Outlook reads blanked: each of its characters but newlines replaced by a space, so
 * what's left is where it was, on the same line.
 */
export function blankOutlookOnly(markup: string): string {
  return outlookOnly(markup, true);
}

function outlookOnly(markup: string, blank: boolean): string {
  const lower = markup.toLowerCase();
  const condition = /\s+(?:(?:gte?|lte?)\s+)?mso/y;
  let out = "";
  let kept = 0;
  let close = -1;
  let end = -1;
  for (let at = lower.indexOf("<!--[if"); at !== -1; at = lower.indexOf("<!--[if", at)) {
    const after = at + 7;
    if (close < after) close = lower.indexOf("]", after);
    if (close === -1) break;
    condition.lastIndex = after;
    if (!condition.test(lower) || condition.lastIndex > close || lower[close + 1] !== ">") {
      at = after;
      continue;
    }
    if (end < close + 2) end = lower.indexOf("<![endif]-->", close + 2);
    if (end === -1) break;
    out += markup.slice(kept, at);
    if (blank) out += markup.slice(at, end + 12).replace(/[^\n]/g, " ");
    kept = at = end + 12;
  }
  return out + markup.slice(kept);
}

/**
 * The text of each <style> in `markup`: what /<style\b[^>]*>([\s\S]*?)<\/style>/gi finds, in one pass (that regex
 * rescans to the end from each `<style` when nothing closes them).
 */
export function styleTexts(markup: string): string[] {
  const lower = markup.toLowerCase();
  const out: string[] = [];
  let gt = -1;
  let end = -1;
  for (let at = lower.indexOf("<style"); at !== -1; at = lower.indexOf("<style", at)) {
    if (/\w/.test(lower[at + 6] ?? "")) {
      at += 6;
      continue;
    }
    if (gt < at) gt = lower.indexOf(">", at + 6);
    if (gt === -1) break;
    if (end < gt) end = lower.indexOf("</style>", gt + 1);
    if (end === -1) break;
    out.push(markup.slice(gt + 1, end));
    at = end + 8;
  }
  return out;
}

/** The notes for an Html block's markup, at `path` (its `.props.html`). */
export function htmlNotes(html: string, path: string, nodeId: string | undefined): ClientDiagnostic[] {
  const markup = withoutOutlookOnly(html);
  const out: ClientDiagnostic[] = [];
  const note = (check: HtmlCheck) =>
    out.push({ code: "email/html-css", severity: "info", message: `This Html block's markup may have ${check.removes}`, path, ...(nodeId ? { nodeId } : {}), clients: check.clients, fix: check.fix, ...(check.feature ? { see: caniemail(check.feature) } : {}) });
  for (const check of HTML_CSS) if (check.test(markup, [])) note(check);
  const css = styleTexts(markup).join("\n");
  if (css) {
    const selectors = selectorsOf(css);
    for (const check of HTML_STYLE) if (check.test(css, selectors)) note(check);
  }
  return out;
}

/** Something found in a whole email's HTML (renderInEmailClients(html)): its line and an excerpt, and the clients it's about. */
export interface EmailHtmlDiagnostic {
  code: string;
  severity: "info" | "warning";
  message: string;
  /** The clients it's about. A diagnostic about the checks themselves (they couldn't all run) has none. */
  clients?: EmailClient[];
  fix?: string;
  see?: string;
  path: "html";
  /** The line in the given HTML (from 1), or null for one about the email as a whole or the checks. */
  line: number | null;
  /** Up to 80 characters of that line. */
  excerpt?: string;
}

/** Each <style> element in `markup`: where its tag starts, its text, and whether it's in the <head> (before <body>). */
function styleElements(markup: string): Array<{ start: number; text: string; inHead: boolean }> {
  const lower = markup.toLowerCase();
  const body = lower.search(/<body[\s>/]/);
  const out: Array<{ start: number; text: string; inHead: boolean }> = [];
  for (let at = lower.indexOf("<style"); at !== -1; at = lower.indexOf("<style", at)) {
    if (/\w/.test(lower[at + 6] ?? "")) {
      at += 6;
      continue;
    }
    const gt = lower.indexOf(">", at + 6);
    if (gt === -1) break;
    const end = lower.indexOf("</style>", gt + 1);
    if (end === -1) break;
    out.push({ start: at, text: markup.slice(gt + 1, end), inHead: body === -1 || at < body });
    at = end + 8;
  }
  return out;
}

/** The checks of the shared lists a whole email doesn't run: the notes below say more for a document. */
const NOT_ON_A_DOCUMENT = new Set<HtmlCheck>([
  // A <style> in the body: on a document, where a <style> is decides who removes it (the notes on <style> below).
  HTML_CSS.find((check) => check.feature === "html-style")!,
  // @font-face: the web fonts note below covers it, and stylesheet <link>s.
  HTML_STYLE.find((check) => check.feature === "css-at-font-face")!,
]);

const utf8Bytes = (text: string) => new TextEncoder().encode(text).length;

/**
 * What a whole email's HTML has that email clients remove or change, each at its first line (renderInEmailClients(html)'s checks,
 * from caniemail's tables and Gmail's limits). Classic Outlook's conditional comments are blanked first, keeping lines.
 */
export function documentNotes(html: string): EmailHtmlDiagnostic[] {
  const markup = blankOutlookOnly(html);
  const lines = html.split("\n");
  // Where each line starts, for the line an offset is on.
  const starts = [0];
  for (let i = 0; i < html.length; i++) if (html[i] === "\n") starts.push(i + 1);
  const lineOf = (offset: number) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid]! <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
  const excerpt = (line: number) => lines[line - 1]!.trim().slice(0, 80);
  // The first line by which `test` holds of the markup so far: a "contains" check only starts holding as lines are added.
  const firstLine = (test: (text: string) => boolean): number => {
    let lo = 1;
    let hi = lines.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (test(markup.slice(0, starts[mid] ?? markup.length))) hi = mid;
      else lo = mid + 1;
    }
    return lo;
  };
  const out: EmailHtmlDiagnostic[] = [];
  const at = (line: number | null) => (line === null ? { path: "html" as const, line } : { path: "html" as const, line, excerpt: excerpt(line) });
  const note = (removes: string, clients: readonly EmailClient[], fix: string, feature: string | undefined, line: number) =>
    out.push({ code: "email/html-css", severity: "info", message: `This email may have ${removes}`, clients: [...clients], fix, ...(feature ? { see: caniemail(feature) } : {}), ...at(line) });

  for (const check of HTML_CSS) {
    if (NOT_ON_A_DOCUMENT.has(check) || !check.test(markup, [])) continue;
    note(check.removes, check.clients, check.fix, check.feature, firstLine((text) => check.test(text, [])));
  }
  const styles = styleElements(markup);
  for (const check of HTML_STYLE) {
    if (NOT_ON_A_DOCUMENT.has(check)) continue;
    const style = styles.find(({ text }) => check.test(text, selectorsOf(text)));
    if (style) note(check.removes, check.clients, check.fix, check.feature, lineOf(style.start));
  }
  const first = styles[0];
  if (first) {
    note("a <style>: the client removes every <style>, and the email shows with its inline styles only", STYLE_REMOVED, "write what matters inline, on the elements it's for", "html-style", lineOf(first.start));
  }
  const inBody = styles.find((style) => !style.inHead);
  if (inBody) {
    note("a <style> in its <body>: the client removes it, and what it styles shows without it", BODY_STYLE_REMOVED, "move it into the <head>, or write the styles inline", "html-style", lineOf(inBody.start));
  }
  const media = styles.find((style) => style.inHead && /@media\b/i.test(style.text));
  if (media) {
    note("an @media in a <style>: the client applies no media query, and phones get the desktop layout", NO_MEDIA_QUERIES, "make the desktop layout read on a phone too: a fluid width, columns that wrap", "css-at-media", lineOf(media.start));
  }
  // A web font: an @font-face in a <style>, or a stylesheet <link> (as web fonts are loaded), whichever comes first.
  const fontFace = styles.find((style) => hasAtRule(style.text, "font-face"))?.start;
  const link = markup.search(/<link\b[^>]*\brel\s*=\s*["']?stylesheet/i);
  const webFont = [fontFace ?? -1, link].filter((offset) => offset >= 0).sort((a, b) => a - b)[0];
  if (webFont !== undefined) {
    note("a web font (an @font-face, or a stylesheet <link>): the client loads none, and the next font in each stack shows", NO_WEB_FONTS, 'end each font stack with a font the client has: "Brand, Arial, sans-serif"', "css-at-font-face", lineOf(webFont));
  }
  // Gmail's limits, as Gmail applies them: each <style> in the head on its own, in UTF-16 code units (a JavaScript
  // string's length); the whole email in UTF-8 bytes.
  const tooBig = styles.find((style) => style.inHead && style.text.length > GMAIL_STYLE_BYTES);
  if (tooBig) {
    out.push({
      code: "email/style-size",
      severity: "warning",
      message: `A <style> in this email is ${Math.round(tooBig.text.length / 1024)} KB; Gmail removes a <style> over ${GMAIL_STYLE_BYTES / 1024} KB, with all it holds`,
      clients: GMAILS.filter((client) => !STYLE_REMOVED.includes(client)),
      fix: "split it into <style>s of 16 KB or less, or write less CSS",
      ...at(lineOf(tooBig.start)),
    });
  }
  const bytes = utf8Bytes(html);
  if (bytes > GMAIL_CLIP_BYTES) {
    out.push({
      code: "email/size",
      severity: "warning",
      message: `The email is ${Math.round(bytes / 1024)} KB; Gmail clips a message after ${GMAIL_CLIP_BYTES / 1024} KB ("[Message clipped]")`,
      clients: [...GMAILS],
      fix: "shorten the email, or move long sections to a page: what follows the clip is behind a link",
      ...at(null),
    });
  }
  // Each image in a format some clients don't show.
  for (const image of markup.matchAll(/<img\b[^>]*?\ssrc\s*=\s*(["'])([\s\S]*?)\1/gi)) {
    const known = imageFormatOf(image[2]!);
    if (!known) continue;
    out.push({ code: "email/image-format", severity: "warning", message: `This image is ${known.name} file, which these email clients don't show`, clients: [...known.clients], fix: "use a PNG, JPEG or GIF file", see: caniemail(known.feature), ...at(lineOf(image.index!)) });
  }
  return out.sort((a, b) => (a.line ?? Infinity) - (b.line ?? Infinity));
}

