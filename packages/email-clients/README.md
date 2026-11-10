# @hyper-elements/email-clients

The email client checks for [Hyper Elements](https://hyperelements.dev), and previews of a Hyper Elements email as
classic Outlook, Outlook.com, Gmail and Apple Mail draw it.

```bash
npm i @hyper-elements/email-clients
```

## Checks

`emailClients()` is a plugin for `validate()` and `render()`: what classic Outlook, Gmail, Apple Mail and the other
clients remove or change in an email, each diagnostic naming the clients it's about.

```tsx
import { validate } from "@hyper-elements/react";
import { emailClients } from "@hyper-elements/email-clients";

validate(<Welcome />, { plugins: [await emailClients()] }); // the 11 clients most email is read in
validate(<Welcome />, { plugins: [await emailClients({ clients: ["gmail", "outlook"] })] }); // only these
```

- **Where they come from:** caniemail's tables ([caniemail.com](https://www.caniemail.com), MIT, © Rémi Parmentier),
  for every client, and captures of the four measured clients, for what only captures found. Each diagnostic with a
  caniemail source links its page (`see`).
- **What's checked:** an Html block's CSS a client removes (inline and in a `<style>`), image formats, web fonts and
  their fallbacks, phone styles where a client doesn't apply them, classic Outlook's layout (a box in a Row without a
  width, an Image without one, a Row kept side by side), styles a client draws otherwise (font weights, corners,
  letter spacing), hover styles, and Gmail's size limits (`render()` only: they're measured on the written email).
- **Clients:** `EMAIL_CLIENTS` lists the 26 it knows, with what's measured of each; `DEFAULT_EMAIL_CLIENTS` the 11
  checked when none are named. A diagnostic for clients not asked for is left out, and one said of several clients is
  one diagnostic with all of them.
- **Await it:** `emailClients()` compiles the models' WebAssembly module once, so it returns a Promise. Passed without
  `await`, core skips it and says so (`plugin/invalid`).
- **Where WebAssembly isn't available,** the plugin runs the checks from caniemail's tables only, and its first
  diagnostic (`email/captured-checks`) says so.

Without the plugin, `validate()` and `render()` give an Email one note, `email/more-checks`, saying where these checks
are; `plugins: []` leaves it out.

## Previews

```tsx
import { writeFile } from "node:fs/promises";
import { renderInEmailClients } from "@hyper-elements/email-clients";

const { previews, skipped, diagnostics } = await renderInEmailClients(<Welcome />, {
  emailClients: ["outlook", "gmail", "apple-mail"], // default: classic Outlook, Outlook.com, Gmail and Apple Mail
  dark: true, // also a dark preview where the client's dark mode was measured (Apple Mail)
});
for (const preview of previews) await writeFile(`out/${preview.filename}`, preview.html);
```

Each preview is one self-contained HTML file. Open it in Chromium: it draws the email as that client does and lists
what the client changed. To show a preview, write the files and open them in your browser; otherwise give the paths.

- `previews`: `{ id, client, variant, dark, width, filename, html, approximate }` for each client and variant, in the
  order asked for, light before dark.
- `skipped`: what wasn't previewed, and why (a client with no model to draw with, a dark mode not measured).
- `diagnostics`: `render()`'s, with the plugin's checks for the clients previewed (unless you passed your own
  `emailClients()` in `plugins`, which is used as it is).

A preview isn't an email: what you send is `render()`'s `html`. Classic Outlook's model is approximate, and the file
says so.

### What a preview says

An agent with a browser opens a file, waits for `<html data-email-client-ready>`, and reads its value: `ok`;
`incomplete` when something was missing (a font, an image) or 10 seconds passed; `error` when the preview failed. The
findings are JSON in `<script type="application/json" id="email-client-findings">`, and listed at the top of the file:

- `removed`: what the client removed or changed, and how often (by kind, as the client models count it, such as
  `"position (inline)"`; not yet by block).
- `missing`: a font that isn't on this machine, one swapped for a font of other widths (`substituted`), the email's own
  web font that didn't load (`author-font`), an image that didn't load (drawn as a gray box of its size).
- `fonts`: the system fonts it drew with, checked against the widths they were measured with (`verified: "widths"`)
  or only found (`"present"`).
- `diagnostics`: what it found in what it drew, only where that's robust to the model's error: `email/more-lines` (a
  Heading or Button classic Outlook draws on more lines), `email/dark-contrast` (text that doesn't read in Apple Mail's
  dark mode; inside an Html block, with a `selector`) and `email/size` (where Gmail clips the email).

### Fonts

The previews draw with the open fonts the models were measured with, which ship in `fonts/` (SIL OFL 1.1): Selawik for
Segoe UI, Carlito for Calibri, and Inter. Arial, Georgia, Verdana, Tahoma, Trebuchet MS, Times New Roman and Courier
New come from the machine opening the file, as when they were measured. `fonts: "url"` (the default) loads the open
fonts from jsDelivr; `fonts: "inline"` puts them in each file so it draws offline, apart from the email's own images and
web fonts, which it lists as missing.

### How the previews are made

Each file carries two scripts, which its Content-Security-Policy lets run by their hashes, and nothing else:

- **the models:** `@hyper-elements/email-client-models`' browser script, which decides what each client does to the
  email, as WebAssembly (the CSP allows `'wasm-unsafe-eval'` for it);
- **the runtime** (`src/runtime/`): the sandboxed frames, the block paths written into the email, the fonts and images,
  and the findings file, bundled into one script (`src/runtime.generated.ts`, committed; `pnpm build` fails if it isn't
  what its sources build).

The open fonts in `fonts/` come from a checkout of the models' repository: `pnpm build:fonts /path/to/checkout`.

## The models package

The models of the clients, and the checks only captures found, are a separate package,
[`@hyper-elements/email-client-models`](https://www.npmjs.com/package/@hyper-elements/email-client-models), installed
with this one. It's free to use, under its own licence (not open source); this package is MIT.

## Versions

This package follows `@hyper-elements/react`'s minor: 0.4 works with core `^0.4.0` (plugins, and `render()`'s
`blockMap` in format 2). With an older core, 0.3.x included, `emailClients()` and `renderInEmailClients()` throw
`email-clients/version-mismatch`, with the command to install a matching pair; so does a models package whose protocol
this one doesn't read.

`publish.yml` releases it on its own, tagged `email-clients-v<version>`, after core when both change. Each release
records in the changelog the models package it was tested with.
