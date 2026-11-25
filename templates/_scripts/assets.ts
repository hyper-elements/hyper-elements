/**
 * One resolver for the folder's assets: their public addresses (under `ASSETS`) map to the files in `templates/_assets/`,
 * so the tests, the preview and the website's generator load this checkout's files, never production's.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { ASSETS, type Brand } from "../_brand";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const ASSET_DIR = join(ROOT, "_assets");

/** The file an asset address names, or undefined where it's not one of this folder's. */
export function assetFile(url: string): string | undefined {
  if (!url.startsWith(ASSETS)) return undefined;
  const rel = normalize(decodeURIComponent(url.slice(ASSETS.length)));
  if (rel.startsWith("..") || rel.includes("\0")) return undefined;
  return join(ASSET_DIR, rel);
}

/** An asset's bytes, throwing where the address isn't the folder's or its file is missing. */
export function assetBytes(url: string): Uint8Array {
  const file = assetFile(url);
  if (!file) throw new Error(`${url} isn't under ${ASSETS}`);
  if (!existsSync(file)) throw new Error(`${url} has no file at ${file}`);
  return new Uint8Array(readFileSync(file));
}

/** A brand's fonts as the PDF and image engines take them: bytes, one weight and style each. */
export function fontFiles(brand: Brand): Array<{ family: string; src: Uint8Array; weight: number; style: "normal" | "italic" }> {
  return brand.fonts.map((face) => ({ family: face.family, src: assetBytes(face.src), weight: face.weight, style: face.style }));
}

/** The bytes of every image a design shows, by address, for `renderPdf()` and `renderImage()`. */
export function imageFiles(urls: readonly string[]): Record<string, Uint8Array> {
  return Object.fromEntries(urls.map((url) => [url, assetBytes(url)]));
}
