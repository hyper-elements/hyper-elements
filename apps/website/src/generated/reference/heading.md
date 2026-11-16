---
"title": "Heading"
"group": "Blocks"
"order": 12
"summary": "A heading, from level 1 (the page's title) to 6."
---

A heading, from level 1 (the page's title) to 6.

Holds: text; PageNumber, Span, Link, LineBreak, MergeTag.

Props:
- `level`: one of 1, 2, 3, 4, 5, 6 (default `1`)
- `dir`: one of "ltr", "rtl", "auto". Its text's direction, where it differs from the template's; it starts on that side unless aligned otherwise.

`style`:
- `color`: *color* (inherited, Typography)
- `fontFamily`: *fontFamily* (inherited, Typography)
- `fontSize`: a length (a number of px) (inherited, Typography)
- `fontWeight`: *fontWeight* (default `700`, inherited, Typography)
- `fontStyle`: one of "normal", "italic" (inherited, Typography)
- `lineHeight`: *lineHeight* (default `1.25`, inherited, Typography)
- `letterSpacing`: a length (a number of px) (inherited, Typography)
- `textAlign`: one of "left", "center", "right", "justify" (inherited, Typography)
- `textTransform`: one of "none", "uppercase", "lowercase", "capitalize" (inherited, Typography)
- `textDecoration`: one of "none", "underline", "line-through" (Typography)
- `width`: a length (a number of px, %) (Size)
- `maxWidth`: a length (a number of px, %) (Size)
- `padding`: *insets* (Spacing)
- `backgroundColor`: *color* (Background)
- `border`: *border* (Border)
- `borderRadius`: *radius* (Border)
- `flex`: *flex* (Layout). In a Row: its share of the width left after children with a width (default 1); "none" takes its own size.

`style.mobile` (on phones): `fontSize`, `lineHeight`, `letterSpacing`, `textAlign`, `width`, `maxWidth`, `padding`, `border`.
