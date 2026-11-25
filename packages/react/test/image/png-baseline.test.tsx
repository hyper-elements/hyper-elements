/**
 * The bytes renderImage() draws for every Canvas the compatibility baseline lists (src/regression/__compat__/, each
 * record whose root is a Canvas), as sha256 hashes in __png__/: what a change to the image entry is held to when it
 * means to draw the same. That baseline records writeCanvas()'s model; this records the PNG drawn from it, and the SVG
 * Satori writes on the way, so a difference says which of the two moved.
 *
 * The Canvases name web fonts, which a test can't fetch: each family a Canvas names is drawn in Liberation Sans (as
 * pdf.js ships it, a pinned dev dependency), at the weights and styles it names, so the bytes depend on nothing outside
 * the lockfile. Rewrite them on purpose with UPDATE_PNG=1 and say why.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Email, Page } from "@hyper-elements/react";
import type { ReactElement } from "react";
import { renderImage, templateAssets, type ImageFont } from "../../src/image";
import { gallery } from "../../src/primitives/examples/gallery";
import { stress } from "../../src/primitives/examples/stress";

const HERE = dirname(fileURLToPath(import.meta.url));
const COMPAT = join(HERE, "../../src/regression/__compat__");
const PNGS = join(HERE, "__png__");
const UPDATE = process.env.UPDATE_PNG === "1";

const STANDARD = join(dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json")), "standard_fonts");
const LIBERATION = {
  regular: readFileSync(join(STANDARD, "LiberationSans-Regular.ttf")),
  bold: readFileSync(join(STANDARD, "LiberationSans-Bold.ttf")),
  italic: readFileSync(join(STANDARD, "LiberationSans-Italic.ttf")),
  boldItalic: readFileSync(join(STANDARD, "LiberationSans-BoldItalic.ttf")),
};

/** The baseline's cases by name, as cross-format-compatibility.test.tsx names them. */
const CASES: Record<string, ReactElement> = Object.fromEntries([
  ...Object.entries(gallery).map(([name, template]) => [`gallery-${name}`, template]),
  ...Object.entries(stress).flatMap(([name, entry]) =>
    entry.roots === "screen"
      ? [
          [`stress-${name}-email`, entry.template(Email)],
          [`stress-${name}-page`, entry.template(Page)],
        ]
      : [[`stress-${name}`, entry.template]]
  ),
]);

/** The names of the Canvases the compatibility baseline records. */
const canvases = readdirSync(COMPAT)
  .filter((file) => file.endsWith(".json"))
  .filter((file) => (JSON.parse(readFileSync(join(COMPAT, file), "utf8")) as { root?: string }).root === "Canvas")
  .map((file) => file.slice(0, -".json".length))
  .sort();

/** Liberation Sans for each family a Canvas names, at each weight (400 and 700 apart) and style it names. */
export function standIns(template: ReactElement): ImageFont[] {
  const fonts: ImageFont[] = [
    { family: "Liberation Sans", src: LIBERATION.regular },
    { family: "Liberation Sans", src: LIBERATION.bold, weight: 700 },
  ];
  for (const face of templateAssets(template).fonts) {
    const [low, high = low] = String(face.weight ?? 400).split(/[\s,]+/).map(Number);
    const italic = face.style === "italic";
    for (const weight of [100, 200, 300, 400, 500, 600, 700, 800, 900].filter((w) => w >= low && w <= high)) {
      const src = weight >= 600 ? (italic ? LIBERATION.boldItalic : LIBERATION.bold) : italic ? LIBERATION.italic : LIBERATION.regular;
      fonts.push({ family: face.family, src, weight, style: italic ? "italic" : "normal" });
    }
  }
  return fonts;
}

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

interface Recorded {
  width: number;
  height: number;
  png: string;
  svg: string;
}

async function draw(template: ReactElement): Promise<Recorded> {
  const fonts = standIns(template);
  const png = await renderImage(template, { fonts });
  const svg = await renderImage(template, { fonts, format: "svg" });
  // Every face the Canvas names has its stand-in, so nothing is drawn in a fallback the fixture doesn't name.
  expect(png.diagnostics.filter((d) => d.code.startsWith("image/font"))).toEqual([]);
  return { width: png.width, height: png.height, png: sha256(png.image), svg: sha256(svg.image) };
}

it("records a PNG for every Canvas the compatibility baseline lists, and no other", () => {
  expect(canvases.length).toBeGreaterThan(0);
  for (const name of canvases) expect(CASES[name], `${name} is in the baseline but not a gallery or stress template`).toBeDefined();
  if (UPDATE) return;
  const recorded = existsSync(PNGS) ? readdirSync(PNGS).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort() : [];
  expect(recorded).toEqual(canvases);
});

describe.each(canvases)("%s", (name) => {
  it("draws the bytes recorded", async () => {
    const drawn = await draw(CASES[name]);
    const file = join(PNGS, `${name}.json`);
    if (UPDATE) {
      mkdirSync(PNGS, { recursive: true });
      writeFileSync(file, `${JSON.stringify(drawn, null, 2)}\n`);
      return;
    }
    const expected = JSON.parse(readFileSync(file, "utf8")) as Recorded;
    expect({ width: drawn.width, height: drawn.height }).toEqual({ width: expected.width, height: expected.height });
    // The SVG first: where it's the same and the PNG isn't, resvg drew it differently, not the layout.
    expect(drawn.svg, "Satori's SVG").toBe(expected.svg);
    expect(drawn.png, "resvg's PNG (the SVG is the same)").toBe(expected.png);
  });

  it("draws the same bytes twice", async () => {
    expect(await draw(CASES[name])).toEqual(await draw(CASES[name]));
  });
});
