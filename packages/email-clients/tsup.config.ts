import { defineConfig } from 'tsup';

// Core (@hyper-elements/react) stays external: the package builds on its public API and bundles no copy of it.
export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  splitting: false,
  clean: true,
  treeshake: true,
  external: ['@hyper-elements/react', 'react', 'react-dom'],
});
