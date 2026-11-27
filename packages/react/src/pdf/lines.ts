/**
 * A node's text as its PDF draws it, line by line: each line's characters in the node's text, its box, and where a
 * caret goes between its characters (DocumentLine). Made from where the measurer (or the PDF engine) drew each line and
 * each of its characters (core's carets.ts), and from the node's text as the page model holds it.
 */
import { lineEnds, runsText, type Block, type DrawnDocument, type PlacedBlock, type PlacedLine } from "@hyper-elements/core/pdf";
import type { PlannedPart } from "@hyper-elements/core";

/** A run of a line's characters written one way, side by side: where a caret goes between them. */
export interface DocumentRun {
  /** Its characters in its node's text: from, and up to (in UTF-16 code units, as a JavaScript string counts them). */
  start: number;
  end: number;
  /** Written right to left: its first character on its right. */
  rtl?: true;
  /**
   * Where a caret goes before each of its characters and after its last, in px from its page's left: `end - start + 1`
   * of them. An offset inside a character (between a UTF-16 pair, or before a mark on a letter) has the caret before
   * that character.
   */
  carets: number[];
}

/** A line of a node's text, as its PDF draws it. Lengths are in px from its page's top left. */
export interface DocumentLine {
  /** Its characters in its node's text: from, and up to. */
  start: number;
  end: number;
  /** Where its characters are drawn: from the left of its leftmost to the right of its rightmost. */
  x: number;
  width: number;
  /** Its line's top and height (a caret's), and its baseline. */
  y: number;
  height: number;
  baseline: number;
  /** Its characters in runs each written one way, in the order they're written. */
  runs: DocumentRun[];
}

/** A PDF point in px: a point is 1/72 of an inch, a px 1/96. */
const px = (points: number) => Math.round((points / 0.75) * 100) / 100;

/** A node's text on a page (from 0), or undefined; `whole`, where it's all on that page (not a part of it that goes on). */
export type NodeTexts = (path: string, page: number, whole?: boolean) => string | undefined;

/**
 * Each node's text, as the page model holds it: its block of text's, or the text that's `of` it. A page's header and
 * footer, and a block all on a page, as that page draws them (`drawn`: with that page's numbers); a part of a block of
 * text that goes on, as it was measured before it flowed (`written`: its lines are in all of its text).
 */
export function nodeTexts(written: DrawnDocument, drawn: DrawnDocument = written): NodeTexts {
  const visit = (out: Map<string, string>) => (block: Block | undefined) => {
    if (!block) return;
    if (block.kind === "text") {
      const path = block.path ?? block.of;
      const text = runsText(block.runs, block.style);
      if (path !== undefined && text !== undefined && !out.has(path)) out.set(path, text);
    } else if (block.kind === "box" || block.kind === "link") block.children.forEach(visit(out));
  };
  const content = new Map<string, string>();
  for (const page of written.pages) page.content.forEach(visit(content));
  const around = drawn.pages.map((page) => {
    const out = new Map<string, string>();
    [page.header, page.footer].forEach(visit(out));
    return out;
  });
  const whole = drawn.pages.map((page) => {
    const out = new Map<string, string>();
    page.content.forEach(visit(out));
    return out;
  });
  return (path, page, all) => around[page]?.get(path) ?? (all ? whole[page]?.get(path) : undefined) ?? content.get(path);
}

/** Whether the UTF-16 unit at `i` is inside a character: the second of a pair, a mark on a letter, or what a zero-width joiner joins. */
function inside(text: string, i: number): boolean {
  if (i <= 0 || i >= text.length) return false;
  const unit = text.charCodeAt(i);
  // Below U+0300 there's no mark, pair or joiner: most text, at once.
  if (unit < 0x300 && text.charCodeAt(i - 1) < 0x300) return false;
  if (unit >= 0xdc00 && unit <= 0xdfff && text.charCodeAt(i - 1) >= 0xd800 && text.charCodeAt(i - 1) <= 0xdbff) return true;
  const char = String.fromCodePoint(text.codePointAt(i)!);
  if (/\p{M}/u.test(char) || char === "‍") return true;
  // Before i, the code point that ends there (a pair's first unit is before its second).
  const before = text.charCodeAt(i - 1) >= 0xdc00 && text.charCodeAt(i - 1) <= 0xdfff && i >= 2 ? text.codePointAt(i - 2)! : text.codePointAt(i - 1)!;
  if (before === 0x200d) return true;
  const code = text.codePointAt(i)!;
  // A skin tone on the emoji before it.
  return code >= 0x1f3fb && code <= 0x1f3ff;
}

