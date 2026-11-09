// What the skill suite's checkers share: their results and how they're printed, and an HTML output opened in Chromium
// with the measuring helpers the email checker uses (each text's element, its box, its background).
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";

const assets = process.env.BENCH_ASSETS ?? "__ASSETS__";

/** A checker's results: `check(name, ok, detail)`, then `finish()` prints them (or `--json`) and exits. */
export function reporter() {
  const json = process.argv.includes("--json");
  const results = [];
  const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail: ok ? "" : detail });
  const finish = () => {
    const failed = results.filter((r) => !r.ok);
    if (json) console.log(JSON.stringify({ pass: failed.length === 0, total: results.length, failed: failed.length, results }));
    else {
      for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.ok ? "" : ` — ${r.detail}`}`);
      console.log(failed.length ? `\n${failed.length} of ${results.length} checks failed.` : `\nAll ${results.length} checks passed.`);
    }
    process.exit(failed.length ? 1 : 0);
  };
  return { results, check, finish };
}

export const rgb = (hex) => {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
};

/** A CSS value as given in a spec, as the browser computes it: "#4c3df0" → "rgb(76, 61, 240)", 20 → "20px". */
export const computedOf = (value) => (typeof value === "number" ? `${value}px` : /^#[0-9a-f]{6}$/i.test(value) ? rgb(value) : String(value));

/** Whether a computed value is the one asked: px values within half a pixel, anything else exactly. */
export function same(actual, wanted) {
  const want = computedOf(wanted);
  const px = (v) => (/^-?[\d.]+px$/.test(v ?? "") ? parseFloat(v) : null);
  if (px(want) !== null && px(actual) !== null) return Math.abs(px(want) - px(actual)) <= 0.5;
  return actual === want;
}

const HELPERS = `
  window.__n = (s) => (s || "").replace(/[\\u00a0\\u2007\\u202f]/g, " ").replace(/[\\u2018\\u2019]/g, "'").replace(/[\\u201c\\u201d]/g, '"').replace(/\\s+/g, " ").trim();
  window.__shown = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && e.checkVisibility({ opacityProperty: true, visibilityProperty: true }); };
  // The innermost shown element whose text holds the label: a hidden preview text that happens to contain it isn't it.
  window.__find = (label, within = document.body) => {
    if (label.startsWith("img:")) return [...document.images].find((i) => i.getAttribute("src")?.endsWith("/" + label.slice(4))) || null;
    const want = __n(label);
    const all = [...within.querySelectorAll("*")].filter((e) => __shown(e) && __n(e.innerText).includes(want));
    return all.find((e) => ![...e.children].some((c) => __n(c.innerText).includes(want))) || null;
  };
  window.__textRect = (e) => { const r = document.createRange(); r.selectNodeContents(e); const b = r.getBoundingClientRect(); return { top: b.top + scrollY, left: b.left, right: b.right, bottom: b.bottom + scrollY }; };
  window.__rect = (e) => { const r = e.getBoundingClientRect(); return { top: r.top + scrollY, left: r.left, right: r.right, bottom: r.bottom + scrollY, width: r.width, height: r.height }; };
  window.__fill = (e) => { for (let k = 0, x = e; k < 4 && x; k++, x = x.parentElement) { const c = getComputedStyle(x).backgroundColor; if (c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent") return x; } return null; };
  window.__bg = (e) => { const x = __fill(e); return x ? getComputedStyle(x).backgroundColor : null; };
  // The link or button whose whole text is the label.
  window.__link = (label) => [...document.querySelectorAll("a")].find((x) => __n(x.innerText) === __n(label)) || null;
  // Every element that draws text, in reading order, with the text it draws and its look.
  window.__texts = () => {
    const out = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const t = __n(n.textContent), e = n.parentElement;
      if (!t || !e || !__shown(e)) continue;
      const s = getComputedStyle(e);
      out.push({ text: t, fontSize: s.fontSize, fontWeight: s.fontWeight, color: s.color, backgroundColor: __bg(e) });
    }
    return out;
  };
`;

/**
 * Opens an HTML output in Chromium, at `width` px. The images it names on assets.orbit.dev are served from the run's
 * own copy; nothing else is fetched.
 */
export async function open(file, width = 800) {
  const html = await readFile(file, "utf8");
  // BENCH_CHROMIUM_ARGS: --single-process in the skill suite, so it runs in Claude Code's sandbox (on macOS, Chromium's
  // other processes need a Mach service the sandbox refuses).
  const browser = await chromium.launch({ args: (process.env.BENCH_CHROMIUM_ARGS ?? "").split(" ").filter(Boolean) });
  const page = await browser.newPage({ viewport: { width, height: 1000 } });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.host === "bench.test") return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
    if (url.host === "assets.orbit.dev") {
      const f = join(assets, url.pathname.split("/").pop());
      if (existsSync(f)) return route.fulfill({ status: 200, contentType: "image/png", body: await readFile(f) });
      return route.fulfill({ status: 404, body: "" });
    }
    return route.abort();
  });
  await page.goto("http://bench.test/", { waitUntil: "load" });
  await page.addScriptTag({ content: HELPERS });
  const at = async (w) => {
    await page.setViewportSize({ width: w, height: 1000 });
    await page.waitForTimeout(50);
  };
  return { browser, page, html, at };
}

/** A page's checks of computed styles (`styles`, `hovers`, `gaps`, `hidden`, `bands`), shared by the styles and change checkers. */
export async function styleChecks(page, at, spec, check, prefix = "") {
  for (const s of spec.styles ?? []) {
    await at(s.width);
    const actual = await page.evaluate(({ text, property }) => { const e = __find(text); return e ? getComputedStyle(e).getPropertyValue(property) : null; }, s);
    check(`${prefix}${s.property} of "${s.text}" at ${s.width}px`, actual !== null && same(actual, s.value), actual === null ? "no shown element holds this text" : `${actual}, not ${computedOf(s.value)}`);
  }
  for (const h of spec.hovers ?? []) {
    await at(h.width ?? 1200);
    const found = await page.evaluate((h) => { const a = __link(h.text); if (!a) return false; a.setAttribute("data-bench-hover", h.text); return true; }, h);
    if (!found) { check(`${prefix}hover ${h.property} of "${h.text}"`, false, "no link or button with exactly this text"); continue; }
    await page.hover(`a[data-bench-hover="${h.text}"]`);
    const actual = await page.evaluate((h) => {
      const a = document.querySelector(`a[data-bench-hover="${h.text}"]`);
      if (h.property === "background-color") return __bg(a);
      return getComputedStyle(__find(h.text, a.parentElement) ?? a).getPropertyValue(h.property);
    }, h);
    await page.mouse.move(0, 0);
    check(`${prefix}hover ${h.property} of "${h.text}"`, actual !== null && same(actual, h.value), `${actual ?? "none"} on hover, not ${computedOf(h.value)}`);
  }
  for (const g of spec.gaps ?? []) {
    await at(g.width);
    const gap = await page.evaluate((g) => { const a = __find(g.above), b = __find(g.below); return a && b ? __textRect(b).top - __textRect(a).bottom : null; }, g);
    check(`${prefix}space between "${g.above}" and "${g.below}" at ${g.width}px`, gap !== null && gap >= g.min - 0.5, gap === null ? "one of the texts isn't shown" : `${Math.round(gap)}px, under ${g.min}px`);
  }
  for (const h of spec.hidden ?? []) {
    await at(h.width);
    const shown = await page.evaluate((t) => __n(document.body.innerText).includes(__n(t)), h.text);
    check(`${prefix}"${h.text}" hidden at ${h.width}px`, !shown, "it's shown");
  }
  for (const b of spec.bands ?? []) {
    await at(b.width);
    const band = await page.evaluate(({ text, background }) => {
      for (let x = __find(text); x; x = x.parentElement) {
        if (getComputedStyle(x).backgroundColor !== background) continue;
        const r = x.getBoundingClientRect();
        return { left: r.left, width: r.width, window: document.documentElement.clientWidth };
      }
      return null;
    }, { text: b.text, background: computedOf(b.background) });
    check(`${prefix}band behind "${b.text}" spans the window at ${b.width}px`, band && band.left <= 0.5 && band.width >= band.window - 0.5,
      band ? `its ${b.background} background is ${Math.round(band.width)}px wide from ${Math.round(band.left)}px, in a ${band.window}px window` : `no element behind it has the background ${b.background}`);
  }
}
