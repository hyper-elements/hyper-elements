/**
 * Midnight: an Open Graph image for an article, 1200 × 630. Near-black, with a glow of your color in the corner, a
 * grid of fine lines, your site name in a pill of your color, and the headline in white.
 *
 * A Hyper Elements template: https://hyperelements.dev/tools/open-graph-image-generator
 */
import { Canvas, Circle, Column, Heading, Image, Layer, Line, Row, Svg, Text, prop } from "@hyper-elements/react";
import { field, fitInside, template } from "@hyper-elements/react/template";

const FONTS = "https://hyperelements.dev/tools/og-image/fonts";
const NIGHT = "#0a0d1a";

/** Near-black or white, whichever reads better on a color ("#rrggbb"). */
function inkOn(color: string): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(color)?.[1];
  if (!hex) return "#ffffff";
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? "#111111" : "#ffffff";
}

/** The glow: rings of the color, fainter as they widen, around a point past the top right corner. */
const GLOW = Array.from({ length: 24 }, (_, i) => ({ r: 40 + i * 22, opacity: 0.05 }));

export default template({
  id: "og.Midnight",
  version: "1.0.0",
  label: "Midnight",
  description: "Near-black, with a glow of your color and a grid of fine lines.",
  root: "Canvas",
  fields: {
    headline: prop.text({ label: "Headline", required: true, maxLength: 140 }),
    site: prop.text({ label: "Site name", maxLength: 40 }),
    author: prop.text({ label: "Author", maxLength: 40 }),
    date: prop.text({ label: "Date", maxLength: 32 }),
    logo: field.image({ label: "Logo", fit: "contain", guidance: "A white or light logo reads best on it." }),
    accent: prop.color({ label: "Color", default: "#7c5cff" }),
  },
  rules: { require: { core: ["image/overflow", "image/glyph", "image/fit"] } },
  example: {
    headline: "Shipping a design system to forty teams without a single meeting",
    site: "Fieldnotes",
    author: "Maya Okafor",
    date: "Nov 18, 2026",
  },
  render(v) {
    const byline = [v.author, v.date].filter(Boolean).join("  ·  ");
    return (
      <Canvas
        width={1200}
        height={630}
        title={v.headline}
        fonts={[
          { family: "Inter", src: `${FONTS}/Inter-400.ttf`, weight: 400 },
          { family: "Inter", src: `${FONTS}/Inter-600.ttf`, weight: 600 },
          { family: "Inter", src: `${FONTS}/Inter-800.ttf`, weight: 800 },
        ]}
        style={{ backgroundColor: NIGHT, color: "#ffffff", fontFamily: "Inter" }}
      >
        <Layer style={{ height: 630 }}>
          <Svg width={1200} height={630}>
            {Array.from({ length: 19 }, (_, i) => (
              <Line key={`x${i}`} x1={i * 66} y1={0} x2={i * 66} y2={630} style={{ stroke: "#ffffff", strokeWidth: 1, opacity: 0.05 }} />
            ))}
            {Array.from({ length: 10 }, (_, i) => (
              <Line key={`y${i}`} x1={0} y1={i * 66} x2={1200} y2={i * 66} style={{ stroke: "#ffffff", strokeWidth: 1, opacity: 0.05 }} />
            ))}
            {GLOW.map((ring) => (
              <Circle key={ring.r} cx={1110} cy={40} r={ring.r} style={{ fill: v.accent, opacity: ring.opacity }} />
            ))}
            <Circle cx={1110} cy={40} r={14} style={{ fill: v.accent }} />
          </Svg>
          <Column style={{ height: 630, padding: [64, 72, 68], justifyContent: "space-between" }}>
            <Row style={{ height: 56, alignItems: "center" }}>
              {v.logo ? (
                <Image field="logo" src={v.logo} alt={v.site ?? ""} style={fitInside(v.logo, { width: 260, height: 56 })} />
              ) : v.site ? (
                <Text field="site" style={{ flex: "none", fontSize: 22, fontWeight: 600, letterSpacing: 1, padding: [10, 22], borderRadius: 999, backgroundColor: v.accent, color: inkOn(v.accent) }}>
                  {v.site}
                </Text>
              ) : null}
            </Row>
            <Heading field="headline" level={1} fit={{ sizes: { max: 76, min: 40, step: 4 }, maxLines: 4 }} style={{ maxWidth: 980, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1.5 }}>
              {v.headline}
            </Heading>
            <Row style={{ height: 34, alignItems: "center" }}>
              {byline ? <Text style={{ fontSize: 24, color: "#a5acc4" }}>{byline}</Text> : null}
            </Row>
          </Column>
        </Layer>
      </Canvas>
    );
  },
});
