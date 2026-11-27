/**
 * A Document's print HTML pages as a Plan places its blocks (../../plan.ts), the same pages its PDF has: each planned
 * page's content as the nodes it shows, a part of a block cut between pages as a copy of it.
 *
 * - A stack's copy holds its blocks on that page, its top edge (padding, border, corners) on its first part only and
 *   its bottom edge on its last, with no set height. A list's goes on numbering where its last part stopped.
 * - A block of text's copy carries the lines it shows (`lines`), which its writer draws line by line, as measured
 *   (Text.tsx). A line's text is cut from the block's by character, counted as its PDF counts them (src/pdf/runs.ts):
 *   a line break, an image in a line and each character of a merge tag or a page number as written.
 * - The id of a block cut between pages is on its first part only.
 * - A Row's column with nothing on a page (it has ended, or starts on the next) is a copy of it with its place across the
 *   Row and nothing in it, so the others stay in their places.
 * - A part that goes on to the next page fills the rest of its page (`fills`), as its PDF's does (src/pdf/paint.ts): its
 *   background and side borders down to the room's foot. A table's doesn't, as its rows would be stretched with it.
 */
import { documentPages } from "../../document";
import type { Json } from "../../model";
import { isWhole, type Plan, type PlannedPart } from "../../plan";
import type { ResolvedNode } from "../../resolve";

export interface FlowedPage {
  /** The page as written it goes on from (a Document.Page, or a run a PageBreak ends), by its index. */
  from: number;
  content: ResolvedNode[];
}

const shown = (node: ResolvedNode) => !node.hidden?.desktop;

/** A Row's column's styles that place it across the Row (writers/page/layout.tsx's rowPlacement), all an empty part keeps. */
const PLACE = new Set(["width", "flex", "minWidth", "maxWidth"]);

function byPath(root: ResolvedNode): Map<string, ResolvedNode> {
  const out = new Map<string, ResolvedNode>();
  const visit = (node: ResolvedNode) => {
    out.set(node.path, node);
    for (const child of node.children) if (typeof child !== "string") visit(child);
  };
  visit(root);
  return out;
}

type Sides<T> = Partial<Record<"top" | "right" | "bottom" | "left", T>>;

/** A part's style: its top edge on its first part only, its bottom edge on its last, no set height on a part. */
function sliced(style: Record<string, Json>, first: boolean, last: boolean): Record<string, Json> {
  if (first && last) return style;
  const out: Record<string, Json> = { ...style };
  delete out.height;
  delete out.minHeight;
  delete out.maxHeight;
  const cut = (side: "top" | "bottom") => {
    if (out.padding && typeof out.padding === "object") out.padding = { ...(out.padding as Sides<number>), [side]: 0 } as Json;
    if (out.border && typeof out.border === "object") out.border = { ...(out.border as Sides<Json>), [side]: undefined } as Json;
    const corner = side === "top" ? ["topLeft", "topRight"] : ["bottomLeft", "bottomRight"];
    if (typeof out.borderRadius === "number") {
      const radius = out.borderRadius;
      out.borderRadius = { topLeft: radius, topRight: radius, bottomRight: radius, bottomLeft: radius };
    }
    if (out.borderRadius && typeof out.borderRadius === "object") out.borderRadius = { ...(out.borderRadius as Record<string, number>), [corner[0]]: 0, [corner[1]]: 0 };
  };
  if (!first) cut("top");
  if (!last) cut("bottom");
  return out;
}

/** The node a part shows: as written, or a copy of it with the part's blocks or lines; `page`, the numbers it was measured with. */
function copy(part: PlannedPart, nodes: ReadonlyMap<string, ResolvedNode>, page: { number: number; total: number }, numbered?: Plan["numbered"]): ResolvedNode | undefined {
  const node = nodes.get(part.path);
  if (!node || isWhole(part)) return node;
  // A Row's column with nothing on this page: its place across the Row (its width or share), and nothing drawn.
  if (part.empty) return { ...node, id: undefined, style: Object.fromEntries(Object.entries(node.style).filter(([key]) => PLACE.has(key))), children: [] };
  const base: ResolvedNode = { ...node, id: part.first ? node.id : undefined, style: sliced(node.style, part.first, part.last), ...(part.last || node.type === "Table" ? {} : { fills: true as const }) };
  // Its page numbers as it was measured with them: its own (Plan's `numbered`), else its page's.
  if (part.lines) return { ...base, flowed: { lines: part.lines, page: numbered?.[part.path] ?? page } };
  if (!part.children) return node;
  const children = part.children.map((child) => copy(child, nodes, page, numbered)).filter((child): child is ResolvedNode => child !== undefined);
  if (node.type === "List" && children.length) {
    // An ordered list goes on numbering from its first item on this page.
    const index = node.children.filter((child): child is ResolvedNode => typeof child !== "string" && shown(child)).findIndex((item) => item.path === children[0].path);
    if (index > 0) return { ...base, props: { ...node.props, start: Number(node.props.start ?? 1) + index }, children };
  }
  return { ...base, children };
}

/** A Document's pages as its plan places its blocks. */
export function flowedPages(root: ResolvedNode, plan: Plan): FlowedPage[] {
  const nodes = byPath(root);
  // The numbers each page as written was measured with: its own, of as many as were written.
  const total = documentPages(root).pages.length;
  return plan.pages.map(({ from, parts }) => {
    const numbers = plan.numbers === undefined ? { number: from + 1, total } : { number: plan.numbers, total: plan.numbers };
    return { from, content: parts.map((part) => copy(part, nodes, numbers, plan.numbered)).filter((node): node is ResolvedNode => node !== undefined) };
  });
}

/** How many characters a run counts for, as the PDF counts them; `numbers`, the page numbers it was measured with. */
function lengthOf(child: ResolvedNode | string, numbers: { number: number; total: number }): number {
  if (typeof child === "string") return child.length;
  if (!shown(child)) return 0;
  switch (child.type) {
    case "LineBreak":
    case "Image":
      return 1;
    case "MergeTag":
      return `{{${child.props.name}}}`.length;
    case "PageNumber":
      return String(child.props.total ? numbers.total : numbers.number).length;
    default:
      return child.children.reduce((sum: number, run) => sum + lengthOf(run, numbers), 0);
  }
}

/**
 * A block of text's runs between two of its characters: strings cut, a Span or a Link kept around its part, a run
 * that counts as one piece (a line break, an image, a merge tag, a page number) in or out whole.
 */
export function runsBetween(children: Array<ResolvedNode | string>, from: number, to: number, numbers: { number: number; total: number }): Array<ResolvedNode | string> {
  const out: Array<ResolvedNode | string> = [];
  let at = 0;
  for (const child of children) {
    const length = lengthOf(child, numbers);
    const start = at;
    at += length;
    if (at <= from || start >= to || !length) continue;
    if (typeof child === "string") out.push(child.slice(Math.max(0, from - start), to - start));
    else if (child.type === "LineBreak" || child.type === "Image" || child.type === "MergeTag" || child.type === "PageNumber") out.push(child);
    else out.push({ ...child, children: runsBetween(child.children, Math.max(0, from - start), to - start, numbers) });
  }
  return out;
}
