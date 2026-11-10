#!/usr/bin/env node
// Builds the runtime each preview file carries: src/runtime/main.ts (the frames, markers, fonts, images and findings
// around the models, which the preview inlines as a script of their own), bundled by esbuild into one minified IIFE,
// written to src/runtime.generated.ts as a string with its sha256 (the shell's CSP lets it and the models run). The
// generated file is committed.
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
  const script = assertInlineSafe(result.outputFiles[0].text.trimEnd().replace(/<\/(script)/gi, '<\\/$1'));
  const sha256 = createHash('sha256').update(script, 'utf8').digest('base64');
  return { script, sha256 };
}

/**
 * `script`, if it's safe inline in a <script>: no `</script`, and not both `<!--` and `<script` followed by a space,
 * `/` or `>`, which would put the HTML parser in its double-escaped state, so the shell's own </script> wouldn't end
 * it. Fails the build otherwise.
 */
export function assertInlineSafe(script) {
  if (/<\/script/i.test(script)) throw new Error('The runtime holds "</script": it would end the preview\'s script early.');
  if (script.includes('<!--') && /<script[\s/>]/i.test(script)) {
    throw new Error('The runtime holds "<!--" and "<script": inline, the HTML parser would read past the preview\'s </script>. Write the tag another way in the source (as "<" + "script").');
  }
  return script;
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
