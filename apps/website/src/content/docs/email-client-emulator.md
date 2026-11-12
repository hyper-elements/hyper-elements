---
title: "Email client emulator"
description: "Hyper Elements comes with an email client emulator: see your email as each email client shows it, on your own machine. Free, no test sends and nothing uploaded."
---

Hyper Elements comes with an email client emulator, `@hyper-elements/email-clients`. It shows your email as each supported email client shows it, on your own machine, and lists what each client changed. It's a free alternative to screenshot services: no API key, no account, no cost per preview, no test send, and nothing uploaded. `renderInEmailClients()` returns a preview per client: a self-contained HTML page that shows the email as that client does when Chromium opens it.

```bash
npm i @hyper-elements/email-clients
```

```tsx
import { Button, Column, Email, Heading, Text } from "@hyper-elements/react";
import { renderInEmailClients } from "@hyper-elements/email-clients";

const welcome = (
  <Email previewText="Your account is ready" style={{ backgroundColor: "#f4f4f5" }}>
    <Column style={{ backgroundColor: "#ffffff", padding: 32, gap: 16, borderRadius: 12 }}>
      <Heading level={1} style={{ fontSize: 24 }}>Welcome aboard</Heading>
      <Text>Your account is ready.</Text>
      <Button href="https://example.com/start" style={{ borderRadius: 999 }}>Get started</Button>
    </Column>
  </Email>
);

const { previews, skipped, diagnostics } = await renderInEmailClients(welcome, { dark: true });

previews.map((preview) => preview.id);
// ["outlook", "outlook-com", "outlook-com.mac", "gmail", "gmail.mac", "apple-mail", "apple-mail.dark"]

const outlook = previews.find((preview) => preview.id === "outlook");
// { id: "outlook", client: "outlook", variant: "desktop", dark: false, width: 820,
//   approximate: true, filename: "outlook.html", html: "<!doctype html>…" }

skipped[0];
// { client: "outlook", dark: true, reason: "Classic Outlook's dark mode isn't measured" }

diagnostics[0].message;
// "borderRadius on this Column in classic Outlook: square corners"
```

