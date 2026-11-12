import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// `preview --findings` against real browsers: needs `pnpm build` (Elements and email-clients) and Playwright's
// Chromium (`pnpm --filter @hyper-elements/react exec playwright install chromium`).
export default defineConfig({
  resolve: { alias: { "@unlayer-internal/template-loader": fileURLToPath(new URL("../loader/src/index.ts", import.meta.url)) } },
  test: {
    globalSetup: "./test/setup.ts",
    include: ["test/browser/*.test.ts"],
    testTimeout: 180_000,
    hookTimeout: 60_000,
  },
});
