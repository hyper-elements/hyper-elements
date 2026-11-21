// Bundles the templates pages' image worker (src/gallery/worker.ts): the image templates (templates/images/), the
// brands they're drawn in (templates/_brands/ and _companies/), React, @hyper-elements/react's image entry and Satori,
// from this repository's sources, as one classic script for a Worker. scripts/gallery-assets-integration.mjs serves
// it at /generated/gallery/runtime.js.
import { build } from "esbuild";
import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { plugin } from "./playground-runtime.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const templates = resolve(root, "../../templates");
const files = (dir, ext) => readdirSync(join(templates, dir)).filter((f) => f.endsWith(ext)).sort().map((f) => [f.slice(0, -ext.length), join(templates, dir, f)]);

/** `virtual:gallery-catalog`: every image template by its key, and every brand by the id the pages use. */
function catalog() {
  const designs = files("images", ".tsx");
  const brands = [...files("_brands", ".ts"), ...files("_companies", ".ts").map(([id, file]) => [`${id}-original`, file])];
  return [
    ...designs.map(([, file], i) => `import d${i} from ${JSON.stringify(file)};`),
    ...brands.map(([, file], i) => `import { brand as b${i} } from ${JSON.stringify(file)};`),
    `export const designs = { ${designs.map(([name], i) => `${JSON.stringify(`images/${name}`)}: d${i}`).join(", ")} };`,
    `export const brands = { ${brands.map(([id], i) => `${JSON.stringify(id)}: b${i}`).join(", ")} };`,
  ].join("\n");
}

let cached;

/** The worker's code. Built once per process unless `fresh` (the dev server rebuilds it on each request). */
export function buildGalleryRuntime({ fresh = false, minify = true } = {}) {
  if (fresh || !cached) {
    cached = build({
      entryPoints: [join(root, "src/gallery/worker.ts")],
      bundle: true,
      write: false,
      format: "iife",
      platform: "browser",
      target: "es2022",
      minify,
      legalComments: "none",
      logLevel: "warning",
      jsx: "automatic",
      loader: { ".wasm": "binary" },
      define: { "process.env.NODE_ENV": '"production"', __HYPER_ELEMENTS_CJS__: "false", global: "globalThis", "import.meta.url": '"https://hyperelements.invalid/"' },
      plugins: [
        { name: "gallery-catalog", setup(b) {
          b.onResolve({ filter: /^virtual:gallery-catalog$/ }, () => ({ path: "catalog", namespace: "gallery-catalog" }));
          b.onLoad({ filter: /.*/, namespace: "gallery-catalog" }, () => ({ contents: catalog(), loader: "js", resolveDir: templates }));
        } },
        plugin("gallery", { shared: false, local: [join(root, "src/gallery"), templates, join(root, "playground/sandbox")] }),
      ],
    }).then((result) => result.outputFiles[0].text);
  }
  return cached;
}
