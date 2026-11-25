// The template suite's guardrails: what a newsletter must keep of Orbit's brand, measured on the finished HTML in
// headless Chromium. Each failure is a violation that escaped into the email; the harness records them beside the
// email checker's pass (tools/check.mjs). The same checks in every kit (Hyper Elements, React Email, MJML, HTML).
//
//   node tools/guardrails.mjs [--html out/email.html] [--reference tools/brand-reference.json] [--json]
//   node tools/guardrails.mjs --parts      the header's and footer's HTML, normalized, as JSON
//
// - brand header, brand footer: the elements with id (or class) brand-header and brand-footer, their HTML after
//   normalizing generated class names and whitespace, are the kit's reference (tools/brand-reference.json);
// - unsubscribe link: a link to the brand's unsubscribe address;
// - preview text: the brief's preview text, in the document and not shown;
// - link domains, UTM parameter: every http(s) link is on the brand's domains, with its parameters;
// - palette colors: every text's color, and every background drawn, is one of the brand's palette;
// - brand fonts: every text's font is the brand's (the first family its font-family names);
// - image alt: every image has alt text;
// - call to action: the body (outside the header and footer) has a button, a link drawn on a fill of its own.
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const runDir = resolve(here, "..");
const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
};
const json = process.argv.includes("--json");
const htmlPath = resolve(runDir, arg("html", "out/email.html"));
const brand = JSON.parse(await readFile(join(here, "brand.json"), "utf8"));
const spec = existsSync(join(here, "spec.json")) ? JSON.parse(await readFile(join(here, "spec.json"), "utf8")) : {};
const referencePath = resolve(runDir, arg("reference", "tools/brand-reference.json"));
const reference = existsSync(referencePath) ? JSON.parse(await readFile(referencePath, "utf8")) : null;

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail: ok ? "" : detail });

