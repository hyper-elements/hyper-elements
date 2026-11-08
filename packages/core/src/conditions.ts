/**
 * The conditions a component's styles can be set for besides its own: on phones (`mobile`) and while the pointer is
 * over it (`hover`). Each says where it's allowed, which styles it takes, where its rules go in the stylesheet, and
 * how each output shows it, so reading a template, expanding composites, the support diagnostics and the writers all
 * go through this one list. A condition joins it with its support for every output (test/writers/support.test.ts).
 */
import type { ComponentDefinition, StyleSpec, Support, SupportByTarget, Target } from "./define";
import type { Json } from "./model";
import type { Level, Media } from "./writers/shared/classes";

export type ConditionName = "mobile" | "hover";

/** The least a node needs for a paged output's message. */
interface Named {
  type: string;
}

export interface Condition {
  name: ConditionName;
  /** What it's called in messages: "on phones", and "for phones" for what can be set for it. */
  on: string;
  for: string;
  /** Whether it's allowed under a root; elsewhere it's the `notAllowed` error when a template is read. Undefined: every root. */
  roots?: (root: ComponentDefinition | undefined) => boolean;
  notAllowed?: { code: string; message: string };
  /** Where its rules go in the stylesheet: an existing Media, and for a state its selector and Level. */
  sheet: { media: Media; selector: string; level?: Level };
  /** Which styles of a component it takes. */
  allows: (spec: StyleSpec, key: string, definition: ComponentDefinition) => boolean;
  /** How each output shows the block itself. */
  support: Partial<Record<Target, Support>>;
  /** Per style, how each output shows it inside this block, where that differs from the style's own declaration. */
  styles?: Record<string, SupportByTarget>;
  /** What a PDF or an image writes for it, where it can reach one. */
  paged?: (node: Named, where: string) => string;
  /** Whether classic Outlook for Windows ever applies it: a style's `outlook` note inside it is skipped where it doesn't. */
  outlookApplies: boolean;
  /** A node hidden here doesn't need its block: the support pass skips it. */
  hiddenKey?: "mobile" | "desktop";
}

export const MOBILE: Condition = {
  name: "mobile",
  on: "on phones",
  for: "for phones",
  roots: (root) => !!root?.responsive,
  notAllowed: { code: "mobile/not-supported", message: "Phone styles are for an Email or a Page, which have a phone width" },
  sheet: { media: "phone", selector: "&" },
  allows: (spec) => !!spec.mobile,
  support: { web: { level: "full", source: "writer" }, email: { level: "full", source: "writer" } },
  styles: {
    // The email's phone text styles are rules that override a size; "normal" isn't one.
    lineHeight: { email: { level: "none", values: ["normal"], shows: "the line height it has on desktop", source: "writer" } },
  },
  outlookApplies: false,
  hiddenKey: "mobile",
};

export const HOVER: Condition = {
  name: "hover",
  on: "on hover",
  for: "for hover",
  // Keyboard focus gets the same styles as the pointer: a link or button reached by Tab shows its hover colors.
  sheet: { media: "all", selector: "&:hover,&:focus-visible", level: "hover" },
  allows: (_, key, definition) => !!definition.hover?.includes(key),
  support: {
    web: { level: "full", source: "css" },
    email: { level: "partial", shows: "no change in classic Outlook for Windows and some other apps and webmail (where it shows, keyboard focus gets it too)", source: "caniemail" },
  },
  paged: (node, where) => `A hover isn't possible in ${where}: nothing points at it. The ${node.type} shows its own colors`,
  outlookApplies: false,
};

/** In the order a node's blocks are read and reported. */
export const CONDITIONS: readonly Condition[] = [MOBILE, HOVER];

export const CONDITION_NAMES: ReadonlySet<string> = new Set(CONDITIONS.map((condition) => condition.name));

/** A node's block for a condition, if it has one with something in it. */
export function blockOf(node: { mobile?: Record<string, Json>; hover?: Record<string, Json> }, condition: Condition): Record<string, Json> | undefined {
  const block = node[condition.name];
  return block && Object.keys(block).length ? block : undefined;
}

/** Whether a node shows anywhere: hidden on phones and on desktop, it never does. */
export function shownAnywhere(node: { hidden?: { mobile?: boolean; desktop?: boolean } }): boolean {
  return !(node.hidden?.mobile && node.hidden?.desktop);
}
