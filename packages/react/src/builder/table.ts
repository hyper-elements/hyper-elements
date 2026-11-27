/**
 * A Table as the builder's table, in an Email, a Page or a Document. Its rows are split as the print HTML splits them:
 * the header rows at its top are the table's header, the rows from its first footer row on its footer, the rest its
 * rows. Each column's width is its share of the table, each cell's words its rich text.
 *
 * What a part's rows share is the table's fields for that part (its header's, its content's, its footer's): their text
 * styles, background, padding and vertical alignment, from the part's first row (the content's from the Table). A
 * cell's own, where it differs: its color, alignment, padding and background in its cell's fields; its other text
 * styles in its rich text, its line height in its paragraph's style. A cell across columns is one cell of the
 * builder's, with its `colSpan`; a row's and a cell's id are theirs in the builder's too.
 *
 * Its lines are the builder's as it draws them: the same lines around every cell are its border, the line between
 * rows its `rowBorder`, any other line a cell has its cell's own border, and the border around the Table its
 * `tableBorder`. Its width and max width are the builder's too.
 *
 * An Email's or a Page's Table is the builder's table only where the builder draws it as it is: an HTML block of its
 * markup draws it exactly there, so a table the builder would draw otherwise stays one, and the report says why. A
 * Document's is always the builder's table (the builder doesn't draw an HTML block in a document), what it draws
 * otherwise said.
 */
import type { Border, BorderSide, Json, Node, ResolvedNode } from "@hyper-elements/core";
import { leftOut } from "./hide";
import { cellJson } from "./runs";
import { builderBorder, builderFont, cssPx, cssSides, fieldLineHeight, type Values } from "./values";

type Sides = { top: number; right: number; bottom: number; left: number };
const ZERO: Sides = { top: 0, right: 0, bottom: 0, left: 0 };

/** What the table needs from the design it's in. */
export interface TablePlace {
  at(path: string): ResolvedNode;
  report: string[];
}

interface Part {
  node: Node;
  own: ResolvedNode;
  path: string;
}

/** The styles a part's rows share: what its fields hold. */
interface Shared {
  text: ResolvedNode["text"];
  background: string | undefined;
}

/** No lines, on every side: the builder's own default is a grey line around each cell. */
const NO_BORDER: Values = Object.fromEntries(["Top", "Left", "Right", "Bottom"].flatMap((side) => [[`border${side}Width`, "0px"], [`border${side}Style`, "solid"], [`border${side}Color`, "transparent"]]));

const SIDES = ["top", "right", "bottom", "left"] as const;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const paddingOf = (node: ResolvedNode): Sides => (node.style.padding as Sides | undefined) ?? ZERO;
const spanOf = (cell: ResolvedNode) => Math.max(1, Number(cell.props.colSpan) || 1);
const share = (n: number) => Math.round(n * 100) / 100;

/** What a row or a cell has that the builder's table holds, by path. */
const ROW_FIELDS = ["props.header", "props.footer", "style.backgroundColor", "style.height", "style.color", "style.fontFamily", "style.fontSize", "style.fontWeight", "style.fontStyle", "style.lineHeight", "style.letterSpacing", "style.textAlign", "style.textTransform"];
const CELL_FIELDS = [...ROW_FIELDS.slice(2), "props.colSpan", "props.dir", "style.padding", "style.border", "style.width", "style.verticalAlign", "style.textDecoration"];

/** Whether a node holds an Image anywhere in it (a linked one too). */
const holdsImage = (node: Node): boolean => (node.children ?? []).some((child) => typeof child !== "string" && (child.type === "Image" || holdsImage(child)));

/** Whether a node, or anything in it, is hidden on phones or on desktops. */
const hides = (node: Node): boolean => Boolean(node.hidden?.mobile || node.hidden?.desktop) || (node.children ?? []).some((child) => typeof child !== "string" && hides(child));

/**
 * Whether a node holds words: text that isn't only spaces that collapse (a non-breaking space doesn't: it's a word), a
 * line break or a merge tag, anywhere in it.
 */
export const holdsWords = (node: Node): boolean => (node.children ?? []).some((child) => (typeof child === "string" ? /[^ \t\n\r\f]/.test(child) : child.type === "LineBreak" || child.type === "MergeTag" || holdsWords(child)));

