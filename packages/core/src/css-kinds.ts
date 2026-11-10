/**
 * A Page's CSS values: the kinds of its page styles (Decision 5), each parsing CSS's value syntax for it. A value is
 * read into terms (numbers with units, words, colours, functions with their arguments), checked against its kind's
 * grammar, and kept as written: tokens joined by single spaces. Nothing that could end a declaration, a rule or a
 * `<style>` gets through (`;`, braces, angle brackets, backslashes, `!`, `@`, quotes outside a url or an area's row).
 *
 * Lengths evaluate to px where the resolver needs a number (`evalLength`): rem against 16px, em against a font size,
 * % against what it's a share of, viewport units against a viewport, and calc(), min(), max() and clamp() of those.
 */
import { kind, parseColor, unsafeUrl, IMAGE_DATA, readLength, type Kind, type Parsed } from "./kinds";
import type { Json } from "./model";
import { show } from "./nearest";

const ok = <T>(value: T): Parsed<T> => ({ ok: true, value });
const fail = (message: string): Parsed<never> => ({ ok: false, message });

// ─── Terms ──────────────────────────────────────────────────────────────────

export type Term =
  | { t: "num"; value: number; unit: string }
  | { t: "word"; name: string; text: string }
  | { t: "hash"; value: string }
  | { t: "fn"; name: string; args: Group[] }
  | { t: "str"; value: string }
  | { t: "op"; op: "/" | "+" | "-" | "*" };
/** Space-separated terms. */
export type Seq = Term[];
/** Comma-separated sequences. */
export type Group = Seq;

/** Characters no value takes: they could end a declaration, a rule or the `<style>`. */
const UNSAFE = /[;{}<>\\!@`\n\r\u0000]/;

const LENGTH_UNITS = new Set(["px", "rem", "em", "vw", "vh", "vmin", "vmax", "svw", "svh", "dvw", "dvh", "lvw", "lvh", "ch", "ex"]);
const ANGLE_UNITS = new Set(["deg", "turn", "rad", "grad"]);
const TIME_UNITS = new Set(["s", "ms"]);

class Reader {
  at = 0;
  constructor(readonly text: string) {}
  peek(offset = 0): string {
    return this.text[this.at + offset] ?? "";
  }
  done(): boolean {
    return this.at >= this.text.length;
  }
}

/** The value's terms, split at its top-level commas; or why it isn't a CSS value. */
export function readTerms(input: string): Parsed<Group[]> {
  // Inside a quoted url a ; or a brace can't end anything (a data URL holds one): only quotes, angle brackets,
  // backslashes and line breaks are refused there.
  const outside = input.replace(/url\(\s*(["'])([^"'<>\\\n\r]*)\1\s*\)/gi, "url()");
  if (UNSAFE.test(outside)) return fail(`${show(input)} holds a character a CSS value here can't (; { } < > \\ ! @)`);
  const reader = new Reader(input.trim());
  const groups = readGroups(reader, false);
  if (!groups.ok) return groups;
  if (!reader.done()) return fail(`unexpected ${show(reader.text.slice(reader.at))}`);
  return groups;
}

function skipSpace(reader: Reader): boolean {
  let any = false;
  while (/\s/.test(reader.peek())) {
    reader.at++;
    any = true;
  }
  return any;
}

function readGroups(reader: Reader, inside: boolean): Parsed<Group[]> {
  const groups: Group[] = [[]];
  for (;;) {
    skipSpace(reader);
    const char = reader.peek();
    if (char === "") {
      if (inside) return fail("a function isn't closed: a ( without its )");
      break;
    }
    if (char === ")") {
      if (!inside) return fail("a ) without its (");
      break;
    }
    if (char === ",") {
      reader.at++;
      groups.push([]);
      continue;
    }
    const term = readTerm(reader, groups[groups.length - 1]);
    if (!term.ok) return term;
    groups[groups.length - 1].push(term.value);
  }
  if (groups.some((group) => group.length === 0) && !(groups.length === 1 && groups[0].length === 0)) return fail("a comma with nothing on one side");
  return ok(groups.length === 1 && groups[0].length === 0 ? [] : groups);
}

const NUMBER_AT = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i;

