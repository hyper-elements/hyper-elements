// The Open Graph image generator's pictures and catalog (/tools/open-graph-image-generator), drawn in Node by the same
// engine the page runs (src/og-image/engine.ts), from this repository's sources (no `pnpm build` needed):
//
//   public/generated/og-image/<design>.png   each design's example, the picture its button on the page shows
//   src/generated/og-image.json              each design's name, label, description and fields
//
// It fails if a design's example doesn't draw. Run it after changing a design in examples/og-image/:
//
//   pnpm --filter @hyper-elements/website generate:og-image
import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ogImageSources } from "./og-image-runtime.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repo = resolve(root, "../..");
const coreDir = join(repo, "packages/internal/core");
const reactDir = join(repo, "packages/react");

/** The engine for Node: Satori, resvg and harfbuzz stay packages, loaded from core's node_modules beside the bundle. */
async function engine() {
  const dir = join(coreDir, "node_modules/.cache/og-image");
  await mkdir(dir, { recursive: true });
  const file = join(dir, "engine.mjs");
  await build({
    entryPoints: [join(root, "src/og-image/engine.ts")],
    outfile: file,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node20",
    logLevel: "warning",
    jsx: "automatic",
    external: ["satori", "@resvg/resvg-js", "harfbuzzjs", "yoga-layout", "react-pdf", "@react-pdf/renderer"],
    banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
    define: { "process.env.NODE_ENV": '"production"', __HYPER_ELEMENTS_CJS__: "false" },
    plugins: [
      {
        name: "og-image-node",
        setup(b) {
          const sources = ogImageSources();
          b.onResolve({ filter: /^@hyper-elements\/(react|core)(\/.*)?$/ }, ({ path }) => (sources[path] ? { path: sources[path] } : undefined));
          // The examples and the engine use the React packages/react is developed with.
          b.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, (args) => (args.pluginData?.real ? undefined : b.resolve(args.path, { resolveDir: reactDir, kind: args.kind, pluginData: { real: true } })));
        },
      },
    ],
  });
  return import(`${pathToFileURL(file).href}?${Date.now()}`);
}

/** A file a design names, from the site: its fonts and the sample photo are under public/. */
const SITE = "https://hyperelements.dev/";
export const loadFromSite = (url) => {
  if (!url.startsWith(SITE)) throw new Error(`A design names ${url}, which isn't on the site`);
  return readFile(join(root, "public", url.slice(SITE.length))).then((b) => new Uint8Array(b));
};

/** The sample photo, as the page fills it in for a design that takes a photo. */
export const SAMPLE_PHOTO = { src: "https://hyperelements.dev/tools/og-image/sample.jpg", width: 1800, height: 1200 };

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { draw, catalog, DESIGNS } = await engine();
  const designs = catalog();
  const out = join(root, "public/generated/og-image");
  await mkdir(out, { recursive: true });
  for (const design of designs) {
    const example = DESIGNS[design.name].example;
    const values = design.fields.some((f) => f.path === "photo") ? { photo: SAMPLE_PHOTO, ...example } : example;
    const drawn = await draw(design.name, values, { load: loadFromSite, format: "png" });
    if (!drawn.ok) throw new Error(`${design.name} didn't draw:\n${drawn.problems.map((p) => `  ${p.severity} ${p.code}: ${p.message}`).join("\n")}`);
    for (const p of drawn.problems) console.warn(`  ${design.name}: ${p.severity} ${p.code}: ${p.message}`);
    await writeFile(join(out, `${design.name}.png`), drawn.image);
    console.log(`public/generated/og-image/${design.name}.png`);
  }
  // The tool's own page's image, drawn with one of its designs.
  const page = await draw("midnight", { headline: "Free Open Graph image generator", site: "hyperelements.dev", author: "Drawn in your browser", date: "No sign-up, no watermark" }, { load: loadFromSite, format: "png" });
  if (!page.ok) throw new Error(`The page's image didn't draw:\n${page.problems.map((p) => `  ${p.code}: ${p.message}`).join("\n")}`);
  await writeFile(join(out, "page.png"), page.image);
  console.log("public/generated/og-image/page.png");
  await writeFile(join(root, "src/generated/og-image.json"), `${JSON.stringify(designs, null, 2)}\n`);
  console.log("src/generated/og-image.json");
}
