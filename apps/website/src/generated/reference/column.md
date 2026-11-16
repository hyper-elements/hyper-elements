---
"title": "Column"
"group": "Sections and layout"
"order": 7
"summary": "Stacks its children vertically, with its own spacing and box."
---

Stacks its children vertically, with its own spacing and box.

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
- `height`: a length (a number of px) (Size)
- `padding`: *insets* (Spacing)
- `backgroundColor`: *color* (Background)
- `border`: *border* (Border)
- `borderRadius`: *radius* (Border)
- `overflow`: one of "visible", "hidden" (Layout). Whether content past a set height is cut off.
- `gap`: a length (a number of px) (Spacing). Space between children.
- `alignItems`: one of "start", "center", "end", "stretch" (Layout). Where children sit across the layout's direction (vertically in a Row, horizontally in a Column), as CSS align-items. Across a Column it places what has its own size (a Button, an Image, an Svg, a box with a width); a block of text fills the width, so its words move with its textAlign.
- `justifyContent`: one of "start", "center", "end", "space-between" (Layout). Where children sit along the layout's direction, as CSS justify-content.
- `flex`: *flex* (Layout). In a Row: its share of the width left after children with a width (default 1); "none" takes its own size.

`style.mobile` (on phones): `fontSize`, `lineHeight`, `letterSpacing`, `textAlign`, `width`, `maxWidth`, `padding`, `border`, `gap`.
