// The images on the comparison pages (/compare/…): real output of the site's examples, from
// src/generated/examples.json, drawn in Chromium and written to public/generated/compare/.
//
// The pages show images, not live iframes, so the examples' own headings and copy aren't read as the page's text.
// Run it after `generate` when one of these examples changes:
//
//   pnpm --filter @hyper-elements/website generate:compare
//
// It needs Playwright's Chromium (`npx playwright install chromium`).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const siteRequire = createRequire(join(root, "package.json"));
const clientsDir = dirname(siteRequire.resolve("@hyper-elements/email-clients/package.json"));
const { chromium } = createRequire(join(clientsDir, "package.json"))("playwright");

/** Each image: the example, the width it's drawn at, and its height: its top (`ratio` of the width), a fixed `height` (the
 * email's background fills it, so images side by side match), or else the whole of it. */
const IMAGES = [
  { kind: "templates", slug: "oyen-launch", width: 620, ratio: 0.95 },
  { kind: "templates", slug: "casa-albero-page", width: 900, ratio: 0.95 },
  { kind: "templates", slug: "pell-ashby-invoice", width: 860, ratio: 0.95 },
  { kind: "showcase", slug: "brand-north", width: 620, height: 470 },
  { kind: "showcase", slug: "brand-bloom", width: 620, height: 470 },
];

const examples = JSON.parse(await readFile(join(root, "src", "generated", "examples.json"), "utf8"));
const outDir = join(root, "public", "generated", "compare");
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
try {
  for (const { kind, slug, width, ratio, height: fixed } of IMAGES) {
    const example = examples[kind][slug];
    if (!example) throw new Error(`No example ${kind}/${slug} in src/generated/examples.json: run generate first.`);
    // A short viewport, so the height measured is the example's own, then one as tall as the image.
    const page = await browser.newPage({ viewport: { width, height: 100 }, deviceScaleFactor: 2 });
    // The examples' images are the site's own (https://hyperelements.dev/img/…), served here from public/img.
    await page.route("https://hyperelements.dev/img/**", async (route) => {
      const file = join(root, "public", "img", decodeURIComponent(new URL(route.request().url()).pathname.replace(/^\/img\//, "")));
      await route.fulfill({ body: await readFile(file), contentType: file.endsWith(".png") ? "image/png" : file.endsWith(".svg") ? "image/svg+xml" : "image/jpeg" });
    });
    await page.setContent(example.html, { waitUntil: "networkidle" });
    const full = await page.evaluate(() => document.documentElement.scrollHeight);
    const height = fixed ?? (ratio ? Math.min(full, Math.round(width * ratio)) : full);
    await page.setViewportSize({ width, height });
    const image = await page.screenshot({ type: "jpeg", quality: 82, clip: { x: 0, y: 0, width, height } });
    await writeFile(join(outDir, `${slug}.jpg`), image);
    console.log(`public/generated/compare/${slug}.jpg: ${width}×${height}, ${Math.round(image.length / 1024)} KB`);
    await page.close();
  }
} finally {
  await browser.close();
}
