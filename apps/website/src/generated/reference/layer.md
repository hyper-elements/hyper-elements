---
"title": "Layer"
"group": "Sections and layout"
"order": 9
"summary": "Its children over each other, in one box as tall as the tallest: words on an image (a background image, its first child). In an email, an Image with one child over it."
---

Its children over each other, in one box as tall as the tallest: words on an image (a background image, its first child). In an email, an Image with one child over it.

Holds: Row, Column, Grid, Layer, Svg, Text, Heading, Link, Button, Image, Divider, List, Table, Video, Social, Menu, Html.

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
- `minWidth`: a length (a number of px, %) (Size)
- `maxWidth`: a length (a number of px, %) (Size)
- `backgroundColor`: *color* (Background)
- `border`: *border* (Border)
- `borderRadius`: *radius* (Border)
- `height`: a length (a number of px) (Size). Its height: the image under its children covers it, cut at its sides or its top and bottom.
- `alignItems`: one of "start", "center", "end", "stretch" (default `"start"`, Layout). Where its children sit in its height, as CSS align-items.
- `justifyItems`: one of "start", "center", "end", "stretch" (default `"stretch"`, Layout). Where its children sit across its width, as CSS justify-items: stretched to it by default.
- `flex`: *flex* (Layout). In a Row: its share of the width left after children with a width (default 1); "none" takes its own size.

`style.mobile` (on phones): `fontSize`, `lineHeight`, `letterSpacing`, `textAlign`, `width`, `maxWidth`, `border`.
