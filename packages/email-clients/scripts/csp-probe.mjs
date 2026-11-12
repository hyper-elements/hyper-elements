#!/usr/bin/env node
// Run with: node --disallow-code-generation-from-strings scripts/csp-probe.mjs
//
// CSP safety gate for @hyper-elements/email-clients: importing the built package, checking an email with the plugin
// (which compiles the models' WebAssembly) and writing previews, from the main entry and from /html (an HTML email, with
// no React or core imported first), evaluates no string (eval / new Function), so it runs where a
// Content-Security-Policy has no 'unsafe-eval'. (The preview files themselves run in a browser, under their own
// CSP: the runtime's tests check those.)

const CSP_ERROR = /Code generation from strings disallowed/;

try {
  // /html first, before anything imports React or core.
  const html = await import('../dist/html.js');
  const email = '<!DOCTYPE html><html><body><table><tr><td style="font-family:Arial">Hi</td></tr></table></body></html>';
  const fromHtml = await html.renderInEmailClients(email, { emailClients: [...html.PREVIEW_CLIENTS], dark: true, fonts: 'inline' });
  if (fromHtml.previews.length < html.PREVIEW_CLIENTS.length || fromHtml.previews.some((p) => !p.html.startsWith('<!DOCTYPE html>'))) {
    console.error('CSP_FAIL: renderInEmailClients(html) from /html wrote no previews');
    process.exit(2);
  }
  const React = (await import('react')).default;
  const core = await import('@hyper-elements/react');
  const { emailClients, renderInEmailClients, PREVIEW_CLIENTS } = await import('../dist/index.js');
  const h = React.createElement;
  const template = h(core.Email, { width: 600 }, h(core.Heading, null, 'Heading'), h(core.Text, { style: { letterSpacing: 2 } }, 'Words'), h(core.Button, { href: 'https://example.com' }, 'Go'));
  const checked = core.validate(template, { plugins: [await emailClients()] }).diagnostics;
  if (!checked.some((d) => d.code === 'email/outlook-degraded') || checked.some((d) => d.code === 'email/captured-checks')) {
    console.error(`CSP_FAIL: the plugin's captured checks didn't run: ${JSON.stringify(checked)}`);
    process.exit(2);
  }
  const { previews } = await renderInEmailClients(template, { emailClients: [...PREVIEW_CLIENTS], dark: true, fonts: 'inline' });
  if (previews.length < PREVIEW_CLIENTS.length || previews.some((p) => !p.html.startsWith('<!DOCTYPE html>'))) {
    console.error('CSP_FAIL: renderInEmailClients() wrote no previews');
    process.exit(2);
  }
  console.info('CSP_OK: @hyper-elements/email-clients imports, checks an email with the plugin and writes a preview for every client, from the main entry and from /html, under strict CSP — no eval / new Function');
} catch (err) {
  const message = String((err && err.message) || err);
  console.error(CSP_ERROR.test(message) ? `CSP_FAIL: @hyper-elements/email-clients evaluates a string (eval / new Function).\n${message}` : `CSP probe failed to run: ${message}`);
  process.exit(3);
}
