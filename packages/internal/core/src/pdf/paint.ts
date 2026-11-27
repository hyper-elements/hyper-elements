/**
 * A Plan's page as blocks to draw (model.ts): each part of a block as the page shows it. A block on one page is drawn
 * as written. A stack that's cut has its top edge (padding, border, corners) on its first part only, its bottom edge on
 * its last, and no set height. A block of text that's cut is drawn line by line, each line as it was measured: its
 * characters, and the room its spaces between words were given (squeezed into its box, or justified), so the engine
 * draws it where it was and can't break its lines otherwise.
 *
 * A Row's column with nothing on a page (it has ended, or starts on the next) is drawn as its width, empty.
 *
 * A part that goes on to the next page fills the rest of its page, as a box broken between pages does in a browser: its
 * background and side borders down to the room's foot (grown down its stack, or stretched across its Row). A table
 * doesn't: its rows would be stretched with it in the print HTML, which a browser draws as a table.
 */
import type { Block, Run, Style } from "./model";
import { isWhole, type PlannedLine, type PlannedPart } from "../plan";
import { runsText, splitRuns } from "./runs";

const TOP = ["paddingTop", "borderTopWidth", "borderTopStyle", "borderTopColor", "borderTopLeftRadius", "borderTopRightRadius"];
const BOTTOM = ["paddingBottom", "borderBottomWidth", "borderBottomStyle", "borderBottomColor", "borderBottomLeftRadius", "borderBottomRightRadius"];

/** A part of a block's style: its top edge on its first part only, its bottom edge on its last, no set height on a part. */
export function slice(style: Style, first: boolean, last: boolean): Style {
  if (first && last) return style;
  const out: Style = { ...style };
  delete out.height;
  delete out.minHeight;
  delete out.maxHeight;
  if (style.borderRadius !== undefined) {
    // A corner radius set for all four: kept where the part has the corner.
    const radius = style.borderRadius;
    delete out.borderRadius;
    if (first) Object.assign(out, { borderTopLeftRadius: radius, borderTopRightRadius: radius });
    if (last) Object.assign(out, { borderBottomLeftRadius: radius, borderBottomRightRadius: radius });
  }
  if (!first) for (const key of TOP) delete out[key];
  if (!last) for (const key of BOTTOM) delete out[key];
  return out;
}

/**
 * Room past a line's box, on the side away from where it's aligned, so a line drawn on its own is never broken again
 * (a space's width rounded, a glyph its engine draws a hair wider): its text stays where its alignment puts it.
 */
const BEYOND = 10000;
const unbounded = (align: unknown): Style =>
  align === "right" ? { marginLeft: -BEYOND } : align === "center" ? { marginLeft: -BEYOND, marginRight: -BEYOND } : { marginRight: -BEYOND };

/** A line's runs ending in a hyphen, in its last run's style: a line that ends in a word broken across lines. */
function withHyphen(runs: Run[]): Run[] {
  const out = [...runs];
  const last = out[out.length - 1];
  if (typeof last === "string" || last === undefined) out.push("-");
  else if (last.kind === "image") out.push("-");
  else out[out.length - 1] = { ...last, runs: withHyphen(last.runs) };
  return out;
}

/** A line's runs with each space between its words given `spacing` more room (its letter spacing). */
function spaced(runs: Run[], spacing: number): Run[] {
  if (!spacing) return runs;
  return runs.flatMap((run): Run[] => {
    if (typeof run === "string") return run.split(/( )/).filter(Boolean).map((piece): Run => (piece === " " ? { kind: "span", style: { letterSpacing: spacing }, runs: [" "] } : piece));
    if (run.kind === "image") return [run];
    return [{ ...run, runs: spaced(run.runs, spacing) }];
  });
}

/** The runs between two characters of their text. */
const runsBetween = (runs: Run[], from: number, to: number): Run[] => splitRuns(splitRuns(runs, to)[0], from)[1];

const lengthOf = (run: Run): number => (typeof run === "string" ? run.length : run.kind === "image" ? 1 : run.runs.reduce((sum, child) => sum + lengthOf(child), 0));

/**
 * A text's runs cut into its lines' (each from its start up to its end, in order), each with the character after it
 * (`next()`: an empty line's line break): one pass through them, each run cut where a line starts or ends in it, not
 * the whole text for each line.
 */
function linesOf(runs: Run[], lines: readonly PlannedLine[]): Array<{ cut: Run[]; next: () => Run[] }> {
  const lengths = runs.map(lengthOf);
  let i = 0;
  // Where the pass is: its run, and how far into it; and how far into the text.
  let into = 0;
  let at = 0;
  const to = (target: number, take?: Run[]) => {
    while (at < target && i < runs.length) {
      const left = lengths[i] - into;
      const step = Math.min(left, target - at);
      if (take && step > 0) {
        const run = runs[i];
        if (typeof run === "string") take.push(run.slice(into, into + step));
        else if (run.kind === "image") take.push(run);
        else take.push({ ...run, runs: runsBetween(run.runs, into, into + step) });
      }
      at += step;
      into += step;
      if (into >= lengths[i]) {
        i++;
        into = 0;
      }
    }
  };
  // The character at a place in the pass (its run, how far into it), as runs: none at the text's end.
  const here = (run: number, into: number): Run[] => {
    while (run < runs.length && into >= lengths[run]) [run, into] = [run + 1, 0];
    const found = runs[run];
    if (found === undefined) return [];
    return [typeof found === "string" ? found.slice(into, into + 1) : found.kind === "image" ? found : { ...found, runs: runsBetween(found.runs, into, into + 1) }];
  };
  return lines.map((line) => {
    to(line.start);
    const cut: Run[] = [];
    to(line.end, cut);
    const [run, offset] = [i, into];
    return { cut, next: () => here(run, offset) };
  });
}

