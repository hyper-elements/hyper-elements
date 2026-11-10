/**
 * The style properties components pick from. There are no margins: space
 * between siblings is the parent's `gap`, space inside a box its `padding`,
 * which every target can do (margins aren't reliable in email).
 */
import type { Support, StyleGroup, StyleSpec } from "./define";
import type { Kind } from "./kinds";
import type { Json } from "./model";

/** Shown as asked, by how the writer writes it. */
const writer: Support = { level: "full", source: "writer" };
/** Written as CSS, which browsers show as asked. */
export const css: Support = { level: "full", source: "css" };
import { border, color, enumOf, flex, fontFamily, fontWeight, insets, length, line, lineHeight, radius } from "./kinds";
import {
  areas,
  backgroundRepeat,
  backgroundSize,
  between,
  filter,
  gridPlace,
  images,
  integer,
  lengths,
  origin,
  outline,
  position,
  ratio,
  richInsets,
  richLength,
  richLineHeight,
  richRadius,
  shadows,
  tracks,
  transform,
  transition,
  widened,
  type RichLengthOptions,
} from "./css-kinds";

/** Sizes on a Page: rem, em, %, viewport units, calc() and the rest, and CSS's words for a box's size. */
const SIZE_WORDS = ["auto", "min-content", "max-content", "fit-content"] as const;
const MAX_WORDS = ["none", "min-content", "max-content", "fit-content"] as const;
const pageLength = <I, O extends Json, const W extends string = never>(base: Kind<I, O>, options: RichLengthOptions<W> = {}) => widened(base, richLength<W>(options));

/** Inherited from the root down through layouts, as in CSS. */
export const textStyle = {
  color: { kind: color(), label: "Text color", inherited: true, support: { email: writer, web: css }},
  // A web font in a stack is reported from the root's fonts (whether it loads depends on the client).
  fontFamily: { kind: fontFamily(), label: "Font", inherited: true, support: { email: { level: "full", source: "writer" }, web: css } },
  // Word rounds sizes to half points (13px is 10pt): a fraction of a px.
  fontSize: { kind: length(["px"], { min: 1 }), pageKind: pageLength(length(["px"], { min: 1 }), { percent: true, min: 1 }), label: "Font size", inherited: true, mobile: true, support: { email: { level: "full", source: "writer" }, web: css } },
  fontWeight: {
    kind: fontWeight(),
    label: "Font weight",
    inherited: true,
    support: { email: { level: "full", source: "writer" }, web: css },
  },
  fontStyle: { kind: enumOf(["normal", "italic"]), label: "Font style", inherited: true, support: { email: { level: "full", source: "writer" }, web: css } },
  // Written in px with mso-line-height-rule: exactly, which Word keeps (it drops unitless ones).
  lineHeight: { kind: lineHeight(), pageKind: widened(lineHeight(), richLineHeight()), label: "Line height", inherited: true, mobile: true, support: { email: { level: "full", source: "writer" }, web: css } },
  letterSpacing: {
    kind: length(["px"], { min: -100 }),
    pageKind: pageLength(length(["px"], { min: -100 }), { negative: true }),
    label: "Letter spacing",
    inherited: true,
    mobile: true,
    support: { email: { level: "full", source: "writer" }, web: css },
  },
  textAlign: { kind: enumOf(["left", "center", "right", "justify"]), label: "Alignment", inherited: true, mobile: true, support: { email: { level: "full", source: "writer" }, web: css } },
  textTransform: {
    kind: enumOf(["none", "uppercase", "lowercase", "capitalize"]),
    label: "Letter case",
    inherited: true,
    support: { email: { level: "full", source: "writer" }, web: css },
  },
  textDecoration: {
    kind: enumOf(["none", "underline", "line-through"]),
    label: "Decoration",
    support: {
      // Removed, so "none" leaves a link the client's own underline: said only where a line is asked for.
      email: { level: "full", source: "writer" },
      web: css,
    },
  },
} satisfies Record<string, StyleSpec>;

