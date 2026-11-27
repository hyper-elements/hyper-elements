/**
 * Image output for Elements: a `<Canvas>` written as PNG or SVG on the server, without a browser or the network. Its
 * content is laid out at the widths every output uses, written as a canvas any engine can draw (the core's
 * src/image/model.ts), and drawn by Satori (layout and text as paths) and resvg (pixels), whose adapter (satori.ts
 * beside it) is the only file naming them.
 *
 *   const { image } = await renderImage(<SocialCard />, { fonts: [{ family: "Inter", src: interRegular }] });
 *
 * Nothing is fetched: fonts are given (`fonts`, or the Canvas's `fonts` as data: URIs), and so are images (`images`
 * by URL, or data: URIs). An image needs at least one font: its text is drawn with the fonts it's given.
 * templateAssets() lists the fonts and images a template names, for a tool that loads them.
 */
import { assetParts, drawnText, fontStack, LAYOUT_VERSION, satoriResvg, sha256Hex, utf8Encode, writeCanvas, type Asset, type Font } from "@hyper-elements/core/image";
import { installedVersion } from "./engines";
import { measure, type ImageLayout } from "./layout";

export type { FitResult, GlyphResult, ImageLayout, LaidOutNode } from "./layout";
import type { FontFace } from "@hyper-elements/core";
import { ElementsError, prepare, type Diagnostic, type PictureDrawer, type ResolvedNode, type Snapshot } from "@hyper-elements/react";
import type { ReactElement } from "react";

export interface ImageFont {
  /** The family a template names in its fontFamily stacks ("Inter"). */
  family: string;
  /** The font file (TTF, OTF or WOFF; not WOFF2). */
  src: Uint8Array | ArrayBuffer;
  weight?: number;
  style?: "normal" | "italic";
}

export interface ImageOptions {
  /** Font files, by the family the template names: an image loads none itself, and needs one. */
  fonts?: ImageFont[];
  /** Image files (PNG, JPEG, GIF, SVG), by the URL the template gives: an image loads none itself. */
  images?: Record<string, Uint8Array | ArrayBuffer>;
  /** PNG (the default) or SVG. */
  format?: "png" | "svg";
  /** Pixels per px, for a sharper PNG (2 for a phone's screen). */
  scale?: number;
  /**
   * A font missing (a family, a weight, a character) or content past the Canvas is an error, not a warning: what a
   * template's design is drawn with, and the CLI's renders (Decision 19).
   */
  strict?: boolean;
}

export interface ImageResult {
  /** The image file. */
  image: Uint8Array;
  /** Its size in pixels. */
  width: number;
  height: number;
  /** Warnings and notes (errors are thrown). */
  diagnostics: Diagnostic[];
}

/**
 * A Canvas written as an image. It's measured first with its fonts: fitted text drawn at the size that fits, and what
 * runs past the Canvas or has no font said. Rejects with an `ElementsError` listing the problems if it has errors. A
 * template's snapshot is drawn `strict`, and the measured rules its template requires are decided here.
 */
export async function renderImage(element: ReactElement | Snapshot, options: ImageOptions = {}): Promise<ImageResult> {
  const { context, diagnostics, found, pending, strict } = canvasFor(element, options);
  const { layout, sizes } = await measure(context, { strict, scale: options.scale ?? 1 });
  const all = [...diagnostics, ...found, ...layout.diagnostics];
  decide(pending, all);
  if (all.some((d) => d.severity === "error")) throw new ElementsError(all);
  const { root } = context;
  const width = Number(root.props.width);
  const height = Number(root.props.height);
  const canvas = writeCanvas(root, { families: context.families, fallback: context.fallback, fonts: context.fonts, image: context.image, sizes });
  const scale = options.scale ?? 1;
  if (options.format === "svg") return { image: await satoriResvg(canvas, { format: "svg", scale }), width, height, diagnostics: all };
  const image = await satoriResvg(canvas, { format: "png", scale });
  return { image, width: Math.round(width * scale), height: Math.round(height * scale), diagnostics: all };
}

