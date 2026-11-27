/**
 * A page of a Document as an SVG, drawn where its PDF draws everything (core's drawing.ts): each box, image and
 * drawing in its place, each word of each line from where its characters are, nothing laid out again. Its coordinates
 * are the PDF's points (its viewBox), shown in px: a paginator's layout (px) is over it, caret for caret.
 *
 * Its text is in the families the Document names: for its glyphs to be the PDF's, the page it's shown in has the same
 * font files (fontFaces()). Text in a standard PDF font is drawn in the browser's nearest (Arial has Helvetica's widths).
 */
import { base64, hasher, imageSize, SourceCache, type Drawn } from "@hyper-elements/core/pdf";
import type { PdfFont } from "./index";

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** A length to a hundredth of a point. */
const n = (value: number) => String(Math.round(value * 100) / 100);

/** The standard PDF fonts, as a browser draws them: its fonts with their widths. */
const STANDARD: Record<string, string> = {
  helvetica: "Helvetica, Arial, sans-serif",
  "times-roman": "'Times New Roman', Times, serif",
  courier: "'Courier New', Courier, monospace",
};
const family = (name: string) => STANDARD[name.toLowerCase()] ?? `'${name.replace(/'/g, "\\'")}'`;

const DASHES: Record<string, (width: number) => string> = { dashed: (w) => `${n(w * 3)} ${n(w * 3)}`, dotted: (w) => `${n(w)} ${n(w)}` };

/** A box's outline, its corners rounded: a path. */
function outline(x: number, y: number, width: number, height: number, [tl, tr, br, bl]: [number, number, number, number]): string {
  return `M${n(x + tl)} ${n(y)}H${n(x + width - tr)}${tr ? `A${n(tr)} ${n(tr)} 0 0 1 ${n(x + width)} ${n(y + tr)}` : ""}V${n(y + height - br)}${br ? `A${n(br)} ${n(br)} 0 0 1 ${n(x + width - br)} ${n(y + height)}` : ""}H${n(x + bl)}${bl ? `A${n(bl)} ${n(bl)} 0 0 1 ${n(x)} ${n(y + height - bl)}` : ""}V${n(y + tl)}${tl ? `A${n(tl)} ${n(tl)} 0 0 1 ${n(x + tl)} ${n(y)}` : ""}Z`;
}

/** How an image fills its box, as SVG's preserveAspectRatio. */
const aspectOf = (drawn: Extract<Drawn, { kind: "image" }>) => (drawn.fit === "cover" ? "xMidYMid slice" : drawn.fit === "contain" ? (drawn.bottom ? "xMidYMax meet" : "xMidYMid meet") : "none");

/** An image file's hash, for its symbol's id: the last used files (core's source-cache.ts). */
const hashes = new SourceCache<string>();
function fileHash(src: string): string {
  let hex = hashes.get(src);
  if (hex === undefined) {
    const hash = hasher();
    hash.add(src);
    hashes.set(src, (hex = hash.hex()));
  }
  return hex;
}

/**
 * The images pages draw, each defined once (a symbol, its id from its file and how it fills its box) for the pages to
 * use: a long Document's repeated header image is in the page once, not in each page's SVG.
 */
export class SharedImages {
  private readonly symbols = new Map<string, string>();

  /** The id an image is drawn from (its symbol, made the first time), or undefined where its file's size isn't known. */
  use(drawn: Extract<Drawn, { kind: "image" }>): string | undefined {
    const size = imageSize(drawn.src);
    if (!size) return undefined;
    const aspect = aspectOf(drawn);
    const id = `elements-image-${fileHash(drawn.src)}-${aspect.replace(/ /g, "-")}`;
    if (!this.symbols.has(id)) this.symbols.set(id, `<symbol id="${id}" viewBox="0 0 ${size.width} ${size.height}" preserveAspectRatio="${aspect}"><image width="${size.width}" height="${size.height}" href="${escape(drawn.src)}" xlink:href="${escape(drawn.src)}"/></symbol>`);
    return id;
  }

