// The templates' fonts and images, /generated/gallery/assets/…, from templates/_assets/ at the repository's root, so
// they're one copy in the repository. `astro dev` serves them from there; `astro build` copies them into the site.
import { cp, readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const PATH = "generated/gallery/assets";
const SOURCE = fileURLToPath(new URL("../../../templates/_assets", import.meta.url));
const TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".ttf": "font/ttf", ".otf": "font/otf", ".txt": "text/plain; charset=utf-8" };

export default function galleryAssets() {
  return {
    name: "hyper-elements-gallery-assets",
    hooks: {
      "astro:server:setup": ({ server }) => {
        server.middlewares.use(async (request, response, next) => {
          const url = decodeURIComponent((request.url ?? "").split("?")[0]);
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
        logger.info(`${PATH}/ from templates/_assets/`);
      },
    },
  };
}
