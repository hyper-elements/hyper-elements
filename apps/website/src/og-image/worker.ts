// The Open Graph image generator's worker: draws a design with the values the page sends, off the page's thread.
// scripts/og-image-runtime.mjs bundles it, and the page starts it from /tools/og-image/runtime.js. It runs only the
// site's own designs (examples/og-image/), never code a visitor wrote, and sends nothing anywhere: the visitor's photo
// and logo come in a message and the image goes back in one. The only requests are for the site's own files.
import { loadResvg } from "../../playground/sandbox/shims/resvg";
import { draw } from "./engine";
import type { DrawRequest, DrawReply } from "./protocol";

const SITE = "https://hyperelements.dev/";
const files = new Map<string, Promise<Uint8Array>>();

/** A file a design names, from this site: a design's fonts and the sample photo are under /tools/og-image/. */
function load(url: string): Promise<Uint8Array> {
  if (!url.startsWith(SITE)) return Promise.reject(new Error(`A design names ${url}, which isn't on this site`));
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

// resvg's WebAssembly, only for a browser that won't turn the SVG into a PNG itself.
let resvg: Promise<unknown> | undefined;
const readyForPng = () => (resvg ??= fetch("/playground/runtime/resvg.wasm").then((r) => r.arrayBuffer()).then((wasm) => loadResvg(wasm)));

self.onmessage = async (event: MessageEvent<DrawRequest>) => {
  const { id, design, values, uploads, format } = event.data;
  let reply: DrawReply;
  try {
    if (format === "png") await readyForPng();
    const drawn = await draw(design, values, { files: Object.fromEntries(Object.entries(uploads).map(([src, bytes]) => [src, new Uint8Array(bytes)])), load, format });
    reply = drawn.ok ? { id, ok: true, image: drawn.image.slice().buffer, problems: drawn.problems } : { id, ok: false, problems: drawn.problems };
  } catch (error) {
    reply = { id, ok: false, problems: [{ code: "og/draw", severity: "error", message: error instanceof Error ? error.message : String(error) }] };
  }
  (self as unknown as Worker).postMessage(reply, reply.ok ? [reply.image] : []);
};
