// The Open Graph image generator's browser gate. Run after `pnpm --filter @hyper-elements/website build`:
//
//   pnpm --filter @hyper-elements/website check:og-image
//
// It serves dist/ and opens /tools/open-graph-image-generator in Playwright's Chromium, offline: a request to any
// other host is refused, and counted (the site's typeface, which every page loads from Google Fonts, is the only one
// allowed). What it holds the page to:
//
//   1. The built files are there: the page (with its FAQ as structured data), the worker, the fonts, the sample photo
//      and each design's picture; the footer, the sitemap and llms.txt name it.
//   2. Every design draws in the browser, at 1200 × 630.
//   3. A headline no size fits is refused with what to change, and the downloads are off; a shorter one draws again.
//   4. A photo and a logo the visitor picks are drawn, and no request carries them: the page asks only for its own
//      files, and only with GET.
//   5. Both downloads are real files of 1200 × 630: a PNG and a JPEG.
//   6. The page never loads resvg's WebAssembly where the browser makes the files itself.
//   7. At a phone's width, nothing is wider than the screen.
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const site = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = join(site, "dist");
const PATH = "/tools/open-graph-image-generator";
const DESIGNS = JSON.parse(readFileSync(join(site, "src/generated/og-image.json"), "utf8")).map((d) => d.name);
assert(existsSync(join(dist, PATH.slice(1), "index.html")), "Build the site first: pnpm --filter @hyper-elements/website build");

// ─── 1. The built files ────────────────────────────────────────────────────────

const html = readFileSync(join(dist, PATH.slice(1), "index.html"), "utf8");
assert.match(html, /<h1[^>]*>Free Open Graph image generator<\/h1>/, "The page has its heading");
assert.match(html, /"@type":"FAQPage"/, "The page's questions are structured data");
assert.match(html, /<meta property="og:image" content="https:\/\/www\.hyperelements\.dev\/generated\/og-image\/page\.png"/, "The page has its own Open Graph image");
assert(statSync(join(dist, "tools/og-image/runtime.js")).size > 500_000, "The worker is written");
for (const file of ["Inter-400", "Inter-600", "Inter-800", "SourceSerif4-600", "JetBrainsMono-500"]) assert(statSync(join(dist, `tools/og-image/fonts/${file}.ttf`)).size > 20_000, `${file}.ttf is written`);
assert(statSync(join(dist, "tools/og-image/sample.jpg")).size > 20_000, "The sample photo is written");
for (const name of [...DESIGNS, "page"]) assert(statSync(join(dist, `generated/og-image/${name}.png`)).size > 10_000, `${name}.png is written`);
assert.match(readFileSync(join(dist, "index.html"), "utf8"), new RegExp(`<a href="${PATH}">OG Image Generator</a>`), "The footer links the tool");
assert.match(readFileSync(join(dist, "sitemap-0.xml"), "utf8"), new RegExp(`${PATH}</loc>`), "The sitemap has the tool");
assert.match(readFileSync(join(dist, "llms.txt"), "utf8"), new RegExp(`\\[Open Graph image generator\\]\\(https://www\\.hyperelements\\.dev${PATH}\\)`), "llms.txt names the tool");
assert(statSync(join(dist, PATH.slice(1), "index.html")).size < 400_000, "The page is light: the engine is the worker's");

// ─── A server for dist/, which records what's asked of it ──────────────────────

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".wasm": "application/wasm", ".ttf": "font/ttf", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".xml": "application/xml", ".txt": "text/plain" };
const asked = [];
const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  asked.push(`${request.method} ${path}`);
  let file = join(dist, path);
  if (!file.startsWith(dist)) return response.writeHead(403).end();
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) return response.writeHead(404).end();
  response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  response.end(await readFile(file));
});
await new Promise((ready) => server.listen(0, "localhost", ready));
const origin = `http://localhost:${server.address().port}`;

const playwright = createRequire(join(site, "../../packages/react/package.json"))("playwright");
const browser = await playwright.chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const elsewhere = [];
await context.route("**/*", (route) => {
  const url = new URL(route.request().url());
  if (url.origin === origin || url.protocol === "data:" || url.protocol === "blob:") return route.continue();
  elsewhere.push(url.href);
  return route.abort();
});

const errors = [];
const page = await context.newPage();
page.on("pageerror", (error) => errors.push(String(error)));
const status = () => page.locator("#og-stage").getAttribute("data-status");
/** Waits for the next drawing to finish, and returns how it ended. */
async function settled() {
  await page.waitForFunction(() => ["drawn", "failed"].includes(document.querySelector("#og-stage")?.dataset.status ?? ""), null, { timeout: 60_000 });
  return status();
}
const size = () => page.evaluate(() => new Promise((done) => { const img = new Image(); img.onload = () => done([img.naturalWidth, img.naturalHeight]); img.src = document.querySelector("#og-image").src; }));
const problems = () => page.locator("#og-problems li").allInnerTexts();

await page.goto(`${origin}${PATH}`, { waitUntil: "networkidle" });
assert.equal(await settled(), "drawn", "The first design draws when the page opens");

// ─── 2. Every design draws ─────────────────────────────────────────────────────

