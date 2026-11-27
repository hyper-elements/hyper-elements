/**
 * A laid-out Document as pages to draw (model.ts): a page for each of its pages (the paper's size, the margins, its
 * header, content and footer), then, where the engine finds a page's content runs past it, that content flowed onto the
 * pages after it (flowDocument(), flow.ts); and each block as a box, a block of text, an image, a
 * link or a drawing, at the width the resolver gave it, so the PDF is laid out as the print HTML is. No engine is
 * named here: an engine's adapter draws what this writes (react-pdf.tsx).
 */
import { assetParts, documentPages, htmlText, linkParts, pageBox, videoParts, type Asset, type BorderSide, type LinkValue, type ResolvedNode } from "../index";
import { imageSize } from "./image-size";
import { flowPage } from "./flow";
import { Painter } from "./paint";
import type { MeasuredPage, Plan, PlannedPage } from "../plan";
import { blocksOf, measure } from "./measure";
import { RIGHT_TO_LEFT } from "./runs";
import type { Block, DrawnDocument, Font, Page, Picture, PlacedPage, Run, Shape, Style } from "./model";
import { alignSelf, borderStyle, boxStyle, flex, pt, runStyle, textStyle } from "./styles";

export interface WriteContext {
  /** The families whose files are given, lowercased (what a stack's text is drawn in where it names one). */
  families: ReadonlySet<string>;
  /** The files of those families. */
  fonts: Font[];
  /** An image's source as a data URI (nothing is fetched), or undefined where there's none. */
  image(src: string): string | undefined;
  /** When the PDF says it was made. */
  date: Date;
}

/** A Video's thumbnail: its own, else a YouTube video's (derived from its URL), or undefined (a Vimeo video's isn't). */
export const thumbnailOf = (video: ResolvedNode): string | undefined =>
  video.props.thumbnail ? assetParts(video.props.thumbnail as Asset).src : videoParts(String(video.props.src))?.thumbnail;

const shown = (node: ResolvedNode) => !node.hidden?.desktop;
/** A transparent pixel: an image's room in a line, with nothing drawn in it. */
const BLANK = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
/** An image file's own size, where its header can be read (image-size.ts). */
const sized = (src: string): { size?: { width: number; height: number } } => {
  const size = imageSize(src);
  return size ? { size } : {};
};
const nodes = (node: ResolvedNode) => node.children.filter((child): child is ResolvedNode => typeof child !== "string" && shown(child));
const present = <T>(items: Array<T | undefined>): T[] => items.filter((item): item is T => item !== undefined);

/**
 * A Document's pages as written: each page its content, header and footer, numbered for the pages there are.
 * `reserve`: its page numbers written as the widest they get (each `reserve`, the count of pages a plan has), so
 * they're measured as tall as they're drawn on any page (a footer, or a text, that wraps once its count grows a
 * digit); the pages are then flowed (flowDocument()'s `reserve`), which numbers each as it's drawn. `numbered`: a
 * text's page numbers written as the page it's drawn on, by its path (flowDocument()'s too), so it's measured as wide
 * as it's drawn.
 */
export function writeDocument(root: ResolvedNode, context: WriteContext, reserve?: number, numbered?: ReadonlyMap<string, { number: number; total: number }>): DrawnDocument {
  const box = pageBox(root.props);
  const { pages, header, footer } = documentPages(root);
  const total = pages.length;
  const write = new Writer(context, root);
  write.numbered = numbered;
  return {
    title: root.props.title as string | undefined,
    lang: root.props.lang as string | undefined,
    date: context.date,
    fonts: context.fonts,
    pages: pages.map(({ page, children }, index): Page => {
      write.page = reserve === undefined ? { number: index + 1, total } : { number: reserve, total: reserve };
      const content = page ?? root;
      const margin = { top: pt(box.margin.top), right: pt(box.margin.right), bottom: pt(box.margin.bottom), left: pt(box.margin.left) };
      return {
        width: pt(box.width),
        height: pt(box.height),
        margin,
        // Paper is white: a page with no background of its own paints one, as a viewer may show a page left
        // transparent as black (in dark mode), under text that's dark.
        background: (page?.style.backgroundColor ?? root.style.backgroundColor ?? "#ffffff") as string,
        // The room inside the margins, as react-pdf works it out (the paper's height less them, in points), less a
        // thousandth: react-pdf warns that a box taller than the room can't wrap, and Yoga lays it out in 32-bit
        // floats (A4's 769.89 points is 769.8900146). The page box's contentHeight is a whole px (1027 for 1026.52).
        contentHeight: Math.floor((pt(box.height) - margin.bottom - margin.top - 0.001) * 1000) / 1000,
        header: header && write.block(header, root),
        content: present(children.filter(shown).map((child) => write.block(child, content))),
        gap: typeof content.style.gap === "number" ? pt(content.style.gap) : undefined,
        footer: footer && write.block(footer, root),
      };
    }),
  };
}

