---
"title": "Html"
"group": "Blocks"
"order": 22
"summary": "Markup written as it is, for what no component says (the builder's HTML block): in an email and on a page as given, nothing in it checked or escaped. A Document's PDF and a Canvas's image draw its plain text."
---

Markup written as it is, for what no component says (the builder's HTML block): in an email and on a page as given, nothing in it checked or escaped. A Document's PDF and a Canvas's image draw its plain text.

Holds: nothing.

Props:
- `html`: text (required). The markup, written as it is: only markup you trust. Or give it as JSX inside the block, which React writes.
- `text`: text. What it reads as in the plain-text version, and in a PDF or an image (its markup's words where there's none).

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
