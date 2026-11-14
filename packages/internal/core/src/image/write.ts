/**
 * A laid-out Canvas as an image to draw (model.ts): flexbox boxes at the widths the resolver gave them (as every
 * other output), text in the font a stack names that's given (else the first given), images from their bytes, an
 * Svg's shapes as a drawing. No engine is named here: an engine's adapter draws what this writes (satori.ts).
 */
import { assetParts, fontStack, htmlText, type Asset, type Border, type BorderSide, type Radius, type ResolvedNode } from "../index";
import type { Block, DrawnCanvas, Font, Picture, Run, Shape, Style } from "./model";

export interface WriteContext {
  /** The font families given, lowercased, and the first (what a stack without one of them is drawn in). */
  families: ReadonlySet<string>;
  fallback: string;
  /** The files of those families. */
  fonts: Font[];
  /** An image's source as a data URI (nothing is fetched), or undefined where there's none. */
  image(src: string): string | undefined;
}

const shown = (node: ResolvedNode) => !node.hidden?.desktop;
const nodes = (node: ResolvedNode) => node.children.filter((child): child is ResolvedNode => typeof child !== "string" && shown(child));
const present = <T>(items: Array<T | undefined>): T[] => items.filter((item): item is T => item !== undefined);
const px = (value: number) => `${Math.round(value * 100) / 100}px`;
type Sides = { top: number; right: number; bottom: number; left: number };

const FLEX: Record<string, string> = { start: "flex-start", center: "center", end: "flex-end", stretch: "stretch", "space-between": "space-between" };
const flex = (value: unknown) => (typeof value === "string" ? FLEX[value] : undefined);

/**
 * A block of text's style, its alignment also as the flex box's: Satori aligns by textAlign only the lines of text
 * that wrap, so a line that doesn't would sit at the start.
 */
const aligned = (style: Style): Style => {
  const justify = { center: "center", right: "flex-end" }[String(style.textAlign)];
  return justify ? { ...style, justifyContent: justify } : style;
};

export function writeCanvas(root: ResolvedNode, context: WriteContext): DrawnCanvas {
  const write = new Writer(context);
  return {
    width: Number(root.props.width),
    height: Number(root.props.height),
    style: {
      display: "flex",
      flexDirection: "column",
      width: px(Number(root.props.width)),
      height: px(Number(root.props.height)),
      overflow: "hidden",
      justifyContent: flex(root.style.justifyContent),
      ...write.box(root),
      ...write.text(root),
      ...gap(root),
    },
    children: present(nodes(root).map((child) => write.block(child, root))),
    fonts: context.fonts,
  };
}

const gap = (node: ResolvedNode): Style => (typeof node.style.gap === "number" ? { gap: px(node.style.gap) } : {});

/** A run with nothing to draw: no text, or a Span or a Link holding none. It would be a flex item of its own. */
const blank = (run: Run): boolean => (typeof run === "string" ? run === "" : run.kind === "span" && run.runs.every(blank));

/** An end of a run, or of a block's runs. */
type Side = "start" | "end";

/** Whether a run has a space at one end: inside a Span or a Link, whether the run at that end of it has. */
const spaceAt = (run: Run, side: Side): boolean => {
  if (typeof run === "string") return side === "start" ? run.startsWith(" ") : run.endsWith(" ");
  const edge = run.kind === "span" ? run.runs[side === "start" ? 0 : run.runs.length - 1] : undefined;
  return edge !== undefined && spaceAt(edge, side);
};

/** Whether a run is a line break at one end: is one, or is a Span or a Link whose run at that end is. */
const breakAt = (run: Run, side: Side): boolean => {
  if (typeof run === "string") return run === "\n";
  const edge = run.kind === "span" ? run.runs[side === "start" ? 0 : run.runs.length - 1] : undefined;
  return edge !== undefined && breakAt(edge, side);
};

/**
 * The space at a block of text's own edges, taken off: `white-space: normal` drops it in the HTML outputs, and the
 * `pre-wrap` a block of text is drawn under (`paragraph()`) would otherwise draw it as an indent. Each end is taken
 * off the run that holds it, inside a Span or a Link at that end. A run left with nothing goes, and the edge is then
 * the run beside it: the space after a Span that held only a space starts the block as much as that Span's own did.
 * An Image at an end ends the walk, having no space.
 */
