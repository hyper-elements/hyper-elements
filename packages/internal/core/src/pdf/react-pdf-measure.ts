/**
 * The page model (model.ts) measured as react-pdf lays it out, without drawing it: each block's box from its page's
 * top left, and a block of text's lines, as react-pdf.tsx reads them back from a drawn PDF (PlacedPage). So a
 * Document's pages can be planned before anything's drawn, and drawn once.
 *
 * A block of text's lines are react-pdf's own: its textkit, given the fonts react-pdf draws with (fontsOf()), the text
 * as react-pdf hands it over (its runs' styles, transforms, links, an image in a line). Every other size is the page
 * model's arithmetic, as react-pdf's flexbox lays it out: a block's width is its own, or its stack's, or (aligned in a
 * stack, or in a Row with no width) what it holds; a stack is its children's heights and its gaps, a Row its tallest
 * child (its children shrunk in proportion where they're wider than it, stretched or aligned down it), a Layer the
 * block under its layers (each laid over it), an image or a drawing its own height, a set height its own; padding and
 * borders inside it. A page holding a block it can't measure so is measured by drawing it instead: undefined.
 */
import { Font } from "@react-pdf/renderer";
import type { Fragment } from "@react-pdf/textkit";
import { lineEdges, type LaidOutLine, type LineEdges } from "./carets";
import type { Block, DrawnDocument, Font as FontFile, Page, PlacedBlock, PlacedFrame, PlacedLine, PlacedPage, Run, Style } from "./model";
import { faceOf, fontsOf, reactPdf } from "./react-pdf";
import { runsText } from "./runs";
import { SourceCache } from "./source-cache";

const OPTIONS = { shrinkWhitespaceFactor: { before: -0.5, after: -0.5 } };

/** react-pdf's text layout: its engine as its layout runs it, and what makes its text. */
export interface Textkit {
  engine: (text: unknown, container: object, options: object) => unknown[];
  fromFragments: (fragments: Fragment[]) => unknown;
}

let textkit: Promise<Textkit | undefined> | undefined;
/**
 * @react-pdf/textkit, loaded the first time a Document is measured (an optional peer: renderPdf() doesn't need it).
 * Undefined where it can't be loaded (not installed, or a CommonJS project that can't load it), or where it doesn't lay
 * text out as @react-pdf/renderer does (another version of it, installed beside the one react-pdf uses: agrees()):
 * then a Document is measured by drawing it.
 */
const loadTextkit = (): Promise<Textkit | undefined> =>
  (textkit ??= import("@react-pdf/textkit").then(
    async (module): Promise<Textkit | undefined> => {
      const kit: Textkit = {
        engine: module.default({ bidi: module.bidi, linebreaker: module.linebreaker, justification: module.justification, textDecoration: module.textDecoration, scriptItemizer: module.scriptItemizer, wordHyphenation: module.wordHyphenation, fontSubstitution: module.fontSubstitution }) as Textkit["engine"],
        fromFragments: module.fromFragments,
      };
      return (await agrees(kit)) ? kit : undefined;
    },
    () => undefined
  ));

/** A page of text that tells two textkits apart: justified, kerned, hyphenated, with quotes and figures. */
const PROBE: DrawnDocument = {
  date: new Date(0),
  fonts: [],
  pages: [
    {
      width: 300,
      height: 400,
      margin: { top: 30, right: 30, bottom: 30, left: 30 },
      background: "#ffffff",
      contentHeight: 340,
      content: [
        {
          kind: "text",
          path: "probe",
          style: { fontFamily: "Helvetica", fontSize: 11, textAlign: "justify" },
          runs: ["Typography: AVAWAY, Wolf, office efficiency, internationalization and characterization, “quoted” words and figures (1,234.56) on lines justified across the page."],
        },
      ],
    },
  ],
};

/**
 * Whether this textkit lays text out as @react-pdf/renderer draws it: the probe's lines (their characters and widths)
 * measured with it and drawn, within 0.05 points. Checked once, where it's loaded: a project with two versions of
 * textkit (one for react-pdf, another for this) measures by drawing, not by a textkit that breaks lines elsewhere.
 */
export async function agrees(kit: Textkit): Promise<boolean> {
  let drawn: PlacedBlock["lines"];
  try {
    await fonts.load({ fontFamily: "Helvetica", fontWeight: 400, fontStyle: "normal" });
    drawn = (await reactPdf(PROBE)).placed?.[0]?.blocks[0]?.lines;
  } catch {
    // Where a PDF can't be drawn (a browser's bundle, without what drawing needs), there's nothing to hold it to.
    return true;
  }
  // Where react-pdf says nothing of where it drew (an older one), there's nothing to hold it to either: as it was.
  if (!drawn) return true;
  try {
    const measured = measurePages(PROBE, (style) => style, kit)?.[0]?.blocks[0]?.lines;
    return !!measured && measured.length === drawn.length && measured.every((line, i) => line.text === drawn![i].text && Math.abs(line.width - drawn![i].width) <= 0.05);
  } catch {
    return false;
  }
}

/** react-pdf's font store, as react-pdf.tsx reaches it (its own types are closed). */
const fonts = Font as unknown as { load(descriptor: object): Promise<void>; getFont(descriptor: object): { data?: unknown } | undefined };

