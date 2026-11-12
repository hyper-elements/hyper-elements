import { defineConfig } from 'tsup';

// Core (@hyper-elements/react) stays external: the package builds on its public API and bundles no copy of it. It's
// loaded on first use (src/core.ts's loadCore()), in each build's own module format: __CJS__ is true in the CommonJS
// build, which require()s it, and false in the ES module one, which import()s it (the other branch is dropped).
export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  splitting: false,
  clean: true,
  treeshake: true,
  // import.meta.url in the CommonJS build too: fonts: "inline" reads the package's font files beside dist/.
  shims: true,
  external: ['@hyper-elements/react', 'react', 'react-dom'],
  esbuildOptions(options, { format }) {
    options.define = { ...options.define, __CJS__: format === 'cjs' ? 'true' : 'false' };
  },
});
