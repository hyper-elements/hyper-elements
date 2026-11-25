/**
 * Journal: an Open Graph image for an article, 1200 × 630. Warm paper, the headline in a serif, your site name in
 * small capitals over a rule of your color, and your photo in a frame. Without a photo the headline takes the width.
 *
 * A Hyper Elements template: https://hyperelements.dev/tools/open-graph-image-generator
 */
import { Canvas, Column, Divider, Heading, Image, Layer, Row, Text, prop } from "@hyper-elements/react";
import { field, fitInside, template } from "@hyper-elements/react/template";

const FONTS = "https://hyperelements.dev/tools/og-image/fonts";
const [PAPER, INK, MUTED] = ["#f6f1e7", "#1c1917", "#57534e"];

export default template({
  id: "og.Journal",
  version: "1.0.0",
  label: "Journal",
  description: "Warm paper, a serif headline, and your photo in a frame.",
  root: "Canvas",
  fields: {
    headline: prop.text({ label: "Headline", required: true, maxLength: 140 }),
    site: prop.text({ label: "Site name", maxLength: 40 }),
    author: prop.text({ label: "Author", maxLength: 40 }),
    date: prop.text({ label: "Date", maxLength: 32 }),
    photo: field.image({ label: "Photo", fit: "cover" }),
    logo: field.image({ label: "Logo", fit: "contain" }),
    accent: prop.color({ label: "Color", default: "#b45309" }),
  },
  rules: { require: { core: ["image/overflow", "image/glyph", "image/fit"] } },
  example: {
    headline: "What the old mapmakers knew about leaving things out",
    site: "Fieldnotes",
    author: "Maya Okafor",
    date: "Nov 18, 2026",
  },
  render(v) {
    const byline = [v.author ? `By ${v.author}` : "", v.date].filter(Boolean).join("  ·  ");
    const words = (
      <Column style={{ height: 502, justifyContent: "space-between" }}>
        <Column style={{ gap: 16 }}>
          <Row style={{ height: 48, alignItems: "center" }}>
            {v.logo ? (
              <Image field="logo" src={v.logo} alt={v.site ?? ""} style={fitInside(v.logo, { width: 220, height: 48 })} />
            ) : v.site ? (
              <Text field="site" style={{ fontSize: 20, fontWeight: 600, letterSpacing: 4, textTransform: "uppercase", color: v.accent }}>{v.site}</Text>
            ) : null}
          </Row>
          <Divider style={{ borderTop: `3px solid ${v.accent}`, width: 96 }} />
        </Column>
        <Heading field="headline" level={1} fit={{ sizes: { max: 68, min: 36, step: 4 }, maxLines: 5 }} style={{ fontFamily: "Source Serif 4", fontWeight: 600, lineHeight: 1.12, letterSpacing: -0.5 }}>
          {v.headline}
        </Heading>
        <Row style={{ height: 32, alignItems: "center" }}>
          {byline ? <Text style={{ fontSize: 23, color: MUTED }}>{byline}</Text> : null}
        </Row>
      </Column>
    );
    return (
      <Canvas
        width={1200}
        height={630}
        title={v.headline}
        fonts={[
          { family: "Inter", src: `${FONTS}/Inter-400.ttf`, weight: 400 },
          { family: "Inter", src: `${FONTS}/Inter-600.ttf`, weight: 600 },
          { family: "Source Serif 4", src: `${FONTS}/SourceSerif4-600.ttf`, weight: 600 },
        ]}
        style={{ backgroundColor: PAPER, color: INK, fontFamily: "Inter", padding: 64 }}
      >
        {v.photo ? (
          <Row style={{ gap: 56, alignItems: "center" }}>
            {words}
            <Column style={{ width: 404, flex: "none", padding: 12, backgroundColor: "#ffffff", border: "1px solid #e7e0d2" }}>
              <Layer style={{ height: 478 }}>
                <Image field="photo" src={v.photo} alt="" />
              </Layer>
            </Column>
          </Row>
        ) : (
          words
        )}
      </Canvas>
    );
  },
});
