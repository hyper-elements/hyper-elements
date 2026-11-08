import { defineConfig } from "tsup";

// The command only: bin.ts checks the Node.js version before it loads cli.js. esbuild and playwright-core are
// dependencies, loaded when used; React and Hyper Elements are the template's project's, never bundled.
export default defineConfig({
  entry: ["src/bin.ts", "src/cli.ts"],
  format: ["esm"],
  target: "node20",
  platform: "node",
  splitting: false,
  clean: true,
  external: ["esbuild", "playwright-core", "react", "react-dom", /^@hyper-elements\/react(\/|$)/, "./cli.js"],
});
