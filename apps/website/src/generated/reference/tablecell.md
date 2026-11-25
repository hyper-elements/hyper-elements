---
"title": "TableCell"
"group": "Parts"
"order": 33
"summary": "A cell of a TableRow: text, and images. Its width sets its column's."
---

A cell of a TableRow: text, and images. Its width sets its column's.

Holds: text; PageNumber, Span, Link, LineBreak, MergeTag, Image.

Props:
- `colSpan`: an integer from 1 (default `1`). How many columns it spans.
- `dir`: one of "ltr", "rtl", "auto". Its text's direction, where it differs from the design's; it starts on that side unless aligned otherwise.

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
- `textDecoration`: one of "none", "underline", "line-through" (Typography)
- `padding`: *insets* (Spacing)
- `backgroundColor`: *color* (Background)
- `border`: *border* (Border)
- `width`: a length (a number of px, %) (Size). Its column's width (of a cell spanning one column).
- `verticalAlign`: one of "top", "middle", "bottom" (Layout)

`style.mobile` (on phones): `fontSize`, `lineHeight`, `letterSpacing`, `textAlign`, `padding`, `border`.
