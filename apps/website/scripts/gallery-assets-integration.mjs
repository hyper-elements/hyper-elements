// The templates pages' files that aren't committed: the templates' fonts and images, /generated/gallery/assets/…, from
// templates/_assets/ at the repository's root (one copy in the repository), and the image worker that draws the image
// templates in the visitor's browser, /generated/gallery/runtime.js (scripts/gallery-runtime.mjs). `astro dev` serves
// them, building the worker on each request; `astro build` writes them into the site.
import { cp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { buildGalleryRuntime } from "./gallery-runtime.mjs";

const PATH = "generated/gallery/assets";
const RUNTIME = "generated/gallery/runtime.js";
const SOURCE = fileURLToPath(new URL("../../../templates/_assets", import.meta.url));
const TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".ttf": "font/ttf", ".otf": "font/otf", ".txt": "text/plain; charset=utf-8" };

export default function galleryAssets() {
  return {
    name: "hyper-elements-gallery-assets",
    hooks: {
      "astro:server:setup": ({ server }) => {
        server.middlewares.use(async (request, response, next) => {
          let url;
          try {
            url = decodeURIComponent((request.url ?? "").split("?")[0]);
          } catch {
            // A malformed escape isn't one of these files.
            return next();
          }
          if (url === `/${RUNTIME}`) {
            try {
              const body = await buildGalleryRuntime({ fresh: true, minify: false });
              response.setHeader("content-type", "text/javascript; charset=utf-8");
              response.setHeader("cache-control", "no-store");
              return response.end(body);
            } catch (error) {
              response.statusCode = 500;
              response.setHeader("content-type", "text/plain; charset=utf-8");
              return response.end(`${RUNTIME} didn't build:\n${error?.message ?? error}`);
            }
          }
          if (!url.startsWith(`/${PATH}/`)) return next();
          const rel = normalize(url.slice(PATH.length + 2));
          if (rel.startsWith("..")) return next();
          const file = join(SOURCE, rel);
          try {
            if (!(await stat(file)).isFile()) return next();
            response.setHeader("content-type", TYPES[extname(file).toLowerCase()] ?? "application/octet-stream");
            response.end(await readFile(file));
          } catch {
            next();
          }
        });
      },
      "astro:build:done": async ({ dir, logger }) => {
        await cp(SOURCE, join(fileURLToPath(dir), PATH), { recursive: true });
        const body = await buildGalleryRuntime();
        const file = join(fileURLToPath(dir), RUNTIME);
        await mkdir(join(file, ".."), { recursive: true });
        await writeFile(file, body);
        logger.info(`${PATH}/ from templates/_assets/, and ${RUNTIME} (${Math.round(body.length / 1024)} kB)`);
      },
    },
  };
}