/** The results, for the harness (`--json`) or a person; exit 1 on any violation. */
function finish() {
  const failed = results.filter((r) => !r.ok);
  if (json) console.log(JSON.stringify({ pass: failed.length === 0, total: results.length, failed: failed.length, results }));
  else {
    for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.ok ? "" : ` — ${r.detail}`}`);
    console.log(failed.length ? `\n${failed.length} of ${results.length} guardrails failed.` : `\nAll ${results.length} guardrails held.`);
  }
  process.exit(failed.length ? 1 : 0);
}

if (!existsSync(htmlPath)) {
  check("output exists", false, `${htmlPath} was not found`);
  finish();
}
const html = await readFile(htmlPath, "utf8");
const browser = await chromium.launch({ args: (process.env.BENCH_CHROMIUM_ARGS ?? "").split(" ").filter(Boolean) });
const page = await browser.newPage({ viewport: { width: 800, height: 1000 } });
// Nothing is fetched: an image's own size doesn't change what's checked here.
await page.route("**/*", (route) => (new URL(route.request().url()).host === "email.test" ? route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }) : route.fulfill({ status: 404, body: "" })));
await page.goto("http://email.test/", { waitUntil: "load" });

const measured = await page.evaluate(
  ({ brand, preview }) => {
    const n = (s) => (s || "").replace(/[   ]/g, " ").replace(/\s+/g, " ").trim();
    const shown = (e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && e.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    };
    const part = (name) => document.getElementById(name) ?? document.querySelector(`.${name}`);
    // The HTML a part is written as: its markup without generated class names, whitespace between tags dropped.
    const normal = (e) => {
      if (!e) return null;
      const copy = e.cloneNode(true);
      for (const x of [copy, ...copy.querySelectorAll("*")]) x.removeAttribute("class");
      return copy.outerHTML.replace(/>\s+</g, "><").replace(/\s+/g, " ").trim();
    };
    const header = part(brand.header);
    const footer = part(brand.footer);
    const inParts = (e) => (header && header.contains(e)) || (footer && footer.contains(e));
    const texts = [...document.body.querySelectorAll("*")].filter((e) => shown(e) && [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()));
    const filled = [...document.body.querySelectorAll("*")].filter((e) => {
      const c = getComputedStyle(e).backgroundColor;
      return shown(e) && c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent";
    });
    const all = n(document.body.textContent);
    const links = [...document.querySelectorAll("a[href]")].map((a) => ({ href: a.getAttribute("href"), text: n(a.innerText), body: !inParts(a) }));
    const fillOf = (e) => {
      for (let k = 0, x = e; k < 3 && x; k++, x = x.parentElement) {
        const c = getComputedStyle(x).backgroundColor;
        if (c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent") return c;
      }
      return null;
    };
    return {
      header: normal(header),
      footer: normal(footer),
      links,
      buttons: [...document.querySelectorAll("a[href]")].filter((a) => !inParts(a) && shown(a)).map((a) => ({ text: n(a.innerText), fill: fillOf(a) })),
      colors: texts.map((e) => ({ text: n(e.innerText).slice(0, 40), color: getComputedStyle(e).color })),
      backgrounds: filled.map((e) => ({ tag: e.tagName.toLowerCase(), color: getComputedStyle(e).backgroundColor })),
      fonts: texts.map((e) => ({ text: n(e.innerText).slice(0, 40), family: getComputedStyle(e).fontFamily })),
      images: [...document.images].map((i) => ({ src: i.getAttribute("src") || "", alt: i.getAttribute("alt") })),
      preview: preview ? { present: all.includes(n(preview)), shown: n(document.body.innerText).includes(n(preview)) } : null,
    };
  },
  { brand, preview: spec.preview },
);
await browser.close();

// --parts: the header and footer as written, for a reference (the authoring check's, and tools/brand-reference.json).
if (process.argv.includes("--parts")) {
  console.log(JSON.stringify({ header: measured.header, footer: measured.footer }));
  process.exit(measured.header && measured.footer ? 0 : 1);
}

const rgb = (hex) => {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
};
const palette = new Set(Object.values(brand.palette).map(rgb));
const card = new Set([rgb(brand.palette.card), rgb(brand.palette.page)]);

// The header and footer, as the kit's reference writes them.
for (const part of ["header", "footer"]) {
  const got = measured[part];
  const want = reference?.[part];
  check(`brand ${part}`, got !== null && (!reference || got === want), got === null ? `no element with id ${brand[part]}` : `its HTML isn't the brand's ${part} (${firstDifference(got, want)})`);
}
check("unsubscribe link", measured.links.some((l) => l.href === brand.unsubscribe), `no link to ${brand.unsubscribe}`);
if (measured.preview) check("preview text", measured.preview.present && !measured.preview.shown, measured.preview.present ? "the preview text is shown in the body" : "the preview text is missing");

const web = measured.links.filter((l) => /^https?:/i.test(l.href ?? ""));
const allowed = (host) => brand.domains.some((d) => (d.startsWith("*.") ? host.endsWith(d.slice(1)) && host !== d.slice(2) : host === d));
const off = web.filter((l) => !allowed(new URL(l.href).hostname));
check("link domains", off.length === 0, `links off the brand's domains: ${off.map((l) => l.href).slice(0, 3).join(", ")}`);
const untagged = web.filter((l) => Object.entries(brand.params).some(([k, v]) => new URL(l.href).searchParams.get(k) !== v));
check("UTM parameter", untagged.length === 0, `links without ${Object.entries(brand.params).map(([k, v]) => `${k}=${v}`).join("&")}: ${untagged.map((l) => l.href).slice(0, 3).join(", ")}`);

const offColors = measured.colors.filter((c) => !palette.has(c.color.replace(/rgba\((\d+), (\d+), (\d+), 1\)/, "rgb($1, $2, $3)")));
const offFills = measured.backgrounds.filter((b) => !palette.has(b.color));
check("palette colors", offColors.length === 0 && offFills.length === 0, [...offColors.slice(0, 2).map((c) => `"${c.text}" in ${c.color}`), ...offFills.slice(0, 2).map((b) => `a <${b.tag}> filled ${b.color}`)].join("; "));
const fonts = brand.fonts.map((f) => f.toLowerCase());
const offFonts = measured.fonts.filter((f) => !fonts.includes(f.family.split(",")[0].trim().replace(/^["']|["']$/g, "").toLowerCase()));
check("brand fonts", offFonts.length === 0, offFonts.slice(0, 2).map((f) => `"${f.text}" in ${f.family}`).join("; "));
const noAlt = measured.images.filter((i) => !i.alt || !i.alt.trim());
check("image alt", noAlt.length === 0, `${noAlt.length} image(s) without alt text: ${noAlt.map((i) => i.src).slice(0, 2).join(", ")}`);
check("call to action", measured.buttons.some((b) => b.fill && !card.has(b.fill)), "the body has no button (a link on a fill of its own)");

finish();

/** Where two texts first differ, briefly. */
function firstDifference(a, b) {
  if (!a || !b) return "no reference";
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return `from "…${a.slice(Math.max(0, i - 20), i + 40)}…"`;
}
