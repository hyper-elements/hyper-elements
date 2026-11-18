---
"title": "Svg"
"group": "Blocks"
"order": 11
"summary": "Shapes (Rect, Circle, Ellipse, Line, Polygon, Path) drawn in a box of its own: its width and height, and the coordinates its viewBox gives them."
---

Shapes (Rect, Circle, Ellipse, Line, Polygon, Path) drawn in a box of its own: its width and height, and the coordinates its viewBox gives them.

Holds: Rect, Circle, Ellipse, Line, Polygon, Path. Not in an Email.

Props:
- `width`: a number from 0 (required)
- `height`: a number from 0 (required)
- `viewBox`: text. The shapes' coordinates in it, as "x y width height" (its width and height by default).
- `title`: text. What it shows, read out by screen readers.

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
- `padding`: *insets*; on a Page, px for all sides, "8px 16px" (1 to 4 values), [v, h] or [t, r, b, l], or { top, right, bottom, left }, or on a Page one to four lengths ("1rem 2rem", "clamp(1rem, 4vw, 3rem)") or { top, right, bottom, left } of lengths (Spacing)
- `backgroundColor`: *color* (Background)
- `border`: *border* (Border)
- `borderRadius`: *radius*; on a Page, px for every corner, [topLeft, topRight, bottomRight, bottomLeft], or { topLeft, topRight, bottomRight, bottomLeft }, or on a Page one to 4 lengths (Border)
- `flex`: *flex* (Layout). In a Row: its share of the width left after children with a width (default 1); "none" takes its own size.

`style.mobile` (on phones): `padding`, `border`.
