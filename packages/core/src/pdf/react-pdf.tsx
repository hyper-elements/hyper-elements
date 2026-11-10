/**
 * The page model (model.ts) drawn by react-pdf: the only file that imports an engine. Another engine is another file
 * like this one, drawing the same pages; the writer doesn't change.
 *
 * react-pdf lays out the boxes (Yoga's flexbox) at the widths the writer gives them and breaks the lines.
 */
import { createHash } from "node:crypto";
import { Circle, Document, Ellipse, Font, Image, Line, Link, Page, Path, Polygon, Rect, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { createElement, type ReactElement, type ReactNode } from "react";
import type { Block, Engine, Font as FontFile, Run, Shape, Style } from "./model";

/** The names fonts are registered under with react-pdf (whose registry is the process's, shared by every render). */
const registered = new Set<string>();

const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

/**
 * Each family registered under a name made from its files (so a render draws a family from the files it was given,
 * never from ones another render gave under the same name, and the same files are registered once), with the styles
 * its files are in: by family.
 */
function register(fonts: readonly FontFile[]): Map<string, { name: string; styles: Set<string>; files: Array<{ weight: number; style: string }> }> {
  const byFamily = new Map<string, Array<{ data: string; weight: number; style: string }>>();
  for (const font of fonts) byFamily.set(font.family, [...(byFamily.get(font.family) ?? []), { data: base64(font.data), weight: font.weight, style: font.style }]);
  const names = new Map<string, { name: string; styles: Set<string>; files: Array<{ weight: number; style: string }> }>();
  for (const [family, files] of byFamily) {
    const hash = createHash("sha256");
    for (const file of files) hash.update(`${file.weight}|${file.style}|${file.data}\n`);
    const name = `elements-${hash.digest("hex").slice(0, 32)}`;
    if (!registered.has(name)) {
      for (const file of files) Font.register({ family: name, src: `data:font/ttf;base64,${file.data}`, fontWeight: file.weight, fontStyle: file.style as "normal" | "italic" });
      registered.add(name);
    }
    names.set(family, { name, styles: new Set(files.map((file) => file.style)), files: files.map(({ weight, style }) => ({ weight, style })) });
  }
  return names;
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

export const reactPdf: Engine = async (document) => {
  const names = register(document.fonts);
  for (const { name, files } of names.values()) await load(name, files);
  // A given family by the name it's registered under; a standard PDF font as it is. react-pdf finds the nearest weight
  // a family is given in, but throws for a style it has no file in: that text is drawn in the style it has.
  const styled = (style: Style): Style => {
    const family = style.fontFamily === undefined ? undefined : names.get(String(style.fontFamily));
    if (!family) return style;
    const fontStyle = family.styles.has(String(style.fontStyle ?? "normal")) ? style.fontStyle : [...family.styles][0];
    return { ...style, fontFamily: family.name, fontStyle };
  };
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
    switch (item.kind) {
      case "box":
        return el(View, { key, style: styled(item.style) }, item.children.map(block));
      case "text":
        return el(Text, { key, style: styled(item.style) }, item.runs.map(run));
      case "image":
        return el(Image, { key, src: item.src, style: item.style });
      case "link":
        return el(Link, { key, src: item.href, style: styled(item.style) }, item.children.map(block));
      case "drawing":
        return el(
          Svg,
          { key, width: item.width, height: item.height, viewBox: item.viewBox },
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
          { style: { flexGrow: 1, flexShrink: 1, overflow: "hidden", position: "relative" } },
          el(View, { style: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "column", ...(page.gap !== undefined ? { gap: page.gap } : {}) } }, page.content.map(block))
        ),
        page.footer && block(page.footer)
      )
    )
  );
  const element = el(Document, { title: document.title, language: document.lang, creationDate: document.date, modificationDate: document.date, producer: "Hyper Elements", creator: "Hyper Elements" }, pages);
  return new Uint8Array(await renderToBuffer(element as never));
};
