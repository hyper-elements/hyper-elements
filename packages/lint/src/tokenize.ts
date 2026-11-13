/**
 * HTML read for the rules: a tokenizer and a tree builder of its own (no third-party parser), small and linear in the
 * input's length, that never throws. It reads what the rules need the way browsers do, not every corner of the HTML
 * parsing algorithm:
 * - start tags with their attributes (quoted, unquoted, valueless; names lower-cased; a repeated attribute keeps its
 *   first value), end tags, text and comments; a doctype and processing instructions are ignored; a `<` that doesn't
 *   start a tag is text;
 * - Outlook's conditional comments (`<!--[if mso]>…<![endif]-->`) are skipped whole: what's inside them is Outlook's
 *   duplicate of what's outside. The downlevel-revealed form (`<!--[if !mso]><!-->…<!--<![endif]-->`) is content every
 *   other client shows, so only its markers are skipped;
 * - raw text (`script`, `style`, `xmp`, `iframe`, `noembed`, `noframes`, `noscript`, `textarea`, `title`) runs to its
 *   end tag, and `plaintext` to the end of the input;
 * - character references, numeric and the named ones that can hide a character (spaces, invisible characters, and
 *   the punctuation that can disguise a URL's scheme), with each unknown named reference's place kept;
 * - an open-element stack: void elements are never opened, a `/>` elsewhere is ignored, an `<a>` closes an open `<a>`,
 *   an end tag closes the nearest open element of its name (a count by name makes an unmatched one cost nothing), and
 *   the head ends where the body starts (`</head>` may be left out): at a start tag that doesn't belong in a head, or at
 *   text that isn't space;
 * - lines end at `\n`, `\r\n` or a lone `\r`, as HTML reads them.
 */

export interface HtmlText {
  type: "text";
  /** Decoded. */
  text: string;
  line: number;
  column: number;
}

export interface HtmlElement {
  type: "element";
  name: string;
  /** Decoded values, the first of a repeated attribute. */
  attrs: Map<string, Attribute>;
  children: Array<HtmlElement | HtmlText>;
  parent: HtmlElement | null;
  line: number;
  column: number;
}

export interface Attribute {
  value: string;
  /** Where in `value` each named reference the table doesn't know starts (it's left as written). */
  unknown: number[];
}

/** The root of what was read: a fragment's or a document's elements and text. */
export interface HtmlTree {
  root: HtmlElement;
  /** It has an `<html>` or a `<body>`: a whole document. */
  document: boolean;
}

/** What may be in a head: any other start tag ends it, as browsers read a page whose `</head>` is left out. */
const HEAD = new Set(["base", "basefont", "bgsound", "link", "meta", "title", "style", "script", "noscript", "template", "head"]);
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const RAW = new Set(["script", "style", "xmp", "iframe", "noembed", "noframes", "noscript", "textarea", "title"]);
/** Raw text whose character references are read (RCDATA). */
const ESCAPABLE = new Set(["textarea", "title"]);

// The HTML named references whose code point is ASCII punctuation, an ASCII or Unicode space, or a format character,
// and the five XML ones (test/tokenize.test.ts checks it against WHATWG's list), as name:hex pairs.
const TABLE =
  "AMP:26 ApplyFunction:2061 DiacriticalGrave:60 GT:3e Hat:5e InvisibleComma:2063 InvisibleTimes:2062 LT:3c MediumSpace:205f " +
  "NegativeMediumSpace:200b NegativeThickSpace:200b NegativeThinSpace:200b NegativeVeryThinSpace:200b NewLine:a NoBreak:2060 " +
  "NonBreakingSpace:a0 QUOT:22 Tab:9 ThinSpace:2009 UnderBar:5f VerticalLine:7c VeryThinSpace:200a ZeroWidthSpace:200b af:2061 " +
  "amp:26 apos:27 ast:2a bsol:5c colon:3a comma:2c commat:40 dollar:24 emsp:2003 emsp13:2004 emsp14:2005 ensp:2002 equals:3d " +
  "excl:21 grave:60 gt:3e hairsp:200a ic:2063 it:2062 lbrace:7b lbrack:5b lcub:7b lowbar:5f lpar:28 lrm:200e lsqb:5b lt:3c " +
  "midast:2a nbsp:a0 num:23 numsp:2007 percnt:25 period:2e plus:2b puncsp:2008 quest:3f quot:22 rbrace:7d rbrack:5d rcub:7d " +
  "rlm:200f rpar:29 rsqb:5d semi:3b shy:ad sol:2f thinsp:2009 verbar:7c vert:7c zwj:200d zwnj:200c";