/**
 * A Canvas measured with its fonts, nothing drawn: each fitted node's size, each node's box, the glyphs no font covers,
 * and what runs past the Canvas (Decision 18). What a template's `checkLayout()` reads. Rejects as `renderImage()` does
 * for a design it can't read; the measured findings are in `diagnostics`.
 */
export async function layoutImage(element: ReactElement | Snapshot, options: Omit<ImageOptions, "format"> = {}): Promise<ImageLayout> {
  const { context, diagnostics, found, strict } = canvasFor(element, options);
  const { layout } = await measure(context, { strict, scale: options.scale ?? 1 });
  return { ...layout, diagnostics: [...diagnostics, ...found, ...layout.diagnostics] };
}

/**
 * The Canvas a design is, read with its fonts and images, ready to measure. Throws for what can't be read. The design
 * is collected once: its tree and its template's undecided rules come from the same read. A template's design is
 * measured and drawn strict, whatever its rules.
 */
function canvasFor(element: ReactElement | Snapshot, options: Omit<ImageOptions, "format">) {
  const { root, diagnostics, pending } = canvasOf(element);
  const strict = options.strict === true || pending.template !== undefined;
  return { ...readied(root, diagnostics, options, strict), pending };
}

/** A laid-out Canvas read with its fonts and images, ready to measure (canvasFor's, and each of an Email's pictures'). */
/** `used`: say a font face with no file only where text names its family (an Email's picture: its file isn't drawn else). */
function readied(root: ResolvedNode, diagnostics: Diagnostic[], options: Omit<ImageOptions, "format">, strict: boolean, used = false) {
  const found: Diagnostic[] = [];
  const fonts = fontsOf(root, options.fonts ?? [], found, strict, used ? textFamilies(root) : undefined);
  const images = imageSources(root, options.images ?? {}, found);
  // What can't be drawn at all stops it here (an image with no file, no font at all); what strict makes an error is
  // measured with the rest, so every finding is said at once.
  if (found.some((d) => d.severity === "error" && (d.code === "image/image" || d.path === "root"))) throw new ElementsError([...diagnostics, ...found]);
  found.push(...missingFaces(root, fonts, strict));
  const families = new Set(fonts.map((font) => font.family.toLowerCase()));
  return { context: { root, fonts, families, fallback: fonts[0]?.family ?? "", image: (src: string) => images.get(src) }, diagnostics, found, strict };
}

export interface EmailImagesOptions {
  /** Font files, by the family the Email's text names: a picture's text is drawn with these, and needs its family's. */
  fonts?: ImageFont[];
  /** Image files (PNG, JPEG, GIF, SVG), by the URL an Image in a Canvas gives: nothing is fetched. */
  images?: Record<string, Uint8Array | ArrayBuffer>;
  /** Pixels per px: 2, the default, is sharp on a phone's screen. In each file's name (`<hash>-2x.png`). */
  scale?: number;
}

/**
 * Draws the pictures of an Email (each Canvas in it, and each Svg on its own) as PNGs, for render()'s `assets`:
 *
 *   const { html, files } = await render(<Launch />, {
 *     assets: { baseUrl: "https://cdn.example.com/email/", draw: emailImages({ fonts: [{ family: "Inter", src: inter }] }) },
 *   });
 *   // upload each of files to baseUrl, then send html
 *
 * A font its text names and isn't given is an error, not a fallback: the picture would be in another type than the
 * email around it. Its key, in each file's name, is what it draws with: the scale, the fonts' and images' bytes, and
 * the versions of this package, Satori and resvg, so another of any is another file (one cached for good stays right).
 */