/**
 * A Document's pages flowed: each page's content that doesn't fit going on to pages of its own after it, with the
 * page's paper, margins and background, and its header and footer numbered for the pages there are now. From the
 * pages as written (`document`) and where the engine laid them out (`placed`), measured (plan.ts), planned (flow.ts)
 * and painted (paint.ts), with the Plan and what it was made from.
 */
export function flowDocument(root: ResolvedNode, context: WriteContext, document: DrawnDocument, placed: PlacedPage[], reserve?: number, texts?: ReadonlyMap<string, { number: number; total: number }>): { document: DrawnDocument; plan: Plan; measured: MeasuredPage[] } {
  const measured = measure(document, placed);
  const planned: PlannedPage[] = document.pages.flatMap((page, i) => {
    const pages = measured[i] ? flowPage(page, measured[i], i) : undefined;
    // A page that couldn't be planned (a block that wasn't measured) stays as it was written.
    return pages ?? [{ from: i, parts: page.content.map((block) => ({ path: block.path!, part: 0, first: true, last: true })) }];
  });
  const { header, footer } = documentPages(root);
  const write = new Writer(context, root);
  // One painter for each page as written: its blocks indexed once, however many pages it goes on to.
  const painters = new Map<number, Painter>();
  const pages = planned.map(({ from, parts }, index): Page => {
    const page = document.pages[from];
    let painter = painters.get(from);
    if (!painter) painters.set(from, (painter = new Painter(blocksOf(page))));
    write.page = { number: index + 1, total: planned.length };
    // Its content's page numbers too, as its header's: this page's, of the pages there are now. A split text is cut where
    // it was measured with the numbers it was written with (as the print HTML cuts it), then numbered.
    const content = parts.map((part) => numbered(painter.part(part), write.page));
    return { ...page, content, header: header && write.block(header, root), footer: footer && write.block(footer, root) };
  });
  return { document: { ...document, pages }, plan: { pages: planned, ...(reserve !== undefined ? { numbers: reserve } : {}), ...(texts?.size ? { numbered: Object.fromEntries(texts) } : {}) }, measured };
}

const gap = (node: ResolvedNode): Style => (typeof node.style.gap === "number" ? { gap: pt(node.style.gap) } : {});

/** A block with its page numbers (PageNumber's runs) for `page`: itself where it has none, else a copy. */
function numbered(block: Block, page: { number: number; total: number }): Block {
  const runs = (list: Run[]): Run[] => {
    let changed = false;
    const out = list.map((run): Run => {
      if (typeof run === "string" || run.kind === "image") return run;
      if (run.kind === "span" && run.page) {
        const text = String(run.page === "total" ? page.total : page.number);
        if (run.runs.length === 1 && run.runs[0] === text) return run;
        changed = true;
        return { ...run, runs: [text] };
      }
      const inner = runs(run.runs);
      if (inner === run.runs) return run;
      changed = true;
      return { ...run, runs: inner };
    });
    return changed ? out : list;
  };
  if (block.kind === "text") {
    const next = runs(block.runs);
    return next === block.runs ? block : { ...block, runs: next };
  }
  if (block.kind === "box" || block.kind === "link") {
    const children = block.children.map((child) => numbered(child, page));
    return children.every((child, i) => child === block.children[i]) ? block : { ...block, children };
  }
  return block;
}

