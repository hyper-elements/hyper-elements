---
"title": "Row"
"group": "Sections and layout"
"order": 6
"summary": "Lays its children out side by side. A child takes its width, or a share of what's left (its flex, 1 by default)."
---

Lays its children out side by side. A child takes its width, or a share of what's left (its flex, 1 by default).

Holds: Row, Column, Grid, Layer, Svg, Text, Heading, Link, Button, Image, Divider, List, Table, Video, Social, Menu, Html.

Props:
- `stackOnMobile`: true or false (default `true`). Its children stack full-width on phones (in an Email or a Page).
- `dir`: one of "ltr", "rtl", "auto". Its text's direction, where it differs from the template's; it starts on that side unless aligned otherwise.

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
- `flexWrap`: one of "nowrap", "wrap", "words" (Layout). "wrap": children that don't fit wrap onto another line, as CSS flex-wrap (in an email, in a Row kept side by side on phones, with no gap between the lines). "words": in an email, also a space of the text's font apart, on lines at least as tall as its, as words are.
- `flex`: *flex* (Layout). In a Row: its share of the width left after children with a width (default 1); "none" takes its own size.

`style.mobile` (on phones): `fontSize`, `lineHeight`, `letterSpacing`, `textAlign`, `width`, `maxWidth`, `padding`, `border`, `gap`.