  /** Each image used, defined once: an SVG to put in the page before the pages that use them. */
  svg(): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${[...this.symbols.values()].join("")}</defs></svg>`;
  }
}

function item(drawn: Drawn, images?: SharedImages): string {
  switch (drawn.kind) {
    case "rect": {
      const { x, y, width, height, fill, radius, border } = drawn;
      let out = "";
      if (fill) out += radius ? `<path d="${outline(x, y, width, height, radius)}" fill="${escape(fill)}"/>` : `<rect x="${n(x)}" y="${n(y)}" width="${n(width)}" height="${n(height)}" fill="${escape(fill)}"/>`;
      if (border) {
        const sides = Object.values(border);
        const same = sides.length === 4 && sides.every((side) => side!.width === sides[0]!.width && side!.color === sides[0]!.color && side!.style === sides[0]!.style);
        if (same) {
          // A border inside its box, as a browser and the PDF draw it.
          const side = sides[0]!;
          const half = side.width / 2;
          const shape = radius ? `<path d="${outline(x + half, y + half, width - side.width, height - side.width, radius.map((r) => Math.max(0, r - half)) as [number, number, number, number])}"` : `<rect x="${n(x + half)}" y="${n(y + half)}" width="${n(width - side.width)}" height="${n(height - side.width)}"`;
          out += `${shape} fill="none" stroke="${escape(side.color)}" stroke-width="${n(side.width)}"${DASHES[side.style] ? ` stroke-dasharray="${DASHES[side.style](side.width)}"` : ""}/>`;
        } else {
          const lines = { top: [x, y, x + width, y, 1], bottom: [x, y + height, x + width, y + height, -1], left: [x, y, x, y + height, 1], right: [x + width, y, x + width, y + height, -1] } as const;
          for (const [name, side] of Object.entries(border)) {
            const [x1, y1, x2, y2, inward] = lines[name as keyof typeof lines];
            const across = name === "top" || name === "bottom";
            const shift = (side!.width / 2) * inward;
            out += `<line x1="${n(x1 + (across ? 0 : shift))}" y1="${n(y1 + (across ? shift : 0))}" x2="${n(x2 + (across ? 0 : shift))}" y2="${n(y2 + (across ? shift : 0))}" stroke="${escape(side!.color)}" stroke-width="${n(side!.width)}"${DASHES[side!.style] ? ` stroke-dasharray="${DASHES[side!.style](side!.width)}"` : ""}/>`;
          }
        }
      }
      return out;
    }
    case "image": {
      const id = images?.use(drawn);
      if (id) return `<use x="${n(drawn.x)}" y="${n(drawn.y)}" width="${n(drawn.width)}" height="${n(drawn.height)}" href="#${id}" xlink:href="#${id}"/>`;
      return `<image x="${n(drawn.x)}" y="${n(drawn.y)}" width="${n(drawn.width)}" height="${n(drawn.height)}" preserveAspectRatio="${aspectOf(drawn)}" href="${escape(drawn.src)}"/>`;
    }
    case "drawing": {
      const shapes = drawn.shapes.map((shape) => `<${shape.kind}${Object.entries(shape.attributes).filter(([, value]) => value !== undefined).map(([name, value]) => ` ${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}="${escape(String(value))}"`).join("")}/>`).join("");
      return `<svg x="${n(drawn.x)}" y="${n(drawn.y)}" width="${n(drawn.width)}" height="${n(drawn.height)}" viewBox="${escape(drawn.viewBox)}">${shapes}</svg>`;
    }
    case "words": {
      const font = `font-family="${escape(family(drawn.family))}" font-size="${n(drawn.size)}" font-weight="${drawn.weight}"${drawn.style === "italic" ? ' font-style="italic"' : ""} fill="${escape(drawn.color)}"${drawn.opacity !== undefined ? ` fill-opacity="${drawn.opacity}"` : ""}${drawn.spacing ? ` letter-spacing="${n(drawn.spacing)}"` : ""}`;
      // Each word from where its characters are: one written left to right from its left, one written right to left (a
      // word of its own, so its letters join) from its right.
      const ltr = drawn.words.filter((word) => !word.rtl);
      let out = ltr.length ? `<text y="${n(drawn.baseline)}" ${font} xml:space="preserve">${ltr.map((word) => `<tspan x="${n(word.x)}">${escape(word.text)}</tspan>`).join("")}</text>` : "";
      for (const word of drawn.words.filter((word) => word.rtl)) out += `<text x="${n(word.x + word.width)}" y="${n(drawn.baseline)}" direction="rtl" unicode-bidi="embed" text-anchor="start" ${font} xml:space="preserve">${escape(word.text)}</text>`;
      return out;
    }
    case "clip":
      return `<svg x="${n(drawn.x)}" y="${n(drawn.y)}" width="${n(drawn.width)}" height="${n(drawn.height)}" viewBox="${n(drawn.x)} ${n(drawn.y)} ${n(drawn.width)} ${n(drawn.height)}" overflow="hidden">${drawn.items.map((inner) => item(inner, images)).join("")}</svg>`;
  }
}

/**
 * A page drawn as an SVG: `width` and `height` its paper in points, shown in px (96 to the inch). `images`: its images
 * drawn from symbols defined once (SharedImages), else each in it. Its text is drawn at the font's own advances
 * (`geometricPrecision`): Chromium on Linux otherwise rounds each glyph's advance to a whole pixel, half a point off the
 * PDF by a word's third letter.
 */
export function pageSvg(drawn: Drawn[], width: number, height: number, images?: SharedImages): string {
  return `<svg xmlns="http://www.w3.org/2000/svg"${images ? ' xmlns:xlink="http://www.w3.org/1999/xlink"' : ""} width="${n(width / 0.75)}" height="${n(height / 0.75)}" viewBox="0 0 ${n(width)} ${n(height)}" text-rendering="geometricPrecision">${drawn.map((inner) => item(inner, images)).join("")}</svg>`;
}

/** A font file's format, for its @font-face: by its first bytes. */
function format(bytes: Uint8Array): string {
  const tag = String.fromCharCode(...bytes.subarray(0, 4));
  return tag === "wOFF" ? "woff" : tag === "wOF2" ? "woff2" : tag === "OTTO" ? "opentype" : "truetype";
}

/**
 * The fonts a paginator is given, as CSS: an @font-face for each file, by the family a Document names, its weight and
 * its style. Put it in the page a Document's pages are shown in (each page's SVG names its families), so its words are
 * drawn in the PDF's fonts.
 */
export function fontFaces(fonts: readonly PdfFont[]): string {
  return fonts
    .map((font) => {
      const bytes = font.src instanceof ArrayBuffer ? new Uint8Array(font.src) : font.src;
      const kind = format(bytes);
      return `@font-face{font-family:'${font.family.replace(/'/g, "\\'")}';src:url(data:font/${kind === "opentype" ? "otf" : kind === "truetype" ? "ttf" : kind};base64,${base64(bytes)}) format('${kind}');font-weight:${font.weight ?? 400};font-style:${font.style ?? "normal"}}`;
    })
    .join("\n");
}
