// Bundles the templates pages' image worker (src/gallery/worker.ts): the image templates (templates/images/) and their
// designs, the brands they're drawn in (templates/_brands/ and _companies/), React, @hyper-elements/react's image entry and Satori,
// from this repository's sources, as one classic script for a Worker. scripts/gallery-assets-integration.mjs serves
// it at /generated/gallery/runtime.js.
import { build } from "esbuild";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { plugin } from "./playground-runtime.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const templates = resolve(root, "../../templates");
const files = (dir, ext) => readdirSync(join(templates, dir)).filter((f) => f.endsWith(ext)).sort().map((f) => [f.slice(0, -ext.length), join(templates, dir, f)]);

const camel = (name) => name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

/** `virtual:gallery-catalog`: every image template's designs by key (`images/og-card/launch`), each with the function
 * that makes its template from a brand, and every brand by the id the pages use. */
function catalog() {
  const templatesDir = join(templates, "images");
  const made = readdirSync(templatesDir).filter((name) => existsSync(join(templatesDir, name, "template.tsx"))).sort();
  const designs = made.flatMap((name) =>
    (existsSync(join(templatesDir, name, "designs")) ? readdirSync(join(templatesDir, name, "designs")) : [])
      .filter((f) => f.endsWith(".tsx"))
      .sort()
      .map((f) => ({ key: `images/${name}/${f.slice(0, -4)}`, name, file: join(templatesDir, name, "designs", f) })),
  );
  const brands = [...files("_brands", ".ts"), ...files("_companies", ".ts").map(([id, file]) => [`${id}-original`, file])];
  return [
    ...made.map((name, i) => `import { ${camel(name)} as t${i} } from ${JSON.stringify(join(templatesDir, name, "template.tsx"))};`),
    ...designs.map((d, i) => `import d${i} from ${JSON.stringify(d.file)};`),
    ...brands.map(([, file], i) => `import { brand as b${i} } from ${JSON.stringify(file)};`),
    `export const designs = { ${designs.map((d, i) => `${JSON.stringify(d.key)}: { make: t${made.indexOf(d.name)}, Design: d${i} }`).join(", ")} };`,
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
