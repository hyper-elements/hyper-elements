---
"title": "Canvas"
"group": "Roots"
"order": 4
"summary": "An image of a fixed size (a social card, a banner): its children laid out in it as on a page. Written as PNG or SVG with @hyper-elements/react/image."
---

An image of a fixed size (a social card, a banner): its children laid out in it as on a page. Written as PNG or SVG with @hyper-elements/react/image.

Holds: Section, Row, Column, Box, Grid, Layer, Svg, Text, Heading, Link, Button, Image, Divider, List, Table, Video, Social, Menu, Html.

Props:
- `width`: a length (a number of px) (default `1200`). The image's width, in px.
- `height`: a length (a number of px) (default `630`). The image's height, in px: what's past it is cut.
- `title`: text. The document's title (shown in a browser tab, and by some email clients).
- `lang`: text. Its language, as a BCP 47 tag ("en", "ar").
- `dir`: one of "ltr", "rtl", "auto"
- `fonts`: *fontFaces*. The font files the template loads: a family's file for each weight and style it uses. Text names a family in its fontFamily stack, before the fonts to show where it can't load.

`style`:
- `color`: *color* (default `"#000000"`, inherited, Typography)
- `fontFamily`: *fontFamily* (default `"Arial, Helvetica, sans-serif"`, inherited, Typography)
- `fontSize`: a length (a number of px) (default `16`, inherited, Typography)
- `fontWeight`: *fontWeight* (default `400`, inherited, Typography)
- `fontStyle`: one of "normal", "italic" (inherited, Typography)
- `lineHeight`: *lineHeight* (default `1.5`, inherited, Typography)
- `letterSpacing`: a length (a number of px) (inherited, Typography)
- `textAlign`: one of "left", "center", "right", "justify" (default `"left"`, inherited, Typography)
- `textTransform`: one of "none", "uppercase", "lowercase", "capitalize" (inherited, Typography)
- `backgroundColor`: *color* (Background). The window's background, behind the content.
- `gap`: a length (a number of px) (Spacing). Space between children.
- `alignItems`: one of "start", "center", "end", "stretch" (Layout). Where children sit across the layout's direction (vertically in a Row, horizontally in a Column), as CSS align-items. Across a Column it places what has its own size (a Button, an Image, an Svg, a box with a width); a block of text fills the width, so its words move with its textAlign.
- `padding`: *insets* (Spacing)
- `justifyContent`: one of "start", "center", "end", "space-between" (Layout). Where children sit along the layout's direction, as CSS justify-content.
