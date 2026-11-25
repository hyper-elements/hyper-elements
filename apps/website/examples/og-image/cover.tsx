/**
 * Cover: an Open Graph image for an article, 1200 × 630. Your photo across the whole image, darker toward the bottom,
 * and the headline over it in white, with your logo or site name, the author and the date. Without a photo, your
 * color fills it.
 *
 * A Hyper Elements template: https://hyperelements.dev/tools/open-graph-image-generator
 */
import { Canvas, Column, Heading, Image, Layer, Rect, Row, Svg, Text, prop } from "@hyper-elements/react";
import { field, fitInside, template } from "@hyper-elements/react/template";

const FONTS = "https://hyperelements.dev/tools/og-image/fonts";

/** The shade over the photo: 63 bands, each a little darker than the one above it. */
const SHADE = Array.from({ length: 63 }, (_, i) => ({ y: i * 10, opacity: 0.12 + 0.72 * (i / 62) ** 1.7 }));

export default template({
  id: "og.Cover",
  version: "1.0.0",
  label: "Cover",
  description: "Your photo across the whole image, and the headline over it in white.",
  root: "Canvas",
  fields: {
    headline: prop.text({ label: "Headline", required: true, maxLength: 140 }),
    site: prop.text({ label: "Site name", maxLength: 40 }),
    author: prop.text({ label: "Author", maxLength: 40 }),
    date: prop.text({ label: "Date", maxLength: 32 }),
    photo: field.image({ label: "Photo", fit: "cover" }),
    logo: field.image({ label: "Logo", fit: "contain", guidance: "A white or light logo reads best over the photo." }),
    accent: prop.color({ label: "Color", default: "#f59e0b" }),
  },
  rules: { require: { core: ["image/overflow", "image/glyph", "image/fit"] } },
  example: {
    headline: "The slow return of the long weekend, and what it does for the work",
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
        style={{ backgroundColor: v.accent, color: "#ffffff", fontFamily: "Inter" }}
      >
        <Layer style={{ height: 630 }}>
          {v.photo ? <Image field="photo" src={v.photo} alt="" /> : null}
          <Svg width={1200} height={630}>
            {SHADE.map((band) => (
              <Rect key={band.y} x={0} y={band.y} width={1200} height={10} style={{ fill: "#000000", opacity: v.photo ? band.opacity : band.opacity * 0.5 }} />
            ))}
          </Svg>
          <Column style={{ height: 630, padding: [60, 72, 64], justifyContent: "space-between" }}>
            <Row style={{ height: 56, alignItems: "center" }}>
              {v.logo ? (
                <Image field="logo" src={v.logo} alt={v.site ?? ""} style={fitInside(v.logo, { width: 260, height: 56 })} />
              ) : v.site ? (
                <Text field="site" style={{ fontSize: 26, fontWeight: 600, letterSpacing: 3, textTransform: "uppercase" }}>{v.site}</Text>
              ) : null}
            </Row>
            <Column style={{ gap: 22 }}>
              <Svg width={72} height={8}>
                <Rect width={72} height={8} rx={4} style={{ fill: v.accent }} />
              </Svg>
              <Heading field="headline" level={1} fit={{ sizes: { max: 72, min: 40, step: 4 }, maxLines: 3 }} style={{ maxWidth: 1000, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1 }}>
                {v.headline}
              </Heading>
              {byline ? <Text style={{ fontSize: 26, color: "#e5e7eb" }}>{byline}</Text> : null}
            </Column>
          </Column>
        </Layer>
      </Canvas>
    );
  },
});