/** Text styles for a container, passed down to its text: all but decoration, which is a text element's own (CSS doesn't pass it down). */
export const inheritedTextStyle = (({ textDecoration: _, ...rest }) => rest)(textStyle);

export const boxStyle = {
  // Widths are the resolver's, written as table, cell and image attributes in px (what Word sizes by).
  width: { kind: length(["px", "%"]), pageKind: pageLength(length(["px", "%"]), { percent: true, words: SIZE_WORDS }), label: "Width", mobile: true, support: { email: writer, web: css }},
  minWidth: { kind: length(["px", "%"]), pageKind: pageLength(length(["px", "%"]), { percent: true, words: SIZE_WORDS }), label: "Minimum width", support: { email: writer, web: css }},
  maxWidth: { kind: length(["px", "%"]), pageKind: pageLength(length(["px", "%"]), { percent: true, words: MAX_WORDS }), label: "Maximum width", mobile: true, support: { email: writer, web: css }},
  height: { kind: length(["px"]), pageKind: pageLength(length(["px"]), { percent: true, words: SIZE_WORDS }), label: "Height", support: { email: writer, web: css }},
  // Cell padding, which Word keeps (it drops a div's).
  padding: { kind: insets(), pageKind: widened(insets(), richInsets()), label: "Padding", mobile: true, support: { email: { level: "full", source: "writer" }, web: css } },
  backgroundColor: { kind: color(), label: "Background color", support: { email: writer, web: css }},
  border: { kind: border(), label: "Border", mobile: true, support: { email: { level: "full", source: "writer" }, web: css } },
  borderRadius: {
    kind: radius(),
    pageKind: widened(radius(), richRadius()),
    label: "Corner radius",
    support: {
      email: { level: "full", source: "writer" },
      web: css,
    },
  },
  overflow: {
    kind: enumOf(["visible", "hidden"]),
    pageKind: enumOf(["visible", "hidden", "clip", "scroll", "auto"]),
    label: "Overflow",
    description: "Whether content past a set height is cut off.",
    support: { email: { level: "full", source: "writer" }, web: css },
  },
} satisfies Record<string, StyleSpec>;

/** What gives a block a box of its own in an email (the Email writer's Box): on desktop, and on phones. */
const BOX_KEYS = ["padding", "border", "borderRadius", "backgroundColor", "height", "width", "maxWidth"];
const PHONE_BOX_KEYS = ["padding", "border", "backgroundColor", "width", "maxWidth"];
const ownBox = (node: { style?: Record<string, unknown>; mobile?: Record<string, unknown> }) =>
  BOX_KEYS.some((key) => node.style?.[key] !== undefined) || PHONE_BOX_KEYS.some((key) => node.mobile?.[key] !== undefined);

/**
 * A Column's or a Grid's overflow: the Email writer cuts content off on the block's box, which it writes only for a
 * background, padding, a border, corners, a width or a height. Without one, nothing is cut off, and that's said.
 */
export const blockOverflow = {
  ...boxStyle.overflow,
  support: {
    email: {
      level: "partial",
      values: ["hidden"],
      when: (_value, node) => !ownBox(node),
      shows: "nothing cut off: the email cuts content off on a box of its own (a background, padding, a border, corners, a width or a height), and this one has none",
      source: "writer",
    },
    web: css,
  },
} satisfies StyleSpec;

export const layoutStyle = {
  gap: { kind: length(["px"]), pageKind: pageLength(length(["px"]), { percent: true }), label: "Gap", description: "Space between children.", mobile: true, support: { email: writer, web: css }},
  alignItems: {
    kind: enumOf(["start", "center", "end", "stretch"]),
    pageKind: enumOf(["start", "center", "end", "stretch", "baseline"]),
    label: "Align items",
    description: "Where children sit across the layout's direction (vertically in a Row, horizontally in a Column), as CSS align-items. Across a Column it places what has its own size (a Button, an Image, an Svg, a box with a width); a block of text fills the width, so its words move with its textAlign.",
    // A cell's align, and a Row's cells' valign.
    support: { email: writer, web: css },
  },
  justifyContent: {
    kind: enumOf(["start", "center", "end", "space-between"]),
    pageKind: enumOf(["start", "center", "end", "space-between", "space-around", "space-evenly", "stretch"]),
    label: "Justify content",
    description: "Where children sit along the layout's direction, as CSS justify-content.",
    support: { email: writer, web: css },
  },
} satisfies Record<string, StyleSpec>;

