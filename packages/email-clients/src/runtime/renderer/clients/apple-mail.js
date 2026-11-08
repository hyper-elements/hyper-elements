/**
 * An email as Apple Mail on a Mac shows it: the HTML Mail's WebKit view draws, for a browser
 * engine to draw. Runs in the browser (DOMParser). What depends on layout (line heights, and the
 * colours in dark mode) is settled in the drawn page: by a script the HTML carries, or, with
 * { script: false }, by settleAppleMail(document, result) once the page has loaded.
 *
 *   appleMail(html, { dark, script = true }) -> { html, mode, dark, changed: { what: count } }
 *   settleAppleMail(document, result)
 *
 * Checked against Mail 16 on macOS 26 (oracle/apple-mail, cases/apple-mail; 211 emails: 99.96% of
 * words within 4px of Mail's, every line break and font size, 99.9% of text colours in dark mode):
 *   - Mail draws the HTML as it is, at the window's width (without its scripts): no wrapper or
 *     margins of its own; text without a font of its own is Helvetica 12px (Mail's message font
 *     setting, by default);
 *   - a line height that isn't a whole number of pixels is rounded down (18px at 1.2 is 21px, not
 *     21.6px): over a long email the difference adds up to tens of pixels;
 *   - an image is sized as written (an image that's an attachment is sized Mail's own way, not
 *     modelled: emails link their images);
 *   - in dark mode (the Mac's appearance, with Mail's "Use dark backgrounds for messages", the
 *     default), what Mail does depends on what the email says about colour schemes:
 *       "filter": nothing (most emails, Elements' too): every colour goes through WebKit's
 *                 invert-lightness filter (the hue turned 180°, then a matrix: white becomes #333,
 *                 black white, mid grays stay near the middle), text and backgrounds alike;
 *                 images aren't touched; a background of exactly black is drawn in Mail's own
 *                 background colour (not what's behind it: cases/apple-mail/dark-white-page); a
 *                 link without a colour of its own is Mail's dark-mode link blue, #419cff;
 *       "own":    it supports dark (color-scheme or supported-color-schemes with "dark"): no filter;
 *                 its prefers-color-scheme: dark rules apply, text without a colour is white, a
 *                 background of exactly white is drawn in Mail's own background colour (assumed
 *                 as for black: the probes can't tell it from dropped), every other colour stays;
 *       "light":  "light" or "light only" (Elements 0.3 says "light"): drawn as in light mode;
 *     where nothing paints, Mail's own background shows: #242a2c.
 */
export const MAIL_DARK_BACKGROUND = "#242a2c";
export const MAIL_DARK_LINK = "#419cff";

// The filter's colour matrix, fitted to Mail's drawn colours (22 backgrounds, 9 text colours,
// within 1/255): applied after turning the hue 180°, with an offset of 1 per channel.
const MATRIX = [
  [-0.769, 0.057, -0.087],
  [0.026, -0.74, -0.087],
  [0.033, 0.053, -0.888],
];

/** A colour (0–255 sRGB) as Mail's dark-mode filter draws it. */
export function invertLightness([r, g, b]) {
  const [h, s, l] = toHsl(r / 255, g / 255, b / 255);
  const turned = fromHsl((h + 180) % 360, s, l);
  return MATRIX.map((row) => Math.round(255 * Math.min(1, Math.max(0, 1 + row[0] * turned[0] + row[1] * turned[1] + row[2] * turned[2]))));
}
function toHsl(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function fromHsl(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r + m, g + m, b + m];
}

/** What the email says about colour schemes: "filter" (nothing), "own" (supports dark) or "light". */
export function colorSchemeMode(doc) {
  const said = [
    ...[...doc.querySelectorAll('meta[name="color-scheme" i], meta[name="supported-color-schemes" i]')].map((m) => m.getAttribute("content") ?? ""),
    ...[...doc.querySelectorAll("style")].flatMap((s) => [...s.textContent.matchAll(/(?:^|[;{\s])(?:supported-)?color-scheme\s*:\s*([^;}!]+)/gi)].map((m) => m[1])),
  ].map((v) => v.toLowerCase());
  if (said.some((v) => /\bdark\b/.test(v))) return "own";
  // "light", with or without "only": Mail draws it as in light mode. Elements 0.3 writes
  // <meta name="color-scheme" content="light"> (and supported-color-schemes), and Mail drew its
  // emails uninverted in dark mode (apple-mail-20261108-012210: white button labels stayed white).
  if (said.some((v) => /\blight\b/.test(v))) return "light";
  return "filter";
}

/**
 * In the drawn page (self-contained, so it can run inside the email's frame as a script): line
 * heights as Mail rounds them, and in dark mode every element's colours as Mail draws them.
 */
