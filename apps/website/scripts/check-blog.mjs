// Run after `pnpm --filter @hyper-elements/website build`.
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
const dist = resolve(fileURLToPath(new URL("../dist/", import.meta.url)));
const slug = "react-emails-claude-code";
const index = readFileSync(join(dist, "blog/index.html"), "utf8");
const html = readFileSync(join(dist, `blog/${slug}/index.html`), "utf8");
assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
assert.match(index, new RegExp(`href="/blog/${slug}"`));
assert.match(html, /<meta name="description" content="Build a receipt email/);
assert.match(html, new RegExp(`<link rel="canonical" href="https://hyperelements.dev/blog/${slug}"`));
assert.match(html, /property="og:type" content="article"/);
assert.match(html, /property="og:image" content="https:\/\/hyperelements.dev\/img\/blog\/claude-code-email-loop.webp"/);
assert.match(html, /Illustrated authoring loop/);
assert.match(html, /"@type":"TechArticle"/);
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
const links = [...new Set([...html.matchAll(/href="([^"#]+|#[^"]+)"/g)].map(m => m[1]))];
for (const href of links) {
  if (href.startsWith("#")) { assert(ids.has(href.slice(1)), `Missing anchor: ${href}`); continue; }
  if (!href.startsWith("/") || href.startsWith("//")) continue;
  const target = href.split("#")[0];
  let p = resolve(dist, `.${target}`);
  assert(p === dist || p.startsWith(dist + "/"), `Outside site: ${href}`);
  assert(existsSync(p), `Missing internal route: ${href}`);
  if (statSync(p).isDirectory()) p = join(p, "index.html");
  assert(existsSync(p), `Missing internal page: ${href}`);
}
assert(existsSync(join(dist, "img/blog/claude-code-email-loop.webp")));

const receiptSrc = "/img/blog/claude-code-receipt-email.png";
const receiptSection = html.split('<h2 id="what-does-the-complete-receipt-template-look-like">')[1]?.split("<h2")[0];
assert(receiptSection, "Missing complete receipt section");
assert.match(receiptSection, /<\/h2>\s*<figure\b/, "Receipt screenshot must follow the heading");
assert(receiptSection.includes(`src="${receiptSrc}"`), "Missing receipt screenshot");
assert(receiptSection.indexOf(`src="${receiptSrc}"`) < receiptSection.indexOf("<pre"), "Receipt screenshot must precede the template code");
assert.match(receiptSection, /alt="Rendered Northline Supply receipt/);
assert.match(receiptSection, /width="1360" height="1060"/);
assert.match(receiptSection, /This is not an inbox compatibility test\./);
const receiptBytes = readFileSync(join(dist, receiptSrc));
assert.equal(receiptBytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", "Receipt asset must be a PNG");
assert.equal(receiptBytes.readUInt32BE(16), 1360);
assert.equal(receiptBytes.readUInt32BE(20), 1060);

const sitemap = readFileSync(join(dist, "sitemap-0.xml"), "utf8");
assert(sitemap.includes(`/blog/${slug}</loc>`));
assert(sitemap.includes(`/blog</loc>`));
console.log("Blog integration PASS: index/article routes, heading, description, canonical, social image, structured data, internal links, anchors, hero asset, receipt screenshot placement/asset and sitemap.");
console.log("Static checks only: this does not replace browser layout inspection or execute the tutorial examples.");
