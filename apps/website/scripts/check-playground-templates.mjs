// The playground's gate for the community templates (templates/, plain designs) and for template() code. Run after
// `pnpm --filter @hyper-elements/website build`:
//
//   node scripts/check-playground-templates.mjs
//
// It serves dist/ and opens /playground in Chromium, offline: every request to another host is refused, and one to
// hyperelements.dev (the live site) fails the run, so what's shown is this build's own files.
//
//   1. Every design's single file renders through the sandbox (an image's PNG drawn from its assets, a PDF written).
//   2. A template() with two formats (a fixture) shows a format switch; switching square → landscape → square without
//      editing the code draws each format's own PNG, at its own size.
//   3. The Brand menu shows on a single file, and picking a brand changes only the text between the brand markers.
//   4. A slot's allow list knows the playground's elements: a slot that allows them renders, one that doesn't refuses.
//   5. A Canvas template() whose image's bytes disagree with its declared size isn't drawn: no PNG, and the reason.
//   6. A design's logo and font load from this site in the HTML preview, and its blocks are still marked.
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const site = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = join(site, "dist");
assert(existsSync(join(dist, "playground/index.html")), "Build the site first: pnpm --filter @hyper-elements/website build");
const gallery = JSON.parse(readFileSync(join(site, "src/generated/gallery.json"), "utf8"));

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".txt": "text/plain; charset=utf-8", ".wasm": "application/wasm", ".ttf": "font/ttf", ".otf": "font/otf", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".pdf": "application/pdf", ".xml": "application/xml" };
const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  let file = join(dist, path);
  if (!file.startsWith(dist)) return response.writeHead(403).end();
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file) && existsSync(`${file}.html`)) file = `${file}.html`;
  try {
    const body = await readFile(file);
    response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((done) => server.listen(0, "localhost", done));
const origin = `http://localhost:${server.address().port}`;

const playwright = createRequire(join(site, "../../packages/react/package.json"))("playwright");
const browser = await playwright.chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const live = [];
await context.route("**/*", (route) => {
  const url = route.request().url();
  if (url.startsWith(origin)) return route.continue();
  if (/^https:\/\/(www\.)?hyperelements\.dev\//.test(url)) live.push(url);
  return route.abort();
});

const step = (name) => console.log(`  ✓ ${name}`);
const api = (page, call, ...args) => page.evaluate(([call, args]) => window.hyperElementsPlayground[call](...args), [call, args]);
const rendered = (page) => page.waitForFunction(() => ["ok", "error"].includes(document.documentElement.dataset.renderStatus), null, { timeout: 60_000 });
const idOf = (t) => `template-${t.key.replaceAll("/", "-")}`;
const brandOf = (t) => t.byBrand[gallery.brands[0].id];

async function open(hash = "") {
  const page = await context.newPage();
  page.on("pageerror", (error) => console.log("pageerror", String(error).slice(0, 300)));
  await page.addInitScript(() => {
    try {
      localStorage.removeItem("hyper-elements-playground");
    } catch {
      // A sandboxed frame: it has no storage.
    }
  });
  await page.goto(`${origin}/playground${hash}`);
  await rendered(page);
  await api(page, "ready");
  return page;
}

try {
  const page = await open();

  // ─── 1. Every template's single file renders through the sandbox ─────────
  for (const t of gallery.templates) {
    const source = brandOf(t).single;
    const include = t.root === "Canvas" ? ["png"] : t.root === "Document" ? ["pdf"] : ["html"];
    const result = await api(page, "render", source, { include });
    assert.equal(result.ok, true, `${t.key}: ${JSON.stringify(result.error ?? result.diagnostics.filter((d) => d.severity === "error"))}`);
    assert.equal(result.root, t.root, `${t.key} is a ${t.root}`);
    if (t.root === "Canvas") assert(result.png && !result.error, `${t.key} draws its PNG: ${JSON.stringify(result.error)} ${JSON.stringify(result.diagnostics.map((d) => `${d.code}: ${d.message}`))}`);
    if (t.root === "Document") assert(result.pdf, `${t.key} writes its PDF`);
  }
  step(`every design's single file renders through the sandbox (${gallery.templates.length}, an image's PNG and a PDF drawn)`);

  // ─── 2. A template's formats ─────────────────────────────────────────────
  // A Canvas template() of two formats, with an image field: the gallery holds designs, so the fixture is here.
  const ASSET = "https://hyperelements.dev/generated/gallery/assets/";
  const canvasTemplate = (width, height) => `import { Canvas, Heading, Image } from "@hyper-elements/react";
import { field, template } from "@hyper-elements/react/template";
const fonts = [
  { family: "Inter", src: "${ASSET}fonts/Inter-400.ttf", weight: 400, style: "normal" },
  { family: "Inter", src: "${ASSET}fonts/Inter-700.ttf", weight: 700, style: "normal" },
] as const;
export default template({
  id: "acme.Launch", version: "1.0.0", label: "Launch", root: "Canvas",
  formats: { square: { width: 1080, height: 1080 }, landscape: { width: 1200, height: 630 } },
  fields: { screenshot: field.image({ label: "Screenshot", required: true, accepts: ["png"] }) },
  example: { screenshot: { src: "${ASSET}images/screenshot.png", width: ${width}, height: ${height} } },
  render: (v, { format }) => (
    <Canvas width={format === "square" ? 1080 : 1200} height={format === "square" ? 1080 : 630} fonts={[...fonts]} style={{ fontFamily: "Inter", padding: 48, gap: 24 }}>
      <Heading level={1} style={{ fontSize: 56 }}>Launch day</Heading>
      <Image field="screenshot" src={v.screenshot} alt="The product" style={{ width: 480 }} />
    </Canvas>
  ),
});`;
  const signal = { formats: ["square", "landscape"] };
  const formats = await open();
  await api(formats, "setCode", canvasTemplate(1600, 1000));
  await rendered(formats);
  const pngSize = () =>
    formats.waitForFunction(() => {
      const image = document.querySelector('[data-file="png"] img');
      return image && image.complete && image.naturalWidth ? [image.naturalWidth, image.naturalHeight] : null;
    }, null, { timeout: 60_000 }).then((handle) => handle.jsonValue());
  const switcher = formats.locator("[data-template-formats]");
  assert.equal(await switcher.isHidden(), false, "a template with two formats shows its formats");
  assert.deepEqual(await formats.locator("[data-template-format]").evaluateAll((items) => items.map((item) => item.dataset.templateFormat)), signal.formats);
  const code = await api(formats, "getCode");
  const sizes = {};
  for (const format of [signal.formats[0], signal.formats[1], signal.formats[0]]) {
    if (format !== (await formats.locator('[data-template-format][aria-checked="true"]').getAttribute("data-template-format"))) {
      await formats.evaluate(() => document.querySelector('[data-file="png"] img')?.remove());
      await formats.locator(`[data-template-format="${format}"]`).click();
      await rendered(formats);
    }
    const size = await pngSize();
    sizes[format] ??= size;
    assert.deepEqual(size, sizes[format], `${format} draws at the size it drew before`);
    assert.equal(await api(formats, "getCode"), code, "switching format leaves the code as it was");
  }
  assert.notDeepEqual(sizes[signal.formats[0]], sizes[signal.formats[1]], `the formats draw at their own sizes: ${JSON.stringify(sizes)}`);
  assert.deepEqual(sizes.square, [1080, 1080]);
  assert.deepEqual(sizes.landscape, [1200, 630]);
  step(`a template's format switch draws each format's own PNG (${Object.entries(sizes).map(([f, s]) => `${f} ${s.join("×")}`).join(", ")}), and switching back draws the first again`);
  await formats.close();

  // ─── 3. The Brand menu ───────────────────────────────────────────────────
  // A design in the sample brands: a recreation opens in its own company's brand.
  const welcome = gallery.templates.find((t) => t.root === "Email" && !t.recreates);
  const branded = await open(`#starter=${idOf(welcome)}`);
  const menu = branded.locator("[data-brand]");
  assert.equal(await menu.isHidden(), false, "the Brand menu shows on a template's single file");
  const before = await api(branded, "getCode");
  const second = gallery.brands[1];
  assert.equal(await branded.locator("[data-brand-select]").inputValue(), gallery.brands[0].id, "the brand the file holds is picked");
  await branded.locator("[data-brand-select]").selectOption(second.id);
  await branded.waitForFunction((block) => window.hyperElementsPlayground.getCode().includes(block), second.block);
  await rendered(branded);
  const after = await api(branded, "getCode");
  const outside = (code) => code.slice(0, code.indexOf("// brand: start")) + code.slice(code.indexOf("// brand: end"));
  assert.equal(outside(after), outside(before), "only the text between the markers changed");
  assert.equal(after, welcome.byBrand[second.id].single, "the code is that brand's single file");
  assert.equal(await branded.evaluate(() => document.documentElement.dataset.renderStatus), "ok");
  // And it's hidden for code with no brand block.
  await api(branded, "setCode", `<Email lang="en" previewText="Hi"><Text>No brand here</Text></Email>`);
  await rendered(branded);
  assert.equal(await menu.isHidden(), true, "no Brand menu where the code has no brand block");
  step("the Brand menu shows on a single file, swaps only the brand block (giving that brand's file), and hides elsewhere");
  await branded.close();

  // ─── 4. A slot's allow list ──────────────────────────────────────────────
  const slotTemplate = (allow, extra = "") => `import { Column, Email, Heading, Text, Button, defineElement } from "@hyper-elements/react";
import { field, template } from "@hyper-elements/react/template";
const Badge = defineElement({ type: "acme.Badge", label: "Badge", props: {}, render: () => <Text>New</Text> });
export default template({
  id: "acme.Slotted", version: "1.0.0", label: "Slotted", root: "Email",
  fields: { body: field.slot({ label: "Body", required: true, ${allow} }) },
  example: { body: <Column><Heading level={2}>Hello</Heading><Text>Words</Text>${extra}</Column> },
  render: (v) => <Email lang="en" previewText="Hi"><Column field="body">{v.body}</Column></Email>,
});`;
  const allowed = await api(page, "render", slotTemplate("allow: [Column, Heading, Text]"), { include: [] });
  assert.equal(allowed.ok, true, `a slot that allows its elements renders: ${JSON.stringify(allowed.diagnostics.filter((d) => d.severity === "error"))}`);
  const refused = await api(page, "render", slotTemplate("allow: [Column, Heading, Text]", "<Button href=\"https://example.com\">Go</Button>"), { include: [] });
  assert.equal(refused.ok, false, "an element the slot doesn't allow is refused");
  assert(refused.diagnostics.some((d) => /^template\/slot/.test(d.code)), `refused by the slot: ${JSON.stringify(refused.diagnostics.map((d) => d.code))}`);
  const denied = await api(page, "render", slotTemplate('allow: "all", deny: [Button]', "<Button href=\"https://example.com\">Go</Button>"), { include: [] });
  assert.equal(denied.ok, false, "an element the slot denies is refused");
  const custom = await api(page, "render", slotTemplate("allow: [Column, Heading, Text, Badge]", "<Badge />"), { include: [] });
  assert.equal(custom.ok, true, `a slot that allows a custom element renders it: ${JSON.stringify(custom.diagnostics.filter((d) => d.severity === "error"))}`);
  step("a slot's allow and deny lists know the playground's elements, built-in and custom");

  // ─── 5. A Canvas template's image files are checked before drawing ──────
  const lied = await api(page, "render", canvasTemplate(2400, 1500), { include: ["png"] });
  assert.equal(lied.png, undefined, "an image whose file disagrees with its declared size isn't drawn");
  assert(lied.diagnostics.some((d) => d.code === "template/asset-size"), `it says why: ${JSON.stringify(lied.diagnostics.map((d) => d.code))}`);
  step("a Canvas template whose image's bytes disagree with its declared size gives no PNG, and says template/asset-size");

  // ─── 6. A template's assets from this site, with its blocks marked ───────
  const local = await open(`#starter=${idOf(welcome)}`);
  // The preview is a sandboxed frame of its own origin (two, one the buffer the next render loads in): read from inside
  // the one that holds the template.
  let frame;
  for (let tries = 0; tries < 60 && !frame; tries++) {
    for (const each of local.frames()) {
      if (each.url() !== "about:srcdoc") continue;
      const has = await each.evaluate(() => Boolean(document.querySelector("[data-he-path]") && document.images.length)).catch(() => false);
      if (has) frame = each;
    }
    if (!frame) await local.waitForTimeout(500);
  }
  assert(frame, "the preview shows the template");
  const shown = await frame
    .waitForFunction(() => {
      const img = document.querySelector("img");
      if (!img?.complete || !img.naturalWidth) return null;
      const css = [...document.querySelectorAll("style")].map((s) => s.textContent).join("");
      return { src: img.currentSrc || img.src, marked: [...document.querySelectorAll("[data-he-path]")].map((m) => m.tagName), inlined: /url\(["']?data:font\//.test(css), live: /hyperelements\.dev\/generated/.test(css) };
    }, null, { timeout: 30_000 })
    .then((handle) => handle.jsonValue());
  assert(shown.src.startsWith(origin), `the logo loads from this site: ${shown.src}`);
  assert(shown.inlined, "the brand's font is written into the preview as a data: URL");
  assert.equal(shown.live, false, "the preview names no font on the live site");
  assert(shown.marked.length > 3 && shown.marked.every((tag) => !["STYLE", "HEAD", "META"].includes(tag)), `the blocks are marked on elements: ${shown.marked.slice(0, 8)}`);
  const fontLoaded = await frame.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].some((face) => face.family.replace(/["']/g, "") === "Inter" && face.status === "loaded");
  });
  assert(fontLoaded, "the brand's font loaded in the preview");
  step("a template's logo and font load from this site in the preview (the font as a data: URL), with its blocks still marked");

  assert.deepEqual(live, [], "nothing was asked of the live site");
  console.log(`PLAYGROUND_TEMPLATES_OK: ${gallery.templates.length} templates in the playground, offline`);
} finally {
  await browser.close();
  server.close();
}
