---
"title": "Column"
"group": "Sections and layout"
"order": 7
"summary": "Stacks its children vertically, with its own spacing and box."
---

Stacks its children vertically, with its own spacing and box.

Holds: Row, Column, Box, Grid, Layer, Svg, Text, Heading, Link, Button, Image, Divider, List, Table, Video, Social, Menu, Html.

`style`:
- `display`: one of "block", "flex", "grid", "inline", "inline-block", "inline-flex", "none" (only in Page, Layout). How it lays out its children, as CSS display: a Box is a flex column unless it says otherwise.
- `flexDirection`: one of "row", "row-reverse", "column", "column-reverse" (only in Page, Layout). Its children side by side (row) or one under another (column), where it's a flex box.
- `flexWrap`: one of "nowrap", "wrap", "wrap-reverse" (only in Page, Layout). Children that don't fit go onto another line, where it's a flex box.
- `gridTemplateColumns`: *tracks* (only in Page, Layout). Its grid's columns: "1fr 2fr", "repeat(3, 1fr)", "repeat(auto-fill, minmax(200px, 1fr))".
- `gridTemplateRows`: *tracks* (only in Page, Layout). Its grid's rows.
- `gridTemplateAreas`: *areas* (only in Page, Layout). Its grid's named areas, a string per row: ["header header", "nav main"].
- `gridAutoFlow`: one of "row", "column", "dense", "row dense", "column dense" (only in Page, Layout). Where its grid puts children not placed.
- `rowGap`: a length (a number of px, rem, em, %, vw, vh, calc(), min(), max(), clamp()) (only in Page, Spacing). Space between its rows.
- `columnGap`: a length (a number of px, rem, em, %, vw, vh, calc(), min(), max(), clamp()) (only in Page, Spacing). Space between its columns.
- `alignContent`: one of "start", "center", "end", "stretch", "space-between", "space-around", "space-evenly" (only in Page, Layout). Where its lines or rows sit, as CSS align-content.
- `justifyItems`: one of "start", "center", "end", "stretch" (only in Page, Layout). Where each child sits across its grid cell, as CSS justify-items.
- `alignSelf`: one of "auto", "start", "center", "end", "stretch", "baseline" (only in Page, Layout). Where it sits across its parent's flex box or grid cell, over the parent's alignItems.
- `justifySelf`: one of "auto", "start", "center", "end", "stretch" (only in Page, Layout). Where it sits along its grid cell.
- `order`: a whole number (only in Page, Layout). Its place among its siblings in a flex box or grid, lowest first.
- `flexGrow`: a number from 0 to Infinity (only in Page, Layout). Its share of the room left in its parent's flex box.
- `flexShrink`: a number from 0 to Infinity (only in Page, Layout). How much it gives up where its parent's flex box is too small.
- `flexBasis`: a length (a number of px, rem, em, %, vw, vh, calc(), min(), max(), clamp(), "auto", "content") (only in Page, Layout). Its size along its parent's flex box before what's left is shared.
- `gridColumn`: a grid line, "span n", an area's name or "auto", up to 2 separated by " / " (only in Page, Layout). The columns it takes in its parent's grid: "span 2", "1 / 3".
- `gridRow`: a grid line, "span n", an area's name or "auto", up to 2 separated by " / " (only in Page, Layout). The rows it takes in its parent's grid.
- `gridArea`: a grid line, "span n", an area's name or "auto", up to 4 separated by " / " (only in Page, Layout). The named area it takes in its parent's grid (gridTemplateAreas), or its lines.
- `minHeight`: a length (a number of px, rem, em, %, vw, vh, calc(), min(), max(), clamp(), "auto", "min-content", "max-content", "fit-content") (only in Page, Size)
- `maxHeight`: a length (a number of px, rem, em, %, vw, vh, calc(), min(), max(), clamp(), "none", "min-content", "max-content", "fit-content") (only in Page, Size)
- `aspectRatio`: *ratio* (only in Page, Size). Its height from its width: "16 / 9".
- `position`: one of "static", "relative", "absolute", "fixed", "sticky" (only in Page, Position). How it's placed: sticky keeps it in view as the page scrolls; absolute and fixed take it out of the flow.
- `top`: a length (a number of px, rem, em, %, vw, vh, calc(), min(), max(), clamp(), "auto") (only in Page, Position)
- `right`: a length (a number of px, rem, em, %, vw, vh, calc(), min(), max(), clamp(), "auto") (only in Page, Position)
- `bottom`: a length (a number of px, rem, em, %, vw, vh, calc(), min(), max(), clamp(), "auto") (only in Page, Position)
- `left`: a length (a number of px, rem, em, %, vw, vh, calc(), min(), max(), clamp(), "auto") (only in Page, Position)
- `inset`: one to 4 lengths or "auto" (only in Page, Position). top, right, bottom and left at once, as CSS inset.
- `zIndex`: a whole number or "auto" (only in Page, Position). Over or under what it overlaps, highest on top.
- `paddingTop`: a length (a number of px, rem, em, %, vw, vh, calc(), min(), max(), clamp()) (only in Page, Spacing)
- `paddingRight`: a length (a number of px, rem, em, %, vw, vh, calc(), min(), max(), clamp()) (only in Page, Spacing)
- `paddingBottom`: a length (a number of px, rem, em, %, vw, vh, calc(), min(), max(), clamp()) (only in Page, Spacing)
- `paddingLeft`: a length (a number of px, rem, em, %, vw, vh, calc(), min(), max(), clamp()) (only in Page, Spacing)
- `backgroundImage`: *images* (only in Page, Background). Images and gradients behind it, the first on top: "url(…)", "linear-gradient(…)", several separated by commas.
- `backgroundSize`: *backgroundSize* (only in Page, Background). "cover", "contain", or a size, per layer.
- `backgroundPosition`: *position* (only in Page, Background). "center", "50% 0", per layer.
- `backgroundRepeat`: *backgroundRepeat* (only in Page, Background). "no-repeat", "repeat-x", per layer.
- `borderTop`: *line* (only in Page, Border)
- `borderRight`: *line* (only in Page, Border)
- `borderBottom`: *line* (only in Page, Border)
- `borderLeft`: *line* (only in Page, Border)
- `borderColor`: *color* (only in Page, Border). Every side's colour, over border's.
- `borderStyle`: one of "solid", "dashed", "dotted", "double", "none" (only in Page, Border). Every side's style, over border's.
- `borderWidth`: one to 4 lengths (only in Page, Border). Every side's width (one to four lengths), over border's.
- `outline`: *outline* (only in Page, Border). A line around it outside its border, taking no room: "2px solid #2563eb".
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
- `minWidth`: a length (a number of px, %); on a Page, a length (a number of px, %), or on a Page a length (a number of px, rem, em, %, vw, vh, calc(), min(), max(), clamp(), "auto", "min-content", "max-content", "fit-content") (Size)
- `maxWidth`: a length (a number of px, %); on a Page, a length (a number of px, %), or on a Page a length (a number of px, rem, em, %, vw, vh, calc(), min(), max(), clamp(), "none", "min-content", "max-content", "fit-content") (Size)
- `height`: a length (a number of px); on a Page, a length (a number of px), or on a Page a length (a number of px, rem, em, %, vw, vh, calc(), min(), max(), clamp(), "auto", "min-content", "max-content", "fit-content") (Size)
- `padding`: *insets*; on a Page, px for all sides, "8px 16px" (1 to 4 values), [v, h] or [t, r, b, l], or { top, right, bottom, left }, or on a Page one to four lengths ("1rem 2rem", "clamp(1rem, 4vw, 3rem)") or { top, right, bottom, left } of lengths (Spacing)
- `backgroundColor`: *color* (Background)
- `border`: *border* (Border)
- `borderRadius`: *radius*; on a Page, px for every corner, [topLeft, topRight, bottomRight, bottomLeft], or { topLeft, topRight, bottomRight, bottomLeft }, or on a Page one to 4 lengths (Border)
- `overflow`: one of "visible", "hidden"; on a Page, one of "visible", "hidden", "clip", "scroll", "auto" (Layout). Whether content past a set height is cut off.
- `gap`: a length (a number of px); on a Page, a length (a number of px), or on a Page a length (a number of px, rem, em, %, vw, vh, calc(), min(), max(), clamp()) (Spacing). Space between children.
- `alignItems`: one of "start", "center", "end", "stretch"; on a Page, one of "start", "center", "end", "stretch", "baseline" (Layout). Where children sit across the layout's direction (vertically in a Row, horizontally in a Column), as CSS align-items. Across a Column it places what has its own size (a Button, an Image, an Svg, a box with a width); a block of text fills the width, so its words move with its textAlign.
- `justifyContent`: one of "start", "center", "end", "space-between"; on a Page, one of "start", "center", "end", "space-between", "space-around", "space-evenly", "stretch" (Layout). Where children sit along the layout's direction, as CSS justify-content.
- `flex`: *flex* (Layout). In a Row: its share of the width left after children with a width (default 1); "none" takes its own size.

`style.mobile` (on phones): `fontSize`, `lineHeight`, `letterSpacing`, `textAlign`, `width`, `maxWidth`, `padding`, `border`, `gap`.
