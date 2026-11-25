// The Open Graph image generator's worker, /tools/og-image/runtime.js (scripts/og-image-runtime.mjs bundles it from
// the packages' sources). `astro dev` builds it on request, so a change to a design or the engine shows on the next
// reload; `astro build` writes it into the site. Its fonts and sample photo are files in public/tools/og-image/.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildOgImageRuntime } from "./og-image-runtime.mjs";

const PATH = "tools/og-image/runtime.js";

export default function ogImage() {
  return {
    name: "hyper-elements-og-image",
    hooks: {
      "astro:server:setup": ({ server }) => {
        server.middlewares.use(async (request, response, next) => {
          if ((request.url ?? "").split("?")[0] !== `/${PATH}`) return next();
          try {
            const body = await buildOgImageRuntime({ fresh: true, minify: false });
            response.setHeader("content-type", "text/javascript; charset=utf-8");
            response.setHeader("cache-control", "no-store");
            response.end(body);
          } catch (error) {
            response.statusCode = 500;
            response.setHeader("content-type", "text/plain; charset=utf-8");
            response.end(`${PATH} didn't build:\n${error?.message ?? error}`);
          }
        });
      },
      "astro:build:done": async ({ dir, logger }) => {
        const body = await buildOgImageRuntime();
        const file = join(fileURLToPath(dir), PATH);
        await mkdir(join(file, ".."), { recursive: true });
        await writeFile(file, body);
        logger.info(`${PATH} (${Math.round(body.length / 1024)} kB)`);
      },
    },
  };
}
