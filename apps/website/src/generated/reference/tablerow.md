---
"title": "TableRow"
"group": "Parts"
"order": 33
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
- `fontSize`: a length (a number of px); on a Page, a length (a number of px), or on a Page a length (a number of px, rem, em, %, vw, vh, calc(), min(), max(), clamp()) (inherited, Typography)
- `fontWeight`: *fontWeight* (inherited, Typography)
- `fontStyle`: one of "normal", "italic" (inherited, Typography)
- `lineHeight`: *lineHeight*; on a Page, a multiple of the font size (1.5), a percentage ("150%"), px ("24px") or "normal" (the font's own), or on a Page a length ("1.5rem", "1.25em", "calc(1em + 4px)") (inherited, Typography)
- `letterSpacing`: a length (a number of px); on a Page, a length (a number of px), or on a Page a length (a number of px, rem, em, vw, vh, calc(), min(), max(), clamp()) (inherited, Typography)
- `textAlign`: one of "left", "center", "right", "justify" (inherited, Typography)
- `textTransform`: one of "none", "uppercase", "lowercase", "capitalize" (inherited, Typography)
- `backgroundColor`: *color* (Background)
- `height`: a length (a number of px); on a Page, a length (a number of px), or on a Page a length (a number of px, rem, em, %, vw, vh, calc(), min(), max(), clamp(), "auto", "min-content", "max-content", "fit-content") (Size)

`style.mobile` (on phones): `fontSize`, `lineHeight`, `letterSpacing`, `textAlign`.
