#!/usr/bin/env node
// Run with: node --disallow-code-generation-from-strings scripts/csp-probe.mjs
//
// CSP safety gate for @hyper-elements/email-clients: importing the built package and writing previews evaluates no
// string (eval / new Function), so it runs where a Content-Security-Policy has no 'unsafe-eval'. (The preview files
// themselves run in a browser, under their own CSP: the runtime's tests check those.)

const CSP_ERROR = /Code generation from strings disallowed/;

try {
  const React = (await import('react')).default;
  const core = await import('@hyper-elements/react');
  const { renderInEmailClients, PREVIEW_CLIENTS } = await import('../dist/index.js');
  const h = React.createElement;
  const email = h(core.Email, { width: 600 }, h(core.Heading, null, 'Heading'), h(core.Text, null, 'Words'), h(core.Button, { href: 'https://example.com' }, 'Go'));
  const { previews } = await renderInEmailClients(email, { emailClients: [...PREVIEW_CLIENTS], dark: true, fonts: 'inline' });
  if (previews.length < PREVIEW_CLIENTS.length || previews.some((p) => !p.html.startsWith('<!DOCTYPE html>'))) {
    console.error('CSP_FAIL: renderInEmailClients() wrote no previews');
    process.exit(2);
  }
  console.info('CSP_OK: @hyper-elements/email-clients imports and writes a preview for every client under strict CSP — no eval / new Function');
} catch (err) {
  const message = String((err && err.message) || err);
  console.error(CSP_ERROR.test(message) ? `CSP_FAIL: @hyper-elements/email-clients evaluates a string (eval / new Function).\n${message}` : `CSP probe failed to run: ${message}`);
  process.exit(3);
}
