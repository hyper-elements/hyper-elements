/**
 * A template's design as the real editor needs it in a story. The editor is a page on another origin, so a relative
 * image source means nothing to it, and on a local Storybook the browser won't let it read localhost at all: images
 * go in as data URIs (or, where one can't be read, as absolute URLs). Its font picker gets the template's fonts. Only
 * the editor's copy changes: `toDesign` doesn't.
 */
import type { ReactElement } from "react";
import { fontStylesheet, fontWeights, isFontKey, type Face } from "../builder/fonts";
import type { Design } from "../builder/write";

/** A source that names no origin of its own: `gallery/oyen/fr2.png`, not `https://…`, `data:…` or `//…`. */
const RELATIVE = /^(?![a-z][a-z0-9+.-]*:|\/\/|#)./i;

/** An image's bytes as a data URI, or its absolute URL where they can't be read. */
async function readable(src: string, base: string): Promise<string> {
  const url = new URL(src, base).href;
  try {
    const response = await fetch(url);
    if (!response.ok) return url;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const binary = bytes.reduce((text, byte) => text + String.fromCharCode(byte), "");
    return `data:${response.headers.get("content-type") ?? "image/png"};base64,${btoa(binary)}`;
  } catch {
    return url;
  }
}

const IMAGE_IN_HTML = /\bsrc=(["'])(.*?)\1/g;

/** The design for the editor, and its `fonts` option. */
export async function forTheEditor(template: ReactElement, design: Design, base: string) {
  const faces = (template.props as { fonts?: Face[] }).fonts ?? [];
  const families = [...new Set(faces.map((face) => face.family))];
  const stacks = new Map<string, string>();
  const weights = new Map<string, number[]>();

  /** The design with `image` applied to each of its image sources; `stacks` and `weights` have each font it names. */
  const walk = (value: unknown, image: (src: string) => string, key?: string, parent?: string): unknown => {
    if (Array.isArray(value)) return value.map((item) => walk(item, image, undefined, key));
    if (value && typeof value === "object") {
      const copy = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v, image, k, key)]));
      const { label, value: stack, weights: listed } = copy as { label?: unknown; value?: unknown; weights?: unknown };
      // A text tool's font, and a table's header, content and footer fonts.
      if (isFontKey(key) && typeof label === "string" && typeof stack === "string" && !stacks.has(label)) stacks.set(label, stack);
      if (isFontKey(key) && typeof label === "string" && Array.isArray(listed) && !weights.has(label)) weights.set(label, listed);
      return copy;
    }
    if (typeof value !== "string") return value;
    if (key === "url" && (parent === "src" || parent === "backgroundImage")) return image(value);
    if (key === "html") return value.replace(IMAGE_IN_HTML, (_, quote: string, src: string) => `src=${quote}${image(src)}${quote}`);
    return value;
  };

  const relative = new Set<string>();
  walk(design, (src) => (RELATIVE.test(src) && relative.add(src), src));
  const read = new Map(await Promise.all([...relative].map(async (src) => [src, await readable(src, base)] as const)));
  const copy = walk(design, (src) => read.get(src) ?? src) as Design;

  return {
    design: copy,
    fonts: {
      showDefaultFonts: true,
      customFonts: families.map((family) => ({
        label: family,
        value: stacks.get(family) ?? `'${family}', sans-serif`,
        url: fontStylesheet(family, faces.filter((face) => face.family === family)),
        // The design's own list, so picking the font keeps each block's weight; its faces' for a font no block is in.
        weights: weights.get(family) ?? fontWeights(faces.filter((face) => face.family === family)),
      })),
    },
  };
}
