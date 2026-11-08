/**
 * An email as Gmail shows it: the HTML after Gmail has processed it, for a browser engine to
 * draw. Runs in the browser (DOMParser, CSSOM). What a profile supports is in support.json,
 * from caniemail (make-support.mjs); what isn't a plain yes or no follows caniemail's notes,
 * quoted where it's done. Nothing here has been checked against real Gmail yet.
 *
 *   gmailClip(html) -> { kept, cut, clipped, size }
 *   gmail(kept, "gmail-web" | "gmail-app" | "gmail-app-other", { clipped, size }) ->
 *     { html, removed: { what: count }, clipped, size }
 *
 * gmailClip is Gmail's clip on its own: the HTML Gmail keeps (the first 102,400 bytes), the
 * UTF-8 byte offset it cuts at (null when it doesn't clip), whether it clipped and the HTML's
 * size in bytes. gmail() takes the HTML gmailClip kept; given { clipped: true } it adds
 * Gmail's "[Message clipped]" link, and it returns the size it's given (by default kept's).
 *
 * Checked against Gmail on the web (oracle/gmail, run 20261030-200747):
 *   - the message box is Arial 13px, line-height 1.5 (19.5px), colour #222;
 *   - <body>'s style goes to the <div> that replaces it;
 *   - an element Gmail doesn't support has its opening and closing tags each replaced by an
 *     empty <u></u>, its content kept between them (<svg> and what's in it too);
 *   - an uppercase !IMPORTANT removes the whole style attribute, or the whole <style>: the only
 *     one of 20 suspects that drops a <style> (cases/gmail-block; Elements' own <style> is kept);
 *     a negative margin removes the whole margin declaration;
 *   - clipping starts at 102,400 bytes of the HTML as sent;
 *   - list items get a 15px left margin from Gmail's page CSS.
 * Assumed: the apps' message text without a font is the platform's sans-serif at 14px.
 */
import support from "./support.json";