function trimEdges(runs: Run[]): Run[] {
  const trim = (list: Run[], side: Side): Run[] => {
    const rest = [...list];
    while (rest.length > 0) {
      const at = side === "start" ? 0 : rest.length - 1;
      const run = rest[at]!;
      let edge: Run;
      if (typeof run === "string") edge = side === "start" ? run.replace(/^ +/, "") : run.replace(/ +$/, "");
      else if (run.kind === "span") edge = { ...run, runs: trim(run.runs, side) };
      else break;
      if (!blank(edge)) {
        rest[at] = edge;
        break;
      }
      rest.splice(at, 1);
    }
    return rest;
  };
  return trim(trim(runs, "start"), "end");
}

/** A run without the space at one end of it (inside a Span or a Link, off the run at that end), or undefined where it has none. */
function withoutSpace(run: Run, side: Side): Run | undefined {
  if (typeof run === "string") {
    if (!spaceAt(run, side)) return undefined;
    return side === "start" ? run.slice(1) : run.slice(0, -1);
  }
  if (run.kind !== "span") return undefined;
  const at = side === "start" ? 0 : run.runs.length - 1;
  const edge = run.runs[at];
  const taken = edge === undefined ? undefined : withoutSpace(edge, side);
  if (taken === undefined) return undefined;
  const runs = [...run.runs];
  runs[at] = taken;
  return { ...run, runs };
}

/**
 * A space put at one end of a run. Inside a Span or a Link it goes in a run of its own, which the Span's underline
 * and line-through don't reach: a Link drawn "our site " would be underlined under the space too.
 */
function withSpace(run: Run, side: Side): Run | undefined {
  if (typeof run === "string") return side === "start" ? ` ${run}` : `${run} `;
  if (run.kind !== "span") return undefined;
  const space: Run = { kind: "span", style: { textDecoration: "none", backgroundColor: "transparent" }, runs: [" "] };
  const { style, runs } = filledRuns(run);
  return { ...run, style, runs: side === "start" ? [space, ...runs] : [...runs, space] };
}

/**
 * A Span's style and runs, for a space to be put beside the runs: its background, where it has one, on each of its
 * runs instead of on the Span. A background fills a Span's whole box, the runs inside it with theirs, whatever their
 * own, so the space would be highlighted with the word beside it, on that one side.
 *
 * Words can only take a background in a box of their own, and the Span's runs must be laid out as they were. So the
 * words between two of its Spans, Links or Images go in one box, the line breaks among them too (boxed apart, the
 * words either side of a line break would no longer be one text for it to break). And where a line is too narrow
 * for a Span's runs, a box that holds words gives way and the words themselves don't (the engine's rule, which a
 * box around the words would change both ways): each box of words is told not to give way, and the Span, which held
 * words and now holds their boxes, that it still does.
 */
function filledRuns(run: Extract<Run, { kind: "span" }>): { style: Style; runs: Run[] } {
  const { backgroundColor, ...style } = run.style;
  if (backgroundColor === undefined) return { style: run.style, runs: run.runs };
  const runs: Run[] = [];
  let words: string[] = [];
  const box = () => {
    // (Line breaks with no words between two runs stay as they are.)
    if (words.some((text) => text !== "\n")) runs.push({ kind: "span", style: { backgroundColor, flexShrink: 0 }, runs: words });
    else runs.push(...words);
    words = [];
  };
  for (const held of run.runs) {
    if (typeof held === "string") {
      words.push(held);
      continue;
    }
    box();
    runs.push(held.kind === "span" ? { ...held, style: { backgroundColor, ...held.style } } : held);
  }
  box();
  return { style: run.runs.some((held) => typeof held === "string") ? { ...style, flexShrink: 1 } : style, runs };
}

