/**
 * A launch graphic for social posts, 1080 by 1080. The logo and the layout are locked; a design gives a line above the
 * headline (the date, say), the headline (fitted to three lines), up to four features, the product's screenshot (shown
 * whole in a window) and the artwork behind it, which fills the window's place where there's no screenshot. It's made
 * from a brand (`announcement(brand)`), which sets its colors, fonts and logo.
 */
import { Canvas, Circle, Column, Heading, Image, Layer, Path, Row, Svg, Text, prop, token } from "@hyper-elements/react";
import { field, fitInside, template } from "@hyper-elements/react/template";
import type { Brand } from "../../_brand";
import { brand } from "../../_brands/orbit";

/** What fits at the smallest size in the narrowest sample brand: the headline at 48px on three lines, a feature on one. */
const HEADLINE_MAX = 90;
const FEATURE_MAX = 50;

const fields = {
  eyebrow: prop.text({
    label: "Line above the headline",
    maxLength: 24,
    // With no year, so it reads the same any time.
    pattern: "^(?![\\s\\S]*\\b(19|20)\\d{2}\\b)[\\s\\S]*$",
    guidance: "A few words on one line, with no year or weekday: the launch's month and day (March 12), or Now available",
  }),
  headline: prop.text({ label: "Headline", required: true, maxLength: HEADLINE_MAX, guidance: `What launches, in sentence case: up to ${HEADLINE_MAX} characters, fitted to three lines` }),
  features: prop.list(prop.text({ label: "Feature", required: true, maxLength: FEATURE_MAX }), {
    label: "Features",
    min: 0,
    max: 4,
    guidance: `Up to four short features, one line each: up to ${FEATURE_MAX} characters. With none, there's no list`,
  }),
  screenshot: field.image({
    label: "Product screenshot",
    fit: "contain",
    aspect: { min: 1.2, max: 2 },
    minWidth: 1000,
    accepts: ["png", "jpeg"],
    guidance: "The product itself, shown whole in a window: no text over it. Without one, the artwork fills its place",
  }),
  artwork: field.image({
    label: "Artwork",
    required: true,
    fit: "cover",
    maxCrop: 0.6,
    minWidth: 952,
    minHeight: 420,
    accepts: ["png", "jpeg"],
    guidance: "Bold flat shapes in the brand's colors, behind the window. No text, logos or people.",
  }),
};

/** The check in a circle beside each feature. */
const check = (
  <Svg width={28} height={28} viewBox="0 0 24 24">
    <Circle cx={12} cy={12} r={12} style={{ fill: token("colors.primary") }} />
    <Path d="M6.5 12.5 L10.5 16.5 L17.5 8.5" style={{ fill: "transparent", stroke: token("colors.primaryForeground"), strokeWidth: 2.6 }} />
  </Svg>
);

export function announcement(brand: Brand) {
  return template({
    id: "images.Announcement",
    version: "1.0.0",
    label: "Launch graphic",
    description: "A product launch for social posts: a line above a headline fitted to three lines, up to four features, and the product shown in a window over artwork",
    root: "Canvas",
    fields,
    rules: {
      require: { core: ["canvas/overflow", "image/overflow", "image/glyph", "image/fit"] },
      links: { domains: [...brand.links.domains] },
    },
    example: {
      eyebrow: "January 9",
      headline: "Exports that finish in seconds",
      features: ["Big projects in seconds", "Nothing to change", "Every format you use"],
      screenshot: { src: "https://hyperelements.dev/generated/gallery/assets/images/screenshot.png", width: 1600, height: 1000 },
      artwork: { src: "https://hyperelements.dev/generated/gallery/assets/images/artwork.png", width: 1600, height: 1200 },
    },
    render: (v) => {
      // The screenshot, shown whole inside the window.
      const shot = v.screenshot && fitInside(v.screenshot, { width: 512, height: 320 });
      return (
        <Canvas width={1080} height={1080} fonts={brand.fonts} lang={brand.lang ?? "en"} dir={brand.dir} theme={brand.theme}>
          <Column style={{ height: 1080, padding: 64, gap: 24, justifyContent: "space-between" }}>
            <Image src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }} alt={brand.logo.alt} style={{ width: 180 }} />
            <Column style={{ width: 952, gap: 18 }}>
              {v.eyebrow && (
                <Row style={{ gap: 10, alignItems: "center" }}>
                  <Svg width={14} height={14}>
                    <Circle cx={7} cy={7} r={7} style={{ fill: token("colors.accent") }} />
                  </Svg>
                  <Text
                    field="eyebrow"
                    fit={{ maxLines: 1 }}
                    style={{ color: token("colors.primary"), fontSize: 27, fontWeight: 700, lineHeight: 1.2, letterSpacing: 2, textTransform: "uppercase" }}
                  >
                    {v.eyebrow}
                  </Text>
                </Row>
              )}
              <Heading field="headline" level={1} fit={{ sizes: { min: 48, max: 72, step: 4 }, maxLines: 3 }} style={{ lineHeight: 1.06 }}>
                {v.headline}
              </Heading>
              {v.features.length > 0 && (
                <Column style={{ gap: 8 }}>
                  {v.features.map((feature, i) => (
                    <Row key={i} style={{ gap: 12, alignItems: "center" }}>
                      {check}
                      <Text field={`features[${i}]`} fit={{ maxLines: 1 }} style={{ fontSize: 30, lineHeight: 1.3 }}>
                        {feature}
                      </Text>
                    </Row>
                  ))}
                </Column>
              )}
            </Column>
            <Layer style={{ width: 952, height: 420, borderRadius: token("radii.md"), alignItems: "center", justifyItems: "center" }}>
              <Image field="artwork" src={v.artwork} alt="" />
              {v.screenshot && shot && (
                <Column
                  style={{
                    width: shot.width + 4,
                    backgroundColor: token("colors.surface"),
                    border: { width: 2, style: "solid", color: token("colors.foreground") },
                    borderRadius: token("radii.md"),
                    overflow: "hidden",
                  }}
                >
                  <Row style={{ padding: [11, 14] }}>
                    <Svg width={52} height={12}>
                      <Circle cx={6} cy={6} r={6} style={{ fill: token("colors.primary") }} />
                      <Circle cx={26} cy={6} r={6} style={{ fill: token("colors.accent") }} />
                      <Circle cx={46} cy={6} r={6} style={{ fill: token("colors.border") }} />
                    </Svg>
                  </Row>
                  <Image field="screenshot" src={v.screenshot} alt="The product" style={shot} />
                </Column>
              )}
            </Layer>
          </Column>
        </Canvas>
      );
    },
  });
}

export default announcement(brand);