const STYLE_LIMIT = 16 * 1024; // "The size of the <style> tag is limited to 16 KB" (email-bugs#90)
// Gmail clips a message at 102,400 bytes of its HTML as sent: "[Message clipped] View entire
// message" (oracle/gmail: the last line shown is the one that crosses 102,400 bytes).
const CLIP_LIMIT = 102400;
// Elements whose opening and closing tags are each replaced by an empty <u></u>, their content
// kept in between ("Opening and closing tags are replaced by <u></u>").
const U_ELEMENTS = ["picture", "video", "details", "main", "nav", "summary", "source", "track"];
// rgb() with spaces: "when used in the style attribute of an element, the whole attribute is
// stripped. When used inside <style>, the whole <style> block is stripped."
const RGB_SPACES = /rgba?\(\s*[-\d.]+%?\s+[-\d.]/i;
// Modern colour syntax: "Using this syntax for an inline style will remove all inline styles
// applied to that element."
const MODERN_COLOR = /\b(?:oklch|oklab|lab|lch|hwb|color|color-mix)\(/i;
// "!important" in anything but lowercase: Gmail removes the whole style attribute, or the whole
// <style> (oracle/gmail, cases/gmail-block: of 20 suspects, the only one that drops a <style>).
const UPPER_IMPORTANT = (css) => [...css.matchAll(/!\s*important/gi)].some((m) => m[0] !== m[0].toLowerCase());
const HEIGHT_MEDIA = /\(\s*(?:min-|max-)?(?:device-)?height\s*:/i; // "Does not support height based media queries"
const ATTRIBUTE = /\[([^\]]*)\]/g; // "Only supports [attr~=value] syntax. Only class as an attribute name"

/** Gmail's clip: only the first 102,400 bytes of the HTML are shown (the parser closes what's open). */
export function gmailClip(html) {
  const bytes = new TextEncoder().encode(html);
  const size = bytes.length;
  const clipped = size > CLIP_LIMIT;
  return { kept: clipped ? new TextDecoder().decode(bytes.slice(0, CLIP_LIMIT)) : html, cut: clipped ? CLIP_LIMIT : null, clipped, size };
}

/** The HTML gmailClip kept, as Gmail shows it; { clipped, size } from gmailClip. */
export function gmail(html, profileKey = "gmail-web", { clipped = false, size = new TextEncoder().encode(html).length } = {}) {
  const profile = support.profiles[profileKey];
  const removed = {};
  const count = (what, n = 1) => { removed[what] = (removed[what] ?? 0) + n; };
  if (clipped) count("content past 102,400 bytes (clipped)");
  const doc = new DOMParser().parseFromString(html, "text/html");

  // Declarations: what the profile doesn't support goes; negative margins and text indents
  // ("Negative values are not supported"); custom properties ("the var() function is supported,
  // but not the variable declaration").
  const cleanDeclarations = (style, where) => {
    // Only what's declared counts: a shorthand sets its longhands too (border resets
    // border-image, text-decoration sets text-decoration-thickness), but the declaration's own
    // text keeps the shorthand as written.
    const text = ` ${style.cssText}`;
    const declared = (p) => new RegExp(`[;\\s]${p}\\s*:`).test(text);
    for (const p of profile.properties) if (declared(p)) { style.removeProperty(p); count(`${p} (${where})`); }
    for (const name of [...style]) {
      const value = style.getPropertyValue(name).trim();
      if (name.startsWith("--")) { style.removeProperty(name); count(`custom properties (${where})`); }
      // A negative margin takes the whole margin declaration with it.
      else if (/^margin(-|$)/.test(name) && /(^|\s)-\d/.test(value)) { for (const m of ["margin", "margin-top", "margin-right", "margin-bottom", "margin-left"]) style.removeProperty(m); count(`negative margin (${where})`); }
      else if (name === "text-indent" && /(^|\s)-\d/.test(value)) { style.removeProperty(name); count(`negative text-indent (${where})`); }
      else if (name === "display" && profile.displays.includes(value)) { style.removeProperty(name); count(`display: ${value} (${where})`); }
    }
  };

  // <style>: only in <head> ("Not supported inside the <body>"), and not at all in the
  // non-Google app variant; a block too big or with rgb() spaces goes whole.
  const kept = [];
  for (const style of [...doc.querySelectorAll("style")]) {
    const text = style.textContent ?? "";
    const inHead = !!style.closest("head");
    style.remove();
    if (profile.noStyleElement) { count("<style> (no <style> with this account)"); continue; }
    if (!inHead) { count("<style> in <body>"); continue; }
    if (text.length > STYLE_LIMIT) { count("<style> over 16 KB"); continue; }
    if (RGB_SPACES.test(text)) { count("<style> with rgb() spaces"); continue; }
    if (UPPER_IMPORTANT(text)) { count("<style> with an uppercase !IMPORTANT"); continue; }
    kept.push(text);
  }
  const sheetText = [];
  const keepSelector = (selector) => {
    const s = selector.toLowerCase();
    if (profile.selectors.some((part) => (part === "." || part === "#" ? false : s.includes(part)))) return false;
    for (const m of s.matchAll(ATTRIBUTE)) if (!/^\s*class\s*~=/.test(m[1])) return false;
    return true;
  };
  const cleanRules = (rules) => {
    const out = [];
    for (const rule of rules) {
      if (rule instanceof CSSStyleRule) {
        const selectors = rule.selectorText.split(",").map((s) => s.trim()).filter(Boolean);
        const good = selectors.filter(keepSelector);
        if (good.length < selectors.length) count("selectors Gmail doesn't support", selectors.length - good.length);
        if (!good.length) continue;
        cleanDeclarations(rule.style, "<style>");
        if (rule.style.length) out.push(`${good.join(", ")} { ${rule.style.cssText} }`);
      } else if (rule instanceof CSSMediaRule) {
        const condition = rule.media.mediaText;
        if (profile.atRules.includes("media")) { count("@media"); continue; }
        if (HEIGHT_MEDIA.test(condition) || profile.media.some((m) => condition.includes(m))) { count(`@media ${condition}`); continue; }
        const inner = cleanRules(rule.cssRules);
        if (inner.length) out.push(`@media ${condition} { ${inner.join(" ")} }`);
      } else {
        // @font-face, @import, @keyframes, @supports and anything else: not supported.
        const names = { CSSFontFaceRule: "@font-face", CSSKeyframesRule: "@keyframes", CSSSupportsRule: "@supports", CSSImportRule: "@import", CSSPageRule: "@page", CSSLayerBlockRule: "@layer", CSSContainerRule: "@container" };
        count(names[rule.constructor.name] ?? "at-rules Gmail doesn't support");
      }
    }
    return out;
  };
  for (const text of kept) {
    const sheet = new CSSStyleSheet();
    try { sheet.replaceSync(text.replace(/@import[^;]+;/gi, () => { count("@import"); return ""; })); } catch { count("<style> Gmail can't read"); continue; }
    sheetText.push(...cleanRules(sheet.cssRules));
  }

  // Inline styles.
  for (const el of doc.querySelectorAll("[style]")) {
    const raw = el.getAttribute("style");
    if (RGB_SPACES.test(raw) || MODERN_COLOR.test(raw)) { el.removeAttribute("style"); count("style attributes with rgb() spaces or modern colours"); continue; }
    if (UPPER_IMPORTANT(raw)) { el.removeAttribute("style"); count("style attributes with an uppercase !IMPORTANT"); continue; }
    cleanDeclarations(el.style, "inline");
    if (!el.style.length) el.removeAttribute("style");
  }

  // Elements and attributes.
  // Elements Gmail doesn't support: <svg> (and everything in it) and the semantic ones lose
  // their tags to <u></u> pairs; the others go.
  const toU = (el) => {
    for (const child of [...el.children]) toU(child);
    el.replaceWith(doc.createElement("u"), ...el.childNodes, doc.createElement("u"));
  };
  for (const tag of profile.elements) for (const el of [...doc.querySelectorAll(tag)]) {
    if (tag === "svg") toU(el);
    else if (["marquee", "bdi"].includes(tag)) el.replaceWith(...el.childNodes);
    else el.remove();
    count(`<${tag}>`);
  }
  for (const tag of ["script", "base", "form"]) for (const el of doc.querySelectorAll(tag)) { el.replaceWith(...(tag === "form" ? el.childNodes : [])); count(`<${tag}>`); }
  for (const tag of U_ELEMENTS) for (const el of [...doc.querySelectorAll(tag)]) {
    if (!el.isConnected) continue;
    el.replaceWith(doc.createElement("u"), ...el.childNodes, doc.createElement("u"));
    count(`<${tag}> (tags made <u></u>)`);
  }
  for (const attr of profile.attributes) for (const el of doc.querySelectorAll(`[${attr}]`)) { el.removeAttribute(attr); count(`${attr} attribute`); }
  for (const a of doc.querySelectorAll("a[href]")) a.setAttribute("target", "_blank"); // "target=_blank is forced on all links"

  // <body> becomes a <div> ("Replaced by a <div> with supported attributes"), inside Gmail's
  // own message box.
  const message = doc.createElement("div");
  for (const attr of [...doc.body.attributes]) if (!/^on/i.test(attr.name)) message.setAttribute(attr.name, attr.value);
  const bgcolor = doc.body.getAttribute("bgcolor");
  if (bgcolor && !message.style.backgroundColor) message.style.backgroundColor = bgcolor;
  message.append(...doc.body.childNodes);

  const app = profileKey !== "gmail-web";
  const base = app
    ? "font-family: Roboto, -apple-system, 'Helvetica Neue', Arial, sans-serif; font-size: 14px;"
    : "font-family: Arial, Helvetica, sans-serif; font-size: small; line-height: 1.5; color: #222222;";
  // "Applies word-wrap: break-word to all items" (web and Android).
  const wrap = profile.partial["css-word-wrap"] ? "* { word-wrap: break-word; }" : "";
  // Gmail's page CSS gives list items a 15px left margin, under the email's own rules and inline
  // styles (oracle/gmail, holdout-wide: every <li> 15px right of a bare <ul>'s).
  const lists = app ? "" : ".gmail-message li { margin-left: 15px; }";
  let out = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body { margin: 0; } .gmail-message { ${base} } ${lists} ${wrap}</style>${sheetText.length ? `<style>${sheetText.join("\n")}</style>` : ""}</head><body><div class="gmail-message">${message.outerHTML}</div></body></html>`;

  if (clipped) out = out.replace("</body>", '<div style="font: 13px Arial, sans-serif; color: #222; padding: 12px 0;">[Message clipped]&nbsp;&nbsp;<a href="#" style="color:#1a73e8">View entire message</a></div></body>');
  return { html: out, removed, clipped, size };
}