/** On any child, read by the Row it's in. */
export const placementStyle = {
  flex: {
    kind: flex(),
    label: "Share",
    description: 'In a Row: its share of the width left after children with a width (default 1); "none" takes its own size.',
    support: { email: writer, web: css },
  },
} satisfies Record<string, StyleSpec>;

// ─── Page styles (Decision 5): on a Page only ───────────────────────────────

/** Written as CSS on a Page; under another root a page style is `style/not-supported`. */
const onPage = { roots: ["Page"] as const, support: { web: css } };
const choice = <const V extends readonly string[]>(values: V, label: string, description?: string) => ({ kind: enumOf(values), label, ...(description ? { description } : {}), ...onPage });
const lengthOf = <const W extends string = never>(label: string, options: RichLengthOptions<W> = {}, description?: string) => ({ kind: richLength<W>(options), label, ...(description ? { description } : {}), ...onPage });

/** How a box lays out its children. */
export const pageLayoutStyle = {
  display: choice(["block", "flex", "grid", "inline", "inline-block", "inline-flex", "none"], "Display", "How it lays out its children, as CSS display: a Box is a flex column unless it says otherwise."),
  flexDirection: choice(["row", "row-reverse", "column", "column-reverse"], "Direction", "Its children side by side (row) or one under another (column), where it's a flex box."),
  flexWrap: choice(["nowrap", "wrap", "wrap-reverse"], "Wrap", "Children that don't fit go onto another line, where it's a flex box."),
  gridTemplateColumns: { kind: tracks(), label: "Columns", description: 'Its grid\'s columns: "1fr 2fr", "repeat(3, 1fr)", "repeat(auto-fill, minmax(200px, 1fr))".', ...onPage },
  gridTemplateRows: { kind: tracks(), label: "Rows", description: "Its grid's rows.", ...onPage },
  gridTemplateAreas: { kind: areas(), label: "Areas", description: 'Its grid\'s named areas, a string per row: ["header header", "nav main"].', ...onPage },
  gridAutoFlow: choice(["row", "column", "dense", "row dense", "column dense"], "Flow", "Where its grid puts children not placed."),
  rowGap: lengthOf("Row gap", { percent: true }, "Space between its rows."),
  columnGap: lengthOf("Column gap", { percent: true }, "Space between its columns."),
  alignContent: choice(["start", "center", "end", "stretch", "space-between", "space-around", "space-evenly"], "Align content", "Where its lines or rows sit, as CSS align-content."),
  justifyItems: choice(["start", "center", "end", "stretch"], "Justify items", "Where each child sits across its grid cell, as CSS justify-items."),
} satisfies Record<string, StyleSpec>;

/** How a child sits in its parent's flex box or grid. */
export const pagePlacementStyle = {
  alignSelf: choice(["auto", "start", "center", "end", "stretch", "baseline"], "Align self", "Where it sits across its parent's flex box or grid cell, over the parent's alignItems."),
  justifySelf: choice(["auto", "start", "center", "end", "stretch"], "Justify self", "Where it sits along its grid cell."),
  order: { kind: integer(), label: "Order", description: "Its place among its siblings in a flex box or grid, lowest first.", ...onPage },
  flexGrow: { kind: between(0, Infinity), label: "Grow", description: "Its share of the room left in its parent's flex box.", ...onPage },
  flexShrink: { kind: between(0, Infinity), label: "Shrink", description: "How much it gives up where its parent's flex box is too small.", ...onPage },
  flexBasis: lengthOf("Basis", { percent: true, words: ["auto", "content"] }, "Its size along its parent's flex box before what's left is shared."),
  gridColumn: { kind: gridPlace(), label: "Grid column", description: 'The columns it takes in its parent\'s grid: "span 2", "1 / 3".', ...onPage },
  gridRow: { kind: gridPlace(), label: "Grid row", description: "The rows it takes in its parent's grid.", ...onPage },
  gridArea: { kind: gridPlace(4), label: "Grid area", description: "The named area it takes in its parent's grid (gridTemplateAreas), or its lines.", ...onPage },
} satisfies Record<string, StyleSpec>;

