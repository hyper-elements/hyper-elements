/**
 * Where each block of an Email is in its HTML, for render()'s `blockMap`: a tool that previews the email (marking each
 * block, then reading where each one is drawn) finds the template path of what it draws.
 *
 * While the email is written, each node's markup gets a mark just after the tag name of its outermost element (the
 * first one every client but classic Outlook reads, else the first in Outlook's own markup): two Unicode
 * noncharacters around the node's number. Once it's written the marks are taken out, so the HTML is the same bytes as
 * without them, and where each one was is its block's offset. A template whose own text holds those noncharacters
 * would be misread: it's written again with another pair.
 */
import type { ResolvedNode } from "../../resolve";
import { Html } from "../jsx";

/** The format of render()'s `blocks`, kept by hand: raised only when the format changes (not the package's version). */
export const BLOCK_MAP_VERSION = 1;

export interface BlockMapEntry {
  /** The block's place in the template (`root.children[2]`), as diagnostics give it. */
  path: string;
  /** Its `id`, where it has one. */
  nodeId?: string;
  /** The UTF-8 byte offset in `html` just after its outermost element's tag name (`<table`, `<div`). */
  offset: number;
}

export interface BlockMap {
  /** `BLOCK_MAP_VERSION`. */
  version: number;
  /** What `offset` counts: bytes of the HTML in UTF-8. */
  unit: "utf8";
  /** Each block written as an element, in the order of their offsets (blocks at one offset: the outer first). */
  entries: BlockMapEntry[];
}

/** How many pairs of noncharacters there are to mark with (U+FDD0 to U+FDEF). */
export const MARK_PAIRS = 16;

/** The marks of one writing of an email: the nodes marked, by number, and the pair of characters around each number. */
export class BlockMarks {
  readonly nodes: ResolvedNode[] = [];
  readonly open: string;
  readonly close: string;
  constructor(pair: number) {
    this.open = String.fromCharCode(0xfdd0 + pair * 2);
    this.close = String.fromCharCode(0xfdd1 + pair * 2);
  }
}

let current: BlockMarks | null = null;

/** Writes with `marks` collecting each block's mark (none where it's null). */
export function withBlockMarks<T>(marks: BlockMarks | null, write: () => T): T {
  const before = current;
  current = marks;
  try {
    return write();
  } finally {
    current = before;
  }
}

/** `html`, a node's markup, with the node's mark just after its outermost element's tag name; as it is where nothing is collecting. */
export function markBlock(html: Html, node: ResolvedNode): Html {
  if (!current) return html;
  const mark = `${current.open}${current.nodes.length}${current.close}`;
  const marked = insert(html, mark, false) ?? insert(html, mark, true);
  if (!marked) return html;
  current.nodes.push(node);
  return marked;
}

const OUTLOOK_OPEN = "<!--[if mso]>";
const OUTLOOK_CLOSE = "<![endif]-->";
const TAG = /<[a-zA-Z][a-zA-Z0-9]*/y;

/** Where the first element's tag name ends in `markup`: outside Outlook-only comments, or (`outlook`) anywhere. -1 if none. */
function tagEnd(markup: string, outlook: boolean): number {
  for (let i = markup.indexOf("<"); i >= 0; i = markup.indexOf("<", i + 1)) {
    if (markup.startsWith(OUTLOOK_OPEN, i)) {
      if (outlook) {
        i += OUTLOOK_OPEN.length - 1;
        continue;
      }
      const end = markup.indexOf(OUTLOOK_CLOSE, i);
      if (end < 0) return -1;
      i = end + OUTLOOK_CLOSE.length - 1;
      continue;
    }
    // Other comments, `<!--[if !mso]><!-->` and `<!--<![endif]-->` among them.
    if (markup.startsWith("<!--", i)) {
      const end = markup.indexOf("-->", i + 4);
      if (end < 0) return -1;
      i = end + 2;
      continue;
    }
    TAG.lastIndex = i;
    const tag = TAG.exec(markup);
    if (tag) return i + tag[0].length;
  }
  return -1;
}

/** `html` with `mark` put where its first element's tag name ends (outside Outlook-only markup, unless `outlook`), keeping its pieces and their kinds. */
function insert(html: Html, mark: string, outlook: boolean): Html | null {
  const { list, kind, start } = html.options;
  if (list) {
    for (let i = 0; i < list.length; i++) {
      const marked = insert(list[i]!, mark, outlook);
      if (marked) return new Html(html.markup, { ...html.options, list: list.map((piece, j) => (j === i ? marked : piece)) });
    }
    return null;
  }
  if (kind === "outlook" && !outlook) return null;
  const at = tagEnd(html.markup, outlook);
  if (at < 0) return null;
  const put = (text: string) => text.slice(0, at) + mark + text.slice(at);
  return new Html(put(html.markup), { ...html.options, start: start !== undefined && at <= start.length ? put(start) : start });
}

/**
 * The written markup without its marks, and where each was (a character index in it), in order; null where the
 * template's own text holds the pair (a mark repeated, unknown or not just after a tag name, or the pair left over).
 */
export function readMarks(marks: BlockMarks, written: string): { text: string; found: Array<{ node: ResolvedNode; at: number }> } | null {
  const found: Array<{ node: ResolvedNode; at: number }> = [];
  const seen = new Set<number>();
  const pieces: string[] = [];
  let length = 0;
  let last = 0;
  for (const match of written.matchAll(new RegExp(`${marks.open}(\\d+)${marks.close}`, "g"))) {
    const index = Number(match[1]);
    const node = marks.nodes[index];
    if (!node || seen.has(index)) return null;
    seen.add(index);
    const before = written.slice(last, match.index);
    pieces.push(before);
    length += before.length;
    last = match.index! + match[0].length;
    if (!/<[a-zA-Z][a-zA-Z0-9]*$/.test(written.slice(Math.max(0, match.index! - 32), match.index).replace(new RegExp(`${marks.open}\\d+${marks.close}`, "g"), ""))) return null;
    found.push({ node, at: length });
  }
  pieces.push(written.slice(last));
  const text = pieces.join("");
  if (text.includes(marks.open) || text.includes(marks.close)) return null;
  return { text, found };
}
