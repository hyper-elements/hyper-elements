---
"title": "Span"
"group": "Inline"
"order": 24
"summary": "Styled text inside text; raised or lowered (superscript, subscript) with verticalAlign."
---

Styled text inside text; raised or lowered (superscript, subscript) with verticalAlign.

Holds: text; PageNumber, Span, Link, LineBreak, MergeTag.

Props:
- `as`: one of "strong", "em", "code", "kbd", "time", "mark", "abbr", "sup", "sub", "small", "cite", "q" (only in Page). The inline element it's written as, for its meaning: strong, em, code, kbd, time, mark, abbr, sup, sub, small, cite or q. On a Page only.

`style`:
- `whiteSpace`: one of "normal", "nowrap", "pre", "pre-wrap", "pre-line", "break-spaces" (only in Page, Typography). Whether its text wraps and keeps its spaces.
- `color`: *color* (inherited, Typography)
- `fontFamily`: *fontFamily* (inherited, Typography)
- `fontSize`: a length (a number of px); on a Page, a length (a number of px), or on a Page a length (a number of px, rem, em, %, vw, vh, calc(), min(), max(), clamp()) (inherited, Typography)
- `fontWeight`: *fontWeight* (inherited, Typography)
- `fontStyle`: one of "normal", "italic" (inherited, Typography)
- `letterSpacing`: a length (a number of px); on a Page, a length (a number of px), or on a Page a length (a number of px, rem, em, vw, vh, calc(), min(), max(), clamp()) (inherited, Typography)
- `textTransform`: one of "none", "uppercase", "lowercase", "capitalize" (inherited, Typography)
- `textDecoration`: one of "none", "underline", "line-through" (Typography)
- `backgroundColor`: *color* (Background)
- `verticalAlign`: one of "baseline", "super", "sub" (Layout). "super": superscript (®, a footnote mark); "sub": subscript; as CSS vertical-align.

`style.mobile` (on phones): `fontSize`, `letterSpacing`.
