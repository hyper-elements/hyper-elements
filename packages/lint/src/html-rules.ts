/**
 * The HTML rules, on what tokenize.ts read: an `Html` block's markup (a fragment) or a whole email (`lintHtml`, a
 * document when it has an `<html>` or a `<body>`). Every walk is iterative and each element is visited a fixed number
 * of times, so a deep or huge input costs its length and can't overflow the stack.
 */
import { genericWords, targetProblem } from "./checks";
import { quote } from "./quote";
import type { HtmlElement, HtmlTree } from "./tokenize";

export interface HtmlFound {
  id: string;
  message: string;
  line: number;
  column: number;
}

/** Text that shows nothing: spaces (Unicode's too) and format characters. */
const BLANK = /^[\s\u00ad\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u206f\ufeff]*$/;
/** What isn't read out: a script's or a style's text, and the head. */
const UNREAD = new Set(["script", "style", "head", "template", "noscript"]);
const HEADING = /^h[1-6]$/;
/** Merge syntax a service fills in, which doesn't hide a scheme. */
const SERVICE = /<%[\s\S]*?%>|\{%[\s\S]*?%\}|\{\{[\s\S]*?\}\}/g;

const attr = (element: HtmlElement, name: string) => element.attrs.get(name)?.value.trim() ?? "";

/** The elements under `root` in document order (pre-order), iteratively. */
function elements(root: HtmlElement): HtmlElement[] {
  const out: HtmlElement[] = [];
  const stack: HtmlElement[] = [root];
  while (stack.length) {
    const element = stack.pop()!;
    out.push(element);
    for (let i = element.children.length - 1; i >= 0; i--) {
      const child = element.children[i]!;
      if (child.type === "element" && !UNREAD.has(child.name)) stack.push(child);
    }
  }
  return out;
}

/** A link's words: its text and its images' alt, in order (links don't nest: an <a> closes an open one). */
function wordsOf(link: HtmlElement): { words: string; alt: string } {
  let words = "";
  let alt = "";
  const stack: Array<HtmlElement | { type: "text"; text: string }> = [link];
  while (stack.length) {
    const node = stack.pop()!;
    if (node.type === "text") {
      words += node.text;
      continue;
    }
    if (node.name === "img") alt += ` ${attr(node, "alt")}`;
    for (let i = node.children.length - 1; i >= 0; i--) {
      const child = node.children[i]!;
      if (child.type === "text" || !UNREAD.has(child.name)) stack.push(child);
    }
  }
  const tidy = (s: string) => (BLANK.test(s) ? "" : s.replace(/\s+/g, " ").trim());
  return { words: tidy(words), alt: tidy(alt) };
}

/** What's wrong with a link's href: a script's scheme first, then one that can't be read, then the template's checks. */
function hrefProblem(link: HtmlElement): string | undefined {
  const href = link.attrs.get("href")!;
  const compact = href.value.replace(SERVICE, "").replace(/[\u0000- \u007f-\u009f]/g, "").toLowerCase();
  const scheme = /^(javascript|vbscript):/.exec(compact);
  if (scheme) return `runs a script (${scheme[1]}:)`;
  // A scheme with a character reference lint doesn't know in it: what a browser makes of it, lint can't say.
  const end = href.value.search(/[:/?#]/);
  if (end !== -1 && href.value[end] === ":" && href.unknown.some((at) => at < end)) return `has a link whose scheme lint can't read: ${quote(href.value)}`;
  return targetProblem(href.value);
}

/**
 * The HTML rules' findings, in document order. `document` adds the rules that need the whole email: heading order, one
 * level-1 heading, the language and the title.
 */
export function checkHtml(tree: HtmlTree, on: (id: string, scope: "both" | "document") => boolean): HtmlFound[] {
  const found: HtmlFound[] = [];
  const add = (id: string, at: { line: number; column: number }, message: string) => found.push({ id, message, line: at.line, column: at.column });
  const all = elements(tree.root);
  // Whether each element shows any text or an image's alt, bottom up (in reverse document order).
  const shows = new Map<HtmlElement, boolean>();
  for (let i = all.length - 1; i >= 0; i--) {
    const element = all[i]!;
    let any = element.name === "img" && attr(element, "alt") !== "";
    for (const child of element.children) {
      if (any) break;
      any = child.type === "text" ? !BLANK.test(child.text) : !!shows.get(child);
    }
    shows.set(element, any);
  }

  let previous: number | undefined;
  let ones = 0;
  for (const element of all) {
    const name = element.name;
    if (name === "img" && !element.attrs.has("alt") && on("image-alt", "both")) {
      add("image-alt", element, `This image has no alt attribute: a screen reader reads out its file name instead (src ${quote(attr(element, "src"))})`);
    }
    if (name === "a" && element.attrs.has("href")) {
      const label = attr(element, "aria-label");
      const { words, alt } = wordsOf(element);
      if (!label && !words && !alt && !attr(element, "title")) {
        if (on("image-alt", "both")) add("image-alt", element, "This link has no words, image alt, aria-label or title: a screen reader has nothing to read out for it");
      } else if (!label && words && !alt && genericWords(words) && on("link-text", "both")) {
        add("link-text", element, `The link says ${quote(words)}: a screen reader lists links by their words alone`);
      }
      const problem = hrefProblem(element);
      if (problem && on("link-target", "both")) add("link-target", element, `This link ${problem}`);
    }
    if (name === "a" && attr(element, "role").toLowerCase() === "button" && on("role-button", "both")) {
      add("role-button", element, 'This link has role="button": a screen reader announces a button, and a link in an email is a link');
    }
    if (HEADING.test(name)) {
      if (!shows.get(element) && on("heading-empty", "both")) add("heading-empty", element, `This <${name}> has no words`);
      if (tree.document) {
        const level = Number(name[1]);
        if (previous !== undefined && level > previous + 1 && on("heading-order", "document")) add("heading-order", element, `This <${name}> follows an <h${previous}>: a screen reader's list of headings skips a level`);
        if (level === 1 && ++ones > 1 && on("heading-one", "document")) add("heading-one", element, "This is a second <h1>");
        previous = level;
      }
    }
  }

  if (tree.document) {
    const html = tree.root.children.find((c): c is HtmlElement => c.type === "element" && c.name === "html");
    const body = all.find((e) => e.name === "body");
    if (!(html && attr(html, "lang")) && !(body && attr(body, "lang")) && on("lang", "document")) add("lang", html ?? body ?? { line: 1, column: 1 }, "The email has no lang on its <html> or <body>, so screen readers guess its language");
    // The title is in the head, which the walk above leaves out.
    const titled = findTitle(tree.root);
    if (!titled && on("title", "document")) add("title", html ?? { line: 1, column: 1 }, "The email has no <title>, which some email clients and browsers show");
  }
  return found;
}

/** Whether there's a non-empty <title>, anywhere (iteratively). */
function findTitle(root: HtmlElement): boolean {
  const stack: HtmlElement[] = [root];
  while (stack.length) {
    const element = stack.pop()!;
    if (element.name === "title") {
      if (element.children.some((c) => c.type === "text" && !BLANK.test(c.text))) return true;
      continue;
    }
    for (const child of element.children) if (child.type === "element" && child.name !== "script" && child.name !== "style") stack.push(child);
  }
  return false;
}

