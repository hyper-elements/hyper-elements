// The `page` checks: the email checker's copy, links, buttons, images and columns, on out/page.html, at each width the
// spec lists, its column groups side by side or stacked there. Without the email-only checks (600px content, table
// layout, preview text). tools/checks/page/spec.json:
//
//   { "texts": ["…"], "links": [{ "text", "href" }], "buttons": [{ "text", "href", "background" }],
//     "images": ["file.png"], "columns": [["first", "second", …]],
//     "widths": [{ "width": 1200, "layout": "side-by-side" }, { "width": 375, "layout": "stacked" }] }
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { open, reporter, rgb } from "./check-lib.mjs";

const tools = dirname(fileURLToPath(import.meta.url));
const run = resolve(tools, "..");
const spec = JSON.parse(readFileSync(join(tools, "checks/page/spec.json"), "utf8"));
const widths = spec.widths ?? [{ width: 1200, layout: "side-by-side" }, { width: 375, layout: "stacked" }];
const { check, finish } = reporter();
const file = join(run, "out/page.html");
if (!existsSync(file)) {
  check("output exists", false, "out/page.html was not found");
  finish();
}
const { browser, page, html, at } = await open(file, widths[0].width);
check("output exists", html.trim().length > 0, "out/page.html is empty");
const badHrefs = [...html.matchAll(/<a\b[^>]*href=["']([^"']*)["']/gi)].map((m) => m[1]).filter((h) => !/^(https?:|mailto:|tel:)/i.test(h));
check("absolute links", badHrefs.length === 0, `relative or empty hrefs: ${badHrefs.slice(0, 3).join(", ")}`);

// Content, at the first (desktop) width.
const bodyText = await page.evaluate(() => __n(document.body.innerText));
const norm = (s) => s.replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
const missing = (spec.texts ?? []).filter((t) => !bodyText.includes(norm(t)));
check("required copy", missing.length === 0, `missing: ${missing.map((m) => JSON.stringify(m)).join(", ")}`);

for (const b of spec.buttons ?? []) {
  const info = await page.evaluate((b) => {
    const a = __link(b.text);
    if (!a) return null;
    const r = (__fill(a) || a).getBoundingClientRect();
    return { href: a.getAttribute("href"), bg: __bg(a), h: r.height };
  }, b);
  if (!info) { check(`button "${b.text}"`, false, "no link with exactly this text"); continue; }
  const problems = [];
  if (info.href !== b.href) problems.push(`href is ${info.href}`);
  if (b.background && info.bg !== rgb(b.background)) problems.push(`background is ${info.bg ?? "none"}, not ${b.background}`);
  if (info.h < 32) problems.push(`only ${Math.round(info.h)}px tall: a button needs padding`);
  check(`button "${b.text}"`, problems.length === 0, problems.join("; "));
}
for (const l of spec.links ?? []) {
  const href = await page.evaluate((l) => __link(l.text)?.getAttribute("href") ?? null, l);
  check(`link "${l.text}"`, href === l.href, href === null ? "no link with exactly this text" : `href is ${href}`);
}

const imgs = await page.evaluate(() => [...document.images].map((i) => ({ src: i.getAttribute("src") || "", alt: i.getAttribute("alt"), loaded: i.complete && i.naturalWidth > 0 })));
for (const name of spec.images ?? []) {
  const i = imgs.find((x) => x.src.endsWith("/" + name));
  const problems = [];
  if (!i) problems.push("not on the page");
  else {
    if (!i.loaded) problems.push("did not load (check the URL)");
    if (!i.alt || !i.alt.trim()) problems.push("no alt text");
  }
  check(`image ${name}`, problems.length === 0, problems.join("; "));
}
const noAlt = imgs.filter((i) => i.alt === null);
check("every image has alt", noAlt.length === 0, `${noAlt.length} image(s) with no alt attribute`);

// Each width: nothing scrolls sideways, and each column group is laid out as the spec says there.
for (const { width, layout } of widths) {
  await at(width);
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  check(`fits ${width}px`, sw <= width + 1, `scrolls sideways at ${width}px (${sw}px wide)`);
  const placed = await page.evaluate((groups) => groups.map((g) => g.map((l) => { const e = __find(l); return e ? __rect(e) : null; })), spec.columns ?? []);
  (spec.columns ?? []).forEach((g, gi) => {
    const r = placed[gi];
    const name = `columns ${layout === "stacked" ? "stacked" : "side by side"} at ${width}px: ${g.join(" | ")}`;
    if (r.some((x) => !x)) return check(name, false, `not found: ${g.filter((_, i) => !r[i]).join(", ")}`);
    const ok = layout === "stacked"
      ? r.every((x, i) => i === 0 || x.top >= r[i - 1].bottom - 2)
      : r.every((x, i) => i === 0 || (x.left >= r[i - 1].right - 2 && Math.abs(x.top - r[0].top) < 40));
    check(name, ok, layout === "stacked" ? "they are not stacked, top to bottom" : "they are not in one row, left to right");
  });
}

await browser.close();
finish();
