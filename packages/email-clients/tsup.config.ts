import { defineConfig } from 'tsup';

// Core (@hyper-elements/react) stays external: the package builds on its public API and bundles no copy of it.
// Two entries: the main one (`.`, for Hyper Elements templates) and `./html` (any HTML email), which reaches neither core
// nor React, in code or in types.
export default defineConfig({
  entry: { index: 'src/index.ts', html: 'src/html-entry.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  splitting: false,
  clean: true,
  treeshake: true,
  // import.meta.url in the CommonJS build too: fonts: "inline" reads the package's font files beside dist/.
  shims: true,
  external: ['@hyper-elements/react', 'react', 'react-dom'],
});