/** A block this can't measure without drawing: the page is measured by drawing it. */
class Unmeasured extends Error {}

const number = (value: unknown): number => (typeof value === "number" ? value : 0);
const edges = (style: Style) => ({
  top: number(style.paddingTop) + number(style.borderTopWidth),
  bottom: number(style.paddingBottom) + number(style.borderBottomWidth),
  left: number(style.paddingLeft) + number(style.borderLeftWidth),
  right: number(style.paddingRight) + number(style.borderRightWidth),
});
const set = (value: unknown): number | undefined => (typeof value === "number" ? value : undefined);
/** A block's own width, no wider than `room` where its maxWidth is all of it (an image as wide as its file: write.ts). */
const widthOf = (style: Style, room: number | undefined): number | undefined => {
  const own = set(style.width);
  return own !== undefined && style.maxWidth === "100%" && room !== undefined ? Math.min(own, room) : own;
};

/** The text styles a box hands what's in it, as react-pdf's styles inherit. */
const INHERITED = ["color", "fontFamily", "fontSize", "fontStyle", "fontWeight", "letterSpacing", "lineHeight", "textAlign", "textDecoration", "textTransform"];
const inheritedOf = (style: Style): Style => Object.fromEntries(INHERITED.filter((key) => style[key] !== undefined).map((key) => [key, style[key]]));

/** A run's style over the text's it's in: its own values where it has them. */
const over = (base: Style, own: Style): Style => ({ ...base, ...Object.fromEntries(Object.entries(own).filter(([, value]) => value !== undefined)) });

/** Text as react-pdf transforms it. */
function transformed(text: string, transform: unknown): string {
  switch (transform) {
    case "uppercase":
      return text.toUpperCase();
    case "lowercase":
      return text.toLowerCase();
    case "capitalize":
      return text.replace(/(^|\s)(\S)/g, (_, space: string, letter: string) => space + letter.toUpperCase());
    default:
      return text;
  }
}

/** A text style's font descriptors: its family's, then Helvetica, react-pdf's fallback. */
const descriptors = (style: Style) => [String(style.fontFamily ?? "Helvetica"), "Helvetica"].map((fontFamily) => ({ fontFamily, fontWeight: style.fontWeight ?? 400, fontStyle: style.fontStyle ?? "normal" }));

/**
 * react-pdf's font for a descriptor, looked up once (the store's lookup matches weights and styles). A family's
 * registered name is made from its files (react-pdf.tsx), so a name is always the same font; one not loaded isn't kept.
 */
const fontCache = new Map<string, unknown>();
const fontOf = (descriptor: object) => {
  const key = JSON.stringify(descriptor);
  const cached = fontCache.get(key);
  if (cached) return cached;
  const data = fonts.getFont(descriptor)?.data;
  if (data) fontCache.set(key, data);
  return data;
};

/** A line of a block of text as textkit laid it out: what's kept of it (so a cache of them holds little). */
interface Laid {
  /** Where textkit set its text across its box (its alignment). */
  x: number;
  y: number;
  width: number;
  height: number;
  ascent: number;
  text: string;
  /** Its glyphs' own advances (natural()), and textkit's advance for it (spacing and justification in). */
  natural: number;
  advance: number;
  /** Its characters' edges, from its box's left. */
  edges?: LineEdges;
  /** Its underlines and strike-throughs, from its box's left and its top. */
  decorations: NonNullable<PlacedLine["decorations"]>;
}

/**
 * Blocks of text laid out, by what's laid out (their text with its styles and fonts, and the width): a keystroke lays
 * out the one block it changes. The least recently used go first, past `size`.
 */
export class LineCache {
  private readonly entries = new Map<string, Laid[]>();
  /** How many blocks of text have been laid out, not found laid out. */
  laid = 0;

  constructor(readonly size = 10_000) {}

  get(key: string): Laid[] | undefined {
    const laid = this.entries.get(key);
    if (laid) {
      this.entries.delete(key);
      this.entries.set(key, laid);
    }
    return laid;
  }

  set(key: string, laid: Laid[]): void {
    this.entries.set(key, laid);
    if (this.entries.size > this.size) this.entries.delete(this.entries.keys().next().value!);
  }
}

/** A line's runs, each with the face its font draws (react-pdf.tsx's faceOf()). */
function withFaces(edges: LineEdges | undefined): LineEdges | undefined {
  if (!edges) return undefined;
  for (const run of edges.runs) {
    const font = run.attributes.font;
    const face = faceOf(Array.isArray(font) ? font[0] : font);
    if (face) run.face = face;
  }
  return edges;
}

/** A font's number in a cache's keys: the same font object, the same number. */
const fontIds = new WeakMap<object, number>();
let fonted = 0;
const fontId = (font: unknown): number => {
  if (!font || typeof font !== "object") return 0;
  let id = fontIds.get(font);
  if (id === undefined) fontIds.set(font, (id = ++fonted));
  return id;
};
/**
 * An image file's number in a cache's keys: the same file, the same number. The last used files are kept
 * (source-cache.ts: a server sees many); one seen again after is a number never given before, so no key is another file's.
 */