/**
 * A node's lines as drawn (`boxes`), each one's characters in its text: a part drawn line by line by its plan's
 * lines, else matched to its text. Undefined where they can't be matched (a transform that changes its text's length).
 */
export function documentLines(text: string, block: PlacedBlock, part: PlannedPart | undefined): DocumentLine[] | undefined {
  const all = block.boxes ?? [];
  // A line with no characters (an empty block of text's, or the one after the line break it ends in): at its end.
  const boxes = all.filter((box) => !box.blank);
  const blank = all.find((box) => box.blank);
  const end = part?.lines?.length ? part.lines[part.lines.length - 1].end : text.length;
  const empty = blank && [{ start: end, end, x: px(blank.x), width: 0, y: px(blank.top), height: px(blank.height), baseline: px(blank.top + blank.ascent), runs: [] }];
  if (!boxes.length) return empty || undefined;
  let ranges: Array<{ start: number; end: number; hyphenated: boolean }>;
  if (part?.lines && part.lines.length === boxes.length) {
    ranges = part.lines.map((line) => ({ start: line.start, end: line.end, hyphenated: line.hyphenated }));
  } else {
    const ends = lineEnds(text, boxes.map((box) => box.text));
    if (!ends) return undefined;
    ranges = ends.map((end, j) => ({ start: j === 0 ? 0 : ends[j - 1].next, end: end.end, hyphenated: end.hyphenated }));
  }
  return [...boxes.map((box, j) => lineOf(text, box, ranges[j])), ...(empty || [])];
}

function lineOf(text: string, box: PlacedLine, range: { start: number; end: number; hyphenated: boolean }): DocumentLine {
  const { start, end } = range;
  const edges = box.edges;
  // Its characters drawn: those of its text it shows (a line drawn on its own has no space it ends in), not a hyphen.
  const drawn = edges ? Math.min(edges.length - (range.hyphenated ? 1 : 0), end - start) : 0;
  const left = (u: number) => box.x + edges!.edges[u * 2];
  const right = (u: number) => box.x + edges!.edges[u * 2 + 1];
  const runs: Array<{ start: number; end: number; rtl: boolean; carets: number[] }> = [];
  for (let u = 0; u < drawn; u++) {
    const rtl = edges!.rtl[u] === 1;
    const run = runs[runs.length - 1];
    const within = inside(text, start + u);
    // A character beside the one before it, written the same way: in its run.
    const same = run && run.rtl === rtl && (within || Math.abs((rtl ? right(u) : left(u)) - (rtl ? left(u - 1) : right(u - 1))) < 0.01);
    const lead = rtl ? right(u) : left(u);
    const trail = rtl ? left(u) : right(u);
    if (same) {
      run.carets[run.carets.length - 1] = within ? run.carets[run.carets.length - 2] : lead;
      run.carets.push(trail);
      run.end++;
    } else runs.push({ start: start + u, end: start + u + 1, rtl, carets: [lead, trail] });
  }
  // What's left of its characters (spaces it ends in, not drawn): after its last, where its last run ends.
  const last = runs[runs.length - 1];
  for (let at = start + drawn; at < end && last; at++) {
    last.carets.push(last.carets[last.carets.length - 1]);
    last.end++;
  }
  let from = drawn ? Infinity : box.x;
  let to = drawn ? -Infinity : box.x;
  for (let u = 0; u < drawn; u++) {
    from = Math.min(from, left(u), right(u));
    to = Math.max(to, left(u), right(u));
  }
  return {
    start,
    end,
    x: px(from),
    width: px(to - from),
    y: px(box.top),
    height: px(box.height),
    baseline: px(box.top + box.ascent),
    runs: runs.map((run) => ({ start: run.start, end: run.end, ...(run.rtl ? { rtl: true as const } : {}), carets: run.carets.map(px) })),
  };
}
