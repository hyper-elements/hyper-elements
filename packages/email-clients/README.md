# @hyper-elements/email-clients

See a [Hyper Elements](https://hyperelements.dev) email as classic Outlook, Outlook.com, Gmail and Apple Mail draw it.

```bash
npm i @hyper-elements/email-clients
```

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
- `diagnostics`: `render()`'s.

A preview isn't an email: what you send is `render()`'s `html`. Classic Outlook's model is approximate, and the file
says so.

## What a preview says

An agent with a browser opens a file, waits for `<html data-email-client-ready>`, and reads its value: `ok`;
`incomplete` when something was missing (a font, an image) or 10 seconds passed; `error` when the preview failed. The
findings are JSON in `<script type="application/json" id="email-client-findings">`, and listed at the top of the file:

- `removed`: what the client removed or changed, and how often.
- `missing`: a font that isn't on this machine, one swapped for a font of other widths (`substituted`), the email's own
  web font that didn't load (`author-font`), an image that didn't load (drawn as a gray box of its size).
- `fonts`: the system fonts it drew with, checked against the widths they were measured with (`verified: "widths"`)
  or only found (`"present"`).
- `diagnostics`: what it found in what it drew, only where that's robust to the model's error:
  `email/more-lines` (a Heading or Button classic Outlook draws on more lines), `email/dark-contrast` (text that
  doesn't read in Apple Mail's dark mode) and `email/size` (where Gmail clips the email).

## Fonts

The previews draw with the open fonts the models were measured with, which ship in `fonts/` (SIL OFL 1.1): Selawik for
Segoe UI, Carlito for Calibri, and Inter. Aptos is drawn with Helvetica Neue at 93.5%; Arial, Georgia, Verdana,
Tahoma, Trebuchet MS, Times New Roman and Courier New come from the machine opening the file, as when they were
measured. `fonts: "url"` (the default) loads the open fonts from jsDelivr; `fonts: "inline"` puts them in each file
(up to 2 MB) so it draws offline, apart from the email's own images and web fonts, which it lists as missing.

The package builds on `@hyper-elements/react`'s public API, which it needs at ^0.3.1 (`render()`'s `blockMap`). With an
older one it throws `email-clients/version-mismatch`, with the command to install a matching pair.

## How the previews are made

Each file carries a runtime: email-renderer's models of the clients (`src/runtime/renderer/`, copied unchanged from
the commit `RUNTIME_SOURCE` pins) and the lifecycle around them (`src/runtime/`), bundled into one script
(`src/runtime.generated.ts`, committed, so the package builds without email-renderer). To move the pin: copy the
modules from the new commit, update `RUNTIME_SOURCE`, run `pnpm build:runtime`, and show the new scores in the PR.
`pnpm build` fails if the generated runtime isn't what its sources build. The open fonts in `fonts/` come from the same
email-renderer checkout: `pnpm build:fonts /path/to/email-renderer`.

## Releases

The package follows `@hyper-elements/react`'s minor: each of its minors works with the core releases of the same minor
from its peer floor up (`^0.3.1`, the first with `render()`'s `blockMap`), and its patches are its own (a pin move, a
re-capture, a new finding). `publish.yml` releases it on its own, tagged `email-clients-v<version>`, after core when
both change; a core release outside its range fails until the range is raised in the same change. Its first version is
published by hand after core 0.3.1, tagged `email-clients-v0.3.0`, and then npm's trusted publishing is set up for it.
Each release records in the changelog the email-renderer commit its runtime comes from and the captures it was scored
against.
