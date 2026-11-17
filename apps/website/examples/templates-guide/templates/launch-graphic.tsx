// templates/launch-graphic.tsx
import { Canvas, Circle, Column, Heading, Image, Layer, Path, Rect, Row, Svg, Text, prop } from "@hyper-elements/react";
import { field, fitInside, formatDate, template } from "@hyper-elements/react/template";

// The brand's fonts and colors.
const FONTS = [
  { family: "Inter", src: "../fonts/Inter-Regular.ttf", weight: 400 },
  { family: "Inter", src: "../fonts/Inter-Bold.ttf", weight: 700 },
];
const [INK, PAPER, INDIGO, TEAL] = ["#15132e", "#f6f2ea", "#4f46e5", "#2dd4bf"];

// Each format's layout. It's the template's: no value changes it.
const LAYOUT = {
  square: { width: 1080, height: 1080, words: 952, headline: [72, 64, 56], text: 30, art: { width: 952, height: 420 }, shot: { width: 512, height: 320 } },
  landscape: { width: 1200, height: 630, words: 504, headline: [52, 46, 40], text: 23, art: { width: 552, height: 566 }, shot: { width: 456, height: 285 } },
} as const;

export default template({
  id: "acme.LaunchGraphic",
  version: "1.0.0",
  label: "Product launch graphic",
  guidance: "For product launches only. Sentence case, no emoji, no exclamation marks.",
  root: "Canvas",
  formats: { square: { width: 1080, height: 1080 }, landscape: { width: 1200, height: 630 } },
  fields: {
    headline: prop.text({ label: "Headline", required: true, maxLength: 90 }),
    features: prop.list(prop.text({ label: "Feature", maxLength: 40 }), { label: "Features", required: true, min: 3, max: 3 }),
    launchDate: prop.date({ label: "Launch date", required: true }),
    locale: prop.choice(["en-US", "de-DE"], { label: "Language", default: "en-US" }),
    screenshot: field.image({ label: "Product screenshot", required: true, fit: "contain", aspect: { min: 1.2, max: 2 }, minWidth: 1000, accepts: ["png"] }),
    artwork: field.image({ label: "Artwork", required: true, fit: "cover", maxCrop: 0.6, accepts: ["png"], guidance: "Bold flat shapes in the brand's colors. No text, logos or people." }),
  },
  // What only measuring decides has to hold: nothing past the Canvas, a font for every character, a headline that fits.
  rules: { require: { core: ["image/overflow", "image/glyph", "image/fit"] } },
  example: {
    headline: "Meet Orbit 3.0: release notes that write themselves",
    features: ["Drafts from merged PRs", "Your voice, every release", "Ships to Slack and email"],
    launchDate: "2026-12-03",
    screenshot: { src: "../designs/art/screenshot.png", width: 1600, height: 1000 },
    artwork: { src: "../designs/art/shapes.png", width: 1600, height: 1200 },
  },
  render(v, { format }) {
    const f = LAYOUT[format];
    const logo = <Image src={{ src: "./assets/orbit-logo.png", width: 252, height: 128 }} alt="Orbit" style={{ width: 126 }} />;
    const words = (
      <Column style={{ width: f.words, gap: 18 }}>
        {/* The date, written for the language, without its year. */}
        <Row style={{ gap: 10, alignItems: "center" }}>
          <Svg width={14} height={14}>
            <Circle cx={7} cy={7} r={7} style={{ fill: TEAL }} />
          </Svg>
          <Text field="launchDate" style={{ color: INDIGO, fontSize: f.text - 3, fontWeight: 700, lineHeight: 1.2, letterSpacing: 2, textTransform: "uppercase" }}>
            {formatDate(v.launchDate, v.locale, { month: "long", day: "numeric" })}
          </Text>
        </Row>
        {/* The headline is drawn at the largest size that fits it in three lines. What's under it follows it. */}
        <Heading field="headline" level={1} fit={{ sizes: [...f.headline], maxLines: 3 }} style={{ color: INK, lineHeight: 1.06, letterSpacing: -1.5 }}>
          {v.headline}
        </Heading>
        <Column style={{ gap: 8 }}>
          {v.features.map((feature, i) => (
            <Row key={i} style={{ gap: 12, alignItems: "center" }}>
              <Svg width={f.text - 2} height={f.text - 2} viewBox="0 0 24 24">
                <Circle cx={12} cy={12} r={12} style={{ fill: INDIGO }} />
                <Path d="M6.5 12.5 L10.5 16.5 L17.5 8.5" style={{ fill: "transparent", stroke: PAPER, strokeWidth: 2.6 }} />
              </Svg>
              <Text field={`features[${i}]`} style={{ color: "#3d3a57", fontSize: f.text, lineHeight: 1.3 }}>
                {feature}
              </Text>
            </Row>
          ))}
        </Column>
      </Column>
    );
    // The screenshot, shown whole in a window of the template's own, with the window's shadow behind it.
    const shot = fitInside(v.screenshot, f.shot);
    const [width, height] = [shot.width + 4, shot.height + 38];
    const product = (
      <Layer style={{ width: width + 12, height: height + 12, justifyItems: "start" }}>
        <Svg width={width + 12} height={height + 12}>
          <Rect x={12} y={12} width={width} height={height} rx={18} style={{ fill: INK }} />
        </Svg>
        <Column style={{ width, backgroundColor: PAPER, border: `2px solid ${INK}`, borderRadius: 18, overflow: "hidden" }}>
          <Row style={{ padding: [11, 14] }}>
            <Svg width={52} height={12}>
              <Circle cx={6} cy={6} r={6} style={{ fill: "#ff6b57" }} />
              <Circle cx={26} cy={6} r={6} style={{ fill: "#ffc93c" }} />
              <Circle cx={46} cy={6} r={6} style={{ fill: TEAL }} />
            </Svg>
          </Row>
          <Image field="screenshot" src={v.screenshot} alt="The product" style={shot} />
        </Column>
      </Layer>
    );
    // The artwork fills a panel, and the product sits in the middle of it.
    const art = (
      <Layer style={{ ...f.art, borderRadius: 32, alignItems: "center", justifyItems: "center" }}>
        <Image field="artwork" src={v.artwork} alt="" />
        {product}
      </Layer>
    );
    return (
      <Canvas width={f.width} height={f.height} fonts={FONTS} lang={v.locale} style={{ backgroundColor: PAPER, fontFamily: "Inter" }}>
        {format === "square" ? (
          // The logo at the top and the art at the bottom: the space around the words takes up the slack.
          <Column style={{ height: f.height, padding: 64, justifyContent: "space-between" }}>
            {logo}
            {words}
            {art}
          </Column>
        ) : (
          <Row style={{ height: f.height, padding: [32, 32, 32, 64], gap: 48 }}>
            <Column style={{ width: f.words, height: f.art.height, padding: [24, 0], justifyContent: "space-between" }}>
              {logo}
              {words}
            </Column>
            {art}
          </Row>
        )}
      </Canvas>
    );
  },
});
