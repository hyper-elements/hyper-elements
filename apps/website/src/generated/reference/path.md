---
"title": "Path"
"group": "Shapes"
"order": 39
"summary": "A shape drawn by an SVG path (d), in its Svg."
---

A shape drawn by an SVG path (d), in its Svg.

Holds: nothing.

Props:
- `d`: text (required). SVG path data ("M0 0 L40 0 L20 30 Z").
- `transform`: text. Moves, turns, scales or skews it in its Svg, as SVG's transform ("translate(40 0) rotate(45 20 20)"): in its Svg's units, about its origin unless rotate names a center.

`style`:
- `fill`: *color* (default `"#000000"`, Background). Its inside ("transparent" for none).
- `stroke`: *color* (Border). Its outline's color.
- `strokeWidth`: a number from 0 (Border)
- `opacity`: a number from 0 to 1 (Effects)
