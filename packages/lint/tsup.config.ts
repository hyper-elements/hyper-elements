import { readFileSync } from "node:fs";
import { defineConfig } from "tsup";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

// The plugin (`.`): it imports nothing at run time. Elements is read through the tree a plugin is handed (types
// only).
export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  splitting: false,
  clean: true,
  treeshake: true,
  external: ["@hyper-elements/react"],
  define: { __VERSION__: JSON.stringify(version) },
});