/**
 * The space between two runs, moved onto one of them. Each run is a flex item, and `pre-wrap` keeps a space wherever
 * it sits, so where the words wrap between the two it's drawn on one line or the other: at the start of the second
 * run it indents the line that run begins, at the end of the first it's part of the width of the line that run ends.
 *
 * `onto` is the side of a run that holds it. "end" (the end of the first run) is right for a block aligned at the
 * left, where a line's end is ragged: "Hello <Span>world</Span> and more" wrapping before "and" starts that line at
 * the margin, and the space hangs off the line before as `white-space: normal` hangs it in the HTML outputs.
 * "start" (the start of the second) is right for one aligned at the right, where it's a line's start that is ragged
 * and its end that must reach the margin. Neither is right for a centered block, where the space moves that one line
 * by half its width either way: only measuring the words could say which line has it, so it's held as at the left.
 *
 * A space beside a line break on the side it's moved from goes, as a browser drops it, a break at the edge of a Span
 * or a Link beside it too ("<Span>Name<LineBreak /></Span> value" would start its second line with the space, and
 * "Hello <Span><LineBreak />x</Span>" aligned at the right end its first a space short), and so does one beside a run
 * that already has a space there: the two are one space in the HTML outputs, where white space collapses across a
 * Span's edge ("Hello <Span> world</Span>"). The one kept is the first, as there: moved forward onto a Link that
 * starts with a space of its own, it takes that space's place in a run the Link's underline doesn't reach. One
 * beside an Image stays, there being nothing to move it onto.
 *
 * The runs inside a Span or a Link are gathered the same way (`runs()`), each list's own two ends left as they
 * are: those are spaces between that Span and the runs either side of it.
 */
function gatherSpaces(runs: Run[], onto: Side): Run[] {
  // Each run gives the space at the side nearest the run it follows here: read in order to move a space back onto
  // the run before it, and from the last run to the first to move one forward onto the run after it.
  const from: Side = onto === "end" ? "start" : "end";
  const out: Run[] = [];
  for (const run of onto === "end" ? runs : [...runs].reverse()) {
    const beside = out[out.length - 1];
    let next = run;
    const taken = beside === undefined ? undefined : withoutSpace(run, from);
    if (beside !== undefined && taken !== undefined) {
      if (breakAt(beside, onto)) next = taken;
      else if (spaceAt(beside, onto)) {
        next = taken;
        // Read from the last run to the first, the space kept is this run's, and the one it's beside is the later.
        const kept = onto === "start" ? withoutSpace(beside, "start") : undefined;
        if (kept !== undefined) out[out.length - 1] = withSpace(kept, "start") ?? beside;
      } else {
        const joined = withSpace(beside, onto);
        if (joined !== undefined) {
          out[out.length - 1] = joined;
          next = taken;
        }
      }
    }
    // A run with nothing to draw isn't one: a Span that was only that space, or one that held nothing (a value that
    // came empty), which would otherwise stand between the space after it and the space that one collapses into.
    if (!blank(next)) out.push(next);
  }
  return onto === "end" ? out : out.reverse();
}

class Writer {
  constructor(private readonly context: WriteContext) {}

  /** The family a stack is drawn in: the first given in it, else the first given. */
  family(stack: string): string {
    return fontStack(stack).find((family) => this.context.families.has(family.toLowerCase())) ?? this.context.fallback;
  }

  text(node: ResolvedNode): Style {
    const text = node.text;
    return {
      color: text.color,
      fontFamily: this.family(String(text.fontFamily)),
      fontSize: px(text.fontSize),
      fontWeight: text.fontWeight as number,
      fontStyle: text.fontStyle,
      lineHeight: px(text.lineHeightPx),
      letterSpacing: text.letterSpacing ? px(text.letterSpacing) : undefined,
      textAlign: text.textAlign,
      textTransform: text.textTransform === "none" ? undefined : text.textTransform,
    };
  }

