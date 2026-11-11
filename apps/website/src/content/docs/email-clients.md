---
title: "Email client emulator"
description: "Hyper Elements comes with an email client emulator: see your email as each email client shows it, on your own machine. Free, with no Litmus, Email on Acid or API, no test sends and nothing uploaded."
---

Hyper Elements comes with an email client emulator, `@hyper-elements/email-clients`. It shows your email as each supported email client shows it, on your own machine, and lists what each client changed. It's a free alternative to screenshot services such as Litmus and Email on Acid: no API key, no account, no cost per preview, no test send, and nothing uploaded. `renderInEmailClients()` writes one HTML file per client; open it in a browser to see the email as that client shows it.

```bash
npm i @hyper-elements/email-clients
```

```tsx
import { mkdir, writeFile } from "node:fs/promises";
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

const { previews } = await renderInEmailClients(welcome, { dark: true });
await mkdir("previews", { recursive: true });
for (const preview of previews) await writeFile(`previews/${preview.filename}`, preview.html);
// One file per client and variant, such as previews/outlook.html and previews/apple-mail.dark.html
```

Open `previews/outlook.html` in Chrome and the card and the button have square corners, as classic Outlook draws them; open `apple-mail.dark.html` and the email is in Apple Mail's dark mode.

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

| | Email client emulator | Screenshot services (Litmus, Email on Acid) |
|---|---|---|
| Cost | Free | Paid, per test or per seat |
| Setup | `npm i` | An account and an API key |
| Where it runs | Your machine, your CI, your agent | Their servers, with your email uploaded |
| Speed | As long as a render | Minutes per test |
| What you get | An HTML file per client, with what the client changed, as text and JSON | A screenshot per client |
| Clients | The clients above, with more on the way | Dozens, on real devices |

Use the emulator in the loop, on every change; use a screenshot service, or a real inbox, for a final check across many clients.

## Options

| Option | What it does |
|--------|--------------|
| `emailClients` | The clients to emulate (default: `outlook`, `outlook-com`, `gmail`, `apple-mail`) |
| `dark` | Also a dark-mode preview, for the clients that have one (Apple Mail today) |
| `widths` | The width a client's preview draws the email at, where it isn't the client's own: `{ "outlook-com": 540 }` for Outlook.com's reading pane beside the message list. Webmail matches media queries at the browser window's width, not the pane's, so a narrow pane keeps the email's desktop styles, as it does for its readers |
| `computers` | Webmail draws with the reader's computer's fonts. Outlook.com and Gmail on the web are each previewed on Windows (`outlook-com`, `gmail`) and on a Mac (`outlook-com.mac`, `gmail.mac`). `computers: ["windows"]` keeps one |
| `fonts` | `"url"` (the default) loads the open fonts the previews draw with from a CDN; `"inline"` puts them in each file, so it draws offline |
| `plugins`, and `render()`'s other options | Passed to `render()`. The email client checks for the clients emulated are added for you |

`renderInEmailClients()` returns:

- `previews`: `{ id, client, computer, variant, dark, width, filename, html, approximate }` for each client and variant, light before dark;
- `skipped`: what wasn't emulated, and why (a client with no dark mode);
- `diagnostics`: `render()`'s, with the email client checks for the clients emulated.

A preview isn't the email you send: that's `render()`'s `html`.

## What a preview tells you

Each file lists, at its top, what the client changed and anything it couldn't draw as the client does:

- **Removed:** what the client removed or rewrote, and how often (rounded corners, `rgba()` colours, a `<style>` rule).
- **Missing:** a font the machine opening the file doesn't have, the email's own web font where it didn't load, an image that didn't load.
- **Fonts:** the system fonts it drew with.
- **Findings:** a Heading or Button that a client draws on more lines, text that doesn't read in dark mode, and where Gmail clips the email.

For a script or an agent, the same is JSON. Open the file in Chromium, wait for `<html data-email-client-ready>` (`ok`, `incomplete` when a font or image was missing or 10 seconds passed, `error`), and read `<script type="application/json" id="email-client-findings">`. With Playwright:

```ts
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(new URL("previews/outlook.html", `file://${process.cwd()}/`).href);
await page.waitForSelector("html[data-email-client-ready]");
const findings = JSON.parse(await page.textContent("#email-client-findings"));
console.log(findings.removed); // [{ what: "border-radius", count: 3 }]
await page.screenshot({ path: "previews/outlook.png", fullPage: true });
await browser.close();
```

## Checks and the emulator

The same package checks a template without drawing it: `emailClients()` is a plugin for `validate()` and `render()`, and names the clients each problem is about, with the fix. See [Diagnostics](/docs/diagnostics).

```tsx
import { validate } from "@hyper-elements/react";
import { emailClients } from "@hyper-elements/email-clients";

const { diagnostics } = validate(welcome, { plugins: [await emailClients()] });
// info email/outlook-degraded … borderRadius on this Column in classic Outlook: square corners [outlook]
```

The checks cover more clients than the emulator (Yahoo, AOL, Outlook for Mac and others, from caniemail's tables).

## Limits

- **Open previews in a Chromium browser** (Chrome, Edge, Arc, or Playwright's Chromium). The previews are drawn by the browser opening them.
- **Dark mode where a client has it in the table above.** Other clients' dark modes are on the way.
- **For an email that matters, send a test too.** The emulator is the fast loop; a real inbox is the final check.

`@hyper-elements/email-clients` is MIT. It installs `@hyper-elements/email-client-models` with it, which is free to use under its own licence.
