// Stands in for `playwright` in tools/render.mjs's bundle: the real module, with two things added to every page the
// agent opens. The network is off (a request to http or https fails, as fetch does in every kit: fonts and images
// come from disk, as data: or file: URLs). And each screenshot records the page as tools/check.mjs reads Satori's
// input in the other kits: every text shown, with its computed font, size, weight, style and color, in a tree of
// blocks (an inline element is a span of its block), and the font files the page's @font-face rules load.
import * as real from "playwright";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { fontInfo } from "./font-info.mjs";

export * from "playwright";
export default real.default ?? real;

const shots = [];
globalThis.__benchPlaywright = shots;

/** In the page: its text as a tree, and its @font-face rules. */
function snapshot() {
  const tree = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return null;
    const inline = cs.display === "inline";
    const children = [];
    for (const n of el.childNodes) {
      if (n.nodeType === 3) {
        if (!n.textContent.trim() && !/\s/.test(n.textContent)) continue;
        const r = document.createRange(); r.selectNodeContents(n);
        if (!r.getClientRects().length) continue;
        children.push(n.textContent);
      } else if (n.nodeType === 1 && !["SCRIPT", "STYLE", "IMG", "SVG", "svg", "CANVAS"].includes(n.tagName)) {
        const t = tree(n);
        if (t) children.push(t);
      }
    }
    return {
      type: inline ? "span" : "div",
      style: { fontFamily: cs.fontFamily, fontSize: parseFloat(cs.fontSize), fontWeight: Number(cs.fontWeight), fontStyle: cs.fontStyle === "normal" ? "normal" : "italic", color: cs.color, textTransform: cs.textTransform === "none" ? undefined : cs.textTransform },
      children,
    };
  };
  const faces = [];
  const read = (sheet) => {
    let rules;
    try { rules = sheet.cssRules; } catch { return; }
    for (const r of rules) {
      if (r instanceof CSSFontFaceRule) faces.push({ family: r.style.getPropertyValue("font-family"), weight: r.style.getPropertyValue("font-weight"), style: r.style.getPropertyValue("font-style"), src: r.style.getPropertyValue("src"), base: sheet.href ?? document.baseURI });
      else if (r.styleSheet) read(r.styleSheet);
      else if (r.cssRules) read(r);
    }
  };
  for (const s of document.styleSheets) read(s);
  return { tree: tree(document.body), faces, size: { width: innerWidth, height: innerHeight } };
}

/** The bytes a @font-face src names first (a data: URL, or a file: URL or path), or null. */
function bytesOf(src, base) {
  const m = /url\(\s*(["']?)(.*?)\1\s*\)/.exec(src ?? "");
  if (!m) return null;
  const url = m[2];
  if (url.startsWith("data:")) {
    const comma = url.indexOf(",");
    const meta = url.slice(5, comma), body = url.slice(comma + 1);
    return meta.endsWith(";base64") ? Buffer.from(body, "base64") : Buffer.from(decodeURIComponent(body));
  }
  try { return readFileSync(fileURLToPath(new URL(url, base && !base.startsWith("about:") ? base : "file:///"))); } catch {}
  try { return readFileSync(url); } catch {}
  return null;
}

async function record(page) {
  try {
    const s = await page.evaluate(snapshot);
    const fonts = [];
    for (const f of s.faces) {
      const data = bytesOf(f.src, f.base);
      const info = data ? fontInfo(data) : { format: "none", sha256: null };
      const weight = Number(String(f.weight || "400").replace("normal", "400").replace("bold", "700").split(/\s+/)[0]) || 400;
      fonts.push({ name: f.family.replace(/^["']|["']$/g, ""), weight, style: /italic|oblique/.test(f.style) ? "italic" : "normal", format: info.format, sha256: info.sha256 });
    }
    shots.push({ engine: "playwright", width: s.size.width, height: s.size.height, fonts, tree: s.tree });
  } catch (e) { shots.push({ engine: "playwright", error: String(e?.message ?? e) }); }
}

const offline = async (target) => target.route(/^https?:/, (route) => route.abort("internetdisconnected"));
const patched = new WeakSet();
function patchPage(page) {
  if (patched.has(page)) return page;
  patched.add(page);
  const shot = page.screenshot.bind(page);
  page.screenshot = async (...a) => { await record(page); return shot(...a); };
  // A locator's or an element's screenshot records its page.
  const loc = Object.getPrototypeOf(page.locator("body"));
  if (!patched.has(loc)) {
    patched.add(loc);
    const orig = loc.screenshot;
    loc.screenshot = async function (...a) { await record(this.page()); return orig.apply(this, a); };
  }
  return page;
}
function patchContext(ctx) {
  if (patched.has(ctx)) return ctx;
  patched.add(ctx);
  const ready = offline(ctx);
  const newPage = ctx.newPage.bind(ctx);
  ctx.newPage = async (...a) => { await ready; return patchPage(await newPage(...a)); };
  ctx.on("page", (p) => patchPage(p));
  return ctx;
}
function patchBrowser(browser) {
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (...a) => patchContext(await newContext(...a));
  browser.newPage = async (...a) => { const ctx = await browser.newContext(...a); const page = await ctx.newPage(); return page; };
  return browser;
}
for (const name of ["chromium", "firefox", "webkit"]) {
  const type = real[name];
  if (!type) continue;
  const launch = type.launch.bind(type);
  type.launch = async (...a) => patchBrowser(await launch(...a));
  const persistent = type.launchPersistentContext?.bind(type);
  if (persistent) type.launchPersistentContext = async (...a) => patchContext(await persistent(...a));
}

export function traceOf() {
  const last = shots.at(-1) ?? null;
  return last ? { ...last, screenshots: shots.length } : null;
}

globalThis.__benchTraceOf = traceOf;