const srcIds = new SourceCache<number>();
let srcs = 0;
const srcId = (src: string | undefined): number => {
  if (src === undefined) return 0;
  let id = srcIds.get(src);
  if (id === undefined) srcIds.set(src, (id = ++srcs));
  return id;
};
/** What of a fragment's attributes lays it out or draws it (what's kept of its lines is drawn from too), in a fixed order. */
const LAYOUT = ["fontSize", "lineHeight", "direction", "verticalAlign", "characterSpacing", "link", "align", "color", "backgroundColor", "underline", "strike"] as const;
const keyOf = (fragments: Fragment[], width: number): string => {
  let key = String(width);
  for (const fragment of fragments) {
    const attributes = fragment.attributes as Record<string, unknown>;
    const attachment = attributes.attachment as { width: number; height: number; src?: string } | undefined;
    key += `\u0001${fragment.string}\u0000${(attributes.font as unknown[]).map(fontId).join(",")}`;
    for (const name of LAYOUT) key += `|${attributes[name] ?? ""}`;
    if (attachment) key += `|${attachment.width}x${attachment.height}@${srcId(attachment.src)}`;
  }
  return key;
};

class Measurer {
  /** Every block as it's laid out, with a path or not (a block after the blocks inside it). */
  readonly frames: PlacedFrame[] = [];
  /**
   * The tallest an image sized by its file is drawn: its page's height inside its margins, less react-pdf's 10 points
   * to spare (its measureImage's page area, before an image's own margins).
   */
  area = Infinity;

  constructor(
    readonly styled: (style: Style) => Style,
    private readonly kit: Textkit,
    private readonly cache?: LineCache,
    /**
     * The width each block of text was first offered to shrink to (as Yoga measures it at most that wide, in a box that's
     * as wide as what it holds): react-pdf lays out its lines at that width and keeps them (measureText), whatever its
     * box ends up as. Shared with the measurers that lay its blocks out again.
     */
    private readonly offered = new Map<Block, number>(),
    /**
     * Where it measures what it doesn't follow exactly (a paginator's, for a page view): each such block's path, its best
     * guess taken. Without, such a block isn't measured (Unmeasured: the page is measured by drawing it).
     */
    private readonly guesses?: string[]
  ) {}

  /** A block this doesn't follow exactly: not measured (Unmeasured), or, guessing, said (its path) and guessed. */
  refuse(path: string | undefined): void {
    if (!this.guesses) throw new Unmeasured();
    this.guesses.push(path ?? "root");
  }

  /**
   * A text style's textkit attributes, as react-pdf builds them (layout's getFragments): `inner`, a run's inside its
   * text (its background is drawn with its words; a text's own, with its box). `paint`, what it's drawn in: its fonts'
   * families, as the page model names them, and its weight and style.
   */
  attributes(style: Style, link?: string, inner = false): Record<string, unknown> {
    const resolved = this.styled(style);
    const fontSize = number(resolved.fontSize) || 18;
    // A run's own direction, which react-pdf hands down to nothing (its paragraph takes its first run's).
    const direction = style.direction === "rtl" ? "rtl" : "ltr";
    const color = resolved.color ?? "black";
    const decoration = String(resolved.textDecoration ?? "");
    const font = descriptors(resolved).map(fontOf);
    return {
      font,
      color,
      fontSize,
      lineHeight: resolved.lineHeight !== undefined ? number(resolved.lineHeight) * fontSize : undefined,
      direction,
      verticalAlign: resolved.verticalAlign,
      backgroundColor: inner ? resolved.backgroundColor : undefined,
      characterSpacing: resolved.letterSpacing,
      underline: /underline/.test(decoration),
      strike: /line-through/.test(decoration),
      underlineColor: color,
      strikeColor: color,
      link,
      align: resolved.textAlign ?? (direction === "rtl" ? "right" : "left"),
    };
  }

  /** A block of text's runs as textkit's fragments. */
  fragments(runs: Run[], style: Style, link?: string, out: Fragment[] = [], inner = false): Fragment[] {
    const attributes = this.attributes(style, link, inner);
    for (const run of runs) {
      if (typeof run === "string") out.push({ string: transformed(run, style.textTransform), attributes } as Fragment);
      else if (run.kind === "image") {
        const fontSize = number(attributes.fontSize);
        // Its file goes with it (what's drawn from its lines draws it: drawing.ts), not to textkit, which only sizes it.
        out.push({ string: "￼", attributes: { ...attributes, attachment: { width: set(run.style.width) ?? fontSize, height: set(run.style.height) ?? fontSize, image: {}, src: run.src } } } as unknown as Fragment);
      } else this.fragments(run.runs, { ...over(style, run.style), direction: run.style.direction }, run.kind === "link" ? run.href : link, out, true);
    }
    return out;
  }

