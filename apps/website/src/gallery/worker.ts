// The templates pages' image worker: draws an image template's design (templates/images/<name>/designs/) in a brand,
// as SVG, off the page's thread. scripts/gallery-runtime.mjs bundles it; src/scripts/gallery-images.ts starts it. Its fonts and images are
// this site's own files.
import { createElement } from "react";
import { renderImage, templateAssets } from "@hyper-elements/react/image";
import { templateRequest, type Template } from "@hyper-elements/react/template";
import { valuesIn } from "../../../../templates/_scripts/links";
// @ts-expect-error: written by scripts/gallery-runtime.mjs
import { brands, designs } from "virtual:gallery-catalog";
import type { Brand } from "../../../../templates/_brand";
import type { DrawImage, DrawnImage } from "./protocol";

const SITE = "https://hyperelements.dev/";
const files = new Map<string, Promise<Uint8Array>>();

/** A file a brand or a design names, from this site wherever it runs. */
function load(url: string): Promise<Uint8Array> {
  if (!url.startsWith(SITE)) return Promise.reject(new Error(`${url} isn't on this site`));
  let file = files.get(url);
  if (!file) {
    file = fetch(new URL(url.slice(SITE.length), self.location.origin).href).then(async (response) => {
      if (!response.ok) throw new Error(`${url} didn't load (${response.status})`);
      return new Uint8Array(await response.arrayBuffer());
    });
    file.catch(() => files.delete(url));
    files.set(url, file);
  }
  return file;
}

self.onmessage = async (event: MessageEvent<DrawImage>) => {
  const { id, design: key, brand: brandId } = event.data;
  let reply: DrawnImage;
  try {
    const entry = (designs as Record<string, { make: (brand: Brand) => Template; Design: () => unknown }>)[key];
    const brand = (brands as Record<string, Brand>)[brandId];
    if (!entry || !brand) throw new Error(`There's no ${key} in ${brandId}`);
    // The design's values, its links moved to this brand's site, drawn by the template made from this brand.
    const values = templateRequest(createElement(entry.Design as never)).props;
    if (!values) throw new Error(`${key} isn't a design made from its template`);
    const design = entry.make(brand).design(valuesIn(values, brand, Object.values(brands as Record<string, Brand>)) as never);
    const [fonts, images] = await Promise.all([
      Promise.all(brand.fonts.map(async (face) => ({ ...face, src: await load(face.src) }))),
      Promise.all(templateAssets(design).images.map(async (src) => [src, await load(src)] as const)),
    ]);
    const drawn = await renderImage(design, { fonts, images: Object.fromEntries(images), format: "svg" });
    reply = { id, ok: true, svg: new TextDecoder().decode(drawn.image) };
  } catch (error) {
    reply = { id, ok: false, message: error instanceof Error ? error.message : String(error) };
  }
  (self as unknown as Worker).postMessage(reply);
};
