#!/usr/bin/env node
// Writes fonts/: the open fonts the previews draw with (renderer/fonts/ in a checkout of the models' repository,
// hyper-elements/email-client-models), as WOFF2 (TrueType converted, WOFF2 copied), with their licences. The files are committed;
// run this when the models package changes which files a client loads (its fontFiles).
//
//   node scripts/build-fonts.mjs /path/to/email-client-models
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compress } from 'wawoff2';

const renderer = process.argv[2];
if (!renderer) throw new Error('Usage: node scripts/build-fonts.mjs /path/to/email-client-models');
const fonts = join(renderer, 'renderer/fonts');
const out = fileURLToPath(new URL('../fonts/', import.meta.url));
mkdirSync(out, { recursive: true });
const FILES = {
  selawik: ['selawkl.ttf', 'selawksl.ttf', 'selawk.ttf', 'selawksb.ttf', 'selawkb.ttf'],
  carlito: ['Carlito-Regular.ttf', 'Carlito-Bold.ttf'],
  // The Gmail app on Android: Android's own fonts.
  roboto: ['Roboto-Variable.woff2', 'Roboto-Italic-Variable.woff2'],
  'noto-serif': ['NotoSerif-Variable.woff2', 'NotoSerif-Italic-Variable.woff2'],
  'noto-sans-mono': ['NotoSansMono-Variable.woff2'],
};
const LICENCES = { selawik: 'LICENSE.txt', carlito: 'OFL.txt', roboto: 'OFL.txt', 'noto-serif': 'OFL.txt', 'noto-sans-mono': 'OFL.txt' };
for (const [family, files] of Object.entries(FILES)) {
  for (const file of files) {
    const source = readFileSync(join(fonts, family, file));
    writeFileSync(join(out, basename(file).replace(/\.ttf$/, '.woff2')), file.endsWith('.woff2') ? source : await compress(source));
  }
  copyFileSync(join(fonts, family, LICENCES[family]), join(out, `${family}-${LICENCES[family].replace('.txt', '')}.txt`));
}
console.info(`Wrote ${out}`);
