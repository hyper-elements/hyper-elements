/**
 * Colors as Elements takes them (`#rrggbb`, `rgba(…)`, a lowercase CSS name, `transparent`), composited and compared
 * the way WCAG 2.1 does: source-over in sRGB, then the ratio of relative luminances.
 */

/** A color: channels 0 to 255, alpha 0 to 1. */
export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

// CSS Color 4's named colors, as #rrggbb (test/color.test.ts checks them against the names core takes).
const NAMES =
  "aliceblue f0f8ff antiquewhite faebd7 aqua 00ffff aquamarine 7fffd4 azure f0ffff beige f5f5dc bisque ffe4c4 black 000000 " +
  "blanchedalmond ffebcd blue 0000ff blueviolet 8a2be2 brown a52a2a burlywood deb887 cadetblue 5f9ea0 chartreuse 7fff00 " +
  "chocolate d2691e coral ff7f50 cornflowerblue 6495ed cornsilk fff8dc crimson dc143c cyan 00ffff darkblue 00008b " +
  "darkcyan 008b8b darkgoldenrod b8860b darkgray a9a9a9 darkgreen 006400 darkgrey a9a9a9 darkkhaki bdb76b " +
  "darkmagenta 8b008b darkolivegreen 556b2f darkorange ff8c00 darkorchid 9932cc darkred 8b0000 darksalmon e9967a " +
  "darkseagreen 8fbc8f darkslateblue 483d8b darkslategray 2f4f4f darkslategrey 2f4f4f darkturquoise 00ced1 " +
  "darkviolet 9400d3 deeppink ff1493 deepskyblue 00bfff dimgray 696969 dimgrey 696969 dodgerblue 1e90ff " +
  "firebrick b22222 floralwhite fffaf0 forestgreen 228b22 fuchsia ff00ff gainsboro dcdcdc ghostwhite f8f8ff " +
  "gold ffd700 goldenrod daa520 gray 808080 green 008000 greenyellow adff2f grey 808080 honeydew f0fff0 " +
  "hotpink ff69b4 indianred cd5c5c indigo 4b0082 ivory fffff0 khaki f0e68c lavender e6e6fa lavenderblush fff0f5 " +
  "lawngreen 7cfc00 lemonchiffon fffacd lightblue add8e6 lightcoral f08080 lightcyan e0ffff " +
  "lightgoldenrodyellow fafad2 lightgray d3d3d3 lightgreen 90ee90 lightgrey d3d3d3 lightpink ffb6c1 " +
  "lightsalmon ffa07a lightseagreen 20b2aa lightskyblue 87cefa lightslategray 778899 lightslategrey 778899 " +
  "lightsteelblue b0c4de lightyellow ffffe0 lime 00ff00 limegreen 32cd32 linen faf0e6 magenta ff00ff maroon 800000 " +
  "mediumaquamarine 66cdaa mediumblue 0000cd mediumorchid ba55d3 mediumpurple 9370db mediumseagreen 3cb371 " +
  "mediumslateblue 7b68ee mediumspringgreen 00fa9a mediumturquoise 48d1cc mediumvioletred c71585 " +
  "midnightblue 191970 mintcream f5fffa mistyrose ffe4e1 moccasin ffe4b5 navajowhite ffdead navy 000080 " +
  "oldlace fdf5e6 olive 808000 olivedrab 6b8e23 orange ffa500 orangered ff4500 orchid da70d6 palegoldenrod eee8aa " +
  "palegreen 98fb98 paleturquoise afeeee palevioletred db7093 papayawhip ffefd5 peachpuff ffdab9 peru cd853f " +
  "pink ffc0cb plum dda0dd powderblue b0e0e6 purple 800080 rebeccapurple 663399 red ff0000 rosybrown bc8f8f " +
  "royalblue 4169e1 saddlebrown 8b4513 salmon fa8072 sandybrown f4a460 seagreen 2e8b57 seashell fff5ee " +
  "sienna a0522d silver c0c0c0 skyblue 87ceeb slateblue 6a5acd slategray 708090 slategrey 708090 snow fffafa " +
  "springgreen 00ff7f steelblue 4682b4 tan d2b48c teal 008080 thistle d8bfd8 tomato ff6347 turquoise 40e0d0 " +
  "violet ee82ee wheat f5deb3 white ffffff whitesmoke f5f5f5 yellow ffff00 yellowgreen 9acd32";

let named: Map<string, string> | undefined;
/** The named colors, read once on first use. */
export function namedColors(): ReadonlyMap<string, string> {
  if (!named) {
    named = new Map();
    const parts = NAMES.split(" ");
    for (let i = 0; i < parts.length; i += 2) named.set(parts[i]!, parts[i + 1]!);
  }
  return named;
}

const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(\d*\.?\d+%?)\s*)?\)$/i;

/** A color as Elements takes one; undefined for anything else (a rule then skips what it would have checked). */
export function parseColor(input: unknown): Rgba | undefined {
  if (typeof input !== "string") return undefined;
  const value = input.trim().toLowerCase();
  if (value === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  const name = namedColors().get(value);
  const hex = HEX.exec(name ? `#${name}` : value);
  if (hex) {
    const d = hex[1]!.length <= 4 ? [...hex[1]!].map((c) => c + c).join("") : hex[1]!;
    const at = (i: number) => parseInt(d.slice(i, i + 2), 16);
    return { r: at(0), g: at(2), b: at(4), a: d.length === 8 ? at(6) / 255 : 1 };
  }
  const rgb = RGB.exec(value);
  if (!rgb) return undefined;
  const [r, g, b] = rgb.slice(1, 4).map(Number) as [number, number, number];
  if (r > 255 || g > 255 || b > 255) return undefined;
  let a = 1;
  if (rgb[4] !== undefined) a = rgb[4].endsWith("%") ? Number(rgb[4].slice(0, -1)) / 100 : Number(rgb[4]);
  if (!(a >= 0 && a <= 1)) return undefined;
  return { r, g, b, a };
}

/** `top` over `bottom`, source-over in sRGB. */
export function over(top: Rgba, bottom: Rgba): Rgba {
  const a = top.a + bottom.a * (1 - top.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const mix = (t: number, b: number) => (t * top.a + b * bottom.a * (1 - top.a)) / a;
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a };
}

/** WCAG 2.1's relative luminance of an opaque color. */
export function luminance({ r, g, b }: Rgba): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG 2.1's contrast ratio of two opaque colors, 1 to 21. */
export function contrast(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** A color as #rrggbb, for a message. */
export function hex({ r, g, b }: Rgba): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}
