/**
 * What a caller drawing part of a wider design on its own gives a writer, beside its options: the Unlayer builder's
 * HTML blocks (packages/react/src/builder/locked.ts), each drawn at its own width in a column of the design. Not one
 * of `render()`'s options.
 */
import type { TemplatePaths } from "../../expand";
import { isNode, type ElementsDocument, type Json, type Node } from "../../model";

export interface PartOptions {
  /**
   * The window's width in px at and below which the wider design is on a phone (an Email's width and
   * `EMAIL_PHONE_MARGIN`, a Page's breakpoint): the part's phone styles apply and what's hidden on phones hides there
   * too, not at its own width's. Where the part is narrower than that, its content fills the window there, as its
   * column in the wider design does.
   */
  phoneBelow?: number;
  /**
   * A Row's child drawn on its own as its cell, the only child of a Row in the part: its place in the part
   * ("root.children[0].children[0]"). What it is there, or what it renders where it's a custom element, fills its
   * cell, taking none of the sizes its Row took already to give it its cell: its width and flex, and a limit that's a
   * share of the Row (one in px is its own, in its cell too). With `stacksOnPhones: false` (its Row stays side by side
   * on phones), not its phone width either, which is its cell's there. A phone limit is its own, in its cell, but in a
   * Page, where it is its cell, one that's a share of the Row is the Row's too.
   */
  cell?: { path: string; stacksOnPhones: boolean };
}

/** What sizes a Row's child: what its Row gives it its cell by. */
const CELL_SIZES = ["width", "minWidth", "maxWidth", "flex"];
const isShare = (value: Json | undefined) => typeof value === "string" && value.trim().endsWith("%");

/** A document expanded, with what's at the cell's place in it (`cell`) as it fills its cell. */
export function drawnInCell(document: ElementsDocument, paths: TemplatePaths, { path, stacksOnPhones }: NonNullable<PartOptions["cell"]>): ElementsDocument {
  let found = false;
  const shareOfRow = (key: string, value: Json | undefined) => CELL_SIZES.includes(key) && isShare(value);
  const inPage = document.root.type === "Page";
  const fill = (node: Node): Node => {
    const style = Object.fromEntries(Object.entries(node.style ?? {}).filter(([key, value]) => key !== "width" && key !== "flex" && !shareOfRow(key, value)));
    const mobile = Object.fromEntries(Object.entries(node.mobile ?? {}).filter(([key, value]) => stacksOnPhones || (key !== "width" && !(inPage && shareOfRow(key, value)))));
    const { style: _style, mobile: _mobile, ...rest } = node;
    return { ...rest, ...(Object.keys(style).length ? { style } : {}), ...(Object.keys(mobile).length ? { mobile } : {}) };
  };
  // The outermost node at its place: what a custom element renders there is (a Grid it renders, the Rows of it too).
  const visit = (node: Node): Node => {
    if (found) return node;
    const at = paths.get(node);
    const out = at === path ? ((found = true), fill(node)) : node.children ? { ...node, children: node.children.map((child) => (isNode(child) ? visit(child) : child)) } : node;
    if (out !== node && at !== undefined) paths.set(out, at);
    return out;
  };
  return { ...document, root: visit(document.root) };
}
