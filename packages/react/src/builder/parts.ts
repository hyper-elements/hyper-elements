/**
 * Which part of the builder's design each node fromDesign() makes stands for: where it is in the design's body
 * (`rows[2].columns[0].contents[1]`, a table's `….values.table.rows[3]`) and its id there (`values._meta.htmlID`). A
 * reader marks a node as it makes it; the mark rides on copies of it (the checks after reading copy nodes and drop or
 * move some), and partsOf() reads the marks off the template as it's returned, by each node's path in it.
 */
import type { Node } from "@hyper-elements/core";
import type { Values } from "./values";

/** A part of the builder's design: where it is in the design's body, and its id there, where it has one. */
export interface DesignPart {
  at: string;
  id?: string;
}

const PART = Symbol("hyper-elements.design-part");
type Marked = Node & { [PART]?: DesignPart };

/** The node as the part of the design at `at`, with the id its values give it. */
export function mark<T extends Node>(node: T, at: string, values?: Values): T {
  const id = values?._meta?.htmlID;
  (node as Marked)[PART] = typeof id === "string" && id ? { at, id } : { at };
  return node;
}

/** The node as the part `from` stands for (a box made around a block is that block's). */
export function markAs<T extends Node>(node: T, from: Node): T {
  const part = (from as Marked)[PART];
  if (part) (node as Marked)[PART] = part;
  return node;
}

export const isMarked = (node: Node): boolean => (node as Marked)[PART] !== undefined;

/**
 * Each node's path in the template (`root.children[3].children[1]`, as a plan names it) and the part of the design it
 * stands for: its own, else the part around it (a block's text, a column's blocks), else the one part every node in it
 * stands for (a box made around a block). The root, which stands for the whole design, has none. In the template's
 * order: each node before what's in it.
 */
export function partsOf(root: Node): Record<string, DesignPart> {
  const found = new Map<string, DesignPart | undefined>();
  const visit = (node: Node, path: string, around: DesignPart | undefined): DesignPart | undefined => {
    const own = (node as Marked)[PART] ?? around;
    found.set(path, own);
    const inside = new Set<DesignPart>();
    node.children?.forEach((child, i) => {
      if (typeof child === "string") return;
      const part = visit(child, `${path}.children[${i}]`, own);
      if (part) inside.add(part);
    });
    const part = own ?? (inside.size === 1 ? [...inside][0] : undefined);
    found.set(path, part);
    return part;
  };
  root.children?.forEach((child, i) => typeof child !== "string" && visit(child, `root.children[${i}]`, undefined));
  const parts: Record<string, DesignPart> = {};
  for (const [path, part] of found) if (part) parts[path] = part;
  return parts;
}
