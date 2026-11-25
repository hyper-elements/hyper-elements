// Run after `pnpm --filter @hyper-elements/website build`.
// Every built page's social image is there: a page's own image as a file in the site, and a generated card
// (scripts/og-cards.mjs) as a 1200×630 PNG at /og/cards/<the page's path>.png with its size and alternate text said.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dist = resolve(fileURLToPath(new URL("../dist/", import.meta.url)));
const site = "https://www.hyperelements.dev";
const meta = (html, property) => html.match(new RegExp(`<meta property="${property}" content="([^"]*)"`))?.[1];

const pages = [];
(function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.name.endsWith(".html")) pages.push(path);
  }
})(dist);

let [cards, own] = [0, 0];
for (const file of pages) {
  const html = readFileSync(file, "utf8");
  const page = relative(dist, file);
  // A redirect's page has no social image.
  if (/<meta http-equiv="refresh"/.test(html)) continue;
  const image = meta(html, "og:image");
  assert(image?.startsWith(`${site}/`), `${page}: no og:image on the site`);
  assert(meta(html, "og:image:alt"), `${page}: no og:image:alt`);
  assert.equal(html.match(/<meta name="twitter:image" content="([^"]*)"/)?.[1], image, `${page}: twitter:image isn't og:image`);
  const path = new URL(image).pathname;
  assert(existsSync(join(dist, path)), `${page}: its social image ${path} isn't in the site`);
  if (!path.startsWith("/og/cards/")) {
    own++;
    continue;
  }
  const route = `/${page.replace(/(^|\/)index\.html$/, "").replace(/\.html$/, "")}`;
  const expected = `/og/cards/${route.replace(/^\/|\/$/g, "") || "index"}.png`;
  assert.equal(path, expected, `${page}: its card isn't the one for its path`);
  assert.equal(meta(html, "og:image:width"), "1200", `${page}: card width`);
  assert.equal(meta(html, "og:image:height"), "630", `${page}: card height`);
  const bytes = readFileSync(join(dist, path));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${page}: its card isn't a PNG`);
  assert.equal(bytes.readUInt32BE(16), 1200, `${page}: card width`);
  assert.equal(bytes.readUInt32BE(20), 630, `${page}: card height`);
  cards++;
}
assert(cards > 0, "No page has a generated card");
assert.equal(meta(readFileSync(join(dist, "index.html"), "utf8"), "og:image"), `${site}/og.png`, "The home page keeps its own social image");
console.log(`Social images PASS: ${cards} pages with a generated 1200×630 card, ${own} with their own image, each in the site.`);
