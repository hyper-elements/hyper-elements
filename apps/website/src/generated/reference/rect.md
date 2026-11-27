---
"title": "Rect"
"group": "Shapes"
"order": 34
"summary": "A rectangle at x, y in its Svg, rounded by rx."
---

A rectangle at x, y in its Svg, rounded by rx.

Holds: nothing.

Props:
- `x`: a number (default `0`)
- `y`: a number (default `0`)
- `width`: a number from 0 (required)
- `height`: a number from 0 (required)
- `rx`: a number from 0
- `transform`: text. Moves, turns, scales or skews it in its Svg, as SVG's transform ("translate(40 0) rotate(45 20 20)"): in its Svg's units, about its origin unless rotate names a center.

`style`:
- `fill`: *color* (default `"#000000"`, Background). Its inside ("transparent" for none).
- `stroke`: *color* (Border). Its outline's color.
- `strokeWidth`: a number from 0 (Border)
- `opacity`: a number from 0 to 1 (Effects)
