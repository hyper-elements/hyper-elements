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

/**
 * The space at a block of text's own edges, taken off: `white-space: normal` drops it in the HTML outputs, and the
 * `pre-wrap` a block of text is drawn under (`paragraph()`) would otherwise draw it as an indent. Each end is taken
 * off the run that holds it, inside a Span or a Link at that end; an Image at one ends the walk, having no space.
 */
function trimEdges(runs: Run[]): Run[] {
  const trim = (list: Run[], side: "start" | "end"): Run[] => {
    const at = side === "start" ? 0 : list.length - 1;
    const run = list[at];
    if (run === undefined) return list;
    let edge: Run;
    if (typeof run === "string") edge = side === "start" ? run.replace(/^ +/, "") : run.replace(/ +$/, "");
    else if (run.kind === "span") edge = { ...run, runs: trim(run.runs, side) };
    else return list;
    const next = [...list];
    next[at] = edge;
    return next;
  };
  // An emptied run would be a flex item of its own, so it goes.
  return trim(trim(runs, "start"), "end").filter((run) => run !== "");
}

/** The space a run starts with, taken off it: inside a Span or a Link, off the run that starts it. */
function takeLeadingSpace(run: Run): { took: boolean; run: Run } {
  if (typeof run === "string") return run.startsWith(" ") ? { took: true, run: run.slice(1) } : { took: false, run };
  if (run.kind !== "span") return { took: false, run };
  const [first, ...rest] = run.runs;
  if (first === undefined) return { took: false, run };
  const taken = takeLeadingSpace(first);
  return taken.took ? { took: true, run: { ...run, runs: [taken.run, ...rest] } } : { took: false, run };
}

/**
 * A space put at the end of a run. Inside a Span or a Link it goes in a run of its own, which the Span's underline,
 * line-through and background don't reach: a Link drawn "our site " would be underlined under the space too.
 */
function appendSpace(run: Run): Run | undefined {
  if (typeof run === "string") return `${run} `;
  if (run.kind !== "span") return undefined;
  return { ...run, runs: [...run.runs, { kind: "span", style: { textDecoration: "none", backgroundColor: "transparent" }, runs: [" "] }] };
}

/**
 * The space between two runs, moved to the end of the first. Each run is a flex item, and `pre-wrap` keeps a space
 * wherever it sits, so a space starting a run is drawn as an indent where that run begins a new line ("Hello
 * <Span>world</Span> and more" wrapping before "and"). At the end of the run before it, it hangs off the line's end
 * as `white-space: normal` hangs it in the HTML outputs. A space after a line break goes, as a browser drops it;
 * one after an Image stays, there being nothing to hang it on.
 */
function hoistSpaces(runs: Run[]): Run[] {
  const out = [...runs];
  for (let at = 1; at < out.length; at++) {
    const taken = takeLeadingSpace(out[at]!);
    if (!taken.took) continue;
    const before = out[at - 1]!;
    if (before === "\n") {
      out[at] = taken.run;
      continue;
    }
    const joined = appendSpace(before);
    if (joined === undefined) continue;
    out[at - 1] = joined;
    out[at] = taken.run;
  }
  return out.filter((run) => run !== "");
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
    return { kind: "text", style: aligned({ display: "flex", flexWrap: "wrap", ...this.text(node), ...style, whiteSpace: "pre-wrap" }), runs: hoistSpaces(trimEdges(this.runs(node))) };
  }

  runs(node: ResolvedNode): Run[] {
    return present(
      node.children.map((child): Run | undefined => {
        // As white space collapses in HTML: a run of it is one space, so pre-wrap draws the words as the others do.
        if (typeof child === "string") return child.replace(/\s+/g, " ");
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
            return { kind: "span", style, runs: this.runs(child) };
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
