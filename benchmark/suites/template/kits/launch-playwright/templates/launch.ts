// Orbit's launch graphic for Playwright, written by Orbit's maintainers: `render(values, format)` fills an HTML and CSS
// page with a launch's values in one of the two formats (square, 1080×1080; landscape, 1200×630), fits the headline
// in the page (the largest of its sizes at which it takes at most 3 lines and stays in its box, once the fonts have
// loaded), and returns Chromium's screenshot.
//
// Its inputs (designs/launch.json): { headline, features: [three], launchDate: "YYYY-MM-DD", locale?: "en-US" |
// "de-DE", screenshot: { src, width, height }, artwork: { src, width, height } }, each image a PNG in art/.
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

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

const esc = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
const box = (b: Box) => `position: absolute; left: ${b.left}px; top: ${b.top}px; width: ${b.width}px; height: ${b.height}px;`;
const dataUri = async (src: string) => `data:image/png;base64,${(await readFile(src)).toString("base64")}`;
const face = async (file: string, weight: number) => `@font-face { font-family: "Inter"; src: url(data:font/ttf;base64,${(await readFile(`fonts/${file}`)).toString("base64")}) format("truetype"); font-weight: ${weight}; }`;

export async function render(v: Launch, format: "square" | "landscape"): Promise<Buffer> {
  const f = FORMATS[format];
  const date = new Intl.DateTimeFormat(v.locale ?? "en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${v.launchDate}T00:00:00Z`));
  const inner = { width: f.art.width - 48, height: f.art.height - 48 };
  const s = Math.min(inner.width / v.screenshot.width, inner.height / v.screenshot.height);
  const c = Math.max(f.art.width / v.artwork.width, f.art.height / v.artwork.height);
  const css = [
    await face("Inter-Regular.ttf", 400),
    await face("Inter-Bold.ttf", 700),
    `* { margin: 0; box-sizing: border-box; } html, body { width: ${f.width}px; height: ${f.height}px; overflow: hidden; background: #0b1020; font-family: "Inter"; }`,
    `#headline { ${box(f.headline)} color: #f7f7fb; font-weight: 700; line-height: 1.1; }`,
    `#features { ${box(f.features)} display: flex; flex-direction: column; gap: ${f.features.gap}px; color: #c7d2fe; font-size: ${f.features.size}px; line-height: 1.3; }`,
    `#date { ${box(f.date)} color: #2dd4bf; font-weight: 700; font-size: ${f.date.size}px; line-height: 1.25; }`,
    `#art { ${box(f.art)} overflow: hidden; display: flex; align-items: center; justify-content: center; }`,
  ].join("\n");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
<img src="${await dataUri("assets/orbit-logo-white.png")}" style="${box(f.logo)}" alt="Orbit">
<div id="headline">${esc(v.headline)}</div>
<div id="features">${v.features.map((feature) => `<div>${esc(feature)}</div>`).join("")}</div>
<div id="date">${esc(date)}</div>
<div id="art"><img src="${await dataUri(v.artwork.src)}" style="position: absolute; left: ${(f.art.width - v.artwork.width * c) / 2}px; top: ${(f.art.height - v.artwork.height * c) / 2}px; width: ${v.artwork.width * c}px; height: ${v.artwork.height * c}px;" alt=""><img src="${await dataUri(v.screenshot.src)}" style="position: relative; width: ${v.screenshot.width * s}px; height: ${v.screenshot.height * s}px;" alt="The product"></div>
</body></html>`;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: f.width, height: f.height } });
    await page.setContent(html);
    await page.evaluate(() => document.fonts.ready);
    // The headline's size: the largest at which it takes at most 3 lines and stays in its box (else the smallest).
    await page.evaluate((sizes) => {
      const el = document.getElementById("headline")!;
      for (const size of sizes) {
        el.style.fontSize = `${size}px`;
        const lines = Math.round(el.scrollHeight / (size * 1.1));
        if (lines <= 3 && el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1) return;
      }
    }, f.headline.sizes);
    return await page.screenshot({ type: "png" });
  } finally {
    await browser.close();
  }
}
