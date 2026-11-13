---
"title": "Page"
"group": "Roots"
"order": 2
"summary": "A web page. Its children are stacked down the content width, centered in the window."
---

A web page. Its children are stacked down the content width, centered in the window.

Holds: Section, Row, Column, Box, Grid, Layer, Svg, Text, Heading, Link, Button, Image, Divider, List, Table, Video, Social, Menu, Html.

Props:
- `width`: a length (a number of px) (default `1200`). The widest the content gets.
- `description`: text. The page's meta description.
- `breakpoints`: *breakpoints*. Where its phone styles start: mobile, the widest window they apply to, in px (480 where it's not set).
- `title`: text. The document's title (shown in a browser tab, and by some email clients).
- `lang`: text. Its language, as a BCP 47 tag ("en", "ar").
- `dir`: one of "ltr", "rtl", "auto"
- `fonts`: *fontFaces*. The font files the template loads: a family's file for each weight and style it uses. Text names a family in its fontFamily stack, before the fonts to show where it can't load.

`style`:
- `color`: *color* (default `"#000000"`, inherited, Typography)
- `fontFamily`: *fontFamily* (default `"Arial, Helvetica, sans-serif"`, inherited, Typography)
- `fontSize`: a length (a number of px); on a Page, a length (a number of px), or on a Page a length (a number of px, rem, em, %, vw, vh, calc(), min(), max(), clamp()) (default `16`, inherited, Typography)
- `fontWeight`: *fontWeight* (default `400`, inherited, Typography)
- `fontStyle`: one of "normal", "italic" (inherited, Typography)
- `lineHeight`: *lineHeight*; on a Page, a multiple of the font size (1.5), a percentage ("150%"), px ("24px") or "normal" (the font's own), or on a Page a length ("1.5rem", "1.25em", "calc(1em + 4px)") (default `1.5`, inherited, Typography)
- `letterSpacing`: a length (a number of px); on a Page, a length (a number of px), or on a Page a length (a number of px, rem, em, vw, vh, calc(), min(), max(), clamp()) (inherited, Typography)
- `textAlign`: one of "left", "center", "right", "justify" (default `"left"`, inherited, Typography)
- `textTransform`: one of "none", "uppercase", "lowercase", "capitalize" (inherited, Typography)
- `backgroundColor`: *color* (Background). The window's background, behind the content.
- `gap`: a length (a number of px); on a Page, a length (a number of px), or on a Page a length (a number of px, rem, em, %, vw, vh, calc(), min(), max(), clamp()) (Spacing). Space between children.
- `alignItems`: one of "start", "center", "end", "stretch"; on a Page, one of "start", "center", "end", "stretch", "baseline" (Layout). Where children sit across the layout's direction (vertically in a Row, horizontally in a Column), as CSS align-items. Across a Column it places what has its own size (a Button, an Image, an Svg, a box with a width); a block of text fills the width, so its words move with its textAlign.

`style.mobile` (on phones): `gap`.