/** The ones browsers also read without a `;`. */
const LEGACY = new Set(["amp", "AMP", "lt", "LT", "gt", "GT", "quot", "QUOT", "nbsp"]);

let named: Map<string, string> | undefined;
/** The named references lint reads, by name. */
export function namedReferences(): ReadonlyMap<string, string> {
  if (!named) {
    named = new Map();
    for (const pair of TABLE.split(" ")) {
      const [name, hex] = pair.split(":") as [string, string];
      named.set(name, String.fromCodePoint(parseInt(hex, 16)));
    }
  }
  return named;
}

const REFERENCE = /&(?:#(\d+);?|#[xX]([0-9a-fA-F]+);?|([A-Za-z][A-Za-z0-9]*)(;?))/g;

/** Text with its character references read; an unknown named one is left as written, and where it starts is kept. */
export function decode(raw: string): Attribute {
  if (!raw.includes("&")) return { value: raw, unknown: [] };
  const unknown: number[] = [];
  let out = "";
  let last = 0;
  REFERENCE.lastIndex = 0;
  for (let m = REFERENCE.exec(raw); m; m = REFERENCE.exec(raw)) {
    out += raw.slice(last, m.index);
    last = m.index + m[0].length;
    if (m[1] !== undefined || m[2] !== undefined) {
      const digits = (m[1] ?? m[2]!).replace(/^0+/, "") || "0";
      const code = digits.length > 8 ? Infinity : parseInt(digits, m[1] !== undefined ? 10 : 16);
      out += code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff) ? "\ufffd" : String.fromCodePoint(code);
      continue;
    }
    const char = namedReferences().get(m[3]!);
    if (char !== undefined && (m[4] === ";" || LEGACY.has(m[3]!))) {
      out += char;
    } else {
      unknown.push(out.length);
      out += m[0];
    }
  }
  return { value: out + raw.slice(last), unknown };
}

/** Line and column (both from 1) of offsets into the input, by a table of where each line starts (after `\n`, `\r\n` or `\r`). */
function positions(input: string): (offset: number) => { line: number; column: number } {
  const starts = [0];
  const breaks = /\r\n?|\n/g;
  for (let m = breaks.exec(input); m; m = breaks.exec(input)) starts.push(m.index + m[0].length);
  return (offset) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid]! <= offset) lo = mid;
      else hi = mid - 1;
    }
    return { line: lo + 1, column: offset - starts[lo]! + 1 };
  };
}

const SPACE = /[\t\n\f\r ]/;
/** The opening marker of a downlevel-revealed conditional comment, `<!--[if !mso]><!-->` (or `<!-- -->`), whose content shows. */
const REVEALED = /^\[if[^\]]*\]>\s*<!(--\s*)?$/;
const NAME_START = /[A-Za-z]/;

