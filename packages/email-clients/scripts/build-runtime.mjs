#!/usr/bin/env node
// Builds the runtime each preview file carries: src/runtime/main.ts and the email-renderer modules it draws with
// (src/runtime/renderer/, at the commit RUNTIME_SOURCE names), bundled by esbuild into one minified IIFE, written to
// src/runtime.generated.ts as a string with its sha256 (the shell's CSP lets only that script run). The generated
// file is committed, so the package builds without email-renderer.
//
//   node scripts/build-runtime.mjs           # write src/runtime.generated.ts
//   node scripts/build-runtime.mjs --check   # fail if it isn't what the sources build
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = `${root}src/runtime.generated.ts`;

export async function runtimeScript() {
  const result = await build({
    entryPoints: [`${root}src/runtime/main.ts`],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'chrome120',
    minify: true,
    legalComments: 'none',
    charset: 'utf8',
    logLevel: 'silent',
  });
  // Inline in a <script>: nothing in it may end the element.
  const script = result.outputFiles[0].text.trimEnd().replace(/<\/(script)/gi, '<\\/$1');
  const sha256 = createHash('sha256').update(script, 'utf8').digest('base64');
  return { script, sha256 };
}

export function generated({ script, sha256 }) {
  return [
    '// Built by scripts/build-runtime.mjs from src/runtime/: don\'t edit. Regenerate with `pnpm build:runtime`.',
    'import type { Runtime } from "./shell";',
    '',
    `export const RUNTIME: Runtime = { sha256: ${JSON.stringify(sha256)}, script: ${JSON.stringify(script)} };`,
    '',
  ].join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const text = generated(await runtimeScript());
  if (process.argv.includes('--check')) {
    if (readFileSync(out, 'utf8') !== text) {
      console.error('src/runtime.generated.ts is out of date: run `pnpm --filter @hyper-elements/email-clients build:runtime`');
      process.exit(1);
    }
    console.info('src/runtime.generated.ts is up to date');
  } else {
    writeFileSync(out, text);
    console.info(`Wrote src/runtime.generated.ts (${text.length} bytes)`);
  }
}