function settle(document, mode, matrix, mailBackground, mailLink) {
  const getComputedStyle = (el) => document.defaultView.getComputedStyle(el);
  // Line heights: whole pixels, rounded down. Read all first, as below.
  const heights = [];
  for (const el of document.querySelectorAll("body, body *")) {
    const lh = getComputedStyle(el).lineHeight;
    if (lh.endsWith("px") && !Number.isInteger(parseFloat(lh))) heights.push([el, `${Math.floor(parseFloat(lh))}px`]);
  }
  for (const [el, value] of heights) el.style.setProperty("line-height", value, "important");
  if (mode === "light") return;

  const PROPS = ["color", "background-color", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color", "outline-color", "text-decoration-color", "column-rule-color"];
  const parse = (v) => { const n = v.match(/[\d.]+/g); return n && n.length >= 3 ? [Number(n[0]), Number(n[1]), Number(n[2]), n.length > 3 ? Number(n[3]) : 1] : null; };
  const turn = ([r, g, b]) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
    let rgb = [r, g, b];
    if (d) {
      const s = d / (1 - Math.abs(2 * l - 1));
      const h = ((max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60 + 180) % 360;
      const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
      rgb = (h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]).map((v) => v + m);
    }
    return matrix.map((row) => Math.round(255 * Math.min(1, Math.max(0, 1 + row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2]))));
  };
  // Read everything first: a changed colour would be inherited by what's read after it.
  const writes = [];
  for (const el of document.querySelectorAll("*")) {
    if (["IMG", "SCRIPT", "STYLE", "HEAD", "TITLE", "META", "LINK"].includes(el.tagName)) continue;
    const cs = getComputedStyle(el);
    for (const prop of PROPS) {
      const c = parse(cs.getPropertyValue(prop));
      if (!c || c[3] === 0) continue;
      const exact = (v) => c[0] === v && c[1] === v && c[2] === v && c[3] === 1;
      if (prop === "background-color") {
        if ((mode === "filter" && exact(0)) || (mode === "own" && exact(255))) { writes.push([el, prop, mailBackground]); continue; }
      }
      if (mode !== "filter") continue;
      // A link's colour when it has none of its own (WebKit's #0000ee): Mail's link blue.
      if (prop === "color" && c[0] === 0 && c[1] === 0 && c[2] === 238 && el.closest("a[href]")) { writes.push([el, prop, mailLink]); continue; }
      const [r, g, b] = turn(c);
      writes.push([el, prop, c[3] === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${c[3]})`]);
    }
  }
  for (const [el, prop, value] of writes) el.style.setProperty(prop, value, "important");
  // Where nothing paints, Mail's own background.
  const painted = (el) => (parse(getComputedStyle(el).backgroundColor)?.[3] ?? 0) > 0;
  if (!painted(document.documentElement) && !(document.body && painted(document.body))) document.documentElement.style.setProperty("background-color", mailBackground, "important");
}

const settleArgs = (result) => [result.dark && result.mode !== "light" ? result.mode : "light", MATRIX, MAIL_DARK_BACKGROUND, MAIL_DARK_LINK];

/** Settles a drawn page made with appleMail(html, { script: false }), once it has loaded. */
export function settleAppleMail(document, result) {
  settle(document, ...settleArgs(result));
}

export function appleMail(html, { dark = false, script = true } = {}) {
  const changed = {};
  const doc = new DOMParser().parseFromString(html, "text/html");
  const scripts = doc.querySelectorAll("script");
  if (scripts.length) { for (const s of scripts) s.remove(); changed["scripts (Mail doesn't run them)"] = scripts.length; }
  const mode = dark ? colorSchemeMode(doc) : "light";
  // prefers-color-scheme as Mail's view has it, whatever the machine showing this is set to.
  const scheme = dark && mode !== "light" ? "dark" : "light";
  for (const style of doc.querySelectorAll("style")) {
    const css = style.textContent.replace(/\(\s*prefers-color-scheme\s*:\s*(dark|light)\s*\)/gi, (_, s) => (s.toLowerCase() === scheme ? "(min-width: 0px)" : "(max-width: -1px)"));
    if (css !== style.textContent) { style.textContent = css; changed["prefers-color-scheme rules settled"] = (changed["prefers-color-scheme rules settled"] ?? 0) + 1; }
  }
  // word-break: break-word doesn't make a word breakable when Mail sizes a box to its content:
  // a button narrower than its padding (Elements 0.3 writes it on the email's wrapper) grows to
  // its longest word in Mail, where Chromium and Playwright's WebKit break the label into letters
  // (apple-mail-20261108-012210, e3-fresh/g-0054). Lines still break inside an overlong word, as
  // overflow-wrap: break-word does (Mail's own default).
  let wordBreaks = 0;
  for (const node of doc.querySelectorAll("[style*='word-break']")) {
    const style = node.getAttribute("style").replace(/word-break\s*:\s*break-word\s*(!important)?\s*;?/gi, () => (wordBreaks++, "overflow-wrap:break-word;"));
    node.setAttribute("style", style);
  }
  for (const style of doc.querySelectorAll("style")) style.textContent = style.textContent.replace(/word-break\s*:\s*break-word/gi, () => (wordBreaks++, "overflow-wrap:break-word"));
  if (wordBreaks) changed["word-break: break-word as overflow-wrap (Mail keeps words whole when sizing)"] = wordBreaks;
  // Mail's message font, under the email's own styles.
  const defaults = doc.createElement("style");
  defaults.textContent = "html { font-family: Helvetica; font-size: 12px; }";
  doc.head.prepend(defaults);
  if (dark && mode === "own") {
    const s = doc.createElement("style");
    s.textContent = ":root { color-scheme: dark !important; }"; // over the email's "light dark"
    doc.head.prepend(s);
  }
  if (scheme === "dark") changed[mode === "filter" ? "colours inverted for dark mode" : "white backgrounds made Mail's dark gray"] = 1;
  const result = { mode, dark, changed };
  if (script) {
    const el = doc.createElement("script");
    el.textContent = `(${settle})(document, ...${JSON.stringify(settleArgs(result))});`;
    (doc.body ?? doc.documentElement).append(el);
  }
  return { html: `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`, ...result };
}
