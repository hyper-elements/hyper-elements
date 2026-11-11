/**
 * A TableCell: `<th>` in a header row, else `<td>`; its width in px for Word
 * and as a share of the row elsewhere (padding and border inside it), all of
 * its text styles on it (Outlook doesn't carry styles down through tables).
 */
import { close, Fragment, h, NotOutlook, open, Outlook } from "../jsx";
import { share } from "../shared/css";
import type { ResolvedNode } from "../../resolve";
import { isNode, type Component } from "./context";
import { bgcolor } from "./markup";
import { fullText } from "./styles";

/** Each Table's first row, as its writer marks it: the row whose cells size a fixed-layout table's columns. */
export const FIRST_ROWS = new WeakSet<ResolvedNode>();

export const TableCell: Component = ({ node, style, mobile, parent: row, phoneText, text }) => {
  const Cell = row.props.header ? "th" : "td";
  const span = Number(node.props.colSpan);
  // Beside a column that keeps its own px, a free one takes what's left: `width: auto` on its cell in the first row
  // (the row a fixed layout sizes columns by, after the colgroup), for every client but classic Outlook. Word reads
  // `width: auto` as no width, its attribute unused, and gives the column the widest column's width; with the
  // attribute alone it scales the cells' width attributes to the table. So Word gets that cell's opening tag of its
  // own, and a cell without a width of its own elsewhere has the attribute alone.
  const sized = node.width !== null && !!row.width;
  const cells = row.children.filter(isNode);
  const column = cells.slice(0, cells.indexOf(node)).reduce((sum, cell) => sum + Math.max(1, Number(cell.props.colSpan) || 1), 0);
  const free = sized && style.width === undefined && row.columnSizes?.[column] === "free" && FIRST_ROWS.has(row);
  const width = !sized ? undefined : row.columnSizes && typeof style.width !== "string" ? style.width : share(node.width!, row.width!);
  const cell = (cssWidth: unknown, children?: unknown) => (
    <Cell
      id={node.id}
      scope={row.props.header ? "col" : undefined}
      colspan={span > 1 ? span : undefined}
      dir={node.props.dir as string | undefined}
      width={node.width ?? undefined}
      valign={(style.verticalAlign as string | undefined) ?? "top"}
      bgcolor={bgcolor(style.backgroundColor)}
      phone={[phoneText, { padding: mobile.padding, backgroundColor: mobile.backgroundColor }]}
      style={[
        // A header cell is bold of its own: its weight is always written.
        fullText(node, { weight: Cell === "th" }),
        {
          width: cssWidth as string | number | undefined,
          boxSizing: "border-box",
          padding: style.padding,
          backgroundColor: style.backgroundColor,
          border: style.border,
          textDecoration: style.textDecoration,
        },
      ]}
    >
      {children as never}
    </Cell>
  );
  if (!free) return cell(width, text());
  return (
    <>
      <Outlook>{open(cell(undefined))}</Outlook>
      <NotOutlook>{open(cell("auto"))}</NotOutlook>
      {text()}
      {close(Cell)}
    </>
  );
};