export function emailImages(options: EmailImagesOptions = {}): PictureDrawer {
  const scale = options.scale ?? 2;
  if (!Number.isInteger(scale) || scale < 1 || scale > 4) throw new TypeError(`[Elements] emailImages({ scale }) takes a whole number from 1 to 4, not ${String(options.scale)}`);
  // Copies, so the bytes the key names are the bytes drawn, whatever the caller does with its own later.
  const copy = (bytes: Uint8Array | ArrayBuffer) => new Uint8Array(buffer(bytes).slice(0));
  // Each field read as given (a getter of a class's too), not spread.
  const fonts: ImageFont[] = (options.fonts ?? []).map((font) => ({
    family: font.family,
    src: copy(font.src),
    ...(font.weight !== undefined ? { weight: font.weight } : {}),
    ...(font.style !== undefined ? { style: font.style } : {}),
  }));
  const images = Object.fromEntries(Object.entries(options.images ?? {}).map(([url, bytes]) => [url, copy(bytes)]));
  const digest = (bytes: Uint8Array | ArrayBuffer) => sha256Hex(new Uint8Array(buffer(bytes)));
  const versions = { "@hyper-elements/react": installedVersion("@hyper-elements/react"), satori: installedVersion("satori"), "@resvg/resvg-js": installedVersion("@resvg/resvg-js") };
  const unread = Object.keys(versions).filter((name) => versions[name as keyof typeof versions] === "unknown");
  // Where a version can't be read (an app bundled into one file), names don't follow it: said in each render.
  const notes: Diagnostic[] = unread.length
    ? [
        {
          code: "image/engine-version",
          severity: "warning",
          message: `${unread.join(" and ")}'s installed version can't be read here (an app bundled into one file): the pictures' file names don't change with it, so a file cached for good may be another version's drawing`,
          fix: `keep ${unread.join(" and ")} in node_modules beside the app, unbundled`,
          path: "root",
        },
      ]
    : [];
  const key = sha256Hex(
    utf8Encode(
      JSON.stringify({
        drawer: 1,
        elements: versions["@hyper-elements/react"],
        satori: versions.satori,
        resvg: versions["@resvg/resvg-js"],
        scale,
        fonts: fonts.map((font) => [font.family, font.weight ?? 400, font.style ?? "normal", digest(font.src)]),
        images: Object.keys(images)
          .sort()
          .map((url) => [url, digest(images[url]!)]),
      })
    )
  );
  return {
    key,
    notes,
    suffix: `${scale}x`,
    extension: "png",
    contentType: "image/png",
    async draw({ root, layout }) {
      readable(layout, "image");
      // The Email's fonts are the picture's: one with no file is an error only where the picture's text names it.
      const { context, diagnostics, found, strict } = readied(root, [], { fonts, images, scale }, false, true);
      const { layout: measured, sizes } = await measure(context, { strict, scale });
      // A font or a character with no file is an error: the picture would be in another type than the email around it,
      // or show boxes. What runs past it is a warning, as for any Canvas. Fonts are given to emailImages() here.
      const all = [...diagnostics, ...found, ...otherFamilies(root, context.fonts), ...rightToLeft(root), ...measured.diagnostics].map((d) => ({
        ...d,
        ...(d.code === "image/font" || d.code === "image/glyph" ? { severity: "error" as const } : {}),
        message: d.message.replace(/renderImage's fonts option/g, "emailImages({ fonts })"),
      }));
      if (all.some((d) => d.severity === "error")) throw new ElementsError(all);
      const canvas = writeCanvas(root, { families: context.families, fallback: context.fallback, fonts: context.fonts, image: context.image, sizes });
      return { bytes: await satoriResvg(canvas, { format: "png", scale }), diagnostics: all };
    },
  };
}

/** Given to prepare(): this entry decides a template's measured rules, so they're handed over, not refused. */
const DECIDES = Symbol.for("hyper-elements.decides-measured");

/**
 * A snapshot's or a template design's template, and the measured rules it requires that its check left undecided:
 * this entry decides them. prepare() hands them over when asked with DECIDES.
 */
interface Pending {
  rules: Array<{ rule: string; format?: string }>;
  template?: { id: string };
}

/** Each measured rule a template requires: failed where its code was found (raised to an error), else passed. */
function decide(pending: Pending, diagnostics: Diagnostic[]): void {
  for (const { rule } of pending.rules) {
    for (let i = 0; i < diagnostics.length; i++) {
      const d = diagnostics[i];
      if (d.code === rule) diagnostics[i] = { ...d, severity: "error", message: `${d.message} (required by ${pending.template?.id ?? "the template"})` };
    }
  }
}

export interface TemplateAssets {
  /** The Canvas's own font faces (its `fonts` prop), as it gives them: a file for each goes in renderImage's `fonts`, by its family, weight and style. */
  fonts: FontFace[];
  /** Each Image's URL as the template gives it, once, in the order they're drawn: its file goes in renderImage's `images`, by that URL. */
  images: string[];
}

/**
 * The font and image sources renderImage() looks for in a Canvas, from the walks it makes itself: what a tool loads and
 * gives it in `fonts` and `images`. A data: URI is read as it is (a font's, where no file is given in `fonts` for its
 * family). Rejects a template as renderImage() does: with errors, or with a root other than a Canvas.
 */
export function templateAssets(element: ReactElement | Snapshot): TemplateAssets {
  const { root } = canvasOf(element);
  return { fonts: [...facesOf(root)], images: [...new Set(imagesOf(root).map(({ src }) => src))] };
}

/** The Canvas a template is, with prepare()'s diagnostics and what its template left to decide; a template with errors, or another root, throws. */
function canvasOf(element: ReactElement | Snapshot): { root: ResolvedNode; diagnostics: Diagnostic[]; pending: Pending } {
  const prepared = prepare(element, { [DECIDES]: true } as never) as ReturnType<typeof prepare> & { [DECIDES]?: Array<{ rule: string; format?: string }> };
  const { root, diagnostics, layout } = prepared;
  const pending: Pending = { rules: [...(prepared[DECIDES] ?? [])], ...(prepared.template ? { template: prepared.template } : {}) };
  readable(layout, "image");
  if (!root) throw new ElementsError(diagnostics);
  if (root.type !== "Canvas") {
    throw new ElementsError([...diagnostics, { code: "image/root", severity: "error", message: `Image output is a Canvas's: this template is a ${root.type}`, path: "root" }]);
  }
  // What prepare() says of fit is the HTML preview's (its largest size); the image measures it.
  return { root, diagnostics: diagnostics.filter((d) => !(d.code === "web/degraded" && /\.props\.fit$/.test(d.path))), pending };
}

/**
 * The tree prepare() gives, read as this entry's copy of the core lays it out: from another copy of Elements that
 * writes another layout version (a second install of the package, or an older one beside it), it's refused rather than
 * drawn wrong.
 */
function readable(layout: unknown, output: "pdf" | "image"): void {
  if (layout === LAYOUT_VERSION) return;
  throw new ElementsError([
    {
      code: `${output}/version`,
      severity: "error",
      message: `@hyper-elements/react/${output} reads layout version ${LAYOUT_VERSION}; the main entry writes ${typeof layout === "number" ? layout : "none"}: update @hyper-elements/react`,
      path: "root",
    },
  ]);
}

// ─── Fonts ─────────────────────────────────────────────────────────────────

const buffer = (bytes: Uint8Array | ArrayBuffer): ArrayBuffer => {
  if (bytes instanceof ArrayBuffer) return bytes;
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
};
const weight = (value: number | undefined) => (Math.min(900, Math.max(100, Math.round((value ?? 400) / 100) * 100)) as Font["weight"]);

/** The fonts the image is drawn with: those given, and the Canvas's own given as data: URIs. None is an error. */
/** A WOFF2 file, by its first bytes: an image draws TTF, OTF and WOFF files, not these. */
const woff2 = (bytes: ArrayBuffer | Uint8Array) => String.fromCharCode(...new Uint8Array(buffer(bytes)).subarray(0, 4)) === "wOF2";

/** The Canvas's own font faces (its `fonts` prop): the files renderImage's fonts option gives, or data: URIs. */
const facesOf = (root: ResolvedNode): FontFace[] => (root.props.fonts as FontFace[] | undefined) ?? [];

function fontsOf(root: ResolvedNode, given: ImageFont[], found: Diagnostic[], strict = false, used?: Set<string>): Font[] {
  const level = strict ? ("error" as const) : ("warning" as const);
  const drawn = (family: string, bytes: ArrayBuffer | Uint8Array) => {
    if (!woff2(bytes)) return true;
    found.push({ code: "image/font", severity: level, message: `${family}'s file is WOFF2: an image draws TTF, OTF and WOFF files. Its text is drawn in another font meanwhile`, path: "root.props.fonts" });
    return false;
  };
  const out: Font[] = given.filter((font) => drawn(font.family, font.src)).map((font) => ({ family: font.family, data: buffer(font.src), weight: weight(font.weight), style: font.style ?? "normal" }));
  const named = new Set(out.map((font) => font.family.toLowerCase()));
  for (const face of facesOf(root)) {
    if (named.has(face.family.toLowerCase())) continue;
    const data = /^data:[^,]*;base64,(.*)$/.exec(face.src)?.[1];
    if (data && !drawn(face.family, Uint8Array.from(Buffer.from(data, "base64")))) continue;
    if (data) {
      out.push({ family: face.family, data: buffer(Uint8Array.from(Buffer.from(data, "base64"))), weight: weight(Array.isArray(face.weight) ? face.weight[0] : face.weight), style: face.style ?? "normal" });
      continue;
    }
    if (used && !used.has(face.family.toLowerCase())) continue;
    found.push({ code: "image/font", severity: level, message: `Image output loads no fonts: give ${face.family}'s file in renderImage's fonts option. Its text is drawn in another font meanwhile`, path: "root.props.fonts" });
  }
  if (!out.length && hasText(root)) {
    found.push({ code: "image/font", severity: "error", message: "An image draws its text with the fonts it's given, and has none: give a font file in renderImage's fonts option", path: "root" });
  }
  return out;
}

/** Text in a weight or style of a family that isn't given: drawn in the nearest given (a browser would fake it). */
/**
 * Text whose font stack names no family given: drawn in the first font given, another type than the email around it
 * shows. Said once for each stack (an Email's pictures: emailImages()).
 */
function otherFamilies(root: ResolvedNode, fonts: Font[]): Diagnostic[] {
  const given = new Set(fonts.map((font) => font.family.toLowerCase()));
  const fallback = fonts[0]?.family;
  const out = new Map<string, Diagnostic>();
  const visit = (node: ResolvedNode) => {
    if (node.hidden?.desktop) return;
    if (fallback && node.children.some((child) => typeof child === "string" && child.trim())) {
      const stack = String(node.text.fontFamily);
      if (!fontStack(stack).some((name) => given.has(name.toLowerCase())) && !out.has(stack)) {
        out.set(stack, {
          code: "image/font-family",
          severity: "warning",
          message: `Text in ${stack} is drawn in ${fallback}: none of its fonts is given. Give its file in emailImages({ fonts })`,
          path: node.path,
          ...(node.id ? { nodeId: node.id } : {}),
        });
      }
    }
    for (const child of node.children) if (typeof child !== "string") visit(child);
  };
  visit(root);
  return [...out.values()];
}

function missingFaces(root: ResolvedNode, fonts: Font[], strict = false): Diagnostic[] {
  const out = new Map<string, Diagnostic>();
  const given = new Map<string, Font[]>();
  for (const font of fonts) given.set(font.family.toLowerCase(), [...(given.get(font.family.toLowerCase()) ?? []), font]);
  const visit = (node: ResolvedNode) => {
    if (node.hidden?.desktop) return;
    if (node.children.some((child) => typeof child === "string" && child.trim())) {
      const stack = fontStack(String(node.text.fontFamily));
      const family = stack.find((name) => given.has(name.toLowerCase())) ?? fonts[0]?.family;
      const faces = family ? given.get(family.toLowerCase()) ?? [] : [];
      const weight = node.text.fontWeight;
      const style = node.text.fontStyle;
      if (family && !faces.some((face) => face.weight === weight && (face.style ?? "normal") === style)) {
        const key = `${family}|${weight}|${style}`;
        if (!out.has(key)) {
          const has = faces.map((face) => `${face.weight}${face.style === "italic" ? " italic" : ""}`).join(", ");
          out.set(key, {
            code: "image/font-weight",
            severity: strict ? "error" : "warning",
            message: `Text in ${family} at ${weight}${style === "italic" ? " italic" : ""}, which is given at ${has} only: it's drawn in the nearest. Give that file in renderImage's fonts option`,
            path: node.path,
            ...(node.id ? { nodeId: node.id } : {}),
          });
        }
      }
    }
    for (const child of node.children) if (typeof child !== "string") visit(child);
  };
  visit(root);
  return [...out.values()];
}

/** A letter of a script written right to left (Hebrew, Arabic, Syriac, Thaana, N'Ko and their forms). */
const RIGHT_TO_LEFT = /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufefc]/;