/** Reads HTML into a tree. Never throws; linear in the input's length. */
export function readHtml(input: string): HtmlTree {
  const at = positions(input);
  // Lower-cased ASCII only, so every offset into it is one into the input.
  const lower = input.replace(/[A-Z]+/g, (s) => s.toLowerCase());
  const root: HtmlElement = { type: "element", name: "#root", attrs: new Map(), children: [], parent: null, line: 1, column: 1 };
  const stack: HtmlElement[] = [root];
  const open = new Map<string, number>();
  let document = false;
  const current = () => stack[stack.length - 1]!;

  const text = (from: number, to: number, references = true) => {
    if (to <= from) return;
    const raw = input.slice(from, to);
    const value = references ? decode(raw).value : raw;
    // Text that isn't space, in a head, starts the body.
    if (current().name === "head" && /[^\t\n\f\r ]/.test(value)) close("head");
    const parent = current();
    const last = parent.children[parent.children.length - 1];
    if (last?.type === "text") last.text += value;
    else parent.children.push({ type: "text", text: value, ...at(from) });
  };
  const close = (name: string) => {
    if (!open.get(name)) return;
    for (;;) {
      const element = stack.pop()!;
      open.set(element.name, open.get(element.name)! - 1);
      if (element.name === name) return;
    }
  };

  let i = 0;
  let textFrom = 0;
  const n = input.length;
  // Where the next "-->" is, found once and kept while it's still ahead: every scan for it starts past the last one, so
  // a run of conditional comments that end far away costs the input's length, not its square.
  let commentEnd = -2;
  const nextCommentEnd = (from: number) => {
    if (commentEnd === -1 || commentEnd >= from) return commentEnd;
    return (commentEnd = input.indexOf("-->", from));
  };
  while (i < n) {
    const lt = input.indexOf("<", i);
    if (lt === -1) break;
    const next = input[lt + 1];
    // A comment, Outlook's conditional ones included.
    if (input.startsWith("<!--", lt)) {
      text(textFrom, lt);
      const end = nextCommentEnd(lt + 4);
      // A downlevel-revealed marker is short: only a short comment is read to tell.
      const revealed = end !== -1 && end - lt < 256 && REVEALED.test(lower.slice(lt + 4, end));
      if (lower.startsWith("[if", lt + 4) && !revealed) {
        // Outlook's own: skipped to the > of its <![endif]-->.
        const endif = lower.indexOf("<![endif]", lt);
        const after = endif === -1 ? -1 : input.indexOf(">", endif);
        i = after === -1 ? n : after + 1;
      } else i = end === -1 ? n : end + 3;
      textFrom = i;
      continue;
    }
    // A doctype, CDATA, a downlevel-revealed marker, a processing instruction: ignored to the next >.
    if (next === "!" || next === "?") {
      text(textFrom, lt);
      const end = input.indexOf(">", lt + 2);
      i = textFrom = end === -1 ? n : end + 1;
      continue;
    }
    const closing = next === "/";
    const nameAt = closing ? lt + 2 : lt + 1;
    if (!NAME_START.test(input[nameAt] ?? "")) {
      // Not a tag: the < is text.
      i = lt + 1;
      continue;
    }
    text(textFrom, lt);
    let j = nameAt;
    while (j < n && !SPACE.test(input[j]!) && input[j] !== "/" && input[j] !== ">") j++;
    const name = lower.slice(nameAt, j);
    // Its attributes, to the >.
    const attrs = new Map<string, Attribute>();
    while (j < n && input[j] !== ">") {
      const c = input[j]!;
      if (SPACE.test(c)) {
        j++;
        continue;
      }
      if (c === "/") {
        // A /> on an element that isn't void is ignored, as browsers do.
        j++;
        continue;
      }
      const start = j;
      j++;
      while (j < n && !SPACE.test(input[j]!) && input[j] !== "/" && input[j] !== ">" && input[j] !== "=") j++;
      const attr = lower.slice(start, j);
      while (j < n && SPACE.test(input[j]!)) j++;
      let value = "";
      if (input[j] === "=") {
        j++;
        while (j < n && SPACE.test(input[j]!)) j++;
        const quote = input[j];
        if (quote === '"' || quote === "'") {
          const end = input.indexOf(quote, j + 1);
          value = input.slice(j + 1, end === -1 ? n : end);
          j = end === -1 ? n : end + 1;
        } else {
          const from = j;
          while (j < n && !SPACE.test(input[j]!) && input[j] !== ">") j++;
          value = input.slice(from, j);
        }
      }
      if (!closing && !attrs.has(attr)) attrs.set(attr, decode(value));
    }
    i = textFrom = j < n ? j + 1 : n;
    if (closing) {
      close(name);
      continue;
    }
    if (name === "html" || name === "body") document = true;
    if (!HEAD.has(name) && current().name === "head") close("head");
    if (name === "a") close("a");
    const element: HtmlElement = { type: "element", name, attrs, children: [], parent: current(), ...at(lt) };
    current().children.push(element);
    if (VOID.has(name)) continue;
    if (name === "plaintext") {
      stack.push(element);
      open.set(name, (open.get(name) ?? 0) + 1);
      text(i, n, false);
      i = textFrom = n;
      break;
    }
    if (RAW.has(name)) {
      // Everything up to its end tag is text.
      let end = lower.indexOf(`</${name}`, i);
      while (end !== -1 && !/[\t\n\f\r />]/.test(input[end + name.length + 2] ?? ">")) end = lower.indexOf(`</${name}`, end + 1);
      const stop = end === -1 ? n : end;
      stack.push(element);
      text(i, stop, ESCAPABLE.has(name));
      stack.pop();
      if (end === -1) i = textFrom = n;
      else {
        const gt = input.indexOf(">", end);
        i = textFrom = gt === -1 ? n : gt + 1;
      }
      continue;
    }
    stack.push(element);
    open.set(name, (open.get(name) ?? 0) + 1);
  }
  text(textFrom, n);
  return { root, document };
}
