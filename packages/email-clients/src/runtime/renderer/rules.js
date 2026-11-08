/**
 * Rules that make Chromium lay an email out the way classic Outlook does, applied to a page
 * after conditional comments are resolved (conditional.mjs). An ES module that runs in a
 * browser, with no Node APIs: everything it reads comes from the window it's given, so a script
 * in one page can apply it to a frame's window. The scorers load it as a classic script
 * (rules-script.mjs), which defines window.createOutlookRules.
 *
 *   createOutlookRules(win, { deviceScale = 2, squeeze, hang } = {})
 *     -> { apply(without = [], with_ = []), missingFonts(), names }
 *   apply() -> { applied: [rule names], breaks: [{ block, word, margin }] }
 *
 * deviceScale is the screen's device pixels per CSS px (192 DPI: 2, 96 DPI: 1); squeeze and
 * hang tune the line-breaks rule (score.mjs --tune). Each of `breaks` is a line break the
 * line-breaks rule made, in document order: the block it's in, the word it put on a new line,
 * and margin, by Word's rule how much more room the line needed for the word to stay on it, as
 * a negative number of CSS px (0: it missed by nothing); null for a break kept from Chromium's
 * own layout (centered text, a block with an image or inline box in its text).
 *
 * Every rule comes from a capture of real Outlook (oracle/CALIBRATION.md names the case);
 * one marked "assumed" isn't measured yet. A rule can be switched off to measure what it does
 * (score.mjs --without <name>).
 */
