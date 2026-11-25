/**
 * Clean: an Open Graph image for an article, 1200 × 630. White, with the headline as large as it fits, your logo
 * or site name above it, the author and the date under it, and a band of your color along the bottom.
 *
 * A Hyper Elements template: https://hyperelements.dev/tools/open-graph-image-generator
 */
import { Canvas, Circle, Column, Heading, Image, Layer, Rect, Row, Svg, Text, prop } from "@hyper-elements/react";
import { field, fitInside, template } from "@hyper-elements/react/template";

const FONTS = "https://hyperelements.dev/tools/og-image/fonts";
const [INK, MUTED] = ["#0f172a", "#475569"];

export default template({
  id: "og.Clean",
  version: "1.0.0",
  label: "Clean",
  description: "White, a large headline, and a band of your color.",
  root: "Canvas",
  fields: {
    headline: prop.text({ label: "Headline", required: true, maxLength: 140 }),
    site: prop.text({ label: "Site name", maxLength: 40 }),
    author: prop.text({ label: "Author", maxLength: 40 }),
    date: prop.text({ label: "Date", maxLength: 32 }),
    logo: field.image({ label: "Logo", fit: "contain" }),
    accent: prop.color({ label: "Color", default: "#4f46e5" }),
  },
  // Nothing past the image, a font for every character, and a headline that fits.
  rules: { require: { core: ["image/overflow", "image/glyph", "image/fit"] } },
  example: {
    headline: "How we cut our image pipeline from forty seconds to four hundred milliseconds",
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
        style={{ backgroundColor: "#ffffff", color: INK, fontFamily: "Inter" }}
      >
        <Layer style={{ height: 630 }}>
          <Svg width={1200} height={630}>
            {/* A grid of dots in the corner, and the band along the bottom. */}
            {Array.from({ length: 30 }, (_, i) => (
              <Circle key={i} cx={1000 + (i % 6) * 26} cy={72 + Math.floor(i / 6) * 26} r={4} style={{ fill: v.accent, opacity: 0.35 }} />
            ))}
            <Rect x={0} y={612} width={1200} height={18} style={{ fill: v.accent }} />
          </Svg>
          <Column style={{ height: 630, padding: [64, 72, 82], justifyContent: "space-between" }}>
            <Row style={{ height: 56, alignItems: "center" }}>
              {v.logo ? (
                <Image field="logo" src={v.logo} alt={v.site ?? ""} style={fitInside(v.logo, { width: 260, height: 56 })} />
              ) : v.site ? (
                <Text field="site" style={{ fontSize: 28, fontWeight: 600, color: v.accent }}>{v.site}</Text>
              ) : null}
            </Row>
            <Heading field="headline" level={1} fit={{ sizes: { max: 80, min: 40, step: 4 }, maxLines: 4 }} style={{ maxWidth: 960, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1.5 }}>
              {v.headline}
            </Heading>
            <Row style={{ height: 36, alignItems: "center" }}>
              {byline ? <Text style={{ fontSize: 26, color: MUTED }}>{byline}</Text> : null}
            </Row>
          </Column>
        </Layer>
      </Canvas>
    );
  },
});
