/**
 * Where a caret goes on a Document's pages, and what a selection covers, from its layout with its lines (a paginator's
 * `paginate(design, { layout: true })`): the same characters, where its PDF draws them. Plain functions of the layout,
 * which is plain data: a page view can paginate in a Worker and hit-test on its own thread.
 *
 * A caret is a node's path and an offset in its text (DocumentNode's `text`, in UTF-16 code units). Where an offset is
 * in two places (the end of a line and the start of the next, or where text written one way meets text written the
 * other), `affinity` says which: "after" (by default) the place of the characters after it, "before" the place of those
 * before it.
 */
import type { DocumentLayout, DocumentNode } from "./layout";
import type { DocumentLine, DocumentRun } from "./lines";

/** A place on a page, in px from its top left; `page` from 1. */
export interface PagePoint {
  page: number;
  x: number;
  y: number;
}

/** A caret: a node's path and an offset in its text. */
export interface Caret {
  path: string;
  offset: number;
}

export interface CaretOptions extends Caret {
  /** Where an offset is in two places, which: the place of what's after it (by default), or of what's before it. */
  affinity?: "before" | "after";
  /** A node on every page (in a PageHeader or a PageFooter): its caret on this page (from 1). */
  page?: number;
}

/** Where a caret is drawn: a line `height` tall, from (`x`, `y`) on `page`, in px. */
export interface CaretBox {
  page: number;
  x: number;
  y: number;
  height: number;
}

