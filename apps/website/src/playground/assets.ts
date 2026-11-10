// The files a Document's PDF or a Canvas's image is drawn with. The sandbox can't fetch (it has no network), so the
// page does, for what the template names, and only from where it says here:
//
//   fonts   the fallback from this site; a named family from Fontsource's files on jsDelivr, by its name alone
//   images  this site's own (/img/…); any other over https, without cookies or a referrer
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

/** The site's own images, which the examples name by its address. */
const ownImage = (url: string): string | undefined => /^https:\/\/(www\.)?hyperelements\.dev\/img\/[\w./-]+$/.exec(url) && !url.includes("..") ? new URL(url).pathname : undefined;

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
  const wanted = (needs?.fonts ?? []).filter((need) => fontUrl(need)).slice(0, MAX_FONTS);
  const loaded = await Promise.all(wanted.map((need) => fetched(`font ${fontUrl(need)}`, fontUrl(need)!, MAX_FONT_BYTES, { credentials: "omit", referrerPolicy: "no-referrer" })));
  const unfound = new Set<string>();
  wanted.forEach((need, i) => {
    const src = loaded[i];
    if (src) fonts.push({ ...need, src });
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
