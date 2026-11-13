import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

export default defineConfig({
  define: { __VERSION__: JSON.stringify(version) },
  esbuild: { jsx: "automatic" },
  resolve: {
    // Templates in the tests, and the gallery and stress sets the baseline reads, render with Elements' source, one
    // copy (as packages/react's own tests do).
    alias: [{ find: /^@hyper-elements\/react$/, replacement: fileURLToPath(new URL("../react/src/primitives/index.ts", import.meta.url)) }],
  },
  test: {
    globals: true,
    environment: "node",
    include: ["test/*.test.{ts,tsx}"],
    coverage: { exclude: ["test/**", "*.config.ts", "dist/**"] },
  },
});
