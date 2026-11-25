---
"title": "Section"
"group": "Sections and layout"
"order": 5
"summary": "A band across the whole window, directly in an Email or Page: its background spans the window, its children are stacked at the content width."
---

A band across the whole window, directly in an Email or Page: its background spans the window, its children are stacked at the content width.

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
- `backgroundColor`: *color* (Background)
- `padding`: *insets* (Spacing)
- `border`: *border* (Border)
- `gap`: a length (a number of px) (Spacing). Space between children.
- `alignItems`: one of "start", "center", "end", "stretch" (Layout). Where children sit across the layout's direction (vertically in a Row, horizontally in a Column), as CSS align-items. Across a Column it places what has its own size (a Button, an Image, an Svg, a box with a width); a block of text fills the width, so its words move with its textAlign.

`style.mobile` (on phones): `fontSize`, `lineHeight`, `letterSpacing`, `textAlign`, `padding`, `border`, `gap`.
