/**
 * A page as painted, as a hash (PlannedPage's `hash`): its paper, margins and background, and every block of its
 * header, content and footer (kinds, styles, text, images, drawings). The same where nothing drawn on it changed, so a
 * page view keeps a page it drew.
 */
import { hasher } from "../plan";
import { fingerprint } from "./bytes";
import type { Block, Page, Run } from "./model";
import { SourceCache } from "./source-cache";

/**
 * An image file's own hash, in a page's (its data URI can be large: hashed once, the last used kept, source-cache.ts):
 * from its bytes, so the same page has the same hash in any process, and another file another.
 */
const files = new SourceCache<string>();
const fileOf = (src: string): string => {
  let hex = files.get(src);
  if (hex === undefined) {
    const file = hasher();
    file.add(src);
    files.set(src, (hex = file.hex()));
  }
  return `#${hex}`;
};

/** `fonts`: what the page's text is drawn in (its font files', fontsKey()): another file under the same family is another page. */
export function pageHash(page: Page, fonts = ""): string {
  const hash = hasher();
  hash.add(fonts);
  const run = (item: Run) => {
    if (typeof item === "string") return hash.add(`"${item}`);
    if (item.kind === "image") return hash.add(`i${fileOf(item.src)}${JSON.stringify(item.style)}`);
    hash.add(`${item.kind}${JSON.stringify(item.style)}${item.kind === "link" ? item.href : ""}(${item.runs.length}`);
    item.runs.forEach(run);
  };
  const block = (item: Block | undefined) => {
    if (!item) return hash.add("-");
    hash.add(`${item.kind}${item.path ?? ""}${"style" in item ? JSON.stringify(item.style) : ""}`);
    switch (item.kind) {
      case "text":
        hash.add(`(${item.runs.length}`);
        item.runs.forEach(run);
        return;
      case "image":
        return hash.add(fileOf(item.src));
      case "drawing":
        return hash.add(`${item.width}x${item.height}${item.viewBox}${JSON.stringify(item.shapes)}`);
      case "box":
      case "link":
        hash.add(`${item.kind === "link" ? item.href : ""}(${item.children.length}`);
        item.children.forEach(block);
    }
  };
  hash.add(`${page.width}x${page.height}${JSON.stringify(page.margin)}${page.background}${page.contentHeight}${page.gap ?? ""}`);
  block(page.header);
  hash.add(`(${page.content.length}`);
  page.content.forEach(block);
  block(page.footer);
  return hash.hex();
}

/** The font files a Document is drawn with, as a key for its pages' hashes: each one's family, weight, style and bytes (their quick hash). */
export function fontsKey(fonts: ReadonlyArray<{ family: string; weight: number; style: string; data: Uint8Array }>): string {
  return fonts.map((font) => `${font.family}|${font.weight}|${font.style}|${fingerprint(font.data)}`).join(";");
}
