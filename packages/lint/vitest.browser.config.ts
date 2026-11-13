import { defineConfig } from "vitest/config";
import base from "./vitest.config";

// tree.ts against Chromium's computed styles (Playwright): needs `playwright install chromium`.
export default defineConfig({
  ...base,
  test: { ...base.test, include: ["test/browser/*.test.{ts,tsx}"], testTimeout: 180_000, hookTimeout: 60_000 },
});
