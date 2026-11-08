/**
 * An email as Outlook.com shows it (Outlook on the web, and the new Outlook for Windows, which
 * is the same app): the HTML after Outlook has processed it, for a browser engine to draw. Runs
 * in the browser (DOMParser, CSSOM). What it supports is in support.json, from caniemail
 * (make-support.mjs, profile "outlook-com"); what isn't a plain yes or no follows caniemail's
 * notes, quoted where it's done.
 *
 *   outlookCom(html, { fonts }) -> { html, removed: { what: count } }
 *
 * fonts: where the Selawik files are (renderer/fonts/selawik/, as a URL ending in /): Outlook's
 * message box is its web font "Segoe UI Web (West European)", and Selawik (Microsoft's open font
 * with Segoe UI's metrics) stands in for it under that name. Without it, the browser's fallback.
 *
 * Checked against Outlook on the web (oracle/outlook-com):
 *   - class names and ids are prefixed with x_, and each <style> rule's selectors are kept to
 *     the message by a class Outlook puts round it (.rps_db74 .x_u-row);
 *   - comments are removed with the whitespace on either side that has a line break (the gaps
 *     between Elements' menu items, which have <!--[if mso]> cells between them);
 *   - <body> becomes a <div> that keeps its style; <nav>, <main>, <summary>, <details> (and the
 *     other semantic elements, by caniemail) lose their tags, keeping what's in them;
 *   - removed declarations: position, custom properties and anything using var(), modern
 *     colours (oklch()…), gradients, a negative margin with the rest of the margin; and in
 *     <style>, @supports and selectors with :not() and the like (caniemail);
 *   - the message box is Segoe UI 15px, colour #242424;
 *   - Outlook's page CSS reaches into the message, under the email's own rules (type selectors):
 *     a, div, img, span… get border 0, font: inherit, margin and padding 0, vertical-align:
 *     baseline (which undoes <img align="center">'s middle, so an image alone in a cell has the
 *     usual gap under it); tables font: inherit; cells white-space: normal !important.
 */
import support from "./support.json";

// The class Outlook puts round the message, that its copies of the email's rules start with.
const SCOPE = "rps_oc";
// Outlook on the web's own rules that apply inside a message (its page CSS, October 2026), at
// the specificity of type selectors (:where), before the email's rules.
const PAGE_CSS = `
:where(.outlook-message) :where(a, button, div, form, img, label, span, textarea) { border: 0; font: inherit; margin: 0; padding: 0; vertical-align: baseline; }
:where(.outlook-message) :where(button, div, form, img, label, span, textarea) { color: inherit; }
:where(.outlook-message) :where(table) { font: inherit; }
:where(.outlook-message) td { white-space: normal !important; }`;
const MODERN_COLOR = /\b(?:oklch|oklab|lab|lch|hwb|color|color-mix)\(/i;
// Elements whose tags Outlook removes, keeping what's in them: caniemail's html-semantics ("Only
// <time> is supported"); <nav>, <main>, <summary> and <details> seen (cases/gmail).
const UNWRAPPED = ["article", "aside", "details", "figcaption", "figure", "footer", "header", "main", "mark", "nav", "section", "summary"];
const ATTRIBUTE = /\[[^\]]*\]/;
// "Only supported on type selectors": the pseudo-classes in caniemail's partial notes.
const TYPE_ONLY = /:(?:active|checked|first-child|first-of-type|focus|focus-visible|hover|last-child|last-of-type|link|only-child|only-of-type|target|visited)\b|::?(?:before|after|first-letter|first-line|placeholder)\b/;

// Selawik's files for the weights Outlook loads its Segoe UI web font in.
const SELAWIK = [[300, "selawkl.ttf"], [400, "selawk.ttf"], [600, "selawksb.ttf"], [700, "selawkb.ttf"]];

