import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/*.test.{ts,tsx}'],
    // The runtime runs in the preview files, in a browser: test:browser tests it in Chromium.
    coverage: { exclude: ['src/runtime/**', 'src/runtime.generated.ts', 'scripts/**', 'test/**', '*.config.ts'] },
  },
});
