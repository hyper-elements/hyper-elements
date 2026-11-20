// The templates pages' image worker: draws an image template (templates/images/) in a brand, as SVG, off the page's
// thread. scripts/gallery-runtime.mjs bundles it; src/scripts/gallery-images.ts starts it. Its fonts and images are
// this site's own files.
import { createElement } from "react";
import { renderImage, templateAssets } from "@hyper-elements/react/image";
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
    const Design = (designs as Record<string, (props: { brand: Brand }) => unknown>)[key];
    const brand = (brands as Record<string, Brand>)[brandId];
    if (!Design || !brand) throw new Error(`There's no ${key} in ${brandId}`);
    const design = createElement(Design as never, { brand });
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
