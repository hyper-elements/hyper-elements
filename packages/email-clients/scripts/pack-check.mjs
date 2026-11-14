#!/usr/bin/env node
// The packed package, installed as an app installs it (needs `pnpm build` and npm's registry):
//
// 1. Beside the packed core, in a clean project, with the models package from npm: both module formats import, check an
//    email with the plugin (`validate(email, { plugins: [await emailClients()] })`: the captured checks run, and core's
//    note is left out) and write a preview for every client, with the fonts inlined from the installed files. The
//    tarball holds dist/, the fonts and their licences, and none of the models.
// 2. Beside core 0.3.1 (on npm: no plugins, and render()'s blockMap in format 1): npm reports the unmet peer (optional,
//    but installed and out of range); installed anyway, the package imports, and its first call throws
//    email-clients/version-mismatch, in both module formats.
// 3. Alone, with no core and no React (its peers are optional): renderInEmailClients() previews an HTML email in both
//    module formats, a template call says core isn't installed, and a TypeScript project that previews HTML
//    type-checks (with skipLibCheck, the default: the declarations name core's and React's types), under node16 and
//    bundler resolution.
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
for (const want of ['package/dist/index.js', 'package/dist/index.cjs', 'package/dist/index.d.ts', 'package/dist/index.d.cts', 'package/fonts/selawk.woff2', 'package/fonts/Carlito-Regular.woff2', 'package/fonts/selawik-LICENSE.txt', 'package/fonts/carlito-OFL.txt', 'package/fonts/Roboto-Variable.woff2', 'package/fonts/NotoSerif-Variable.woff2', 'package/fonts/NotoSansMono-Variable.woff2', 'package/fonts/roboto-OFL.txt']) {
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
function project(deps, npmFlags = [], scripts = { esm: ESM, cjs: CJS }) {
  const dir = mkdtempSync(join(tmpdir(), 'email-clients-app-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'app', private: true }));
  run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error', ...npmFlags, ...deps], dir);
  writeFileSync(join(dir, 'esm.mjs'), scripts.esm);
  writeFileSync(join(dir, 'cjs.cjs'), scripts.cjs);
  return { dir, esm: JSON.parse(run('node', ['esm.mjs'], dir).trim()), cjs: JSON.parse(run('node', ['cjs.cjs'], dir).trim()) };
}

// HTML, with nothing but this package installed.
const HTML_EMAIL = '<!DOCTYPE html><html><body><table><tr><td style="font-family:Arial">Hi</td></tr></table></body></html>';
const ALONE = (load) => `
${load}
const run = async () => {
  const { previews, diagnostics } = await renderInEmailClients(${JSON.stringify(HTML_EMAIL)}, { emailClients: [...PREVIEW_CLIENTS], dark: true, fonts: "inline" });
  // A template needs core, which isn't installed: what to install, not a crash.
  const template = await renderInEmailClients({ type: "Email", props: {} }).then(() => null, (error) => ({ name: error.name, message: error.message }));
  return { previews: previews.map((p) => p.filename), approximate: previews.filter((p) => p.approximate).map((p) => p.id), diagnostics, inline: previews.some((p) => p.html.includes("data:font/woff2;base64,")), template };
};
run().then((out) => console.log(JSON.stringify(out)), (error) => console.log(JSON.stringify({ error: error.name, message: error.message })));`;
const HTML_ESM = ALONE('import { renderInEmailClients, PREVIEW_CLIENTS } from "@hyper-elements/email-clients";');
const HTML_CJS = ALONE('const { renderInEmailClients, PREVIEW_CLIENTS } = require("@hyper-elements/email-clients");');
const HTML_TS = `
import { renderInEmailClients, type EmailClientsResult, type EmailHtmlDiagnostic } from "@hyper-elements/email-clients";
export async function preview(html: string): Promise<EmailClientsResult<EmailHtmlDiagnostic>> {
  const result = await renderInEmailClients(html, { emailClients: ["outlook", "gmail-app"], dark: true });
  const ids: string[] = result.previews.map((p) => p.id);
  const lines: Array<number | null> = result.diagnostics.map((d) => d.line);
  return ids.length + lines.length ? result : result;
}
`;

const REACT = ['react@18.3.1', 'react-dom@18.3.1'];
const all = ['outlook.html', 'outlook-com.html', 'outlook-com.mac.html', 'gmail.html', 'gmail.mac.html', 'gmail-app.html', 'gmail-app.iphone.html', 'gmail-app-other.html', 'apple-mail.html', 'apple-mail.iphone.html', 'apple-mail.dark.html', 'apple-mail.iphone.dark.html', 'yahoo.html', 'yahoo.mac.html', 'yahoo.dark.html', 'yahoo.mac.dark.html', 'aol.html', 'aol.mac.html', 'aol.dark.html', 'aol.mac.dark.html', 'outlook-mac.html', 'outlook-mac.dark.html'];

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
  if (!/ERESOLVE|peer(Optional)? @hyper-elements\/react/.test(String(error.stderr ?? error.message))) throw error;
}
const older = project(['@hyper-elements/react@0.3.1', extension, ...REACT], ['--legacy-peer-deps']);
for (const format of ['esm', 'cjs']) {
  const out = older[format];
  if (out.error !== 'email-clients/version-mismatch' || !out.message.includes('PLUGIN_API (plugins)') || !out.message.includes('npm i @hyper-elements/react@^0.4.0 @hyper-elements/email-clients@^0.4')) fail(`${format} beside core 0.3.1: ${JSON.stringify(out)}`);
}

// 3. Alone: no core, no React.
const alone = project([extension], [], { esm: HTML_ESM, cjs: HTML_CJS });
for (const peer of ['@hyper-elements/react', 'react', 'react-dom']) {
  try {
    readFileSync(join(alone.dir, 'node_modules', peer, 'package.json'));
    fail(`installed alone, npm installed ${peer} too: the peers should be optional`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}
const approximate = ['outlook', 'outlook-com.mac', 'gmail.mac', 'gmail-app', 'gmail-app.iphone', 'gmail-app-other', 'apple-mail.iphone', 'apple-mail.dark', 'apple-mail.iphone.dark', 'yahoo', 'yahoo.mac', 'yahoo.dark', 'yahoo.mac.dark', 'aol', 'aol.mac', 'aol.dark', 'aol.mac.dark', 'outlook-mac', 'outlook-mac.dark'];
for (const format of ['esm', 'cjs']) {
  const out = alone[format];
  if (out.error) fail(`${format}, installed alone: ${out.error}: ${out.message}`);
  // Nothing in this email; at most a note about the captured checks on HTML (models 1.8.0 and later run them).
  if (JSON.stringify(out.previews) !== JSON.stringify(all) || !out.inline || out.diagnostics.some((d) => d.code !== 'email/captured-checks')) fail(`${format}, installed alone wrote ${JSON.stringify(out)}`);
  if (JSON.stringify(out.approximate) !== JSON.stringify(approximate)) fail(`${format}, installed alone marked ${JSON.stringify(out.approximate)} approximate`);
  if (out.template?.name !== 'email-clients/version-mismatch' || !out.template.message.includes("isn't installed") || !out.template.message.includes('npm i @hyper-elements/react@^0.4.0')) fail(`${format}, installed alone, a template call gave ${JSON.stringify(out.template)}`);
}
writeFileSync(join(alone.dir, 'index.ts'), HTML_TS);
const tsc = join(here, 'node_modules/.bin/tsc');
for (const [name, module, resolution] of [['node16', 'node16', 'node16'], ['bundler', 'esnext', 'bundler']]) {
  writeFileSync(join(alone.dir, `tsconfig.${name}.json`), JSON.stringify({ compilerOptions: { strict: true, noEmit: true, skipLibCheck: true, module, moduleResolution: resolution, target: 'es2022', types: [] }, files: ['index.ts'] }));
  try {
    run(tsc, ['-p', `tsconfig.${name}.json`], alone.dir);
  } catch (error) {
    fail(`a TypeScript project previewing HTML with no core or React doesn't type-check under ${name}:\n${error.stdout ?? ''}${error.stderr ?? ''}`);
  }
}

console.info('PACK_OK: beside the packed core and the models from npm, both module formats check an email with the plugin and write every preview with the fonts inlined; the tarball holds dist/, the fonts and their licences, and none of the models; beside core 0.3.1, npm reports the unmet peer and the first call throws email-clients/version-mismatch in both formats; installed alone, HTML previews in both formats, a template call says to install core, and it type-checks under node16 and bundler');
