// Orbit's launch graphic, written by Orbit's maintainers: a Canvas in two formats (square, 1080×1080; landscape,
// 1200×630), its layout and brand fixed, a launch's copy and pictures its fields. The headline is fitted (the largest of
// its sizes that fits its region in 3 lines), the screenshot contained whole in the art region over the artwork, which
// covers it. A launch that can't keep the brand is refused: copy that doesn't fit, a glyph no font has, a missing font,
// a screenshot of another shape.
import { Canvas, Column, Heading, Image, Layer, Row, Text, prop } from "@hyper-elements/react";
import { field, fitInside, formatDate, template } from "@hyper-elements/react/template";

const FORMATS = {
  square: { width: 1080, height: 1080, padding: 72, headline: { width: 936, height: 264, sizes: [72, 64, 56, 48] }, features: { size: 30, gap: 8, height: 133 }, date: { size: 28, height: 36 }, art: { width: 936, height: 343 } },
  landscape: { width: 1200, height: 630, padding: 56, headline: { width: 548, height: 186, sizes: [56, 48, 40] }, features: { size: 24, gap: 6, height: 106 }, date: { size: 24, height: 30 }, art: { width: 504, height: 518 } },
} as const;

export default template({
  id: "orbit.LaunchGraphic",
  version: "1.0.0",
  label: "Orbit launch graphic",
  guidance: "For product launches: sentence case, no emoji, no exclamation marks.",
  root: "Canvas",
  formats: { square: { width: 1080, height: 1080 }, landscape: { width: 1200, height: 630 } },
  fields: {
    headline: prop.text({ label: "Headline", required: true, maxLength: 90 }),
    features: prop.list(prop.text({ label: "Feature", maxLength: 40 }), { label: "Features", required: true, min: 3, max: 3 }),
    launchDate: prop.date({ label: "Launch date", required: true }),
    locale: prop.choice(["en-US", "de-DE"], { label: "Language", default: "en-US" }),
    screenshot: field.image({ label: "Product screenshot", required: true, fit: "contain", aspect: { min: 1.2, max: 2.0 }, accepts: ["png"] }),
    artwork: field.image({ label: "Artwork", required: true, fit: "cover", accepts: ["png"], guidance: "Abstract light waves in violet and teal. No text, logos or people." }),
  },
  rules: { require: { core: ["image/overflow", "image/glyph", "image/fit"] } },
  example: {
    headline: "Meet Orbit 3.0: release notes that write themselves",
    features: ["Drafts from merged PRs", "Your voice, every release", "Ships to Slack and email"],
    launchDate: "2026-12-03",
    screenshot: { src: "art/shot-launch.png", width: 1200, height: 750 },
    artwork: { src: "art/art-launch.png", width: 1080, height: 680 },
  },
  render(v, { format }) {
    const f = FORMATS[format];
    const shot = fitInside(v.screenshot, { width: f.art.width - 48, height: f.art.height - 48 });
    const words = (
      <Column style={{ gap: 16 }}>
        <Column style={{ width: f.headline.width, height: f.headline.height }}>
          <Heading field="headline" level={1} fit={{ sizes: [...f.headline.sizes], maxLines: 3 }} style={{ color: "#f7f7fb", fontWeight: 700, lineHeight: 1.1 }}>
            {v.headline}
          </Heading>
        </Column>
        <Column style={{ width: f.headline.width, height: f.features.height, gap: f.features.gap }}>
          {v.features.map((feature, i) => (
            <Text key={i} field={`features[${i}]`} style={{ color: "#c7d2fe", fontSize: f.features.size, lineHeight: 1.3 }}>
              {feature}
            </Text>
          ))}
        </Column>
        <Column style={{ width: f.headline.width, height: f.date.height }}>
          <Text field="launchDate" style={{ color: "#2dd4bf", fontSize: f.date.size, fontWeight: 700, lineHeight: 1.25 }}>
            {formatDate(v.launchDate, v.locale, { dateStyle: "long" })}
          </Text>
        </Column>
      </Column>
    );
    const art = (
      <Layer style={{ width: f.art.width, height: f.art.height, alignItems: "center", justifyItems: "center" }}>
        <Image field="artwork" src={v.artwork} alt="" style={{ width: f.art.width, height: f.art.height }} />
        <Image field="screenshot" src={v.screenshot} alt="The product" style={shot} />
      </Layer>
    );
    const logo = <Image src={{ src: "assets/orbit-logo-white.png", width: 252, height: 128 }} alt="Orbit" style={{ width: 126, height: 64 }} />;
    return (
      <Canvas width={f.width} height={f.height} lang={v.locale} style={{ backgroundColor: "#0b1020", fontFamily: "Inter", padding: f.padding }}>
        {format === "square" ? (
          <Column style={{ gap: 0 }}>
            {logo}
            <Column style={{ height: 32 }} />
            {words}
            <Column style={{ height: 32 }} />
            {art}
          </Column>
        ) : (
          <Row style={{ gap: 36 }}>
            <Column style={{ width: 548 }}>
              {logo}
              <Column style={{ height: 24 }} />
              {words}
            </Column>
            {art}
          </Row>
        )}
      </Canvas>
    );
  },
});
