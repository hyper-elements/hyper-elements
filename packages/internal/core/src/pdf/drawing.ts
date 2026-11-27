/**
 * A page drawn from where the measurer laid out each of its blocks (PlacedPage's `frames`), as its PDF draws it: each
 * box's background and borders, each image and drawing, each line's words where its characters are, in what's left of
 * the page's room. As plain data, in points from the page's top left: an output draws it (the /pdf entry's SVG), and
 * nothing is laid out again, so it's where the PDF has it.
 */
import type { Block, Page, PlacedFrame, PlacedPage, Shape, Style } from "./model";

/** A side of a box's border. */
export interface DrawnSide {
  width: number;
  color: string;
  style: string;
}

/** A word of a line, where its characters are drawn: from the left of its leftmost, as wide as they are. */
export interface DrawnWord {
  x: number;
  width: number;
  text: string;
  /** Written right to left: drawn from its right. */
  rtl: boolean;
}

export type Drawn =
  | { kind: "rect"; x: number; y: number; width: number; height: number; fill?: string; radius?: [number, number, number, number]; border?: Partial<Record<"top" | "right" | "bottom" | "left", DrawnSide>> }
  /** An image: `bottom`, fitted inside its box on its bottom edge (one in a line of text, on its baseline). */
  | { kind: "image"; x: number; y: number; width: number; height: number; src: string; fit: "fill" | "cover" | "contain"; bottom?: boolean }
  | { kind: "drawing"; x: number; y: number; width: number; height: number; viewBox: string; shapes: Shape[] }
  /**
   * A run of a line's words, in one font, from its baseline. `family` as the page model names it (a given family's,
   * lowercased, or a standard PDF font's); `spacing`, what's added after each of its characters (its letter spacing).
   */
  | { kind: "words"; baseline: number; family: string; weight: number; style: string; size: number; color: string; opacity?: number; spacing?: number; words: DrawnWord[] }
  /** What's drawn inside a box that cuts off what's past it: its items, cut to it. */
  | { kind: "clip"; x: number; y: number; width: number; height: number; items: Drawn[] };

const number = (value: unknown): number => (typeof value === "number" ? value : 0);
const SIDES = ["top", "right", "bottom", "left"] as const;

/** A box's background and border, where it has either. */
function rect(frame: PlacedFrame): Drawn | undefined {
  const style = frame.style;
  const border: NonNullable<Extract<Drawn, { kind: "rect" }>["border"]> = {};
  for (const side of SIDES) {
    const name = side[0].toUpperCase() + side.slice(1);
    const width = number(style[`border${name}Width`]);
    if (width > 0) border[side] = { width, color: String(style[`border${name}Color`] ?? "black"), style: String(style[`border${name}Style`] ?? "solid") };
  }
  const fill = typeof style.backgroundColor === "string" && style.backgroundColor !== "transparent" ? style.backgroundColor : undefined;
  if (!fill && !Object.keys(border).length) return undefined;
  const all = number(style.borderRadius);
  // Each corner no rounder than half the box across and half down, as react-pdf draws it (a pill's 999).
  const corner = (r: number) => Math.min(r, 0.5 * frame.width, 0.5 * frame.height);
  const radius: [number, number, number, number] = [
    corner(number(style.borderTopLeftRadius) || all),
    corner(number(style.borderTopRightRadius) || all),
    corner(number(style.borderBottomRightRadius) || all),
    corner(number(style.borderBottomLeftRadius) || all),
  ];
  return {
    kind: "rect",
    x: frame.x,
    y: frame.y,
    width: frame.width,
    height: frame.height,
    ...(fill ? { fill } : {}),
    ...(radius.some(Boolean) ? { radius } : {}),
    ...(Object.keys(border).length ? { border } : {}),
  };
}

