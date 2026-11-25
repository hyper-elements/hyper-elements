// The Open Graph image generator's files (/tools/open-graph-image-generator), written into public/tools/og-image/:
//
//   fonts/<Family>-<weight>.ttf   each font its designs use, from Google Fonts (SIL Open Font License 1.1), as TTF
//                                 (Satori reads no WOFF2) and only with the characters below: Latin, Latin Extended-A,
//                                 Greek, Cyrillic and the punctuation a headline uses
//   sample.jpg                    the sample photo, a landscape at dusk drawn from SVG here (no one's photo)
//
// They're committed: run it again only to change a font or the sample photo.
//
//   node scripts/og-image-assets.mjs
import { execFileSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public/tools/og-image");
// resvg is packages/internal/core's.
const { Resvg } = createRequire(join(root, "../../packages/internal/core/package.json"))("@resvg/resvg-js");

/** The fonts the designs use: each family at each weight. */
export const FONTS = [
  { family: "Inter", weight: 400 },
  { family: "Inter", weight: 600 },
  { family: "Inter", weight: 800 },
  { family: "Source Serif 4", weight: 600 },
  { family: "JetBrains Mono", weight: 500 },
];

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => String.fromCodePoint(from + i)).join("");
const CHARACTERS =
  range(0x20, 0x7e) + range(0xa0, 0xff) + range(0x100, 0x17f) + range(0x391, 0x3c9) + range(0x400, 0x45f) + "–—‘’‚“”„•…′″‹›€™←↑→↓";

const fileOf = ({ family, weight }) => `${family.replace(/ /g, "")}-${weight}.ttf`;

async function font(face) {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${face.family.replace(/ /g, "+")}:wght@${face.weight}&text=${encodeURIComponent(CHARACTERS)}`)).text();
  const url = css.match(/src:\s*url\(([^)]+)\)\s*format\('truetype'\)/)?.[1];
  if (!url) throw new Error(`Google Fonts gave no TTF for ${face.family} ${face.weight}:\n${css.slice(0, 300)}`);
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  if (bytes[0] !== 0 || bytes[1] !== 1) throw new Error(`${face.family} ${face.weight} isn't a TTF`);
  return bytes;
}

/** Hills at dusk under a low sun, in layers that fade into the haze: 1800 × 1200. */
function samplePhoto() {
  const [w, h] = [1800, 1200];
  const ridge = (base, amp, seed, step = 60) => {
    let d = `M0 ${h} L0 ${base}`;
    for (let x = 0; x <= w; x += step) {
      const y = base - amp * (0.55 * Math.sin((x + seed) / 230) + 0.3 * Math.sin((x + seed * 3) / 97) + 0.15 * Math.sin((x + seed * 7) / 41));
      d += ` L${x} ${y.toFixed(1)}`;
    }
    return `${d} L${w} ${h} Z`;
  };
  const layers = [
    [700, 90, 40, "#f3a77f", 0.55],
    [760, 110, 410, "#d9776a", 0.7],
    [830, 120, 820, "#a8516a", 0.85],
    [920, 130, 1300, "#6d3762", 1],
    [1020, 120, 2100, "#3d2550", 1],
    [1110, 90, 2900, "#1f1734", 1],
  ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2b2c5e"/><stop offset="0.45" stop-color="#b65f7a"/><stop offset="0.7" stop-color="#f6a971"/><stop offset="1" stop-color="#ffd9a0"/>
    </linearGradient>
    <radialGradient id="sun" cx="0.62" cy="0.56" r="0.32">
      <stop offset="0" stop-color="#fff3d6" stop-opacity="1"/><stop offset="0.12" stop-color="#ffe2a8" stop-opacity="0.95"/><stop offset="1" stop-color="#ffb37a" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#sky)"/>
  <rect width="${w}" height="${h}" fill="url(#sun)"/>
  <circle cx="${w * 0.62}" cy="${h * 0.56}" r="62" fill="#fff6e4"/>
  ${layers.map(([base, amp, seed, fill, opacity]) => `<path d="${ridge(base, amp, seed)}" fill="${fill}" opacity="${opacity}"/>`).join("\n  ")}
</svg>`;
  return new Resvg(svg, { font: { loadSystemFonts: false } }).render().asPng();
}

await mkdir(join(out, "fonts"), { recursive: true });
for (const face of FONTS) {
  const bytes = await font(face);
  await writeFile(join(out, "fonts", fileOf(face)), bytes);
  console.log(`fonts/${fileOf(face)} (${Math.round(bytes.length / 1024)} kB)`);
}

// resvg writes PNG; macOS's sips makes the JPEG (a photo is smaller as one).
const png = join(tmpdir(), "og-image-sample.png");
await writeFile(png, samplePhoto());
execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "82", png, "--out", join(out, "sample.jpg")], { stdio: "ignore" });
await rm(png);
console.log("sample.jpg");