  box(node: ResolvedNode): Style {
    const style = node.style;
    const out: Style = {};
    const padding = style.padding as Sides | undefined;
    if (padding) out.padding = `${px(padding.top)} ${px(padding.right)} ${px(padding.bottom)} ${px(padding.left)}`;
    if (typeof style.backgroundColor === "string") out.backgroundColor = style.backgroundColor;
    const border = style.border as Border | undefined;
    for (const side of ["top", "right", "bottom", "left"] as const) {
      const line = border?.[side];
      if (line) out[`border${side[0].toUpperCase()}${side.slice(1)}`] = line.style === "none" ? "none" : `${px(line.width)} ${line.style} ${line.color}`;
    }
    const radius = style.borderRadius as Radius | undefined;
    if (typeof radius === "number") out.borderRadius = px(radius);
    else if (radius) out.borderRadius = `${px(radius.topLeft)} ${px(radius.topRight)} ${px(radius.bottomRight)} ${px(radius.bottomLeft)}`;
    if (typeof style.height === "number") out.height = px(style.height);
    if (style.overflow === "hidden") out.overflow = "hidden";
    return out;
  }

  /** Where a child of its own size sits across a stack, as in the other outputs. */
  alignSelf(child: ResolvedNode, stack: ResolvedNode): string | undefined {
    const sized = child.style.width !== undefined || child.style.maxWidth !== undefined;
    if (child.type === "Divider" || (child.definition.sizing !== "shrink" && !sized)) return undefined;
    const align = (child.style.alignSelf ?? stack.style.alignItems) as string | undefined;
    if (align === "stretch") return undefined;
    if (align) return flex(align);
    return { left: "flex-start", justify: "flex-start", center: "center", right: "flex-end" }[stack.text.textAlign];
  }

  block(node: ResolvedNode, parent: ResolvedNode, row = false): Block | undefined {
    const width = node.width !== null ? px(node.width) : undefined;
    const placed: Style = row
      ? { width, flexShrink: 0, flexGrow: 0, alignSelf: node.definition.sizing === "shrink" ? flex(parent.style.alignItems ?? "start") : undefined }
      : { alignSelf: this.alignSelf(node, parent), width: node.style.width !== undefined || node.style.maxWidth !== undefined || node.definition.sizing === "shrink" ? width : undefined };
    switch (node.type) {
      case "Text":
      case "Heading":
        return this.paragraph(node, { ...placed, ...this.box(node) });
      case "Button":
        return { kind: "box", style: { display: "flex", justifyContent: "center", ...placed, ...this.box(node), width }, children: [this.paragraph(node, { textAlign: "center" })] };
      case "Image":
        return this.image(node, placed);
      case "Divider": {
        const line = node.style.borderTop as BorderSide | undefined;
        return {
          kind: "box",
          style: { display: "flex", ...this.box(node), ...placed, width },
          children: [{ kind: "box", style: { display: "flex", flexGrow: 1, borderTop: line ? `${px(line.width)} ${line.style} ${line.color}` : undefined }, children: [] }],
        };
      }
      case "Row":
        return {
          kind: "box",
          style: { display: "flex", flexDirection: "row", ...this.box(node), ...placed, ...gap(node), alignItems: flex(node.style.alignItems ?? "start"), justifyContent: flex(node.style.justifyContent) },
          children: present(nodes(node).map((child) => this.block(child, node, true))),
        };
      case "Layer":
        return this.layer(node, placed);
      case "Svg":
        return this.svg(node, placed);
      case "Link":
        // A Link of words (a Menu's links too) is a block of text; one holding an Image, that image.
        if (node.children.some((child) => typeof child === "string" || child.definition.categories.includes("inline"))) return this.paragraph(node, { ...placed, ...this.box(node) });
        return { kind: "box", style: { display: "flex", flexDirection: "column", ...placed }, children: present(nodes(node).map((child) => this.block(child, node))) };
      case "List":
        return this.list(node, placed);
      case "Table":
        return this.table(node, placed);
      case "Html":
        // An image can't draw markup: its plain text (validate() says so).
        return { kind: "text", style: aligned({ display: "flex", ...this.text(node), ...placed }), runs: [htmlText(node)] };
      case "Video":
        // An image can't play a video: its title, as an email or a PDF without its thumbnail shows it.
        return { kind: "text", style: aligned({ display: "flex", ...this.text(node), ...this.box(node), ...placed }), runs: [String(node.props.title ?? "Video")] };
      case "Section":
      case "Column":
        return {
          kind: "box",
          style: { display: "flex", flexDirection: "column", ...this.box(node), ...placed, ...gap(node), justifyContent: flex(node.style.justifyContent) },
          children: present(nodes(node).map((child) => this.block(child, node))),
        };
      default:
        // Every block a Canvas takes is a case above (a test checks): one without a case fails rather than disappears.
        throw new Error(`[Elements] The image writer draws no ${node.type}`);
    }
  }

