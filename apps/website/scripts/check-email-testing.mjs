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
  assert.equal(await page.locator(".et-status-bar, #email-open, #email-file, #email-help-open, #email-help, #email-preview-controls, #email-preview, #email-details, #email-size, .et-canvas-footer").count(), 0);
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
  const checkPreviewScrolling = async () => {
    const preview = await readyFrame();
    const contentHeight = await preview.locator("#frames").evaluate((content) => Math.ceil(content.getBoundingClientRect().height));
    await page.waitForFunction((height) => document.querySelector("#email-sheet iframe").clientHeight === height, contentHeight);
    assert.equal(await page.locator("#email-sheet iframe").getAttribute("scrolling"), "no");
    assert.equal(await preview.evaluate(() => getComputedStyle(document.documentElement).overflowY), "hidden");
    assert.equal(await preview.locator("#frames > iframe").first().getAttribute("scrolling"), "no");
    assert.equal(await preview.childFrames()[0].evaluate(() => getComputedStyle(document.documentElement).overflowY), "hidden");
    assert(await page.locator("#email-viewport").evaluate((panel) => panel.scrollHeight > panel.clientHeight), "The surrounding panel owns the scrollbar");
    assert(await preview.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), "The full preview iframe matches its content height");
    assert(await preview.childFrames()[0].evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), "The modeled email fits its inner frame without another scrollbar");
    await page.locator("#email-viewport").evaluate((panel) => { panel.scrollTop = 0; });
    const box = await page.locator("#email-sheet").boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + Math.min(100, box.height / 2));
    await page.mouse.wheel(0, 450);
    await page.waitForFunction(() => document.getElementById("email-viewport").scrollTop > 0);
    assert.equal(await preview.evaluate(() => scrollY), 0, "The wheel scrolls the panel, not the preview iframe");
    assert.equal(await preview.childFrames()[0].evaluate(() => scrollY), 0, "The inner email has no independent scrolling");
    assert(await page.locator("#email-viewport").evaluate((panel) => {
      panel.scrollTop = panel.scrollHeight;
      const bottom = document.getElementById("email-sheet").getBoundingClientRect().bottom;
      return Math.abs(bottom - (panel.getBoundingClientRect().bottom - parseFloat(getComputedStyle(panel).paddingBottom))) < 2;
    }), "The panel scrollbar reaches the bottom of the complete email");
    await page.locator("#email-viewport").evaluate((panel) => { panel.scrollTop = 0; });
  };
  await updated(); // All client thumbnails render automatically, without clicking a call to action.
  assert(await page.locator(".et-output").evaluate((panel) => panel.getBoundingClientRect().top < 160 && panel.getBoundingClientRect().bottom < innerHeight));
  assert(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), "The workspace fits the first viewport");
  assert(await page.locator("#email-html").isVisible(), "HTML is the editor's default and only editing surface");
  assert.equal(await page.locator('[data-design], #email-template, input[type="color"]').count(), 0);
  assert(await page.locator("#email-gallery").isVisible());
  assert.equal(await page.locator(".et-thumbnail").count(), 14);
  assert.equal(await page.locator("#email-sheet iframe").count(), 0, "The overview comes before a full preview");
  const checkThumbnails = async (words) => {
    for (const { client, id } of await page.locator(".et-thumbnail button").evaluateAll((buttons) => buttons.map((button) => ({ client: button.dataset.client, id: button.dataset.preview })))) {
      const selector = `.et-thumbnail:has(button[data-preview="${id}"]) iframe`;
      const thumbnail = await readyPreview(selector);
      const found = JSON.parse(await thumbnail.locator("#email-client-findings").textContent());
      assert.equal(found.client, client, "Each thumbnail actually runs that client's model");
      assert.equal(JSON.parse(await thumbnail.locator("#email-client-config").textContent()).id, id, "The thumbnail uses its own device/computer variant");
      assert(await page.locator(selector).evaluate((iframe) => {
        const box = iframe.getBoundingClientRect();
        const stage = iframe.parentElement.getBoundingClientRect();
        return Math.abs(box.left - stage.left) < 1 && Math.abs(box.width - stage.width) < 1 && box.height >= stage.height;
      }), `${id}: the thumbnail fills its width without artificial side gutters`);
      const text = (await thumbnail.childFrames()[0].locator("body").innerText()).replace(/\s+/g, " ");
      assert(text.includes(words), `${client} thumbnail contains the current email: ${text}`);
      assert.equal(await thumbnail.locator("header.note").evaluate((header) => getComputedStyle(header).display), "none");
      const images = thumbnail.childFrames()[0].locator("img");
      assert.equal(await images.count(), 6, "The full template retains all six original images");
      assert(await images.evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0 && !image.hasAttribute("data-email-client-missing"))), "All sample images load locally in every client");
    }
    assert.equal(await page.locator(".et-client-logo").count(), 14);
    assert.equal(await page.locator(".et-thumb-meta").count(), 0, "No subtext is shown below the client name");
    assert(await page.locator(".et-thumbnail").evaluateAll((cards) => {
      const heights = cards.map((card) => card.getBoundingClientRect().height);
      return Math.max(...heights) - Math.min(...heights) < 1;
    }), "Client cards have equal heights with one- or two-line labels");
    assert(await page.locator(".et-thumbnail").evaluateAll((cards) => cards.every((card) => {
      const label = card.querySelector(".et-thumb-name").getBoundingClientRect();
      return card.getBoundingClientRect().bottom - label.bottom <= 14;
    })), "Cards have no reserved blank space below their labels");
    assert(await page.locator(".et-thumbnail").evaluateAll((cards) => {
      const boxes = cards.map((card) => card.getBoundingClientRect());
      return boxes.every((a, i) => boxes.slice(i + 1).every((b) => a.right <= b.left + 1 || b.right <= a.left + 1 || a.bottom <= b.top + 1 || b.bottom <= a.top + 1));
    }), "Cards and their click targets never overlap when the gallery scrolls");
    assert.equal(new Set(await page.locator(".et-thumb-name").allTextContents()).size, 14, "Every client/device card has a distinct name");
    assert(await page.locator(".et-client-logo").evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0 && image.alt === "")), "Each client has a loaded, decorative logo beside its label");
  };
  await checkThumbnails("MacBook Pro");
  if (process.env.EMAIL_TESTING_SHOTS) {
    await mkdir(process.env.EMAIL_TESTING_SHOTS, { recursive: true });
    await page.screenshot({ path: join(process.env.EMAIL_TESTING_SHOTS, "email-gallery.png"), fullPage: true });
  }
  // The iPhone, Android and other-account Gmail cards open distinct full previews.
  for (const [name, id] of [["Gmail App (iPhone)", "gmail-app.iphone"], ["Gmail App (Android)", "gmail-app"], ["Gmail App (Other accounts)", "gmail-app-other"]]) {
    await page.locator(`.et-thumbnail:has(button[data-preview="${id}"])`).click({ position: { x: 25, y: 40 } });
    assert.equal(await page.locator("#email-sheet iframe").getAttribute("data-preview"), id);
    await readyFrame();
    await page.getByRole("button", { name: "All clients", exact: false }).click();
    assert.equal(await page.evaluate(() => document.activeElement.dataset.preview), id, "Return focus to the exact variant card");
  }
  await page.getByRole("button", { name: "Open Apple Mail (Mac) preview", exact: true }).click();
  const first = await readyFrame();
  assert.equal(await first.locator("header.note").evaluate((header) => getComputedStyle(header).display), "none");
  assert(!await page.locator("#email-gallery").isVisible());
  assert(await page.locator("#email-viewport").isVisible());
  await checkPreviewScrolling();
  if (process.env.EMAIL_TESTING_SHOTS) await page.screenshot({ path: join(process.env.EMAIL_TESTING_SHOTS, "email-full-preview.png"), fullPage: true });
  // Exercise findings with an intentional compatibility issue, independent of the sample's design.
  await page.locator("#email-html").fill(sample.replace("</head>", "<style>body { box-shadow: 0 0 8px #000; }</style></head>"));
  await updated();
  await page.locator("#email-findings summary").click();
  assert(await page.locator("#email-diagnostics li").count() > 0, "The checks expose the injected compatibility issue");
  assert(await page.locator("#email-diagnostics").innerText().then((text) => /box-shadow/i.test(text)));
  await readyFrame();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download report" }).click();
  const saved = await downloadEvent;
  const report = JSON.parse(await readFile(await saved.path(), "utf8"));
  assert(report.ok && report.previews.length === 14 && report.diagnostics.some((d) => d.line > 0));
  assert(report.previews.every((preview) => !Object.hasOwn(preview, "html")));
  await page.locator("#email-findings summary").click();
  // The selected client stays open while direct HTML edits update its full preview.
  const edited = sample.replaceAll("Mover. Maker. Boundary breaker.", "Hello from the HTML editor.");
  await page.locator("#email-html").fill(edited);
  await updated();
  let selected = await readyFrame();
  assert((await selected.childFrames()[0].locator("body").innerText()).includes("Hello from the HTML editor."));
  await page.getByRole("button", { name: "All clients", exact: false }).click();
  assert(await page.locator("#email-gallery").isVisible());
  assert.equal(await page.locator("#email-sheet iframe").count(), 0);
  await checkThumbnails("Hello from the HTML editor.");
  await page.getByRole("button", { name: "Open Gmail (Windows) preview", exact: true }).click();
  assert.equal(await page.locator("#email-sheet iframe").getAttribute("data-preview"), "gmail");
  await readyFrame();
  await page.locator("#email-live").uncheck();
  await page.locator("#email-html").fill(sample);
  await page.waitForTimeout(800);
  assert.equal(await page.locator("[data-email-testing]").getAttribute("data-render-status"), "pending", "Live preview can be paused");
  assert.match(await page.locator("#email-view-title").innerText(), /Changes pending/);
  await page.locator("#email-live").check();
  await updated();
  assert.equal(await page.getByRole("button", { name: "Export HTML" }).count(), 0);
  await page.getByRole("button", { name: "All clients", exact: false }).click();
  await page.getByRole("button", { name: "Open Classic Outlook preview", exact: true }).click();
  assert.equal(await page.locator("#email-sheet iframe").getAttribute("data-preview"), "outlook");
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
  const clients = ["outlook", "outlook-com", "gmail", "gmail-app", "gmail-app-other", "apple-mail", "yahoo", "aol"];
  const all = await page.evaluate((input) => window.__emailTools[0].execute(input), { html: sample, clients, dark: true });
  assert(all.ok, all.error?.message);
  assert(all.previews.length > 12, "The complete selection is not truncated to the original playground's 12-preview limit");
  assert(all.previews.some((p) => p.id === "apple-mail.iphone.dark"));
  assert(all.previews.some((p) => p.client === "yahoo" && p.dark));
  assert(all.previews.some((p) => p.client === "aol" && p.dark));
  assert(all.skipped.some((p) => p.client === "outlook"));
  for (const id of ["gmail", "apple-mail.iphone.dark", "yahoo.dark", "aol.dark"]) {
    await page.getByRole("button", { name: "All clients", exact: false }).click();
    await page.locator(`.et-thumbnail button[data-preview="${id}"]`).click();
    assert.equal(await page.locator("#email-sheet iframe").getAttribute("data-preview"), id);
    await readyFrame();
  }
  assert.equal(new Set(all.previews.map((preview) => preview.id)).size, all.previews.length);
  await page.getByRole("button", { name: "All clients", exact: false }).click();
  assert.equal(await page.locator(".et-thumbnail").count(), 14, "Dark mode retains each device without duplicate light/dark cards");
  assert.equal(await page.getByRole("button", { name: "Open Apple Mail (iPhone) preview", exact: true }).getAttribute("data-preview"), "apple-mail.iphone.dark");
  assert.equal(await page.getByRole("button", { name: "Open Gmail App (iPhone) preview", exact: true }).getAttribute("data-preview"), "gmail-app.iphone");
  await page.getByRole("button", { name: "Open Apple Mail (iPhone) preview", exact: true }).click();
  assert.equal(await page.locator("#email-sheet iframe").getAttribute("data-preview"), "apple-mail.iphone.dark");
  await readyFrame();
  const concurrent = await page.evaluate(async (html) => Promise.all([
    window.hyperElementsEmailTesting.check({ html, clients: ["outlook"] }),
    window.hyperElementsEmailTesting.check({ html, clients: ["apple-mail"] }),
  ]), sample);
  assert.equal(concurrent[0].ok, false);
  assert(concurrent[1].ok);
  assert(concurrent[1].previews.every((preview) => preview.client === "apple-mail"));
  // The email remains data: scripts, handlers, frames and meta redirects cannot act on the parent or make requests.
  const hostile = `<!doctype html><html><head><meta http-equiv="refresh" content="0;url=${origin}/attack"><base href="${origin}/attack"></head><body><p>SAFE_EMAIL_TEXT</p><script>parent.document.body.dataset.emailAttack='yes';fetch('${origin}/attack')</script><svg onload="fetch('${origin}/attack')"></svg><iframe src="${origin}/attack"></iframe></body></html>`;
  const safe = await run({ html: hostile, clients: ["gmail"] });
  assert(safe.ok, safe.error?.message);
  const frame = await readyFrame();
  assert.match(await frame.childFrames()[0].locator("body").innerText(), /SAFE_EMAIL_TEXT/);
  const shortHeight = await frame.locator("#frames").evaluate((content) => Math.ceil(content.getBoundingClientRect().height));
  await page.waitForFunction((height) => document.querySelector("#email-sheet iframe").clientHeight === height, shortHeight);
  assert(shortHeight < 1000, "Replacing a long email with a short one shrinks the preview frame");
  await page.getByRole("button", { name: "All clients", exact: false }).click();
  for (const id of ["gmail", "gmail.mac"]) {
    const hostileThumbnail = await readyPreview(`.et-thumb-image[data-preview="${id}"] iframe`);
    assert.match(await hostileThumbnail.childFrames()[0].locator("body").innerText(), /SAFE_EMAIL_TEXT/);
  }
  assert.equal(await page.evaluate(() => document.body.dataset.emailAttack), undefined);
  assert.equal(attackRequests, 0);
  const frames = await page.locator("iframe").evaluateAll((items) => items.map((f) => ({ sandbox: f.getAttribute("sandbox"), src: f.getAttribute("src"), srcdoc: f.hasAttribute("srcdoc") })));
  assert(frames.every((f) => f.sandbox));
  assert(frames.filter((f) => f.sandbox.includes("allow-same-origin")).every((f) => f.src.startsWith("data:") && !f.srcdoc));
  await page.getByRole("button", { name: "Open Gmail (Windows) preview", exact: true }).click();
  await run({ html: sample, clients });
  await page.getByRole("button", { name: "All clients", exact: false }).click();
  await page.getByRole("button", { name: "Open Classic Outlook preview", exact: true }).click();
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
    await checkPreviewScrolling();
    if (process.env.EMAIL_TESTING_SHOTS && [1440, 390].includes(width)) {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await mkdir(process.env.EMAIL_TESTING_SHOTS, { recursive: true });
      await page.screenshot({ path: join(process.env.EMAIL_TESTING_SHOTS, `email-testing-${width}.png`), fullPage: true });
      await page.locator(".et-output").screenshot({ path: join(process.env.EMAIL_TESTING_SHOTS, `email-testing-preview-${width}.png`) });
    }
  }
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
  assert.equal(await page.locator(".et-thumbnail").count(), 14);
  await checkThumbnails("MacBook Pro");
  if (process.env.EMAIL_TESTING_SHOTS) await page.screenshot({ path: join(process.env.EMAIL_TESTING_SHOTS, "email-gallery-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Open Gmail App (Android) preview", exact: true }).click();
  await readyFrame();
  assert(await page.locator("#email-viewport").isVisible());
  await page.getByRole("button", { name: "All clients", exact: false }).click();
  assert(await page.locator("#email-gallery").isVisible());
  assert.deepEqual(errors, []);
  console.log("Email testing: HTML editor, 14 client/device thumbnails without side gutters, full preview navigation, panel-only scrolling, live updates, client variants, reports, agents, isolation and responsive layout passed.");
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
