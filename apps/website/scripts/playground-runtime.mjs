// Bundles what the playground runs in its sandbox: Hyper Elements itself, from this repository's sources, with the
// compiler for the code a visitor writes. Each bundle is one classic script the sandbox loads from text (it has no
// network): /playground/runtime/<name>.js serves them (src/pages/playground/runtime/).
//
//   core     React, @hyper-elements/react (render, validate, outline), /inspect, and Sucrase
//   pdf      @hyper-elements/react/pdf with react-pdf's browser build
//   image    @hyper-elements/react/image with Satori, and resvg as WebAssembly (resvg.wasm, served beside it)
//   clients  @hyper-elements/email-clients (the checks' plugin and the previews) with its models
//
// The engines (react-pdf, Satori) and React are the ones packages/react is developed with, resolved from its
// directory, as scripts/generate.mjs does. Nothing here needs `pnpm build`: the bundles are made from src/.
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repo = resolve(root, "../..");
const sandbox = join(root, "playground/sandbox");
const reactDir = join(repo, "packages/react");
const coreDir = join(repo, "packages/internal/core");
const clientsDir = join(repo, "packages/email-clients");

export const RUNTIME_BUNDLES = ["runner", "core", "pdf", "image", "clients"];

/** This repository's packages, from their sources. */
const SOURCES = {
  "@hyper-elements/react": join(reactDir, "src/primitives/index.ts"),
  "@hyper-elements/react/inspect": join(reactDir, "src/inspect/index.ts"),
  "@hyper-elements/react/pdf": join(reactDir, "src/pdf/index.ts"),
  "@hyper-elements/react/image": join(reactDir, "src/image/index.ts"),
  "@hyper-elements/core": join(coreDir, "src/index.ts"),
  "@hyper-elements/core/pdf": join(coreDir, "src/pdf/index.ts"),
  "@hyper-elements/core/image": join(coreDir, "src/image/index.ts"),
  "@hyper-elements/email-clients": join(clientsDir, "src/index.ts"),
};

/** What a browser has no module for, and the engines' Node-only entries: each a file in playground/sandbox/shims. */
const SHIMS = {
  "node:crypto": "crypto.ts",
  "@react-pdf/renderer": "react-pdf.ts",
  "@resvg/resvg-js": "resvg.ts",
  harfbuzzjs: "harfbuzz.ts",
};

/** Where a shim's "real:<name>" is resolved from: the engines are packages/react's, harfbuzzjs is Satori's own. */
const engines = createRequire(join(coreDir, "package.json"));
const realDir = (name) => (name.startsWith("harfbuzzjs") ? dirname(engines.resolve("satori")) : reactDir);

/** In the bundles loaded after core: the React and the Elements core already loaded, not copies of them. */
const SHARED = {
  react: "shared-react.cjs",
  "react/jsx-runtime": "shared-jsx-runtime.cjs",
  "@hyper-elements/react": "shared-elements.cjs",
};

/** Node's Buffer, which the PDF and image entries turn bytes into base64 with: given to those files only. */
const BUFFER = join(sandbox, "shims/buffer.ts");
const USES_BUFFER = /packages\/(core|react)\/src\/(pdf|image)\/[^/]+\.tsx?$/;

const plugin = (name) => ({
  name: "playground-runtime",
  setup(b) {
    if (name !== "core" && name !== "runner") {
      b.onResolve({ filter: /^(react|react\/jsx-runtime|@hyper-elements\/react)$/ }, ({ path }) => ({ path: join(sandbox, "shims", SHARED[path]) }));
    }
    b.onResolve({ filter: /^(@hyper-elements\/(react|email-clients)|@hyper-elements\/core)(\/.*)?$/ }, ({ path }) => (SOURCES[path] ? { path: SOURCES[path] } : undefined));
    // A shim imports the module it stands in for as "real:<name>".
    b.onResolve({ filter: /^real:/ }, (args) => b.resolve(args.path.slice(5), { resolveDir: realDir(args.path.slice(5)), kind: args.kind, pluginData: { real: true } }));
    b.onResolve({ filter: /^(node:crypto|@react-pdf\/renderer|@resvg\/resvg-js|harfbuzzjs)$/ }, (args) => (args.pluginData?.real ? undefined : { path: join(sandbox, "shims", SHIMS[args.path]) }));
    // Node's own modules, named only where an engine runs in Node.
    b.onResolve({ filter: /^(node:)?(fs|fs\/promises|path|url|module)$/ }, () => ({ path: join(sandbox, "shims/empty.cjs") }));
    // The sandbox's own files import the React that packages/react is developed with.
    b.onResolve({ filter: /^react(\/.*)?$/ }, (args) => (args.pluginData?.real || !args.importer.startsWith(sandbox) ? undefined : b.resolve(args.path, { resolveDir: reactDir, kind: args.kind, pluginData: { real: true } })));
    b.onLoad({ filter: USES_BUFFER }, async ({ path }) => {
      const source = await readFile(path, "utf8");
      if (!/\bBuffer\./.test(source)) return undefined;
      return { contents: `import { Buffer } from ${JSON.stringify(BUFFER)};\n${source}`, loader: path.endsWith("x") ? "tsx" : "ts" };
    });
  },
});

