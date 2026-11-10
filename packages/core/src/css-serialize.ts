/**
 * Writing a Page's CSS values (Decision 7): each page style as a declaration, its value as written. Nothing is
 * rewritten in it: colours are shortened only where the value is a colour, and a rule's class goes into its selector
 * before its declarations are added (`Stylesheet.classForDeclarations`), so an `&` in a value (a URL's query) stays
 * as it is.
 */
import type { ComponentDefinition } from "./define";
import { kebab, px, Verbatim } from "./writers/shared/css";
import type { BorderSide } from "./kinds";
import type { Json } from "./model";
import {
  pageBackgroundStyle,
  pageBorderStyle,
  pageEffectsStyle,
  pageLayoutStyle,
  pageObjectStyle,
  pagePlacementStyle,
  pagePositionStyle,
  pageSizeStyle,
  pageSpacingStyle,
  pageTextStyle,
} from "./styles";

export { Verbatim };

/** Every page style, by name: what a writer writes after its own declarations. */
export const PAGE_STYLE_KEYS: ReadonlySet<string> = new Set(
  Object.keys({
    ...pageLayoutStyle,
    ...pagePlacementStyle,
    ...pageSizeStyle,
    ...pageObjectStyle,
    ...pagePositionStyle,
    ...pageSpacingStyle,
    ...pageTextStyle,
    ...pageBackgroundStyle,
    ...pageBorderStyle,
    ...pageEffectsStyle,
  })
);

/** Styles whose number has no unit. */
const UNITLESS = new Set(["opacity", "zIndex", "order", "flexGrow", "flexShrink", "aspectRatio", "lineClamp"]);
/** Styles whose value is a colour: shortened as today's colours are. */
const COLORS = new Set(["borderColor"]);


/** One page style's declarations: usually one, its value as written. */
export function pageDeclaration(key: string, value: Json): Array<[string, string | Verbatim]> {
  if (value === undefined || value === null) return [];
  if (key === "lineClamp") {
    if (value === "none") return [["-webkit-line-clamp", "unset"]];
    return [
      ["display", "-webkit-box"],
      ["-webkit-box-orient", "vertical"],
      ["-webkit-line-clamp", String(value)],
      ["line-clamp", String(value)],
      ["overflow", "hidden"],
    ];
  }
  if (key === "gridTemplateAreas" && Array.isArray(value)) return [["grid-template-areas", new Verbatim(value.map((row) => `"${String(row)}"`).join(" "))]];
  if (/^border(Top|Right|Bottom|Left)$/.test(key) && typeof value === "object") {
    const side = value as BorderSide;
    return [[kebab(key), `${px(side.width)} ${side.style} ${side.color}`]];
  }
  if (typeof value === "number") return [[kebab(key), UNITLESS.has(key) ? String(value) : px(value)]];
  const text = String(value);
  return [[kebab(key), COLORS.has(key) ? text : new Verbatim(text)]];
}

/**
 * A node's page styles as declarations, in the order its style holds them: the styles its component takes as page
 * styles (on a Page only), not those of the same name its writer writes itself (a Divider's borderTop, a Button's
 * alignSelf).
 */
export function pageDeclarations(style: Record<string, Json>, definition: ComponentDefinition): Array<[string, string | Verbatim]> {
  const out: Array<[string, string | Verbatim]> = [];
  for (const [key, value] of Object.entries(style)) if (isPageStyle(definition, key)) out.push(...pageDeclaration(key, value));
  return out;
}

/** Whether the component takes `key` as a page style (a style for a Page only). */
export function isPageStyle(definition: ComponentDefinition, key: string): boolean {
  if (!PAGE_STYLE_KEYS.has(key) || !Object.prototype.hasOwnProperty.call(definition.style, key)) return false;
  const roots = definition.style[key].roots;
  return !!roots && roots.length === 1 && roots[0] === "Page";
}

/**
 * How a node's page styles lay out its children, where they make it something other than its component's own stack:
 * a grid (display grid), or a flex row (flexDirection row, a flex box being a column until it says row). The one
 * rule the resolver, the writers and outline() read.
 */
export function pageLayout(style: Record<string, Json>): "flex" | "grid" | undefined {
  const { display, flexDirection } = style;
  if (display === "grid" || display === "inline-grid") return "grid";
  const row = flexDirection === "row" || flexDirection === "row-reverse";
  return row && !BLOCKLIKE.has(display as string) ? "flex" : undefined;
}

/** Displays that make a box no flex box or grid: its children in normal flow, or not shown. */
export const BLOCKLIKE: ReadonlySet<string> = new Set(["block", "inline", "inline-block", "none"]);
