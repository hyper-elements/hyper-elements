import { readFileSync } from "node:fs";
import { defineConfig } from "tsup";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

// Two entries: the plugin (`.`) and lintHtml (`./html`). Neither imports anything at run time: Elements is read
// through the tree a plugin is handed (types only), and HTML by the package's own tokenizer.
export default defineConfig({
  entry: { index: "src/index.ts", html: "src/html.ts" },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  splitting: false,
  clean: true,
  treeshake: true,
  external: ["@hyper-elements/react"],
  define: { __VERSION__: JSON.stringify(version) },
});
