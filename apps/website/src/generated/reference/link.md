---
"title": "Link"
"group": "Inline"
"order": 24
"summary": "A link: text inside text, or around an Image."
---

A link: text inside text, or around an Image.

Holds: text; PageNumber, Span, Link, LineBreak, MergeTag, Image.

Props:
- `href`: *link* (required)
- `title`: text. Shown as a tooltip by mail clients and browsers that show one.
- `aria-label`: text. What a screen reader says for it, where its text alone doesn't say enough ("Read more about pricing").
- `attrs`: *attributes*. More attributes for it: a class, a `data-` attribute.

`style`:
- `color`: *color* (default `"#0000ee"`, inherited, Typography)
- `fontFamily`: *fontFamily* (inherited, Typography)
- `fontSize`: a length (a number of px) (inherited, Typography)
- `fontWeight`: *fontWeight* (inherited, Typography)
- `fontStyle`: one of "normal", "italic" (inherited, Typography)
- `letterSpacing`: a length (a number of px) (inherited, Typography)
- `textTransform`: one of "none", "uppercase", "lowercase", "capitalize" (inherited, Typography)
- `textDecoration`: one of "none", "underline", "line-through" (default `"underline"`, Typography)
- `backgroundColor`: *color* (Background)
- `flex`: *flex* (Layout). In a Row: its share of the width left after children with a width (default 1); "none" takes its own size.

`style.hover`: `color`, `textDecoration`, `backgroundColor`.

`style.mobile` (on phones): `fontSize`, `letterSpacing`.
