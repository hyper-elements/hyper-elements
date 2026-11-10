---
"title": "Image"
"group": "Blocks"
"order": 15
"summary": "An image in the content. Without a width it takes its own size, no wider than its parent."
---

An image in the content. Without a width it takes its own size, no wider than its parent.

Holds: nothing.

Props:
- `src`: *asset* (required)
- `alt`: text (default `""`). Read out by screen readers, and shown where images don't load.
- `title`: text. Shown as a tooltip by mail clients and browsers that show one.

`style`:
- `alignSelf`: one of "start", "center", "end" (Layout). Where it sits in its stack on phones, where that's another place than on desktop.
- `justifySelf`: one of "auto", "start", "center", "end", "stretch" (only in Page, Layout). Where it sits along its grid cell.
- `order`: a whole number (only in Page, Layout). Its place among its siblings in a flex box or grid, lowest first.
- `flexGrow`: a number from 0 to Infinity (only in Page, Layout). Its share of the room left in its parent's flex box.
- `flexShrink`: a number from 0 to Infinity (only in Page, Layout). How much it gives up where its parent's flex box is too small.
- `flexBasis`: a length (a number of px, rem, em, %, vw, vh, calc(), min(), max(), clamp(), "auto", "content") (only in Page, Layout). Its size along its parent's flex box before what's left is shared.
- `gridColumn`: a grid line, "span n", an area's name or "auto", up to 2 separated by " / " (only in Page, Layout). The columns it takes in its parent's grid: "span 2", "1 / 3".
- `gridRow`: a grid line, "span n", an area's name or "auto", up to 2 separated by " / " (only in Page, Layout). The rows it takes in its parent's grid.
- `gridArea`: a grid line, "span n", an area's name or "auto", up to 4 separated by " / " (only in Page, Layout). The named area it takes in its parent's grid (gridTemplateAreas), or its lines.
- `aspectRatio`: *ratio* (only in Page, Size). Its height from its width: "16 / 9".
- `objectFit`: one of "fill", "contain", "cover", "none", "scale-down" (only in Page, Size). How the picture fills its box: cover crops it, contain fits it in.
- `objectPosition`: *position* (only in Page, Size). Where the picture sits in its box.
- `position`: one of "static", "relative", "absolute", "fixed", "sticky" (only in Page, Position). How it's placed: sticky keeps it in view as the page scrolls; absolute and fixed take it out of the flow.
- `top`: a length (a number of px, rem, em, %, vw, vh, calc(), min(), max(), clamp(), "auto") (only in Page, Position)
- `right`: a length (a number of px, rem, em, %, vw, vh, calc(), min(), max(), clamp(), "auto") (only in Page, Position)
- `bottom`: a length (a number of px, rem, em, %, vw, vh, calc(), min(), max(), clamp(), "auto") (only in Page, Position)
- `left`: a length (a number of px, rem, em, %, vw, vh, calc(), min(), max(), clamp(), "auto") (only in Page, Position)
- `inset`: one to 4 lengths or "auto" (only in Page, Position). top, right, bottom and left at once, as CSS inset.
- `zIndex`: a whole number or "auto" (only in Page, Position). Over or under what it overlaps, highest on top.
- `opacity`: a number from 0 to 1 (only in Page, Effects). 0 is invisible, 1 solid.
- `boxShadow`: *shadows* (only in Page, Effects). "0 1px 2px rgba(0, 0, 0, 0.1)", several separated by commas.
- `transform`: *transform* (only in Page, Effects). Moved, scaled, rotated or skewed as drawn, taking the room it took: "translateY(-2px)".
- `transformOrigin`: *origin* (only in Page, Effects). The point it's scaled and rotated about.
- `transition`: *transition* (only in Page, Effects). How a change of style animates: "background-color 150ms ease".
- `filter`: *filter* (only in Page, Effects). blur(), brightness(), grayscale() and the rest, as drawn: "grayscale(1)".
- `backdropFilter`: *filter* (only in Page, Effects). Filters on what's behind it: "blur(8px)".
- `mixBlendMode`: one of "normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "difference", "exclusion", "luminosity" (only in Page, Effects). How it blends with what's behind it.
- `maskImage`: *images* (only in Page, Effects). An image or gradient whose see-through parts hide it.
- `cursor`: one of "auto", "default", "pointer", "text", "move", "not-allowed", "grab", "grabbing", "help", "wait", "crosshair", "zoom-in", "zoom-out" (only in Page, Effects). The pointer over it.
- `pointerEvents`: one of "auto", "none" (only in Page, Effects). "none": clicks go through it to what's under it.
- `width`: a length (a number of px, %); on a Page, a length (a number of px, %), or on a Page a length (a number of px, rem, em, %, vw, vh, calc(), min(), max(), clamp(), "auto", "min-content", "max-content", "fit-content") (Size)
- `maxWidth`: a length (a number of px, %); on a Page, a length (a number of px, %), or on a Page a length (a number of px, rem, em, %, vw, vh, calc(), min(), max(), clamp(), "none", "min-content", "max-content", "fit-content") (Size)
- `height`: a length (a number of px); on a Page, a length (a number of px), or on a Page a length (a number of px, rem, em, %, vw, vh, calc(), min(), max(), clamp(), "auto", "min-content", "max-content", "fit-content") (Size)
- `border`: *border* (Border)
- `borderRadius`: *radius*; on a Page, px for every corner, [topLeft, topRight, bottomRight, bottomLeft], or { topLeft, topRight, bottomRight, bottomLeft }, or on a Page one to 4 lengths (Border)
- `flex`: *flex* (Layout). In a Row: its share of the width left after children with a width (default 1); "none" takes its own size.
- `verticalAlign`: one of "top", "middle" (Layout). Where it sits in a line of text it's in.

`style.mobile` (on phones): `alignSelf`, `width`, `maxWidth`, `border`.
