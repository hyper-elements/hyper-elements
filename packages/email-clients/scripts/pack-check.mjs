#!/usr/bin/env node
// The packed package, installed as an app installs it (needs `pnpm build` and npm's registry):
//
// 1. Beside the packed core, in a clean project, with the models package from npm: both module formats import, check an
//    email with the plugin (`validate(email, { plugins: [await emailClients()] })`: the captured checks run, and core's
//    note is left out) and write a preview for every client, with the fonts inlined from the installed files. The
//    tarball holds dist/, the fonts and their licences, and none of the models.
// 2. Beside core 0.3.1 (on npm: no plugins, and render()'s blockMap in format 1): npm reports the unmet peer; installed
//    anyway, the package imports, and its first call throws email-clients/version-mismatch, in both module formats.
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
for (const want of ['package/dist/index.js', 'package/dist/index.cjs', 'package/dist/index.d.ts', 'package/dist/index.d.cts', 'package/fonts/selawk.woff2', 'package/fonts/InterVariable.woff2', 'package/fonts/Carlito-Regular.woff2', 'package/fonts/selawik-LICENSE.txt', 'package/fonts/carlito-OFL.txt', 'package/fonts/inter-LICENSE.txt', 'package/fonts/Roboto-Variable.woff2', 'package/fonts/NotoSerif-Variable.woff2', 'package/fonts/NotoSansMono-Variable.woff2', 'package/fonts/roboto-OFL.txt']) {
  if (!files.includes(want)) fail(`the tarball has no ${want.slice('package/'.length)}`);
}
if (files.some((f) => f.includes('/src/') || f.includes('/test/'))) fail('the tarball holds src/ or test/');
// The models are the closed package's: none of them in this one.
const unpackedExtension = mkdtempSync(join(tmpdir(), 'email-clients-ext-'));
run('tar', ['-xzf', extension, '-C', unpackedExtension], packs);
for (const file of files.filter((f) => /\.(c?js)$/.test(f))) {
  const text = readFileSync(join(unpackedExtension, file), 'utf8');
  for (const name of ['WebAssembly.instantiate', 'createOutlookRules', 'gmailClip', 'Aptos Stand-in', 'Hamburgefonstiv']) if (text.includes(name)) fail(`${file} holds ${name}: the models belong to @hyper-elements/email-client-models`);
}
const packedCore = tarball('hyper-elements-react-');

// An email with what only captures find (letter spacing in classic Outlook) and what caniemail's tables say (position).
const TEMPLATE = `React.createElement(core.Email, { width: 600 }, React.createElement(core.Text, { style: { letterSpacing: 2 } }, "Hi"), React.createElement(core.Html, { html: '<div style="position:absolute">x</div>' }))`;
const ESM = `
import React from "react";
import * as core from "@hyper-elements/react";
import { emailClients, renderInEmailClients, PREVIEW_CLIENTS } from "@hyper-elements/email-clients";
const email = ${TEMPLATE};
try {
  const checked = core.validate(email, { plugins: [await emailClients()] }).diagnostics.map((d) => d.code);
  const { previews } = await renderInEmailClients(email, { emailClients: [...PREVIEW_CLIENTS], dark: true, fonts: "inline" });
  console.log(JSON.stringify({ checked, previews: previews.map((p) => p.filename), inline: previews.some((p) => p.html.includes("data:font/woff2;base64,")) }));
} catch (error) {
  console.log(JSON.stringify({ error: error.name, message: error.message }));
}`;
const CJS = `
const React = require("react");
const core = require("@hyper-elements/react");
const { emailClients, renderInEmailClients, PREVIEW_CLIENTS } = require("@hyper-elements/email-clients");
const email = ${TEMPLATE};
(async () => {
  const checked = core.validate(email, { plugins: [await emailClients()] }).diagnostics.map((d) => d.code);
  const { previews } = await renderInEmailClients(email, { emailClients: [...PREVIEW_CLIENTS], dark: true, fonts: "inline" });
  return { checked, previews: previews.map((p) => p.filename), inline: previews.some((p) => p.html.includes("data:font/woff2;base64,")) };
})().then(
  (out) => console.log(JSON.stringify(out)),
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
const all = ['outlook.html', 'outlook-com.html', 'outlook-com.mac.html', 'gmail.html', 'gmail.mac.html', 'gmail-app.html', 'gmail-app-other.html', 'apple-mail.html', 'apple-mail.dark.html'];

// 1. Beside the core it's for.
const matched = project([packedCore, extension, ...REACT]);
for (const format of ['esm', 'cjs']) {
  const out = matched[format];
  if (out.error) fail(`${format} beside the packed core: ${out.error}: ${out.message}`);
  if (JSON.stringify(out.checked) !== JSON.stringify(['email/html-css', 'email/outlook-degraded'])) fail(`${format}: the plugin checked ${JSON.stringify(out.checked)}`);
  if (JSON.stringify(out.previews) !== JSON.stringify(all) || !out.inline) fail(`${format} beside the packed core wrote ${JSON.stringify(out)}`);
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
  if (out.error !== 'email-clients/version-mismatch' || !out.message.includes('PLUGIN_API (plugins)') || !out.message.includes('npm i @hyper-elements/react@^0.4.0 @hyper-elements/email-clients@^0.4')) fail(`${format} beside core 0.3.1: ${JSON.stringify(out)}`);
}

console.info('PACK_OK: beside the packed core and the models from npm, both module formats check an email with the plugin and write every preview with the fonts inlined; the tarball holds dist/, the fonts and their licences, and none of the models; beside core 0.3.1, npm reports the unmet peer, and the first call throws email-clients/version-mismatch in both formats');