export function outlookCom(html, { fonts } = {}) {
  const profile = support.profiles["outlook-com"];
  const removed = {};
  const count = (what, n = 1) => { removed[what] = (removed[what] ?? 0) + n; };
  const doc = new DOMParser().parseFromString(html, "text/html");

  // What's declared is read from the style as written (raw), where there is one: the CSSOM
  // writes a shorthand's longhands (border sets border-image) and word-wrap as overflow-wrap,
  // and Outlook removes overflow-wrap but keeps word-wrap.
  const cleanDeclarations = (style, where, raw = style.cssText) => {
    const text = ` ${raw}`;
    const declared = (p) => new RegExp(`[;\\s]${p}\\s*:`, "i").test(text);
    for (const p of profile.properties) if (declared(p)) {
      if (p === "overflow-wrap" && /(^|[;\s])word-wrap\s*:/i.test(raw)) { const keep = style.getPropertyValue("overflow-wrap"); style.removeProperty(p); style.setProperty("word-wrap", keep); }
      else style.removeProperty(p);
      count(`${p} (${where})`);
    }
    for (const name of [...style]) {
      const value = style.getPropertyValue(name).trim();
      if (!style.getPropertyValue(name)) continue; // gone with a margin before it
      if (name.startsWith("--") || /\bvar\(/.test(value)) { style.removeProperty(name); count(`custom properties and var() (${where})`); }
      else if (name === "position") { style.removeProperty(name); count(`position (${where})`); }
      else if (MODERN_COLOR.test(value)) { style.removeProperty(name); count(`modern colours (${where})`); }
      else if (/gradient\(/i.test(value)) { style.removeProperty(name); count(`gradients (${where})`); }
      // A negative margin takes the whole margin with it.
      else if (/^margin(-|$)/.test(name) && /(^|\s)-\d/.test(value)) { for (const m of ["margin", "margin-top", "margin-right", "margin-bottom", "margin-left"]) style.removeProperty(m); count(`negative margin (${where})`); }
    }
  };

  // Selectors: x_ on class names and ids; unsupported parts drop the selector; pseudo-classes
  // only after a type selector ("Only supported on type selectors").
  const prefix = (selector) => selector.replace(/([.#])(-?[_a-zA-Z][\w-]*)/g, "$1x_$2");
  const keepSelector = (selector) => {
    const s = selector.toLowerCase();
    if (profile.selectors.some((part) => s.includes(part))) return false;
    for (const compound of s.split(/[\s>+~]+/)) if (TYPE_ONLY.test(compound) && !/^[a-z]/.test(compound)) return false;
    if (ATTRIBUTE.test(s) && /\.[\w-]+\[/.test(s)) return false; // "Can not be used with a class selector"
    return true;
  };
  const cleanRules = (rules) => {
    const out = [];
    for (const rule of rules) {
      if (rule instanceof CSSStyleRule) {
        const selectors = rule.selectorText.split(",").map((s) => s.trim()).filter(Boolean);
        const good = selectors.filter(keepSelector);
        if (good.length < selectors.length) count("selectors Outlook.com doesn't support", selectors.length - good.length);
        if (!good.length) continue;
        cleanDeclarations(rule.style, "<style>", rule.cssText.slice(rule.cssText.indexOf("{")));
        if (rule.style.length) out.push(`${good.map((g) => `.${SCOPE} ${prefix(g)}`).join(", ")} { ${rule.style.cssText} }`);
      } else if (rule instanceof CSSMediaRule) {
        const condition = rule.media.mediaText;
        if ([...rule.cssRules].some((r) => r instanceof CSSMediaRule)) { count("nested @media"); continue; } // "Does not support nested media queries"
        const inner = cleanRules(rule.cssRules);
        if (inner.length) out.push(`@media ${condition} { ${inner.join(" ")} }`);
      } else {
        const names = { CSSFontFaceRule: "@font-face", CSSKeyframesRule: "@keyframes", CSSSupportsRule: "@supports", CSSImportRule: "@import" };
        count(names[rule.constructor.name] ?? "at-rules Outlook.com doesn't support");
      }
    }
    return out;
  };
  const sheetText = [];
  for (const style of [...doc.querySelectorAll("style")]) {
    const text = style.textContent ?? "";
    style.remove();
    const sheet = new CSSStyleSheet();
    try { sheet.replaceSync(text.replace(/@import[^;]+;/gi, () => { count("@import"); return ""; })); } catch { count("<style> Outlook.com can't read"); continue; }
    sheetText.push(...cleanRules(sheet.cssRules));
  }

  for (const el of doc.querySelectorAll("[style]")) {
    cleanDeclarations(el.style, "inline", el.getAttribute("style"));
    if (!el.style.length) el.removeAttribute("style");
  }
  for (const el of doc.querySelectorAll("[class]")) el.setAttribute("class", el.getAttribute("class").trim().split(/\s+/).map((c) => `x_${c}`).join(" "));
  for (const el of doc.querySelectorAll("[id]")) el.id = `x_${el.id}`;

  // Comments go, with the whitespace on either side of them when it has a line break: between
  // inline-blocks with a comment between (Elements' menu items, its <!--[if mso]> cells) the
  // gap a line break would draw is gone. Other whitespace stays.
  const comments = [];
  for (let walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_COMMENT), c = walker.nextNode(); c; c = walker.nextNode()) comments.push(c);
  const blank = (n) => n?.nodeType === Node.TEXT_NODE && !n.data.trim() && n.data.includes("\n");
  for (const c of comments) {
    for (const side of ["previousSibling", "nextSibling"]) if (blank(c[side])) c[side].remove();
    c.remove();
  }

  for (const tag of profile.elements) for (const el of [...doc.querySelectorAll(tag)]) { el.remove(); count(`<${tag}>`); }
  for (const tag of UNWRAPPED) for (const el of [...doc.querySelectorAll(tag)]) { el.replaceWith(...el.childNodes); count(`<${tag}> (tags removed)`); }
  for (const tag of ["script", "base", "form", "meta", "title"]) for (const el of doc.querySelectorAll(tag)) { el.replaceWith(...(tag === "form" ? el.childNodes : [])); if (!["meta", "title"].includes(tag)) count(`<${tag}>`); }
  for (const attr of profile.attributes) for (const el of doc.querySelectorAll(`[${attr}]`)) { el.removeAttribute(attr); count(`${attr} attribute`); }

  // <body> becomes a <div> that keeps its attributes, in Outlook's message box.
  const message = doc.createElement("div");
  for (const attr of [...doc.body.attributes]) if (!/^on/i.test(attr.name)) message.setAttribute(attr.name, attr.value);
  const bgcolor = doc.body.getAttribute("bgcolor");
  if (bgcolor && !message.style.backgroundColor) message.style.backgroundColor = bgcolor;
  message.append(...doc.body.childNodes);

  const base = "font-family: 'Segoe UI', 'Segoe UI Web (West European)', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', sans-serif; font-size: 15px; color: #242424;";
  const faces = fonts ? SELAWIK.map(([weight, file]) => `@font-face { font-family: "Segoe UI Web (West European)"; src: url("${fonts}${file}"); font-weight: ${weight}; }`).join(" ") : "";
  const out = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${faces} body { margin: 0; } .outlook-message { ${base} } ${PAGE_CSS}</style>${sheetText.length ? `<style>${sheetText.join("\n")}</style>` : ""}</head><body><div class="outlook-message"><div class="${SCOPE}">${message.outerHTML}</div></div></body></html>`;
  return { html: out, removed };
}
