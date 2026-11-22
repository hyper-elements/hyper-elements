/**
 * What a template page's agent view needs (`apps/website/src/scripts/agent-view.ts`): which parts of a design an agent
 * may change, and where they are. The HTML (an Email's, a Page's, a Document's print HTML) is marked with each block's
 * path, from `render()`'s block map, as the playground's preview does; a Canvas gives each node's box instead, from
 * `layoutImage()`. A Document's header and footer are marked on every page. A part is a field the
 * template binds (`field="…"`) or a slot an agent writes; everything else is locked.
 */
import type { Template } from "@hyper-elements/react/template";

/** One field's name for people, and its limits in a few words. */
export interface FieldGuide {
  label: string;
  kind: string;
  /** "3–32 characters · no year"; empty where it has none worth saying. */
  limits: string;
}

/** A field's path as `describe()` lists it: `stories[2].title` is `stories[].title`. */
export const fieldPath = (path: string) => path.replace(/\[\d+\]/g, "[]");

/** Each field's label and limits, by its path, from the template's own `describe()`: the same in every brand. */
export function fieldGuide(tpl: Template): Record<string, FieldGuide> {
  const out: Record<string, FieldGuide> = {};
  for (const f of (tpl.describe() as unknown as { fields: Array<Record<string, any>> }).fields) {
    const s = f.schema ?? {};
    const bits: string[] = [];
    if (f.kind === "slot") bits.push("its own content, in the brand's style");
    const len = /\{(\d+),(\d+)\}\$$/.exec(s.pattern ?? "");
    if (len) bits.push(`${len[1]}–${len[2]} characters`);
    else if (typeof s.maxLength === "number") bits.push(`up to ${s.maxLength} characters`);
    if (/\(19\|20\)/.test(s.pattern ?? "")) bits.push("no year");
    if (f.kind === "number" && (s.minimum !== undefined || s.maximum !== undefined)) bits.push(`a number${s.minimum !== undefined ? ` from ${s.minimum}` : ""}${s.maximum !== undefined ? ` to ${s.maximum}` : ""}`);
    if (f.kind === "choice" && Array.isArray(s.enum)) bits.push(`one of ${s.enum.join(", ")}`);
    if (f.kind === "image" && f.minWidth) bits.push(`at least ${f.minWidth}px wide`);
    if (f.kind === "link") bits.push("on the brand's own site");
    if (f.kind === "list" && (s.minItems !== undefined || s.maxItems !== undefined)) bits.push(`${s.minItems ?? 0} to ${s.maxItems ?? "any"}`);
    out[f.path] = { label: f.label ?? f.path, kind: f.kind, limits: bits.join(" · ") };
  }
  return out;
}

/** The HTML with each block's path written into its outermost tag, at the block map's offsets (UTF-8 bytes). */
export function markBlocks(html: string, blocks: { entries: ReadonlyArray<{ path: string; offset: number }> }): string {
  const bytes = new TextEncoder().encode(html);
  // One mark per element: where several blocks share one offset, the innermost (the entries put the outer first).
  const byOffset = new Map<number, string>();
  for (const b of blocks.entries) if (b.offset > 0 && b.offset <= bytes.length) byOffset.set(b.offset, b.path);
  const decoder = new TextDecoder();
  let out = "";
  let from = 0;
  for (const offset of [...byOffset.keys()].sort((a, b) => a - b)) {
    out += `${decoder.decode(bytes.subarray(from, offset))} data-he-path="${byOffset.get(offset)!.replace(/"/g, "&quot;")}"`;
    from = offset;
  }
  return out + decoder.decode(bytes.subarray(from));
}

/** The parts of one design an agent may change: each bound node's path and its field's path. */
export const areasOf = (nodes: ReadonlyArray<{ path: string; field?: string; fields?: readonly string[] }>) =>
  nodes.flatMap((n) => (n.field ? [n.field] : (n.fields ?? [])).map((field) => ({ path: n.path, field: fieldPath(field) })));

/** The fields an agent may change that aren't drawn as a part of their own (a subject, a link's address): every
 * field with a value but no binding, and no field inside one that's bound or inside a slot. */
export function unboundFields(guide: Record<string, FieldGuide>, areas: ReadonlyArray<{ field: string }>): string[] {
  const bound = new Set(areas.map((a) => a.field));
  const covered = (path: string) => [...bound].some((b) => path === b || path.startsWith(`${b}.`) || path.startsWith(`${b}[]`));
  return Object.entries(guide)
    .filter(([path, g]) => g.kind !== "object" && g.kind !== "list" && !covered(path))
    .map(([path]) => path);
}
