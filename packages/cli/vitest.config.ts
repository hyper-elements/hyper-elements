import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Bun on PATH: the suite runs again with the CLI started on Bun. In CI it must be there. */
function hasBun(): boolean {
  try {
    execFileSync("bun", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const bun = hasBun() || !!process.env.CI;
if (!bun) console.warn("bun isn't installed: the CLI's tests run on Node only (CI runs them on Bun too)");

export default defineConfig({
  // Templates the tests render in-process, to compare with the CLI's output.
  esbuild: { jsx: "automatic" },
  // The private template loader, by its path (as tsup.config.ts bundles it).
  resolve: { alias: { "@unlayer-internal/template-loader": fileURLToPath(new URL("../loader/src/index.ts", import.meta.url)) } },
  test: {
    globalSetup: "./test/setup.ts",
    testTimeout: 60_000,
    hookTimeout: 60_000,
    projects: [
      { extends: true, test: { name: "node", include: ["test/*.test.ts"], env: { CLI_RUNTIME: "node" } } },
      ...(bun ? [{ extends: true as const, test: { name: "bun", include: ["test/*.test.ts"], exclude: ["test/parity.test.ts", "test/units.test.ts"], env: { CLI_RUNTIME: "bun" } } }] : []),
    ],
  },
});
