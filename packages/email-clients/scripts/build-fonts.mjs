#!/usr/bin/env node
// Writes fonts/: the open stand-in fonts the captures were scored with (renderer/fonts/ in a checkout of the models'
// repository, hyper-elements/email-client-models), converted to WOFF2, with their licences. The files are committed;
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
  inter: ['InterVariable.ttf', 'InterVariable-Italic.ttf'],
};
const LICENCES = { selawik: 'LICENSE.txt', carlito: 'OFL.txt', inter: 'LICENSE.txt' };
for (const [family, files] of Object.entries(FILES)) {
  for (const file of files) {
    const woff2 = await compress(readFileSync(join(fonts, family, file)));
    writeFileSync(join(out, basename(file).replace(/\.ttf$/, '.woff2')), woff2);
  }
  copyFileSync(join(fonts, family, LICENCES[family]), join(out, `${family}-${LICENCES[family].replace('.txt', '')}.txt`));
}
console.info(`Wrote ${out}`);
