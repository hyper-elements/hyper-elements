---
"title": "List"
"group": "Blocks"
"order": 17
"summary": "A bulleted or numbered list of ListItems. Its markers sit in a column of their own (indent) before the items."
---

A bulleted or numbered list of ListItems. Its markers sit in a column of their own (indent) before the items.

Holds: ListItem.

Props:
- `type`: one of "bullet", "number" (default `"bullet"`)
- `start`: an integer from 0 (default `1`). The first item's number, in a numbered list.

`style`:
- `alignSelf`: one of "auto", "start", "center", "end", "stretch", "baseline" (only in Page, Layout). Where it sits across its parent's flex box or grid cell, over the parent's alignItems.
- `justifySelf`: one of "auto", "start", "center", "end", "stretch" (only in Page, Layout). Where it sits along its grid cell.
- `order`: a whole number (only in Page, Layout). Its place among its siblings in a flex box or grid, lowest first.
- `flexGrow`: a number from 0 to Infinity (only in Page, Layout). Its share of the room left in its parent's flex box.
- `flexShrink`: a number from 0 to Infinity (only in Page, Layout). How much it gives up where its parent's flex box is too small.
- `flexBasis`: a length (a number of px, rem, em, %, vw, vh, calc(), min(), max(), clamp(), "auto", "content") (only in Page, Layout). Its size along its parent's flex box before what's left is shared.
- `gridColumn`: a grid line, "span n", an area's name or "auto", up to 2 separated by " / " (only in Page, Layout). The columns it takes in its parent's grid: "span 2", "1 / 3".
- `gridRow`: a grid line, "span n", an area's name or "auto", up to 2 separated by " / " (only in Page, Layout). The rows it takes in its parent's grid.
- `gridArea`: a grid line, "span n", an area's name or "auto", up to 4 separated by " / " (only in Page, Layout). The named area it takes in its parent's grid (gridTemplateAreas), or its lines.
- `color`: *color* (inherited, Typography)
- `fontFamily`: *fontFamily* (inherited, Typography)
- `fontSize`: a length (a number of px); on a Page, a length (a number of px), or on a Page a length (a number of px, rem, em, %, vw, vh, calc(), min(), max(), clamp()) (inherited, Typography)
- `fontWeight`: *fontWeight* (inherited, Typography)
- `fontStyle`: one of "normal", "italic" (inherited, Typography)
- `lineHeight`: *lineHeight*; on a Page, a multiple of the font size (1.5), a percentage ("150%"), px ("24px") or "normal" (the font's own), or on a Page a length ("1.5rem", "1.25em", "calc(1em + 4px)") (inherited, Typography)
- `letterSpacing`: a length (a number of px); on a Page, a length (a number of px), or on a Page a length (a number of px, rem, em, vw, vh, calc(), min(), max(), clamp()) (inherited, Typography)
- `textAlign`: one of "left", "center", "right", "justify" (inherited, Typography)
- `textTransform`: one of "none", "uppercase", "lowercase", "capitalize" (inherited, Typography)
- `width`: a length (a number of px, %); on a Page, a length (a number of px, %), or on a Page a length (a number of px, rem, em, %, vw, vh, calc(), min(), max(), clamp(), "auto", "min-content", "max-content", "fit-content") (Size)
- `maxWidth`: a length (a number of px, %); on a Page, a length (a number of px, %), or on a Page a length (a number of px, rem, em, %, vw, vh, calc(), min(), max(), clamp(), "none", "min-content", "max-content", "fit-content") (Size)
- `padding`: *insets*; on a Page, px for all sides, "8px 16px" (1 to 4 values), [v, h] or [t, r, b, l], or { top, right, bottom, left }, or on a Page one to four lengths ("1rem 2rem", "clamp(1rem, 4vw, 3rem)") or { top, right, bottom, left } of lengths (Spacing)
- `backgroundColor`: *color* (Background)
- `border`: *border* (Border)
- `gap`: a length (a number of px) (Spacing). Space between items.
- `indent`: a length (a number of px) (default `24`, Spacing). The width of the markers' column, before the items.
- `flex`: *flex* (Layout). In a Row: its share of the width left after children with a width (default 1); "none" takes its own size.

`style.mobile` (on phones): `fontSize`, `lineHeight`, `letterSpacing`, `textAlign`, `width`, `maxWidth`, `padding`, `border`, `gap`.