What happens next is up to you or your agent: write `outlook.html` to a file and open it, load it in Playwright and take a screenshot, or read what the client changed (see [What a preview tells you](#what-a-preview-tells-you)). Opened in Chromium, the Outlook preview shows the card and the button with square corners, as classic Outlook draws them.

Here's what the emulator draws for three emails, each in four clients, the Gmail app at a phone's width. Open an image to see it at full size.

**The welcome email above**

<div class="client-gallery">
<figure><a href="/generated/email-clients/welcome-outlook.png" title="Open the welcome email in Classic Outlook at full size"><img src="/generated/email-clients/welcome-outlook.png" width="820" height="189" loading="lazy" alt="The welcome email in Classic Outlook, drawn by the email client emulator"></a><figcaption>Classic Outlook</figcaption></figure>
<figure><a href="/generated/email-clients/welcome-gmail.png" title="Open the welcome email in Gmail on the web at full size"><img src="/generated/email-clients/welcome-gmail.png" width="820" height="188" loading="lazy" alt="The welcome email in Gmail on the web, drawn by the email client emulator"></a><figcaption>Gmail on the web</figcaption></figure>
<figure><a href="/generated/email-clients/welcome-apple-mail.png" title="Open the welcome email in Apple Mail at full size"><img src="/generated/email-clients/welcome-apple-mail.png" width="820" height="187" loading="lazy" alt="The welcome email in Apple Mail, drawn by the email client emulator"></a><figcaption>Apple Mail</figcaption></figure>
<figure><a href="/generated/email-clients/welcome-gmail-app.png" title="Open the welcome email in the Gmail app on Android at full size"><img src="/generated/email-clients/welcome-gmail-app.png" width="380" height="193" loading="lazy" alt="The welcome email in the Gmail app on Android, drawn by the email client emulator"></a><figcaption>Gmail app on Android</figcaption></figure>
</div>

**[Tarn order shipped](/templates/tarn-shipped)**

<div class="client-gallery">
<figure><a href="/generated/email-clients/tarn-shipped-outlook.png" title="Open the Tarn order shipped email in Classic Outlook at full size"><img src="/generated/email-clients/tarn-shipped-outlook.png" width="820" height="1373" loading="lazy" alt="The Tarn order shipped email in Classic Outlook, drawn by the email client emulator"></a><figcaption>Classic Outlook</figcaption></figure>
<figure><a href="/generated/email-clients/tarn-shipped-gmail.png" title="Open the Tarn order shipped email in Gmail on the web at full size"><img src="/generated/email-clients/tarn-shipped-gmail.png" width="820" height="1373" loading="lazy" alt="The Tarn order shipped email in Gmail on the web, drawn by the email client emulator"></a><figcaption>Gmail on the web</figcaption></figure>
<figure><a href="/generated/email-clients/tarn-shipped-apple-mail.png" title="Open the Tarn order shipped email in Apple Mail at full size"><img src="/generated/email-clients/tarn-shipped-apple-mail.png" width="820" height="1365" loading="lazy" alt="The Tarn order shipped email in Apple Mail, drawn by the email client emulator"></a><figcaption>Apple Mail</figcaption></figure>
<figure><a href="/generated/email-clients/tarn-shipped-gmail-app.png" title="Open the Tarn order shipped email in the Gmail app on Android at full size"><img src="/generated/email-clients/tarn-shipped-gmail-app.png" width="380" height="1506" loading="lazy" alt="The Tarn order shipped email in the Gmail app on Android, drawn by the email client emulator"></a><figcaption>Gmail app on Android</figcaption></figure>
</div>

**[Keel sign-in code](/templates/keel-sign-in-code)**

<div class="client-gallery">
<figure><a href="/generated/email-clients/keel-sign-in-code-outlook.png" title="Open the Keel sign-in code email in Classic Outlook at full size"><img src="/generated/email-clients/keel-sign-in-code-outlook.png" width="820" height="829" loading="lazy" alt="The Keel sign-in code email in Classic Outlook, drawn by the email client emulator"></a><figcaption>Classic Outlook</figcaption></figure>
<figure><a href="/generated/email-clients/keel-sign-in-code-gmail.png" title="Open the Keel sign-in code email in Gmail on the web at full size"><img src="/generated/email-clients/keel-sign-in-code-gmail.png" width="820" height="831" loading="lazy" alt="The Keel sign-in code email in Gmail on the web, drawn by the email client emulator"></a><figcaption>Gmail on the web</figcaption></figure>
<figure><a href="/generated/email-clients/keel-sign-in-code-apple-mail.png" title="Open the Keel sign-in code email in Apple Mail at full size"><img src="/generated/email-clients/keel-sign-in-code-apple-mail.png" width="820" height="823" loading="lazy" alt="The Keel sign-in code email in Apple Mail, drawn by the email client emulator"></a><figcaption>Apple Mail</figcaption></figure>
<figure><a href="/generated/email-clients/keel-sign-in-code-gmail-app.png" title="Open the Keel sign-in code email in the Gmail app on Android at full size"><img src="/generated/email-clients/keel-sign-in-code-gmail-app.png" width="380" height="817" loading="lazy" alt="The Keel sign-in code email in the Gmail app on Android, drawn by the email client emulator"></a><figcaption>Gmail app on Android</figcaption></figure>
</div>

## Why it matters

- **No send-and-wait loop.** A preview takes as long as a render, so you can check every change, not only the last one before a campaign.
- **Free, with no API.** There's no account to make, no key to keep, and no limit on how many previews you make.
- **Nothing leaves your machine.** The email isn't sent anywhere or uploaded to a screenshot service, which matters for customer data, unreleased products and regulated content.
- **It runs where your code runs.** In a test, in CI, or in an agent's loop: an agent with a browser can open a preview, read what the client changed, and fix the template.
- **The same answer every time.** The same email gives the same preview, so a preview can be a snapshot in a test.

## Supported email clients

Accuracy is how closely the emulator matches each real client for emails built with Hyper Elements.

| Client | `id` | Accuracy |
|--------|------|----------|
| Classic Outlook for Windows | `outlook` | 97% |
| Outlook.com and new Outlook | `outlook-com`, `outlook-com.mac` | 99% |
| Gmail on the web | `gmail`, `gmail.mac` | 99% |
| Gmail app on Android | `gmail-app`, `gmail-app-other` | 97% |
| Apple Mail, light and dark | `apple-mail`, `apple-mail.dark` | 97% |

More email clients are on the way. Emails written another way (hand-written HTML, other libraries) are emulated too, but less closely in some clients. A client that changes a lot, like classic Outlook, marks its preview as `approximate`.

Name the clients you want with `emailClients: ["outlook", "gmail-app"]`; without it you get the default set below. `gmail-app-other` is a non-Gmail account in the Gmail app, which drops the email's `<style>`.

## Compared with screenshot services

| | Email client emulator | Screenshot services |
|---|---|---|
| Cost | Free | Paid, per test or per seat |
| Setup | `npm i` | An account and an API key |
| Where it runs | Your machine, your CI, your agent | Their servers, with your email uploaded |
| Speed | Milliseconds | Minutes per test |
| What you get | A preview per client, and what each one changed | A screenshot per client |
| Clients | The clients above, with more on the way | Dozens, on real devices |

Use the emulator in the loop, on every change; use a screenshot service, or a real inbox, for a final check across many clients.

## Options

| Option | What it does |
|--------|--------------|
| `emailClients` | The clients to emulate (default: `outlook`, `outlook-com`, `gmail`, `apple-mail`) |
| `dark` | Also a dark-mode preview, for the clients that have one (Apple Mail today) |
| `widths` | The width a client's preview draws the email at, where it isn't the client's own: `{ "outlook-com": 540 }` for Outlook.com's reading pane beside the message list. Webmail matches media queries at the browser window's width, not the pane's, so a narrow pane keeps the email's desktop styles, as it does for its readers |
| `computers` | Webmail draws with the reader's computer's fonts. Outlook.com and Gmail on the web are each previewed on Windows (`outlook-com`, `gmail`) and on a Mac (`outlook-com.mac`, `gmail.mac`). `computers: ["windows"]` keeps one |
| `fonts` | `"url"` (the default) loads the open fonts the previews draw with from a CDN; `"inline"` puts them in each preview, so it draws offline |
| `plugins`, and `render()`'s other options | Passed to `render()`. The email client checks for the clients emulated are added for you |

`renderInEmailClients()` returns:

- `previews`: `{ id, client, computer, variant, dark, width, filename, html, approximate }` for each client and variant, light before dark;
- `skipped`: what wasn't emulated, and why (a client with no dark mode);
- `diagnostics`: `render()`'s, with the email client checks for the clients emulated.

A preview isn't the email you send: that's `render()`'s `html`.

## What a preview tells you

Each preview lists, at its top, what the client changed and anything it couldn't draw as the client does:

- **Removed:** what the client removed or rewrote, and how often (rounded corners, `rgba()` colours, a `<style>` rule).
- **Missing:** a font the machine opening the preview doesn't have, the email's own web font where it didn't load, an image that didn't load.
- **Fonts:** the system fonts it drew with.
- **Findings:** a Heading or Button that a client draws on more lines, text that doesn't read in dark mode, and where Gmail clips the email.

## Checks and the emulator

The same package checks a template without drawing it: `emailClients()` is a plugin for `validate()` and `render()`, and names the clients each problem is about, with the fix. See [Diagnostics](/docs/diagnostics).

```tsx
import { validate } from "@hyper-elements/react";
import { emailClients } from "@hyper-elements/email-clients";

const { diagnostics } = validate(welcome, { plugins: [await emailClients()] });
// info email/outlook-degraded … borderRadius on this Column in classic Outlook: square corners [outlook]
```

The checks cover more clients than the emulator (Yahoo, AOL, Outlook for Mac and others, from caniemail's tables).
