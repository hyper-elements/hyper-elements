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

The package builds on `@hyper-elements/react`'s public API, which it needs at ^0.3.1 (`render()`'s `blockMap`). With an
older one it throws `email-clients/version-mismatch`, with the command to install a matching pair.
