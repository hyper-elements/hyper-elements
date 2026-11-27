/**
 * A Document as an engine laid it out, as Measured (../plan.ts): each block's box, and each block of text's lines
 * matched to its text. Read from where the engine placed each block once drawn (model.ts's PlacedPage).
 */
import type { MeasuredBlock, MeasuredPage } from "../plan";
import type { Block, DrawnDocument, PlacedPage } from "./model";
import { lineEnds, runsText } from "./runs";

/** A length to a thousandth of a point (no negative zero). */
const thousandth = (points: number) => Math.round(points * 1000) / 1000 || 0;

/** Each block of a page, by its path: its content, header and footer, and what's in them. */
export function blocksOf(page: DrawnDocument["pages"][number]): Map<string, Block> {
  const out = new Map<string, Block>();
  const visit = (block: Block) => {
    if (block.path !== undefined) out.set(block.path, block);
    if (block.kind === "box" || block.kind === "link") block.children.forEach(visit);
  };
  [page.header, ...page.content, page.footer].forEach((block) => block && visit(block));
  return out;
}

/**
 * A document as an engine laid it out, as Measured: each block's box, and each block of text's lines matched to its
 * text (the engine reports each line's characters, less line breaks, with a hyphen where a word is broken).
 */
export function measure(document: DrawnDocument, placed: PlacedPage[]): MeasuredPage[] {
  return placed.map(({ room, blocks }, i) => {
    const written = document.pages[i] ? blocksOf(document.pages[i]) : new Map<string, Block>();
    return {
      room,
      blocks: blocks.map(({ path, x, y, width, height, lines }): MeasuredBlock => {
        const block = written.get(path);
        const out: MeasuredBlock = { path, x, y, width, height };
        if (lines?.length && block?.kind === "text") {
          const text = runsText(block.runs, block.style);
          const ends = text === undefined ? undefined : lineEnds(text, lines.map((line) => line.text));
          const justified = block.style.textAlign === "justify";
          if (ends && text !== undefined) {
            out.lines = ends.map((end, j) => {
              const line = lines[j];
              const start = j === 0 ? 0 : ends[j - 1].next;
              // Its spaces between words, less one it ends in (from its text: a line written right to left is reported
              // in the order it's drawn, where the space it ends in comes first).
              const between = (text.slice(start, end.end).trimEnd().match(/ /g) ?? []).length;
              // Squeezed where its glyphs are wider than its room; justified to fill it but at a paragraph's end.
              const last = j === ends.length - 1 || end.next > end.end;
              const spacing = !between ? 0 : line.natural > line.width + 0.01 || (justified && !last) ? (line.width - line.natural) / between : 0;
              // To a thousandth of a point: what's measured with or without drawing is the same (react-pdf's flexbox holds
              // a width in 32-bit floats), and a plan comes out the same wherever it's made.
              return { start, end: end.end, next: end.next, hyphenated: end.hyphenated, top: line.top, height: thousandth(line.height), wordSpacing: thousandth(spacing) };
            });
          }
        }
        return out;
      }),
    };
  });
}
