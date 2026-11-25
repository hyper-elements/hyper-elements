---
"title": "TableRow"
"group": "Parts"
"order": 32
"summary": "A row of a Table. A header row's cells are header cells, in bold."
---

A row of a Table. A header row's cells are header cells, in bold.

Holds: TableCell.

Props:
- `header`: true or false (default `false`). Its cells head the columns below them.
- `footer`: true or false (default `false`). It ends the table (printed, on each page the table runs to).

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
- `backgroundColor`: *color* (Background)
- `height`: a length (a number of px) (Size)

`style.mobile` (on phones): `fontSize`, `lineHeight`, `letterSpacing`, `textAlign`.
