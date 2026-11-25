// Bundles the Open Graph image generator's worker (src/og-image/worker.ts): its designs (examples/og-image/), React,
// @hyper-elements/react's template and image entries and Satori, from this repository's sources, as one classic
// script for a Worker. The playground's shims stand in for what a browser has no module for (scripts/playground-runtime.mjs).
// /tools/og-image/runtime.js serves it (scripts/og-image-integration.mjs).
import { build } from "esbuild";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { plugin, SOURCES } from "./playground-runtime.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** The packages' entries, from their sources: what the designs and the engine import. */
export const ogImageSources = () => SOURCES;

let cached;

/** The worker's code. Built once per process unless `fresh` (the dev server rebuilds it on each request). */
export function buildOgImageRuntime({ fresh = false, minify = true } = {}) {
  if (fresh || !cached) {
    cached = build({
      entryPoints: [join(root, "src/og-image/worker.ts")],
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
      plugins: [plugin("og-image", { shared: false, local: [join(root, "src/og-image"), join(root, "examples/og-image"), join(root, "playground/sandbox")] })],
    }).then((result) => result.outputFiles[0].text);
  }
  return cached;
}
