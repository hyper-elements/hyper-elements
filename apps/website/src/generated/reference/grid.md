---
"title": "Grid"
"group": "Sections and layout"
"order": 8
"summary": "Its children in columns of equal width, row after row; on phones, one under another."
---

Its children in columns of equal width, row after row; on phones, one under another.

Holds: Row, Column, Grid, Layer, Svg, Text, Heading, Link, Button, Image, Divider, List, Table, Video, Social, Menu, Html.

Props:
- `columns`: an integer from 1 to 12 (default `2`). How many children to a row.
- `stackOnMobile`: true or false (default `true`). Its children one under another on phones (in an Email or a Page).

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
- `gap`: a length (a number of px) (Spacing). Space between its children, across and down (unless rowGap is set).
- `rowGap`: a length (a number of px) (Spacing). Space between its rows (gap by default); on phones, where the children stack, gap is between them.
- `alignItems`: one of "start", "center", "end", "stretch" (Layout). Where each child sits in its row's height, as CSS align-items.
- `flex`: *flex* (Layout). In a Row: its share of the width left after children with a width (default 1); "none" takes its own size.

`style.mobile` (on phones): `fontSize`, `lineHeight`, `letterSpacing`, `textAlign`, `width`, `maxWidth`, `padding`, `border`, `gap`, `rowGap`.
