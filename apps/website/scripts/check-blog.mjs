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
const sitemap = readFileSync(join(dist, "sitemap-0.xml"), "utf8");
assert(sitemap.includes(`/blog/${slug}</loc>`));
assert(sitemap.includes(`/blog</loc>`));
console.log("Blog integration PASS: index/article routes, heading, description, canonical, social image, structured data, internal links, anchors, hero asset and sitemap.");
console.log("Static checks only: this does not replace browser layout inspection or execute the tutorial examples.");
