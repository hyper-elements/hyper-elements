/**
 * The builder's table read back as a Table: its header rows TableRows with `header`, its footer rows (where its footer
 * is on) TableRows with `footer`, the rest TableRows; each cell's rich text its words. Its content's fields are the
 * Table's text styles, background and cell padding, its header's and footer's their rows' (a style the row would take
 * anyway left out), a cell's own fields and rich text its TableCell's. Each column's width is its first row's cells'
 * share, where they aren't equal. The builder's border, drawn around every cell, is each cell's border with the Table's
 * borders collapsed, as the builder draws them; above and below each row only, it's the line between rows. Its stripes
 * are every other row's background.
 */
import type { Json, Node } from "@hyper-elements/core";
import { readHidden } from "./hide";
import { border as readBorderSides, color, font, fontWeight, givenId, hidden as hiddenOn, px, sides, type Sides, type Values } from "./read-values";
import { defined, lineHeight, make, obj, placed, same, str, textStyle, unless, ZERO, type Context } from "./reading";
import { holdsWords, opaque } from "./table";
import { readText } from "./text";
import { textJsonHtml } from "./text-json";

type Text = { fontFamily: string; fontSize: number; fontWeight: number; color: string; textAlign: string; lineHeight: Json; letterSpacing: number };

/** A part of the table (its header, its rows, its footer): its rows' text styles, background, padding and vertical alignment. */
interface Part {
  text: Text;
  background: string | undefined;
  padding: Sides;
  verticalAlign: string;
  /** The line height words with none of their own are drawn at, where it isn't the table's: a header's and a footer's. */
  unset?: Json;
}

/** A line height in px at a font size: a multiple of it, px, a percentage of it, or normal (Elements' 1.2). */
const lineHeightPx = (value: Json, fontSize: number): number => {
  if (typeof value === "number") return value * fontSize;
  const text = String(value).trim();
  return text.endsWith("%") ? (parseFloat(text) / 100) * fontSize : text === "normal" ? 1.2 * fontSize : (px(text) ?? 1.5 * fontSize);
};
/** A design's list as its items (a copy: a hand-edited one's own methods may be anything). */
const rows = (value: unknown): Values[] => (Array.isArray(value) ? Array.from(value).map(obj) : []);
/** Whether rich text is one paragraph with nothing in it: the builder's empty cell (a line break is something). */
const emptyParagraph = (json: string): boolean => {
  try {
    const paragraphs = (JSON.parse(json) as { root?: { children?: Array<{ children?: unknown[] }> } }).root?.children ?? [];
    return paragraphs.length === 1 && Array.isArray(paragraphs[0].children) && paragraphs[0].children.length === 0;
  } catch {
    return false;
  }
};
/** A text color: any given one, transparent too (words drawn invisible are still words drawn so). */
const textColor = (value: unknown) => (typeof value === "string" && value.trim() ? value : undefined);