  /** A List: each item a marker (its number, or a bullet) beside its text, a List in it under the text. */
  list(node: ResolvedNode, placed: Style): Block {
    const indent = typeof node.style.indent === "number" ? node.style.indent : 24;
    const start = Number(node.props.start ?? 1);
    return {
      kind: "box",
      style: { display: "flex", flexDirection: "column", ...this.box(node), ...placed, ...gap(node) },
      children: nodes(node).map((item, i): Block => ({
        kind: "box",
        style: { display: "flex", flexDirection: "row" },
        children: [
          { kind: "text", style: { display: "flex", ...this.text(item), width: px(indent), flexShrink: 0, textAlign: "left" }, runs: [node.props.type === "number" ? `${start + i}.` : "•"] },
          { kind: "box", style: { display: "flex", flexDirection: "column", flexGrow: 1, flexShrink: 1 }, children: this.itemParts(item) },
        ],
      })),
    };
  }

  /** A list item's text and the Lists in it, in their order: each run of text a paragraph, each List under it. */
  itemParts(item: ResolvedNode): Block[] {
    const parts: Block[] = [];
    let text: ResolvedNode["children"] = [];
    const flush = () => {
      if (text.some((child) => typeof child !== "string" || child.trim() !== "")) parts.push(this.paragraph({ ...item, children: text }, {}));
      text = [];
    };
    for (const child of item.children) {
      if (typeof child !== "string" && child.type === "List") {
        flush();
        if (shown(child)) parts.push(this.list(child, {}));
      } else text.push(child);
    }
    flush();
    return parts;
  }

  /** A Table: its rows one under another, each cell at its columns' width (a header row's text bold). */
  table(node: ResolvedNode, placed: Style): Block {
    const columns = node.columns ?? null;
    const cellPadding = node.style.cellPadding as Sides | undefined;
    const rowBorder = node.style.rowBorder as BorderSide | undefined;
    const rows = nodes(node);
    return {
      kind: "box",
      style: { display: "flex", flexDirection: "column", ...this.box(node), ...placed },
      children: rows.map((row, r): Block => {
        let column = 0;
        const line = r < rows.length - 1 && rowBorder ? `${px(rowBorder.width)} ${rowBorder.style} ${rowBorder.color}` : undefined;
        return {
          kind: "box",
          style: { display: "flex", flexDirection: "row", ...this.box(row), borderBottom: line },
          children: nodes(row).map((cell): Block => {
            const span = Math.max(1, Number(cell.props.colSpan ?? 1));
            const width = columns ? columns.slice(column, column + span).reduce((sum, w) => sum + w, 0) : undefined;
            column += span;
            const padding = cellPadding ? `${px(cellPadding.top)} ${px(cellPadding.right)} ${px(cellPadding.bottom)} ${px(cellPadding.left)}` : undefined;
            return {
              kind: "box",
              style: { display: "flex", flexDirection: "column", padding, ...this.box(cell), width: width !== undefined ? px(width) : undefined, flexGrow: width === undefined ? 1 : 0, flexShrink: 0 },
              children: [this.paragraph(cell, row.props.header ? { fontWeight: 700 } : {})],
            };
          }),
        };
      }),
    };
  }

  /**
   * A block of text: its runs, a line break starting a new line. Each run is a flex item, and a flex item's text is
   * trimmed, so the space before or after a Span or a Link would be lost ("Hello world" drawn "Helloworld"):
   * `pre-wrap` keeps it. The writer collapses the runs itself (`runs()`) and trims the block's own edges, so the
   * words are spaced as `white-space: normal` spaces them in the HTML outputs.
   */
  paragraph(node: ResolvedNode, style: Style): Block {
    const drawn: Style = { display: "flex", flexWrap: "wrap", ...this.text(node), ...style, whiteSpace: "pre-wrap" };
    const onto: Side = drawn.textAlign === "right" ? "start" : "end";
    return { kind: "text", style: aligned(drawn), runs: gatherSpaces(trimEdges(this.runs(node, onto)), onto) };
  }

