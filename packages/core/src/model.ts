/**
 * The template tree: what a template's JSX is collected into inside one
 * render, and what layout and every writer read. Internal, never public; plain
 * data (no functions, no React elements).
 */

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export interface ElementsDocument {
  root: Node;
  /**
   * The template's theme, checked and with its root's `formats` merged, its references kept as written: set by the
   * first read of a template that has a theme or a scope. A document with it was read already: a later read merges
   * nothing, and expansion resolves what a custom component renders against it.
   */
  theme?: { [key: string]: Json };
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