/** What a selection covers on a line: a box on `page`, in px. */
export interface SelectionBox {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

const lined = (node: DocumentNode): node is DocumentNode & { lineBoxes: DocumentLine[] } => node.lineBoxes !== undefined && node.lineBoxes.length > 0;

/** A layout laid out for some pages only (a paginator's `layout: { pages }`) has no nodes on the others: asked of one, it says so. */
function laidOut(layout: DocumentLayout, page: number): void {
  if (layout.only && !layout.only.includes(page)) throw new Error(`[Elements] This layout has pages ${layout.only.join(", ")} only, not page ${page}: paginate with layout: { pages: [${page}] }`);
}

/** A caret found at a place on a page: on its page, with the affinity that puts it there (caretBox() of it is where it was found). */
export interface CaretHit extends Caret {
  page: number;
  affinity: "before" | "after";
}

/**
 * The caret nearest a place on a page: in the line it's on (or the nearest), at the nearest edge between characters.
 * Its `affinity` is the side it was found on, where its offset is in two places (the end of a line and the start of the
 * next, or where text written one way meets text written the other): caretBox() of it is where it was found.
 */
export function caretAt(layout: DocumentLayout, point: PagePoint): CaretHit | undefined {
  laidOut(layout, point.page);
  const nodes = layout.nodes.filter((node) => node.page === point.page && lined(node)) as Array<DocumentNode & { lineBoxes: DocumentLine[] }>;
  if (!nodes.length) return undefined;
  // In a node whose box holds the place (or one of its lines: an empty block of text's is taller than its box), the
  // innermost; else any on its page. Of two as near, the first.
  const holds = (x: number, y: number, width: number, height: number) => point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height;
  const holding = nodes.filter((node) => holds(node.x, node.y, node.width, node.height) || node.lineBoxes.some((line) => holds(line.x, line.y, line.width, line.height)));
  const candidates = holding.length ? holding : nodes;
  let best: { node: DocumentNode; line: DocumentLine; down: number; across: number } | undefined;
  for (const node of candidates) {
    for (const line of node.lineBoxes) {
      const down = point.y < line.y ? line.y - point.y : point.y > line.y + line.height ? point.y - line.y - line.height : 0;
      const across = point.x < line.x ? line.x - point.x : point.x > line.x + line.width ? point.x - line.x - line.width : 0;
      if (!best || down < best.down || (down === best.down && across < best.across)) best = { node, line, down, across };
    }
  }
  if (!best) return undefined;
  const { node, line } = best;
  let offset = line.start;
  let distance = Infinity;
  let x = line.x;
  for (const run of line.runs) {
    run.carets.forEach((at, i) => {
      const d = Math.abs(at - point.x);
      // The nearest; of two as near, the first (an offset inside a character has its character's caret).
      if (d < distance - 1e-9) {
        distance = d;
        offset = run.start + i;
        x = at;
      }
    });
  }
  // Its side: where caretBox() puts it, on this line at this place ("after" where either does).
  const hit = { path: node.path, offset, page: point.page };
  const there = (affinity: "before" | "after") => {
    const box = caretBox(layout, { ...hit, affinity });
    return box !== undefined && box.y === line.y && Math.abs(box.x - x) < 0.01;
  };
  return { ...hit, affinity: there("after") || !there("before") ? "after" : "before" };
}

/** The run of a line an offset is in, by its affinity where it's at a run's edge. */
function runOf(line: DocumentLine, offset: number, affinity: "before" | "after"): DocumentRun | undefined {
  const runs = line.runs.filter((run) => offset >= run.start && offset <= run.end);
  if (affinity === "after") return runs.find((run) => offset < run.end) ?? runs[runs.length - 1];
  return runs.find((run) => offset > run.start) ?? runs[0];
}

/** Where a caret is drawn; undefined where its node or its offset isn't on a page (or its text isn't laid out by line). */
export function caretBox(layout: DocumentLayout, caret: CaretOptions): CaretBox | undefined {
  if (caret.page !== undefined) laidOut(layout, caret.page);
  const affinity = caret.affinity ?? "after";
  const found: Array<{ node: DocumentNode; line: DocumentLine }> = [];
  for (const node of layout.nodes) {
    if (node.path !== caret.path || (caret.page !== undefined && node.page !== caret.page) || !lined(node)) continue;
    for (const line of node.lineBoxes) if (caret.offset >= line.start && caret.offset <= line.end) found.push({ node, line });
  }
  // A node on every page (a PageHeader's) has the same lines on each: its first page's, where no page is asked for.
  const seen = new Set<string>();
  const lines = found.filter(({ line }) => {
    const key = `${line.start}-${line.end}`;
    if (caret.page !== undefined || !seen.has(key)) return seen.add(key);
    return false;
  });
  if (!lines.length) return undefined;
  // At the end of one line and the start of the next: the next's start ("after"), or the end of the one before.
  const chosen = affinity === "after" ? (lines.find(({ line }) => caret.offset < line.end) ?? lines[lines.length - 1]) : ([...lines].reverse().find(({ line }) => caret.offset > line.start) ?? lines[0]);
  const { node, line } = chosen;
  const run = runOf(line, caret.offset, affinity);
  const x = run ? run.carets[caret.offset - run.start] : line.x;
  return { page: node.page, x, y: line.y, height: line.height };
}

/** What a selection of a node's text (from `start`, up to `end`) covers: a box for each stretch of it on each line. */
export function selectionBoxes(layout: DocumentLayout, selection: { path: string; start: number; end: number }): SelectionBox[] {
  const start = Math.min(selection.start, selection.end);
  const end = Math.max(selection.start, selection.end);
  const out: SelectionBox[] = [];
  for (const node of layout.nodes) {
    if (node.path !== selection.path || !lined(node)) continue;
    for (const line of node.lineBoxes) {
      if (line.end <= start || line.start >= end) continue;
      const boxes: Array<{ from: number; to: number }> = [];
      for (const run of line.runs) {
        const from = Math.max(start, run.start);
        const to = Math.min(end, run.end);
        if (from >= to) continue;
        const a = run.carets[from - run.start];
        const b = run.carets[to - run.start];
        boxes.push({ from: Math.min(a, b), to: Math.max(a, b) });
      }
      // Stretches side by side, one box.
      boxes.sort((a, b) => a.from - b.from);
      const merged: typeof boxes = [];
      for (const box of boxes) {
        const last = merged[merged.length - 1];
        if (last && box.from <= last.to + 0.01) last.to = Math.max(last.to, box.to);
        else merged.push({ ...box });
      }
      for (const box of merged) if (box.to > box.from) out.push({ page: node.page, x: box.from, y: line.y, width: Math.round((box.to - box.from) * 100) / 100, height: line.height });
    }
  }
  return out;
}
