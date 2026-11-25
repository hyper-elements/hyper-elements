/**
 * Split: an Open Graph image for an article, 1200 × 630. The headline on a panel of your color, in black or white,
 * whichever reads on it, and your photo beside it. Without a photo, rings in a darker shade of your color.
 *
 * A Hyper Elements template: https://hyperelements.dev/tools/open-graph-image-generator
 */
import { Canvas, Circle, Column, Heading, Image, Layer, Row, Svg, Text, prop } from "@hyper-elements/react";
import { field, fitInside, template } from "@hyper-elements/react/template";

const FONTS = "https://hyperelements.dev/tools/og-image/fonts";

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

export default template({
  id: "og.Split",
  version: "1.0.0",
  label: "Split",
  description: "The headline on a panel of your color, and your photo beside it.",
  root: "Canvas",
  fields: {
    headline: prop.text({ label: "Headline", required: true, maxLength: 140 }),
    site: prop.text({ label: "Site name", maxLength: 40 }),
    author: prop.text({ label: "Author", maxLength: 40 }),
    date: prop.text({ label: "Date", maxLength: 32 }),
    photo: field.image({ label: "Photo", fit: "cover" }),
    logo: field.image({ label: "Logo", fit: "contain" }),
    accent: prop.color({ label: "Color", default: "#14532d" }),
  },
  rules: { require: { core: ["image/overflow", "image/glyph", "image/fit"] } },
  example: {
    headline: "A field guide to the hills behind the city, in six short walks",
    site: "Fieldnotes",
    author: "Maya Okafor",
    date: "Nov 18, 2026",
  },
  render(v) {
    const ink = inkOn(v.accent);
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
        style={{ backgroundColor: v.accent, color: ink, fontFamily: "Inter" }}
      >
        <Row style={{ height: 630 }}>
          <Column style={{ height: 630, padding: [60, 56, 64, 72], justifyContent: "space-between" }}>
            <Row style={{ height: 56, alignItems: "center" }}>
              {v.logo ? (
                <Image field="logo" src={v.logo} alt={v.site ?? ""} style={fitInside(v.logo, { width: 240, height: 56 })} />
              ) : v.site ? (
                <Text field="site" style={{ fontSize: 26, fontWeight: 600 }}>{v.site}</Text>
              ) : null}
            </Row>
            <Heading field="headline" level={1} fit={{ sizes: { max: 64, min: 36, step: 4 }, maxLines: 5 }} style={{ fontWeight: 800, lineHeight: 1.1, letterSpacing: -1 }}>
              {v.headline}
            </Heading>
            <Row style={{ height: 34, alignItems: "center" }}>
              {byline ? <Text style={{ fontSize: 24, color: ink === "#ffffff" ? "rgba(255, 255, 255, 0.8)" : "rgba(17, 17, 17, 0.72)" }}>{byline}</Text> : null}
            </Row>
          </Column>
          {v.photo ? (
            <Layer style={{ width: 500, height: 630, flex: "none" }}>
              <Image field="photo" src={v.photo} alt="" />
            </Layer>
          ) : (
            <Svg width={500} height={630} style={{ flex: "none" }}>
              {[300, 240, 180, 120, 60].map((r, i) => (
                <Circle key={r} cx={500} cy={630} r={r * 1.6} style={{ fill: "transparent", stroke: ink, strokeWidth: 2, opacity: 0.12 + i * 0.05 }} />
              ))}
            </Svg>
          )}
        </Row>
      </Canvas>
    );
  },
});
