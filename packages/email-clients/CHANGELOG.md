# @hyper-elements/email-clients

Each release records the models package it was tested with.

## Unreleased

- **Yahoo Mail and AOL Mail:** `yahoo` and `aol` are previewed, as webmail read on Windows and on a Mac (`yahoo`,
  `yahoo.mac`, and so on), in their message panes, 758px and 869px wide, with a dark preview of each with `dark: true`.
  Drawn with the models' `yahoo` and `aol` (1.11.0).
  - On the models' benchmark: 99.3% of lines within 3px for Yahoo Mail (98.4% in dark mode), 99.0% for AOL Mail.
  - **On emails they weren't tuned on**, the 60 Elements 0.3.0 held-out emails, in screenshots from Mailgun Inspect:
    97.8% of lines within 3px for Yahoo Mail (97.1% in dark mode), 92.3% for AOL Mail. `EMAIL_CLIENTS` gives these as
    `screenshots` (a new optional field, type `EmailClientScreenshots`): lines, not words, since a screenshot has no
    word positions, so `measured` stays null for both. AOL Mail's preview is `approximate`: its own web font, drawn
    with Roboto, sets lines a pixel or so from where AOL does.
  - For HTML not built with Hyper Elements, they're approximate (measured on two such emails), as
    `APPROXIMATE_FOR_HTML` lists.
  - AOL Mail draws text the email doesn't style in its own web font: previews draw it with Roboto and Open Sans Italic,
    loaded whether or not the email names Open Sans.
  - AOL Mail's dark mode leaves the email as it is.
- Requires `@hyper-elements/email-client-models` 1.11.0.
- **The Gmail app on an iPhone:** `gmail-app` previews add `gmail-app.iphone`, the Gmail app on an iPhone 16 with
  iOS 26, in its 345px card: Gmail's version of the email as on Android, in iOS's fonts, line heights in whole pixels.
  Drawn with the models' `gmail-app-ios` (1.10.0), 97.1% of the benchmark's lines within 3px. Its dark mode isn't
  previewed, as the Gmail app's isn't; for HTML not built with Hyper Elements it's approximate.
- Requires `@hyper-elements/email-client-models` 1.10.0.

## 0.4.6

- **Apple Mail on an iPhone:** `apple-mail` previews add `apple-mail.iphone` (and `apple-mail.iphone.dark` with
  `dark: true`), Mail on an iPhone 16 with iOS 18, 393px wide: the email at the phone's width, its media queries
  matching there, iOS's fonts, and an element wider than the screen shrunk to fit on its own, as Mail does. Drawn with
  the models' `apple-mail-ios` (each preview's config names its `model`). On the models' benchmark it places 98.0% of
  lines within 3px; for HTML not built with Hyper Elements it's approximate (measured on two such emails), as
  `APPROXIMATE_FOR_HTML` lists.
- **Classic Outlook draws Aptos with a stand-in of its widths**, character by character (Inter, SIL OFL), shipped in
  `fonts/` (`AptosWidths-Regular.woff2`, `AptosWidths-Bold.woff2`): before, Helvetica Neue stood in, which only a Mac
  has. **Office's cloud fonts** (Lato, Montserrat, Open Sans, Poppins, Nunito Sans), which classic Outlook draws by
  name, are in `fonts/` too, loaded only where the email names the family.
- **Apple Mail draws a font stack as a standard Mac with Microsoft Office has it**: Segoe UI and Calibri with Selawik
  and Carlito, which its previews now load; a family such a Mac doesn't have falls through to the next one.
- From models 1.9.0 too: classic Outlook's columns wider than their row, fonts that don't reach into a table, a table's
  own borders, the Gmail app's Noto Serif weights and its cells' min-width; see the models' changelog.
- A preview of classic Outlook with its fonts inline is about 1.2 MB (the Aptos stand-in and the larger models).
- The preview runtime is rebuilt (its sha256 changes).
- Requires `@hyper-elements/email-client-models` 1.9.0.

## 0.4.3