/** A box's size beyond its width and height. */
export const pageSizeStyle = {
  minHeight: lengthOf("Minimum height", { percent: true, words: ["auto", "min-content", "max-content", "fit-content"] }),
  maxHeight: lengthOf("Maximum height", { percent: true, words: ["none", "min-content", "max-content", "fit-content"] }),
  aspectRatio: { kind: ratio(), label: "Aspect ratio", description: 'Its height from its width: "16 / 9".', ...onPage },
} satisfies Record<string, StyleSpec>;

/** An image's or a video's picture in its box. */
export const pageObjectStyle = {
  objectFit: choice(["fill", "contain", "cover", "none", "scale-down"], "Fit", "How the picture fills its box: cover crops it, contain fits it in."),
  objectPosition: { kind: position(), label: "Picture position", description: "Where the picture sits in its box.", ...onPage },
} satisfies Record<string, StyleSpec>;

/** Where a box is placed outside the flow. */
export const pagePositionStyle = {
  position: choice(["static", "relative", "absolute", "fixed", "sticky"], "Position", "How it's placed: sticky keeps it in view as the page scrolls; absolute and fixed take it out of the flow."),
  top: lengthOf("Top", { percent: true, negative: true, words: ["auto"] }),
  right: lengthOf("Right", { percent: true, negative: true, words: ["auto"] }),
  bottom: lengthOf("Bottom", { percent: true, negative: true, words: ["auto"] }),
  left: lengthOf("Left", { percent: true, negative: true, words: ["auto"] }),
  inset: { kind: lengths({ percent: true, negative: true, words: ["auto"] }), label: "Inset", description: "top, right, bottom and left at once, as CSS inset.", ...onPage },
  zIndex: { kind: integer(-Infinity, ["auto"]), label: "Stack order", description: "Over or under what it overlaps, highest on top.", ...onPage },
} satisfies Record<string, StyleSpec>;

/** Padding one side at a time. */
export const pageSpacingStyle = {
  paddingTop: lengthOf("Padding top", { percent: true }),
  paddingRight: lengthOf("Padding right", { percent: true }),
  paddingBottom: lengthOf("Padding bottom", { percent: true }),
  paddingLeft: lengthOf("Padding left", { percent: true }),
} satisfies Record<string, StyleSpec>;

/** How text wraps and is cut off. */
export const pageTextStyle = {
  whiteSpace: choice(["normal", "nowrap", "pre", "pre-wrap", "pre-line", "break-spaces"], "White space", "Whether its text wraps and keeps its spaces."),
  textOverflow: choice(["clip", "ellipsis"], "Text overflow", 'Text cut off at its edge ends with "…" (ellipsis), with overflow hidden and whiteSpace nowrap.'),
  lineClamp: { kind: integer(1, ["none"]), label: "Line clamp", description: "Its text cut off after this many lines, with an ellipsis.", ...onPage },
} satisfies Record<string, StyleSpec>;

/** What's drawn behind a box beyond its colour. */
export const pageBackgroundStyle = {
  backgroundImage: { kind: images(), label: "Background image", description: 'Images and gradients behind it, the first on top: "url(…)", "linear-gradient(…)", several separated by commas.', ...onPage },
  backgroundSize: { kind: backgroundSize(), label: "Background size", description: '"cover", "contain", or a size, per layer.', ...onPage },
  backgroundPosition: { kind: position(true), label: "Background position", description: '"center", "50% 0", per layer.', ...onPage },
  backgroundRepeat: { kind: backgroundRepeat(), label: "Background repeat", description: '"no-repeat", "repeat-x", per layer.', ...onPage },
} satisfies Record<string, StyleSpec>;

