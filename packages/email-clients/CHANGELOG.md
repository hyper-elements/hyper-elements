# @hyper-elements/email-clients

Each release records the models package it was tested with.

## Unreleased (0.4.0)

The first release, with core 0.4.0.

- **New: `emailClients(options?)`**, the email client checks as a plugin for `validate()` and `render()`:
  `validate(<Welcome />, { plugins: [await emailClients()] })`. These are the checks core had until 0.3, moved here
  with their codes and messages: an Html block's CSS a client removes (and, new, what the clients that keep a `<style>`
  remove inside one), image formats, web font fallbacks, phone styles, classic Outlook's layout, the styles a client
  draws otherwise, hover styles, and Gmail's size limits. `options.clients` replaces core's `emailClients` option;
  `EMAIL_CLIENTS` and `DEFAULT_EMAIL_CLIENTS` are exported from here.
  - `email/width` and `email/image-width` now name classic Outlook (`clients: ["outlook"]`): asked for clients without
    it, they're left out.
  - Core's diagnostics come before the plugin's, so an email's list can be in another order than 0.3 gave it.
  - Passed to a Page, a Document or a Canvas, the plugin checks nothing; given `clients`, it says so
    (`email/clients-ignored`).
- **New: `renderInEmailClients(element, { emailClients, dark, fonts, ...renderOptions })`** writes one HTML preview
  file per email client: classic Outlook, Outlook.com, Gmail, the Gmail apps and Apple Mail (light and dark). Clients
  with no model to draw with, and dark modes not measured, are listed in `skipped` with the reason. Its `diagnostics`
  have the plugin's checks for the clients previewed.
- A preview loads Inter's stand-in only where the email names Inter: with `fonts: "inline"`, classic Outlook's file is
  about 1 MB plus the email, not 2 MB.
- Where the models package can't be imported, or its WebAssembly compiled, the plugin runs the checks from caniemail's
  tables and says so (`email/captured-checks`); the next `emailClients()` tries again.
- Each file draws the email in a sandboxed frame beside the email as written, with the client's fonts, and says when
  it's done (`data-email-client-ready`: `ok`, `incomplete` or `error`). Its findings list what the client removed,
  what was missing (fonts, swapped fonts, web fonts, images), the system fonts it drew with, and `email/more-lines`,
  `email/dark-contrast` and `email/size`.
- The models of the clients are `@hyper-elements/email-client-models` 1.0.0 (a dependency, free to use under its own
  licence), scored against the captures of 8 November 2026 (Elements 0.3.0).
- Needs `@hyper-elements/react` ^0.4.0. An older core throws `email-clients/version-mismatch` at the first call, with
  the command to install a matching pair.
