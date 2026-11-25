/**
 * A link preview, 1200 by 630. The logo, the site and the shapes are locked; a design gives the page's title, fitted
 * to three lines, and the part of the site it's in, above it. It's made from a brand (`ogCard(brand)`), which sets its
 * colors, fonts, logo and site.
 */
import { Canvas, Circle, Column, Heading, Image, Row, Svg, Text, prop, token } from "@hyper-elements/react";
import { template } from "@hyper-elements/react/template";
import type { Brand } from "../../_brand";
import { brand } from "../../_brands/orbit";

/** What fits at the smallest size, 32px, on three lines in the narrowest sample brand. */
const TITLE_MAX = 100;

const fields = {
  title: prop.text({
    label: "Title",
    required: true,
    maxLength: TITLE_MAX,
    guidance: `The page's title, as its readers see it: up to ${TITLE_MAX} characters, fitted to three lines`,
  }),
  eyebrow: prop.choice(["Blog", "Docs", "Changelog", "News"], { label: "Part of the site", guidance: "Where the page is, shown above the title" }),
};

export function ogCard(brand: Brand) {
  return template({
    id: "images.OgCard",
    version: "1.0.0",
    label: "Open Graph card",
    description: "A link preview, 1200 by 630: the title fitted to three lines, the brand's logo and site, and shapes in its colors",
    root: "Canvas",
    fields,
    rules: {
      require: { core: ["canvas/overflow", "image/overflow", "image/glyph", "image/fit"] },
      links: { domains: [...brand.links.domains] },
    },
    example: { title: "Exports that finish in seconds" },
    render: (v) => (
      <Canvas width={1200} height={630} fonts={brand.fonts} lang={brand.lang ?? "en"} dir={brand.dir} theme={brand.theme}>
        <Row style={{ height: 630, gap: 40 }}>
          <Column style={{ width: 820, height: 630, padding: [64, 0, 64, 72], justifyContent: "space-between" }}>
            <Image src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }} alt={brand.logo.alt} style={{ width: 200 }} />
            <Column style={{ gap: 16 }}>
              {v.eyebrow && (
                <Text
                  field="eyebrow"
                  style={{ color: token("colors.primary"), fontSize: 24, fontWeight: 700, lineHeight: 1.2, letterSpacing: 2, textTransform: "uppercase" }}
                >
                  {v.eyebrow}
                </Text>
              )}
              <Heading field="title" level={1} fit={{ sizes: { min: 32, max: 68, step: 4 }, maxLines: 3 }} style={{ lineHeight: 1.08 }}>
                {v.title}
              </Heading>
            </Column>
            <Text style={{ fontSize: 26, color: token("colors.muted") }}>{new URL(brand.links.site).host}</Text>
          </Column>
          <Svg width={340} height={630} viewBox="0 0 340 630">
            <Circle cx={250} cy={120} r={150} style={{ fill: token("colors.primary") }} />
            <Circle cx={120} cy={420} r={90} style={{ fill: token("colors.accent") }} />
            <Circle cx={300} cy={560} r={120} style={{ fill: token("colors.surface") }} />
          </Svg>
        </Row>
      </Canvas>
    ),
  });
}

export default ogCard(brand);
