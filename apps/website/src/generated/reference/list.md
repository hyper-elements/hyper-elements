---
"title": "List"
"group": "Blocks"
"order": 16
"summary": "A bulleted or numbered list of ListItems. Its markers sit in a column of their own (indent) before the items."
---

A bulleted or numbered list of ListItems. Its markers sit in a column of their own (indent) before the items.

Holds: ListItem.

Props:
- `type`: one of "bullet", "number" (default `"bullet"`)
- `start`: an integer from 0 (default `1`). The first item's number, in a numbered list.

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
- `padding`: *insets* (Spacing)
- `backgroundColor`: *color* (Background)
- `border`: *border* (Border)
- `gap`: a length (a number of px) (Spacing). Space between items.
- `indent`: a length (a number of px) (default `24`, Spacing). The width of the markers' column, before the items.
- `flex`: *flex* (Layout). In a Row: its share of the width left after children with a width (default 1); "none" takes its own size.

`style.mobile` (on phones): `fontSize`, `lineHeight`, `letterSpacing`, `textAlign`, `width`, `maxWidth`, `padding`, `border`, `gap`.
