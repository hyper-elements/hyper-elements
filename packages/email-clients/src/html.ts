/**
 * CSS in an Html block's markup that an email client removes, found by pattern (the markup isn't parsed, so each is a
 * note that it may), from caniemail's tables (`feature`). Elements writes none of these itself. What only captures
 * found is the models package's (`check` in @hyper-elements/email-client-models).
 *
 * Each scan reads the markup in one pass: an Html block's markup is the author's, and can be long.
 */
import { caniemail, type ClientDiagnostic, type EmailClient } from "./email-clients";
import { NO_WEB_FONTS } from "./limits";

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