/** Whether a node holds a run with a font size of its own anywhere in it. */
const holdsSize = (node: Node): boolean => (node.children ?? []).some((child) => typeof child !== "string" && (child.style?.fontSize !== undefined || holdsSize(child)));

/** A line height as CSS: a multiple without a unit ("normal" is Elements' 1.2), px as it is. */
const cssLineHeightOf = (value: ResolvedNode["text"]["lineHeight"]): string => (typeof value === "number" ? String(value) : value === "normal" ? "1.2" : value);

/** A color's alpha, from 0 (clear) to 1: transparent, rgba(…), hsla(…), #rgba, #rrggbbaa; any other color's is 1. */
const alphaOf = (color: string): number => {
  const text = color.trim().toLowerCase();
  if (text === "transparent") return 0;
  const hex = /^#(?:[0-9a-f]{3}([0-9a-f])|[0-9a-f]{6}([0-9a-f]{2}))$/.exec(text);
  if (hex) return parseInt(hex[1] ? hex[1] + hex[1] : hex[2], 16) / 255;
  const alpha = /^(?:rgba?|hsla?)\((.*)\)$/.exec(text)?.[1].split(/[\s,/]+/).filter(Boolean)[3];
  return alpha === undefined ? 1 : alpha.endsWith("%") ? parseFloat(alpha) / 100 : parseFloat(alpha);
};

/** A color with no alpha: what's behind it shows. */
const clear = (color: string) => alphaOf(color) === 0;

/** A color partly see-through: the builder's cell paints it over what's behind the table, not over the table's own color. */
const halfClear = (color: unknown) => typeof color === "string" && alphaOf(color) > 0 && alphaOf(color) < 1;

/** A background that paints: none where it's clear, so what's behind it shows. */
export const opaque = (color: unknown) => (typeof color === "string" && color && !clear(color) ? color : undefined);

/** What of a Table the builder's table has a field for. */
export const TABLE_FIELDS = ["style.color", "style.fontFamily", "style.fontSize", "style.fontWeight", "style.fontStyle", "style.lineHeight", "style.letterSpacing", "style.textAlign", "style.textTransform", "style.backgroundColor", "style.cellPadding", "style.rowBorder"];

/** What the builder's table draws otherwise: `what` said in full in a Document, `why` in short where it stays an HTML block. */
interface Said {
  at: string;
  what: string;
  why: string;
}

/** What of a node isn't in `fields`: props, styles, phone and hover values. */
function unheld(node: Node, fields: readonly string[]): string[] {
  return (["props", "style", "mobile", "hover"] as const).flatMap((part) => Object.keys(node[part] ?? {}).map((key) => `${part}.${key}`)).filter((path) => !fields.includes(path));
}

/** An id the builder's table writes in its HTML: one that isn't like the builder's own, which start with `u_`. */
export const writtenId = (id: string) => !id.startsWith("u_");

/** Whether a side of a border draws a line: a width, in a style that isn't none or hidden. */
export const drawsLine = (line: BorderSide | undefined) => !!line && line.width > 0 && line.style !== "none" && (line.style as string) !== "hidden";

/** A width or a max width in px, in a place `room` px wide; undefined for one in another unit. */
const pxIn = (value: Json | undefined, room: number) => {
  if (typeof value === "number") return value;
  const text = typeof value === "string" ? value.trim() : "";
  if (/^\d+(\.\d+)?px$/.test(text)) return parseFloat(text);
  if (/^\d+(\.\d+)?%$/.test(text)) return (room * parseFloat(text)) / 100;
  return undefined;
};

/** A width or a max width the builder's table draws: px, or a percentage of its place. */
const drawn = (value: Json | undefined) => (typeof value === "number" ? value > 0 : typeof value === "string" && /^\d+(\.\d+)?(px|%)$/.test(value.trim()) && parseFloat(value) > 0);

/**
 * The Table as the builder's table takes it, and what it draws otherwise (`note`). In a Row its width is its
 * column's share, as Elements draws it, not the table's own too; so is a max width in %, which Elements takes of the
 * row: the column has it, and the table fills the column. A Document's row doesn't narrow, so there it's px of the
 * row; an Email's or a Page's columns stack on phones, where Elements' table keeps that share of the screen and the
 * builder's fills its column (an HTML block in the column would too). A border that draws no line is no border.
 */
