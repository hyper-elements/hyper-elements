// Run after `pnpm --filter @hyper-elements/website build`.
// The templates pages: every template has its page, each old designs-gallery address redirects to the
// playground with its design open (its #starter= fragment kept), and no page links to an old gallery address.
// Then the gallery in Chromium, offline: the output chips filter it, picking a brand draws every card in it from that
// brand's own file, ?brand= brings a pick back, and a card's name shows on hover and on focus. A card opens its
// template's page in the brand it shows; there, Code shows the design alone, brand.ts opens under it in the brand
// picked, and "copy it as one file" and "Copy the code" copy that brand's file.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dist = resolve(fileURLToPath(new URL("../dist/", import.meta.url)));
const data = JSON.parse(readFileSync(new URL("../src/generated/kits.json", import.meta.url), "utf8"));
const gallery = Object.keys(JSON.parse(readFileSync(new URL("../src/generated/examples.json", import.meta.url), "utf8")).templates);
const page = (path) => join(dist, path.replace(/^\//, ""), "index.html");

assert(existsSync(page("/templates")), "no /templates page");
for (const t of data.templates) {
  const html = readFileSync(page(`/templates/${t.kit}/${t.folder}/${t.category}`), "utf8");
  // A way back to the picture from Code: a tab before it.
  assert.match(html, /data-mode-pick="(?!code")[^"]+"[^]*data-mode-pick="code"/, `${t.key}: no view to pick besides Code`);
  for (const brand of data.brands) assert(html.includes(`data-brand="${brand.id}"`), `${t.key}: no preview in ${brand.id}`);
  assert(html.includes("// brand: start"), `${t.key}: no single file`);
}

for (const slug of gallery) {
  const file = page(`/templates/${slug}`);
  assert(existsSync(file), `/templates/${slug}: no redirect`);
  assert.match(readFileSync(file, "utf8"), new RegExp(`http-equiv="refresh"[^>]*url=/playground#starter=${slug}"`), `/templates/${slug} doesn't redirect to the playground with its design`);
}

const old = new RegExp(`href="(?:https://(?:www\\.)?hyperelements\\.dev)?/templates/(${gallery.join("|")})"`);
const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (/\.(html|txt)$/.test(entry.name)) files.push(path);
  }
})(dist);
for (const file of files) {
  const text = readFileSync(file, "utf8");
  if (/http-equiv="refresh"/.test(text)) continue;
  assert(!old.test(text), `${relative(dist, file)} links to an old gallery address: ${text.match(old)?.[0]}`);
  if (file.endsWith("llms.txt")) assert(!new RegExp(`/templates/(${gallery.join("|")})\\b`).test(text), "llms.txt names an old gallery address");
}
// Every view in every brand has the file the gallery loads it from when that brand is picked.
for (const t of data.templates) {
  for (const [brand, { views }] of Object.entries(t.byBrand)) {
    for (const view of Object.values(views)) {
      assert(view.preview, `${t.key} in ${brand}: no preview file`);
      assert(existsSync(join(dist, view.preview)), `${t.key} in ${brand}: ${view.preview} isn't in the build`);
    }
  }
}