  /** A block of text's lines at `width`: each line's box and characters, as react-pdf lays them out (or as it laid them out before). */
  lines(block: Extract<Block, { kind: "text" }>, width: number): Laid[] {
    const fragments = this.fragments(block.runs, block.style);
    if (!fragments.length) return [];
    const key = this.cache && keyOf(fragments, width);
    const cached = key === undefined ? undefined : this.cache!.get(key);
    if (cached) return cached;
    const paragraphs = this.kit.engine(this.kit.fromFragments(fragments), { x: 0, y: 0, width, height: Infinity }, OPTIONS);
    const lines = paragraphs.flat() as unknown as Array<
      LaidOutLine & {
        box: { x: number; y: number; width: number; height: number };
        ascent?: number;
        xAdvance?: number;
        decorationLines?: Array<{ rect: { x: number; y: number; width: number; height: number }; color?: string; style?: string }>;
        runs: Array<{ glyphs?: Array<{ advanceWidth?: number }>; attributes?: Record<string, unknown> }>;
      }
    >;
    const laid = lines.map((line) => ({
      x: line.box.x,
      y: line.box.y,
      width: line.box.width,
      height: line.box.height,
      ascent: number(line.ascent),
      text: line.string,
      natural: natural(line),
      advance: number(line.xAdvance),
      edges: withFaces(lineEdges(line)),
      // Drawn from its box's left and top (react-pdf's renderLine).
      decorations: (line.decorationLines ?? []).map(({ rect, color, style }) => ({ x: line.box.x + rect.x, y: rect.y, width: rect.width, height: rect.height, color: color ?? "black", style: style ?? "solid" })),
    }));
    if (key !== undefined) {
      this.cache!.set(key, laid);
      this.cache!.laid++;
    }
    return laid;
  }

  /**
   * A block laid out at (x, y), `width` wide where its style sets none (or, `exactly`, whatever it sets): its height.
   * `tall`, the height its stack's or Row's flexbox gives it (grown down a stack, stretched across a Row), where its style
   * sets none.
   */
  block(block: Block, x: number, y: number, width: number | undefined, exactly = false, inherited: Style = {}, tall?: number): number {
    const style = "style" in block ? over(inherited, block.style) : inherited;
    let own = exactly ? width : (widthOf(style, width) ?? width);
    if (own === undefined) {
      this.refuse(block.path);
      own = 0;
    }
    const frame = edges(style);
    let inner = own - frame.left - frame.right;
    // Padding and borders wider than its box: Yoga's clamping of it isn't followed here.
    if (inner < -0.001) {
      this.refuse(block.path);
      inner = 0;
    }
    let height: number;
    let lines: PlacedBlock["lines"];
    let boxes: PlacedLine[] | undefined;
    switch (block.kind) {
      case "text": {
        // At the width react-pdf's flexbox hands its text layout, held in a 32-bit float: the width it was first offered
        // to shrink to, where it was (its lines kept from then, and moved back by what aligning them in it moved them:
        // measureText's alignOffset), else its own.
        const offered = this.offered.get(block);
        const laid = this.lines({ ...block, style }, Math.fround(offered ?? inner));
        const widest = Math.max(0, ...laid.map((line) => line.advance));
        const alignOffset = offered === undefined ? 0 : (offered - widest) * (style.textAlign === "center" ? 0.5 : style.textAlign === "right" ? 1 : 0);
        const first = laid[0]?.y ?? 0;
        lines = laid.map((line) => ({ top: y + number(style.paddingTop) + line.y - first, height: line.height, text: line.text, width: line.width, natural: line.natural }));
        // react-pdf draws a text from its box's left and left padding (renderText), each line where textkit set it.
        boxes = laid.map((line, i) => ({ text: line.text, x: x + number(style.paddingLeft) - alignOffset, top: lines![i].top, height: line.height, ascent: line.ascent, ...(line.edges ? { edges: line.edges } : {}), ...(line.decorations.length ? { decorations: line.decorations } : {}) }));
        // Where a caret goes with no character to go by: in an empty block of text, or after the line break it ends in
        // (textkit lays out no line after it). A line of its style with nothing in it (a zero-width space), taking no room.
        const text = runsText(block.runs, style);
        if (text !== undefined && (!laid.length || text.endsWith("\n"))) {
          const blank = this.lines({ ...block, style, runs: ["\u200b"] }, Math.fround(inner))[0];
          const last = boxes[boxes.length - 1];
          if (blank) boxes.push({ text: "", x: x + number(style.paddingLeft) + blank.x, top: last ? last.top + last.height : y + number(style.paddingTop), height: blank.height, ascent: blank.ascent, blank: true });
        }
        const content = laid.reduce((sum, line) => sum + line.height, 0);
        height = set(style.height) ?? tall ?? content + frame.top + frame.bottom;
        break;
      }
      case "image": {
        const given = set(style.height) ?? tall;
        if (given !== undefined) {
          height = given;
          break;
        }
        // No height of its own: as react-pdf sizes it (measureImage). With no width either, it's offered its room across
        // and takes it all, with no height: drawn 0 tall. With a width, its width over its file's ratio, no taller than
        // its page's area. A file whose size can't be read isn't measured (react-pdf sizes it by its decoded size).
        if (set(style.width) === undefined) {
          height = frame.top + frame.bottom;
          break;
        }
        if (!block.size) {
          this.refuse(block.path);
          height = frame.top + frame.bottom;
          break;
        }
        const room = this.area - number(style.marginTop) - number(style.marginBottom);
        // Never less than none: on a page too short for any of it, Yoga has it 0 tall.
        height = Math.max(0, Math.min(room, Math.fround(inner) / (block.size.width / block.size.height))) + frame.top + frame.bottom;
        break;
      }
      case "drawing":
        height = block.height + frame.top + frame.bottom;
        break;
      case "box":
      case "link": {
        // What it holds is laid out whatever its height: a set height is its box's, not what's in it.
        const fixed = set(style.height) ?? tall;
        const content = this.children(block, x + frame.left, y + frame.top, inner, fixed === undefined ? undefined : fixed - frame.top - frame.bottom, inheritedOf(style));
        height = fixed ?? content + frame.top + frame.bottom;
        break;
      }
    }
    this.frames.push({ block, style, ...(block.path !== undefined ? { path: block.path } : {}), x, y, width: own, height, ...(lines ? { lines } : {}), ...(boxes ? { boxes } : {}) });
    return height;
  }

