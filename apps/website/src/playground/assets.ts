// The files a Document's PDF or a Canvas's image is drawn with. The sandbox can't fetch (it has no network), so the
// page does, for what the template names, and only from where it says here:
//
//   fonts   the fallback from this site; a font with its own address (a template's brand fonts) from there, the
//           site's own from this site; any other named family from Fontsource's files on jsDelivr, by its name alone
//   images  this site's own (/img/…, and the templates' assets); any other over https, without cookies or a referrer
import type { FontFile, FontNeed } from "../../playground/protocol";

const MAX_FONTS = 12;
const MAX_IMAGES = 12;
const MAX_IMAGE_BYTES = 5_000_000;
const MAX_FONT_BYTES = 3_000_000;

const FALLBACK = "Liberation Sans";
/** Families a machine has and Fontsource doesn't: drawn in the fallback, without asking for them. */
const SYSTEM = new Set(["arial", "helvetica", "helvetica neue", "georgia", "times", "times new roman", "verdana", "tahoma", "trebuchet ms", "courier", "courier new", "segoe ui", "menlo", "monaco", "consolas", "sfmono-regular", "sf mono", "sf pro text", "sf pro display", "liberation sans"]);

const files = new Map<string, Promise<Uint8Array | undefined>>();

/** How long a file may take to arrive. */
const TIMEOUT = 12_000;

function fetched(key: string, url: string, limit: number, init: RequestInit = {}): Promise<Uint8Array | undefined> {
  if (!files.has(key)) {
    const stop = new AbortController();
    const late = window.setTimeout(() => stop.abort(), TIMEOUT);
    files.set(
      key,
      fetch(url, { ...init, signal: stop.signal })
        .then(async (response) => {
          if (!response.ok || !response.body) return undefined;
          // Read as it arrives, and no further than the limit, whatever length the response says it has.
          const reader = response.body.getReader();
          const chunks: Uint8Array[] = [];
          let size = 0;
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.length;
            if (size > limit) {
              stop.abort();
              return undefined;
            }
            chunks.push(value);
          }
          const bytes = new Uint8Array(size);
          let at = 0;
          for (const chunk of chunks) {
            bytes.set(chunk, at);
            at += chunk.length;
          }
          return bytes;
        })
        .catch(() => {
          // Offline, too slow, or a host that doesn't share its files: tried again next time.
          files.delete(key);
          return undefined;
        })
        .finally(() => clearTimeout(late)),
    );
  }
  return files.get(key)!;
}

const fontUrl = ({ family, weight, style }: FontNeed): string | undefined => {
  const slug = family.trim().toLowerCase().replace(/\s+/g, "-");
  if (!/^[a-z0-9-]{1,60}$/.test(slug) || SYSTEM.has(family.trim().toLowerCase())) return undefined;
  const hundred = Math.min(900, Math.max(100, Math.round(weight / 100) * 100));
  return `https://cdn.jsdelivr.net/fontsource/fonts/${slug}@latest/latin-${hundred}-${style === "italic" ? "italic" : "normal"}.ttf`;
};

export interface Assets {
  fonts: FontFile[];
  images: Record<string, Uint8Array>;
  /** What couldn't be fetched, in words. */
  missing: string[];
}

/**
 * The site's own files, which the examples and the templates name by its address: images under /img/, and the templates'
 * fonts and images under /generated/gallery/assets/. They load from this site, wherever it runs, so a local or preview build
 * shows its own files, not the live site's.
 */
export const ownFile = (url: string): string | undefined =>
  /^https:\/\/(www\.)?hyperelements\.dev\/(img|generated\/gallery\/assets)\/[\w./-]+$/.exec(url) && !url.includes("..") ? new URL(url).pathname : undefined;
const ownImage = ownFile;

/** The templates' assets' address on the live site, as it's written in their HTML. */
export const GALLERY_ASSETS = /https:\/\/(?:www\.)?hyperelements\.dev\/generated\/gallery\/assets\/[\w./-]+/g;

/** Where a font need's file comes from: its own address (this site's where it's the site's), else Fontsource by its family. */
const fontSource = (need: FontNeed): { key: string; url: string; init?: RequestInit } | undefined => {
  if (need.url && /^https:\/\//.test(need.url)) {
    const own = ownFile(need.url);
    return own ? { key: `font ${own}`, url: own } : { key: `font ${need.url}`, url: need.url, init: { credentials: "omit", referrerPolicy: "no-referrer", mode: "cors" } };
  }
  const url = fontUrl(need);
  return url ? { key: `font ${url}`, url, init: { credentials: "omit", referrerPolicy: "no-referrer" } } : undefined;
};

/** A font file of the site's own as a data: URL, for an HTML preview whose policy loads fonts only over https or as data. */
export async function fontDataUrl(url: string): Promise<string | undefined> {
  const own = ownFile(url);
  if (!own || !/\.(ttf|otf|woff2?)$/i.test(own)) return undefined;
  const bytes = await fetched(`font ${own}`, own, MAX_FONT_BYTES);
  if (!bytes) return undefined;
  const type = /\.otf$/i.test(own) ? "font/otf" : /\.woff2$/i.test(own) ? "font/woff2" : /\.woff$/i.test(own) ? "font/woff" : "font/ttf";
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${type};base64,${btoa(binary)}`;
}

export async function fetchAssets(needs: { fonts: FontNeed[]; images: string[] } | undefined, options: { fallback: boolean }): Promise<Assets> {
  const missing: string[] = [];
  const fonts: FontFile[] = [];
  if (options.fallback) {
    // First, so text in a family that isn't to be had is drawn in it.
    const [regular, bold] = await Promise.all([
      fetched("fallback-400", "/playground/fonts/LiberationSans-Regular.ttf", MAX_FONT_BYTES),
      fetched("fallback-700", "/playground/fonts/LiberationSans-Bold.ttf", MAX_FONT_BYTES),
    ]);
    if (regular) fonts.push({ family: FALLBACK, weight: 400, style: "normal", src: regular });
    if (bold) fonts.push({ family: FALLBACK, weight: 700, style: "normal", src: bold });
  }
  const wanted = (needs?.fonts ?? []).filter((need) => fontSource(need)).slice(0, MAX_FONTS);
  const loaded = await Promise.all(
    wanted.map((need) => {
      const source = fontSource(need)!;
      return fetched(source.key, source.url, MAX_FONT_BYTES, source.init);
    }),
  );
  const unfound = new Set<string>();
  wanted.forEach((need, i) => {
    const src = loaded[i];
    const { url: _, ...face } = need;
    if (src) fonts.push({ ...face, src });
    else unfound.add(need.family);
  });
  // A family none of whose files came: said once.
  for (const family of unfound) if (!fonts.some((font) => font.family === family)) missing.push(`font ${family}`);

  const images: Record<string, Uint8Array> = {};
  const urls = (needs?.images ?? []).filter((url) => /^https:\/\//.test(url)).slice(0, MAX_IMAGES);
  const bytes = await Promise.all(
    urls.map((url) => {
      const own = ownImage(url);
      return own ? fetched(`image ${own}`, own, MAX_IMAGE_BYTES) : fetched(`image ${url}`, url, MAX_IMAGE_BYTES, { credentials: "omit", referrerPolicy: "no-referrer", mode: "cors" });
    }),
  );
  urls.forEach((url, i) => {
    if (bytes[i]) images[url] = bytes[i]!;
    else missing.push(`image ${url.length > 60 ? `${url.slice(0, 57)}…` : url}`);
  });
  return { fonts, images, missing };
}
