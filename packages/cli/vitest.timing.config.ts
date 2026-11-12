import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// `dev`'s tests with their timing held to its bound: a change shown within a second of it. They run alone (one file at
// a time, Node then Bun), since what they time is process starts and module loading, which the rest of the suite
// running beside them slows. CI runs this as a step of its own.
export default defineConfig({
  resolve: { alias: { "@unlayer-internal/template-loader": fileURLToPath(new URL("../loader/src/index.ts", import.meta.url)) } },
  test: {
    globalSetup: "./test/setup.ts",
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    projects: [
      { extends: true, test: { name: "node", include: ["test/dev.test.ts"], env: { CLI_RUNTIME: "node", HYPER_ELEMENTS_CLI_TIMED: "1" } } },
      { extends: true, test: { name: "bun", include: ["test/dev.test.ts"], env: { CLI_RUNTIME: "bun", HYPER_ELEMENTS_CLI_TIMED: "1" } } },
    ],
  },
});
