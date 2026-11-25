/**
 * Images, by arithmetic and by their bytes: the size that keeps an image's aspect inside a box (`fitInside()`), and
 * an image file's size, type and transparency read from its header (`sniffImage()`), in plain JavaScript with no Node
 * API, so it runs wherever a template does.
 */
import type { Diagnostic, PropSpecs } from "@hyper-elements/core";
import { coverCrop } from "./checks";
import { imagePaths, type ImageType } from "./fields";
import type { RuleResult } from "./rules";
import { isSlot } from "./slots";

/**
 * The size an image is shown at to fit whole inside `box`, at its own aspect: for a `contain` image's `style`, so a
 * template doesn't do the arithmetic (and its check finds it neither cropped nor distorted).
 */
export function fitInside(image: { width: number; height: number }, box: { width: number; height: number }): { width: number; height: number } {
  if (!(image.width > 0 && image.height > 0 && box.width > 0 && box.height > 0)) {
    throw new TypeError("[Elements] fitInside() takes an image's { width, height } and a box's, each above 0");
  }
  const scale = Math.min(box.width / image.width, box.height / image.height);
  // Down to a hundredth of a px, so the size never passes the box.
  const floor = (n: number) => Math.floor(n * 100 + 1e-6) / 100;
  return { width: floor(image.width * scale), height: floor(image.height * scale) };
}

/** What an image file's header says: its size in px, its type, and whether it can be transparent. */
export interface SniffedImage {
  width: number;
  height: number;
  type: ImageType;
  /** It has an alpha channel or a transparent color (an SVG is always taken as able to be transparent). */
  alpha: boolean;
}

const ascii = (bytes: Uint8Array, at: number, length: number) => String.fromCharCode(...bytes.subarray(at, at + length));
const u32 = (bytes: Uint8Array, at: number) => ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
const u16 = (bytes: Uint8Array, at: number) => (bytes[at] << 8) | bytes[at + 1];
const u16le = (bytes: Uint8Array, at: number) => bytes[at] | (bytes[at + 1] << 8);

/** A PNG, JPEG, GIF or SVG file's size, type and transparency, from its header; undefined for anything else. */
export function sniffImage(input: Uint8Array | ArrayBuffer): SniffedImage | undefined {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  return png(bytes) ?? jpeg(bytes) ?? gif(bytes) ?? svg(bytes);
}

function png(bytes: Uint8Array): SniffedImage | undefined {
  if (bytes.length < 33 || ascii(bytes, 1, 3) !== "PNG" || bytes[0] !== 0x89 || ascii(bytes, 12, 4) !== "IHDR") return undefined;
  const colorType = bytes[25];
  // An alpha channel (grey or color with alpha), or a transparent color (a tRNS chunk before the image data).
  let alpha = colorType === 4 || colorType === 6;
  for (let at = 8; !alpha && at + 8 <= bytes.length; ) {
    const length = u32(bytes, at);
    const type = ascii(bytes, at + 4, 4);
    if (type === "tRNS") alpha = true;
    if (type === "IDAT" || type === "IEND") break;
    at += 12 + length;
  }
  return { width: u32(bytes, 16), height: u32(bytes, 20), type: "png", alpha };
}

function jpeg(bytes: Uint8Array): SniffedImage | undefined {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined;
  for (let at = 2; at + 9 < bytes.length; ) {
    if (bytes[at] !== 0xff) return undefined;
    const marker = bytes[at + 1];
    // Fill bytes, and markers with no length (restart markers, TEM).
    if (marker === 0xff) {
      at++;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      at += 2;
      continue;
    }
    // A frame's start (baseline, progressive, …; not DHT, JPG or DAC): its height, then its width.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { width: u16(bytes, at + 7), height: u16(bytes, at + 5), type: "jpeg", alpha: false };
    }
    at += 2 + u16(bytes, at + 2);
  }
  return undefined;
}

