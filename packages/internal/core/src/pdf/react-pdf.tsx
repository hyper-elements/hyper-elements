/**
 * The page model (model.ts) drawn by react-pdf: with react-pdf-measure.ts (which measures it without drawing), the only
 * files that import an engine. Another engine is other files like these, drawing the same pages; the writer doesn't
 * change.
 *
 * react-pdf lays out the boxes (Yoga's flexbox) at the widths the writer gives them and breaks the lines, and says
 * where it laid each block out (placed(), from the layout its render hands a Document's onRender).
 */
import { Circle, Document, Ellipse, Font, Image, Line, Link, Page, Path, Polygon, Rect, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { createElement, type ReactElement, type ReactNode } from "react";
import { base64, fingerprint, sha256 } from "./bytes";
import { lineEdges, type LaidOutLine } from "./carets";
import type { Block, Engine, Font as FontFile, PlacedBlock, PlacedLine, PlacedPage, Run, Shape, Style } from "./model";

/** The names fonts are registered under with react-pdf (whose registry is the process's, shared by every render). */
const registered = new Set<string>();

/**
 * A font file as base64 and its digest, made once a file (a server gives the same file's bytes to every render), and
 * again where its buffer now holds other bytes (its quick hash: fingerprint()).
 */
const encoded = new WeakMap<Uint8Array, { data: string; digest: string; check: number }>();
const encode = (bytes: Uint8Array) => {
  const check = fingerprint(bytes);
  let out = encoded.get(bytes);
  if (!out || out.check !== check) encoded.set(bytes, (out = { data: base64(bytes), digest: sha256(bytes), check }));
  return out;
};

/**
 * Each family registered under a name made from it and its files (so a render draws a family from the files it was
 * given, never from ones another render gave under the same name, and a family's files are registered once), with the
 * styles its files are in: by family. Its name goes in: the same files given as two families are two fonts, each drawn
 * as the family it was given as (faceOf()).
 */
function register(fonts: readonly FontFile[]): Map<string, { name: string; styles: Set<string>; files: Array<{ weight: number; style: string }> }> {
  const byFamily = new Map<string, Array<{ data: string; digest: string; weight: number; style: string }>>();
  for (const font of fonts) byFamily.set(font.family, [...(byFamily.get(font.family) ?? []), { ...encode(font.data), weight: font.weight, style: font.style }]);
  const names = new Map<string, { name: string; styles: Set<string>; files: Array<{ weight: number; style: string }> }>();
  for (const [family, files] of byFamily) {
    const name = `elements-${sha256(new TextEncoder().encode(`${family}\n${files.map((file) => `${file.weight}|${file.style}|${file.digest}\n`).join("")}`)).slice(0, 32)}`;
    if (!registered.has(name)) {
      for (const file of files) Font.register({ family: name, src: `data:font/ttf;base64,${file.data}`, fontWeight: file.weight, fontStyle: file.style as "normal" | "italic" });
      registered.add(name);
    }
    names.set(family, { name, styles: new Set(files.map((file) => file.style)), files: files.map(({ weight, style }) => ({ weight, style })) });
  }
  return names;
}

/** A font react-pdf loaded, as what it's drawn in: the family the page model names, its weight and its style. */
export interface Face {
  family: string;
  weight: number;
  style: string;
}

const faces = new WeakMap<object, Face>();

/**
 * The face a font react-pdf loaded draws: a given file's, by its family as the page model names it; a standard PDF
 * font's from its name ("Helvetica-BoldOblique": Helvetica, 700, italic).
 */
export function faceOf(font: unknown): Face | undefined {
  if (!font || typeof font !== "object") return undefined;
  const given = faces.get(font);
  if (given) return given;
  const name = (font as { fullName?: unknown; name?: unknown }).fullName ?? (font as { name?: unknown }).name;
  if (typeof name !== "string") return undefined;
  const family = /^Times/.test(name) ? "Times-Roman" : /^Courier/.test(name) ? "Courier" : /^Helvetica/.test(name) ? "Helvetica" : undefined;
  if (!family) return undefined;
  return { family, weight: /Bold/.test(name) ? 700 : 400, style: /Oblique|Italic/.test(name) ? "italic" : "normal" };
}

/** The fonts whose glyph lookups are mended (below): each once. */
const mended = new WeakSet<object>();

type Glyph = { codePoints?: number[] };
type Fontkit = { getGlyph(id: number, characters?: number[]): Glyph | null };

/**
 * A family's fonts loaded, each with its glyph lookup mended. fontkit keeps a glyph by its id with the characters of the
 * lookup that first made it, and react-pdf keeps one font for the process. A composite glyph's parts are made with
 * none: writing "é" makes the "e" it's drawn from, with no character, when the PDF's subset is written. Every later
 * PDF then draws "e" with that glyph, and its text (copied, searched, read aloud) has no "e". So a lookup with
 * characters gives them to a glyph made without any.
 */
async function load(name: string, files: ReadonlyArray<{ weight: number; style: string }>): Promise<void> {
  for (const file of files) {
    const descriptor = { fontFamily: name, fontWeight: file.weight, fontStyle: file.style as "normal" | "italic" };
    try {
      await (Font as unknown as { load(descriptor: object): Promise<void> }).load(descriptor);
    } catch {
      // A file fontkit can't read fails where it's drawn, as it did before: a document that never uses it is drawn.
      continue;
    }
    const font = (Font as unknown as { getFont(descriptor: object): { data?: unknown } | undefined }).getFont(descriptor)?.data as Fontkit | undefined;
    if (!font || typeof font.getGlyph !== "function" || mended.has(font)) continue;
    const getGlyph = font.getGlyph;
    font.getGlyph = function (id, characters) {
      const glyph = getGlyph.call(this, id, characters);
      if (glyph && characters?.length && !glyph.codePoints?.length) glyph.codePoints = characters;
      return glyph;
    };
    mended.add(font);
  }
}

const SHAPES: Record<Shape["kind"], unknown> = { rect: Rect, circle: Circle, ellipse: Ellipse, line: Line, polygon: Polygon, path: Path };

/** An element of react-pdf's, from the model's plain props (react-pdf's own types are closed unions of its style keys). */
const el = (type: unknown, props: Record<string, unknown>, ...children: ReactNode[]): ReactElement => createElement(type as never, props as never, ...children);

/**
 * The fonts given, registered with react-pdf and loaded; and a style with its family as react-pdf has it: a given family
 * by the name it's registered under, a standard PDF font as it is. react-pdf finds the nearest weight a family is given
 * in, but throws for a style it has no file in: that text is drawn in the style it has. What drawing and measuring
 * share (react-pdf-measure.ts), so both have the same fonts.
 */
export async function fontsOf(fonts: readonly FontFile[]): Promise<(style: Style) => Style> {
  const names = register(fonts);
  for (const { name, files } of names.values()) await load(name, files);
  // Each file's font, by the family the page model names it, its weight and its style (faceOf()).
  for (const [family, { name, files }] of names) {
    for (const file of files) {
      const font = (Font as unknown as { getFont(descriptor: object): { data?: unknown } | undefined }).getFont({ fontFamily: name, fontWeight: file.weight, fontStyle: file.style })?.data;
      if (font && typeof font === "object") faces.set(font, { family, weight: file.weight, style: file.style });
    }
  }
  return (style) => {
    const family = style.fontFamily === undefined ? undefined : names.get(String(style.fontFamily));
    if (!family) return style;
    const fontStyle = family.styles.has(String(style.fontStyle ?? "normal")) ? style.fontStyle : [...family.styles][0];
    return { ...style, fontFamily: family.name, fontStyle };
  };
}

export const reactPdf: Engine = async (document, options = {}) => {
  const styled = await fontsOf(document.fonts);
  const run = (item: Run, key: number): ReactNode => {
    if (typeof item === "string") return item;
    switch (item.kind) {
      case "span":
        return el(Text, { key, style: styled(item.style) }, item.runs.map(run));
      case "link":
        return el(Link, { key, src: item.href, style: styled(item.style) }, item.runs.map(run));
      case "image":
        return el(Image, { key, src: item.src, style: item.style });
    }
  };
  const block = (item: Block, key?: number): ReactElement => {
    // A block that draws a design node carries its path, so where it's laid out can be read back (placed(), below).
    const path = item.path !== undefined ? { [PATH]: item.path } : {};
    switch (item.kind) {
      case "box":
        return el(View, { key, ...path, style: styled(item.style) }, item.children.map(block));
      case "text":
        return el(Text, { key, ...path, ...(item.of !== undefined && item.path === undefined ? { [OF]: item.of } : {}), style: styled(item.style) }, item.runs.map(run));
      case "image":
        return el(Image, { key, ...path, src: item.src, style: item.style });
      case "link":
        return el(Link, { key, ...path, src: item.href, style: styled(item.style) }, item.children.map(block));
      case "drawing":
        return el(
          Svg,
          { key, ...path, width: item.width, height: item.height, viewBox: item.viewBox },
          item.shapes.map((shape, i) => el(SHAPES[shape.kind], { key: i, ...shape.attributes }))
        );
    }
  };
  const pages = document.pages.map((page, index) =>
    el(
      Page,
      {
        key: index,
        size: [page.width, page.height],
        style: { paddingTop: page.margin.top, paddingRight: page.margin.right, paddingBottom: page.margin.bottom, paddingLeft: page.margin.left, backgroundColor: page.background, flexDirection: "column" },
      },
      // The page's box inside its margins, which nothing leaves: what doesn't fit is cut, not moved on.
      el(
        View,
        { wrap: false, style: { height: page.contentHeight, overflow: "hidden", flexDirection: "column" } },
        page.header && block(page.header),
        // The content laid out at its own height and cut where the page ends: react-pdf squeezes text into a box's
        // height (lines drawn over each other), not into one placed on its own.
        el(
          View,
          { [ROOM]: true, style: { flexGrow: 1, flexShrink: 1, overflow: "hidden", position: "relative" } },
          // At least the room's height (never held to it), so a part that goes on to the next page can fill the rest of it.
          el(View, { style: { position: "absolute", top: 0, left: 0, right: 0, minHeight: "100%", flexDirection: "column", ...(page.gap !== undefined ? { gap: page.gap } : {}) } }, page.content.map(block))
        ),
        page.footer && block(page.footer)
      )
    )
  );
  let layout: LaidOutNode | undefined;
  const onRender = (rendered?: { _INTERNAL__LAYOUT__DATA_?: LaidOutNode }) => {
    layout = rendered?._INTERNAL__LAYOUT__DATA_;
  };
  const element = el(Document, { title: document.title, language: document.lang, creationDate: document.date, modificationDate: document.date, producer: "Hyper Elements", creator: "Hyper Elements", onRender }, pages);
  const pdf = new Uint8Array(await renderToBuffer(element as never));
  return { pdf, placed: layout && placed(layout, options.edges === true) };
};

/** The props that mark a block's path and the content's room on a page, read back from the layout. */
const PATH = "elementsPath";
const ROOM = "elementsRoom";
/** The prop that marks a text that's the text of the block with a path it's in (model.ts's `of`). */
const OF = "elementsOf";

/**
 * A node as react-pdf lays it out (what its render hands a Document's onRender, as `_INTERNAL__LAYOUT__DATA_`): its box
 * from its parent's top left, the parent's padding inside it, in points; a block of text's lines, from its first.
 */
interface LaidOutNode {
  type: string;
  props?: Record<string, unknown>;
  box?: { top: number; left: number; width: number; height: number; paddingTop?: number; paddingLeft?: number };
  /** How far left of its box react-pdf draws a text it laid out wider than it is (one as wide as what it holds). */
  alignOffset?: number;
  lines?: Array<{ box: { x: number; y: number; width: number; height: number }; string?: string; ascent?: number; runs?: LaidOutRun[] }>;
  children?: LaidOutNode[];
}

/** A run of a laid-out line: its glyphs' own advances, in its font's units, and its size and spacing. */
interface LaidOutRun {
  glyphs?: Array<{ advanceWidth?: number; codePoints?: number[] }>;
  attributes?: { fontSize?: number; characterSpacing?: number; font?: Array<{ unitsPerEm?: number }> | { unitsPerEm?: number } };
}

/** A line's glyphs' own advances, in points: as wide as it would be with no spacing added or taken. */
function naturalWidth(line: NonNullable<LaidOutNode["lines"]>[number]): number {
  return (line.runs ?? []).reduce((sum, run) => {
    const font = Array.isArray(run.attributes?.font) ? run.attributes!.font[0] : run.attributes?.font;
    const scale = (run.attributes?.fontSize ?? 0) / (font?.unitsPerEm ?? 1000);
    return sum + (run.glyphs ?? []).reduce((width, glyph) => width + (glyph.advanceWidth ?? 0) * scale + (run.attributes?.characterSpacing ?? 0), 0);
  }, 0);
}

/**
 * Where each page's blocks were laid out, from react-pdf's layout: undefined where it has none or another shape (a
 * react-pdf that hands its onRender another layout), so the caller says what it can without it.
 */
function placed(document: LaidOutNode, withEdges: boolean): PlacedPage[] | undefined {
  if (!Array.isArray(document.children)) return undefined;
  const pages: PlacedPage[] = [];
  for (const page of document.children) {
    let room: PlacedPage["room"] | undefined;
    const blocks: PlacedBlock[] = [];
    /** `gathering`: the lines of the texts with no path in the block with a path they're in (a part drawn line by line). */
    const visit = (node: LaidOutNode, top: number, left: number, gathering?: PlacedLine[]) => {
      if (!node.box) return;
      const y = top + node.box.top;
      const x = left + node.box.left;
      if (node.props?.[ROOM]) room = { top: y, bottom: y + node.box.height };
      const path = node.props?.[PATH];
      // react-pdf draws a text's lines from its top, inside its padding, from its first line's y, and from its left,
      // inside its padding, less its alignOffset, each line where textkit set it (renderText, renderLine).
      const first = node.lines?.[0]?.box.y ?? 0;
      const top0 = y + (node.box.paddingTop ?? 0) - first;
      const boxes: PlacedLine[] | undefined = node.lines?.map((line) => {
        const edges = withEdges && line.runs && line.string !== undefined ? lineEdges(line as unknown as LaidOutLine) : undefined;
        return { text: line.string ?? "", x: x + (node.box!.paddingLeft ?? 0) - (node.alignOffset ?? 0), top: top0 + line.box.y, height: line.box.height, ascent: line.ascent ?? 0, ...(edges ? { edges } : {}) };
      });
      let gathered = gathering;
      if (typeof path === "string") {
        const placedBlock: PlacedBlock = { path, x, y, width: node.box.width, height: node.box.height };
        if (node.lines?.length) {
          placedBlock.lines = node.lines.map((line) => ({ top: top0 + line.box.y, height: line.box.height, text: line.string ?? "", width: line.box.width, natural: naturalWidth(line) }));
          placedBlock.boxes = boxes;
        } else {
          gathered = [];
        }
        blocks.push(placedBlock);
        for (const child of node.children ?? []) visit(child, y, x, gathered);
        if (gathered?.length && !node.lines?.length) placedBlock.boxes = gathered;
        return;
      }
      if (boxes?.length && node.props?.[OF] !== undefined) gathering?.push(...boxes);
      for (const child of node.children ?? []) visit(child, y, x, gathered);
    };
    visit(page, 0, 0);
    if (!room) return undefined;
    pages.push({ room, blocks });
  }
  return pages;
}