const cache = new Map();

/** One bundle's code. Built once per process unless `fresh` (the dev server rebuilds on each request). */
export function buildRuntime(name, { fresh = false, minify = true } = {}) {
  if (!RUNTIME_BUNDLES.includes(name)) throw new Error(`No playground runtime bundle named "${name}"`);
  if (fresh || !cache.has(name)) {
    cache.set(
      name,
      build({
        entryPoints: [join(sandbox, `${name}.ts`)],
        bundle: true,
        write: false,
        format: "iife",
        platform: "browser",
        target: "es2022",
        minify,
        legalComments: "none",
        logLevel: "warning",
        loader: { ".wasm": "binary" },
        // The engines and React read these; nothing else of Node's `process` is in a browser.
        // (A classic script has no import.meta.url: react-pdf's PDF library makes a URL from it when it loads, for a
        // file it reads only for PDF/A.)
        define: { "process.env.NODE_ENV": '"production"', __HYPER_ELEMENTS_CJS__: "false", global: "globalThis", "import.meta.url": '"https://playground.invalid/"' },
        plugins: [plugin(name)],
      }).then((result) => result.outputFiles[0].text),
    );
  }
  return cache.get(name);
}

/**
 * The sha256 (base64) of the two scripts an email client's preview file runs: the preview's runtime (packages/email-clients'
 * RUNTIME) and the email client models' browser script (the models package's SCRIPT), the ones the clients bundle
 * writes into each file. A preview runs nothing else (src/playground/preview.ts), and the page reads these from the
 * site (/playground/runtime/preview-scripts.json), never from the sandbox, whose answers the code it ran can rewrite.
 * Each is the hash of the script itself, and has to be the one its package says, or the build stops.
 */
export async function previewScripts() {
  const generated = await build({ entryPoints: [join(clientsDir, "src/runtime.generated.ts")], bundle: true, write: false, format: "esm", platform: "neutral", logLevel: "warning" });
  const { RUNTIME } = await import(`data:text/javascript;base64,${Buffer.from(generated.outputFiles[0].text).toString("base64")}`);
  const models = await import(pathToFileURL(createRequire(join(clientsDir, "package.json")).resolve("@hyper-elements/email-client-models")).href);
  const hashes = {};
  for (const [name, script, said] of [
    ["runtime", RUNTIME.script, RUNTIME.sha256],
    ["models", models.SCRIPT, models.SCRIPT_SHA256],
  ]) {
    if (typeof script !== "string" || !script) throw new Error(`The email client previews' ${name} script wasn't found`);
    hashes[name] = createHash("sha256").update(script, "utf8").digest("base64");
    if (hashes[name] !== said) throw new Error(`The email client previews' ${name} script isn't the one its sha256 says (${said}): rebuild packages/email-clients' runtime, or reinstall`);
  }
  return hashes;
}

/** resvg's WebAssembly module, which the image bundle is given as bytes. */
export const resvgWasm = () => readFile(createRequire(join(root, "package.json")).resolve("@resvg/resvg-wasm/index_bg.wasm"));

/** The font a Canvas is drawn in where the template's own isn't to be had: Liberation Sans (SIL OFL 1.1), from pdf.js. */
export const FALLBACK_FONTS = { "LiberationSans-Regular.ttf": 400, "LiberationSans-Bold.ttf": 700 };
export const fallbackFont = (file) => {
  if (!(file in FALLBACK_FONTS)) throw new Error(`No playground font named "${file}"`);
  return readFile(join(dirname(createRequire(join(reactDir, "package.json")).resolve("pdfjs-dist/package.json")), "standard_fonts", file));
};
