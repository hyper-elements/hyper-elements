/**
 * An app store screenshot: the app's own capture, framed in a phone drawn in shapes, under a headline fitted to the
 * room above it. The layout, the phones and the backdrop are locked; a design gives the app's name, the headline, a
 * line under it, the capture, the store size it's for, and whether the backdrop is the brand's color or its paper. The
 * phone sits the same distance from the bottom in every screenshot of a size, so a listing lines up side by side. It's
 * made from a brand (`storeScreenshot(brand)`), which sets its colors and fonts.
 */
import { Canvas, Column, Heading, Image, Layer, Path, Rect, Circle, Svg, Text, prop, token } from "@hyper-elements/react";
import { field, template } from "@hyper-elements/react/template";
import type { Brand } from "../../_brand";
import { brand } from "../../_brands/orbit";

export const meta = { author: "adityasarade" };

/**
 * The sizes the stores ask for, and how the phone sits in each: its screen's width (the screen keeps a 6.9" iPhone's
 * shape, 1320 by 2868), the headline's sizes, the box above the phone for the words (its width and height), and the
 * margin under the phone. A 6.9" iPhone has the Dynamic Island, a 6.5" one a notch, and Google Play's phone a camera.
 */
const SIZES = {
  iphone69: { width: 1320, height: 2868, phone: "island", screen: 860, headline: [128, 116, 104, 96], lines: 3, subhead: 48, measure: 1100, words: 640, bottom: 150 },
  iphone65: { width: 1284, height: 2778, phone: "notch", screen: 836, headline: [124, 112, 100, 92], lines: 3, subhead: 47, measure: 1070, words: 600, bottom: 144 },
  play: { width: 1080, height: 1920, phone: "camera", screen: 580, headline: [92, 84, 76, 68], lines: 2, subhead: 38, measure: 800, words: 440, bottom: 90 },
} as const;
const SCREEN = 1320 / 2868;

const fields = {
  app: prop.text({ label: "App name", required: true, maxLength: 24, guidance: "As it's listed on the store: Tidewise" }),
  headline: prop.text({
    label: "Headline",
    required: true,
    maxLength: 48,
    guidance: "What the app does for the person, in five to eight words, ending with a full stop. Fitted to three lines, two on Google Play",
  }),
  subhead: prop.text({ label: "Subhead", required: true, maxLength: 72, guidance: "One concrete line of proof under it: a number, a place, a time" }),
  screenshot: field.image({
    label: "Screenshot",
    required: true,
    accepts: ["png", "jpeg"],
    aspect: { min: 0.44, max: 0.48 },
    minWidth: 1080,
    fit: "cover",
    maxCrop: 0.05,
    guidance: "A full-screen capture with its status bar: from an iPhone 16 or 17 Pro Max simulator (1320 by 2868) for the iPhone sizes, from an Android phone for Google Play",
  }),
  size: prop.choice(["iphone69", "iphone65", "play"], {
    label: "Store size",
    default: "iphone69",
    guidance: "App Store Connect's iPhone 6.9\" (1320 by 2868) or 6.5\" (1284 by 2778), or Google Play's phone (1080 by 1920)",
  }),
  backdrop: prop.choice(["brand", "paper"], {
    label: "Backdrop",
    default: "brand",
    guidance: "The brand's color or its paper. Alternate them along a listing, so each screenshot reads as its own card",
  }),
  pattern: prop.choice(["contours", "none"], { label: "Pattern", default: "contours", guidance: "Contour lines behind the phone, or the color alone" }),
};

/** A color's relative luminance, for choosing which of two colors is the darker. */
function luminance(color: string) {
  const hex = color.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return 0.5;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contour lines across the lower part of the image, each a Path through two sine waves, fading toward the bottom. */
function Contours({ width, height, color }: { width: number; height: number; color: string }) {
  const u = width / 1320;
  const top = height * 0.43;
  const spacing = 118 * u;
  const count = Math.ceil((height - top) / spacing) + 1;
  const line = (i: number) =>
    `M${Array.from({ length: 23 }, (_, j) => {
      const x = j * 60;
      const y = 46 * Math.sin(x / 230 + i * 0.7) + 22 * Math.sin(x / 97 + i * 1.9);
      return `${(x * u).toFixed(1)},${(top + i * spacing + y * u).toFixed(1)}`;
    }).join(" L")}`;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {Array.from({ length: count }, (_, i) => (
        // Every fourth line is heavier, as index contours are on a chart.
        <Path key={i} d={line(i)} style={{ fill: "transparent", stroke: color, strokeWidth: (i % 4 === 0 ? 3 : 1.6) * u, opacity: Math.max(0.06, 0.2 - i * 0.008) }} />
      ))}
    </Svg>
  );
}