function readTerm(reader: Reader, before: Seq): Parsed<Term> {
  const rest = reader.text.slice(reader.at);
  const char = reader.peek();
  // A + or - with a space after it is calc's operator (CSS wants them spaced); before a digit it's a number's sign.
  if (char === "+" || char === "-") {
    if (/\s/.test(reader.peek(1)) && before.length > 0) {
      reader.at++;
      return ok({ t: "op", op: char });
    }
    if (!/[\d.]/.test(reader.peek(1))) return fail(`${show(rest.split(/[\s,()]/)[0])} isn't a value: a word here starts with a letter`);
  }
  if (char === "*" || char === "/") {
    reader.at++;
    return ok({ t: "op", op: char });
  }
  const number = NUMBER_AT.exec(rest);
  if (number) {
    reader.at += number[0].length;
    const unit = /^(%|[a-z]+)/i.exec(reader.text.slice(reader.at))?.[0] ?? "";
    reader.at += unit.length;
    return ok({ t: "num", value: Number(number[0]), unit: unit.toLowerCase() });
  }
  if (char === "#") {
    const hash = /^#[0-9a-f]+/i.exec(rest)?.[0];
    if (!hash) return fail(`${show(rest)}: # starts a hex colour`);
    reader.at += hash.length;
    return ok({ t: "hash", value: hash });
  }
  if (char === '"' || char === "'") {
    const end = rest.indexOf(char, 1);
    if (end < 0) return fail(`a string isn't closed: ${show(rest)}`);
    reader.at += end + 1;
    return ok({ t: "str", value: rest.slice(1, end) });
  }
  if (char === "(") {
    reader.at++;
    const args = readGroups(reader, true);
    if (!args.ok) return args;
    reader.at++;
    return ok({ t: "fn", name: "", args: args.value });
  }
  const word = /^[a-z][a-z0-9-]*/i.exec(rest)?.[0];
  if (!word) return fail(`unexpected ${show(rest.slice(0, 12))}`);
  reader.at += word.length;
  const name = word.toLowerCase();
  if (reader.peek() === "(") {
    reader.at++;
    if (name === "url") {
      // A url's text is read as it is, quoted or not, up to its ).
      skipSpace(reader);
      const quote = reader.peek() === '"' || reader.peek() === "'" ? reader.peek() : "";
      const from = reader.at + (quote ? 1 : 0);
      const end = quote ? reader.text.indexOf(quote, from) : reader.text.indexOf(")", from);
      if (end < 0) return fail("a url( isn't closed");
      const url = reader.text.slice(from, end);
      reader.at = end + (quote ? 1 : 0);
      skipSpace(reader);
      if (reader.peek() !== ")") return fail("a url( isn't closed");
      reader.at++;
      if (/[\s"'()]/.test(url) && !quote) return fail(`an unquoted url can't hold spaces, quotes or parentheses: ${show(url)}`);
      if (/["'\n]/.test(url)) return fail(`a url can't hold a quote: ${show(url)}`);
      return ok({ t: "fn", name: "url", args: [[{ t: "str", value: url }]] });
    }
    const args = readGroups(reader, true);
    if (!args.ok) return args;
    reader.at++;
    return ok({ t: "fn", name, args: args.value });
  }
  // A word is compared lowercased (CSS's keywords aren't case-sensitive) and written as given: an area's or a line's
  // name is.
  return ok({ t: "word", name, text: word });
}

/** Terms written back: single spaces, commas followed by a space. */
export function writeTerms(groups: Group[]): string {
  return groups.map(writeSeq).join(", ");
}

function writeSeq(seq: Seq): string {
  return seq.map(writeTerm).join(" ");
}

function writeTerm(term: Term): string {
  switch (term.t) {
    case "num":
      return `${term.value}${term.unit}`;
    case "word":
      return term.text;
    case "hash":
      return term.value;
    case "str":
      return `"${term.value}"`;
    case "op":
      return term.op;
    case "fn":
      return term.name === "url" ? `url("${(term.args[0][0] as { value: string }).value}")` : `${term.name}(${writeTerms(term.args)})`;
  }
}

// ─── Checks on terms ────────────────────────────────────────────────────────

const MATH = new Set(["calc", "min", "max", "clamp"]);

interface LengthOptions {
  /** Takes a percentage. */
  percent?: boolean;
  /** Takes a value below 0. */
  negative?: boolean;
}

/** A length term: a number with a length unit (0 alone too), a percentage, or calc(), min(), max() or clamp() of them. */
export function isLength(term: Term, options: LengthOptions = {}): boolean {
  if (term.t === "num") {
    if (!options.negative && term.value < 0) return false;
    if (term.unit === "") return term.value === 0;
    if (term.unit === "%") return !!options.percent;
    return LENGTH_UNITS.has(term.unit);
  }
  if (term.t === "fn" && MATH.has(term.name)) return mathArgs(term, (operand) => isLength(operand, { percent: options.percent, negative: true }) || (operand.t === "num" && operand.unit === ""));
  return false;
}

/** A math function's arguments: clamp() three, min() and max() one or more, calc() one; each operands joined by operators. */
function mathArgs(term: Extract<Term, { t: "fn" }>, operand: (term: Term) => boolean): boolean {
  const count = term.args.length;
  if (term.name === "calc" ? count !== 1 : term.name === "clamp" ? count !== 3 : count < 1) return false;
  return term.args.every((seq) => expression(seq, operand));
}

function expression(seq: Seq, operand: (term: Term) => boolean): boolean {
  if (seq.length % 2 === 0) return false;
  return seq.every((term, index) => {
    if (index % 2 === 1) return term.t === "op" && term.op !== undefined;
    if (term.t === "fn" && term.name === "") return term.args.length === 1 && expression(term.args[0], operand);
    return operand(term);
  });
}

const isNumber = (term: Term, min = -Infinity) => term.t === "num" && term.unit === "" && term.value >= min;
const isAngle = (term: Term) => (term.t === "num" && (ANGLE_UNITS.has(term.unit) || (term.unit === "" && term.value === 0))) || (term.t === "fn" && term.name === "calc" && mathArgs(term, (o) => o.t === "num" && (ANGLE_UNITS.has(o.unit) || o.unit === "")));
const isTime = (term: Term) => term.t === "num" && TIME_UNITS.has(term.unit) && term.value >= 0;
const isWord = (term: Term, ...names: string[]) => term.t === "word" && names.includes(term.name);

/** A colour term: a hex colour, rgb()/rgba()/hsl()/hsla(), a CSS name, `transparent` or `currentcolor`. */
export function isColor(term: Term): boolean {
  if (term.t === "hash") return parseColor(term.value).ok;
  if (term.t === "word") return term.name === "currentcolor" || parseColor(term.name).ok;
  if (term.t === "fn" && ["rgb", "rgba", "hsl", "hsla"].includes(term.name)) {
    const parts = term.args.length === 1 ? term.args[0].filter((t) => t.t !== "op" || t.op !== "/") : term.args.map((seq) => (seq.length === 1 ? seq[0] : undefined));
    return parts.length >= 3 && parts.length <= 4 && parts.every((part) => part !== undefined && part.t === "num" && (part.unit === "" || part.unit === "%" || ANGLE_UNITS.has(part.unit)));
  }
  return false;
}

/** An image: url() (http, https, a relative path or an image data URL) or a gradient. */
export function isImage(term: Term): Parsed<true> {
  if (term.t !== "fn") return fail("an image is url(…) or a gradient");
  if (term.name === "url") {
    const url = (term.args[0][0] as { value: string }).value;
    if (!url.trim()) return fail("url() is empty");
    if (unsafeUrl(url, IMAGE_DATA)) return fail(`${show(url)} isn't a URL an image can be loaded from`);
    return ok(true);
  }
  if (/^(repeating-)?(linear|radial|conic)-gradient$/.test(term.name)) {
    if (term.args.length < 2 && !term.name.startsWith("conic")) return fail(`${term.name}() takes at least two colours`);
    const stops = term.args.filter((seq) => seq.some(isColor));
    if (stops.length < 2) return fail(`${term.name}() takes at least two colours`);
    for (const seq of term.args) {
      for (const part of seq) {
        if (isColor(part) || isLength(part, { percent: true, negative: true }) || isAngle(part) || part.t === "word") continue;
        return fail(`${show(writeTerm(part))} isn't part of a gradient`);
      }
    }
    return ok(true);
  }
  return fail(`${term.name}() isn't an image: url(…) or a gradient`);
}

// ─── Kinds ──────────────────────────────────────────────────────────────────

/** A kind of a string value, checked on its terms, kept as written (tokens joined by single spaces). */
function termsKind(name: string, accepts: string, check: (groups: Group[]) => Parsed<true>, options: { number?: (n: number) => Parsed<number> } = {}): Kind<string | number, string | number> {
  return kind<string | number, string | number>({
    name,
    editor: "text",
    accepts,
    parse(input) {
      if (typeof input === "number") {
        if (options.number && Number.isFinite(input)) return options.number(input);
        return fail(`expected ${accepts}, not ${show(input)}`);
      }
      if (typeof input !== "string" || !input.trim()) return fail(`expected ${accepts}, not ${show(input)}`);
      const terms = readTerms(input);
      if (!terms.ok) return fail(`${terms.message}; expected ${accepts}`);
      const checked = check(terms.value);
      if (!checked.ok) return fail(`${checked.message}; expected ${accepts}`);
      return ok(writeTerms(terms.value));
    },
    jsonSchema: () => (options.number ? { anyOf: [{ type: "number" }, { type: "string" }] } : { type: "string" }),
  });
}

const one = (groups: Group[]): Seq | undefined => (groups.length === 1 ? groups[0] : undefined);

export interface RichLengthOptions<W extends string = string> extends LengthOptions {
  /** Its least value in px (a number, or a px string). */
  min?: number;
  /** Words it takes besides lengths (`auto`, `none`, `fit-content`). */
  words?: readonly W[];
}

/** The units a Page's length takes. */
export type RichUnit = "px" | "rem" | "em" | "%" | "vw" | "vh" | "vmin" | "vmax" | "svw" | "svh" | "dvw" | "dvh" | "lvw" | "lvh" | "ch" | "ex";
/** A Page's length as a template writes it: px (a number), a number with a unit, or a math function, or one of its words. */
export type RichLengthInput<W extends string = never> = number | `${number}${RichUnit}` | `${"calc" | "min" | "max" | "clamp"}(${string})` | W;

/**
 * A Page's length: px (a number, or "12px"), rem, em, %, viewport units, or calc(), min(), max() and clamp() of them,
 * and the words given. A number or a px string is a number of px, as today's length kind gives; a percentage is
 * "50%", as today; anything else is kept as written.
 */
export function richLength<const W extends string = never>(options: RichLengthOptions<W> = {}): Kind<RichLengthInput<W>, number | string> {
  const words: readonly string[] = options.words ?? [];
  const units = ["a number of px", "rem", "em", ...(options.percent ? ["%"] : []), "vw", "vh", "calc()", "min()", "max()", "clamp()", ...words.map((w) => `"${w}"`)];
  const accepts = `a length (${units.join(", ")})`;
  const min = options.min ?? (options.negative ? -Infinity : 0);
  return kind<RichLengthInput<W>, number | string>({
    name: "length",
    editor: "length",
    accepts,
    parse(input) {
      const plain = readLength(input);
      if (plain && (plain.unit === "px" || (plain.unit === "%" && options.percent))) {
        if (plain.value < min) return fail(`can't be less than ${min}, not ${show(input)}`);
        return ok(plain.unit === "px" ? plain.value : `${plain.value}%`);
      }
      if (typeof input !== "string") return fail(`expected ${accepts}, not ${show(input)}`);
      const terms = readTerms(input);
      const seq = terms.ok ? one(terms.value) : undefined;
      if (!terms.ok || !seq || seq.length !== 1) return fail(`expected ${accepts}, not ${show(input)}`);
      const term = seq[0];
      if (term.t === "word" && words.includes(term.name)) return ok(term.name);
      if (!isLength(term, options)) return fail(`expected ${accepts}, not ${show(input)}`);
      // The least value is in px: a rem, an em or a viewport unit isn't compared to it (0.875rem is 14px).
      if (term.t === "num" && term.unit === "px" && term.value < min) return fail(`can't be less than ${min}px, not ${show(input)}`);
      return ok(writeTerm(term));
    },
    jsonSchema: () => ({ anyOf: [{ type: "number", ...(Number.isFinite(min) ? { minimum: min } : {}) }, { type: "string" }] }),
  });
}

/** A whole number, optionally from `min`. */
export function integer(min = -Infinity, words: readonly string[] = []): Kind<number | string, number | string> {
  const accepts = `a whole number${Number.isFinite(min) ? ` from ${min}` : ""}${words.length ? ` or ${words.map((w) => `"${w}"`).join(", ")}` : ""}`;
  return kind({
    name: "number",
    editor: "number",
    accepts,
    parse: (input): Parsed<number | string> => (typeof input === "number" && Number.isInteger(input) && input >= min ? ok(input) : typeof input === "string" && words.includes(input) ? ok(input) : fail(`expected ${accepts}, not ${show(input)}`)),
    jsonSchema: () => ({ anyOf: [{ type: "integer", ...(Number.isFinite(min) ? { minimum: min } : {}) }, ...(words.length ? [{ enum: [...words] }] : [])] }),
  });
}

/** A number from `min` to `max`. */
export function between(min: number, max: number): Kind<number, number> {
  const accepts = `a number from ${min} to ${max}`;
  return kind({
    name: "number",
    editor: "number",
    accepts,
    parse: (input) => (typeof input === "number" && Number.isFinite(input) && input >= min && input <= max ? ok(input) : fail(`expected ${accepts}, not ${show(input)}`)),
    jsonSchema: () => ({ type: "number", minimum: min, ...(Number.isFinite(max) ? { maximum: max } : {}) }),
  });
}

/** One to four lengths, as `inset` and `borderWidth` take (top, right, bottom, left). */
export function lengths(options: RichLengthOptions & { most?: number } = {}): Kind<number | string, number | string> {
  const most = options.most ?? 4;
  const words = options.words ?? [];
  return termsKind(
    "lengths",
    `one to ${most} lengths${words.length ? ` or ${words.map((w) => `"${w}"`).join(", ")}` : ""}`,
    (groups) => {
      const seq = one(groups);
      if (!seq || seq.length < 1 || seq.length > most) return fail(`one to ${most} values`);
      for (const term of seq) if (!isLength(term, options) && !(term.t === "word" && words.includes(term.name))) return fail(`${show(writeTerm(term))} isn't a length`);
      return ok(true);
    },
    { number: (n) => (n >= (options.negative ? -Infinity : 0) ? ok(n) : fail(`can't be less than 0, not ${n}`)) }
  );
}

/** The most a repeat() repeats its tracks. */
export const MAX_REPEAT = 1000;

/** A grid's tracks: lengths, %, fr, auto, min-content, max-content, minmax(), fit-content() and repeat(). */
export function tracks(): Kind<string | number, string | number> {
  const track = (term: Term, inRepeat: boolean): boolean => {
    if (term.t === "num" && term.unit === "fr") return term.value >= 0;
    if (isLength(term, { percent: true })) return true;
    if (term.t === "word") return ["auto", "min-content", "max-content"].includes(term.name);
    if (term.t === "fn" && term.name === "minmax") return term.args.length === 2 && term.args.every((seq) => seq.length === 1 && track(seq[0], inRepeat));
    if (term.t === "fn" && term.name === "fit-content") return term.args.length === 1 && term.args[0].length === 1 && isLength(term.args[0][0], { percent: true });
    if (term.t === "fn" && term.name === "repeat" && !inRepeat) {
      if (term.args.length !== 2 || term.args[0].length !== 1) return false;
      const count = term.args[0][0];
      // At most MAX_REPEAT: a count past it would be tracks no page has, and work for nothing.
      const countOk = (count.t === "num" && count.unit === "" && Number.isInteger(count.value) && count.value >= 1 && count.value <= MAX_REPEAT) || isWord(count, "auto-fill", "auto-fit");
      return countOk && term.args[1].length > 0 && term.args[1].every((t) => track(t, true));
    }
    return false;
  };
  return termsKind(
    "tracks",
    'tracks ("1fr 2fr", "200px 1fr", "repeat(3, 1fr)", "repeat(auto-fill, minmax(200px, 1fr))", "none")',
    (groups) => {
      const seq = one(groups);
      if (!seq || !seq.length) return fail("tracks are space-separated, not comma-separated");
      if (seq.length === 1 && isWord(seq[0], "none")) return ok(true);
      for (const term of seq) if (!track(term, false)) return fail(`${show(writeTerm(term))} isn't a track`);
      return ok(true);
    },
    { number: (n) => (n >= 0 ? ok(n) : fail("a track can't be less than 0")) }
  );
}

const AREA = /^(?:[A-Za-z][A-Za-z0-9-]*|\.+)$/;

/** A grid's named areas: a row of names per string, the same number in each (`["header header", "nav main"]`). */
export function areas(): Kind<string | readonly string[], string[]> {
  const accepts = 'a row of area names per string, as many in each ("header header", "nav main"), "." for an empty cell';
  return kind({
    name: "areas",
    editor: "text",
    accepts,
    parse(input) {
      const rows = typeof input === "string" ? [input] : Array.isArray(input) ? input : undefined;
      if (!rows || !rows.length || rows.some((row) => typeof row !== "string")) return fail(`expected ${accepts}, not ${show(input)}`);
      const cells = (rows as string[]).map((row) => row.trim().split(/\s+/));
      for (const row of cells) for (const cell of row) if (!AREA.test(cell)) return fail(`${show(cell)} isn't an area's name (letters, digits and hyphens) or "."`);
      if (cells.some((row) => row.length !== cells[0].length)) return fail("each row names as many cells as the first");
      return ok(cells.map((row) => row.join(" ")));
    },
    jsonSchema: () => ({ anyOf: [{ type: "string" }, { type: "array", items: { type: "string" }, minItems: 1 }] }),
  });
}

/** Where an item sits in a grid: a line ("1", "1 / 3", "span 2", "2 / span 2"), an area's name, or "auto". */
export function gridPlace(most = 2): Kind<string | number, string | number> {
  const line = (seq: Seq) =>
    (seq.length === 1 && (isWord(seq[0], "auto") || (seq[0].t === "word" && AREA.test(seq[0].name)) || (seq[0].t === "num" && seq[0].unit === "" && Number.isInteger(seq[0].value) && seq[0].value !== 0))) ||
    (seq.length === 2 && isWord(seq[0], "span") && ((seq[1].t === "num" && seq[1].unit === "" && Number.isInteger(seq[1].value) && seq[1].value > 0) || seq[1].t === "word"));
  return termsKind(
    "gridPlace",
    `a grid line, "span n", an area's name or "auto", up to ${most} separated by " / "`,
    (groups) => {
      const seq = one(groups);
      if (!seq) return fail("no commas");
      const parts: Seq[] = [[]];
      for (const term of seq) if (term.t === "op" && term.op === "/") parts.push([]);
      else parts[parts.length - 1].push(term);
      if (parts.length > most || !parts.every(line)) return fail(`${show(writeSeq(seq))} isn't a grid line`);
      return ok(true);
    },
    { number: (n) => (Number.isInteger(n) && n !== 0 ? ok(n) : fail("a grid line is a whole number other than 0")) }
  );
}

/** An aspect ratio: a number, "16 / 9" or "auto". */
export function ratio(): Kind<string | number, string | number> {
  return termsKind(
    "ratio",
    'a ratio: a number, "16 / 9" or "auto"',
    (groups) => {
      const seq = one(groups);
      if (seq && seq.length === 1 && (isWord(seq[0], "auto") || isNumber(seq[0], 0))) return ok(true);
      if (seq && seq.length === 3 && isNumber(seq[0], 0) && seq[1].t === "op" && seq[1].op === "/" && isNumber(seq[2], 0)) return ok(true);
      return fail("not a ratio");
    },
    { number: (n) => (n > 0 ? ok(n) : fail("a ratio is more than 0")) }
  );
}

/** A position: one or two of left/center/right/top/bottom or lengths ("center", "50% 0", "right 20px top 10px"). */
export function position(layers = false): Kind<string, string> {
  const check = (seq: Seq) => seq.length >= 1 && seq.length <= 4 && seq.every((term) => isWord(term, "left", "center", "right", "top", "bottom") || isLength(term, { percent: true, negative: true }));
  return termsKind("position", 'a position ("center", "50% 25%", "right 20px top 10px")', (groups) => (groups.length && (layers || groups.length === 1) && groups.every(check) ? ok(true) : fail("not a position"))) as Kind<string, string>;
}

/** Background images: url() and gradients, comma-separated layers, or "none". */
export function images(): Kind<string, string> {
  return termsKind("images", 'images: url(…), a gradient (linear-gradient(…), radial-gradient(…), conic-gradient(…)), several separated by commas, or "none"', (groups) => {
    if (groups.length === 1 && groups[0].length === 1 && isWord(groups[0][0], "none")) return ok(true);
    for (const seq of groups) {
      if (seq.length !== 1) return fail("one image per layer");
      const image = isImage(seq[0]);
      if (!image.ok) return image;
    }
    return ok(true);
  }) as Kind<string, string>;
}

/** Background sizes: cover, contain, auto or one or two lengths, per layer. */
export function backgroundSize(): Kind<string, string> {
  return termsKind("backgroundSize", 'a size ("cover", "contain", "auto", "100% auto", "200px"), per layer', (groups) =>
    groups.every((seq) => (seq.length === 1 && isWord(seq[0], "cover", "contain")) || (seq.length >= 1 && seq.length <= 2 && seq.every((t) => isWord(t, "auto") || isLength(t, { percent: true })))) ? ok(true) : fail("not a background size")
  ) as Kind<string, string>;
}

/** Background repeats, per layer. */
export function backgroundRepeat(): Kind<string, string> {
  const words = ["repeat", "no-repeat", "repeat-x", "repeat-y", "space", "round"];
  return termsKind("backgroundRepeat", `${words.map((w) => `"${w}"`).join(", ")}, per layer`, (groups) =>
    groups.every((seq) => seq.length >= 1 && seq.length <= 2 && seq.every((t) => isWord(t, ...words))) ? ok(true) : fail("not a repeat")
  ) as Kind<string, string>;
}

/** Shadows: [inset] x y [blur [spread]] [colour], several separated by commas, or "none". */
export function shadows(): Kind<string, string> {
  return termsKind("shadows", 'shadows ("0 1px 2px rgba(0, 0, 0, 0.1)", "inset 0 0 0 1px #e5e7eb"), several separated by commas, or "none"', (groups) => {
    if (groups.length === 1 && groups[0].length === 1 && isWord(groups[0][0], "none")) return ok(true);
    for (const seq of groups) {
      const rest = seq.filter((t) => !isWord(t, "inset"));
      const colors = rest.filter(isColor);
      const lengthsIn = rest.filter((t) => !isColor(t));
      if (seq.length - rest.length > 1 || colors.length > 1 || lengthsIn.length < 2 || lengthsIn.length > 4 || !lengthsIn.every((t) => isLength(t, { negative: true }))) return fail(`${show(writeSeq(seq))} isn't a shadow`);
    }
    return ok(true);
  }) as Kind<string, string>;
}

const TRANSFORMS: Record<string, (args: Group[]) => boolean> = {
  translate: (args) => args.length >= 1 && args.length <= 2 && args.every((s) => s.length === 1 && isLength(s[0], { percent: true, negative: true })),
  translatex: (args) => args.length === 1 && args[0].length === 1 && isLength(args[0][0], { percent: true, negative: true }),
  translatey: (args) => args.length === 1 && args[0].length === 1 && isLength(args[0][0], { percent: true, negative: true }),
  scale: (args) => args.length >= 1 && args.length <= 2 && args.every((s) => s.length === 1 && (isNumber(s[0]) || (s[0].t === "num" && s[0].unit === "%"))),
  scalex: (args) => args.length === 1 && args[0].length === 1 && isNumber(args[0][0]),
  scaley: (args) => args.length === 1 && args[0].length === 1 && isNumber(args[0][0]),
  rotate: (args) => args.length === 1 && args[0].length === 1 && isAngle(args[0][0]),
  skew: (args) => args.length >= 1 && args.length <= 2 && args.every((s) => s.length === 1 && isAngle(s[0])),
  skewx: (args) => args.length === 1 && args[0].length === 1 && isAngle(args[0][0]),
  skewy: (args) => args.length === 1 && args[0].length === 1 && isAngle(args[0][0]),
  matrix: (args) => args.length === 6 && args.every((s) => s.length === 1 && isNumber(s[0])),
};

/** 2D transforms: translate(), scale(), rotate(), skew() and matrix(), in order, or "none". */
export function transform(): Kind<string, string> {
  return termsKind("transform", 'transforms ("translateY(-2px)", "scale(1.05) rotate(3deg)") or "none"', (groups) => {
    const seq = one(groups);
    if (!seq || !seq.length) return fail("transforms are space-separated");
    if (seq.length === 1 && isWord(seq[0], "none")) return ok(true);
    for (const term of seq) {
      const check = term.t === "fn" ? TRANSFORMS[term.name.replace(/[A-Z]/g, (c) => c.toLowerCase())] : undefined;
      if (!check || term.t !== "fn" || !check(term.args)) return fail(`${show(writeTerm(term))} isn't a 2D transform`);
    }
    return ok(true);
  }) as Kind<string, string>;
}

const FILTERS: Record<string, (args: Group[]) => boolean> = {
  blur: (args) => args.length === 1 && args[0].length === 1 && isLength(args[0][0]),
  "drop-shadow": (args) => args.length === 1 && args[0].length >= 2 && args[0].length <= 4 && args[0].filter((t) => !isColor(t)).every((t) => isLength(t, { negative: true })) && args[0].filter(isColor).length <= 1,
  "hue-rotate": (args) => args.length === 1 && args[0].length === 1 && isAngle(args[0][0]),
};
for (const name of ["brightness", "contrast", "grayscale", "invert", "opacity", "saturate", "sepia"]) {
  FILTERS[name] = (args) => args.length === 1 && args[0].length === 1 && args[0][0].t === "num" && args[0][0].value >= 0 && (args[0][0].unit === "" || args[0][0].unit === "%");
}

/** Filters: blur(), brightness(), contrast(), drop-shadow(), grayscale(), hue-rotate(), invert(), opacity(), saturate(), sepia(), or "none". */
export function filter(): Kind<string, string> {
  return termsKind("filter", `filters (${Object.keys(FILTERS).map((n) => `${n}()`).join(", ")}) or "none"`, (groups) => {
    const seq = one(groups);
    if (!seq || !seq.length) return fail("filters are space-separated");
    if (seq.length === 1 && isWord(seq[0], "none")) return ok(true);
    for (const term of seq) if (term.t !== "fn" || !FILTERS[term.name]?.(term.args)) return fail(`${show(writeTerm(term))} isn't a filter`);
    return ok(true);
  }) as Kind<string, string>;
}

const EASINGS = ["ease", "linear", "ease-in", "ease-out", "ease-in-out", "step-start", "step-end"];
const PROPERTY = /^[a-z][a-z-]*$/;

/** Transitions: [property] duration [easing] [delay], several separated by commas, or "none". */
export function transition(): Kind<string, string> {
  return termsKind("transition", 'transitions ("background-color 150ms ease", "all 0.2s"), several separated by commas, or "none"', (groups) => {
    if (groups.length === 1 && groups[0].length === 1 && isWord(groups[0][0], "none")) return ok(true);
    for (const seq of groups) {
      const times = seq.filter(isTime);
      const easings = seq.filter((t) => isWord(t, ...EASINGS) || (t.t === "fn" && (t.name === "cubic-bezier" ? t.args.length === 4 && t.args.every((s) => s.length === 1 && isNumber(s[0])) : t.name === "steps" && t.args.length >= 1 && t.args.length <= 2)));
      const properties = seq.filter((t) => t.t === "word" && !EASINGS.includes(t.name) && PROPERTY.test(t.name));
      if (times.length < 1 || times.length > 2 || easings.length > 1 || properties.length > 1 || times.length + easings.length + properties.length !== seq.length) return fail(`${show(writeSeq(seq))} isn't a transition`);
    }
    return ok(true);
  }) as Kind<string, string>;
}

/** An outline: "width style colour" (`"2px solid #2563eb"`), or "none". */
export function outline(): Kind<string, string> {
  const styles = ["solid", "dashed", "dotted", "double", "none", "auto"];
  return termsKind("outline", 'an outline ("2px solid #2563eb") or "none"', (groups) => {
    const seq = one(groups);
    if (!seq || seq.length < 1 || seq.length > 3) return fail("width, style and colour");
    if (seq.filter((t) => isWord(t, ...styles)).length > 1 || seq.filter(isColor).length > 1 || seq.filter((t) => isLength(t)).length > 1) return fail("one each of width, style and colour");
    return seq.every((t) => isWord(t, ...styles) || isColor(t) || isLength(t)) ? ok(true) : fail("not an outline");
  }) as Kind<string, string>;
}

/** A transform's origin: one to three positions. */
export function origin(): Kind<string, string> {
  return termsKind("origin", 'an origin ("center", "top left", "50% 100%")', (groups) => {
    const seq = one(groups);
    return seq && seq.length >= 1 && seq.length <= 3 && seq.every((t) => isWord(t, "left", "center", "right", "top", "bottom") || isLength(t, { percent: true, negative: true })) ? ok(true) : fail("not an origin");
  }) as Kind<string, string>;
}

// ─── Evaluating lengths ─────────────────────────────────────────────────────

export interface LengthContext {
  /** What a percentage is of, in px, or null where it isn't known. */
  percentOf: number | null;
  /** The font size em is of. */
  fontSize: number;
  /** The viewport's width and height. */
  viewport: { width: number; height: number };
}

/** The root font size rem is of. */
export const ROOT_FONT_SIZE = 16;

/** A length in px, given what its units are of; null where it depends on something unknown or isn't a length. */
export function evalLength(value: Json | undefined, context: LengthContext): number | null {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return null;
  const plain = readLength(value);
  if (plain?.unit === "px") return plain.value;
  if (plain?.unit === "%") return context.percentOf === null ? null : (context.percentOf * plain.value) / 100;
  const term = lengthTerm(value);
  return term === null ? null : evalTerm(term, context);
}

/** Read lengths, by their text: layout asks for the same node's sizes many times, and a value is read once. */
const TERMS = new Map<string, Term | null>();

function lengthTerm(value: string): Term | null {
  const known = TERMS.get(value);
  if (known !== undefined) return known;
  const terms = readTerms(value);
  const term = terms.ok && terms.value.length === 1 && terms.value[0].length === 1 ? terms.value[0][0] : null;
  // Kept small: templates use a few dozen distinct lengths.
  if (TERMS.size > 1000) TERMS.clear();
  TERMS.set(value, term);
  return term;
}

/** One term in px (a length, a percentage, a math function), given what its units are of; null where unknown. */
export function termLength(term: Term, context: LengthContext): number | null {
  return evalTerm(term, context);
}

function evalTerm(term: Term, context: LengthContext): number | null {
  if (term.t === "num") {
    switch (term.unit) {
      case "":
      case "px":
        return term.value;
      case "%":
        return context.percentOf === null ? null : (context.percentOf * term.value) / 100;
      case "rem":
        return term.value * ROOT_FONT_SIZE;
      case "em":
        return term.value * context.fontSize;
      case "ch":
      case "ex":
        return term.value * context.fontSize * 0.5;
      case "vw":
      case "svw":
      case "dvw":
      case "lvw":
        return (term.value * context.viewport.width) / 100;
      case "vh":
      case "svh":
      case "dvh":
      case "lvh":
        return (term.value * context.viewport.height) / 100;
      case "vmin":
        return (term.value * Math.min(context.viewport.width, context.viewport.height)) / 100;
      case "vmax":
        return (term.value * Math.max(context.viewport.width, context.viewport.height)) / 100;
      default:
        return null;
    }
  }
  if (term.t !== "fn") return null;
  if (term.name === "" || term.name === "calc") return term.args.length === 1 ? evalExpression(term.args[0], context) : null;
  const values = term.args.map((seq) => evalExpression(seq, context));
  if (values.some((v) => v === null)) return null;
  const numbers = values as number[];
  if (term.name === "min") return Math.min(...numbers);
  if (term.name === "max") return Math.max(...numbers);
  if (term.name === "clamp" && numbers.length === 3) return Math.max(numbers[0], Math.min(numbers[1], numbers[2]));
  return null;
}

/** operand (op operand)*, * and / before + and -. */
function evalExpression(seq: Seq, context: LengthContext): number | null {
  if (seq.length % 2 === 0) return null;
  const operands: number[] = [];
  const ops: string[] = [];
  for (let i = 0; i < seq.length; i++) {
    const term = seq[i];
    if (i % 2 === 1) {
      if (term.t !== "op") return null;
      ops.push(term.op);
      continue;
    }
    const value = evalTerm(term, context);
    if (value === null) return null;
    operands.push(value);
  }
  // * and / first.
  const sums: number[] = [operands[0]];
  const signs: string[] = [];
  for (let i = 0; i < ops.length; i++) {
    const right = operands[i + 1];
    if (ops[i] === "*") sums[sums.length - 1] *= right;
    else if (ops[i] === "/") {
      if (right === 0) return null;
      sums[sums.length - 1] /= right;
    } else {
      signs.push(ops[i]);
      sums.push(right);
    }
  }
  return sums.reduce((total, value, index) => (index === 0 ? value : signs[index - 1] === "-" ? total - value : total + value), 0);
}

// ─── Today's kinds, widened on a Page ───────────────────────────────────────

/**
 * A kind that takes what `base` takes, with `base`'s output, and on top what `wide` takes: a value today's kind
 * accepts keeps its meaning and output (Decision 5).
 */
export function widened<I, O extends Json, WI, WO extends Json>(base: Kind<I, O>, wide: Kind<WI, WO>, accepts?: string): Kind<I | WI, O | WO> {
  return kind<I | WI, O | WO>({
    name: base.name,
    editor: base.editor,
    accepts: accepts ?? `${base.accepts}, or on a Page ${wide.accepts}`,
    parse(input) {
      const today = base.parse(input);
      if (today.ok) return today;
      const page = wide.parse(input);
      return page.ok ? page : fail(`expected ${accepts ?? `${base.accepts}, or on a Page ${wide.accepts}`}, not ${show(input)}`);
    },
    jsonSchema: () => ({ anyOf: [base.jsonSchema(), wide.jsonSchema()] }),
  });
}

/** A line height on a Page beyond today's: a length in rem, em, viewport units or a math function. */
export function richLineHeight(): Kind<Exclude<RichLengthInput, number>, string> {
  return kind({
    name: "lineHeight",
    editor: "lineHeight",
    accepts: 'a length ("1.5rem", "1.25em", "calc(1em + 4px)")',
    parse(input) {
      if (typeof input !== "string") return fail(`expected a length, not ${show(input)}`);
      const parsed = richLength().parse(input);
      return parsed.ok && typeof parsed.value === "string" ? ok(parsed.value) : fail(`expected a length ("1.5rem", "1.25em"), not ${show(input)}`);
    },
    jsonSchema: () => ({ type: "string" }),
  });
}

/** Padding on a Page beyond today's: one to four lengths as CSS writes them ("1rem 2rem"), or sides of lengths. */
export function richInsets(): Kind<string | Record<string, number | string>, Record<string, number | string>> {
  const side = richLength({ percent: true });
  const accepts = 'one to four lengths ("1rem 2rem", "clamp(1rem, 4vw, 3rem)") or { top, right, bottom, left } of lengths';
  return kind({
    name: "insets",
    editor: "insets",
    accepts,
    parse(input) {
      let values: Array<unknown>;
      if (typeof input === "string") {
        const terms = readTerms(input);
        if (!terms.ok || terms.value.length !== 1 || terms.value[0].length < 1 || terms.value[0].length > 4) return fail(`expected ${accepts}, not ${show(input)}`);
        values = terms.value[0].map(writeTerm);
      } else if (typeof input === "object" && input !== null && !Array.isArray(input)) {
        const sides = input as Record<string, unknown>;
        const extra = Object.keys(sides).find((key) => !["top", "right", "bottom", "left"].includes(key));
        if (extra) return fail(`"${extra}" isn't a side; expected ${accepts}`);
        values = [sides.top ?? 0, sides.right ?? 0, sides.bottom ?? 0, sides.left ?? 0];
      } else return fail(`expected ${accepts}, not ${show(input)}`);
      const read: Array<number | string> = [];
      for (const value of values) {
        const parsed = side.parse(value);
        if (!parsed.ok) return fail(`${parsed.message}; expected ${accepts}`);
        read.push(parsed.value);
      }
      const [top, right = top, bottom = top, left = right] = read;
      return ok({ top, right, bottom, left });
    },
    jsonSchema: () => ({ anyOf: [{ type: "string" }, { type: "object" }] }),
  });
}

/** A corner radius on a Page beyond today's: one to four lengths or percentages ("1rem", "50%", "8px 8px 0 0"). */
export function richRadius(): Kind<string, string> {
  return lengths({ percent: true }) as Kind<string, string>;
}