function gif(bytes: Uint8Array): SniffedImage | undefined {
  const signature = ascii(bytes, 0, 6);
  if (bytes.length < 13 || (signature !== "GIF87a" && signature !== "GIF89a")) return undefined;
  // A transparent color: a graphic control extension (0x21 0xF9) with its transparency flag set.
  let alpha = false;
  for (let at = 13; at + 3 < bytes.length && !alpha; at++) if (bytes[at] === 0x21 && bytes[at + 1] === 0xf9 && bytes[at + 2] === 0x04) alpha = (bytes[at + 3] & 1) === 1;
  return { width: u16le(bytes, 6), height: u16le(bytes, 8), type: "gif", alpha };
}

function svg(bytes: Uint8Array): SniffedImage | undefined {
  const head = new TextDecoder().decode(bytes.subarray(0, 4096));
  const tag = /<svg\b[^>]*>/i.exec(head)?.[0];
  if (!tag) return undefined;
  const attribute = (name: string) => new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(tag)?.[1];
  const px = (value: string | undefined) => {
    const match = value === undefined ? null : /^\s*(\d+(?:\.\d+)?)\s*(px)?\s*$/.exec(value);
    return match ? Number(match[1]) : undefined;
  };
  const box = attribute("viewBox")?.trim().split(/[\s,]+/).map(Number);
  const fromBox = box && box.length === 4 && box.every(Number.isFinite) && box[2] > 0 && box[3] > 0 ? { width: box[2], height: box[3] } : undefined;
  const [givenWidth, givenHeight] = [px(attribute("width")), px(attribute("height"))];
  // One side given: the other at the viewBox's aspect.
  const width = givenWidth ?? (givenHeight !== undefined && fromBox ? (givenHeight * fromBox.width) / fromBox.height : fromBox?.width);
  const height = givenHeight ?? (givenWidth !== undefined && fromBox ? (givenWidth * fromBox.height) / fromBox.width : fromBox?.height);
  if (width === undefined || height === undefined) return undefined;
  return { width, height, type: "svg", alpha: true };
}

// ─── checkLayout(): a measured layout checked by the template ───────────────


/** The part of `layoutImage()`'s result `checkLayout()` reads. */
export interface MeasuredLayout {
  nodes: ReadonlyArray<{ path: string; field?: string; type: string; width: number; height: number }>;
  fits: ReadonlyArray<{ path: string; field?: string; sizes: number[]; chosen: number | null; next?: { size: number; lines: number; widestWord?: string } }>;
  diagnostics: readonly Diagnostic[];
}

/** What `checkLayout()` takes beside a template and its values. */
export interface CheckLayoutOptions {
  format?: string;
  /** Pixels per px, as it's rendered: the format's, or the caller's. */
  scale?: number;
  /** `layoutImage()`'s result for the format's snapshot. */
  layout: MeasuredLayout;
  /** Each image field's file, sniffed (`sniffImage()`), by its field path. */
  files?: Record<string, SniffedImage>;
  /** `check()`'s result, whose measured rules this decides. */
  checked?: { rules: readonly RuleResult[] };
}

/** What `checkLayout()` returns: each region's box and pixels, the fitted text by field, the rules complete, and what it found. */
export interface LayoutCheck {
  regions: Record<string, Record<string, { box: [number, number]; pixels: [number, number] }>>;
  fits: MeasuredLayout["fits"];
  rules: RuleResult[];
  diagnostics: Diagnostic[];
}

const fail = (code: string, message: string, path: string, field?: string): Diagnostic => ({ code, severity: "error", message, path, ...(field ? { field } : {}) });
const round = (n: number) => Math.round(n * 100) / 100;

/**
 * A template's checks on a measured layout (`layoutImage()` of its snapshot): each image's region and the pixels it
 * needs at the scale it's rendered, its file against its rules and its declared size, and the measured rules the
 * template requires decided. Synchronous and pure: the caller measures, and sniffs the files.
 */