export function storeScreenshot(brand: Brand) {
  const colors = brand.theme.colors as Record<string, string>;
  // The phone's glass: the darker of the brand's ink and paper, so the island reads as glass in a dark brand too.
  const glass = luminance(colors.foreground!) < luminance(colors.background!) ? colors.foreground! : colors.background!;
  return template({
    id: "images.StoreScreenshot",
    version: "1.0.0",
    label: "App store screenshot",
    description: "An app store screenshot: the app's capture in a phone drawn in shapes, under a headline fitted to the room above it, at the sizes App Store Connect and Google Play ask for",
    root: "Canvas",
    fields,
    rules: {
      require: { core: ["canvas/overflow", "image/overflow", "image/glyph", "image/fit"] },
      links: { domains: [...brand.links.domains] },
    },
    example: {
      app: brand.name,
      headline: "Everything you need, in your pocket.",
      subhead: "The whole account on your phone, ready when you are.",
      screenshot: { src: "https://hyperelements.dev/generated/gallery/assets/images/store-screenshot/today.png", width: 1320, height: 2868 },
      size: "iphone69",
      backdrop: "brand",
      pattern: "contours",
    },
    render: (v) => {
      const s = SIZES[v.size];
      const u = s.width / 1320;
      const onBrand = v.backdrop === "brand";
      const [background, ink, quiet] = onBrand
        ? [token("colors.primary"), token("colors.primaryForeground"), token("colors.primaryForeground")]
        : [token("colors.background"), token("colors.foreground"), token("colors.muted")];
      const lines = onBrand ? colors.primaryForeground! : colors.foreground!;
      // The phone: its body and glass, then the screen, with the capture filling it and the island, notch or camera over it.
      const screenW = s.screen;
      const screenH = Math.round(screenW / SCREEN);
      const k = screenW / 860;
      const android = s.phone === "camera";
      const [outer, inner, screen] = android ? [92 * k, 86 * k, 70 * k] : [136 * k, 129 * k, 114 * k];
      const notchW = Math.round(screenW * 0.5);
      const notchH = Math.round(screenH * 0.034);
      const [ear, round] = [10 * k, 26 * k];
      const notch = `M0 0 H${notchW} C${notchW - ear * 0.5} 0 ${notchW - ear} ${ear * 0.4} ${notchW - ear} ${ear} V${notchH - round} Q${notchW - ear} ${notchH} ${notchW - ear - round} ${notchH} H${ear + round} Q${ear} ${notchH} ${ear} ${notchH - round} V${ear} C${ear} ${ear * 0.4} ${ear * 0.5} 0 0 0 Z`;
      return (
        <Canvas
          width={s.width}
          height={s.height}
          title={`${v.app}: ${v.headline}`}
          fonts={brand.fonts}
          lang={brand.lang ?? "en"}
          dir={brand.dir}
          theme={brand.theme}
          style={{ backgroundColor: background, color: ink }}
        >
          <Layer style={{ width: s.width, height: s.height }}>
            {v.pattern === "contours" ? <Contours width={s.width} height={s.height} color={lines} /> : <Column style={{ width: s.width, height: s.height }} />}
            <Column style={{ width: s.width, height: s.height, padding: [0, 110 * u, s.bottom * u], alignItems: "center", justifyContent: "end" }}>
              {/* The words, centered in a box of their own: a longer headline is drawn smaller, never over the phone. */}
              <Column style={{ width: s.measure, height: s.words, gap: (android ? 26 : 38) * u, alignItems: "center", justifyContent: "center" }}>
                <Text field="app" fit={{ maxLines: 1 }} style={{ fontSize: 30 * u, fontWeight: 700, letterSpacing: 6 * u, textTransform: "uppercase", textAlign: "center", color: quiet }}>
                  {v.app}
                </Text>
                <Heading field="headline" level={1} fit={{ sizes: [...s.headline], maxLines: s.lines }} style={{ lineHeight: 1.04, letterSpacing: -2 * u, textAlign: "center", color: ink }}>
                  {v.headline}
                </Heading>
                <Column style={{ width: 800 * u }}>
                  <Text field="subhead" fit={{ sizes: [s.subhead, s.subhead - 4], maxLines: 2 }} style={{ lineHeight: 1.35, textAlign: "center", color: quiet }}>
                    {v.subhead}
                  </Text>
                </Column>
              </Column>
              <Column style={{ height: (android ? 56 : 88) * u }} />
              <Column style={{ width: screenW + 44 * k, backgroundColor: glass, borderRadius: outer, padding: 7 * k, border: { width: 2 * k, style: "solid", color: token("colors.border") } }}>
                <Column style={{ width: screenW + 26 * k, backgroundColor: glass, borderRadius: inner, padding: 13 * k }}>
                  <Layer style={{ width: screenW, height: screenH, borderRadius: screen, justifyItems: "center", alignItems: "start" }}>
                    <Image field="screenshot" src={v.screenshot} alt={`${v.app}: ${v.headline}`} />
                    <Column style={{ padding: [s.phone === "notch" ? 0 : (android ? 30 : 22) * k, 0, 0, 0] }}>
                      {s.phone === "notch" ? (
                        <Svg width={notchW} height={notchH} viewBox={`0 0 ${notchW} ${notchH}`} title="The notch">
                          <Path d={notch} style={{ fill: glass }} />
                        </Svg>
                      ) : android ? (
                        <Svg width={44 * k} height={44 * k} viewBox="0 0 44 44" title="The front camera">
                          <Circle cx={22} cy={22} r={22} style={{ fill: glass }} />
                        </Svg>
                      ) : (
                        <Svg width={254 * k} height={74 * k} viewBox="0 0 254 74" title="The Dynamic Island">
                          <Rect x={0} y={0} width={254} height={74} rx={37} style={{ fill: glass }} />
                        </Svg>
                      )}
                    </Column>
                  </Layer>
                </Column>
              </Column>
            </Column>
          </Layer>
        </Canvas>
      );
    },
  });
}

export default storeScreenshot(brand);
