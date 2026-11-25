---
"title": "ListItem"
"group": "Parts"
"order": 31
"summary": "An item of a List: text, and a List of its own to nest one."
---

An item of a List: text, and a List of its own to nest one.

Holds: text; PageNumber, Span, Link, LineBreak, MergeTag, List.

Props:
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

`style.mobile` (on phones): `fontSize`, `lineHeight`, `letterSpacing`, `textAlign`.
