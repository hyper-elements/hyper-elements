import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/bin.ts", "src/main.ts", "src/child.ts", "src/watchdog.ts"],
  format: ["esm"],
  target: "node20",
  platform: "node",
  splitting: false,
  clean: true,
  // The shared template loader is private: bundled in, reached by its path (no dependency on it in package.json, so
  // the published manifest names no private package). tsx and TypeScript are dependencies, loaded where they're
  // needed; React, React DOM and Elements are the project's, loaded beside each template (never bundled).
  noExternal: ["@unlayer-internal/template-loader"],
  external: ["typescript", /^tsx/, "react", "react-dom", /^@hyper-elements\//, "./main.js", "./child.js", "./watchdog.js"],
  esbuildOptions(options) {
    options.alias = { "@unlayer-internal/template-loader": fileURLToPath(new URL("../loader/src/index.ts", import.meta.url)) };
  },
});
