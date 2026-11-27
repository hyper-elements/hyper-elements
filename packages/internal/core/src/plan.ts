/**
 * A Document's pages as planned, as plain data that names no engine and no output:
 *
 * - Measured: what's measured of each block at its width (its box, and a block of text's lines with the characters
 *   each holds), in points. Made from an engine's layout (src/pdf/measure.ts) or by a measurer that doesn't draw.
 * - Plan: which part of which block goes on which page, each part of a block of text with its lines as measured
 *   (src/pdf/flow.ts makes it). The PDF writer paints a Plan, and so does the print HTML (`render(design, { plan })`):
 *   the same pages, each split text's lines as they were measured.
 */

/** A line of a block of text: its characters in the block's text, and where it is (from its page's top), in points. */
import type { ResolvedNode } from "./resolve";

export interface MeasuredLine {
  /** Its first character, and the character after its last; `next`, where the next line starts (after a line break that ends this one). */
  start: number;
  end: number;
  next: number;
  /** It ends in a word broken by a hyphen. */
  hyphenated: boolean;
  top: number;
  height: number;
  /** Room added to each space between its words, in points: less where its engine squeezed it into its box, more where it justified it. */
  wordSpacing: number;
}

/** A block of the design, measured at its width: its box from its page's top left, in points. */
export interface MeasuredBlock {
  path: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** A block of text's lines, where they match its text (a transform that changes its length leaves them out). */
  lines?: MeasuredLine[];
}

/** A page's blocks, measured, and the room its content has: below its header, above its footer. */
export interface MeasuredPage {
  room: { top: number; bottom: number };
  blocks: MeasuredBlock[];
}

/** A line of a block of text on a page, as measured: its characters in the block's text, its height, and its spacing. */
export interface PlannedLine {
  start: number;
  end: number;
  /** It ends in a word broken by a hyphen, which is drawn after it. */
  hyphenated: boolean;
  /** Room added to each space between its words, in points (less where it was squeezed into its box, more where justified). */
  wordSpacing: number;
  height: number;
}

/** A part of a block on a page: the whole block, or what of it fits there. */
export interface PlannedPart {
  path: string;
  /** Which part of its block, from 0: a block on one page is part 0. */
  part: number;
  /** Whether it has its block's top edge (its first part) and its bottom edge (its last). */
  first: boolean;
  last: boolean;
  /** A block of text's lines on this page, each as it was measured: drawn line by line, they can't break otherwise. */
  lines?: PlannedLine[];
  /** A stack's blocks (or a table's rows, or a Row's columns) on this page, each a part. */
  children?: PlannedPart[];
  /**
   * A Row's column with nothing on this page (it has ended, or starts on the next): it keeps its room across the Row,
   * so the others stay in their places, and draws nothing (no edge, no background). It isn't its block's first part or
   * its last, and carries the number its block's next part has.
   */
  empty?: boolean;
}

/** A page as planned: the page as written it goes on from (its paper, margins, background), and the parts on it. */
export interface PlannedPage {
  from: number;
  parts: PlannedPart[];
  /**
   * What's drawn on it, as a hash (its page model as painted: its content, header and footer with its numbers, its
   * paper): the same where nothing on it changed since the last plan, so a page view keeps the page it drew.
   */
  hash?: string;
}

export interface Plan {
  pages: PlannedPage[];
  /**
   * Where its page numbers were measured as the widest they get (a count of pages grown a digit since they were
   * written): each one written as this, a split text's lines cut where they were then. Else each page's numbers were
   * those of the page it was written on, of as many as were written.
   */
  numbers?: number;
  /**
   * Each text with a page number in its content, and the numbers it was measured with: the page it's on and the count
   * of pages, as they're drawn (so it's measured as wide as it's drawn). The print HTML cuts it where it was measured.
   */
  numbered?: Record<string, { number: number; total: number }>;
  /**
   * The Document it was planned from: a hash of it as laid out (designPrint()). render(design, { plan }) draws a plan
   * only for the Document it was made from, so a page view's plan a keystroke old isn't drawn against what's changed.
   */
  design?: string;
}

/** A 64-bit hash being made (two 32-bit FNV-1a lanes): text added piece by piece, read as hex. */
export function hasher(): { add(text: string): void; hex(): string } {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x9e3779b9;
  return {
    add(text: string) {
      for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        a = Math.imul(a ^ c, 0x01000193);
        b = Math.imul(b ^ c, 0x01000193) ^ (b >>> 15);
      }
      a = Math.imul(a ^ 0x1f, 0x01000193);
      b = Math.imul(b ^ 0x1f, 0x01000193);
    },
    hex: () => (a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0"),
  };
}

/**
 * A Document as laid out, as a hash: the same for the same design, different (all but certainly) for any change to its
 * nodes, their props, styles (inherited ones too), widths or text. 64 bits of FNV-1a, as hex.
 */
export function designPrint(root: ResolvedNode): string {
  const hash = hasher();
  const visit = (node: ResolvedNode | string) => {
    if (typeof node === "string") {
      hash.add(`"${node}`);
      return;
    }
    hash.add(node.type);
    hash.add(JSON.stringify(node.props));
    hash.add(JSON.stringify(node.style));
    // Its text styles as inherited (an alignment or a direction from above lays its text out).
    hash.add(JSON.stringify(node.text));
    if (node.hidden) hash.add(JSON.stringify(node.hidden));
    hash.add(String(node.width));
    hash.add(`(${node.children.length}`);
    node.children.forEach(visit);
  };
  visit(root);
  return hash.hex();
}

/** A part that's its block whole, as written. */
export const isWhole = (part: PlannedPart) => part.first && part.last && !part.lines && !part.children;