/**
 * Text in a right-to-left script, which the engine draws left to right (its letters reversed, Arabic's unjoined): an
 * error in an Email's picture, the email's own text being right. Said once for each place.
 */
function rightToLeft(root: ResolvedNode): Diagnostic[] {
  const out: Diagnostic[] = [];
  const visit = (node: ResolvedNode) => {
    if (node.hidden?.desktop) return;
    const found = drawnText(node).find((text) => RIGHT_TO_LEFT.test(text));
    if (found) {
      out.push({
        code: "image/direction",
        severity: "error",
        message: `"${found.trim().slice(0, 40)}" is in a script written right to left, which a picture draws left to right, its letters reversed`,
        fix: "put that text in a Text beside or over the picture",
        path: node.path,
        ...(node.id ? { nodeId: node.id } : {}),
      });
      return;
    }
    for (const child of node.children) if (typeof child !== "string") visit(child);
  };
  visit(root);
  return out;
}

/** The families the font stacks of its text (shown on desktop) name, lowercased: the text the image writer draws. */
function textFamilies(root: ResolvedNode): Set<string> {
  const out = new Set<string>();
  const visit = (node: ResolvedNode) => {
    if (node.hidden?.desktop) return;
    if (drawnText(node).some((text) => text.trim())) for (const name of fontStack(String(node.text.fontFamily))) out.add(name.toLowerCase());
    for (const child of node.children) if (typeof child !== "string") visit(child);
  };
  visit(root);
  return out;
}

