// An image template drawn live, in the visitor's browser: an <img data-draw="images/og-card" data-draw-brand="orbit">
// is drawn by the image worker (src/gallery/worker.ts) when it comes near the screen, and again in another brand
// (inBrand()). One worker for the page; each design in each brand is drawn once.
import type { DrawImage, DrawnImage } from "../gallery/protocol";

let worker: Worker | undefined;
let next = 0;
const waiting = new Map<number, (reply: DrawnImage) => void>();
const drawn = new Map<string, Promise<DrawnImage>>();

function ask(design: string, brand: string): Promise<DrawnImage> {
  const key = `${design} ${brand}`;
  let reply = drawn.get(key);
  if (!reply) {
    if (!worker) {
      worker = new Worker("/generated/gallery/runtime.js");
      worker.onmessage = (event: MessageEvent<DrawnImage>) => {
        waiting.get(event.data.id)?.(event.data);
        waiting.delete(event.data.id);
      };
      worker.onerror = () => {
        for (const [id, done] of waiting) done({ id, ok: false, message: "The image engine didn't load" });
        waiting.clear();
        drawn.clear();
        worker = undefined;
      };
    }
    const request: DrawImage = { id: ++next, design, brand };
    reply = new Promise((resolve) => waiting.set(request.id, resolve));
    drawn.set(key, reply);
    // A drawing that failed (a file that didn't load) is asked for again next time, not kept.
    void reply.then((answer) => {
      if (!answer.ok && drawn.get(key) === reply) drawn.delete(key);
    });
    worker.postMessage(request);
  }
  return reply;
}

const urls = new Map<string, string>();

/** Draws an image in its brand now, unless it's drawn in it already. */
export async function draw(image: HTMLImageElement) {
  const { draw: design, drawBrand: brand } = image.dataset;
  if (!design || !brand || image.dataset.drawn === brand) return;
  image.dataset.drawn = brand;
  const reply = await ask(design, brand);
  if (image.dataset.drawBrand !== brand) return;
  if (!reply.ok) {
    image.dataset.drawn = "";
    console.error(`${design} in ${brand}: ${reply.message}`);
    return;
  }
  const key = `${design} ${brand}`;
  if (!urls.has(key)) urls.set(key, URL.createObjectURL(new Blob([reply.svg], { type: "image/svg+xml" })));
  image.src = urls.get(key)!;
}

const isNear = (image: HTMLImageElement) => {
  const box = image.getBoundingClientRect();
  return box.width > 0 && box.top < innerHeight + 600 && box.bottom > -600;
};
const near = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && draw(e.target as HTMLImageElement)), { rootMargin: "600px 0px" });

/** Draws each image as it comes near the screen. */
export const watch = (images: Iterable<HTMLImageElement>) => [...images].forEach((image) => near.observe(image));

/** Shows an image in another brand: drawn now if it's near the screen, else when it comes near. */
export function inBrand(image: HTMLImageElement, brand: string) {
  image.dataset.drawBrand = brand;
  if (isNear(image)) void draw(image);
}
