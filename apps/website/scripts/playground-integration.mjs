// The playground's files that aren't pages: what its sandbox runs (scripts/playground-runtime.mjs bundles it from the
// packages' sources), resvg's WebAssembly module, and the fallback font a Canvas is drawn in.
//
//   /playground/runtime/{runner,core,pdf,image,clients}.js
//   /playground/runtime/resvg.wasm
//   /playground/fonts/LiberationSans-{Regular,Bold}.ttf
//
// `astro dev` builds each on request, so a change to the engine shows on the next reload; `astro build` writes them
// into the site.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildRuntime, fallbackFont, FALLBACK_FONTS, resvgWasm, RUNTIME_BUNDLES } from "./playground-runtime.mjs";

/** Each file's path under the site, its content type, and how it's made. */
const files = ({ dev }) => [
  ...RUNTIME_BUNDLES.map((name) => ({ path: `playground/runtime/${name}.js`, type: "text/javascript; charset=utf-8", make: () => buildRuntime(name, { fresh: dev, minify: !dev }) })),
  { path: "playground/runtime/resvg.wasm", type: "application/wasm", make: resvgWasm },
  ...Object.keys(FALLBACK_FONTS).map((file) => ({ path: `playground/fonts/${file}`, type: "font/ttf", make: () => fallbackFont(file) })),
];

const IMAGE_TYPES = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml" };

export default function playground() {
  return {
    name: "hyper-elements-playground",
    hooks: {
      "astro:server:setup": ({ server }) => {
        const served = new Map(files({ dev: true }).map((file) => [`/${file.path}`, file]));
        const images = join(fileURLToPath(new URL("..", import.meta.url)), "public");
        // A preview is a sandboxed frame, so its requests are cross-site to this server, and the dev server refuses
        // those before any other handler sees them (Astro puts its check first once every plugin has set up). The
        // site's own images (which the examples use) are served to a preview here, ahead of that refusal, from when
        // the server listens: a built site serves them to anyone.
        const siteImage = async (request, response, next) => {
          const path = (request.url ?? "").split("?")[0];
          if (!/^\/img\/[\w./-]+\.(png|jpe?g|gif|webp|svg)$/.test(path) || path.includes("..") || request.headers["sec-fetch-site"] !== "cross-site") return next();
          try {
            const body = await readFile(join(images, path));
            response.setHeader("content-type", IMAGE_TYPES[path.slice(path.lastIndexOf(".") + 1)] ?? "application/octet-stream");
            response.end(body);
          } catch {
            next();
          }
        };
        server.httpServer?.once("listening", () => {
          if (Array.isArray(server.middlewares.stack)) server.middlewares.stack.unshift({ route: "", handle: siteImage });
        });
        server.middlewares.use(async (request, response, next) => {
          const path = (request.url ?? "").split("?")[0];
          const file = served.get(path);
          if (!file) return next();
          try {
            const body = await file.make();
            response.setHeader("content-type", file.type);
            response.setHeader("cache-control", "no-store");
            response.end(body);
          } catch (error) {
            response.statusCode = 500;
            response.setHeader("content-type", "text/plain; charset=utf-8");
            response.end(`The playground's ${file.path} didn't build:\n${error?.message ?? error}`);
          }
        });
      },
      "astro:build:done": async ({ dir, logger }) => {
        const out = fileURLToPath(dir);
        for (const file of files({ dev: false })) {
          const body = await file.make();
          await mkdir(join(out, file.path, ".."), { recursive: true });
          await writeFile(join(out, file.path), body);
          logger.info(`${file.path} (${Math.round(body.length / 1024)} kB)`);
        }
      },
    },
  };
}