  /** A node's runs. `onto` is the side of a run that holds the space between it and the next (`gatherSpaces()`). */
  runs(node: ResolvedNode, onto: Side): Run[] {
    return present(
      node.children.map((child): Run | undefined => {
        // As white space collapses in HTML: a run of spaces, tabs and line breaks is one space, so pre-wrap draws the
        // words as the others do. A non-breaking space isn't among them (`\s` would take U+00A0 and U+202F too):
        // each is kept and drawn, and keeps the words either side of it on one line.
        if (typeof child === "string") return child.replace(/[ \t\n\r\f]+/g, " ");
        if (!shown(child)) return undefined;
        switch (child.type) {
          case "LineBreak":
            return "\n";
          case "MergeTag":
            return `{{${child.props.name}}}`;
          case "Image":
            return this.image(child, {});
          default: {
            const style: Style = { ...this.text(child), textAlign: undefined };
            if (child.style.textDecoration !== undefined) style.textDecoration = String(child.style.textDecoration);
            if (typeof child.style.backgroundColor === "string") style.backgroundColor = child.style.backgroundColor;
            return { kind: "span", style, runs: gatherSpaces(this.runs(child, onto), onto) };
          }
        }
      })
    );
  }

  image(node: ResolvedNode, placed: Style, cover?: number): Picture | undefined {
    const { src, width, height } = assetParts(node.props.src as Asset);
    const source = this.context.image(src);
    if (!source) return undefined;
    const drawn = node.width ?? width;
    const style: Style = { ...placed, ...this.box(node) };
    if (cover !== undefined) Object.assign(style, { width: "100%", height: px(cover), objectFit: "cover" });
    else if (drawn && width && height) Object.assign(style, { width: px(drawn), height: typeof node.style.height === "number" ? px(node.style.height) : px((drawn * height) / width) });
    return { kind: "image", src: source, alt: String(node.props.alt ?? ""), style };
  }

  /** A Layer: its first child in place, the others over it, each in the Layer's whole box, placed by its alignment. */
  layer(node: ResolvedNode, placed: Style): Block {
    const [base, ...over] = nodes(node);
    const height = typeof node.style.height === "number" ? node.style.height : undefined;
    const under = base && (base.type === "Image" && height !== undefined ? this.image(base, {}, height) : this.block(base, node));
    return {
      kind: "box",
      style: { display: "flex", position: "relative", ...this.box(node), ...placed, overflow: node.style.borderRadius !== undefined ? "hidden" : undefined },
      children: present([
        under,
        ...over.map((child): Block => ({
          kind: "box",
          style: { display: "flex", flexDirection: "column", position: "absolute", top: 0, right: 0, bottom: 0, left: 0, justifyContent: flex(node.style.alignItems ?? "start"), alignItems: flex(node.style.justifyItems ?? "stretch") },
          children: present([this.block(child, node)]),
        })),
      ]),
    };
  }

  /** An Svg as a drawing, its shapes in its viewBox's units. */
  svg(node: ResolvedNode, placed: Style): Block {
    const { width, height, viewBox } = node.props as { width: number; height: number; viewBox?: string };
    const paint = (value: unknown) => (value === "transparent" ? "none" : (value as string | undefined));
    const KINDS: Record<string, Shape["kind"]> = { Rect: "rect", Circle: "circle", Ellipse: "ellipse", Line: "line", Polygon: "polygon", Path: "path" };
    const shapes = nodes(node).map((shape): Shape => ({
      kind: KINDS[shape.type],
      attributes: { ...shape.props, fill: paint(shape.style.fill), stroke: paint(shape.style.stroke), strokeWidth: shape.style.strokeWidth, opacity: shape.style.opacity },
    }));
    return { kind: "box", style: { display: "flex", ...this.box(node), ...placed, width: undefined }, children: [{ kind: "drawing", width, height, viewBox: viewBox ?? `0 0 ${width} ${height}`, shapes }] };
  }
}
