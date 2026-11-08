/**
 * What a preview finds in what it draws: only what's robust to the model's error, each a diagnostic with a fixed code,
 * severity and clients, and a fix (its `see` would be the file itself, so it has none).
 *
 * - email/more-lines (classic Outlook, a note): a Heading or a Button takes more lines than in the email as written,
 *   and every break Outlook's rules made in it missed by 2px or more (a closer call could go either way).
 * - email/dark-contrast (Apple Mail's dark mode, a warning): text that reads against its background in the email as
 *   written, at 3:1 or more, and not after the dark-mode change.
 * - email/size (Gmail): the email is clipped, at the block the clip cuts into.
 */
import type { BlockMapEntry, Diagnostic } from "@hyper-elements/react";
import type { OutlookBreak } from "./renderer/rules.js";
import { pathOf } from "./marks";

/** An element's computed style, from its own document's window. */
const styleOf = (el: Element) => el.ownerDocument.defaultView!.getComputedStyle(el);

/** The 2px a break must have missed by to be reported. */
export const MARGIN = 2;
/** The contrast below which text doesn't read. */
export const CONTRAST = 3;

/** The lines `el`'s text takes: its line boxes' distinct tops. */
export function linesOf(el: Element): number {
  const range = el.ownerDocument.createRange();
  range.selectNodeContents(el);
  const tops = new Set<number>();
  for (const rect of [...range.getClientRects()]) if (rect.width > 0 && rect.height > 0) tops.add(Math.round(rect.top));
  // Rects of one line can sit a pixel apart (a run in another font): those within half the smallest height are one.
  const sorted = [...tops].sort((a, b) => a - b);
  let lines = 0;
  let last = Number.NEGATIVE_INFINITY;
  const height = Math.min(...[...range.getClientRects()].filter((r) => r.height > 0).map((r) => r.height), Number.POSITIVE_INFINITY);
  for (const top of sorted) {
    if (top - last > height / 2) lines++;
    last = top;
  }
  return lines;
}

/** The Headings (h1–h6) and Buttons (their link, in the cell Outlook pads with mso-padding-alt) in `doc`, keyed by path and order. */
export function textBlocks(doc: Document): Map<string, { el: Element; kind: "Heading" | "Button" }> {
  const out = new Map<string, { el: Element; kind: "Heading" | "Button" }>();
  const count = new Map<string, number>();
  for (const el of [...doc.querySelectorAll("h1,h2,h3,h4,h5,h6,a")]) {
    const kind = el.tagName === "A" ? (/mso-padding-alt/i.test(el.parentElement?.getAttribute("style") ?? "") ? "Button" : null) : "Heading";
    if (!kind) continue;
    const path = pathOf(el);
    const n = count.get(path) ?? 0;
    count.set(path, n + 1);
    out.set(`${path}#${n}`, { el, kind });
  }
  return out;
}

/** email/more-lines: Outlook's Headings and Buttons that take more lines than as written, where each of its breaks there missed by MARGIN or more. */
export function moreLines(client: Document, baseline: Document, breaks: readonly OutlookBreak[]): Diagnostic[] {
  const before = textBlocks(baseline);
  const out: Diagnostic[] = [];
  for (const [key, { el, kind }] of textBlocks(client)) {
    const written = before.get(key);
    if (!written) continue;
    const [lines, writtenLines] = [linesOf(el), linesOf(written.el)];
    if (lines <= writtenLines) continue;
    const decided = breaks.filter((b) => b.margin !== null && (b.block === el || el.contains(b.block) || (b.block.contains(el) && (el.textContent ?? "").includes(b.word))));
    if (!decided.length || decided.some((b) => Math.abs(b.margin!) < MARGIN)) continue;
    out.push({
      code: "email/more-lines",
      severity: "info",
      message: `This ${kind} takes ${lines} lines in classic Outlook, ${writtenLines} as written`,
      path: pathOf(el),
      clients: ["outlook"],
      fix: "shorten the text, or widen its column",
    });
  }
  return out;
}

type Rgba = [number, number, number, number];

/** A computed colour as RGBA (0–255, alpha 0–1). */
export function rgba(color: string): Rgba | null {
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const [r, g, b, a = 1] = m[1]!.split(/[\s,/]+/).filter(Boolean).map(Number);
  return [r!, g!, b!, a];
}

const luminance = ([r, g, b]: Rgba) => {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

/** The WCAG contrast ratio of two colours. */
export function contrast(a: Rgba, b: Rgba): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** The colour behind `el`: the first painted background from it up (white where nothing paints). */
function background(el: Element | null): Rgba {
  for (let node = el; node; node = node.parentElement) {
    const color = rgba(styleOf(node).backgroundColor);
    if (color && color[3] > 0) return color;
  }
  return [255, 255, 255, 1];
}

/** Each element holding text of its own, keyed by path and order, with its text's contrast against its background. */
function textContrast(doc: Document): Map<string, { el: Element; ratio: number }> {
  const out = new Map<string, { el: Element; ratio: number }>();
  const count = new Map<string, number>();
  const walker = doc.createTreeWalker(doc.body ?? doc.documentElement, NodeFilter.SHOW_TEXT);
  const seen = new Set<Element>();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement;
    if (!el || seen.has(el) || !node.textContent?.trim()) continue;
    seen.add(el);
    const color = rgba(styleOf(el).color);
    if (!color) continue;
    const path = pathOf(el);
    const n = count.get(path) ?? 0;
    count.set(path, n + 1);
    out.set(`${path}#${n}`, { el, ratio: contrast(color, background(el)) });
  }
  return out;
}

/** email/dark-contrast: text that reads as written (CONTRAST or more) and doesn't after Apple Mail's dark-mode change. */
export function darkContrast(client: Document, baseline: Document): Diagnostic[] {
  const before = textContrast(baseline);
  const reported = new Set<string>();
  const out: Diagnostic[] = [];
  for (const [key, { el, ratio }] of textContrast(client)) {
    const written = before.get(key);
    const path = pathOf(el);
    if (!written || written.ratio < CONTRAST || ratio >= CONTRAST || reported.has(path)) continue;
    reported.add(path);
    out.push({
      code: "email/dark-contrast",
      severity: "warning",
      message: `This text's contrast with its background is ${ratio.toFixed(1)}:1 in Apple Mail's dark mode (${written.ratio.toFixed(1)}:1 as written)`,
      path,
      clients: ["apple-mail"],
      fix: "set the text's and its background's colours so both modes read",
    });
  }
  return out;
}

/** email/size: Gmail clipped the email; at the block whose element the cut is in (the greatest offset at or before it). */
export function clipped(client: "gmail" | "gmail-app" | "gmail-app-other", cut: number, size: number, entries: readonly BlockMapEntry[]): Diagnostic {
  const at = entries.filter((e) => e.offset <= cut).reduce<BlockMapEntry | null>((best, e) => (!best || e.offset >= best.offset ? e : best), null);
  return {
    code: "email/size",
    severity: client === "gmail" ? "warning" : "info",
    message: `The email is ${Math.round(size / 1024)} KB; Gmail clips a message after ${Math.round(cut / 1024)} KB ("[Message clipped]"), here`,
    path: at?.path ?? "root",
    clients: [client],
    fix: "shorten the email, or move long sections to a page: what follows the clip is behind a link",
  };
}