export function builderTableNode(node: Node, path: string, place: TablePlace, parent: ResolvedNode): { node: Node; note?: string } {
  const style = { ...node.style };
  let note: string | undefined;
  if (parent.type === "Row") {
    delete style.width;
    const max = style.maxWidth;
    if (typeof max === "string" && /^\d+(\.\d+)?%$/.test(max.trim()) && parseFloat(max) < 100) {
      const row = parent.contentWidth ?? parent.available;
      if (place.at("root").type === "Document" && row !== null) style.maxWidth = Math.round(((row * parseFloat(max)) / 100) * 100) / 100;
      else {
        delete style.maxWidth;
        // (A Row that doesn't stack keeps its columns side by side on phones too, so the share is the same there.)
        if (parent.props.stackOnMobile !== false) note = "a max width in % of a Table in a Row is its column's in the builder's table: on phones, where the columns stack, the table fills its column";
      }
    }
  }
  const border = place.at(path).style.border as Border | undefined;
  if (style.border !== undefined && !SIDES.some((side) => drawsLine(border?.[side]))) delete style.border;
  return { node: { ...node, style }, note };
}

/**
 * A Table's values for the builder's table, or why it can't be one (it's an HTML block then): no rows, an image in a
 * cell, a row or a cell hidden on a device, or, in an Email or a Page, anything the builder would draw otherwise.
 * `align` is where a block narrower than its place sits in it.
 */
