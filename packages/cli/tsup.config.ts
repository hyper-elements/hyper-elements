import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

export default defineConfig({
  // preview/browser.js is the only file that imports playwright-core: main.js loads it only for --findings,
  // --screenshots and --install-browser.
  entry: { bin: "src/bin.ts", main: "src/main.ts", child: "src/child.ts", watchdog: "src/watchdog.ts", "preview/browser": "src/preview/browser.ts" },
  format: ["esm"],
  target: "node20",
  platform: "node",
  splitting: false,
  clean: true,
  // The shared template loader is private: bundled in, reached by its path (no dependency on it in package.json, so
  // the published manifest names no private package). tsx and TypeScript are dependencies, loaded where they're
  // needed; React, React DOM and Elements are the project's, loaded beside each template (never bundled).
  noExternal: ["@unlayer-internal/template-loader"],
  external: ["typescript", /^tsx/, "react", "react-dom", /^@hyper-elements\//, "playwright-core", "./main.js", "./child.js", "./watchdog.js", "./preview/browser.js"],
  // dev's page, as text in main.js.
  loader: { ".html": "text" },
  esbuildOptions(options) {
    options.alias = { "@unlayer-internal/template-loader": fileURLToPath(new URL("../loader/src/index.ts", import.meta.url)) };
  },
});