/** A block of text's lines: each run's words where its characters are, its runs' backgrounds, its underlines. */
function lines(frame: PlacedFrame, out: Drawn[]): void {
  for (const line of frame.boxes ?? []) {
    const edges = line.edges;
    if (!edges) continue;
    const left = (u: number) => line.x + edges.edges[u * 2];
    const right = (u: number) => line.x + edges.edges[u * 2 + 1];
    const across = (from: number, to: number) => {
      let a = Infinity;
      let b = -Infinity;
      for (let u = from; u < to; u++) {
        a = Math.min(a, left(u), right(u));
        b = Math.max(b, left(u), right(u));
      }
      return { x: a, width: b - a };
    };
    for (const run of edges.runs) {
      const attributes = run.attributes;
      if (run.end <= run.start) continue;
      if (typeof attributes.backgroundColor === "string") out.push({ kind: "rect", ...across(run.start, run.end), y: line.top, height: line.height, fill: attributes.backgroundColor });
      const size = number(attributes.fontSize) || 18;
      // A run raised or lowered (super or sub): its baseline by its yOffset, a share of its size.
      const baseline = line.top + line.ascent - number(attributes.yOffset) * size;
      // An image in the line (its object replacement character): as react-pdf draws one (renderAttachment), its box's
      // right at its character's, on the baseline, the image fitted inside it on its bottom edge. Before its words.
      const attachment = attributes.attachment as { width?: number; height?: number; src?: string } | undefined;
      if (attachment?.src) {
        for (let u = run.start; u < run.end; u++) {
          if (edges.text[u] !== "\ufffc") continue;
          const width = number(attachment.width);
          const height = number(attachment.height);
          out.push({ kind: "image", x: Math.max(left(u), right(u)) - width, y: baseline - height, width, height, src: attachment.src, fit: "contain", bottom: true });
        }
      }
      const words: DrawnWord[] = [];
      let start = run.start;
      for (let u = run.start; u <= run.end; u++) {
        // Words are between spaces (and an image in the line, its object replacement character, not drawn here).
        const space = u < run.end && (edges.text[u] === " " || edges.text[u] === "\t" || edges.text[u] === "\ufffc");
        if (u === run.end || space) {
          if (u > start) words.push({ ...across(start, u), text: edges.text.slice(start, u), rtl: run.rtl });
          start = u + 1;
        }
      }
      if (!words.length) continue;
      const spacing = number(attributes.characterSpacing);
      // The font textkit chose for it (its style's, or the fallback a character takes): its face.
      const face = run.face ?? { family: "Helvetica", weight: 400, style: "normal" };
      const opacity = typeof attributes.opacity === "number" ? attributes.opacity : undefined;
      out.push({
        kind: "words",
        baseline,
        family: face.family,
        weight: face.weight,
        style: face.style,
        size,
        color: String(attributes.color ?? "black"),
        ...(opacity !== undefined ? { opacity } : {}),
        ...(spacing ? { spacing } : {}),
        words,
      });
    }
    for (const decoration of line.decorations ?? []) out.push({ kind: "rect", x: line.x + decoration.x, y: line.top + decoration.y, width: decoration.width, height: decoration.height, fill: decoration.color });
  }
}

/** How an image fills its box: as its style says (cover, contain), else stretched to it. */
const fitOf = (style: Style): "fill" | "cover" | "contain" => (style.objectFit === "cover" ? "cover" : style.objectFit === "contain" ? "contain" : "fill");

/** A page's blocks drawn, each where it was laid out; undefined where it wasn't measured without drawing (no frames). */
export function drawPage(page: Page, placed: PlacedPage): Drawn[] | undefined {
  if (!placed.frames) return undefined;
  const frames = new Map(placed.frames.map((frame) => [frame.block, frame]));
  const draw = (block: Block, out: Drawn[]) => {
    const frame = frames.get(block);
    if (!frame) return;
    const box = rect(frame);
    if (box) out.push(box);
    const style = frame.style;
    const inner = {
      x: frame.x + number(style.paddingLeft) + number(style.borderLeftWidth),
      y: frame.y + number(style.paddingTop) + number(style.borderTopWidth),
      width: frame.width - number(style.paddingLeft) - number(style.paddingRight) - number(style.borderLeftWidth) - number(style.borderRightWidth),
      height: frame.height - number(style.paddingTop) - number(style.paddingBottom) - number(style.borderTopWidth) - number(style.borderBottomWidth),
    };
    switch (block.kind) {
      case "text":
        lines(frame, out);
        return;
      case "image":
        out.push({ kind: "image", ...inner, src: block.src, fit: fitOf(style) });
        return;
      case "drawing":
        out.push({ kind: "drawing", x: inner.x, y: inner.y, width: block.width, height: block.height, viewBox: block.viewBox, shapes: block.shapes });
        return;
      case "box":
      case "link": {
        // What's in a box that cuts off what's past it (an image's, set to cover it), cut to it.
        if (style.overflow === "hidden") {
          const items: Drawn[] = [];
          block.children.forEach((child) => draw(child, items));
          out.push({ kind: "clip", x: frame.x, y: frame.y, width: frame.width, height: frame.height, items });
        } else block.children.forEach((child) => draw(child, out));
      }
    }
  };
  const out: Drawn[] = [];
  if (page.background) out.push({ kind: "rect", x: 0, y: 0, width: page.width, height: page.height, fill: page.background });
  // Inside its margins, its header, its content cut to its room, its footer (react-pdf.tsx draws the page so).
  const margins = { x: page.margin.left, y: page.margin.top, width: page.width - page.margin.left - page.margin.right, height: page.contentHeight };
  const inside: Drawn[] = [];
  if (page.header) draw(page.header, inside);
  const content: Drawn[] = [];
  page.content.forEach((block) => draw(block, content));
  inside.push({ kind: "clip", x: margins.x, y: placed.room.top, width: margins.width, height: placed.room.bottom - placed.room.top, items: content });
  if (page.footer) draw(page.footer, inside);
  out.push({ kind: "clip", ...margins, items: inside });
  return out;
}
