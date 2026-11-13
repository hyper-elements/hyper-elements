# @hyper-elements/lint

Lint [Hyper Elements](https://github.com/hyper-elements/hyper-elements) emails and pages for what makes them hard to
read or use: links that don't say where they go, images without alternate text, text too faint or too small, headings
out of order, merge syntax typed into the copy by hand.

```bash
npm i -D @hyper-elements/lint
```

It's a plugin for Elements' `validate()` and `render()`, so it runs wherever they do: in a test, on a server, in the
browser.

```tsx
import { render } from "@hyper-elements/react";
import { lint } from "@hyper-elements/lint";

const { html, diagnostics } = await render(<Welcome />, { plugins: [lint()] });
// [{ code: "email/lint-link-text", severity: "warning", path: "root.children[2]",
//    message: 'The Button says "Click here": a screen reader lists links by their words alone',
//    fix: 'say where it goes ("Confirm your email"), or give it an aria-label',
//    see: "https://www.hyperelements.dev/docs/lint#link-text" }]
```

Findings are warnings and notes, never errors: `email/lint-<rule>` on an Email, `page/lint-<rule>` on a Page, nothing on
a Document or a Canvas. Lint reads the laid-out template as each output writes it, at desktop and at phone width: what's
hidden where, the size text is shown at, and the background behind it.

## Options

```tsx
lint({ rules: { "text-size": "off", contrast: "info" }, kind: "marketing" });
```

- `rules`: a rule's severity (`"off"`, `"info"` or `"warning"`) by its id.
- `kind`: `"marketing"` or `"transactional"`; `"marketing"` checks there's a way to unsubscribe.

A rule, severity or kind it doesn't know throws a `TypeError` when `lint()` is called. `rules` lists every rule (its id,
default severity, roots, summary, fix and docs link).

## Rules

`image-alt`, `alt-text`, `link-text`, `link-empty`, `link-target`, `heading-order`, `heading-one`, `heading-empty`,
`contrast`, `text-size`, `lang`, `dir`, `title`, `preview-text`, `merge-syntax`, `unsubscribe`, `video-title`. Each is
described at [hyperelements.dev/docs/lint](https://www.hyperelements.dev/docs/lint).

Works with `@hyper-elements/react` 0.4. Lint imports nothing of it at run time: it reads the tree the plugin is handed.
MIT licensed.
