import { defineConfig } from 'vitest/config';

// The preview files opened in Chromium (Playwright): needs `pnpm build` and `playwright install chromium`.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/browser/*.test.{ts,tsx}'],
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