  /**
   * A box's children laid out from (x, y) in `width`: their height, as a column, a row or a Layer's. `room`, the height
   * a box with a set height holds them in (or one grown or stretched to it): a column's child that grows takes what its
   * children leave of it, else its justifyContent places them down it; a Row's children stretched are as tall.
   */
  children(block: Extract<Block, { kind: "box" | "link" }>, x: number, y: number, width: number, room?: number, inherited: Style = {}): number {
    const style = block.style;
    const gap = number(style.gap);
    const children = block.children;
    if (style.position === "relative" && children.some((child) => "style" in child && child.style.position === "absolute")) {
      // A Layer: the block under its layers sets its height; each layer is laid over all of it, taking no room.
      const layered = (child: Block) => "style" in child && child.style.position === "absolute";
      const height = children.filter((child) => !layered(child)).reduce((max, child) => Math.max(max, this.block(child, x, y, width, false, inherited)), 0);
      // Each layer over all of the Layer: as tall as its own room, where it has a height of its own.
      for (const layer of children.filter(layered)) this.overlay(layer as Extract<Block, { kind: "box" }>, x, y, width, room ?? height, inherited);
      return height;
    }
    if (style.flexDirection === "row") return this.row(block, x, y, width, inherited, room);
    // A stack: each child under the last, as wide as the stack unless it has a width of its own, or is aligned (not
    // stretched) across it, when it's as wide as what it holds.
    let at = y;
    const laid: Array<{ from: number; to: number; x: number; y: number; width: number; height: number }> = [];
    children.forEach((child, i) => {
      const style = "style" in child ? child.style : {};
      // Its side margins (a painted line's, past its box so it never wraps: paint.ts) narrow or widen its room.
      const left = number(style.marginLeft);
      const room = width - left - number(style.marginRight);
      const aligned = style.alignSelf !== undefined && style.alignSelf !== "stretch";
      const own = widthOf(style, room) ?? (aligned ? Math.min(room, this.intrinsic(child, room)) : room);
      const across = left + (style.alignSelf === "center" ? (room - own) / 2 : style.alignSelf === "flex-end" ? room - own : 0);
      const from = this.frames.length;
      const height = this.block(child, x + across, at, own, true, inherited);
      laid.push({ from, to: this.frames.length, x: x + across, y: at, width: own, height });
      at += height + (i < children.length - 1 ? gap : 0);
    });
    const used = at - y;
    // In a box of a set height, the space its children leave: a child that grows takes it (in proportion to its
    // flexGrow), laid out again that tall, those under it moved down; else its justifyContent puts it.
    const free = room === undefined ? 0 : room - used;
    const grows = children.map((child) => ("style" in child ? number(child.style.flexGrow) : 0));
    const growth = grows.reduce((sum, grow) => sum + grow, 0);
    if (free > 0 && growth > 0) {
      let down = 0;
      laid.forEach((entry, i) => {
        if (!grows[i]) {
          if (down) this.shift(entry.from, entry.to, down);
          return;
        }
        const extra = (free * grows[i]) / growth;
        this.again(entry.from, entry.to, (measurer) => measurer.block(children[i], entry.x, entry.y + down, entry.width, true, inherited, entry.height + extra));
        down += extra;
      });
      return room!;
    }
    const ranges = laid.map(({ from, to }): [number, number] => [from, to]);
    if (free > 0) {
      const justify = style.justifyContent;
      ranges.forEach(([from, to], i) => {
        const down = justify === "center" ? free / 2 : justify === "flex-end" ? free : justify === "space-between" && ranges.length > 1 ? (free / (ranges.length - 1)) * i : 0;
        if (down) this.shift(from, to, down);
      });
    }
    return used;
  }

