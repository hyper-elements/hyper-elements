/**
 * The template tree: what a template's JSX is collected into inside one
 * render, and what layout and every writer read. Internal, never public; plain
 * data (no functions, no React elements).
 */

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export interface ElementsDocument {
  root: Node;
  /**
   * The template's theme. With `merged`, set by the first read of a template that has a theme or a scope: checked, its
   * root's `formats` merged and its references kept as written, which expansion resolves what a custom component
   * renders against. Without it, a template's theme given here rather than on its root, and read as the root's.
   */
  theme?: { [key: string]: Json };
  /** The theme is merged into the nodes already (the document was read): a later read merges nothing. */
  merged?: true;
}

export interface Node {
  /** Only when the author gives one; unique in the template, and written to the HTML as is. */
  id?: string;
  /** A defined component: "Email", "Row", "Heading", … */
  type: string;
  /** Meaning: href, src, alt, level. */
  props?: Record<string, Json>;
  /** Appearance, in the value kinds the component's definition gives. */
  style?: Record<string, Json>;
  /** Style overrides on phones (Email and Page). */
  mobile?: Record<string, Json>;
  /** Style while the pointer is over it, where the definition allows. */
  hover?: Record<string, Json>;
  hidden?: { mobile?: boolean; desktop?: boolean };
  /** A scope's tokens (Section, Row, Column, Grid), their values read: over the theme's for it and what's in it. */
  tokens?: Record<string, Json>;
  /** On a Page, the CSS custom properties its element carries (a root's every token, a scope's that differ there). */
  customProperties?: Record<string, string>;
  children?: Child[];
}

/** A string is text, where the parent takes text. */
export type Child = Node | string;

export function isNode(child: Child): child is Node {
  return typeof child === "object" && child !== null;
}
