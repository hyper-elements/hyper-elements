# @hyper-elements/email-clients

A free JavaScript and TypeScript library for checking existing HTML emails and previewing Outlook, Gmail, Apple Mail,
Yahoo Mail and AOL Mail locally. Pass the complete HTML from MJML, React Email, an email builder or a hand-written email to
`renderInEmailClients(html)`. No React or `@hyper-elements/react` is required for HTML input, and the email is never sent
or uploaded. The [CLI](https://hyperelements.dev/docs/cli#any-html-email) provides the same workflow from the shell.

It also previews [Hyper Elements](https://hyperelements.dev) templates and provides `emailClients()`, a plugin for their
`validate()` and `render()` calls. Previews include classic Outlook, Outlook.com, Gmail, the Gmail app on Android and an
iPhone, Apple Mail on a Mac and an iPhone, Yahoo Mail and AOL Mail.

```bash
npm i @hyper-elements/email-clients
```

## Any HTML email

`renderInEmailClients()` takes an email built any other way (MJML, React Email, by hand, an email builder's export) as
its HTML. React and `@hyper-elements/react` aren't needed for that: they're optional peers, loaded only for a template,
so `npm i @hyper-elements/email-clients` is enough.

Save this as `preview-email.mjs` beside your complete `welcome.html` email:

```js
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { renderInEmailClients } from "@hyper-elements/email-clients";

const html = await readFile("welcome.html", "utf8");
const { previews, skipped } = await renderInEmailClients(html, { emailClients: ["outlook", "gmail-app"], dark: true });
await mkdir("out", { recursive: true });
for (const preview of previews) await writeFile(`out/${preview.filename}`, preview.html);
```

Run `node preview-email.mjs`, then open `out/outlook.html` in Chromium or Chrome. The file lists what the client changed.

- It takes the whole email, from `<html>` to `</html>`, and previews it exactly as given, as data in the file (none of
  its scripts, handlers or navigation run). A fragment, HTML as bytes (read it as text), or one of `render()`'s options,
  is a `TypeError`.
- Its options are the [preview options](#previews): `emailClients`, `dark`, `fonts`, `widths` and `computers`.
- The models are measured mostly on Hyper Elements emails. HTML built another way is emulated less closely in some
  clients, so its previews are `approximate` where a client is under 95% on such emails or isn't measured on them:
  classic Outlook, the Gmail apps, Apple Mail's dark mode, Apple Mail and the Gmail app on an iPhone, Yahoo Mail and AOL
  Mail, and webmail read on a Mac.
- It rejects with the import's error where `@hyper-elements/email-client-models` can't be loaded, and with
  `email-clients/version-mismatch` where the one installed speaks a protocol this package doesn't read. A template
  without `@hyper-elements/react` installed is `email-clients/version-mismatch` too, with what to install.
- In TypeScript without React and core, the declarations name their types: keep `skipLibCheck` on (the default).

`renderInEmailClients(html)` returns its checks, for the clients it previews, as its `diagnostics`.
Each is `{ code, severity, message, clients, fix, see, path: "html", line, excerpt }`: the line in the given HTML and up
to 80 characters of it.

- The CSS and stylesheet rules from caniemail's tables, over the whole email, once each, at their first line. Classic
  Outlook's conditional comments, other comments and scripts are left out, as clients other than classic Outlook read
  none of them, keeping every other line where it is.
- A `<style>` for the clients that remove every `<style>` (the Gmail apps with another account, and some webmail), one in
  the `<body>` for those that remove that one (Gmail), and an `@media` for those that apply none (classic Outlook).
- A web font (`@font-face`, or a font service's stylesheet `<link>`), and each image in a format some clients don't show.
- Gmail's limits as Gmail applies them: each `<style>` in the `<head>` over 16 KB on its own, and the whole email over
  102 KB.
- With `@hyper-elements/email-client-models` 1.8.0 or later, the checks only captures found, too. Without them, or where
  the models package can't load, a diagnostic about the checks says so (`email/captured-checks`, with no clients and no
  line), and the rest still run.

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
- **Where the models can't run** (no WebAssembly, or `@hyper-elements/email-client-models` can't be loaded), the plugin
  runs the checks from caniemail's tables only, and its first diagnostic (`email/captured-checks`) says so. The next
  `emailClients()` tries again.

Without the plugin, `validate()` and `render()` give an Email one note, `email/more-checks`, saying where these checks
are; `plugins: []` leaves it out.

## Previews

```tsx
import { mkdir, writeFile } from "node:fs/promises";
import { renderInEmailClients } from "@hyper-elements/email-clients";

const { previews, skipped, diagnostics } = await renderInEmailClients(<Welcome />, {
  emailClients: ["outlook", "gmail", "apple-mail"], // default: classic Outlook, Outlook.com, Gmail and Apple Mail
  dark: true, // also a dark preview where the client's dark mode was measured (Apple Mail, Yahoo Mail and AOL Mail)
  widths: { "outlook-com": 540 }, // optional: Outlook.com's reading pane beside its message list
  computers: ["windows", "mac"], // the default: Outlook.com, Gmail, Yahoo Mail and AOL Mail on the web as read on each
});
await mkdir("out", { recursive: true });
for (const preview of previews) await writeFile(`out/${preview.filename}`, preview.html);
```

Each preview is one self-contained HTML file. Open it in Chromium: it draws the email as that client does and lists
what the client changed. To show a preview, write the files and open them in your browser; otherwise give the paths.

- `widths`: the width a client's preview draws the email at, where it isn't the client's own (820px on desktop, 758px
  for Yahoo Mail's message pane and 869px for AOL Mail's, 380px for the Gmail apps, the width the Gmail app on Android
  lays an email out at). Apple Mail and the Gmail app are
  previewed on an iPhone too (`apple-mail.iphone`, 393px; `gmail-app.iphone`, 345px, the app's card; an iPhone 16),
  whatever their own width. Webmail matches an email's media queries at the browser window, not the pane the email is
  in, so at 540px Outlook.com keeps the email's desktop styles, as it does for its readers.
- `computers`: webmail (Outlook.com, Gmail, Yahoo Mail and AOL Mail) is read in a browser, whose fonts are the
  reader's computer's. Each is previewed on Windows (`outlook-com`, `gmail`, `yahoo`, `aol`: font stacks resolved
  against Windows' fonts, as Chrome there does, so `Didot, Georgia` draws Georgia even on a Mac) and on a Mac
  (`outlook-com.mac` and so on: the fonts of the Mac the preview is opened on), and Yahoo Mail's and AOL Mail's dark
  previews on each too (`yahoo.dark`, `yahoo.mac.dark`). `computers: ["windows"]` keeps one. AOL Mail's dark mode
  leaves the email as it is, so its dark preview matches its light one.
- `previews`: `{ id, client, model, computer, variant, dark, width, filename, html, approximate }` for each client and
  variant, in the order asked for, light before dark; `model` is the models' client it's drawn with (`apple-mail-ios`
  for Apple Mail on an iPhone, `gmail-app-ios` for the Gmail app on one).
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
Segoe UI and Carlito for Calibri; and for the Gmail apps, Android's own fonts: Roboto, Noto Serif, and Noto Sans Mono for Droid Sans Mono, whose
widths it shares. Arial, Georgia, Verdana, Tahoma, Trebuchet MS, Times New Roman and Courier
New come from the machine opening the file, as when they were measured. `fonts: "url"` (the default) loads the open
fonts from jsDelivr; `fonts: "inline"` puts them in each file so it draws offline, apart from the email's own images and
web fonts, which it lists as missing. Inlined, classic Outlook's file is about 1 MB plus the email.

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
