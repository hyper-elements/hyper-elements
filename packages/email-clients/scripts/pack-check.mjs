#!/usr/bin/env node
// The packed package, installed as an app installs it (needs `pnpm build` and npm's registry):
//
// 1. Beside the packed core, in a clean project: both module formats import and write a preview for every client,
//    with the fonts inlined from the installed files; the tarball holds dist/, the fonts and their licences.
// 2. Beside core 0.3.1 (on npm: render()'s blockMap in format 1, without each block's component): npm reports the
//    unmet peer; installed anyway, the package imports, and its first call throws email-clients/version-mismatch, in
//    both module formats.
//
// The packed core is marked 0.3.2, the release that ships the block map's format 2 (its committed version is bumped at
// release).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('..', import.meta.url));
const core = join(here, '../react');
const run = (cmd, args, cwd, options = {}) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options });
const fail = (message) => {
  console.error(`PACK_FAIL: ${message}`);
  process.exit(1);
};

const packs = mkdtempSync(join(tmpdir(), 'email-clients-packs-'));
run('pnpm', ['pack', '--pack-destination', packs], here);
run('pnpm', ['pack', '--pack-destination', packs], core);
const tarball = (prefix) => join(packs, readdirSync(packs).find((f) => f.startsWith(prefix)));
const extension = tarball('hyper-elements-email-clients-');

// What the tarball holds.
const files = run('tar', ['-tzf', extension], packs).split('\n').filter(Boolean);
for (const want of ['package/dist/index.js', 'package/dist/index.cjs', 'package/dist/index.d.ts', 'package/dist/index.d.cts', 'package/fonts/selawk.woff2', 'package/fonts/InterVariable.woff2', 'package/fonts/Carlito-Regular.woff2', 'package/fonts/selawik-LICENSE.txt', 'package/fonts/carlito-OFL.txt', 'package/fonts/inter-LICENSE.txt']) {
  if (!files.includes(want)) fail(`the tarball has no ${want.slice('package/'.length)}`);
}
if (files.some((f) => f.includes('/src/') || f.includes('/test/'))) fail('the tarball holds src/ or test/');

// The packed core as 0.3.2.
const unpacked = mkdtempSync(join(tmpdir(), 'email-clients-core-'));
run('tar', ['-xzf', tarball('hyper-elements-react-'), '-C', unpacked], packs);
const corePackage = join(unpacked, 'package/package.json');
writeFileSync(corePackage, JSON.stringify({ ...JSON.parse(readFileSync(corePackage, 'utf8')), version: '0.3.2' }, null, 2));
const core032 = join(packs, 'core-0.3.2.tgz');
run('tar', ['-czf', core032, '-C', unpacked, 'package'], packs);

const ESM = `
import React from "react";
import * as core from "@hyper-elements/react";
import { renderInEmailClients, PREVIEW_CLIENTS } from "@hyper-elements/email-clients";
const email = React.createElement(core.Email, { width: 600 }, React.createElement(core.Text, null, "Hi"));
try {
  const { previews } = await renderInEmailClients(email, { emailClients: [...PREVIEW_CLIENTS], dark: true, fonts: "inline" });
  console.log(JSON.stringify({ previews: previews.map((p) => p.filename), inline: previews.some((p) => p.html.includes("data:font/woff2;base64,")) }));
} catch (error) {
  console.log(JSON.stringify({ error: error.name, message: error.message }));
}`;
const CJS = `
const React = require("react");
const core = require("@hyper-elements/react");
const { renderInEmailClients, PREVIEW_CLIENTS } = require("@hyper-elements/email-clients");
const email = React.createElement(core.Email, { width: 600 }, React.createElement(core.Text, null, "Hi"));
renderInEmailClients(email, { emailClients: [...PREVIEW_CLIENTS], dark: true, fonts: "inline" }).then(
  ({ previews }) => console.log(JSON.stringify({ previews: previews.map((p) => p.filename), inline: previews.some((p) => p.html.includes("data:font/woff2;base64,")) })),
  (error) => console.log(JSON.stringify({ error: error.name, message: error.message })),
);`;

/** A clean project with `deps` installed; what each module format's script printed. */
function project(deps, npmFlags = []) {
  const dir = mkdtempSync(join(tmpdir(), 'email-clients-app-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'app', private: true }));
  run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error', ...npmFlags, ...deps], dir);
  writeFileSync(join(dir, 'esm.mjs'), ESM);
  writeFileSync(join(dir, 'cjs.cjs'), CJS);
  return { dir, esm: JSON.parse(run('node', ['esm.mjs'], dir).trim()), cjs: JSON.parse(run('node', ['cjs.cjs'], dir).trim()) };
}

const REACT = ['react@18.3.1', 'react-dom@18.3.1'];
const all = ['outlook.html', 'outlook-com.html', 'gmail.html', 'gmail-app.html', 'gmail-app-other.html', 'apple-mail.html', 'apple-mail.dark.html'];

// 1. Beside the core it's for.
const matched = project([core032, extension, ...REACT]);
for (const format of ['esm', 'cjs']) {
  const out = matched[format];
  if (out.error) fail(`${format} beside core 0.3.2: ${out.error}: ${out.message}`);
  if (JSON.stringify(out.previews) !== JSON.stringify(all) || !out.inline) fail(`${format} beside core 0.3.2 wrote ${JSON.stringify(out)}`);
}

// 2. Beside core 0.3.1: npm reports the unmet peer; installed anyway, the first call says what to install.
try {
  project(['@hyper-elements/react@0.3.1', extension, ...REACT]);
  fail('npm installed it beside core 0.3.1 without reporting the unmet peer');
} catch (error) {
  if (!/ERESOLVE|peer @hyper-elements\/react/.test(String(error.stderr ?? error.message))) throw error;
}
const older = project(['@hyper-elements/react@0.3.1', extension, ...REACT], ['--legacy-peer-deps']);
for (const format of ['esm', 'cjs']) {
  const out = older[format];
  if (out.error !== 'email-clients/version-mismatch' || !out.message.includes("this core's is 1, it reads 2") || !out.message.includes('npm i @hyper-elements/react@^0.3.2 @hyper-elements/email-clients@^0.3')) fail(`${format} beside core 0.3.1: ${JSON.stringify(out)}`);
}

console.info('PACK_OK: beside the packed core, both module formats write every preview with the fonts inlined; the tarball holds dist/, the fonts and their licences; beside core 0.3.1, npm reports the unmet peer, and the first call throws email-clients/version-mismatch in both formats');
