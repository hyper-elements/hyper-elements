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
assert.match(html, /<title>Test HTML emails across email clients/);
assert.match(html, /rel="canonical" href="https:\/\/www.hyperelements.dev\/email-testing"/);
assert.match(html, /name="description" content="Test HTML email compatibility/);
assert.match(html, /href="\/email-testing" aria-current="page"/);
assert(!html.includes('content="noindex"'));
for (const name of ["llms.txt", "llms-full.txt", "sitemap-0.xml", "index.html"]) {
  assert((await readFile(join(dist, name), "utf8")).includes("/email-testing"), `${name} links the email testing page`);
}
assert(JSON.parse(await readFile(join(dist, "search.json"), "utf8")).some((item) => item.href === "/email-testing"));
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".txt": "text/plain", ".wasm": "application/wasm" };
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
  const readyFrame = async () => {
    const frame = await page.locator("#email-sheet iframe").elementHandle().then((handle) => handle.contentFrame());
    await frame.waitForFunction(() => document.documentElement.hasAttribute("data-email-client-ready"), undefined, { timeout: 20000 });
    const findings = await frame.locator("#email-client-findings").textContent().then(JSON.parse);
    assert.equal(findings.error, null, JSON.stringify(findings));
    // External stand-in fonts are deliberately blocked in this offline check.
    assert(["ok", "incomplete"].includes(findings.ready));
    assert(frame.childFrames().length >= 2, "The modeled email and its baseline were drawn");
    return frame;
  };
  await page.getByRole("button", { name: "Test email", exact: false }).click();
  await page.waitForFunction(() => document.getElementById("email-status").textContent.includes("previews generated"));
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
  // New state invalidates the displayed result and its downloadable report immediately.
  await page.locator("#email-html").fill("<p>A fragment</p>");
  assert.equal(await page.locator("#email-sheet iframe").count(), 0);
  assert(await page.locator("#email-download").isDisabled());
  assert.equal((await run({ html: "<p>A fragment</p>" })).ok, false);
  assert.match(await page.locator("#email-error").innerText(), /whole email/);
  assert.equal((await run({ html: sample, clients: [] })).ok, false);
  assert.equal((await run({ html: sample, clients: ["unknown"] })).ok, false);
  assert.equal((await run({ html: "x".repeat(250001) })).ok, false);
  assert.equal((await run({ html: sample, dark: "yes" })).ok, false);
  // Upload the same complete email through the visible file workflow.
  await page.locator("#email-file").setInputFiles({ name: "welcome.html", mimeType: "text/html", buffer: Buffer.from(sample) });
  await page.waitForFunction(() => document.getElementById("email-status").textContent.includes("Opened welcome.html"));
  assert.equal(await page.locator("#email-html").inputValue(), sample);
  assert.match(await page.locator("#email-status").innerText(), /Opened welcome.html/);
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
  assert.equal(await page.evaluate(() => document.body.dataset.emailAttack), undefined);
  assert.equal(attackRequests, 0);
  const frames = await page.locator("iframe").evaluateAll((items) => items.map((f) => ({ sandbox: f.getAttribute("sandbox"), src: f.getAttribute("src"), srcdoc: f.hasAttribute("srcdoc") })));
  assert(frames.every((f) => f.sandbox));
  assert(frames.filter((f) => f.sandbox.includes("allow-same-origin")).every((f) => f.src.startsWith("data:") && !f.srcdoc));
  await run({ html: sample, clients: defaultClients() });
  await readyFrame();
  for (const width of [1440, 1100, 1024, 900, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForFunction(() => {
      const frame = document.querySelector("#email-sheet iframe");
      const panel = document.getElementById("email-viewport");
      return frame.clientWidth === 820 && Math.abs(frame.getBoundingClientRect().width - Math.min(820, panel.clientWidth)) < 1;
    });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `No horizontal page overflow at ${width}px`);
    const overlaps = await page.evaluate(() => {
      const nav = document.querySelector(".main-nav");
      return getComputedStyle(nav).display !== "none" && nav.getBoundingClientRect().right > document.querySelector(".header-actions").getBoundingClientRect().left + 1;
    });
    assert(!overlaps, `Header navigation fits at ${width}px`);
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
  await page.getByRole("button", { name: "Example", exact: true }).click();
  assert.equal(await page.locator("#email-html").inputValue(), sample);
  await page.reload();
  assert.equal(await page.locator("#email-html").inputValue(), sample, "A submitted email is not persisted");
  assert.deepEqual(errors, []);
  console.log("Email testing: discovery, previews, client variants, findings, upload, JSON, agents, hostile HTML and responsive layout passed.");
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
function defaultClients() { return ["outlook", "gmail", "apple-mail"]; }
