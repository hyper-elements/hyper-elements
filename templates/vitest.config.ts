import { defineConfig } from "vitest/config";

// The designs are tested against the built packages (`pnpm build` first), as a project that copies one would use them.
export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    globals: true,
    environment: "node",
    include: ["_test/*.test.{ts,tsx}"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
