/**
 * A block of text split between two of its lines, where a page ends: its runs cut at a character, from the lines the
 * engine laid out. The engine reports each line's characters, less the block's line breaks and with a hyphen where a
 * word is broken; they're matched against the runs' own text, and where they don't match (a transform that changes the
 * text's length, a run the engine draws otherwise) the block isn't split. A line with words written right to left is
 * reported as it's drawn, its characters in the order they're seen and its brackets mirrored: it's matched by its
 * characters, in any order.
 */
import type { Run, Style } from "./model";

/** What an image in a line counts as: one character, the object replacement character, as the engine lays it out. */
const OBJECT = "￼";

/** A letter of a script written right to left: Hebrew, Arabic, Syriac, Thaana, N'Ko and the rest to U+08FF, their presentation forms, and those past U+FFFF. */
export const RIGHT_TO_LEFT = /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufeff\u{10800}-\u{10fff}\u{1e800}-\u{1efff}]/u;

/** A run's text as the engine lays it out, with its transform (inherited from `transform`, the run's own over it). */
function textOf(runs: Run[], transform: unknown, out: string[]): void {
  for (const run of runs) {
    if (typeof run === "string") out.push(transformed(run, transform));
    else if (run.kind === "image") out.push(OBJECT);
    else textOf(run.runs, (run.style as Style).textTransform ?? transform, out);
  }
}

function transformed(text: string, transform: unknown): string {
  switch (transform) {
    case "uppercase":
      return text.toUpperCase();
    case "lowercase":
      return text.toLowerCase();
    case "capitalize":
      return text.replace(/(^|\s)(\S)/g, (_, space: string, letter: string) => space + letter.toUpperCase());
    default:
      return text;
  }
}

/** The runs' text, transformed as drawn: undefined where a transform changes its length, so offsets can't be matched. */
export function runsText(runs: Run[], style: Style): string | undefined {
  const out: string[] = [];
  textOf(runs, style.textTransform, out);
  const drawn = out.join("");
  const plain: string[] = [];
  textOf(runs, undefined, plain);
  return drawn.length === plain.join("").length ? drawn : undefined;
}

/**
 * Where a line ends in the text (after its last character), where the next starts (after a line break that ends it),
 * and whether it ends in a word broken by a hyphen.
 */
export interface LineEnd {
  end: number;
  next: number;
  hyphenated: boolean;
}

/** A bracket as one of its pair: a right-to-left run's are drawn mirrored. */
const PAIRS: Record<string, string> = { ")": "(", "]": "[", "}": "{", ">": "<", "»": "«", "›": "‹", "⁆": "⁅", "〉": "〈", "》": "《", "」": "「", "』": "『" };

/** Whether two texts have the same characters, in any order, a bracket as either of its pair. */
function sameCharacters(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const counts = new Map<string, number>();
  for (const char of a) counts.set(PAIRS[char] ?? char, (counts.get(PAIRS[char] ?? char) ?? 0) + 1);
  for (const char of b) {
    const key = PAIRS[char] ?? char;
    const count = counts.get(key);
    if (!count) return false;
    counts.set(key, count - 1);
  }
  return true;
}

/** Each line's end in `text`, from the lines' characters as laid out; undefined where they don't match it. */
export function lineEnds(text: string, lines: readonly string[]): LineEnd[] | undefined {
  const ends: LineEnd[] = [];
  let at = 0;
  for (const line of lines) {
    let hyphenated = false;
    let length = line.length;
    if (text.startsWith(line, at)) {
      // As laid out.
    } else if (line.endsWith("-") && text.startsWith(line.slice(0, -1), at)) {
      hyphenated = true;
      length -= 1;
    } else if (RIGHT_TO_LEFT.test(text.slice(at, at + length)) && sameCharacters(line, text.slice(at, at + length))) {
      // Its words reordered, as drawn.
    } else if (line.includes("-") && RIGHT_TO_LEFT.test(text.slice(at, at + length - 1)) && sameCharacters(line.replace("-", ""), text.slice(at, at + length - 1))) {
      hyphenated = true;
      length -= 1;
    } else return undefined;
    at += length;
    const end = at;
    // A line break ends the line it's in, and isn't in any line.
    if (text[at] === "\n") at += 1;
    ends.push({ end, next: at, hyphenated });
  }
  return at === text.length ? ends : undefined;
}

/** The runs cut at a character of their text: what's before it and what's from it on, each run's style kept on both sides. */
export function splitRuns(runs: Run[], at: number): [Run[], Run[]] {
  const before: Run[] = [];
  const after: Run[] = [];
  let seen = 0;
  for (const run of runs) {
    const length = lengthOf(run);
    if (seen + length <= at) before.push(run);
    else if (seen >= at) after.push(run);
    else if (typeof run === "string") {
      before.push(run.slice(0, at - seen));
      after.push(run.slice(at - seen));
    } else if (run.kind !== "image") {
      const [left, right] = splitRuns(run.runs, at - seen);
      before.push({ ...run, runs: left });
      after.push({ ...run, runs: right });
    }
    seen += length;
  }
  return [before, after];
}

const lengthOf = (run: Run): number => (typeof run === "string" ? run.length : run.kind === "image" ? 1 : run.runs.reduce((sum, child) => sum + lengthOf(child), 0));