const LETTER = /\p{L}/u;

/**
 * The direction "auto" gives a node: its text's first letter's, as a browser finds it (passing over what has a
 * direction of its own); undefined where it has no letter.
 */
function firstLetter(node: ResolvedNode): "ltr" | "rtl" | undefined {
  for (const child of node.children) {
    if (typeof child === "string") {
      for (const char of child) if (LETTER.test(char)) return RIGHT_TO_LEFT.test(char) ? "rtl" : "ltr";
    } else if (shown(child) && child.props.dir === undefined) {
      const found = firstLetter(child);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * The paths of the nodes whose text runs right to left: a direction of their own (a block's, a Row's, the root's), or
 * their parent's; "auto", their text's first letter's.
 */
function rightToLeft(root: ResolvedNode): Set<string> {
  const out = new Set<string>();
  const visit = (node: ResolvedNode, inherited: "ltr" | "rtl") => {
    const own = node.props.dir;
    const direction = own === "rtl" || own === "ltr" ? own : own === "auto" ? (firstLetter(node) ?? "ltr") : inherited;
    if (direction === "rtl") out.add(node.path);
    for (const child of node.children) if (typeof child !== "string") visit(child, direction);
  };
  visit(root, "ltr");
  return out;
}

class Writer {
  page = { number: 1, total: 1 };
  /** Where a text's page numbers are written as the page it's drawn on (writeDocument()'s `numbered`), by its path. */
  numbered?: ReadonlyMap<string, { number: number; total: number }>;

  /** The numbers a page number in `path` is written with: its text's (or a block's around it) where they're given, else this page's. */
  numbersAt(path: string): { number: number; total: number } {
    for (let at = path; this.numbered; ) {
      const given = this.numbered.get(at);
      if (given) return given;
      const up = at.replace(/\.children\[\d+\]$/, "");
      if (up === at) break;
      at = up;
    }
    return this.page;
  }

  private readonly rtl: Set<string>;

  constructor(
    private readonly context: WriteContext,
    root: ResolvedNode
  ) {
    this.rtl = rightToLeft(root);
  }

  /**
   * A node's text styles, with its direction where it runs right to left. react-pdf takes a paragraph's direction from
   * its first run and hands it down to nothing, so a block of text and each run in it carry it.
   */
  text(node: ResolvedNode): Style {
    return { ...textStyle(node, this.context.families), ...this.direction(node) };
  }

  direction(node: ResolvedNode): Style {
    return this.rtl.has(node.path) ? { direction: "rtl" } : {};
  }

  /** A block in a stack (or a Row, `row`), at the width the resolver gave it, with the node's path. */
  block(node: ResolvedNode, parent: ResolvedNode, row = false): Block | undefined {
    const drawn = this.draw(node, parent, row);
    if (drawn) drawn.path = node.path;
    return drawn;
  }

  draw(node: ResolvedNode, parent: ResolvedNode, row: boolean): Block | undefined {
    const placed: Style = row
      ? { width: node.width !== null ? pt(node.width) : undefined, flexShrink: 0, flexGrow: 0, alignSelf: node.definition.sizing === "shrink" ? flex(parent.style.alignItems ?? "start") : undefined }
      : { alignSelf: alignSelf(node, parent), width: node.width !== null && (node.style.width !== undefined || node.style.maxWidth !== undefined || node.definition.sizing === "shrink") ? pt(node.width) : undefined };
    switch (node.type) {
      case "Text":
      case "Heading":
        return { kind: "text", splits: "lines", ...(node.type === "Heading" ? { keepWithNext: true } : {}), style: { ...this.text(node), ...boxStyle(node), ...placed }, runs: this.runs(node) };
      case "Button":
        return {
          kind: "link",
          href: linkParts(node.props.href as LinkValue).href,
          style: { ...placed, textDecoration: "none" },
          children: [{ kind: "box", style: { ...boxStyle(node), width: node.width !== null ? pt(node.width) : undefined }, children: [{ kind: "text", of: node.path, style: { ...this.text(node), textAlign: "center" }, runs: this.runs(node) }] }],
        };
      case "Image":
        return this.image(node, placed);
      case "Link": {
        // A Link of words (a Menu's links too) is a run of text; one holding an Image, that image.
        const words = node.children.some((child) => typeof child === "string" || child.definition.categories.includes("inline"));
        return {
          kind: "link",
          href: linkParts(node.props.href as LinkValue).href,
          style: { ...placed, textDecoration: "none" },
          children: words ? [{ kind: "text", style: this.text(node), runs: this.runs(node) }] : present(nodes(node).map((child) => this.block(child, node))),
        };
      }
      case "Divider": {
        const line = node.style.borderTop as BorderSide | undefined;
        return { kind: "box", style: { ...boxStyle(node), ...placed, width: node.width !== null ? pt(node.width) : undefined }, children: [{ kind: "box", style: borderStyle(line ? { top: line } : undefined), children: [] }] };
      }
      case "Row": {
        // A Row of Columns goes on to the next page by its columns, each in its own place (each its own width), where
        // they sit at its top or are stretched down it and don't wrap.
        const columns = nodes(node);
        const splits = columns.length > 0 && columns.every((child) => child.type === "Column" && child.width !== null) && (node.style.alignItems ?? "start") !== "center" && node.style.alignItems !== "end" && node.style.flexWrap !== "wrap" && node.style.flexWrap !== "words";
        return {
          kind: "box",
          ...(splits ? { splits: "columns" as const } : {}),
          style: { ...boxStyle(node), ...placed, flexDirection: "row", ...gap(node), alignItems: flex(node.style.alignItems ?? "start"), justifyContent: flex(node.style.justifyContent) },
          children: present(columns.map((child) => this.block(child, node, true))),
        };
      }
      case "Layer":
        return this.layer(node, placed);
      case "List":
        return this.list(node, placed);
      case "Table":
        return this.table(node, placed);
      case "Video":
        return this.video(node, placed);
      case "Html":
        // A PDF can't draw markup: its plain text (validate() says so).
        // Its markup, in the print HTML, can't be cut between lines: it stays whole.
        return { kind: "text", style: { ...this.text(node), ...placed }, runs: [htmlText(node)] };
      case "Svg":
        return this.svg(node, placed);
      case "Section":
      case "Column":
      case "PageHeader":
      case "PageFooter":
        return { kind: "box", ...(node.type === "Section" || node.type === "Column" ? { splits: "children" as const } : {}), style: { ...boxStyle(node), ...placed, flexDirection: "column", ...gap(node), justifyContent: flex(node.style.justifyContent) }, children: present(nodes(node).map((child) => this.block(child, node))) };
      default:
        // Every block a Document takes is a case above (a test checks): one without a case fails rather than disappears.
        throw new Error(`[Elements] The PDF writer draws no ${node.type}`);
    }
  }

  /** A block of text's children: its words and runs (Span, Link, a line break, a merge tag, a page number). */
  runs(node: ResolvedNode, direction: Style = this.direction(node)): Run[] {
    return present(
      node.children.map((child): Run | undefined => {
        if (typeof child === "string") return child;
        if (!shown(child)) return undefined;
        switch (child.type) {
          case "LineBreak":
            return "\n";
          case "MergeTag":
            return `{{${child.props.name}}}`;
          case "PageNumber": {
            // Marked, so a page its text goes on to numbers it (flowDocument()).
            const numbers = this.numbersAt(node.path);
            return { kind: "span", style: {}, runs: [String(child.props.total ? numbers.total : numbers.number)], page: child.props.total ? "total" : "number" };
          }
          case "Link":
            return { kind: "link", href: linkParts(child.props.href as LinkValue).href, style: { ...runStyle(child, this.context.families), ...direction }, runs: this.runs(child, direction) };
          case "Image": {
            // In a line, an image the PDF can't draw (an SVG) keeps its room, left empty: one character of the line, as
            // the print HTML a plan draws counts it (and draws the image there).
            const image = this.image(child, {}, undefined, true);
            return image.kind === "image" ? image : { kind: "image", src: BLANK, style: { width: image.style.width, height: image.style.height } };
          }
          default:
            return { kind: "span", style: { ...runStyle(child, this.context.families), ...direction }, runs: this.runs(child, direction) };
        }
      })
    );
  }

  /** An Image; one the PDF can't draw (an SVG), its alt text in a box of its size, as a browser shows one it can't. */
  image(node: ResolvedNode, placed: Style, cover?: number, inline = false): Picture | Block {
    const { src, width, height } = assetParts(node.props.src as Asset);
    const drawn = node.width ?? width;
    const style: Style = { ...placed, ...boxStyle(node), width: drawn !== undefined && drawn !== null ? pt(drawn) : undefined };
    if (cover !== undefined) Object.assign(style, { width: "100%", height: pt(cover), objectFit: "cover" });
    else if (typeof node.style.height !== "number" && drawn && width && height) style.height = pt((drawn * height) / width);
    const source = this.context.image(src);
    // Its file's size, where its height isn't given: what an engine sizes it by.
    const size = source && style.height === undefined ? sized(source) : {};
    // A block with no width of its own given or known: as wide as its file, no wider than its parent (as the print HTML
    // and a browser show it). Without a width, react-pdf draws it 0 tall.
    if (source && size.size && style.width === undefined && cover === undefined && !inline) Object.assign(style, { width: pt(size.size.width), maxWidth: "100%" });
    if (source) return { kind: "image", src: source, style, ...size };
    const alt = String(node.props.alt ?? "");
    return { kind: "box", style: { ...style, objectFit: undefined, overflow: "hidden" }, children: alt ? [{ kind: "text", style: this.text(node), runs: [alt] }] : [] };
  }

  /** A Layer: its first child in place, the others over it, each in the Layer's whole box, placed by its alignment. */
  layer(node: ResolvedNode, placed: Style): Block {
    const [base, ...over] = nodes(node);
    const height = typeof node.style.height === "number" ? node.style.height : undefined;
    const under = base && (base.type === "Image" && height !== undefined ? this.image(base, {}, height) : this.block(base, node));
    return {
      kind: "box",
      style: { ...boxStyle(node), ...placed, position: "relative", overflow: node.style.borderRadius !== undefined ? "hidden" : undefined },
      children: present([
        under,
        ...over.map((child): Block => ({
          kind: "box",
          style: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, flexDirection: "column", justifyContent: flex(node.style.alignItems ?? "start"), alignItems: flex(node.style.justifyItems ?? "stretch") },
          children: present([this.block(child, node)]),
        })),
      ]),
    };
  }

  list(node: ResolvedNode, placed: Style): Block {
    const indent = typeof node.style.indent === "number" ? node.style.indent : 24;
    const start = Number(node.props.start ?? 1);
    return {
      kind: "box",
      splits: "children",
      style: { ...boxStyle(node), ...placed, flexDirection: "column", ...gap(node) },
      children: nodes(node).map((item, i): Block => ({
        kind: "box",
        path: item.path,
        style: { flexDirection: "row" },
        children: [
          { kind: "text", style: { ...this.text(item), width: pt(indent), textAlign: "left" }, runs: [node.props.type === "number" ? `${start + i}.` : "•"] },
          // Its text laid out at the room beside its marker: with a basis of its own, react-pdf's flexbox would lay it out
          // as wide as the item first and keep those lines, past the page's right margin.
          { kind: "box", style: { flexGrow: 1, flexShrink: 1, flexBasis: 0, flexDirection: "column" }, children: this.itemParts(item) },
        ],
      })),
    };
  }

  /** A list item's text and the Lists in it, in their order: each run of text a paragraph, each List under it. */
  itemParts(item: ResolvedNode): Block[] {
    const parts: Block[] = [];
    let text: ResolvedNode["children"] = [];
    const flush = () => {
      if (text.some((child) => typeof child !== "string" || child.trim() !== "")) parts.push({ kind: "text", style: this.text(item), runs: this.runs({ ...item, children: text }) });
      text = [];
    };
    for (const child of item.children) {
      if (typeof child !== "string" && child.type === "List") {
        flush();
        if (shown(child)) parts.push(this.list(child, {}));
      } else text.push(child);
    }
    flush();
    // A list item that's one paragraph: its text is the item's (`of` it).
    if (parts.length === 1 && parts[0].kind === "text") return [{ ...parts[0], of: item.path }];
    return parts;
  }

  table(node: ResolvedNode, placed: Style): Block {
    const columns = node.columns ?? null;
    const cellPadding = node.style.cellPadding as { top: number; right: number; bottom: number; left: number } | undefined;
    const rowBorder = node.style.rowBorder as BorderSide | undefined;
    const rows = nodes(node);
    return {
      kind: "box",
      splits: "rows",
      style: { ...boxStyle(node), ...placed, flexDirection: "column" },
      children: rows.map((row, r): Block => {
        let column = 0;
        return {
          kind: "box",
          path: row.path,
          ...(row.props.header ? { repeat: true } : {}),
          style: { flexDirection: "row", ...boxStyle(row), ...(r < rows.length - 1 && rowBorder ? borderStyle({ bottom: rowBorder }) : {}) },
          children: nodes(row).map((cell): Block => {
            const span = Math.max(1, Number(cell.props.colSpan ?? 1));
            const width = columns ? columns.slice(column, column + span).reduce((sum, w) => sum + w, 0) : undefined;
            column += span;
            const padding = cellPadding ? { paddingTop: pt(cellPadding.top), paddingRight: pt(cellPadding.right), paddingBottom: pt(cellPadding.bottom), paddingLeft: pt(cellPadding.left) } : {};
            return {
              kind: "box",
              path: cell.path,
              style: { ...padding, ...boxStyle(cell), width: width !== undefined ? pt(width) : undefined, flexGrow: width === undefined ? 1 : 0 },
              children: [{ kind: "text", of: cell.path, style: { ...this.text(cell), ...(row.props.header ? { fontWeight: 700 } : {}) }, runs: this.runs(cell) }],
            };
          }),
        };
      }),
    };
  }

  /** An Svg: its box in points, its shapes in its viewBox's units. */
  svg(node: ResolvedNode, placed: Style): Block {
    const { width, height, viewBox } = node.props as { width: number; height: number; viewBox?: string };
    const paint = (value: unknown) => (value === "transparent" ? "none" : (value as string | undefined));
    const KINDS: Record<string, Shape["kind"]> = { Rect: "rect", Circle: "circle", Ellipse: "ellipse", Line: "line", Polygon: "polygon", Path: "path" };
    const shapes = nodes(node)
      .filter((shape) => KINDS[shape.type])
      .map((shape): Shape => ({
        kind: KINDS[shape.type],
        attributes: { ...(shape.props as Record<string, string | number>), fill: paint(shape.style.fill), stroke: paint(shape.style.stroke), strokeWidth: shape.style.strokeWidth as number | undefined, opacity: shape.style.opacity as number | undefined },
      }));
    return {
      kind: "box",
      style: { ...boxStyle(node), ...placed, width: undefined },
      children: [{ kind: "drawing", width: pt(width), height: pt(height), viewBox: viewBox ?? `0 0 ${width} ${height}`, style: {}, shapes }],
    };
  }

  /** A Video: its thumbnail linked to it where its bytes are given, else a link with its title. */
  video(node: ResolvedNode, placed: Style): Block {
    const src = String(node.props.src);
    const thumbnail = thumbnailOf(node);
    const image = thumbnail ? this.context.image(thumbnail) : undefined;
    return {
      kind: "link",
      href: src,
      style: { ...placed, textDecoration: "none" },
      children: [image ? { kind: "image", src: image, style: { width: node.width !== null ? pt(node.width) : undefined }, ...sized(image) } : { kind: "text", style: this.text(node), runs: [String(node.props.title ?? "Video")] }],
    };
  }
}