for (const name of DESIGNS) {
  await page.evaluate(() => (document.querySelector("#og-stage").dataset.status = "waiting"));
  await page.click(`[data-design="${name}"]`);
  assert.equal(await settled(), "drawn", `${name} draws: ${(await problems()).join("; ")}`);
  assert.match(await page.locator("#og-image").getAttribute("src"), /^data:image\/svg\+xml;base64,/, `${name} is shown from the SVG the worker drew`);
  assert.deepEqual(await size(), [1200, 630], `${name} is 1200 × 630`);
  assert.deepEqual(await problems(), [], `${name} has nothing to report`);
}

// ─── 3. A headline that can't fit ──────────────────────────────────────────────

await page.click('[data-design="clean"]');
await settled();
await page.evaluate(() => (document.querySelector("#og-stage").dataset.status = "waiting"));
await page.fill('textarea[name="headline"]', "Pneumonoultramicroscopicsilicovolcanoconiosisandmore is a word too long for any line, at any size");
assert.equal(await settled(), "failed", "A headline no size fits isn't drawn");
assert.match((await problems()).join("\n"), /^Headline doesn't fit: /m, "It says the headline doesn't fit");
assert(await page.locator('[data-download="png"]').isDisabled(), "Nothing can be downloaded");
await page.evaluate(() => (document.querySelector("#og-stage").dataset.status = "waiting"));
await page.fill('textarea[name="headline"]', "Ten ways to make a share image people click");
assert.equal(await settled(), "drawn", "A headline that fits draws again (the control)");
assert(await page.locator('[data-download="png"]').isEnabled(), "And it can be downloaded");

// ─── 4. The visitor's own photo and logo ───────────────────────────────────────

const photo = readFileSync(join(site, "public/img/newsletter-hero.png"));
const logo = readFileSync(join(site, "public/img/orbit-logo.png"));
await page.click('[data-design="split"]');
await settled();
asked.length = 0;
await page.evaluate(() => (document.querySelector("#og-stage").dataset.status = "waiting"));
await page.setInputFiles("#og-photo", { name: "hero.png", mimeType: "image/png", buffer: photo });
assert.equal(await settled(), "drawn", "A photo the visitor picks is drawn");
await page.evaluate(() => (document.querySelector("#og-stage").dataset.status = "waiting"));
await page.setInputFiles("#og-logo", { name: "logo.png", mimeType: "image/png", buffer: logo });
assert.equal(await settled(), "drawn", "A logo the visitor picks is drawn");
assert.equal(await page.locator("#og-photo-name").innerText(), "hero.png", "The photo's name is shown");
assert(asked.every((request) => request.startsWith("GET ")), `The page only reads files: ${asked.join(", ")}`);

// ─── 5. Downloads ──────────────────────────────────────────────────────────────

async function download(kind) {
  const [file] = await Promise.all([page.waitForEvent("download"), page.click(`[data-download="${kind}"]`)]);
  return { name: file.suggestedFilename(), bytes: await readFile(await file.path()) };
}
const png = await download("png");
assert.match(png.name, /^ten-ways-to-make-a-share-image-people-click\.png$/, "The PNG is named after the headline");
assert.equal(png.bytes.subarray(1, 4).toString(), "PNG", "The PNG is a PNG");
assert.deepEqual([png.bytes.readUInt32BE(16), png.bytes.readUInt32BE(20)], [1200, 630], "The PNG is 1200 × 630");
const jpg = await download("jpg");
assert.deepEqual([...jpg.bytes.subarray(0, 3)], [0xff, 0xd8, 0xff], "The JPG is a JPEG");
const sof = (() => {
  for (let i = 2; i < jpg.bytes.length; ) {
    const marker = jpg.bytes[i + 1];
    if (marker >= 0xc0 && marker <= 0xc2) return [jpg.bytes.readUInt16BE(i + 7), jpg.bytes.readUInt16BE(i + 5)];
    i += 2 + jpg.bytes.readUInt16BE(i + 2);
  }
})();
assert.deepEqual(sof, [1200, 630], "The JPG is 1200 × 630");

// ─── 6. No resvg where it isn't needed; nothing from elsewhere ─────────────────

assert(!asked.some((request) => request.includes("resvg.wasm")), "resvg's WebAssembly isn't loaded: the browser makes the PNG and the JPEG");
// The site's own typeface (Geist), which every page's layout loads from Google Fonts, is the only thing from elsewhere.
const SITE_FONTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;
assert.deepEqual(elsewhere.filter((url) => !SITE_FONTS.test(url)), [], "The page asks nothing of any other host, but for the site's typeface");

// ─── 7. A phone's width ────────────────────────────────────────────────────────

await page.setViewportSize({ width: 375, height: 812 });
await page.waitForTimeout(200);
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 375, "Nothing is wider than a phone's screen");

assert.deepEqual(errors, [], "The page throws nothing");
await browser.close();
server.close();
console.log(`✓ ${PATH}: ${DESIGNS.length} designs drawn in Chromium, a headline refused and fixed, a photo and a logo drawn without a request, a PNG and a JPEG of 1200 × 630`);