export function createOutlookRules(win, options = {}) {
  // The window's own, so the rules work on a frame's document from a script outside it.
  const document = win.document;
  const getComputedStyle = (el) => win.getComputedStyle(el);
  const { NodeFilter, Node, CSSMediaRule } = win;
  const DEVICE = options.deviceScale ?? 2; // device pixels per CSS px (192 DPI: 2)

  // Fonts on the capture machine (oracle check.ps1), plus the cloud fonts Office downloaded.
  const WINDOWS_FONTS = [
    "Arial", "Calibri", "Georgia", "Verdana", "Tahoma", "Times New Roman", "Trebuchet MS",
    "Courier New", "Segoe UI", "Segoe UI Emoji", "Aptos", "Inter",
  ];
  // Names Windows draws with another font.
  const WINDOWS_ALIASES = { helvetica: "Arial", "helvetica neue": "Arial" };
  const GENERIC = { "sans-serif": "Arial", serif: "Times New Roman", monospace: "Courier New" };
  // What this machine draws a Windows font with when it doesn't have it.
  const LOCAL_STAND_IN = {
    "Segoe UI": "Helvetica Neue", Aptos: "Aptos Stand-in", Calibri: "Helvetica Neue",
    Inter: "Helvetica Neue", "Segoe UI Emoji": "Apple Color Emoji",
  };
  const DEFAULT_FONT = "Aptos"; // Word's Normal and Heading styles (paragraph, web-font, examples)
  const UNSET = "outlook-unset-font";

  const px = (value) => (value && /px$/.test(value.trim()) ? parseFloat(value) : null);

  /** The family Outlook draws with: the first in the stack that Windows has. */
  function windowsFamily(stack) {
    for (const raw of stack.split(",")) {
      const name = raw.trim().replace(/^["']|["']$/g, "");
      const lower = name.toLowerCase();
      if (lower === UNSET) return DEFAULT_FONT;
      if (WINDOWS_ALIASES[lower]) return WINDOWS_ALIASES[lower];
      if (GENERIC[lower]) return GENERIC[lower];
      const known = WINDOWS_FONTS.find((f) => f.toLowerCase() === lower);
      if (known) return known;
    }
    return "Times New Roman";
  }

  const rules = {
    /**
     * Word ignores a div's own sizes and layout: Elements' column divs (min-width: 600px,
     * display: table-cell) made Chrome widen every table, while Word kept them at the width
     * the tables declare, widened only by content that can't shrink, like a 520px image
     * (Airbnb: rows 620px wide in Outlook, on screen too; emails without images keep 600px).
     * A div's padding, sizes (width, min-width, max-width) and display are dropped; its background becomes the paragraph's shading,
     * across the whole width (div-padding).
     */
    "div-box": (doc) => {
      for (const el of doc.querySelectorAll("div")) {
        el.style.setProperty("padding", "0", "important");
        el.style.setProperty("width", "auto", "important");
        el.style.setProperty("max-width", "none", "important");
        el.style.setProperty("min-width", "0", "important");
        // Word has no table or inline-block divs: a div is a block of paragraphs.
        if (getComputedStyle(el).display !== "none") el.style.setProperty("display", "block", "important");
      }
    },

    /**
     * Word doesn't draw CSS letter spacing. It keeps it in its model (2px becomes w:spacing 30
     * twips), but neither lays text out nor draws it with it: the distance between neighbouring
     * words, Outlook's over the render's, is 0.864 for 2px, 0.928 for 1px and 1.051 for -0.5px
     * (1.001 for text without; error-study.mjs BY_SPACING, the fresh captures at 96 and 192 DPI).
     */
    "no-letter-spacing": (doc) => {
      const style = doc.createElement("style");
      style.textContent = "* { letter-spacing: normal !important; }";
      doc.head.append(style);
    },

    /**
     * Word never breaks inside a word to fit a line (Elements asks for it: word-break and
     * overflow-wrap break-word on every cell). So a cell can't be narrower than its longest
     * word, and when a row's declared widths don't fit, Word shrinks the cells with long words
     * less: columns-study.mjs.
     */
    "no-break-word": (doc) => {
      const style = doc.createElement("style");
      style.textContent = "* { word-break: normal !important; overflow-wrap: normal !important; }";
      doc.head.append(style);
    },

    /**
     * A table without a cellspacing attribute: browsers put 2px between and around its cells.
     * Word has none across (Airbnb's heading wrappers: 520px in Word, 516px in Chrome) but
     * keeps the 2px down (Stripe drifts 3px per block without it). The 1px default cell
     * padding stays (Word: 0.75pt).
     */
    "default-cell-spacing": (doc) => {
      for (const el of doc.querySelectorAll("table:not([cellspacing])")) el.style.setProperty("border-spacing", "0 2px", "important");
    },

    /** A cell's width includes its padding (td-padding). */
    "cell-width-includes-padding": (doc) => {
      for (const el of doc.querySelectorAll("td, th")) el.style.setProperty("box-sizing", "border-box", "important");
    },

    /** A 100% table with a max-width in px becomes a table of that width (max-width). */
    "table-max-width": (doc) => {
      for (const el of doc.querySelectorAll("table")) {
        const max = px(el.style.maxWidth);
        const full = el.style.width === "100%" || el.getAttribute("width") === "100%";
        if (max && full) {
          el.style.setProperty("width", `${max}px`, "important");
          el.removeAttribute("width");
        }
      }
    },

    /**
     * An image's size comes from its width attribute; without one it shows at its natural
     * size, whatever its CSS says (img-css-width, img-width-attr).
     */
    "image-size": (doc) => {
      for (const el of doc.querySelectorAll("img")) {
        for (const p of ["width", "height", "max-width", "min-width"]) el.style.removeProperty(p);
        const width = parseFloat(el.getAttribute("width"));
        const height = parseFloat(el.getAttribute("height"));
        if (width) el.style.setProperty("width", `${width}px`, "important");
        else el.style.setProperty("width", "auto", "important");
        if (height) el.style.setProperty("height", `${height}px`, "important");
        else el.style.setProperty("height", "auto", "important");
        el.style.setProperty("max-width", "none", "important");
      }
    },

    /**
     * Word has no inline-blocks: a link or span is a run of text, without padding or a box of
     * its own, whatever its display (holdout-wide menus: items 24px apart, the 12px padding of the cells either side,
     * not 48px with the links' own 12px).
     */
    "inline-box": (doc) => {
      for (const el of doc.body.querySelectorAll("a, span, b, strong, em, i, u, font, small, big, sub, sup, s, strike, code, label, abbr")) {
        // Whatever its display: Elements 0.3's button links are display: block with the
        // button's padding, which Word drops (it reads the cell's mso-padding-alt instead;
        // e3-fresh/g-0054's column kept its 181px).
        const display = getComputedStyle(el).display;
        if (display === "none") continue;
        el.style.setProperty("padding", "0", "important");
        if (display !== "inline") el.style.setProperty("display", "inline", "important");
      }
    },

    /**
     * Word reads mso-padding-alt as the element's padding, in place of padding (Elements 0.3's
     * buttons: a cell with mso-padding-alt around a link whose own padding Word drops; their
     * labels were 12px and 16px lower in Outlook than without it, e3-holdout/g-1003).
     */
    "mso-padding-alt": (doc) => {
      for (const el of doc.body.querySelectorAll("[data-outlook-style*='mso-padding-alt']")) {
        const m = /mso-padding-alt\s*:\s*([^;"]+)/i.exec(el.getAttribute("data-outlook-style"));
        if (m) el.style.setProperty("padding", m[1].trim(), "important");
      }
    },

    /**
     * A VML button is a shape of its own size, whatever the HTML button inside it does:
     * 120 x 45 in Elements, its label in Aptos, wrapping inside the shape's text box
     * (0.1in by 0.05in inset) and cut off at its edge (the examples' buttons).
     */
    "vml-buttons": (doc) => {
      for (const shape of [...doc.getElementsByTagName("v:roundrect")]) {
        const style = Object.fromEntries(
          (shape.getAttribute("style") ?? "").split(";").map((d) => d.split(":").map((s) => s.trim())).filter((d) => d[0]),
        );
        const width = px(style.width) ?? 120;
        const height = px(style.height) ?? 45;
        const arc = parseFloat(shape.getAttribute("arcsize") ?? "0") / 100;
        const box = doc.createElement("div");
        box.setAttribute("data-outlook", "vml-button");
        Object.assign(box.style, {
          display: "inline-block", boxSizing: "border-box", verticalAlign: "top",
          width: `${width}px`, height: `${height}px`, padding: "4.8px 9.6px",
          borderRadius: `${arc * Math.min(width, height)}px`, background: shape.getAttribute("fillcolor") ?? "transparent",
        });
        // The label is centred when it fits; one taller than the button starts at the top
        // inset, and what doesn't fit is cut off at the bottom inset (fresh captures: a
        // two-line label's first line 5.5px below the button's top, its second cut through).
        const clip = doc.createElement("div");
        Object.assign(clip.style, {
          display: "flex", justifyContent: "center", height: "100%", overflow: "hidden",
          alignItems: style["v-text-anchor"] === "top" ? "flex-start" : "safe center",
        });
        box.append(clip);
        const label = doc.createElement("div");
        label.style.cssText = "width:100%;text-align:center;line-height:normal";
        // The label keeps its size, weight and color, but not its padding or font family.
        const source = shape.querySelector("a") ?? shape;
        const computed = getComputedStyle(source);
        Object.assign(label.style, {
          fontSize: computed.fontSize, fontWeight: computed.fontWeight,
          color: getComputedStyle(shape.querySelector("center") ?? shape).color || computed.color,
          fontFamily: `"${DEFAULT_FONT}", "${LOCAL_STAND_IN[DEFAULT_FONT]}"`,
        });
        label.textContent = (shape.textContent ?? "").replace(/\s+/g, " ").trim();
        clip.append(label);
        shape.replaceWith(box);
      }
    },

    /**
     * Each run of text is drawn in the first family of its stack that Windows has; a heading
     * without its own font family, and text with none at all, use Aptos (Word's styles), and
     * don't inherit the cell's (examples: headings in Aptos, paragraphs in Segoe UI).
     */
    fonts: (doc) => {
      const marker = doc.createElement("style");
      marker.textContent = `html { font-family: ${UNSET} }`;
      doc.head.prepend(marker);
      // In document order, so an element inside a heading inherits the heading's decision.
      for (const el of doc.body.querySelectorAll("*")) {
        if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        const family = /^H[1-6]$/.test(el.tagName) && !el.style.fontFamily
          ? DEFAULT_FONT
          : windowsFamily(getComputedStyle(el).fontFamily);
        const standIn = LOCAL_STAND_IN[family];
        el.style.setProperty("font-family", `"${family}"${standIn ? `, "${standIn}"` : ""}`, "important");
      }
      marker.remove();
      for (const el of doc.body.querySelectorAll("*")) {
        if (el.style.fontFamily) continue;
        if (getComputedStyle(el).fontFamily.includes(UNSET)) el.style.fontFamily = `"${DEFAULT_FONT}", "${LOCAL_STAND_IN[DEFAULT_FONT]}"`;
      }
    },

    /**
     * Font sizes in half points: Word rounds each to the nearest half point, a half up (13px,
     * 9.75pt, is 10pt in Word; 15px is 11.5pt; 11px is 8.5pt: every word's size in the fresh
     * captures and 233037, error-study.mjs SIZES). Runs before the rules that measure text.
     */
    "font-size": (doc) => {
      const sizes = [];
      for (const el of doc.body.querySelectorAll("*")) {
        const px = parseFloat(getComputedStyle(el).fontSize);
        const word = (Math.round(px * 0.75 * 2) / 2) / 0.75;
        if (Math.abs(word - px) > 0.01) sizes.push([el, word]);
      }
      // Read every element before changing any: font-size is inherited.
      for (const [el, word] of sizes) el.style.setProperty("font-size", `${word}px`, "important");
    },

    /**
     * Line height, as Word stores it (Stripe's model, calibration line-height):
     *   none, "normal" or a unitless number (1.4)   dropped: single spacing; but a whole number
     *                                                from 2 up is kept as that many lines
     *                                                (props/paragraph-lineHeight-2: "double";
     *                                                1.5 dropped; 2.5 and 3 not yet captured)
     *   a percentage (125%)                          a multiple of single spacing
     *   px (40px)                                    at least that; exactly with mso-line-height-rule: exactly
     * Single spacing is the font's Windows ascent + descent at the size, rounded to device
     * pixels, plus 1 CSS px (2 device pixels at 192 DPI, 1 at 96): Word's box for every word of a
     * single-spaced paragraph in the captures (singles in error-study.mjs). It's a constant
     * added, not a ratio, so a 36px heading's line is relatively shorter than 12px text's.
     * Ascent + descent per em: from the font files where they match (Arial, Georgia, Tahoma,
     * Verdana, Segoe UI), else fitted to the captures (Aptos, Inter, Trebuchet MS, Courier New,
     * Times New Roman). Aptos's fit is its typo metrics (1.2207), which its USE_TYPO_METRICS
     * flag says to use; Trebuchet MS's and Courier New's match neither their Windows metrics
     * nor their typo metrics (windows-fonts.mjs; Windows' copies have the Mac's numbers).
     * Word draws the text at the top of a line its spacing makes taller, with what the
     * multiple adds below; CSS centers it. So a block with a multiple has its text drawn that
     * half higher (compared by ink in score.mjs; by boxes it looked wrong, because Word's box
     * for a word is its whole line).
     * Runs after "fonts", which decides the family.
     */
    "line-height": (doc) => {
      const ASCENT_DESCENT = {
        "Segoe UI": 1.3308, Arial: 1.1172, Inter: 1.176, Aptos: 1.222, Georgia: 1.1387, Verdana: 1.2153, Tahoma: 1.2075,
        "Times New Roman": 1.112, "Trebuchet MS": 1.2558, "Courier New": 1.0735, Calibri: 1.2207, "Segoe UI Emoji": 1.3308,
      };
      const singleLine = (family, size) => (Math.round((ASCENT_DESCENT[family] ?? 1.15) * size * DEVICE) + DEVICE) / DEVICE;
      const declared = (el) => {
        for (let e = el; e && e !== doc.documentElement; e = e.parentElement) {
          if (e.style.lineHeight) return { value: e.style.lineHeight, exact: /mso-line-height-rule:\s*exactly/i.test(e.getAttribute("data-outlook-style") ?? e.getAttribute("style") ?? "") };
        }
        return null;
      };
      const decisions = [];
      for (const el of doc.body.querySelectorAll("*")) {
        if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        const style = getComputedStyle(el);
        const family = style.fontFamily.split(",")[0].trim().replace(/^["']|["']$/g, "");
        const size = parseFloat(style.fontSize);
        const single = singleLine(family, size);
        const d = declared(el);
        let height = single, multiple = false;
        if (d && /%$/.test(d.value)) { height = (parseFloat(d.value) / 100) * single; multiple = true; }
        else if (d && /^\d+$/.test(d.value.trim()) && Number(d.value) >= 2) { height = Number(d.value) * single; multiple = true; }
        else if (d && /px$/.test(d.value)) height = d.exact ? parseFloat(d.value) : Math.max(parseFloat(d.value), single);
        decisions.push([el, height, multiple ? (height - single) / 2 : 0]);
      }
      for (const [el, height] of decisions) el.style.setProperty("line-height", `${height}px`, "important");
      // Word puts what a multiple adds below the text, where CSS splits it above and below:
      // each such block's text is drawn that half higher (once per block, by its first text).
      const blockOf = (el) => {
        for (let e = el; e; e = e.parentElement) if (!/^inline/.test(getComputedStyle(e).display)) return e;
        return doc.body;
      };
      const raise = new Map();
      for (const [el, , up] of decisions) if (!raise.has(blockOf(el))) raise.set(blockOf(el), up);
      for (const [block, up] of raise) {
        if (up <= 0 || getComputedStyle(block).position !== "static") continue;
        let inside = false;
        for (let e = block.parentElement; e && !inside; e = e.parentElement) inside = raise.get(e) > 0;
        if (inside) continue;
        block.style.setProperty("position", "relative", "important");
        block.style.setProperty("top", `${-up}px`, "important");
      }
    },

    /** Assumed: Word ignores media queries in <style>, so phone rules never apply. */
    "ignore-media-queries": (doc) => {
      for (const sheet of doc.styleSheets) {
        let rulesList;
        try { rulesList = sheet.cssRules; } catch { continue; }
        for (let i = rulesList.length - 1; i >= 0; i--) if (rulesList[i] instanceof CSSMediaRule) sheet.deleteRule(i);
      }
    },

    /**
     * Line breaks, as Word makes them, and words drawn where Word draws them. Word adds a word
     * to a line if the word starts inside the room (or the space before it is at least half
     * inside), and the line's spaces can take up the overrun by shrinking to half their width;
     * then it draws the glyphs at their own widths with the spaces squeezed to fit. Centered
     * text is the exception: it breaks at the glyphs' own widths and isn't squeezed. Width
     * probes (cases/widths, probes-study.mjs; 768 cells of exact widths): the rule predicts
     * Word's first line in about 90% (the limit fits best at 0.4 there), any rounding of glyph
     * widths at most 67%. Email lines (breaks-study.mjs, font files): 95.4% at 0.5 (0.4: 94.0%;
     * floored widths: 91.8%); centered at the glyphs' own widths 96%.
     * So: in each block that isn't centered, measure every word where it lies on one unwrapped
     * line (so with kerning, mixed runs and letter spacing as Chromium draws them), and break
     * by that rule; a centered block, or one with an image or inline box in its text, keeps
     * Chromium's own breaks. Then draw at normal spacing without wrapping, squeezing the
     * spaces of a line that would overrun its block. Runs last: it fixes lines.
     */
    "line-breaks": (doc, report) => {
      // How much a line's spaces may shrink: to half their width at 192 DPI; at 96 DPI Word
      // doesn't squeeze (the width probes: exact widths predict 95.6% of first lines there,
      // the squeeze 22-32%). Between the two isn't captured yet.
      const SQUEEZE = options.squeeze ?? (DEVICE >= 2 ? 0.5 : 0);
      const HANG = options.hang ?? 0.5; // how much of the space before a word may lie past the room
      const isBlock = (el) => !/^inline/.test(getComputedStyle(el).display);
      const blockOf = (node) => {
        for (let e = node.parentElement; e; e = e.parentElement) if (isBlock(e)) return e;
        return doc.body;
      };
      // Each word start, its line (from its box) and its block, as Chromium lays them out.
      const starts = [];
      const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement;
        if (!parent || ["SCRIPT", "STYLE", "TITLE"].includes(parent.tagName)) continue;
        for (const m of node.textContent.matchAll(/\S+/g)) {
          const range = doc.createRange();
          range.setStart(node, m.index);
          range.setEnd(node, m.index + 1);
          const rect = [...range.getClientRects()].find((r) => r.height > 0);
          if (rect) starts.push({ node, offset: m.index, top: rect.top, height: rect.height, block: blockOf(node) });
        }
      }

      // Blocks Word's rule breaks here: their words (runs between spaces, across elements; a
      // <br> ends a line) and their room, read as laid out.
      const SPACE = /[ \t\n\r\f]/;
      const plan = new Map();
      for (const block of new Set(starts.map((s) => s.block))) {
        const cs = getComputedStyle(block);
        if (cs.textAlign === "center" || /pre|nowrap/.test(cs.whiteSpace)) continue;
        const words = [];
        let word = null, simple = true;
        const nodes = doc.createTreeWalker(block, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
        for (let n = nodes.nextNode(); n && simple; n = nodes.nextNode()) {
          if (n.nodeType === 1) {
            if (n.tagName === "BR") { word = null; words.push("br"); continue; }
            const display = getComputedStyle(n).display;
            if (display === "none") continue;
            if (!/^inline$|^contents$/.test(display) || n.tagName === "IMG") simple = false;
            continue;
          }
          const parent = n.parentElement;
          if (!parent || ["SCRIPT", "STYLE", "TITLE"].includes(parent.tagName)) continue;
          const text = n.textContent;
          for (let i = 0; i < text.length; i++) {
            if (SPACE.test(text[i])) { word = null; continue; }
            if (!word) { word = { start: { node: n, offset: i }, end: { node: n, offset: i + 1 } }; words.push(word); }
            else word.end = { node: n, offset: i + 1 };
          }
        }
        if (!simple || !words.some((w) => w !== "br")) continue;
        const room = block.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
        plan.set(block, { words, room });
      }
      // Every word where it lies on one unwrapped line, with the tables pinned: not wrapping
      // would widen a cell sized from its content.
      const restore = [];
      const keep = (el, props) => restore.push([el, props.map((p) => [p, el.style.getPropertyValue(p), el.style.getPropertyPriority(p)])]);
      for (const el of doc.querySelectorAll("table, td, th")) {
        const w = el.getBoundingClientRect().width;
        keep(el, ["width", "min-width", "max-width", "table-layout"]);
        for (const p of ["width", "min-width", "max-width"]) el.style.setProperty(p, `${w}px`, "important");
        if (el.tagName === "TABLE") el.style.setProperty("table-layout", "fixed", "important");
      }
      for (const block of plan.keys()) { keep(block, ["white-space"]); block.style.setProperty("white-space", "nowrap", "important"); }
      const at = (point, side) => {
        const r = doc.createRange();
        r.setStart(point.node, side === "left" ? point.offset : point.offset - 1);
        r.setEnd(point.node, side === "left" ? point.offset + 1 : point.offset);
        const rect = [...r.getClientRects()].find((x) => x.width > 0 || x.height > 0);
        return rect ? rect[side] : null;
      };
      const breaks = [];
      for (const [block, { words, room }] of plan) {
        let lineStart = null, last = null, spaces = 0, spaceWidth = 0;
        for (const w of words) {
          if (w === "br") { lineStart = null; continue; }
          const left = at(w.start, "left"), right = at(w.end, "right");
          if (left == null || right == null) continue;
          if (lineStart == null) { lineStart = left; last = right; spaces = 0; spaceWidth = 0; continue; }
          const gap = left - last; // the space before this word
          const startsInside = left - lineStart < room + HANG * gap;
          const over = right - lineStart - room;
          if (startsInside && over <= SQUEEZE * (spaceWidth + gap) + 0.01) { spaces++; spaceWidth += gap; last = right; continue; }
          // For the report: the more the line was short of, by either test (the word starting
          // inside the room, and the spaces taking up its overrun).
          const margin = Math.min(room + HANG * gap - (left - lineStart), SQUEEZE * (spaceWidth + gap) + 0.01 - over);
          const text = doc.createRange();
          text.setStart(w.start.node, w.start.offset);
          text.setEnd(w.end.node, w.end.offset);
          breaks.push({ node: w.start.node, offset: w.start.offset, block, word: text.toString(), margin });
          lineStart = left; last = right; spaces = 0; spaceWidth = 0;
        }
      }
      for (const [el, props] of restore.reverse())
        for (const [p, value, priority] of props) value ? el.style.setProperty(p, value, priority) : el.style.removeProperty(p);
      // Chromium's breaks in the other blocks: a word that starts a new line, after one on the
      // line before, unless a <br> already ends that line (another would add an empty line).
      const afterBr = (point) => {
        if (point.node.textContent.slice(0, point.offset).trim()) return false;
        for (let n = point.node; n && n !== point.block; n = n.parentNode) {
          let p = n.previousSibling;
          while (p && p.nodeType === 3 && !p.textContent.trim()) p = p.previousSibling;
          if (p) return p.nodeType === 1 && p.tagName === "BR";
        }
        return false;
      };
      for (let i = 1; i < starts.length; i++) {
        const a = starts[i - 1], b = starts[i];
        if (a.block === b.block && !plan.has(b.block) && b.top > a.top + 0.5 * Math.min(a.height, b.height) && !afterBr(b))
          breaks.push({ node: b.node, offset: b.offset, block: b.block, word: b.node.textContent.slice(b.offset).match(/^\S+/)[0], margin: null });
      }
      // In document order (by offset within a node), so the loop below can go from the end.
      breaks.sort((x, y) => (x.node === y.node ? x.offset - y.offset : x.node.compareDocumentPosition(y.node) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      for (const { block, word, margin } of breaks) report.breaks.push({ block, word, margin });
      // From the end, so earlier offsets in a text node stay right.
      for (const b of breaks.reverse()) {
        const text = b.node.textContent;
        let cut = b.offset;
        while (cut > 0 && /\s/.test(text[cut - 1])) cut--;
        const after = b.node.splitText(b.offset);
        if (cut < b.offset) b.node.textContent = text.slice(0, cut);
        after.parentNode.insertBefore(doc.createElement("br"), after);
      }
      const blocks = new Set(starts.map((s) => s.block));
      // Measuring needs lines that don't wrap, but no wrapping makes a table cell sized from its
      // content want to be wider: pin every table and cell at its width while measuring.
      const pinned = [];
      const pin = (el, props) => {
        pinned.push([el, props.map((p) => [p, el.style.getPropertyValue(p), el.style.getPropertyPriority(p)])]);
      };
      const widths = [...doc.querySelectorAll("table, td, th")].map((el) => [el, el.getBoundingClientRect().width]);
      for (const [el, width] of widths) {
        pin(el, ["width", "table-layout", "max-width", "min-width"]);
        el.style.setProperty("width", `${width}px`, "important");
        el.style.setProperty("max-width", `${width}px`, "important");
        el.style.setProperty("min-width", `${width}px`, "important");
        if (el.tagName === "TABLE") el.style.setProperty("table-layout", "fixed", "important");
      }
      for (const block of blocks) block.style.setProperty("white-space", "nowrap", "important");

      // A line that now runs past its block's edge has its spaces narrowed just enough to fit,
      // as Word squeezes it: each space on the line goes in a span with a negative word-spacing.
      for (const block of blocks) {
        const cs = getComputedStyle(block);
        const box = block.getBoundingClientRect();
        const right = box.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth);
        const left = box.left + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth);
        const lines = new Map(); // top -> the line's words: [node, start, end, rect]
        const w = doc.createTreeWalker(block, NodeFilter.SHOW_TEXT);
        for (let node = w.nextNode(); node; node = w.nextNode()) {
          if (blockOf(node) !== block) continue;
          for (const m of node.textContent.matchAll(/\S+/g)) {
            const range = doc.createRange();
            range.setStart(node, m.index);
            range.setEnd(node, m.index + m[0].length);
            const rect = [...range.getClientRects()].find((r) => r.height > 0);
            if (!rect) continue;
            const top = Math.round(rect.top);
            if (!lines.has(top)) lines.set(top, []);
            lines.get(top).push({ node, start: m.index, end: m.index + m[0].length, rect });
          }
        }
        for (const words of lines.values()) {
          const width = words.at(-1).rect.right - words[0].rect.left;
          const over = width - (right - left);
          if (over <= 0.5 || words.length < 2) continue;
          // The spaces between this line's words, last first so offsets stay right.
          const gaps = [];
          for (let k = 1; k < words.length; k++) {
            const a = words[k - 1], b = words[k];
            if (a.node === b.node) gaps.push({ node: a.node, from: a.end, to: b.start });
            else if (/\s$/.test(a.node.textContent)) gaps.push({ node: a.node, from: a.node.textContent.search(/\s+$/), to: a.node.textContent.length });
            else if (/^\s/.test(b.node.textContent)) gaps.push({ node: b.node, from: 0, to: b.node.textContent.match(/^\s+/)[0].length });
          }
          if (!gaps.length) continue;
          const squeeze = -(over + 0.5) / gaps.length; // a little more, so rounding can't re-wrap it
          for (const g of gaps.sort((x, y) => (x.node === y.node ? y.from - x.from : 0))) {
            if (g.to <= g.from) continue;
            const rest = g.node.splitText(g.from);
            rest.splitText(g.to - g.from);
            const span = doc.createElement("span");
            span.style.setProperty("word-spacing", `${squeeze}px`, "important");
            rest.parentNode.insertBefore(span, rest);
            span.append(rest);
          }
        }
      }
      // Then back: wrapping on (the lines fit now, so the explicit breaks keep them) and the
      // tables as they were.
      for (const block of blocks) block.style.removeProperty("white-space");
      for (const [el, props] of pinned.reverse())
        for (const [p, value, priority] of props) value ? el.style.setProperty(p, value, priority) : el.style.removeProperty(p);
    },
  };

  // Rules that help some cases and hurt others: off unless asked for (score.mjs --with).
  const EXPERIMENTAL = [];

  /**
   * Applies every rule not in `without`, and the experimental ones in `with_`, to win.document;
   * returns the names applied and the line breaks the line-breaks rule made.
   */
  function apply(without = [], with_ = []) {
    const applied = [];
    const report = { breaks: [] };
    // Each element's style attribute as written: setting a style through the CSSOM rewrites the
    // attribute without what Chrome doesn't know (mso-padding-alt, mso-line-height-rule), which
    // the rules after it read.
    for (const el of document.querySelectorAll("[style]")) if (!el.hasAttribute("data-outlook-style")) el.setAttribute("data-outlook-style", el.getAttribute("style"));
    for (const [name, rule] of Object.entries(rules)) {
      if (without.includes(name) || (EXPERIMENTAL.includes(name) && !with_.includes(name))) continue;
      rule(document, report);
      applied.push(name);
    }
    return { applied, breaks: report.breaks };
  }

  /** Which of the families used here this machine doesn't have (drawn with a stand-in). */
  function missingFonts() {
    const used = new Set();
    for (const el of document.body.querySelectorAll("*")) {
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const first = el.style.fontFamily.split(",")[0]?.trim().replace(/^["']|["']$/g, "");
      if (first) used.add(first);
    }
    const canvas = document.createElement("canvas").getContext("2d");
    const width = (font) => { canvas.font = font; return canvas.measureText("mmmmmmmmmmlli").width; };
    return [...used].filter((f) => width(`20px "${f}", monospace`) === width("20px monospace"));
  }

  return { apply, missingFonts, names: Object.keys(rules) };
}
