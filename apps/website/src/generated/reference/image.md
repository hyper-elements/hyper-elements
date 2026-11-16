---
"title": "Image"
"group": "Blocks"
"order": 14
"summary": "An image in the content. Without a width it takes its own size, no wider than its parent."
---

An image in the content. Without a width it takes its own size, no wider than its parent.

Holds: nothing.

Props:
- `src`: *asset* (required)
- `alt`: text (default `""`). Read out by screen readers, and shown where images don't load.
- `title`: text. Shown as a tooltip by mail clients and browsers that show one.

`style`:
- `width`: a length (a number of px, %) (Size)
- `maxWidth`: a length (a number of px, %) (Size)
- `height`: a length (a number of px) (Size)
- `border`: *border* (Border)
- `borderRadius`: *radius* (Border)
- `flex`: *flex* (Layout). In a Row: its share of the width left after children with a width (default 1); "none" takes its own size.
- `alignSelf`: one of "start", "center", "end" (Layout). Where it sits in its stack on phones, where that's another place than on desktop.
- `verticalAlign`: one of "top", "middle" (Layout). Where it sits in a line of text it's in.

`style.mobile` (on phones): `width`, `maxWidth`, `border`, `alignSelf`.
