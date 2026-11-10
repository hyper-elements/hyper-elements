// Run after `pnpm --filter @hyper-elements/website build`.
// Static website integration only; never executes the reader's tutorial project.
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
const dist = resolve(fileURLToPath(new URL("../dist/", import.meta.url)));
const index = readFileSync(join(dist, "blog/index.html"), "utf8");
const sitemap = readFileSync(join(dist, "sitemap-0.xml"), "utf8");
const articles = [
  { slug: "react-emails-claude-code", description: "Build a receipt email", hero: "claude-code-email-loop.webp" },
  { slug: "node-pdf-invoices-without-chrome", description: "Build a React invoice PDF", hero: "node-pdf-invoices-workflow.webp" },
];
const pages = new Map();
for (const { slug, description, hero } of articles) {
  const html = readFileSync(join(dist, `blog/${slug}/index.html`), "utf8");
  pages.set(slug, html);
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1, `${slug}: exactly one heading`);
  assert(index.includes(`href="/blog/${slug}"`), `${slug}: missing index link`);
  assert(html.includes(`<meta name="description" content="${description}`), `${slug}: missing description`);
  assert(html.includes(`<link rel="canonical" href="https://www.hyperelements.dev/blog/${slug}"`), `${slug}: missing canonical`);
  assert.match(html, /property="og:type" content="article"/);
  assert(html.includes(`property="og:image" content="https://www.hyperelements.dev/img/blog/${hero}"`), `${slug}: missing social image`);
  assert.match(html, /"@type":"TechArticle"/);
  assert.equal((html.match(/<img\b/g) ?? []).length, 2, `${slug}: hero plus one content image`);
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
  const links = [...new Set([...html.matchAll(/href="([^"#]+|#[^"]+)"/g)].map(m => m[1]))];
  for (const href of links) {
    if (href.startsWith("#")) { assert(ids.has(href.slice(1)), `Missing anchor: ${href}`); continue; }
    if (!href.startsWith("/") || href.startsWith("//")) continue;
    const [target, anchor] = href.split("#");
    let p = resolve(dist, `.${target}`);
    assert(p === dist || p.startsWith(dist + "/"), `Outside site: ${href}`);
    assert(existsSync(p), `Missing internal route: ${href}`);
    if (statSync(p).isDirectory()) p = join(p, "index.html");
    assert(existsSync(p), `Missing internal page: ${href}`);
    if (anchor) assert(readFileSync(p, "utf8").includes(`id="${anchor}"`), `Missing internal anchor: ${href}`);
  }
  assert(existsSync(join(dist, `img/blog/${hero}`)), `${slug}: missing hero asset`);
  assert(sitemap.includes(`/blog/${slug}</loc>`), `${slug}: missing sitemap entry`);
}
assert(sitemap.includes(`/blog</loc>`));

function checkScreenshot(html, { heading, src, alt, width, height }) {
  const section = html.split(`<h2 id="${heading}">`)[1]?.split("<h2")[0];
  assert(section, `Missing section: ${heading}`);
  assert(section.includes(`src="${src}"`), `Missing screenshot: ${src}`);
  assert(section.indexOf(`src="${src}"`) > section.indexOf("</pre>"), "Screenshot must follow the complete template code");
  assert(section.includes(`alt="${alt}`), `Missing screenshot alt: ${src}`);
  assert(section.includes(`width="${width}" height="${height}"`), `Missing screenshot dimensions: ${src}`);
  const bytes = readFileSync(join(dist, src));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", "Screenshot asset must be a PNG");
  assert.equal(bytes.readUInt32BE(16), width);
  assert.equal(bytes.readUInt32BE(20), height);
  return section;
}
const receipt = checkScreenshot(pages.get("react-emails-claude-code"), {
  heading: "what-does-the-complete-receipt-template-look-like", src: "/img/blog/claude-code-receipt-email.png",
  alt: "Rendered Northline Supply receipt", width: 1360, height: 1060,
});
assert.match(receipt, /This is not an inbox compatibility test\./);
const invoiceHtml = pages.get("node-pdf-invoices-without-chrome");
const invoice = checkScreenshot(invoiceHtml, {
  heading: "how-do-i-create-the-first-invoice-pdf", src: "/img/blog/node-pdf-invoice-output.png",
  alt: "Actual invoice PDF output showing fictional Northline Supply", width: 953, height: 560,
});
// The command after the screenshot has its own <pre>, so check exact adjacency separately.
assert.match(invoiceHtml, /<\/pre>\s*<figure[^>]*><img src="\/img\/blog\/node-pdf-invoice-output\.png"/);
assert.match(invoice, /Actual PDF output from the example/);
assert.doesNotMatch(invoiceHtml, /Based on the current PDF output documentation|checked 10 November 2026|not a screenshot of rendered output/);
console.log("Blog integration PASS: both articles' routes, headings, descriptions, canonicals, social images, structured data, internal links/anchors, two images per post, screenshot assets/placement and sitemap.");
console.log("Static checks only: this does not replace browser layout inspection or execute the tutorial examples.");
