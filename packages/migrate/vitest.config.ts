import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    testTimeout: 60000,
    // test/review-regressions.test.ts converts and renders some 140 templates in one process, each in a project of its
    // own, and holds more than Node's default heap by the end (about 2 GB on the CI's Node 20): its worker ran out
    // of memory there. Each worker gets 4 GB.
    pool: "forks",
    poolOptions: { forks: { execArgv: ["--max-old-space-size=4096"] } },
  },
});
