// Browser and discovery checks for the built HTML email playground. No requests leave this machine.
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const site = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(site, "dist");
const html = await readFile(join(dist, "email-testing/index.html"), "utf8");
assert.match(html, /<title>Test HTML emails in Outlook, Gmail and more/);
assert.match(html, /rel="canonical" href="https:\/\/www.hyperelements.dev\/email-testing"/);
assert.match(html, /name="description" content="Test HTML email compatibility/);
assert.match(html, /href="\/email-testing" aria-current="page"/);
assert(!html.includes('content="noindex"'));
for (const name of ["llms.txt", "llms-full.txt", "sitemap-0.xml", "index.html"]) {
  assert((await readFile(join(dist, name), "utf8")).includes("/email-testing"), `${name} links the email testing page`);
}
assert(JSON.parse(await readFile(join(dist, "search.json"), "utf8")).some((item) => item.href === "/email-testing"));
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".txt": "text/plain", ".wasm": "application/wasm" };
let attackRequests = 0;
const server = createServer(async (request, response) => {
  const path = new URL(request.url, "http://localhost").pathname;
  if (path === "/attack") { attackRequests++; response.writeHead(200).end("unexpected"); return; }
  let file = resolve(dist, `.${decodeURIComponent(path)}`);
  if (!file.startsWith(`${dist}/`)) { response.writeHead(403).end(); return; }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) { response.writeHead(404).end(); return; }
  response.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
  response.end(await readFile(file));
});
await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
const origin = `http://127.0.0.1:${server.address().port}`;
const { chromium } = createRequire(join(site, "../../packages/react/package.json"))("playwright");
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await context.addInitScript(() => {
    window.__emailTools = [];
    Object.defineProperty(document, "modelContext", { get: () => ({ registerTool: (tool) => window.__emailTools.push(tool) }) });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(`${origin}/email-testing`);
  await page.waitForFunction(() => !!window.hyperElementsEmailTesting);
  assert.equal(await page.locator("h1").count(), 1);
  assert.equal(await page.locator("h1").innerText(), "Test HTML emails in Outlook, Gmail and more");
  assert.equal(await page.locator(".et-status-bar, #email-open, #email-file, #email-help-open, #email-help").count(), 0);
  // Every on-site link and fragment on the new page resolves in the build.
  for (const href of await page.locator('a[href^="/"]').evaluateAll((links) => [...new Set(links.map((a) => a.getAttribute("href")))])) {
    const url = new URL(href, origin);
    let file = join(dist, url.pathname);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    assert(existsSync(file), `Broken internal link: ${href}`);
    if (url.hash) assert((await readFile(file, "utf8")).includes(`id="${url.hash.slice(1)}"`), `Broken fragment: ${href}`);
  }
  assert.deepEqual(await page.evaluate(() => window.__emailTools.map((tool) => tool.name)), ["check_html_email"]);
  const sample = await page.locator("#email-html").inputValue();
  const run = (input) => page.evaluate((input) => window.hyperElementsEmailTesting.check(input), input);
  const updated = () => page.waitForFunction(() => document.querySelector("[data-email-testing]").dataset.renderStatus === "ok");
  const readyPreview = async (selector) => {
    const frame = await page.locator(selector).elementHandle().then((handle) => handle.contentFrame());
    await frame.waitForFunction(() => document.documentElement.hasAttribute("data-email-client-ready"), undefined, { timeout: 20000 });
    const findings = await frame.locator("#email-client-findings").textContent().then(JSON.parse);
    assert.equal(findings.error, null, JSON.stringify(findings));
    // External stand-in fonts are deliberately blocked in this offline check.
    assert(["ok", "incomplete"].includes(findings.ready));
    assert(frame.childFrames().length >= 2, "The modeled email and its baseline were drawn");
    return frame;
  };
  const readyFrame = () => readyPreview("#email-sheet iframe");
  await updated(); // All client thumbnails render automatically, without clicking a call to action.
  assert(await page.locator(".et-output").evaluate((panel) => panel.getBoundingClientRect().top < 160 && panel.getBoundingClientRect().bottom < innerHeight));
  assert(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), "The workspace fits the first viewport");
  assert(await page.locator("#email-html").isVisible(), "HTML is the editor's default and only editing surface");
  assert.equal(await page.locator('[data-design], #email-template, input[type="color"]').count(), 0);
  assert(await page.locator("#email-gallery").isVisible());
  assert.equal(await page.locator(".et-thumbnail").count(), 7);
  assert.equal(await page.locator("#email-sheet iframe").count(), 0, "The overview comes before a full preview");
  const checkThumbnails = async (words) => {
    for (const client of await page.locator(".et-thumbnail button").evaluateAll((buttons) => buttons.map((button) => button.dataset.client))) {
      const selector = `.et-thumbnail:has(button[data-client="${client}"]) iframe`;
      const thumbnail = await readyPreview(selector);
      const found = JSON.parse(await thumbnail.locator("#email-client-findings").textContent());
      assert.equal(found.client, client, "Each thumbnail actually runs that client's model");
      const text = (await thumbnail.childFrames()[0].locator("body").innerText()).replace(/\s+/g, " ");
      assert(text.includes(words), `${client} thumbnail contains the current email: ${text}`);
      assert.equal(await thumbnail.locator("header.note").evaluate((header) => getComputedStyle(header).display), "none");
      assert(await thumbnail.childFrames()[0].locator('img[alt^="Two sky blue MacBook Air"]').evaluate((image) => image.complete && image.naturalWidth > 0 && !image.hasAttribute("data-email-client-missing")), "The sample's product image loads locally in every client");
    }
    assert.equal(await page.locator(".et-client-logo").count(), 7);
    assert(await page.locator(".et-client-logo").evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0 && image.alt === "")), "Each client has a loaded, decorative logo beside its label");
  };
  await checkThumbnails("MacBook Air");
  if (process.env.EMAIL_TESTING_SHOTS) {
    await mkdir(process.env.EMAIL_TESTING_SHOTS, { recursive: true });
    await page.screenshot({ path: join(process.env.EMAIL_TESTING_SHOTS, "email-gallery.png"), fullPage: true });
  }
  await page.getByRole("button", { name: "Open Apple Mail preview", exact: true }).click();
  const first = await readyFrame();
  assert.equal(await first.locator("header.note").evaluate((header) => getComputedStyle(header).display), "none");
  assert(!await page.locator("#email-gallery").isVisible());
  assert(await page.locator("#email-viewport").isVisible());
  if (process.env.EMAIL_TESTING_SHOTS) await page.screenshot({ path: join(process.env.EMAIL_TESTING_SHOTS, "email-full-preview.png"), fullPage: true });
  await page.locator("#email-findings summary").click();
  assert(await page.locator("#email-diagnostics li").count() > 0, "The example exposes actual client compatibility findings");
  assert(await page.locator("#email-diagnostics").innerText().then((text) => /box-shadow/i.test(text)));
  await readyFrame();
  const labels = await page.locator("#email-preview option").allTextContents();
  assert.equal(new Set(labels).size, labels.length, "Desktop, phone and computer variants have distinct labels");
  assert(labels.some((label) => /Apple Mail.*iPhone/.test(label)));
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download report" }).click();
  const saved = await downloadEvent;
  const report = JSON.parse(await readFile(await saved.path(), "utf8"));
  assert(report.ok && report.previews.length === labels.length && report.diagnostics.some((d) => d.line > 0));
  assert(report.previews.every((preview) => !Object.hasOwn(preview, "html")));
  await page.locator("#email-findings summary").click();
  // The selected client stays open while direct HTML edits update its full preview.
  const edited = sample.replaceAll("Make room for possibility.", "Hello from the HTML editor.");
  await page.locator("#email-html").fill(edited);
  await updated();
  let selected = await readyFrame();
  assert((await selected.childFrames()[0].locator("body").innerText()).includes("Hello from the HTML editor."));
  await page.getByRole("button", { name: "All clients", exact: false }).click();
  assert(await page.locator("#email-gallery").isVisible());
  assert.equal(await page.locator("#email-sheet iframe").count(), 0);
  await checkThumbnails("Hello from the HTML editor.");
  await page.getByRole("button", { name: "Open Gmail preview", exact: true }).click();
  assert.equal(await page.locator("#email-preview").inputValue(), "gmail");
  await readyFrame();
  await page.locator("#email-live").uncheck();
  await page.locator("#email-html").fill(sample);
  await page.waitForTimeout(800);
  assert.equal(await page.locator("[data-email-testing]").getAttribute("data-render-status"), "pending", "Live preview can be paused");
  assert.match(await page.locator("#email-preview-note").innerText(), /Previous previews/);
  await page.locator("#email-live").check();
  await updated();
  const exportedEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export HTML" }).click();
  const exported = await exportedEvent;
  assert.equal(await readFile(await exported.path(), "utf8"), await page.locator("#email-html").inputValue());
  await page.getByRole("button", { name: "Render details", exact: true }).click();
  selected = await readyFrame();
  assert.notEqual(await selected.locator("header.note").evaluate((header) => getComputedStyle(header).display), "none", "Full browser findings remain available");
  await page.getByRole("button", { name: "Back to email", exact: true }).click();
  await page.getByRole("button", { name: "All clients", exact: false }).click();
  await page.getByRole("button", { name: "Open Classic Outlook preview", exact: true }).click();
  assert.equal(await page.locator("#email-preview").inputValue(), "outlook");
  // Edits invalidate the report, while the last preview stays visible and explicitly marked as previous.
  await page.locator("#email-html").fill("<p>A fragment</p>");
  assert.equal(await page.locator("#email-sheet iframe").count(), 1);
  assert(await page.locator("#email-download").isDisabled());
  assert.equal((await run({ html: "<p>A fragment</p>" })).ok, false);
  assert.match(await page.locator("#email-error").innerText(), /whole email/);
  assert.equal((await run({ html: sample, clients: [] })).ok, false);
  assert.equal((await run({ html: sample, clients: ["unknown"] })).ok, false);
  assert.equal((await run({ html: "x".repeat(250001) })).ok, false);
  assert.equal((await run({ html: sample, dark: "yes" })).ok, false);
  const clients = ["outlook", "outlook-com", "gmail", "gmail-app", "apple-mail", "yahoo", "aol"];
  const all = await page.evaluate((input) => window.__emailTools[0].execute(input), { html: sample, clients, dark: true });
  assert(all.ok, all.error?.message);
  assert(all.previews.length > 12, "The complete selection is not truncated to the original playground's 12-preview limit");
  assert(all.previews.some((p) => p.id === "apple-mail.iphone.dark"));
  assert(all.previews.some((p) => p.client === "yahoo" && p.dark));
  assert(all.previews.some((p) => p.client === "aol" && p.dark));
  assert(all.skipped.some((p) => p.client === "outlook"));
  for (const id of ["gmail", "apple-mail.iphone.dark", "yahoo.dark", "aol.dark"]) {
    await page.locator("#email-preview").selectOption(id);
    await readyFrame();
  }
  assert.equal(new Set(await page.locator("#email-preview option").allTextContents()).size, all.previews.length);
  const concurrent = await page.evaluate(async (html) => Promise.all([
    window.hyperElementsEmailTesting.check({ html, clients: ["outlook"] }),
    window.hyperElementsEmailTesting.check({ html, clients: ["apple-mail"] }),
  ]), sample);
  assert.equal(concurrent[0].ok, false);
  assert(concurrent[1].ok);
  assert((await page.locator("#email-preview option").allTextContents()).every((text) => text.startsWith("Apple Mail")));
  // The email remains data: scripts, handlers, frames and meta redirects cannot act on the parent or make requests.
  const hostile = `<!doctype html><html><head><meta http-equiv="refresh" content="0;url=${origin}/attack"><base href="${origin}/attack"></head><body><p>SAFE_EMAIL_TEXT</p><script>parent.document.body.dataset.emailAttack='yes';fetch('${origin}/attack')</script><svg onload="fetch('${origin}/attack')"></svg><iframe src="${origin}/attack"></iframe></body></html>`;
  const safe = await run({ html: hostile, clients: ["gmail"] });
  assert(safe.ok, safe.error?.message);
  const frame = await readyFrame();
  assert.match(await frame.childFrames()[0].locator("body").innerText(), /SAFE_EMAIL_TEXT/);
  await page.getByRole("button", { name: "All clients", exact: false }).click();
  const hostileThumbnail = await readyPreview(".et-thumb-image iframe");
  assert.match(await hostileThumbnail.childFrames()[0].locator("body").innerText(), /SAFE_EMAIL_TEXT/);
  assert.equal(await page.evaluate(() => document.body.dataset.emailAttack), undefined);
  assert.equal(attackRequests, 0);
  const frames = await page.locator("iframe").evaluateAll((items) => items.map((f) => ({ sandbox: f.getAttribute("sandbox"), src: f.getAttribute("src"), srcdoc: f.hasAttribute("srcdoc") })));
  assert(frames.every((f) => f.sandbox));
  assert(frames.filter((f) => f.sandbox.includes("allow-same-origin")).every((f) => f.src.startsWith("data:") && !f.srcdoc));
  await page.getByRole("button", { name: "Open Gmail preview", exact: true }).click();
  await run({ html: sample, clients });
  await page.locator("#email-preview").selectOption("outlook");
  await readyFrame();
  for (const width of [1440, 1100, 1024, 900, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForFunction(() => {
      const frame = document.querySelector("#email-sheet iframe");
      const panel = document.getElementById("email-viewport");
      const style = getComputedStyle(panel);
      const width = panel.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      return frame.clientWidth === 820 && Math.abs(frame.getBoundingClientRect().width - Math.min(820, width)) < 1;
    });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `No horizontal page overflow at ${width}px`);
    const overlaps = await page.evaluate(() => {
      const nav = document.querySelector(".main-nav");
      return getComputedStyle(nav).display !== "none" && nav.getBoundingClientRect().right > document.querySelector(".header-actions").getBoundingClientRect().left + 1;
    });
    assert(!overlaps, `Header navigation fits at ${width}px`);
    assert(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), `Workspace fits the viewport at ${width}px`);
    if (process.env.EMAIL_TESTING_SHOTS && [1440, 390].includes(width)) {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await mkdir(process.env.EMAIL_TESTING_SHOTS, { recursive: true });
      await page.screenshot({ path: join(process.env.EMAIL_TESTING_SHOTS, `email-testing-${width}.png`), fullPage: true });
      await page.locator(".et-output").screenshot({ path: join(process.env.EMAIL_TESTING_SHOTS, `email-testing-preview-${width}.png`) });
    }
  }
  await page.getByRole("button", { name: "Actual size", exact: true }).click();
  assert.equal(await page.locator("#email-sheet iframe").evaluate((frame) => frame.getBoundingClientRect().width), 820);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Actual size scrolls inside the preview panel");
  await page.getByRole("button", { name: "Fit to panel", exact: true }).click();
  await page.getByRole("tab", { name: "HTML", exact: true }).click();
  assert(await page.locator("#email-editor-panel").isVisible());
  assert(!await page.locator("#email-preview-panel").isVisible());
  await page.getByRole("button", { name: "Load example", exact: true }).click();
  assert.equal(await page.locator("#email-html").inputValue(), sample);
  assert(await page.locator("#email-html").isVisible());
  await page.getByRole("tab", { name: "Preview", exact: true }).click();
  assert(await page.locator("#email-preview-panel").isVisible());
  await page.reload();
  assert.equal(await page.locator("#email-html").inputValue(), sample, "A submitted email is not persisted");
  await updated();
  assert(await page.locator("#email-gallery").isVisible(), "A phone also opens with the overview");
  assert.equal(await page.locator(".et-thumbnail").count(), 7);
  await checkThumbnails("MacBook Air");
  if (process.env.EMAIL_TESTING_SHOTS) await page.screenshot({ path: join(process.env.EMAIL_TESTING_SHOTS, "email-gallery-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Open Gmail app preview", exact: true }).click();
  await readyFrame();
  assert(await page.locator("#email-viewport").isVisible());
  await page.getByRole("button", { name: "All clients", exact: false }).click();
  assert(await page.locator("#email-gallery").isVisible());
  assert.deepEqual(errors, []);
  console.log("Email testing: HTML editor, seven live client thumbnails, full preview navigation, live updates, export, client variants, reports, agents, isolation and responsive layout passed.");
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