/** A box's border one part at a time, and its outline. */
export const pageBorderStyle = {
  borderTop: { kind: line(), label: "Top border", ...onPage },
  borderRight: { kind: line(), label: "Right border", ...onPage },
  borderBottom: { kind: line(), label: "Bottom border", ...onPage },
  borderLeft: { kind: line(), label: "Left border", ...onPage },
  borderColor: { kind: color(), label: "Border color", description: "Every side's colour, over border's.", ...onPage },
  borderStyle: choice(["solid", "dashed", "dotted", "double", "none"], "Border style", "Every side's style, over border's."),
  borderWidth: { kind: lengths(), label: "Border width", description: "Every side's width (one to four lengths), over border's.", ...onPage },
  outline: { kind: outline(), label: "Outline", description: 'A line around it outside its border, taking no room: "2px solid #2563eb".', ...onPage },
} satisfies Record<string, StyleSpec>;

/** How a box is drawn: see-through, shadowed, moved, filtered. */
export const pageEffectsStyle = {
  opacity: { kind: between(0, 1), label: "Opacity", description: "0 is invisible, 1 solid.", ...onPage },
  boxShadow: { kind: shadows(), label: "Shadow", description: '"0 1px 2px rgba(0, 0, 0, 0.1)", several separated by commas.', ...onPage },
  transform: { kind: transform(), label: "Transform", description: 'Moved, scaled, rotated or skewed as drawn, taking the room it took: "translateY(-2px)".', ...onPage },
  transformOrigin: { kind: origin(), label: "Transform origin", description: "The point it's scaled and rotated about.", ...onPage },
  transition: { kind: transition(), label: "Transition", description: 'How a change of style animates: "background-color 150ms ease".', ...onPage },
  filter: { kind: filter(), label: "Filter", description: 'blur(), brightness(), grayscale() and the rest, as drawn: "grayscale(1)".', ...onPage },
  backdropFilter: { kind: filter(), label: "Backdrop filter", description: `Filters on what's behind it: "blur(8px)".`, ...onPage },
  mixBlendMode: choice(["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "difference", "exclusion", "luminosity"], "Blend mode", "How it blends with what's behind it."),
  maskImage: { kind: images(), label: "Mask", description: "An image or gradient whose see-through parts hide it.", ...onPage },
  cursor: choice(["auto", "default", "pointer", "text", "move", "not-allowed", "grab", "grabbing", "help", "wait", "crosshair", "zoom-in", "zoom-out"], "Cursor", "The pointer over it."),
  pointerEvents: choice(["auto", "none"], "Pointer events", `"none": clicks go through it to what's under it.`),
} satisfies Record<string, StyleSpec>;

/**
 * The page styles each kind of component takes (Decision 5): a Box every one; a container how it lays out its
 * children and how it's drawn; a block of text how its text wraps and how it's drawn; everything that sits in a
 * flex box or a grid, its place there.
 */
export const PAGE_CONTAINER = { ...pageLayoutStyle, ...pagePlacementStyle, ...pageSizeStyle, ...pagePositionStyle, ...pageSpacingStyle, ...pageBackgroundStyle, ...pageBorderStyle, ...pageEffectsStyle };
export const PAGE_TEXT_BLOCK = { ...pagePlacementStyle, ...pageSizeStyle, ...pagePositionStyle, ...pageSpacingStyle, ...pageTextStyle, ...pageBackgroundStyle, ...pageBorderStyle, ...pageEffectsStyle };
export const PAGE_CONTROL = { ...pagePlacementStyle, ...pagePositionStyle, ...pageBorderStyle, ...pageEffectsStyle };
export const PAGE_PICTURE = { ...pagePlacementStyle, ...pick(pageSizeStyle, "aspectRatio"), ...pageObjectStyle, ...pagePositionStyle, ...pageEffectsStyle };
export const PAGE_BLOCK = pagePlacementStyle;

/** The keys of `group` named, as a group of their own. */
export function pick<G extends Record<string, StyleSpec>, const K extends keyof G>(group: G, ...keys: K[]): Pick<G, K> {
  return Object.fromEntries(keys.map((key) => [key, group[key]])) as Pick<G, K>;
}

/**
 * The group each style is listed in, by its name. A style's name is CSS's (or, for a component's own, says what it
 * draws), and it's in the same group on every component that takes it; a spec's own `group` comes first.
 */
export const STYLE_GROUP_OF: Readonly<Record<string, StyleGroup>> = {
  // How children are placed, and how a box sits among its siblings.
  alignItems: "Layout",
  justifyContent: "Layout",
  justifyItems: "Layout",
  alignSelf: "Layout",
  verticalAlign: "Layout",
  flex: "Layout",
  flexWrap: "Layout",
  overflow: "Layout",
  // A box's size.
  width: "Size",
  minWidth: "Size",
  maxWidth: "Size",
  height: "Size",
  boxSizing: "Size",
  // Space inside a box and between its children.
  padding: "Spacing",
  gap: "Spacing",
  rowGap: "Spacing",
  indent: "Spacing",
  cellPadding: "Spacing",
  // Text.
  color: "Typography",
  fontFamily: "Typography",
  fontSize: "Typography",
  fontWeight: "Typography",
  fontStyle: "Typography",
  lineHeight: "Typography",
  letterSpacing: "Typography",
  textAlign: "Typography",
  textTransform: "Typography",
  textDecoration: "Typography",
  // What's drawn behind content, and a shape's paint.
  backgroundColor: "Background",
  fill: "Background",
  // Lines around and between boxes, and a shape's outline.
  border: "Border",
  borderTop: "Border",
  borderRadius: "Border",
  borderCollapse: "Border",
  rowBorder: "Border",
  separatorColor: "Border",
  stroke: "Border",
  strokeWidth: "Border",
  opacity: "Effects",
  // Page styles (Decision 5).
  display: "Layout",
  flexDirection: "Layout",
  gridTemplateColumns: "Layout",
  gridTemplateRows: "Layout",
  gridTemplateAreas: "Layout",
  gridAutoFlow: "Layout",
  alignContent: "Layout",
  justifySelf: "Layout",
  order: "Layout",
  flexGrow: "Layout",
  flexShrink: "Layout",
  flexBasis: "Layout",
  gridColumn: "Layout",
  gridRow: "Layout",
  gridArea: "Layout",
  columnGap: "Spacing",
  minHeight: "Size",
  maxHeight: "Size",
  aspectRatio: "Size",
  objectFit: "Size",
  objectPosition: "Size",
  position: "Position",
  top: "Position",
  right: "Position",
  bottom: "Position",
  left: "Position",
  inset: "Position",
  zIndex: "Position",
  paddingTop: "Spacing",
  paddingRight: "Spacing",
  paddingBottom: "Spacing",
  paddingLeft: "Spacing",
  whiteSpace: "Typography",
  textOverflow: "Typography",
  lineClamp: "Typography",
  backgroundImage: "Background",
  backgroundSize: "Background",
  backgroundPosition: "Background",
  backgroundRepeat: "Background",
  borderRight: "Border",
  borderBottom: "Border",
  borderLeft: "Border",
  borderColor: "Border",
  borderStyle: "Border",
  borderWidth: "Border",
  outline: "Border",
  boxShadow: "Effects",
  transform: "Effects",
  transformOrigin: "Effects",
  transition: "Effects",
  filter: "Effects",
  backdropFilter: "Effects",
  mixBlendMode: "Effects",
  maskImage: "Effects",
  cursor: "Effects",
  pointerEvents: "Effects",
};

/** The group a style is listed in: its spec's own, else its name's. */
export function styleGroup(key: string, spec: StyleSpec): StyleGroup | undefined {
  return spec.group ?? STYLE_GROUP_OF[key];
}
