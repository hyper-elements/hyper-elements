// The pictures of the templates examples' launch graphic, drawn from SVG with resvg: the template's logo, and what a
// launch gives it (the artwork, the product screenshot, and the banner the template refuses). They're committed; run
// this to draw them again.
//
//   node apps/website/scripts/templates-guide-art.mjs
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const site = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repo = resolve(site, "../..");
const art = join(site, "examples/templates-guide/designs/art");
const { Resvg } = createRequire(join(repo, "packages/react/package.json"))("@resvg/resvg-js");
const fonts = ["Inter-Regular.ttf", "Inter-Bold.ttf"].map((font) => join(repo, "benchmark/suites/image/fonts", font));

const draw = (svg, to) => {
  const png = new Resvg(svg, { font: { fontFiles: fonts, loadSystemFonts: false, defaultFontFamily: "Inter" } }).render().asPng();
  writeFileSync(join(art, to), png);
  console.log(`${to}: ${Math.round(png.length / 1024)} kB`);
};

// ── The logo: Orbit's ring and name, in ink, for the template's own assets ──
draw(
  `<svg xmlns="http://www.w3.org/2000/svg" width="252" height="128" viewBox="0 0 252 128" font-family="Inter">
  <circle cx="44" cy="64" r="27" fill="none" stroke="#4f46e5" stroke-width="20"/>
  <text x="92" y="88" font-size="70" font-weight="700" letter-spacing="-2" fill="#15132e">orbit</text>
</svg>`,
  "../../templates/assets/orbit-logo.png"
);