export function readTable(values: Values, context: Context): Node[] {
  const hidden = readHidden("table", "Table", values, context.say);
  const data = obj(values.table);
  const headers = values.enableHeader === false ? [] : rows(data.headers);
  const body = rows(data.rows);
  const footers = values.enableFooter === true ? rows(data.footers) : [];
  // Elements prints a Document's header and footer on every page a table runs to. (Only a document has pages: the
  // builder's email and web modes have no such field, and keep it on, so one left off in a document is no matter there.)
  if (context.document && headers.length && values.repeatHeaderOnEachPage === false) context.say("its header not repeated on each page isn't something a Table holds: it's printed on every page the table runs to");
  if (context.document && footers.length && values.repeatFooterOnEachPage === false) context.say("its footer not repeated on each page isn't something a Table holds: it's printed on every page the table runs to");

  // The content's fields are the Table's text styles: what its cells take, unless their row or they say otherwise.
  const own = {
    ...textStyle(
      { fontFamily: values.contentFontFamily, fontSize: values.contentFontSize, fontWeight: values.contentFontWeight, textAlign: values.contentTextAlign, lineHeight: values.contentLineHeight, letterSpacing: values.contentLetterSpacing },
      {},
      context,
    ),
    ...defined({ color: unless(textColor(values.contentColor), context.inherited.color) }),
  };
  const table: Text = {
    fontFamily: (own.fontFamily as string | undefined) ?? context.inherited.fontFamily,
    fontSize: (own.fontSize as number | undefined) ?? 16,
    fontWeight: (own.fontWeight as number | undefined) ?? context.inherited.fontWeight,
    color: (own.color as string | undefined) ?? context.inherited.color,
    textAlign: (own.textAlign as string | undefined) ?? "left",
    lineHeight: own.lineHeight ?? 1.5,
    letterSpacing: (own.letterSpacing as number | undefined) ?? 0,
  };
  const padding = sides(values.contentPadding) ?? ZERO;
  /** A header's or a footer's fields: no field is the page's text (a header's in bold), as a browser draws a cell outside the content. */
  const partOf = (prefix: "header" | "footer" | "content"): Part => {
    const size = prefix === "content" ? table.fontSize : (px(values[`${prefix}FontSize`]) ?? table.fontSize);
    const text: Text =
      prefix === "content"
        ? table
        : {
            fontFamily: font(values[`${prefix}FontFamily`]) ?? context.inherited.fontFamily,
            fontSize: size,
            fontWeight: fontWeight(values[`${prefix}FontWeight`]) ?? (prefix === "header" ? 700 : context.inherited.fontWeight),
            color: textColor(values[`${prefix}Color`]) ?? context.inherited.color,
            textAlign: str(values[`${prefix}TextAlign`]) ?? "left",
            lineHeight: table.lineHeight,
            letterSpacing: 0,
          };
    // Only the content has a line height field: a header's or a footer's words with none of their own are at the page's,
    // the builder's HTML's body's (1.5 on a page, the browser's normal in an email and a document).
    const page = context.mode === "web" ? 1.5 : "normal";
    const unset = prefix === "content" || same(page, table.lineHeight) ? undefined : page;
    return { text, background: opaque(values[`${prefix}BackgroundColor`]), padding: sides(values[`${prefix}Padding`]) ?? ZERO, verticalAlign: str(values[`${prefix}VerticalAlign`]) ?? "middle", unset };
  };
  const content = partOf("content");
  const header = partOf("header");
  const footer = partOf("footer");
  // The content's background is the Table's where its header and footer have it or one of their own over it; a header
  // with none shows what's behind the table in the builder, so then each row has its own.
  const background = [...(headers.length ? [header] : []), ...(footers.length ? [footer] : [])].every((part) => part.background !== undefined || same(part.background, content.background)) ? content.background : undefined;

  const stripe = values.stripedRows === true ? opaque(values.stripedRowsBackgroundColor) : undefined;
  /** A row of a part as a TableRow: its styles where they aren't the Table's, its cells. */
  const rowOf = (row: Values, part: Part, kind: "header" | "body" | "footer", index: number): Node => {
    // The builder's stripes are on the first row of each two.
    const paint = (kind === "body" && stripe && index % 2 === 0 ? stripe : part.background) ?? undefined;
    const weightTaken = kind === "header" ? 700 : table.fontWeight;
    const style = defined({
      fontFamily: unless(part.text.fontFamily, table.fontFamily),
      fontSize: unless(part.text.fontSize, table.fontSize),
      fontWeight: unless(part.text.fontWeight, weightTaken),
      color: unless(part.text.color, table.color),
      textAlign: unless(part.text.textAlign, table.textAlign),
      // The content's letter spacing isn't a header's or a footer's in the builder.
      letterSpacing: unless(part.text.letterSpacing, table.letterSpacing),
      backgroundColor: unless(paint, background),
    });
    const rowLine = lineHeightPx(table.lineHeight, part.text.fontSize);
    const read = rows(row.cells).map((cell) => cellOf(cell, part, rowLine));
    // Words at the page's line height (`unset`): the row's, where it's all its worded cells', else each one's.
    const worded = read.filter((cell) => holdsWords(cell.node));
    const unset = worded.length > 0 && worded.every((cell) => cell.unset);
    if (unset) style.lineHeight = part.unset!;
    const cells = unset ? read : read.map((cell) => (cell.unset ? { ...cell, node: { ...cell.node, style: { ...cell.node.style, lineHeight: part.unset! } } } : cell));
    const pads = rows(row.cells).map((cell) => {
      const pad = sides(cell.padding) ?? part.padding;
      return pad.top + pad.bottom;
    });
    // The least the Table's row is: a line where a cell has words, its padding where it has none. toDesign() gives a row of
    // no height of its own that (1px at least), so a height above it is the row's own: one no taller is no matter.
    const least = Math.max(0, ...cells.map((cell, i) => (holdsWords(cell.node) ? cell.line : 0) + pads[i]));
    const height = px(row.height);
    if (height !== undefined && height > Math.max(1, Math.ceil(least))) style.height = height;
    return make("TableRow", { props: defined({ header: kind === "header" || undefined, footer: kind === "footer" || undefined }), style, children: cells.map((cell) => cell.node) });
  };

  /** A cell as a TableCell (its words, and its own fields and line height where they aren't its row's), and its line's height. */
  const cellOf = (cell: Values, part: Part, rowLine: number): { node: Node; line: number; unset: boolean } => {
    const json = str(cell.textJson);
    const read = json === undefined ? { html: str(cell.text) ?? "", unread: [] as string[] } : textJsonHtml(json);
    if (read.unread.length) context.say(`a table cell's rich text has nodes Elements doesn't read (${read.unread.join(", ")}): left out`);
    const { parts, left } = readText(context.safe(read.html), { weight: part.text.fontWeight, pages: context.document, fontSize: part.text.fontSize, lineHeight: part.text.lineHeight, cell: true });
    if (left.length) context.say(`a table cell's text has what a TableCell doesn't hold (${[...new Set(left)].join(", ")}): left out`);
    const children: NonNullable<Node["children"]> = [];
    const first = parts[0]?.node.style ?? {};
    // Its paragraphs are lines: a cell holds words, not blocks, so a paragraph's own spacing, indent, alignment or line
    // height (but the first's alignment and line height, the cell's) has no place.
    const spaced = parts.some((piece, i) => piece.margin.top || piece.margin.bottom || piece.indent || (i > 0 && !same(piece.node.style ?? {}, first)));
    if (spaced) context.say("a table cell's paragraphs are lines of the cell: their own spacing, indent, alignment and line height are left out");
    // Its paragraphs' direction is the cell's, where they share one.
    const dirs = [...new Set(parts.map((piece) => piece.node.props?.dir as string | undefined))];
    if (dirs.length > 1) context.say("a table cell's paragraphs in directions of their own are lines of the cell, in the first's direction");
    const dir = dirs[0];
    // An empty cell's paragraph (`<p><br></p>`, as the builder writes one) holds nothing: its line height and direction
    // are still the cell's. Its rich text, where it has one, says which: an empty paragraph, or a line break alone, which
    // is the LineBreak it was.
    const placeholder = parts.length === 1 && same(parts[0].node.children, ["​"]);
    const shown = placeholder ? [] : parts;
    if (placeholder && json !== undefined && !emptyParagraph(json)) children.push({ type: "LineBreak" });
    shown.forEach((piece, i) => {
      if (i) children.push({ type: "LineBreak" });
      if (piece.node.type !== "Text") context.say(`a ${piece.node.type === "List" ? "list" : "heading"} in a table cell, which a TableCell doesn't hold: its words are lines of the cell`);
      children.push(...words(piece.node));
    });
    const line = first.lineHeight;
    // Words with no line height of their own in a header or a footer: at the page's (the row's or the cell's, as its row says).
    const unset = part.unset !== undefined && line === undefined && holdsWords({ type: "TableCell", children });
    const drawn = unset ? part.unset : line;
    // Its own size, its paragraph's; its line at its largest words' size (a multiple is each run's size's).
    const size = typeof first.fontSize === "number" ? first.fontSize : part.text.fontSize;
    const linePx = Math.max(drawn === undefined && size === part.text.fontSize ? rowLine : lineHeightPx(drawn ?? table.lineHeight, size), lineHeightPx(drawn ?? table.lineHeight, largest(children, size)));
    const style = defined({
      fontSize: unless(size, part.text.fontSize),
      color: unless(textColor(cell.color), part.text.color),
      textAlign: unless((first.textAlign as string | undefined) ?? str(cell.textAlign), part.text.textAlign),
      // Its line height where it isn't its row's (a multiple and px each as they're given).
      lineHeight: line !== undefined && !same(line, part.text.lineHeight) ? line : undefined,
      verticalAlign: unless(str(cell.verticalAlign) ?? part.verticalAlign, "top"),
      padding: unless((sides(cell.padding) ?? part.padding) as Json, padding as Json),
      backgroundColor: opaque(cell.backgroundColor),
      border: cellBorder,
    });
    return { node: make("TableCell", { props: defined({ dir }), style, children }), line: linePx, unset };
  };

  // The builder's border is each cell's, collapsed, as it draws it; the line between rows of a Table toDesign() wrote
  // (its hidden rowBorder) while the border above and below each row is still that line.
  const { rowBorder: written, ...hiddenStyle } = hidden.style;
  const lines = readBorderSides(obj(values.border), "#000000") as Record<string, Json> | undefined;
  const between = written !== undefined && lines && !lines.left && !lines.right && same(lines.top, written) && same(lines.bottom, written) ? written : undefined;
  const cellBorder = lines && !between ? (lines as Json) : undefined;

  const children = [
    ...headers.map((row, i) => rowOf(row, header, "header", i)),
    ...body.map((row, i) => rowOf(row, content, "body", i)),
    ...footers.map((row, i) => rowOf(row, footer, "footer", i)),
  ];
  // Each column's share, on the first row's cells, where they aren't equal (the share a column without one takes) or
  // are all none.
  const shares = rows(obj(headers[0] ?? body[0] ?? footers[0]).cells).map((cell) => (typeof cell.width === "number" && Number.isFinite(cell.width) && cell.width >= 0 ? cell.width : 50));
  const total = shares.reduce((sum, w) => sum + w, 0) || 1;
  // (Shares are written to a hundredth: any larger difference is a column's own width.)
  if (children[0] && (shares.some((w) => Math.abs(w - shares[0]) > 0.01) || shares.every((w) => w === 0))) {
    children[0] = { ...children[0], children: (children[0].children ?? []).map((cell, i) => (typeof cell === "string" ? cell : { ...cell, style: { ...cell.style, width: `${Math.round((shares[i] / total) * 10000) / 100}%` } })) };
  }
  const style = defined({
    ...own,
    backgroundColor: background,
    cellPadding: unless(padding as Json, ZERO as Json),
    rowBorder: between,
    borderCollapse: cellBorder ? "collapse" : undefined,
    ...hiddenStyle,
  });
  const node = make("Table", { id: givenId(values), props: hidden.props, style, mobile: hidden.mobile, children });
  return [placed(node, sides(values.containerPadding ?? "10px"), undefined, sides(obj(obj(values._override).mobile).containerPadding), { ...hiddenOn(values), ...hidden.hidden })];
}

/** The largest font size of these runs and what's in them, `size` where none has its own. */
function largest(children: Node["children"], size: number): number {
  return Math.max(size, ...(children ?? []).flatMap((child) => (typeof child === "string" ? [] : [largest(child.children, typeof child.style?.fontSize === "number" ? child.style.fontSize : size)])));
}

/** A part of a cell's text as its words: a Text's runs, a List's items each a line, a Heading's runs. */
function words(node: Node): NonNullable<Node["children"]> {
  if (node.type !== "List") return node.children ?? [];
  return (node.children ?? []).flatMap((item, i) => [...(i ? [{ type: "LineBreak" }] : []), ...(typeof item === "string" ? [item] : words(item))]);
}
