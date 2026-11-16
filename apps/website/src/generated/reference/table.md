---
"title": "Table"
"group": "Blocks"
"order": 17
"summary": "A table of data: TableRows of TableCells. Columns take their cells' widths; the rest share what's left."
---

A table of data: TableRows of TableCells. Columns take their cells' widths; the rest share what's left.

Holds: TableRow.

`style`:
- `color`: *color* (inherited, Typography)
- `fontFamily`: *fontFamily* (inherited, Typography)
- `fontSize`: a length (a number of px) (inherited, Typography)
- `fontWeight`: *fontWeight* (inherited, Typography)
- `fontStyle`: one of "normal", "italic" (inherited, Typography)
- `lineHeight`: *lineHeight* (inherited, Typography)
- `letterSpacing`: a length (a number of px) (inherited, Typography)
- `textAlign`: one of "left", "center", "right", "justify" (inherited, Typography)
- `textTransform`: one of "none", "uppercase", "lowercase", "capitalize" (inherited, Typography)
- `width`: a length (a number of px, %) (Size)
- `maxWidth`: a length (a number of px, %) (Size)
- `backgroundColor`: *color* (Background)
- `border`: *border* (Border)
- `cellPadding`: *insets* (Spacing). Every cell's padding, where the cell doesn't set its own.
- `rowBorder`: *line* (Border)
- `borderCollapse`: one of "separate", "collapse" (Border). Whether cells side by side draw a border each (separate) or share one (collapse).
- `flex`: *flex* (Layout). In a Row: its share of the width left after children with a width (default 1); "none" takes its own size.

`style.mobile` (on phones): `fontSize`, `lineHeight`, `letterSpacing`, `textAlign`, `width`, `maxWidth`, `border`.
