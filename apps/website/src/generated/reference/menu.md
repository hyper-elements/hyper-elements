---
"title": "Menu"
"group": "Blocks"
"order": 21
"summary": "A line of links (a site's sections, a footer's), onto more lines where they don't fit, with a separator between them on desktop; or links down a column."
---

A line of links (a site's sections, a footer's), onto more lines where they don't fit, with a separator between them on desktop; or links down a column.

Holds: nothing.

Props:
- `items`: a list of items, each { text, href } (required). Each link's text and where it goes.
- `separator`: text (default `""`). Between the links of a horizontal menu ("|", "·"), on desktop: phones show none.
- `layout`: one of "horizontal", "vertical" (default `"horizontal"`)

`style`:
- `color`: *color* (default `"#0068A5"`, inherited, Typography)
- `fontFamily`: *fontFamily* (inherited, Typography)
- `fontSize`: a length (a number of px); on a Page, a length (a number of px), or on a Page a length (a number of px, rem, em, %, vw, vh, calc(), min(), max(), clamp()) (default `14`, inherited, Typography)
- `fontWeight`: *fontWeight* (inherited, Typography)
- `lineHeight`: *lineHeight*; on a Page, a multiple of the font size (1.5), a percentage ("150%"), px ("24px") or "normal" (the font's own), or on a Page a length ("1.5rem", "1.25em", "calc(1em + 4px)") (default `1.2`, inherited, Typography)
- `letterSpacing`: a length (a number of px); on a Page, a length (a number of px), or on a Page a length (a number of px, rem, em, vw, vh, calc(), min(), max(), clamp()) (inherited, Typography)
- `textTransform`: one of "none", "uppercase", "lowercase", "capitalize" (inherited, Typography)
- `separatorColor`: *color* (default `"#444444"`, Border)
- `padding`: *insets* (default `{"top":5,"right":15,"bottom":5,"left":15}`, Spacing). Around each link: its sides are the space between them.
- `justifyContent`: one of "start", "center", "end" (default `"center"`, Layout). Where the links sit.
- `flex`: *flex* (Layout). In a Row: its share of the width left after children with a width (default 1); "none" takes its own size.

`style.mobile` (on phones): `fontSize`, `lineHeight`, `letterSpacing`.
