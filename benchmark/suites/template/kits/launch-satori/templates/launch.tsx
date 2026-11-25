// Orbit's launch graphic for Satori, written by Orbit's maintainers: `render(values, format)` draws a launch's values
// in one of the two formats (square, 1080×1080; landscape, 1200×630) with Satori and resvg, and returns the PNG.
//
// Its inputs (designs/launch.json): { headline, features: [three], launchDate: "YYYY-MM-DD", locale?: "en-US" |
// "de-DE", screenshot: { src, width, height }, artwork: { src, width, height } }, each image a PNG in art/.
import { readFile } from "node:fs/promises";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";

export interface Launch {
  headline: string;
  features: string[];
  launchDate: string;
  locale?: "en-US" | "de-DE";
  screenshot: { src: string; width: number; height: number };
  artwork: { src: string; width: number; height: number };
}

type Box = { left: number; top: number; width: number; height: number };
const FORMATS: Record<"square" | "landscape", { width: number; height: number; logo: Box; headline: Box & { sizes: number[] }; features: Box & { size: number; gap: number }; date: Box & { size: number }; art: Box }> = {
  square: { width: 1080, height: 1080, logo: { left: 72, top: 72, width: 126, height: 64 }, headline: { left: 72, top: 168, width: 936, height: 264, sizes: [72, 64, 56, 48] }, features: { left: 72, top: 448, width: 936, height: 133, size: 30, gap: 8 }, date: { left: 72, top: 597, width: 936, height: 36, size: 28 }, art: { left: 72, top: 665, width: 936, height: 343 } },
  landscape: { width: 1200, height: 630, logo: { left: 56, top: 56, width: 126, height: 64 }, headline: { left: 56, top: 144, width: 548, height: 186, sizes: [56, 48, 40] }, features: { left: 56, top: 346, width: 548, height: 106, size: 24, gap: 6 }, date: { left: 56, top: 468, width: 548, height: 30, size: 24 }, art: { left: 640, top: 56, width: 504, height: 518 } },
};

/** The headline's size, by its length: the more characters, the smaller (Satori can't measure before it draws). */
function headlineSize(text: string, sizes: number[]): number {
  const n = text.length;
  return sizes[n <= 40 ? 0 : n <= 60 ? 1 : n <= 75 ? 2 : sizes.length - 1] ?? sizes[sizes.length - 1];
}

const dataUri = async (src: string) => `data:image/png;base64,${(await readFile(src)).toString("base64")}`;
const at = (b: Box) => ({ position: "absolute" as const, left: b.left, top: b.top, width: b.width, height: b.height });

export async function render(v: Launch, format: "square" | "landscape"): Promise<Uint8Array> {
  const f = FORMATS[format];
  const date = new Intl.DateTimeFormat(v.locale ?? "en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${v.launchDate}T00:00:00Z`));
  // The screenshot contained whole in the art region's inner box; the artwork covering the region.
  const inner = { width: f.art.width - 48, height: f.art.height - 48 };
  const s = Math.min(inner.width / v.screenshot.width, inner.height / v.screenshot.height);
  const shot = { width: v.screenshot.width * s, height: v.screenshot.height * s };
  const c = Math.max(f.art.width / v.artwork.width, f.art.height / v.artwork.height);
  const cover = { width: v.artwork.width * c, height: v.artwork.height * c };
  const svg = await satori(
    <div style={{ width: f.width, height: f.height, display: "flex", position: "relative", backgroundColor: "#0b1020", fontFamily: "Inter" }}>
      <img src={await dataUri("assets/orbit-logo-white.png")} style={{ ...at(f.logo) }} />
      <div style={{ ...at(f.headline), display: "flex", color: "#f7f7fb", fontWeight: 700, fontSize: headlineSize(v.headline, f.headline.sizes), lineHeight: 1.1 }}>{v.headline}</div>
      <div style={{ ...at(f.features), display: "flex", flexDirection: "column", gap: f.features.gap }}>
        {v.features.map((feature) => (
          <div key={feature} style={{ display: "flex", color: "#c7d2fe", fontSize: f.features.size, lineHeight: 1.3 }}>{feature}</div>
        ))}
      </div>
      <div style={{ ...at(f.date), display: "flex", color: "#2dd4bf", fontWeight: 700, fontSize: f.date.size, lineHeight: 1.25 }}>{date}</div>
      <div style={{ ...at(f.art), display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <img src={await dataUri(v.artwork.src)} style={{ position: "absolute", left: (f.art.width - cover.width) / 2, top: (f.art.height - cover.height) / 2, width: cover.width, height: cover.height }} />
        <img src={await dataUri(v.screenshot.src)} style={{ width: shot.width, height: shot.height }} />
      </div>
    </div>,
    {
      width: f.width,
      height: f.height,
      fonts: [
        { name: "Inter", data: await readFile("fonts/Inter-Regular.ttf"), weight: 400, style: "normal" },
        { name: "Inter", data: await readFile("fonts/Inter-Bold.ttf"), weight: 700, style: "normal" },
      ],
    },
  );
  return new Resvg(svg).render().asPng();
}
