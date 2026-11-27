---
"title": "Values"
"group": "Reference"
"order": 0
"summary": "What a property takes, where it says *kind*:"
---

What a property takes, where it says *kind*:

- *fontFaces*: a list of { family, src, format, weight, style }
- *color*: a color ("#0879a1", "rgb(…)", "rgba(…)" or a CSS name)
- *fontFamily*: a font stack, as CSS writes it ("Inter, Arial, sans-serif")
- *fontWeight*: 100 to 900 in hundreds, "normal" or "bold"
- *lineHeight*: a multiple of the font size (1.5), a percentage ("150%"), px ("24px") or "normal" (the font's own)
- *breakpoints*: { mobile }: the phone width in px (from 240)
- *insets*: px for all sides, "8px 16px" (1 to 4 values), [v, h] or [t, r, b, l], or { top, right, bottom, left }
- *border*: "1px solid #ccc", { width, style, color } for all sides, or { top, right, bottom, left } with one of those each
- *radius*: px for every corner, [topLeft, topRight, bottomRight, bottomLeft], or { topLeft, topRight, bottomRight, bottomLeft }
- *flex*: a share of the free width (0 or more), or "none"
- *tracks*: tracks ("1fr 2fr", "200px 1fr", "repeat(3, 1fr)", "repeat(auto-fill, minmax(200px, 1fr))", "none")
- *areas*: a row of area names per string, as many in each ("header header", "nav main"), "." for an empty cell
- *ratio*: a ratio: a number, "16 / 9" or "auto"
- *images*: images: url(…), a gradient (linear-gradient(…), radial-gradient(…), conic-gradient(…)), several separated by commas, or "none"
- *backgroundSize*: a size ("cover", "contain", "auto", "100% auto", "200px"), per layer
- *position*: a position ("center", "50% 25%", "right 20px top 10px")
- *backgroundRepeat*: "repeat", "no-repeat", "repeat-x", "repeat-y", "space", "round", per layer
- *line*: "1px solid #ccc" or { width, style, color }
- *outline*: an outline ("2px solid #2563eb") or "none"
- *shadows*: shadows ("0 1px 2px rgba(0, 0, 0, 0.1)", "inset 0 0 0 1px #e5e7eb"), several separated by commas, or "none"
- *transform*: transforms ("translateY(-2px)", "scale(1.05) rotate(3deg)") or "none"
- *origin*: an origin ("center", "top left", "50% 100%")
- *transition*: transitions ("background-color 150ms ease", "all 0.2s"), several separated by commas, or "none"
- *filter*: filters (blur(), drop-shadow(), hue-rotate(), brightness(), contrast(), grayscale(), invert(), opacity(), saturate(), sepia()) or "none"
- *link*: a URL (http, https, mailto, tel, a path, or a merge tag) or { href, target }
- *attributes*: attributes by name, each a text value (no on… handlers, href or style)
- *asset*: an image URL (http, https or a data:image URI), or { src, width, height }
- *video*: a YouTube or Vimeo video's https link
