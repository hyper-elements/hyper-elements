// The site's social card: the Open Graph image of every page that hasn't one of its own (scripts/og-cards.mjs draws
// them when the site is built). The page's title and its section are the only fields; the logo, colors, type and
// layout are the template's.
import { Canvas, Column, Heading, Layer, Line, Path, Row, Svg, Text, prop } from "@hyper-elements/react";
import { template } from "@hyper-elements/react/template";

const [WIDTH, HEIGHT] = [1200, 630];
// The site's dark theme (src/styles/global.css) and the logo's coral.
const [BG, TEXT, TEXT_2, TEXT_3, CORAL, LOGO_INK] = ["#0a0a0a", "#ededed", "#a1a1a1", "#6e6e6e", "#ef4638", "#e3e8ed"];
const PAD = 88;

// The logo's two chevrons (public/favicon.svg), the coral one turned half a turn about the mark's center.
const CHEVRON = "M595 388 L623 424 L436 627 L665 913 L522 913 Q492 913 470 891 L262 678 Q240 654 240 627 Q240 600 262 576 L428 410 Q452 388 482 388 Z";
const CHEVRON_TURNED = "M659 864 L631 828 L818 625 L589 339 L732 339 Q762 339 784 361 L992 574 Q1014 598 1014 625 Q1014 652 992 676 L826 842 Q802 864 772 864 Z";
const LOGO_BOX = "232 331 790 590";

const logo = (height: number, opacity = 1) => (
  <Svg width={Math.round((height * 790) / 590)} height={height} viewBox={LOGO_BOX} title="Hyper Elements">
    <Path d={CHEVRON} style={{ fill: LOGO_INK, opacity }} />
    <Path d={CHEVRON_TURNED} style={{ fill: CORAL, opacity }} />
  </Svg>
);

// A faint grid behind the right of the card, as on the site's own social image, fading out toward the title.
const GRID = 48;
const [GRID_FROM, GRID_OPACITY] = [528, 0.05];
const fade = (x: number) => Math.round(GRID_OPACITY * Math.min(1, Math.max(0, (x - GRID_FROM) / 336)) * 1000) / 1000;
const columns = Array.from({ length: Math.floor(WIDTH / GRID) }, (_, i) => (i + 1) * GRID).filter((x) => x > GRID_FROM);
const rows = Array.from({ length: Math.floor(HEIGHT / GRID) }, (_, i) => (i + 1) * GRID);
const grid = (
  <Svg width={WIDTH} height={HEIGHT}>
    {columns.map((x) => (
      <Line key={`x${x}`} x1={x} y1={0} x2={x} y2={HEIGHT} style={{ stroke: "#ffffff", strokeWidth: 1, opacity: fade(x) }} />
    ))}
    {rows.flatMap((y) =>
      columns.map((x) => <Line key={`${x},${y}`} x1={x - GRID} y1={y} x2={x} y2={y} style={{ stroke: "#ffffff", strokeWidth: 1, opacity: fade(x - GRID / 2) }} />),
    )}
  </Svg>
);

export const FONT_FILES = [
  { family: "Inter", file: "Inter-Regular.ttf", weight: 400 },
  { family: "Inter", file: "Inter-Bold.ttf", weight: 700 },
] as const;

export default template({
  id: "hyperelements.PageCard",
  version: "1.0.0",
  label: "Page social card",
  guidance: "The page's own title, in sentence case, as the page shows it.",
  root: "Canvas",
  formats: { og: { width: WIDTH, height: HEIGHT } },
  fields: {
    title: prop.text({ label: "Title", required: true, maxLength: 110 }),
    kicker: prop.text({ label: "Section", required: true, maxLength: 24 }),
  },
  // Nothing past the card, a font for every character, and a title that fits: a page whose title doesn't fails the build.
  rules: { require: { core: ["image/overflow", "image/glyph", "image/fit"] } },
  example: { title: "Generate PDF invoices in Node.js without headless Chrome", kicker: "Blog" },
  render(v) {
    return (
      <Canvas width={WIDTH} height={HEIGHT} title={v.title} lang="en" style={{ backgroundColor: BG, fontFamily: "Inter" }}>
        <Layer style={{ width: WIDTH, height: HEIGHT }}>
          {grid}
          <Column style={{ height: HEIGHT, padding: [72, PAD, 64], justifyContent: "space-between" }}>
            <Row style={{ gap: 18, alignItems: "center" }}>
              {logo(40)}
              <Text style={{ color: TEXT, fontSize: 30, fontWeight: 700, lineHeight: 1.2, letterSpacing: -0.5 }}>Hyper Elements</Text>
            </Row>
            <Column style={{ gap: 22, width: 980 }}>
              <Text field="kicker" style={{ color: CORAL, fontSize: 22, fontWeight: 700, lineHeight: 1.2, letterSpacing: 3, textTransform: "uppercase" }}>
                {v.kicker}
              </Text>
              {/* The largest size that fits the title in three lines. */}
              <Heading field="title" level={1} fit={{ sizes: [80, 72, 64, 56], maxLines: 3 }} style={{ color: "#ffffff", fontWeight: 700, lineHeight: 1.06, letterSpacing: -2 }}>
                {v.title}
              </Heading>
            </Column>
            <Column style={{ gap: 24 }}>
              <Svg width={WIDTH - 2 * PAD} height={2}>
                <Line x1={0} y1={1} x2={WIDTH - 2 * PAD} y2={1} style={{ stroke: "#ffffff", strokeWidth: 2, opacity: 0.22 }} />
              </Svg>
              <Row style={{ alignItems: "center" }}>
                <Text style={{ color: TEXT_3, fontSize: 18, fontWeight: 400, lineHeight: 1.2, letterSpacing: 4, textTransform: "uppercase" }}>Open source</Text>
                <Text style={{ color: TEXT_2, fontSize: 22, fontWeight: 400, lineHeight: 1.2, textAlign: "right" }}>hyperelements.dev</Text>
              </Row>
            </Column>
          </Column>
        </Layer>
      </Canvas>
    );
  },
});
