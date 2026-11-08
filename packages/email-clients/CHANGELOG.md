# @hyper-elements/email-clients

Each release records the email-renderer commit its runtime comes from and the capture dates it was scored against.

## Unreleased

- New: `renderInEmailClients(element, { emailClients, dark, fonts, ...renderOptions })` writes one HTML preview file
  per email client: classic Outlook, Outlook.com, Gmail, the Gmail apps and Apple Mail (light and dark). Clients with
  no model to draw with, and dark modes not measured, are listed in `skipped` with the reason.
- Needs `@hyper-elements/react` ^0.3.1 (render()'s `blockMap`). An older core throws `email-clients/version-mismatch`
  at the first call, with the command to install a matching pair.
