/**
 * Each block's template path written into the email, as `data-el-path="…"`, at the offsets render()'s block map gives
 * (UTF-8 bytes, just after the tag name of each block's outermost element). An attribute no CSS selects changes no
 * layout. Where blocks share an element, it takes the innermost one's path (the last entry at that offset).
 */
import type { BlockMapEntry } from "@hyper-elements/react";

const escapeAttr = (text: string) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/** `html` with each entry's path at its offset, for offsets before `limit` (the bytes Gmail's clip keeps). */
export function markPaths(html: string, entries: ReadonlyArray<Pick<BlockMapEntry, "path" | "offset">>, limit = Number.POSITIVE_INFINITY): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(html);
  // One path per offset: the last entry there (entries at one offset come outer first).
  const byOffset = new Map<number, string>();
  for (const { path, offset } of entries) if (offset <= bytes.length && offset < limit) byOffset.set(offset, path);
  const offsets = [...byOffset.keys()].sort((a, b) => a - b);
  const pieces: Uint8Array[] = [];
  let from = 0;
  for (const offset of offsets) {
    pieces.push(bytes.subarray(from, offset), encoder.encode(` data-el-path="${escapeAttr(byOffset.get(offset)!)}"`));
    from = offset;
  }
  pieces.push(bytes.subarray(from));
  const out = new Uint8Array(pieces.reduce((sum, piece) => sum + piece.length, 0));
  let at = 0;
  for (const piece of pieces) {
    out.set(piece, at);
    at += piece.length;
  }
  return new TextDecoder().decode(out);
}

/** The path of the nearest marked element at or around `element`, or the root's. */
export function pathOf(element: Element | null): string {
  const marked = element?.closest("[data-el-path]");
  return marked?.getAttribute("data-el-path") ?? "root";
}