// ── The artwork: bold flat shapes on a grid, in the brand's colors ──
// Flat colors on purpose: a picture of flat shapes is a small file, and so is every image drawn over it.
// MIST is its light color: not the paper the template draws on, so the picture keeps its edge there.
const [INDIGO, TEAL, CORAL, SUN, PINK, NIGHT, MIST] = ["#4f46e5", "#2dd4bf", "#ff6b57", "#ffc93c", "#f9a8d4", "#15132e", "#dfe3ff"];
const T = 200;
/** One tile's shape, drawn in a 200px square from its top left corner. */
const SHAPES = {
  quarter: (c, turn) => `<path d="M0 0 H${T} A${T} ${T} 0 0 1 0 ${T} Z" fill="${c}" transform="rotate(${turn * 90} 100 100)"/>`,
  half: (c, turn) => `<path d="M0 0 H${T} A100 100 0 0 1 0 0 Z" fill="${c}" transform="rotate(${turn * 90} 100 100)"/>`,
  dot: (c) => `<circle cx="100" cy="100" r="62" fill="${c}"/>`,
  ring: (c) => `<circle cx="100" cy="100" r="66" fill="none" stroke="${c}" stroke-width="30"/>`,
  orbit: (c) => `<circle cx="100" cy="100" r="78" fill="none" stroke="${c}" stroke-width="12"/><circle cx="100" cy="100" r="34" fill="${c}"/>`,
  leaf: (c, turn) => `<path d="M0 0 A${T} ${T} 0 0 1 ${T} ${T} A${T} ${T} 0 0 1 0 0 Z" fill="${c}" transform="rotate(${turn * 90} 100 100)"/>`,
  pill: (c, turn) => `<rect x="20" y="62" width="160" height="76" rx="38" fill="${c}" transform="rotate(${turn * 90} 100 100)"/>`,
  plain: () => "",
};
// Each tile: its ground, its shape, the shape's color and its quarter turns. Eight across, six down.
const TILES = [
  [INDIGO, "quarter", SUN, 0], [MIST, "dot", CORAL, 0], [TEAL, "half", NIGHT, 2], [SUN, "ring", INDIGO, 0], [NIGHT, "quarter", PINK, 1], [CORAL, "leaf", MIST, 0], [MIST, "pill", INDIGO, 1], [TEAL, "quarter", SUN, 3],
  [PINK, "half", INDIGO, 1], [NIGHT, "orbit", TEAL, 0], [SUN, "quarter", CORAL, 2], [INDIGO, "leaf", PINK, 1], [MIST, "half", TEAL, 0], [SUN, "dot", NIGHT, 0], [INDIGO, "quarter", TEAL, 2], [CORAL, "ring", MIST, 0],
  [TEAL, "leaf", MIST, 1], [CORAL, "quarter", NIGHT, 3], [MIST, "ring", INDIGO, 0], [TEAL, "dot", SUN, 0], [CORAL, "half", MIST, 3], [INDIGO, "orbit", SUN, 0], [PINK, "quarter", NIGHT, 0], [NIGHT, "half", SUN, 2],
  [SUN, "pill", NIGHT, 0], [INDIGO, "half", TEAL, 0], [PINK, "quarter", CORAL, 1], [NIGHT, "leaf", SUN, 0], [SUN, "quarter", INDIGO, 3], [MIST, "quarter", CORAL, 1], [TEAL, "ring", NIGHT, 0], [INDIGO, "dot", PINK, 0],
  [NIGHT, "quarter", TEAL, 2], [MIST, "leaf", CORAL, 1], [INDIGO, "ring", MIST, 0], [CORAL, "dot", SUN, 0], [TEAL, "quarter", INDIGO, 0], [PINK, "half", NIGHT, 2], [SUN, "leaf", TEAL, 0], [MIST, "quarter", INDIGO, 2],
  [CORAL, "half", SUN, 0], [TEAL, "quarter", MIST, 1], [SUN, "orbit", NIGHT, 0], [PINK, "pill", INDIGO, 1], [NIGHT, "dot", CORAL, 0], [INDIGO, "quarter", MIST, 3], [CORAL, "quarter", TEAL, 0], [SUN, "half", PINK, 1],
];
draw(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200">
  ${TILES.map(([ground, shape, color, turn], i) => `<g transform="translate(${(i % 8) * T} ${Math.floor(i / 8) * T})"><rect width="${T}" height="${T}" fill="${ground}"/>${SHAPES[shape](color, turn)}</g>`).join("\n  ")}
</svg>`,
  "shapes.png"
);

// ── The product: Orbit's release page, as a screenshot of it would show ──
const INK = "#0b1020";
const text = (x, y, value, size, { weight = 400, fill = INK, anchor = "start" } = {}) => `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${value}</text>`;
const chip = (x, y, value, [fill, ink]) => `<rect x="${x}" y="${y}" width="${Math.round(value.length * 13.2) + 36}" height="44" rx="22" fill="${fill}"/>${text(x + 18, y + 30, value, 24, { weight: 700, fill: ink })}`;
const lines = (x, y, widths, color = "#d9deeb") => widths.map((width, i) => `<rect x="${x}" y="${y + i * 30}" width="${width}" height="12" rx="6" fill="${color}"/>`).join("");
const card = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="26" fill="#ffffff" stroke="#e4e8f3" stroke-width="2"/>`;
const NEW = ["#ede9fe", "#6d28d9"];
const BETTER = ["#ccfbf1", "#0f766e"];
const FIXED = ["#fef3c7", "#b45309"];
const product = `
  <rect width="1600" height="1000" fill="#f3f5fb"/>
  <rect width="300" height="1000" fill="#0d1229"/>
  <circle cx="64" cy="76" r="17" fill="none" stroke="#6366f1" stroke-width="12"/>
  ${text(96, 88, "orbit", 36, { weight: 700, fill: "#ffffff" })}
  <rect x="24" y="150" width="252" height="64" rx="16" fill="#1d2550"/>
  ${["Releases", "Drafts", "Voice", "Integrations", "Settings"].map((name, i) => `<circle cx="58" cy="${182 + i * 78}" r="9" fill="${i ? "#3b4470" : "#2dd4bf"}"/>${text(86, 192 + i * 78, name, 28, { weight: i ? 400 : 700, fill: i ? "#8f98bd" : "#ffffff" })}`).join("")}
  ${text(352, 120, "Orbit 3.0", 64, { weight: 700 })}
  ${chip(672, 74, "Ready to publish", BETTER)}
  <rect x="1330" y="64" width="222" height="68" rx="18" fill="#4f46e5"/>
  ${text(1441, 108, "Publish", 30, { weight: 700, fill: "#ffffff", anchor: "middle" })}
  ${card(352, 180, 384, 330)}
  ${chip(384, 212, "New", NEW)}
  ${text(384, 312, "Notes in", 40, { weight: 700 })}${text(384, 362, "your voice", 40, { weight: 700 })}
  ${lines(384, 404, [300, 250, 180])}
  ${card(768, 180, 384, 330)}
  ${chip(800, 212, "Improved", BETTER)}
  ${text(800, 312, "Exports, twice", 40, { weight: 700 })}${text(800, 362, "as fast", 40, { weight: 700 })}
  ${[70, 110, 54, 132, 92, 150].map((height, i) => `<rect x="${800 + i * 54}" y="${476 - height * 0.6}" width="36" height="${height * 0.6}" rx="8" fill="${i === 5 ? "#2dd4bf" : "#c7d2fe"}"/>`).join("")}
  ${card(1184, 180, 368, 330)}
  ${chip(1216, 212, "Fixed", FIXED)}
  ${text(1216, 312, "Slack and", 40, { weight: 700 })}${text(1216, 362, "email", 40, { weight: 700 })}
  ${lines(1216, 404, [280, 220, 250])}
  ${card(352, 542, 800, 410)}
  ${text(384, 606, "What's new", 34, { weight: 700 })}
  <rect x="384" y="640" width="736" height="72" rx="14" fill="#eef2ff"/>
  <rect x="384" y="640" width="8" height="72" rx="4" fill="#4f46e5"/>
  ${lines(412, 662, [620, 480], "#a5b4fc")}
  ${lines(384, 744, [700, 736, 560, 660, 420, 610])}
  ${card(1184, 542, 368, 410)}
  ${text(1216, 606, "Voice", 34, { weight: 700 })}
  ${["Friendly", "Brief", "Technical"].map((name, i) => `${text(1216, 672 + i * 92, name, 26, { fill: "#5b6478" })}<rect x="1216" y="${692 + i * 92}" width="304" height="12" rx="6" fill="#e4e8f3"/><rect x="1216" y="${692 + i * 92}" width="${[230, 150, 80][i]}" height="12" rx="6" fill="#4f46e5"/><circle cx="${1216 + [230, 150, 80][i]}" cy="${698 + i * 92}" r="15" fill="#ffffff" stroke="#4f46e5" stroke-width="5"/>`).join("")}`;
draw(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000" font-family="Inter">${product}</svg>`, "screenshot.png");
// The banner: a strip of the same page, four times as wide as it's tall. The template takes 2:1 or narrower.
draw(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="400" viewBox="0 150 1600 400" font-family="Inter">${product}</svg>`, "banner.png");