- **`renderInEmailClients()` takes any HTML email as a string too**, however it was made (MJML, React Email, by hand):
  `renderInEmailClients(html, { emailClients, dark, fonts, widths, computers })` takes the whole email and writes the same
  preview files. That loads neither React nor `@hyper-elements/react`: core is loaded only for a template, in the
  caller's module format.
- **Its `diagnostics` for HTML** are what the clients previewed remove or change in it, each with its line in the HTML
  and an excerpt: the CSS and stylesheet rules from caniemail's tables; a `<style>` by where it is (every `<style>` for
  the clients that remove them all, one in the `<body>` for Gmail); an `@media` for the clients that apply none; a web
  font; images in formats some clients don't show; Gmail's 16 KB limit for each head `<style>` on its own, and its clip.
  With models 1.8.0 or later, the checks only captures found run on HTML too.
- Previews of HTML not built with Hyper Elements are `approximate` where the models are under 95% on such emails or
  aren't measured on them (`APPROXIMATE_FOR_HTML`), and their header says the email wasn't built with Hyper Elements.
- `@hyper-elements/react`, `react` and `react-dom` are optional peers: npm doesn't install them with this package. A
  template needs them, as before; HTML doesn't. In TypeScript without them, the declarations name their types, so keep
  `skipLibCheck` on (the default).
- The preview runtime is rebuilt: the same code, with its minified names renamed (its sha256 changes).
- Requires `@hyper-elements/email-client-models` 1.8.1, whose `check()` takes a whole email's HTML as well as a template,
  and reads long markup in time in proportion to its length.

## 0.4.2

- **The Gmail app's previews draw with Android's fonts**, as the app on Android does: a font stack resolves against
  Android's fonts (Arial, Helvetica and sans-serif are Roboto; Georgia, Times and serif are Noto Serif; Courier and
  monospace are Droid Sans Mono), with Roboto, Noto Serif and Noto Sans Mono shipped in `fonts/` (SIL OFL 1.1). Before,
  they drew with the fonts of the machine opening the file, and listed Roboto as missing.
- **The Gmail apps' previews are 380px wide**, the width the Gmail app on Android lays an email out at (375px before),
  and their text 7% larger, as the app draws it (models 1.7.0).
- **Classic Outlook's previews no longer load Inter**: Windows doesn't have it, so a font stack naming Inter draws in
  its next font, as classic Outlook does (models 1.7.0). Inter's files and licence leave `fonts/`.
- Requires `@hyper-elements/email-client-models` 1.7.0.

## 0.4.1

- **New: `renderInEmailClients(element, { widths })`**: the width a client's preview draws the email at, where it isn't
  the client's own, such as `{ "outlook-com": 540 }` for Outlook.com's reading pane beside its message list. With the
  models package 1.4.0 or later, Outlook.com and Gmail on the web apply the email's media queries at the browser
  window's width, as the real clients do, so a narrow pane keeps the email's desktop styles.

- **New: Outlook.com and Gmail on the web previewed on Windows and on a Mac** (`computers`, both by default): on Windows
  each font stack resolves against Windows' fonts, as Chrome there does (`Didot, Georgia` draws Georgia, `system-ui`
  Segoe UI, `monospace` Consolas), with stand-ins of the same widths where the machine opening the preview lacks one;
  on a Mac, the Mac's own fonts. The Windows previews keep their ids (`outlook-com`, `gmail`); the Mac ones are
  `outlook-com.mac` and `gmail.mac`. Needs the models package 1.5.0.

- **Requires `@hyper-elements/email-client-models` 1.6.0**, whose previews draw more of what both Outlooks change:
  classic Outlook draws Arial Black and the other Windows fonts a stack names, words over a picture from its top,
  Word's automatic text colour, and table cells styled `width: auto` as Word sizes them, and leaves out what Word
  doesn't draw (a div's height, `nth-child` rules, a `<button>`'s box); Outlook.com and Gmail drop a style attribute
  with a `url()` in double quotes, `gap` and `row-gap`, and Gmail the `flex` shorthand.
- The bundle budget is 49,000 bytes (it was 47,000): the widths and computers options.

## 0.4.0

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
