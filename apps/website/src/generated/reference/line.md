---
"title": "Line"
"group": "Shapes"
"order": 37
"summary": "A straight line from x1, y1 to x2, y2 in its Svg (drawn by its stroke)."
---

A straight line from x1, y1 to x2, y2 in its Svg (drawn by its stroke).

Holds: nothing.

Props:
- `x1`: a number (default `0`)
- `y1`: a number (default `0`)
- `x2`: a number (default `0`)
- `y2`: a number (default `0`)
- `transform`: text. Moves, turns, scales or skews it in its Svg, as SVG's transform ("translate(40 0) rotate(45 20 20)"): in its Svg's units, about its origin unless rotate names a center.

`style`:
- `fill`: *color* (default `"#000000"`, Background). Its inside ("transparent" for none).
- `stroke`: *color* (Border). Its outline's color.
- `strokeWidth`: a number from 0 (Border)
- `opacity`: a number from 0 to 1 (Effects)
