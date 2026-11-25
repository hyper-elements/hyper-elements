/**
 * Docs: an Open Graph image for documentation, a changelog or a developer blog, 1200 × 630. Graph paper, the page's
 * path in a monospace face, the headline, and corner marks in your color.
 *
 * A Hyper Elements template: https://hyperelements.dev/tools/open-graph-image-generator
 */
import { Canvas, Column, Heading, Image, Layer, Line, Path, Rect, Row, Svg, Text, prop } from "@hyper-elements/react";
import { field, fitInside, template } from "@hyper-elements/react/template";

const FONTS = "https://hyperelements.dev/tools/og-image/fonts";
const [PAPER, INK, MUTED, GRID] = ["#fbfbfa", "#111827", "#6b7280", "#e8e8e4"];
const MONO = "JetBrains Mono";

/** A corner mark: an L, 40px each way, turned to its corner. */
const corner = (x: number, y: number, dx: number, dy: number, color: string) => (
  <Path key={`${x}-${y}`} d={`M${x} ${y + dy * 40} L${x} ${y} L${x + dx * 40} ${y}`} style={{ fill: "transparent", stroke: color, strokeWidth: 4 }} />
);

export default template({
  id: "og.Docs",
  version: "1.0.0",
  label: "Docs",
  description: "Graph paper, the page's path in a monospace face, and corner marks in your color.",
  root: "Canvas",
  fields: {
    headline: prop.text({ label: "Headline", required: true, maxLength: 140 }),
    site: prop.text({ label: "Site name", maxLength: 40, guidance: "A path reads well here: example.com/docs" }),
    author: prop.text({ label: "Author", maxLength: 40 }),
    date: prop.text({ label: "Date", maxLength: 32 }),
    logo: field.image({ label: "Logo", fit: "contain" }),
    accent: prop.color({ label: "Color", default: "#0891b2" }),
  },
  rules: { require: { core: ["image/overflow", "image/glyph", "image/fit"] } },
  example: {
    headline: "Rate limits, retries and idempotency keys: a guide for API clients",
    site: "fieldnotes.dev/docs",
    author: "Maya Okafor",
    date: "Updated Nov 18, 2026",
  },
  render(v) {
    const byline = [v.author, v.date].filter(Boolean).join("  ·  ");
    return (
      <Canvas
        width={1200}
        height={630}
        title={v.headline}
        fonts={[
          { family: "Inter", src: `${FONTS}/Inter-800.ttf`, weight: 800 },
          { family: MONO, src: `${FONTS}/JetBrainsMono-500.ttf`, weight: 500 },
        ]}
        style={{ backgroundColor: PAPER, color: INK, fontFamily: MONO, fontWeight: 500 }}
      >
        <Layer style={{ height: 630 }}>
          <Svg width={1200} height={630}>
            {Array.from({ length: 25 }, (_, i) => (
              <Line key={`x${i}`} x1={i * 50} y1={0} x2={i * 50} y2={630} style={{ stroke: GRID, strokeWidth: 1 }} />
            ))}
            {Array.from({ length: 13 }, (_, i) => (
              <Line key={`y${i}`} x1={0} y1={i * 50 + 15} x2={1200} y2={i * 50 + 15} style={{ stroke: GRID, strokeWidth: 1 }} />
            ))}
            {corner(36, 36, 1, 1, v.accent)}
            {corner(1164, 36, -1, 1, v.accent)}
            {corner(36, 594, 1, -1, v.accent)}
            {corner(1164, 594, -1, -1, v.accent)}
          </Svg>
          <Column style={{ height: 630, padding: [76, 92, 80], justifyContent: "space-between" }}>
            <Row style={{ height: 48, gap: 16, alignItems: "center" }}>
              {v.logo ? <Image field="logo" src={v.logo} alt="" style={fitInside(v.logo, { width: 200, height: 48 })} /> : null}
              {v.site ? (
                <Row style={{ gap: 14, alignItems: "center" }}>
                  <Svg width={14} height={14} style={{ flex: "none" }}>
                    <Rect width={14} height={14} style={{ fill: v.accent }} />
                  </Svg>
                  <Text field="site" style={{ fontSize: 24, color: MUTED }}>{v.site}</Text>
                </Row>
              ) : null}
            </Row>
            <Heading field="headline" level={1} fit={{ sizes: { max: 72, min: 40, step: 4 }, maxLines: 4 }} style={{ maxWidth: 960, fontFamily: "Inter", fontWeight: 800, lineHeight: 1.1, letterSpacing: -1.5 }}>
              {v.headline}
            </Heading>
            <Row style={{ height: 32, alignItems: "center" }}>
              {byline ? <Text style={{ fontSize: 22, color: MUTED }}>{byline}</Text> : null}
            </Row>
          </Column>
        </Layer>
      </Canvas>
    );
  },
});
