---
"title": "Video"
"group": "Blocks"
"order": 19
"summary": "A YouTube or Vimeo video: its player on a page; in an email (which can't play one), its thumbnail, linked to it."
---

A YouTube or Vimeo video: its player on a page; in an email (which can't play one), its thumbnail, linked to it.

Holds: nothing.

Props:
- `src`: *video* (required). The video's YouTube or Vimeo link.
- `thumbnail`: *asset*. The image an email shows, linked to the video. A YouTube video's own where there's none; a Vimeo video's can't be found without the network.
- `title`: text (default `"Video"`). The player's title on a page, the thumbnail's alternate text in an email.

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
- `width`: a length (a number of px, %); on a Page, a length (a number of px, %), or on a Page a length (a number of px, rem, em, %, vw, vh, calc(), min(), max(), clamp(), "auto", "min-content", "max-content", "fit-content") (Size)
- `maxWidth`: a length (a number of px, %); on a Page, a length (a number of px, %), or on a Page a length (a number of px, rem, em, %, vw, vh, calc(), min(), max(), clamp(), "none", "min-content", "max-content", "fit-content") (Size)
- `flex`: *flex* (Layout). In a Row: its share of the width left after children with a width (default 1); "none" takes its own size.

`style.mobile` (on phones): `width`, `maxWidth`.