  /**
   * A Layer's layer: a column over the whole Layer (`width` by `height`), its blocks down it where its justifyContent
   * puts them, across it where its alignItems does (stretched, or as wide as what each holds).
   */
  overlay(layer: Extract<Block, { kind: "box" }>, x: number, y: number, width: number, height: number, inherited: Style = {}): void {
    const inside = over(inherited, inheritedOf(layer.style));
    const style = layer.style;
    const from = this.frames.length;
    let at = y;
    for (const child of layer.children) {
      const childStyle = "style" in child ? child.style : {};
      const align = childStyle.alignSelf ?? style.alignItems ?? "stretch";
      const own = widthOf(childStyle, width) ?? (align === "stretch" ? width : Math.min(width, this.intrinsic(child, width)));
      const across = align === "center" ? (width - own) / 2 : align === "flex-end" ? width - own : 0;
      at += this.block(child, x + across, at, own, true, inside);
    }
    // Text laid over a Layer that wraps: react-pdf lays an absolute box's text out at a width of its own (wider, where
    // the Layer is in a Row's column), and keeps its lines, which this doesn't follow. A line on its own is the same at
    // any width.
    const laid = this.frames.slice(from);
    const said = laid.find((placed) => placed.path !== undefined)?.path;
    if (laid.some((placed) => placed.block.kind === "text" && (placed.lines?.length ?? 0) > 1)) this.refuse(said);
    const used = at - y;
    // As tall as the Layer, within its 32-bit rounding: react-pdf lays its text out again in its box's height, and a
    // line a hair taller than that isn't drawn. Which way it goes isn't followed here.
    if (Math.abs(used - height) <= 0.05 && laid.some((placed) => placed.block.kind === "text")) this.refuse(said);
    // Taller than the Layer: react-pdf lays its text out again in its box, too short for it, and draws none of it (0
    // tall, no lines). What else is in it (an image) isn't followed.
    if (used > height + 0.05) {
      if (laid.some((placed) => placed.block.kind === "image" || placed.block.kind === "drawing")) this.refuse(said);
      for (const placed of this.frames.slice(from)) {
        if (placed.block.kind === "text") {
          placed.height = 0;
          delete placed.lines;
          delete placed.boxes;
        }
      }
      this.frames.push({ block: layer, style: over(inherited, style), ...(layer.path !== undefined ? { path: layer.path } : {}), x, y, width, height });
      return;
    }
    const down = style.justifyContent === "center" ? (height - used) / 2 : style.justifyContent === "flex-end" ? height - used : 0;
    if (down) this.shift(from, this.frames.length, down);
    // The layer itself, over all of the Layer (a block after the blocks inside it): what's drawn from it starts here.
    this.frames.push({ block: layer, style: over(inherited, style), ...(layer.path !== undefined ? { path: layer.path } : {}), x, y, width, height });
  }

  /** The blocks placed from `from` up to `to` laid out again (`lay`, by a measurer of their own): as many, in their place. */
  again(from: number, to: number, lay: (measurer: Measurer) => void): void {
    const measurer = new Measurer(this.styled, this.kit, this.cache, this.offered, this.guesses);
    measurer.area = this.area;
    lay(measurer);
    this.frames.splice(from, to - from, ...measurer.frames);
  }

  /** The blocks placed from `from` up to `to` moved `down`, their lines with them. */
  shift(from: number, to: number, down: number): void {
    for (const placed of this.frames.slice(from, to)) {
      placed.y += down;
      if (placed.lines) placed.lines = placed.lines.map((line) => ({ ...line, top: line.top + down }));
      if (placed.boxes) placed.boxes = placed.boxes.map((line) => ({ ...line, top: line.top + down }));
    }
  }

  /**
   * A Row's children side by side (its gap between): each its own width, else as wide as what it holds (its text's
   * widest line at most the row's width, as react-pdf measures it), else (one that grows) a share of what's left; where
   * they're wider than the row, each narrower in proportion to its width, as react-pdf's flexbox shrinks them. Its
   * height is its tallest child's; a child stretched to it (the row's alignItems or its own alignSelf) is drawn that tall,
   * a centered or end-aligned one placed down it.
   */
  row(block: Extract<Block, { kind: "box" | "link" }>, x: number, y: number, width: number, inherited: Style = {}, room?: number): number {
    const style = block.style;
    const gap = number(style.gap);
    const children = block.children;
    const grows = (child: Block) => "style" in child && set(child.style.width) === undefined && number(child.style.flexGrow) > 0;
    // An image with no width across a Row is sized by Yoga's flexbox and react-pdf's measureImage together, which
    // this doesn't follow: not measured.
    for (const child of children) if (child.kind === "image" && set(child.style.width) === undefined) this.refuse(child.path);
    const widths = children.map((child) => (grows(child) ? 0 : ("style" in child ? widthOf(child.style, width) : undefined) ?? this.intrinsic(child, width)));
    const gaps = gap * Math.max(0, children.length - 1);
    const fixed = widths.reduce((sum, w) => sum + w, 0);
    const growing = children.filter(grows).length;
    if (fixed + gaps > width + 0.001 && fixed > 0) {
      const factor = (fixed + gaps - width) / fixed;
      widths.forEach((w, i) => (widths[i] = w - w * factor));
    }
    const share = growing ? Math.max(0, width - fixed - gaps) / growing : 0;
    // The room its children leave across it, where its justifyContent puts it (a child that grows takes it all).
    const free = growing ? 0 : Math.max(0, width - fixed - gaps);
    const justify = style.justifyContent;
    const between = justify === "space-between" && children.length > 1 ? free / (children.length - 1) : 0;
    let at = x + (justify === "center" ? free / 2 : justify === "flex-end" ? free : 0);
    const laid = children.map((child, i) => {
      const childWidth = grows(child) ? share : widths[i];
      const from = this.frames.length;
      const height = this.block(child, at, y, childWidth, true, inherited);
      const entry = { child, from, to: this.frames.length, height, x: at, width: childWidth };
      at += childWidth + gap + between;
      return entry;
    });
    const tallest = Math.max(0, ...laid.map((entry) => entry.height));
    // Its children's height across it: its own (or what its stack grew or stretched it to), else its tallest child's.
    const across = room ?? tallest;
    for (const entry of laid) {
      const { child, from, to, height } = entry;
      const align = ("style" in child ? child.style.alignSelf : undefined) ?? style.alignItems ?? "stretch";
      if (align === "stretch" && !("style" in child && set(child.style.height) !== undefined) && height !== across) {
        // A box stretched is laid out again that tall (what's in it grows or is placed down it); text is drawn that tall.
        if (child.kind === "box" || child.kind === "link") this.again(from, to, (measurer) => measurer.block(child, entry.x, y, entry.width, true, inherited, across));
        else {
          const own = this.frames.slice(from, to).find((placed) => placed.block === child);
          if (own) own.height = across;
        }
      }
      const down = align === "center" ? (across - height) / 2 : align === "flex-end" ? across - height : 0;
      if (down) this.shift(from, to, down);
    }
    return tallest;
  }