export function tableValues(node: Node, path: string, place: TablePlace, align: "left" | "center" | "right" | "justify" = "left"): Values | string {
  const own = place.at(path);
  const exact = place.at("root").type !== "Document";
  const partsOf = (parent: Node, at: string): Part[] =>
    (parent.children ?? []).flatMap((child, i) => (typeof child === "string" ? [] : [{ node: child, own: place.at(`${at}.children[${i}]`), path: `${at}.children[${i}]` }]));
  const rows = partsOf(node, path);
  const cellsOf = (row: Part) => partsOf(row.node, row.path);
  if (!rows.length) return "a table with no rows isn't one the builder's table holds";
  if (rows.flatMap(cellsOf).some((cell) => holdsImage(cell.node))) return "an Image in a table cell isn't something the builder's table holds";
  // An Email or a Page can hide a row, a cell or words in a cell on phones or on desktops (a Document can't), which the
  // builder's table and its rich text can't.
  if (rows.some((row) => hides(row.node))) return "a table row, cell or words in a cell hidden on phones or on desktops isn't something the builder's table holds";

  const said: Said[] = [];
  const say = (at: string, what: string, why: string) => said.push({ at, what, why });
  const head = rows.findIndex((row) => !row.own.props.header);
  const header = head < 0 ? rows : rows.slice(0, head);
  const rest = head < 0 ? [] : rows.slice(head);
  const foot = rest.findIndex((row) => row.own.props.footer);
  // (A table of header or footer rows only has no rows between them, which the builder's table takes as it is.)
  const body = foot < 0 ? rest : rest.slice(0, foot);
  const footer = foot < 0 ? [] : rest.slice(foot);
  for (const row of rest.filter((row) => row.own.props.header)) {
    say(row.path, "a header row below the table's first rows is a row of the builder's table, its words in bold: the builder's table has its header at its top only", "a header row below its first rows");
  }
  // A row below a footer row is drawn in the footer by Elements too, so it's drawn as it is: it only comes back a footer row.
  const noted = footer.filter((row) => !row.own.props.footer).map((row) => `${row.path}: a row below a footer row is a row of the builder's footer, which runs from the first footer row on as Elements' does: it comes back a footer row`);

  const count = Math.max(1, ...rows.map((row) => cellsOf(row).reduce((sum, cell) => sum + spanOf(cell.own), 0)));
  const laidOut = own.columns && own.columns.length === count ? own.columns : new Array<number>(count).fill(1);
  // Each column's width as it's given, on its first cell of one column, as Elements lays it out. Where each is a
  // percentage or none, they're the shares as given (those with none share what's left equally): laid out, they're whole
  // px, which would be a fraction of a percent off, and again on each trip.
  const given = new Array<number | null | undefined>(count).fill(undefined);
  for (const row of rows) {
    let column = 0;
    for (const { own: cell } of cellsOf(row)) {
      const width = cell.style.width;
      if (spanOf(cell) === 1 && given[column] == null) given[column] = width === undefined ? null : typeof width === "string" && /^\d+(\.\d+)?%$/.test(width.trim()) ? parseFloat(width) : NaN;
      column += spanOf(cell);
    }
  }
  const free = given.filter((width) => width == null).length;
  const left = Math.max(0, 100 - given.reduce<number>((all, width) => all + (width ?? 0), 0)) / (free || 1);
  // Laid out, columns sharing the width equally are a px apart at most (whole px): they're equal shares here, so any
  // other difference, however small, is the design's own.
  const widths = given.every((width) => !Number.isNaN(width))
    ? given.map((width) => width ?? left)
    : Math.max(...laidOut) > 1 && Math.max(...laidOut) - Math.min(...laidOut) <= 1
      ? new Array<number>(count).fill(1)
      : laidOut;
  const sum = widths.reduce((all, width) => all + width, 0);
  const total = sum || 1;
  // The builder takes a share of 0 for none and draws its default there: a column with no width beside wider ones is the
  // least share it keeps. (Where no column has a width, its defaults share the table equally, as Elements' do.)
  const widthOf = (column: number) => (sum > 0 ? Math.max(0.01, share((widths[column] / total) * 100)) : 0);
  const padding = (own.style.cellPadding as Sides | undefined) ?? ZERO;
  const tableBackground = opaque(own.style.backgroundColor);

  // What's behind a row or a cell: its own color, else what shows through it (a transparent one's too).
  const paintOf = (row: Part) => opaque(row.own.style.backgroundColor) ?? tableBackground;
  // A part's background is its rows', where they all have the same one; else the table's, each row's own on its cells. (The
  // builder paints a part's field behind all its rows: its canvas on the <thead>, under a cell that's clear.)
  const backgroundOf = (part: Part[]) => {
    const painted = part.map(paintOf);
    return painted.every((color) => color === painted[0]) ? painted[0] : tableBackground;
  };
  const sharedBy = (part: Part[], fallback: ResolvedNode): Shared => ({ text: (part[0]?.own ?? fallback).text, background: part[0] ? backgroundOf(part) : tableBackground });
  const content: Shared = { text: own.text, background: backgroundOf(body) };
  const heading = sharedBy(header, own);
  const ending = sharedBy(footer, own);

  /** A part's fields: what its rows share. The content's have its line height and letter spacing, which the others' don't. */
  const fields = (prefix: "header" | "content" | "footer", shared: Shared): Values => ({
    [`${prefix}FontFamily`]: builderFont(String(shared.text.fontFamily)),
    [`${prefix}BackgroundColor`]: shared.background ?? "",
    [`${prefix}FontWeight`]: shared.text.fontWeight,
    [`${prefix}FontSize`]: cssPx(shared.text.fontSize),
    [`${prefix}Color`]: shared.text.color,
    [`${prefix}TextAlign`]: shared.text.textAlign,
    // A cell's words start at its top in Elements; the builder's own default is its middle.
    [`${prefix}VerticalAlign`]: "top",
    ...(prefix === "content" ? { contentLineHeight: fieldLineHeight(shared.text.lineHeightPx / shared.text.fontSize), contentLetterSpacing: cssPx(shared.text.letterSpacing ?? 0) } : {}),
    [`${prefix}Padding`]: cssSides(padding),
  });

  const lost: string[] = [];
  let spanned = false;
  let ragged = false;
  const lines = cellBorders(rows, cellsOf, own);
  /** A row's or a cell's id, where it has one: said where the builder keeps it and doesn't write it. */
  const idOf = (part: Part, what: string): Values => {
    const id = part.node.id;
    if (id === undefined) return {};
    if (!writtenId(id)) say(part.path, `the builder's table writes no id that starts with u_, as its own ids do: ${what}'s is kept in the design, and isn't in the builder's HTML`, `${what}'s id the builder doesn't write`);
    return { id };
  };

  /**
   * A row as the builder's: each cell (one per column it spans), its height the least its words need. `spacedInCells`
   * where its part has no line height or letter spacing field (a header, a footer): they're its cells' own.
   */
  const rowOf = (row: Part, shared: Shared, spacedInCells: boolean): Values => {
    const last = row === rows[rows.length - 1];
    const id = idOf(row, "a row");
    const background = (cell?: ResolvedNode) => opaque(cell?.style.backgroundColor) ?? paintOf(row);
    const paint = (cell?: ResolvedNode): Values => {
      const out: Values = {};
      const color = background(cell);
      if ((color ?? "") !== (shared.background ?? "")) out.backgroundColor = color ?? "transparent";
      const pad = cell ? paddingOf(cell) : padding;
      if (cssSides(pad) !== cssSides(padding)) out.padding = cssSides(pad);
      const vertical = (cell?.style.verticalAlign as string | undefined) ?? "top";
      if (vertical !== "top") out.verticalAlign = vertical;
      return out;
    };
    let column = 0;
    const cells = cellsOf(row).map((part) => {
      const { node: cellNode, own: cell } = part;
      const text = cell.text;
      // Its own size is its paragraph's, so its lines are as tall as its words', not its part's size's.
      const fontSize = text.fontSize !== shared.text.fontSize ? text.fontSize : undefined;
      const around: Record<string, Json> = {};
      if (text.fontWeight !== shared.text.fontWeight) around.fontWeight = text.fontWeight;
      if (text.fontFamily !== shared.text.fontFamily) around.fontFamily = String(text.fontFamily);
      if (text.fontStyle !== "normal") around.fontStyle = text.fontStyle;
      if (text.textTransform !== "none") around.textTransform = text.textTransform;
      if (cell.style.textDecoration !== undefined) around.textDecoration = cell.style.textDecoration as Json;
      // Only the content has a letter spacing and a line height of its own: a header's or a footer's is the cell's.
      if ((text.letterSpacing ?? 0) !== (spacedInCells ? 0 : (shared.text.letterSpacing ?? 0))) around.letterSpacing = text.letterSpacing;
      // Its line height as it's given, a multiple (without a unit) or px, where it isn't its part's field's, or a font size
      // of its own (its runs' or the cell's) is in it: the field's percentage is a length its words inherit, a multiple
      // each one's size multiplies, as Elements' does.
      const sized = fontSize !== undefined || holdsSize(cellNode);
      const lineHeight = spacedInCells || sized || !same(text.lineHeight, shared.text.lineHeight) ? cssLineHeightOf(text.lineHeight) : undefined;
      const span = spanOf(cell);
      // A cell across columns is as wide as they are together.
      const width = share(Array.from({ length: span }, (_, i) => widthOf(column + i)).reduce((sum, w) => sum + w, 0));
      const values: Values = { textJson: cellJson(cellNode, lost, around, { fontSize, lineHeight, dir: cell.props.dir as string | undefined }), width, ...paint(cell), ...idOf(part, "a cell") };
      if (span > 1) values.colSpan = span;
      if (span > 1000) say(part.path, "a cell across more than 1000 columns is across 1000 in the builder's table, which has no more", "a cell across more than 1000 columns");
      if (text.color !== shared.text.color) values.color = text.color;
      if (text.textAlign !== shared.text.textAlign) values.textAlign = text.textAlign;
      const border = lines.of(cell, last);
      if (border) values.border = border;
      if (span > 1) spanned = true;
      column += span;
      return values;
    });
    if (column < count) ragged = true;
    // A row with fewer cells than the table's columns: the builder's has a cell for each.
    for (; column < count; column++) cells.push({ textJson: cellJson({ type: "TableCell" }, lost, {}), width: widthOf(column), ...paint() });
    // Its cells' line and padding; a row with no cells, its part's line.
    const pad = (cell: ResolvedNode) => paddingOf(cell).top + paddingOf(cell).bottom;
    // The builder's row is a line tall in each cell, words or not; the Table's empty cell is as tall as its padding.
    const drawn = cellsOf(row).map(({ own: cell }) => cell.text.lineHeightPx + pad(cell));
    const worded = cellsOf(row).map(({ node: cellNode, own: cell }) => (holdsWords(cellNode) ? cell.text.lineHeightPx : 0) + pad(cell));
    const least = Math.ceil(drawn.length ? Math.max(...drawn) : row.own.text.lineHeightPx);
    const real = Math.ceil(worded.length ? Math.max(...worded) : 0);
    // A row of no height of its own is the Table's least: its words' line, an empty cell's padding. The builder draws a line
    // in each cell however low its row is (measured in its canvas and its HTML), and takes 0 for none (its 50px default),
    // so it's 1px at least. fromDesign() reads only a height above that as the row's own.
    const given = row.own.style.height;
    const height = typeof given === "number" && given > 0 ? given : Math.max(1, real);
    if (least > Math.max(typeof given === "number" ? given : 0, real)) {
      say(row.path, "an empty cell is a line tall in the builder's table and as tall as its padding in the Table, so the row is taller in the builder's", "an empty cell, a line tall in the builder's");
    }
    return { cells, height, ...id };
  };

  for (const row of rows) {
    const left = unheld(row.node, ROW_FIELDS);
    if (left.length) say(row.path, `the builder's table has no place for a row's ${left.join(", ")}: left out`, `a row's ${left.join(", ")}`);
    for (const cell of cellsOf(row)) {
      const left = unheld(cell.node, CELL_FIELDS);
      if (left.length) say(cell.path, `the builder's table has no place for a cell's ${left.join(", ")}: left out`, `a cell's ${left.join(", ")}`);
    }
  }

  const table: Values = { headers: header.map((row) => rowOf(row, heading, true)), rows: body.map((row) => rowOf(row, content, false)), footers: footer.map((row) => rowOf(row, ending, true)) };
  // With a cell across columns, its cells alone don't say where the columns divide: the builder keeps each column's share.
  if (spanned && sum > 0) table.columnWidths = Array.from({ length: count }, (_, column) => widthOf(column));
  // The builder draws the border around a table outside its cells' lines. So do an Email's Tables; a Page's and a
  // Document's, where their borders collapse, draw the two as one line.
  const around = (own.style.border as Border | undefined) ?? {};
  const edges = { top: cellsOf(rows[0]), bottom: cellsOf(rows[rows.length - 1]), left: rows.flatMap((row) => cellsOf(row).slice(0, 1)), right: rows.flatMap((row) => cellsOf(row).slice(-1)) };
  if (place.at("root").type !== "Email" && own.style.borderCollapse === "collapse" && SIDES.some((side) => drawsLine(around[side]) && edges[side].some((cell) => drawsLine((cell.own.style.border as Border | undefined)?.[side])))) {
    say(path, "the border around it and the lines of its cells at its edges are one line where a Table's borders collapse, two in the builder's table, which draws its border outside its cells'", "a border around it that collapses with its cells' lines");
  }
  // The builder's table sits at the left of its place: one narrower than its place sits elsewhere in a Table.
  const narrow = ["width", "maxWidth"].filter((key) => node.style?.[key] !== undefined && node.style[key] !== "100%");
  // (It fills its place only where it does at the widest its place gets: the root's width, where columns stack on phones.)
  const widest = Math.max(own.available ?? 0, place.at("root").contentWidth ?? 0);
  const fills =
    own.available !== null &&
    narrow.every((key) => {
      const value = node.style?.[key];
      if (typeof value === "string" && value.trim().endsWith("%")) return parseFloat(value) >= 100;
      return (pxIn(value, own.available!) ?? 0) >= widest - 0.5;
    });
  if (narrow.length && !fills && (align === "center" || align === "right")) say(path, `a table narrower than its place is at its left in the builder's, not ${align === "center" ? "in its middle" : "at its right"}`, "a width, away from the left of its place");
  // It's never wider than its place either, where a Table of a width past it runs out of it.
  const wide = node.style?.width;
  if (typeof wide === "number" ? own.available !== null && wide > own.available : typeof wide === "string" && wide.trim().endsWith("%") && parseFloat(wide) > 100) {
    say(path, "a table wider than its place is as wide as its place in the builder's, which doesn't let it run out of it", "a width wider than its place");
  } else if (place.at("root").type === "Page" && (typeof wide === "number" || (typeof wide === "string" && wide.trim().endsWith("px"))) && node.style?.maxWidth === undefined) {
    // A Page's Table keeps its px width in a narrower window, where the builder's, at most 100% wide, shrinks to fit. (An
    // Email's writes its width as a max width, and a Document's page doesn't narrow.)
    say(path, "a table of a px width shrinks to fit a narrower window in the builder's, and keeps its width in a Page's Table (a maxWidth of 100% makes them the same)", "a px width with no max width");
  }
  if (ragged) say(path, "a row with fewer cells than the table's columns has empty cells in the builder's table, to make up its columns", "a row with fewer cells than its columns");
  if (lost.length) say(path, `the builder's text holds no ${[...new Set(lost)].join(", ")}: left out`, [...new Set(lost)].join(", "));
  if (exact) {
    // What's kept for Elements but not drawn by the builder (hidden properties), or drawn otherwise, unsaid in a Document.
    const why = [...said.map((entry) => entry.why), ...leftOut("table", node, TABLE_FIELDS).map((key) => `its ${key}`)];
    for (const key of narrow) if (!drawn(node.style?.[key])) why.push(`its ${key}`);
    for (const key of ["width", "maxWidth", "border"]) if (node.mobile?.[key] !== undefined) why.push(`its mobile.${key}`);
    // A column of its own px beside a free one keeps its width in a narrower window, as Elements lays it out; the
    // builder's columns are shares of the table. (Where every column has a width, Elements draws them as shares too.)
    if (own.columnSizes?.includes("px")) why.push("a column of a fixed width");
    if ([own, ...rows.map((row) => row.own), ...rows.flatMap(cellsOf).map((cell) => cell.own)].some((part) => halfClear(part.style.backgroundColor))) why.push("a half-transparent background");
    if (why.length) return `the builder's table doesn't draw it as it is (${[...new Set(why)].join("; ")})`;
  }
  place.report.push(...said.map(({ at, what }) => `${at}: ${what}`), ...noted);

  return {
    table,
    columns: count,
    rows: body.length,
    border: lines.border,
    stripedRows: false,
    enableHeader: header.length > 0,
    // A Document's header and footer rows are printed on every page a table runs to. (An Email and a Page have no pages:
    // the builder's email and web modes have no such field, and keep it on.)
    repeatHeaderOnEachPage: true,
    ...fields("header", heading),
    ...fields("content", content),
    enableFooter: footer.length > 0,
    repeatFooterOnEachPage: true,
    ...fields("footer", ending),
    ...(lines.borderCollapse ? { borderCollapse: lines.borderCollapse } : {}),
  };
}