export function checkLayout(template: { id: string; fields: PropSpecs; formats?: Record<string, { scale?: number }> }, values: unknown, options: CheckLayoutOptions): LayoutCheck {
  const format = options.format ?? "default";
  const scale = options.scale ?? (options.format !== undefined ? template.formats?.[options.format]?.scale : undefined) ?? 1;
  const diagnostics: Diagnostic[] = [];
  const regions: LayoutCheck["regions"] = {};
  const boxes = new Map<string, { width: number; height: number }>();
  // What's under a slot's host is the slot's content: a `field` there is its own, never the template's binding.
  const hosts = options.layout.nodes.filter((node) => node.field !== undefined && Object.hasOwn(template.fields, node.field) && isSlot(template.fields[node.field])).map((node) => `${node.path}.`);
  for (const node of options.layout.nodes) {
    if (!node.field || node.type !== "Image" || boxes.has(node.field) || hosts.some((host) => node.path.startsWith(host))) continue;
    boxes.set(node.field, node);
    regions[node.field] = { [format]: { box: [round(node.width), round(node.height)], pixels: [Math.round(node.width * scale), Math.round(node.height * scale)] } };
  }
  for (const { path, rules, value } of imagePaths(template.fields, values)) {
    const declared = value as { width: number; height: number; src: string };
    const file = options.files?.[path];
    const at = `values.${path}`;
    if (file) {
      if (Math.abs(file.width - declared.width) > 0.5 || Math.abs(file.height - declared.height) > 0.5) {
        diagnostics.push(fail("template/asset-size", `${path} says ${declared.width}×${declared.height}, and its file is ${file.width}×${file.height}: give the file's size`, at, path));
      }
      if (rules.accepts && !rules.accepts.includes(file.type)) diagnostics.push(fail("template/asset-type", `${path}'s file is ${file.type === "jpeg" ? "a JPEG" : `an ${file.type.toUpperCase()}`}; ${template.id} takes ${rules.accepts.map((t) => t.toUpperCase()).join(" or ")}`, at, path));
      if (rules.transparent === "required" && !file.alpha) diagnostics.push(fail("template/asset-alpha", `${path} has no transparency; ${template.id} needs a transparent background`, at, path));
      if (rules.transparent === "forbidden" && file.alpha) diagnostics.push(fail("template/asset-alpha", `${path} can be transparent; ${template.id} takes an image with no transparency`, at, path));
    }
    const box = boxes.get(path);
    if (!box) continue;
    const pixels = [box.width * scale, box.height * scale];
    const size = file ?? declared;
    if (size.width + 0.5 < pixels[0] || size.height + 0.5 < pixels[1]) {
      diagnostics.push(fail("template/asset-pixels", `${path} is ${size.width}×${size.height}; its region needs ${Math.round(pixels[0])}×${Math.round(pixels[1])} at ${scale}× (it would be upscaled)`, at, path));
    }
    if (rules.fit === "cover" && rules.maxCrop !== undefined) {
      const { share, side } = coverCrop(size, [box.width, box.height]);
      if (share > rules.maxCrop + 1e-9) diagnostics.push(fail("template/asset-cropped", `${path} loses ${Math.round(share * 100)}% of its ${side} to fill its region; ${template.id} takes at most ${Math.round(rules.maxCrop * 100)}%`, at, path));
    }
  }
  // The measured rules decided: failed where the layout found the rule's code, passed where it didn't.
  const rules = (options.checked?.rules ?? []).map((result): RuleResult => {
    if (result.status !== "not-run" || result.source !== "core" || (result.format !== undefined && options.format !== undefined && result.format !== options.format)) return result;
    const found = options.layout.diagnostics.filter((d) => d.code === result.rule).map((d) => ({ ...d, severity: "error" as const, message: `${d.message} (required by ${template.id})` }));
    diagnostics.push(...found);
    return { ...result, status: found.length ? "failed" : "passed", diagnostics: found };
  });
  return { regions, fits: options.layout.fits, rules, diagnostics };
}