  /** How wide a block with no width of its own is in a Row `available` wide: what it holds, as react-pdf measures it. */
  intrinsic(block: Block, available: number): number {
    const style = "style" in block ? block.style : {};
    const own = widthOf(style, available);
    if (own !== undefined) return own;
    const frame = edges(style);
    const room = available - frame.left - frame.right;
    switch (block.kind) {
      case "text": {
        // Laid out at the room it's offered, as react-pdf lays it out once (measureText): its lines are those from then.
        if (!this.offered.has(block)) this.offered.set(block, room);
        const widest = Math.max(0, ...this.lines(block, this.offered.get(block)!).map((line) => line.advance));
        return Math.min(room, widest) + frame.left + frame.right;
      }
      case "image": {
        // As react-pdf's measureImage offers it `room` at most: all of it, where it has no height; else its height
        // times its file's ratio, no wider.
        const height = set(style.height);
        if (height === undefined) return available;
        if (!block.size) {
          this.refuse(block.path);
          return available;
        }
        return Math.min((height - frame.top - frame.bottom) * (block.size.width / block.size.height), room) + frame.left + frame.right;
      }
      case "drawing":
        return block.width + frame.left + frame.right;
      case "box":
      case "link": {
        const children = block.children.map((child) => this.intrinsic(child, room));
        const inner = block.style.flexDirection === "row" ? children.reduce((sum, w) => sum + w, 0) + number(block.style.gap) * Math.max(0, children.length - 1) : Math.max(0, ...children);
        return inner + frame.left + frame.right;
      }
    }
  }
}

/** A laid-out line's glyphs' own advances, in points (react-pdf.tsx's naturalWidth, on textkit's line). */
function natural(line: { runs: Array<{ glyphs?: Array<{ advanceWidth?: number }>; attributes?: Record<string, unknown> }> }): number {
  return line.runs.reduce((sum, run) => {
    const font = (Array.isArray(run.attributes?.font) ? run.attributes!.font[0] : run.attributes?.font) as { unitsPerEm?: number } | undefined;
    const scale = number(run.attributes?.fontSize) / (font?.unitsPerEm ?? 1000);
    return sum + (run.glyphs ?? []).reduce((width, glyph) => width + (glyph.advanceWidth ?? 0) * scale + number(run.attributes?.characterSpacing), 0);
  }, 0);
}

/** Every font descriptor a page's text names, to load each before measuring (as react-pdf loads them before laying out). */
function named(blocks: Array<Block | undefined>, styled: (style: Style) => Style, out = new Map<string, object>()): Map<string, object> {
  const runs = (items: Run[], style: Style) => {
    for (const run of items) {
      if (typeof run !== "string" && run.kind !== "image") {
        const inner = over(style, run.style);
        for (const descriptor of descriptors(styled(inner))) out.set(JSON.stringify(descriptor), descriptor);
        runs(run.runs, inner);
      }
    }
  };
  for (const block of blocks) {
    if (!block) continue;
    if (block.kind === "text") {
      for (const descriptor of descriptors(styled(block.style))) out.set(JSON.stringify(descriptor), descriptor);
      runs(block.runs, block.style);
    } else if (block.kind === "box" || block.kind === "link") named(block.children, styled, out);
  }
  return out;
}

/** A page measured: its header, its content from below the header (its gap between), its footer at the bottom of its room. */
function measurePage(page: Page, styled: (style: Style) => Style, kit: Textkit, cache?: LineCache, guesses?: string[]): PlacedPage {
  const area = page.height - page.margin.top - page.margin.bottom - 10;
  const measurer = new Measurer(styled, kit, cache, undefined, guesses);
  measurer.area = area;
  const left = page.margin.left;
  const width = page.width - page.margin.left - page.margin.right;
  const header = page.header ? measurer.block(page.header, left, page.margin.top, width) : 0;
  // The footer's height first (measured aside), to know where the room ends and the footer starts.
  const aside = new Measurer(styled, kit, cache, undefined, guesses);
  aside.area = area;
  const footer = page.footer ? aside.block(page.footer, left, 0, width) : 0;
  const top = page.margin.top + header;
  const bottom = page.margin.top + page.contentHeight - footer;
  // Its content a column at least as tall as the room (react-pdf.tsx), so a part that goes on to the next page fills it.
  measurer.children({ kind: "box", style: { flexDirection: "column", gap: page.gap }, children: page.content }, left, top, width, bottom - top);
  if (page.footer) measurer.block(page.footer, left, bottom, width);
  return { room: { top, bottom }, blocks: placedOf(measurer.frames), frames: measurer.frames };
}

