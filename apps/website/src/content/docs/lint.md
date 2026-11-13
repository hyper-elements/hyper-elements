---
title: "Lint"
metaTitle: "Lint: accessibility and quality checks for emails and pages"
description: "@hyper-elements/lint checks an email or a page for what makes it hard to read: links that don't say where they go, images without alternate text, faint or small text, headings out of order, merge syntax typed by hand."
---

`@hyper-elements/lint` checks an email or a page for what makes it hard to read or use: links that don't say where they go, images without alternate text, text too faint or too small, headings out of order, merge syntax typed into the copy by hand. Elements' own checks say whether a template is correct, and the [email client emulator](/docs/email-client-emulator) what each email client does to it; lint says whether it's good.

```bash
npm i -D @hyper-elements/lint
```

It's a plugin, so it runs wherever `validate()` and `render()` do: in a test, on a server, in the browser. For HTML made any other way, there's [`lintHtml()`](#any-html-email).

```tsx
import { render, validate } from "@hyper-elements/react";
import { lint } from "@hyper-elements/lint";

const { html, diagnostics } = await render(<Welcome />, { plugins: [lint()] });
diagnostics[0];
// { code: "email/lint-link-text", severity: "warning", path: "root.children[2]",
//   message: 'The Button says "Click here": a screen reader lists links by their words alone',
//   fix: 'say where it goes ("Confirm your email"), or give it an aria-label',
//   see: "https://www.hyperelements.dev/docs/lint#link-text" }
```

Its findings are [diagnostics](/docs/diagnostics) like Elements' own: warnings and notes, never errors, so lint never stops a render. On an Email they're `email/lint-<rule>`, on a Page `page/lint-<rule>`; a Document and a Canvas get none. Each says where in the template it is, what to do, and links to its rule below.

## It reads the template, not the HTML

Lint reads the laid-out template, as each output writes it, so it knows what a reader gets:

- **At desktop and at phone width.** A block hidden on phones isn't checked there, and text gets the size it's shown at on each: 16px on desktop and 12px on phones is small on phones. A finding names the width it's found at where it's only one.
- **What's behind the text.** Contrast is checked against the nearest background, with see-through ones mixed in, as WCAG does. Text over a `Layer`'s image isn't checked where the image is drawn.
- **What each link says.** A `Button`'s words or `aria-label`, a `Link`'s words, or the `alt` of the images it holds.

## Options

```tsx
lint({
  rules: { "text-size": "off", contrast: "info" }, // a rule's severity, or off
  kind: "marketing",                               // a marketing email needs a way to unsubscribe
});
```

`rules` sets a rule's severity, `"off"`, `"info"` or `"warning"`, by its id. `kind` is `"marketing"` or `"transactional"`: `"marketing"` turns on [`unsubscribe`](#unsubscribe). A rule, severity or kind lint doesn't know throws a `TypeError` when `lint()` is called.

`rules` lists every rule with its default severity, the roots it runs on, what it checks, its fix and its docs link, for a tool that shows them:

```ts
import { rules } from "@hyper-elements/lint";
rules.find((rule) => rule.id === "contrast");
// { id: "contrast", severity: "warning", roots: ["Email", "Page"], summary: "…", fix: "…", see: "…#contrast" }
```

## Any HTML email

`lintHtml()`, from `@hyper-elements/lint/html`, runs the rules HTML can show on any HTML email, however it was made (MJML, React Email, by hand). It needs nothing else installed: no Elements, no React.

```ts
import { lintHtml } from "@hyper-elements/lint/html";

const { diagnostics } = lintHtml(html, { rules: { title: "off" } });
diagnostics[0];
// { code: "lint/image-alt", severity: "warning", line: 42, column: 7,
//   message: 'This image has no alt attribute: a screen reader reads out its file name instead (src "hero.png")',
//   fix: "…", see: "https://www.hyperelements.dev/docs/lint#image-alt" }
```

Its findings are `lint/<rule>`, each with its line and column. It takes the same options as `lint()`. On HTML with an `<html>` or a `<body>`, a whole document, it also checks the heading order, one `<h1>`, the language and the title. Outlook's conditional comments (`<!--[if mso]>`) are skipped: what's in them is Outlook's copy of what's outside them. An `Html` block's markup in a template gets the same rules, at the block's `html`, with its line.

HTML can't say what a template can. `lintHtml()` doesn't check contrast or text size (that needs the CSS cascade), and doesn't check merge syntax: in HTML, a hand-typed `{{name}}` and a `MergeTag`'s output look the same.

## Rules

<!-- rules:start (written from the package's rules by its docs test: UPDATE_LINT_DOCS=1 pnpm --filter @hyper-elements/lint test docs) -->

### `image-alt`

A link holds only images with no alternate text, so a screen reader has nothing to read out for it. In HTML, any link with nothing to name it, and an image with no alt attribute at all.

A warning by default, on an Email and a Page, and on HTML (an `Html` block's and `lintHtml()`'s). **Fix:** give the image an alt that says where the link goes, or the link an aria-label.

### `alt-text`

An image's alternate text is a file name, a URL or a word like "image" or "logo", which says nothing about it.

A note by default, on an Email and a Page. **Fix:** say what the image shows ("Tarn's logo", "A blue bowl"), or leave alt empty if it's only decoration.

### `link-text`

A link or button says only "click here", "read more" or the like: screen readers list links by their words alone.

A warning by default, on an Email and a Page, and on HTML (an `Html` block's and `lintHtml()`'s). **Fix:** say where it goes ("Confirm your email"), or give it an aria-label.

### `link-empty`

A link or button has no words, alternate text, aria-label or title: nothing names it.

A warning by default, on an Email and a Page. **Fix:** give it words, or an aria-label.

### `link-target`

A link goes nowhere (empty, #, a mailto: or tel: with no address or number), over http: rather than https:, or (in HTML) runs a script.

A warning by default, on an Email and a Page, and on HTML (an `Html` block's and `lintHtml()`'s). **Fix:** link to the page it's for, over https:.

### `heading-order`

A heading is more than one level below the heading before it (an h2 followed by an h4).

A warning by default, on an Email and a Page, and on a whole HTML document (`lintHtml()`'s). **Fix:** use the next level down, and style it as you want it to look.

### `heading-one`

There's more than one level-1 heading.

A note by default, on an Email and a Page, and on a whole HTML document (`lintHtml()`'s). **Fix:** keep one level-1 heading, the title, and use level 2 for the rest.

### `heading-empty`

A heading has no words.

A warning by default, on an Email and a Page, and on HTML (an `Html` block's and `lintHtml()`'s). **Fix:** give it words, or take it out.

### `contrast`

Text is too faint against its background to read easily: under WCAG AA's 4.5:1, or 3:1 for large text.

A warning by default, on an Email and a Page. **Fix:** darken the text or lighten the background (or the reverse) until it reaches the ratio.

### `text-size`

Body text is under 14px, hard to read on a phone.

A note by default, on an Email and a Page. **Fix:** make it 14px or larger, on phones at least (style.mobile.fontSize).

### `lang`

The email or page doesn't say its language, so a screen reader may read it in the wrong one.

A warning by default, on an Email and a Page, and on a whole HTML document (`lintHtml()`'s). **Fix:** give the root a lang ("en", "fr").

### `dir`

The language is written right to left, but the root doesn't say so.

A warning by default, on an Email and a Page. **Fix:** give the root dir="rtl".

### `title`

The page has no title for the browser's tab and for screen readers.

A note by default, on a Page, and on a whole HTML document (`lintHtml()`'s). **Fix:** give the root a title.

### `preview-text`

The email has no preview text, or a very short one: inboxes show its first words instead.

A note by default, on a Email. **Fix:** give the Email a previewText of 30 characters or more.

### `merge-syntax`

Merge syntax ({{name}}, *|NAME|*, %%name%%) is typed into the text, where a MergeTag would write it.

A warning by default, on an Email and a Page. **Fix:** use <MergeTag name="…" />, which writes your sending service's syntax (the mergeTag option).

### `unsubscribe`

A marketing email (kind: "marketing") has no unsubscribe link.

A warning by default, on a Email. **Fix:** add a link to unsubscribe or manage preferences, or the service's MergeTag for one.

### `video-title`

A video's title is the default, "Video": the alternate text of its thumbnail in an email.

A note by default, on an Email and a Page. **Fix:** give it a title that says what the video is.

### `role-button`

A link has role="button": screen readers announce a button, which a link in an email isn't.

A warning by default, on HTML (an `Html` block's and `lintHtml()`'s). **Fix:** take the role off: a link is a link, however it looks.

<!-- rules:end -->
