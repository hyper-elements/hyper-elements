---
"title": "TableCell"
"group": "Parts"
"order": 34
"summary": "A cell of a TableRow: text, and images. Its width sets its column's."
---

A cell of a TableRow: text, and images. Its width sets its column's.

Holds: text; PageNumber, Span, Link, LineBreak, MergeTag, Image.

Props:
- `colSpan`: an integer from 1 (default `1`). How many columns it spans.
- `dir`: one of "ltr", "rtl", "auto". Its text's direction, where it differs from the template's; it starts on that side unless aligned otherwise.

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
- `textDecoration`: one of "none", "underline", "line-through" (Typography)
- `padding`: *insets*; on a Page, px for all sides, "8px 16px" (1 to 4 values), [v, h] or [t, r, b, l], or { top, right, bottom, left }, or on a Page one to four lengths ("1rem 2rem", "clamp(1rem, 4vw, 3rem)") or { top, right, bottom, left } of lengths (Spacing)
- `backgroundColor`: *color* (Background)
- `border`: *border* (Border)
- `width`: a length (a number of px, %) (Size). Its column's width (of a cell spanning one column).
- `verticalAlign`: one of "top", "middle", "bottom" (Layout)

`style.mobile` (on phones): `fontSize`, `lineHeight`, `letterSpacing`, `textAlign`, `padding`, `border`.