/** A line break (its runs) as a space, in its style: an empty line's height. A space where it isn't one. */
function breakAsSpace(runs: Run[]): Run[] {
  const swap = (run: Run): Run => (typeof run === "string" ? run.replace(/\n/g, " ") : run.kind === "image" ? run : { ...run, runs: run.runs.map(swap) });
  const found = runs.map(swap);
  const blank = (run: Run): boolean => (typeof run === "string" ? run === " " : run.kind !== "image" && run.runs.every(blank));
  return found.length && found.every(blank) ? found : [" "];
}

/** The runs less the spaces they end in: a line's trailing space, which takes no room where it ends a line. */
function trimEnd(runs: Run[]): Run[] {
  const out = [...runs];
  while (out.length) {
    const last = out[out.length - 1];
    if (typeof last === "string") {
      const trimmed = last.replace(/[ \t]+$/, "");
      if (trimmed) {
        out[out.length - 1] = trimmed;
        return out;
      }
      out.pop();
    } else if (last.kind === "image") return out;
    else {
      const inner = trimEnd(last.runs);
      if (inner.length) {
        out[out.length - 1] = { ...last, runs: inner };
        return out;
      }
      out.pop();
    }
  }
  return out;
}

/** A part that goes on to the next page, filling the rest of its page: down its stack, or across its Row (`inRow`). */
function filling(block: Block, inRow: boolean): Block {
  if (!("style" in block)) return block;
  return { ...block, style: { ...block.style, ...(inRow ? { alignSelf: "stretch" } : { flexGrow: 1 }) } } as Block;
}

export class Painter {
  /** `blocks`: the page as written, each block by its path. */
  constructor(private readonly blocks: ReadonlyMap<string, Block>) {}

  /** A part as it's drawn on its page; `inRow`, where it's in a Row's part, beside the others. */
  part(part: PlannedPart, inRow = false): Block {
    const block = this.blocks.get(part.path)!;
    // A Row's column with nothing on this page: its width, so the others stay in their places, and nothing drawn.
    if (part.empty) return { kind: "box", style: { width: "style" in block ? block.style.width : undefined, flexShrink: 0, flexGrow: 0 }, children: [] };
    if (isWhole(part)) return block;
    const painted = this.painted(part, block);
    return part.last || (block.kind === "box" && block.splits === "rows") ? painted : filling(painted, inRow);
  }

  private painted(part: PlannedPart, block: Block): Block {
    if (part.lines && block.kind === "text") {
      const { lines } = part;
      const justified = block.style.textAlign === "justify";
      const rtl = block.style.direction === "rtl";
      // Where a line written right to left is a paragraph's last (its block's, or one a line break ends).
      const text = justified && rtl ? runsText(block.runs, block.style) : undefined;
      // Its lines one under another, each as measured. Its text style is the box's, which they take, and its direction,
      // which react-pdf hands down to nothing. A justified block's lines are as wide as its spacing makes them, each set
      // from its start (its right, written right to left) but a paragraph's last, set from its left as react-pdf sets it.
      const styleOf = (line: PlannedLine, i: number): Style => {
        const last = (part.last && i === lines.length - 1) || text?.[line.end] === "\n";
        const align = justified ? (rtl && !last ? "right" : "left") : block.style.textAlign;
        return { ...unbounded(align), ...(justified ? { textAlign: align } : {}), ...(rtl ? { direction: "rtl" } : {}) };
      };
      return {
        kind: "box",
        path: part.path,
        style: { ...slice(block.style, part.first, part.last), flexDirection: "column" },
        children: linesOf(block.runs, lines).map(({ cut, next }, i): Block => {
          const line = lines[i];
          const runs = trimEnd(cut);
          // A line with nothing drawn in it (between two line breaks, or spaces only): its spaces as they are, or, with
          // none, the line break after it as a space, as tall as it was measured and in the paragraph's room (spaces don't
          // wrap): laid out as the paragraph lays it out, its carets where they are there. With no text, the engine would
          // lay out no line: drawn 0 tall, and no line for its carets.
          if (!runs.length) {
            const { marginLeft, marginRight, ...style } = styleOf(line, i);
            return { kind: "text", of: part.path, style: { ...style, height: line.height }, runs: cut.length ? cut : breakAsSpace(next()) };
          }
          return { kind: "text", of: part.path, style: styleOf(line, i), runs: spaced(line.hyphenated ? withHyphen(runs) : runs, line.wordSpacing) };
        }),
      };
    }
    if (part.children && block.kind === "box") {
      const inRow = block.style.flexDirection === "row";
      return { ...block, style: slice(block.style, part.first, part.last), children: part.children.map((child) => this.part(child, inRow)) };
    }
    return block;
  }
}