/** A table's lines as the builder's: its border, how its cells' borders meet, and a cell's own border. */
interface Lines {
  border: Values;
  borderCollapse?: string;
  /** A cell's own border: the lines it has that the table's border and its line between rows don't give it. */
  of(cell: ResolvedNode, last: boolean): Values | undefined;
}

/**
 * The builder's lines from the lines around the Table's cells as laid out. Lines the same on every side of every cell
 * are the builder's border, which it draws around every cell. Any others are each cell's own border, but the line
 * between rows under it, which the builder draws from the table's `rowBorder` as Elements does: under every row but
 * the last, where a cell has no bottom line of its own. Cells side by side draw a line each unless the Table collapses
 * them, the builder's one unless it's told they're separate.
 */
function cellBorders(rows: Part[], cellsOf: (row: Part) => Part[], own: ResolvedNode): Lines {
  const cells = rows.flatMap(cellsOf);
  const lines = cells.map(({ own: cell }) => (cell.style.border as Border | undefined) ?? {});
  if (lines.every((line) => SIDES.every((side) => !line[side]))) return { border: NO_BORDER, of: () => undefined };
  const separate = own.style.borderCollapse === "collapse" ? {} : { borderCollapse: "separate" };
  const between = own.style.rowBorder as BorderSide | undefined;
  const first = lines[0][SIDES[0]];
  const around = (line: Border) => SIDES.every((side) => line[side] && same(line[side], first));
  // (With a line between rows that's another line, the builder would draw it under each row over its border: the
  // cells' own borders are over it, as a Table's are.)
  if (first && lines.every(around) && (!between || same(between, first))) return { border: builderBorder({ top: first, right: first, bottom: first, left: first }), ...separate, of: () => undefined };
  const of = (cell: ResolvedNode, last: boolean) => {
    const line = (cell.style.border as Border | undefined) ?? {};
    const mine = Object.fromEntries(SIDES.filter((side) => line[side] && !(side === "bottom" && between && !last && same(line.bottom, between))).map((side) => [side, line[side]]));
    return Object.keys(mine).length ? builderBorder(mine as Border) : undefined;
  };
  // A line between rows only is drawn the same whether cells share their lines or not.
  const ownLines = rows.some((row, index) => cellsOf(row).some((cell) => of(cell.own, index === rows.length - 1)));
  return { border: NO_BORDER, ...(ownLines ? separate : {}), of };
}
