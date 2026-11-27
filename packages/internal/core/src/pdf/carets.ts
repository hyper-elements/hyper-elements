/**
 * Where each character of a line of text is drawn: its left and right edge across the line, from textkit's laid-out line
 * (react-pdf's). What a caret is put by, and a selection drawn over: the same glyphs the PDF draws, at the advances it
 * draws them with.
 *
 * textkit hands a line over in the order it's drawn: its runs left to right, a run written right to left with its glyphs
 * and characters reversed (its bidi reordering). Each character is given back its place in the line's text, in the order
 * it's written: the runs put back in their order (the reordering undone), a reversed run's characters reversed again. A
 * glyph drawn for several characters (a ligature) is shared between them equally, as a browser shares it.
 */

/** A laid-out line, as textkit lays it out (the parts read here). */
export interface LaidOutLine {
  string: string;
  box: { x: number };
  runs: Array<{
    start: number;
    end: number;
    xAdvance?: number;
    attributes?: { bidiLevel?: number } & Record<string, unknown>;
    glyphs?: Array<{ codePoints?: number[] } | undefined>;
    positions?: Array<{ xAdvance: number }>;
  }>;
}

/** A line's characters' edges, in the order its text is written: each UTF-16 unit's. */
export interface LineEdges {
  /** How many UTF-16 units its text has. */
  length: number;
  /** Its text, in the order it's written (a bracket textkit mirrored, written right to left, as it's written). */
  text: string;
  /**
   * Its runs, in the order they're written: where each is in its text, whether it's written right to left, its
   * attributes (its style), and (`face`, where its measurer knows it) what its font draws.
   */
  runs: Array<{ start: number; end: number; rtl: boolean; attributes: Record<string, unknown>; face?: { family: string; weight: number; style: string } }>;
  /** Each unit's character's left and right edge, from the left of the line's box (where textkit sets it), in points: two a unit. */
  edges: Float32Array;
  /** 1 where a unit is written right to left. */
  rtl: Uint8Array;
}

/** The runs' indices in the order they're written, from the order they're drawn: UAX #9's rule L2 undone. */
function writtenOrder(levels: number[]): number[] {
  const order = levels.map((_, i) => i);
  const max = Math.max(0, ...levels);
  // L2 reverses each sequence at a level or above, from the highest level down to 1; each reversal undoes itself, and
  // the sequences are the same either way, so they're undone from 1 up.
  for (let level = 1; level <= max; level++) {
    let start = 0;
    while (start < order.length) {
      if (levels[order[start]] < level) {
        start++;
        continue;
      }
      let end = start + 1;
      while (end < order.length && levels[order[end]] >= level) end++;
      order.splice(start, end - start, ...order.slice(start, end).reverse());
      start = end;
    }
  }
  return order;
}

/** A line's characters' edges, in the order they're written; undefined where its glyphs don't account for its characters. */
export function lineEdges(line: LaidOutLine): LineEdges | undefined {
  const runs = line.runs;
  const lengths = runs.map((run) => run.end - run.start);
  const length = lengths.reduce((sum, n) => sum + n, 0);
  const levels = runs.map((run) => run.attributes?.bidiLevel ?? 0);
  // Where each run starts in the line's text, as it's written.
  const starts = new Array<number>(runs.length);
  let at = 0;
  for (const i of writtenOrder(levels)) {
    starts[i] = at;
    at += lengths[i];
  }
  const edges = new Float32Array(length * 2);
  const rtl = new Uint8Array(length);
  const written = new Array<string>(runs.length);
  let x = line.box.x;
  for (let r = 0; r < runs.length; r++) {
    const run = runs[r];
    // Its characters as drawn, each a code point with its UTF-16 length.
    const drawn = Array.from(line.string.slice(run.start, run.end));
    const left = new Float64Array(drawn.length);
    const right = new Float64Array(drawn.length);
    const glyphs = run.glyphs ?? [];
    const positions = run.positions ?? [];
    let advance = run.xAdvance;
    if (advance === undefined) advance = positions.reduce((sum, position) => sum + position.xAdvance, 0);
    let cursor = x;
    let next = 0;
    let shared = true;
    for (let g = 0; g < glyphs.length; g++) {
      const width = positions[g]?.xAdvance ?? 0;
      const count = glyphs[g]?.codePoints?.length ?? 0;
      if (count === 0) {
        // A glyph for no character of its own (a mark a font draws apart): its advance is its character's before it.
        if (next > 0) right[next - 1] += width;
      } else {
        for (let k = 0; k < count && next < drawn.length; k++, next++) {
          left[next] = cursor + (width * k) / count;
          right[next] = cursor + (width * (k + 1)) / count;
        }
        if (next === drawn.length && glyphs.slice(g + 1).some((glyph) => glyph?.codePoints?.length)) shared = false;
      }
      cursor += width;
    }
    if (next !== drawn.length || !shared) {
      // Glyphs that don't say which characters they're drawn for: the run shared between its characters.
      drawn.forEach((_, i) => {
        left[i] = x + (advance! * i) / drawn.length;
        right[i] = x + (advance! * (i + 1)) / drawn.length;
      });
    }
    const reversed = levels[r] % 2 === 1;
    // Its text as it's written: a reversed run reversed back, its brackets as written (textkit mirrors them).
    written[r] = reversed ? [...drawn].reverse().map((char) => MIRRORED[char] ?? char).join("") : drawn.join("");
    // Each character's place in the line's text: as drawn, or, in a reversed run, from its end.
    let unit = 0;
    drawn.forEach((char, i) => {
      const from = starts[r] + (reversed ? lengths[r] - unit - char.length : unit);
      for (let u = 0; u < char.length; u++) {
        edges[(from + u) * 2] = left[i];
        edges[(from + u) * 2 + 1] = right[i];
        rtl[from + u] = reversed ? 1 : 0;
      }
      unit += char.length;
    });
    x += advance;
  }
  const order = writtenOrder(levels);
  return {
    length,
    edges,
    rtl,
    text: order.map((r) => written[r]).join(""),
    runs: order.map((r) => ({ start: starts[r], end: starts[r] + lengths[r], rtl: levels[r] % 2 === 1, attributes: runs[r].attributes ?? {} })),
  };
}

/** The brackets textkit mirrors in text written right to left (its mirrorString), each to its pair. */
const MIRRORED: Record<string, string> = Object.fromEntries(
  [["(", ")"], ["[", "]"], ["{", "}"], ["<", ">"], ["«", "»"], ["‹", "›"], ["⁅", "⁆"], ["〈", "〉"], ["《", "》"], ["「", "」"], ["『", "』"]].flatMap(([a, b]) => [
    [a, b],
    [b, a],
  ])
);
