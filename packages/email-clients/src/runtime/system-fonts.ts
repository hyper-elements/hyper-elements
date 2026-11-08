/**
 * The system fonts a client's version draws with (Arial, Georgia, Tahoma…), checked by measurement in its frame:
 * document.fonts.check() says yes to a font that doesn't exist. A family is there when a test string drawn in
 * "<family>", monospace or "<family>", serif differs from the generic alone; one that's there is checked against the
 * width of a probe string on the fonts the captures were scored with, so a font the browser swapped for another of
 * other widths is told apart from one of the same widths (Liberation Sans for Arial: layout matches).
 */

/** An element's computed style, from its own document's window. */
const styleOf = (el: Element) => el.ownerDocument.defaultView!.getComputedStyle(el);

export interface FontCheck {
  missing: Array<{ kind: "font" | "substituted"; family: string }>;
  fonts: Array<{ family: string; verified: "present" | "widths" }>;
}

const GENERIC = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-serif", "ui-sans-serif", "ui-monospace", "ui-rounded", "math", "emoji", "fangsong", "inherit", "initial", "-apple-system", "blinkmacsystemfont"]);
const TEST = "mmmmmmmmmmlli1WQ@ 0123";

/** The families of a CSS font-family list, unquoted. */
export function families(list: string): string[] {
  return list.split(",").map((family) => family.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
}

/** A string's width in `font`, drawn in `doc`. */
function width(doc: Document, font: string, text: string): number {
  const span = doc.createElement("span");
  span.setAttribute("style", `position:absolute;visibility:hidden;white-space:nowrap;font:${font}`);
  span.textContent = text;
  doc.body.append(span);
  const w = span.getBoundingClientRect().width;
  span.remove();
  return w;
}

/** Whether `family` is a font the frame has: in either test, it draws other than the generic alone. */
export function present(doc: Document, family: string): boolean {
  const quoted = `"${family.replace(/"/g, '\\"')}"`;
  return ["monospace", "serif"].some((generic) => Math.abs(width(doc, `72px ${quoted}, ${generic}`, TEST) - width(doc, `72px ${generic}`, TEST)) > 0.5);
}

/**
 * Each system family the frame's text draws with: for each font stack its text uses, the families in order, past web
 * fonts that loaded and stand-ins, up to the first one there (a missing one is listed, and the next one draws). A
 * family drawn by the stand-in after it (classic Outlook's rules write `"Aptos", "Aptos Stand-in"`) isn't missing.
 */
export function checkSystemFonts(doc: Document, loaded: ReadonlySet<string>, probe: { text: string; widths: Record<string, Record<number, number>> }, standIns: ReadonlySet<string> = new Set()): FontCheck {
  const stacks = new Set<string>();
  const walker = doc.createTreeWalker(doc.body ?? doc.documentElement, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.textContent?.trim() && node.parentElement) stacks.add(styleOf(node.parentElement).fontFamily);
  }
  const result: FontCheck = { missing: [], fonts: [] };
  // Each family checked: whether it draws (present, its widths right or not) or the next one does.
  const draws = new Map<string, boolean>();
  for (const stack of stacks) {
    const list = families(stack);
    for (const [i, family] of list.entries()) {
      const key = family.toLowerCase();
      if (GENERIC.has(key) || loaded.has(family)) break;
      if (draws.has(key)) {
        if (draws.get(key)) break;
        continue;
      }
      const there = present(doc, family);
      draws.set(key, there);
      if (!there) {
        const next = list[i + 1];
        if (!(next && standIns.has(next) && loaded.has(next))) result.missing.push({ kind: "font", family });
        continue;
      }
      const widths = probe.widths[family];
      if (!widths) result.fonts.push({ family, verified: "present" });
      else if (Object.entries(widths).every(([weight, w]) => Math.abs(width(doc, `${weight} 100px "${family}"`, probe.text) - w) <= 0.5)) result.fonts.push({ family, verified: "widths" });
      else result.missing.push({ kind: "substituted", family });
      break;
    }
  }
  return result;
}