// The gallery in Chromium.
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".pdf": "application/pdf", ".ttf": "font/ttf", ".woff2": "font/woff2" };
const server = createServer(async (request, response) => {
  let file = join(dist, decodeURIComponent(new URL(request.url, "http://localhost").pathname));
  if (!file.startsWith(dist)) return response.writeHead(403).end();
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  try {
    const body = await readFile(file);
    response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" }).end(body);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(0, "localhost", done));
const origin = `http://localhost:${server.address().port}`;
const playwright = createRequire(join(dist, "../../../packages/react/package.json"))("playwright");
const browser = await playwright.chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.route("**/*", (route) => (route.request().url().startsWith(origin) ? route.continue() : route.abort()));
  const page = await context.newPage();
  await page.goto(`${origin}/templates/`);
  const cards = page.locator("[data-gallery] .gcard");
  const count = await cards.count();
  assert.equal(count, data.templates.length, "the gallery doesn't show every template");
  assert.equal(await page.locator("[data-group-pick]").count(), 0, "the gallery still has job chips");

  // Outputs.
  await page.click('[data-output-pick="images"]');
  const images = data.templates.filter((t) => t.folder === "images").length;
  assert.equal(await page.locator("[data-gallery] .gcard:visible").count(), images, "Images doesn't show only the images");
  await page.click('[data-output-pick="all"]');
  assert.equal(await page.locator("[data-gallery] .gcard:visible").count(), count, "Everything doesn't show every template");

  // A brand: every card from that brand's file, its frame in the brand's background, its caption naming it.
  const brand = data.brands.find((b) => b.id !== "orbit") ?? data.brands[0];
  const shown = () =>
    page.$$eval("[data-gallery] .gcard", (all) =>
      all.map((card) => ({ own: card.dataset.own, src: card.querySelector("iframe")?.getAttribute("src") ?? card.querySelector("img")?.getAttribute("src"), srcdoc: card.querySelector("iframe")?.hasAttribute("srcdoc") ?? false, caption: card.querySelector("[data-caption]").textContent, background: card.querySelector(".gshot").style.background })),
    );
  const check = async (id, name) => {
    const all = await shown();
    all.forEach((card, i) => {
      // A card already in that brand keeps what it shows; every other one loads the brand's file.
      if (card.own === id && card.srcdoc) return assert.equal(card.caption, `in ${name}`, `card ${i + 1}'s caption doesn't name ${name}`);
      assert(card.src?.endsWith(`.${id}.html`) || card.src?.endsWith(`.${id}.png`), `card ${i + 1} isn't drawn in ${id}: ${card.src}`);
      assert(!card.srcdoc, `card ${i + 1} still shows its first brand inline`);
      assert.equal(card.caption, `in ${name}`, `card ${i + 1}'s caption doesn't name ${name}`);
      assert.equal(card.background, background, `card ${i + 1}'s frame isn't ${id}'s background`);
    });
  };
  // The frame's background as the browser writes it back.
  const background = await page.evaluate((color) => Object.assign(document.createElement("span").style, { background: color }).background, brand.colors.background);
  await page.click(`[data-brand-pick="${brand.id}"]`);
  await check(brand.id, brand.name);
  assert.equal(new URL(page.url()).searchParams.get("brand"), brand.id, "the pick isn't in the address");
  assert.equal(await page.textContent("[data-brand-name]"), brand.name);
  // The first card's file has loaded, and it's the brand's: its name is in it.
  await page.waitForFunction((name) => document.querySelector("[data-gallery] iframe")?.contentDocument?.body?.innerText.includes(name), brand.name, { timeout: 15000 });

  // ?brand= in a new page brings it back.
  const again = await context.newPage();
  await again.goto(`${origin}/templates/?brand=${brand.id}`);
  assert.equal(await again.getAttribute(`[data-brand-pick="${brand.id}"]`, "aria-checked"), "true", "?brand= isn't picked");
  await again.close();

  // Their own brands again: each card back in its first brand.
  await page.click('[data-brand-pick="own"]');
  for (const [i, card] of (await shown()).entries()) {
    assert(card.srcdoc ? card.own === brand.id || !card.src : card.src?.includes(`.${card.own}.`), `card ${i + 1} isn't back in ${card.own}`);
  }
  assert.equal(new URL(page.url()).searchParams.get("brand"), null, "their own brands leaves ?brand= in the address");

  // The name shows only on hover or focus.
  const opacity = (i) => cards.nth(i).locator(".gcap").evaluate((c) => Number(getComputedStyle(c).opacity));
  await page.mouse.move(0, 0);
  await page.waitForTimeout(300);
  assert.equal(await opacity(0), 0, "a caption shows without hover");
  await cards.nth(0).hover();
  await page.waitForTimeout(300);
  assert.equal(await opacity(0), 1, "a caption doesn't show on hover");
  await page.mouse.move(0, 0);
  await cards.nth(1).focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await page.waitForTimeout(300);
  assert.equal(await opacity(1), 1, "a caption doesn't show on focus");

  // A template's page, opened from its card in a brand.
  const t = data.templates.find((x) => x.root === "Email" && !x.recreates);
  await page.click(`[data-brand-pick="${brand.id}"]`);
  await Promise.all([page.waitForURL(`**/templates/${t.kit}/${t.folder}/${t.category}?brand=${brand.id}`), page.click(`[data-gallery] .gcard[data-href="/templates/${t.kit}/${t.folder}/${t.category}"]`)]);
  assert.equal(await page.getAttribute(`[data-brand-pick="${brand.id}"]`, "aria-checked"), "true", "the page doesn't open in the card's brand");
  const visible = (selector) => page.locator(selector).evaluateAll((all) => all.filter((e) => e.offsetParent !== null || e.getClientRects().length).length);
  assert.equal(await visible(".t-actions [data-copy]"), 1, "more than one Copy the code shows");
  assert.equal(await page.getAttribute(".t-actions [data-copy]:visible", "data-copy"), t.byBrand[brand.id].single, "Copy the code doesn't copy the picked brand's file");
  assert.equal(await page.locator("text=template extract").count(), 0, "the page still shows template extract");
  // By default: the preview alone, as tall as what it shows (no scrollbar of its own), on a desktop and on a phone.
  assert.equal(await page.$eval(".stage-code", (c) => getComputedStyle(c).display), "none", "the code shows before Code is picked");
  const fits = (view) =>
    page.waitForFunction((view) => {
      const shown = [...document.querySelectorAll(".stage-preview > [data-brand]")].find((d) => !d.hidden);
      const frame = shown?.querySelector(`.view[data-view="${view}"] iframe`);
      const doc = frame?.contentDocument;
      return doc?.body?.childElementCount && Math.abs(frame.getBoundingClientRect().height / (frame.getBoundingClientRect().width / frame.offsetWidth) - doc.documentElement.scrollHeight) <= 2;
    }, view, { timeout: 15000 });
  await fits("desktop");
  await page.click('[data-mode-pick="phone"]');
  await fits("phone");
  await page.click('[data-mode-pick="desktop"]');
  await page.click('[data-mode-pick="code"]');
  assert(await page.isHidden(".stage-preview"), "Code doesn't hide the preview");
  const design = await page.locator(".stage-code > .code-block pre").first().textContent();
  assert(design.includes('from "./brand"') && !design.includes("// brand: start"), "Code doesn't show the design alone");
  assert(await page.isHidden("#brand-file"), "brand.ts shows before it's asked for");
  await page.click("[data-brand-toggle]");
  assert(await page.isVisible("#brand-file"), "Show brand.ts doesn't show it");
  const brandFile = await page.locator(`#brand-file [data-brand="${brand.id}"] pre`).textContent();
  assert(brandFile.includes(`"${brand.name}"`), "brand.ts isn't the picked brand's");
  assert.equal(await page.getAttribute(`.one-file [data-brand="${brand.id}"] [data-copy]`, "data-copy"), t.byBrand[brand.id].single, "copy it as one file doesn't copy the picked brand's file");
  assert(await page.isVisible(`.one-file [data-brand="${brand.id}"]`), "the picked brand's one file line doesn't show");
} finally {
  await browser.close();
  server.close();
}

console.log(`templates pages: ${data.templates.length} templates, ${gallery.length} redirects; the gallery in every brand`);