/**
 * The blocks with a path, as they were laid out: a block whose text is a text of its own (`of` it: a ListItem's, a
 * TableCell's, a Button's, a part drawn line by line) with that text's lines.
 */
function placedOf(frames: readonly PlacedFrame[]): PlacedBlock[] {
  const texts = new Map<string, PlacedLine[]>();
  for (const frame of frames) {
    if (frame.block.kind !== "text" || frame.path !== undefined || frame.block.of === undefined || !frame.boxes) continue;
    texts.set(frame.block.of, [...(texts.get(frame.block.of) ?? []), ...frame.boxes]);
  }
  return frames.flatMap(({ path, x, y, width, height, lines, boxes }): PlacedBlock[] => {
    if (path === undefined) return [];
    const own = boxes ?? texts.get(path);
    return [{ path, x, y, width, height, ...(lines ? { lines } : {}), ...(own ? { boxes: own } : {}) }];
  });
}

/** Each page measured; undefined where a page holds a block this can't measure so. */
function measurePages(document: DrawnDocument, styled: (style: Style) => Style, kit: Textkit, cache?: LineCache, guesses?: string[]): PlacedPage[] | undefined {
  try {
    return document.pages.map((page) => measurePage(page, styled, kit, cache, guesses));
  } catch (error) {
    if (error instanceof Unmeasured) return undefined;
    throw error;
  }
}

/**
 * Each page as react-pdf lays it out, without drawing it; undefined where a page holds a block this can't measure so
 * (the caller then measures by drawing).
 */
export async function reactPdfLayout(document: DrawnDocument): Promise<PlacedPage[] | undefined> {
  const kit = await loadTextkit();
  if (!kit) return undefined;
  const styled = await fontsOf(document.fonts);
  for (const descriptor of named(document.pages.flatMap((page) => [page.header, ...page.content, page.footer]), styled).values()) {
    try {
      await fonts.load(descriptor);
    } catch {
      // A font react-pdf can't load fails where it's drawn, as it does when drawing.
    }
  }
  return measurePages(document, styled, kit);
}

/** The standard PDF fonts, in the weights and styles they're drawn in: what a Document draws text in without a file of its own. */
const STANDARD = ["Helvetica", "Times-Roman", "Courier"].flatMap((fontFamily) => [400, 700].flatMap((fontWeight) => ["normal", "italic"].map((fontStyle) => ({ fontFamily, fontWeight, fontStyle }))));

/**
 * A measurer for Documents drawn in these fonts, ready to measure without waiting: textkit and the fonts loaded once,
 * and each block of text laid out once (`cache`) until what it holds or its width changes.
 */
export interface Layout {
  /**
   * Each page as react-pdf lays it out, without drawing it (as reactPdfLayout() measures it); undefined where a page holds
   * a block this can't measure so, or text in a font it wasn't made with.
   */
  measure(document: DrawnDocument): PlacedPage[] | undefined;
  /**
   * Each page measured as measure() does, and what it doesn't follow exactly guessed (`guesses`: each such block's
   * path, the first where its pages may first differ from the PDF's); undefined only for text in a font it wasn't made
   * with.
   */
  guess(document: DrawnDocument): { placed: PlacedPage[]; guesses: string[] } | undefined;
  /** How many blocks of text it has laid out with textkit, not found laid out before: for a test, or a profile. */
  readonly laid: number;
}

/** A Layout for these fonts; undefined where textkit can't be loaded. `size`: how many blocks of text it keeps laid out. */
export async function createLayout(files: readonly FontFile[], size?: number): Promise<Layout | undefined> {
  const kit = await loadTextkit();
  if (!kit) return undefined;
  const styled = await fontsOf(files);
  for (const descriptor of STANDARD) {
    try {
      await fonts.load(descriptor);
    } catch {
      // Drawn where it's drawn, as react-pdf draws it.
    }
  }
  const cache = new LineCache(size);
  // The fonts it was made with only: text in another can't be measured before it's loaded.
  const loaded = (document: DrawnDocument) => {
    const made = (font: FontFile) => files.some((file) => file.data === font.data && file.family === font.family && file.weight === font.weight && file.style === font.style);
    if (!document.fonts.every(made)) return false;
    for (const descriptor of named(document.pages.flatMap((page) => [page.header, ...page.content, page.footer]), styled).values()) {
      if (!fontOf(descriptor)) return false;
    }
    return true;
  };
  return {
    measure(document) {
      return loaded(document) ? measurePages(document, styled, kit, cache) : undefined;
    },
    guess(document) {
      if (!loaded(document)) return undefined;
      const guesses: string[] = [];
      const placed = measurePages(document, styled, kit, cache, guesses);
      return placed && { placed, guesses };
    },
    get laid() {
      return cache.laid;
    },
  };
}
