#!/usr/bin/env node
// Run with: node --disallow-code-generation-from-strings scripts/csp-probe.mjs
//
// CSP safety gate for @hyper-elements/react.
//
// If any code render() or the builder adapter reaches evaluates a string (eval /
// new Function) at import or render time, a strict
// Content-Security-Policy without 'unsafe-eval' blocks it and the package throws
// in browsers, iframes, and CSP'd SSR — before any render runs. V8's
// --disallow-code-generation-from-strings is the engine-level equivalent of such
// a CSP, so importing + rendering the built bundles under it proves the shipped
// output is CSP-safe.
//
// This is a HARD gate. It fails if importing or rendering the built `dist/`
// evaluates a string anywhere. A green check must mean "@hyper-elements/react
// is genuinely CSP-safe."

const CSP_ERROR = /Code generation from strings disallowed/;

try {
  const React = (await import('react')).default;
  // The components (the main entry) in each of their roots, and the builder's design (/builder) both ways.
  const p = await import('../dist/primitives.js');
  const { toDesign, fromDesign } = await import('../dist/builder.js');
  const h = React.createElement;
  const content = () => [
    h(p.Heading, { key: 'h' }, 'Heading'),
    h(p.Text, { key: 'p' }, 'Words ', h(p.Link, { href: 'https://example.com' }, 'a link'), h(p.MergeTag, { name: 'first_name' })),
    h(p.Row, { key: 'r' }, h(p.Column, null, h(p.Text, null, 'Left')), h(p.Column, null, h(p.Text, null, 'Right'))),
    h(p.List, { key: 'l' }, h(p.ListItem, null, 'An item')),
    h(p.Table, { key: 't' }, h(p.TableRow, null, h(p.TableCell, null, 'A cell'))),
    h(p.Button, { key: 'b', href: 'https://example.com' }, 'Button'),
    h(p.Menu, { key: 'm', items: [{ text: 'Home', href: 'https://example.com' }] }),
    h(p.Social, { key: 's', icons: [{ name: 'Facebook', href: 'https://example.com' }] }),
    h(p.Video, { key: 'v', src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
  ];
  for (const root of [h(p.Email, null, content()), h(p.Page, null, content()), h(p.Document, null, content()), h(p.Canvas, { width: 600, height: 900 }, content())]) {
    const { html, text } = await p.render(root);
    if (!html || !text) {
      console.error('CSP_FAIL: the new components rendered no output');
      process.exit(2);
    }
  }
  fromDesign(toDesign(h(p.Email, null, content())).design);
  // A template (/template): defined, its values checked (a pattern compiled), described, and its design rendered.
  const t = await import('../dist/template.js');
  const Card = t.template({
    id: 'acme.Card',
    version: '1.0.0',
    label: 'Card',
    root: 'Email',
    fields: {
      title: p.prop.text({ label: 'Title', required: true, pattern: '^[A-Z]' }),
      items: p.prop.list(p.prop.text({ label: 'Item' }), { label: 'Items', max: 3 }),
      when: p.prop.date({ label: 'When' }),
    },
    example: { title: 'Hello', items: ['a'], when: '2026-12-03' },
    render: (v) => h(p.Email, null, h(p.Heading, { field: 'title' }, v.title), h(p.Text, null, v.when ? t.formatDate(v.when, 'en-US') : '')),
  });
  Card.describe();
  if (!Card.check(Card.example).valid || !(await p.render(h(Card, Card.example))).html) {
    console.error('CSP_FAIL: a template rendered no output');
    process.exit(2);
  }
  // A slot: its content captured on its own, its policies checked, and the snapshot rendered.
  const Slotted = t.template({
    id: 'acme.Slotted',
    version: '1.0.0',
    label: 'Slotted',
    root: 'Email',
    fields: { body: t.field.slot({ label: 'Body', allow: 'all', styles: 'free', count: { Button: { max: 1 } } }) },
    example: {},
    render: (v) => h(p.Email, null, h(p.Section, { field: 'body' }, v.body)),
  });
  const slotted = Slotted.check({ body: h(p.Column, null, h(p.Text, null, 'Slot content')) });
  if (!slotted.valid || !(await p.render(slotted.snapshots.default)).html.includes('Slot content')) {
    console.error('CSP_FAIL: a template with a slot rendered no output');
    process.exit(2);
  }

  console.info(
    `CSP_OK: @hyper-elements/react imports + renders its components in every root (HTML and plain text), and ` +
      `takes them to the builder and back, and checks and renders a template, under strict CSP — no eval / new Function`,
  );
} catch (err) {
  const message = String((err && err.message) || err);
  if (CSP_ERROR.test(message)) {
    console.error(
      `CSP_FAIL: @hyper-elements/react evaluates a string (eval / new Function) at import or render — ` +
        `it would throw under a Content-Security-Policy without 'unsafe-eval'.\n${message}`,
    );
  } else {
    console.error(`CSP probe failed to run: ${message}`);
  }
  process.exit(3);
}