/** Whether it draws any text (shown on desktop). */
function hasText(node: ResolvedNode): boolean {
  if (node.hidden?.desktop) return false;
  return node.children.some((child) => (typeof child === "string" ? child.trim() !== "" : hasText(child)));
}

// ─── Images ────────────────────────────────────────────────────────────────

function mime(bytes: Uint8Array): string | undefined {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
  const head = new TextDecoder().decode(bytes.subarray(0, 256)).trimStart();
  if (head.startsWith("<svg") || head.startsWith("<?xml")) return "image/svg+xml";
  return undefined;
}

const DRAWN = /^data:image\/(png|jpeg|jpg|gif|svg\+xml)[;,]/;

/** Each image's source as an engine loads it without the network: a data URI; an image without one, an error. */
function imageSources(root: ResolvedNode, given: Record<string, Uint8Array | ArrayBuffer>, found: Diagnostic[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const { node, src } of imagesOf(root)) {
    const bytes = given[src] ? new Uint8Array(buffer(given[src])) : undefined;
    const type = bytes && mime(bytes);
    if (DRAWN.test(src)) out.set(src, src);
    else if (bytes && type) out.set(src, `data:${type};base64,${Buffer.from(bytes).toString("base64")}`);
    else {
      found.push({
        code: "image/image",
        severity: "error",
        message: bytes ? "This image's file isn't a PNG, JPEG, GIF or SVG" : "Image output loads no images: give this one's file in renderImage's images option (by its URL), or its src as a data: URI",
        path: `${node.path}.props.src`,
        ...(node.id ? { nodeId: node.id } : {}),
      });
    }
  }
  return out;
}

/** Each Image the canvas draws, in order, with its src (a Video is drawn as its title). Content hidden on desktop isn't drawn. */
function imagesOf(root: ResolvedNode): Array<{ node: ResolvedNode; src: string }> {
  const out: Array<{ node: ResolvedNode; src: string }> = [];
  const visit = (node: ResolvedNode) => {
    if (node.hidden?.desktop) return;
    if (node.type === "Image") out.push({ node, src: assetParts(node.props.src as Asset).src });
    for (const child of node.children) if (typeof child !== "string") visit(child);
  };
  visit(root);
  return out;
}
