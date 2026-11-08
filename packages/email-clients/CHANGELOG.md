# @hyper-elements/email-clients

Each release records the email-renderer commit its runtime comes from and the capture dates it was scored against.

## Unreleased

- New: `renderInEmailClients(element, { emailClients, dark, fonts, ...renderOptions })` writes one HTML preview file
  per email client: classic Outlook, Outlook.com, Gmail, the Gmail apps and Apple Mail (light and dark). Clients with
  no model to draw with, and dark modes not measured, are listed in `skipped` with the reason.
- Each file draws the email in a sandboxed frame beside the email as written, with the client's fonts, and says when
  it's done (`data-email-client-ready`: `ok`, `incomplete` or `error`). Its findings list what the client removed,
  what was missing (fonts, swapped fonts, web fonts, images), the system fonts it drew with, and `email/more-lines`,
  `email/dark-contrast` and `email/size`.
- The runtime is email-renderer's models at f65fabe5, scored against the captures of 8 November 2026 (Elements 0.3.0).
- Needs `@hyper-elements/react` ^0.3.1 (render()'s `blockMap`). An older core throws `email-clients/version-mismatch`
  at the first call, with the command to install a matching pair.
