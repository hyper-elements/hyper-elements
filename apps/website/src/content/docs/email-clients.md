---
title: "Email client previews"
description: "See an email as classic Outlook, Outlook.com, Gmail and Apple Mail draw it, on your own machine: no test sends, no account, nothing uploaded. With @hyper-elements/email-clients."
---

`@hyper-elements/email-clients` draws your email as classic Outlook, Outlook.com, Gmail and Apple Mail draw it, on your own machine. There's no test send, no account and no upload: `renderInEmailClients()` writes one HTML file per client, and you open it in a browser. Each file applies what that client does to an email (the CSS it removes, the fonts it draws with, Word's layout for classic Outlook, Apple Mail's dark mode) and lists what it changed.

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
// previews/outlook.html, outlook-com.html, outlook-com.mac.html, gmail.html, gmail.mac.html,
// apple-mail.html, apple-mail.dark.html
```

Open `previews/outlook.html` in Chrome and the card and the button have square corners, as classic Outlook draws them; open `apple-mail.dark.html` and the email is in Apple Mail's dark mode.

## Why it matters

- **No send-and-wait loop.** A preview takes as long as a render, so you can check every change, not only the last one before a campaign.
- **Nothing leaves your machine.** The email isn't sent anywhere or uploaded to a screenshot service, which matters for customer data, unreleased products and regulated content.
- **It runs where your code runs.** In a test, in CI, or in an agent's loop: an agent with a browser can open a preview, read what the client changed, and fix the template.
- **The same answer every time.** The same email gives the same preview, so a preview can be a snapshot in a test.

## The clients

| Client | `id` | What the preview draws |
|--------|------|------------------------|
| Classic Outlook for Windows | `outlook` | Word's layout of the email: no rounded corners, shadows or gradients, its fonts and line heights, VML for buttons and words over a picture. An approximation, and the file says so |
| Outlook.com and new Outlook | `outlook-com`, `outlook-com.mac` | What Outlook.com removes from the HTML and the CSS it rewrites, read on Windows and on a Mac |
| Gmail on the web | `gmail`, `gmail.mac` | What Gmail removes from the HTML and the CSS it rewrites, read on Windows and on a Mac |
| Gmail app | `gmail-app`, `gmail-app-other` | At 375px; `gmail-app-other` is a non-Gmail account in the app, which drops the email's `<style>` |
| Apple Mail | `apple-mail`, `apple-mail.dark` | Light, and dark mode with `dark: true` |

Without `emailClients`, you get classic Outlook, Outlook.com, Gmail and Apple Mail. Name the ones you want with `emailClients: ["outlook", "gmail-app"]`. How close each one is, measured against the real client, is in `EMAIL_CLIENTS[id].measured`:

```tsx
import { EMAIL_CLIENTS } from "@hyper-elements/email-clients";

EMAIL_CLIENTS["outlook"].measured;
// { against: "Outlook 16.0.20527 for Windows, 96 DPI", wordsWithin4px: 0.85, lineBreaks: 0.983, … }
```

| Client | Words within 4px of the real client | Line breaks the same |
|--------|------|------|
| Outlook.com | 100% | 100% |
| Gmail on the web | 100% | 100% |
| Apple Mail | 99.9% | 99.9% |
| Classic Outlook | 85% | 98.3% |

## Options

| Option | What it does |
|--------|--------------|
| `emailClients` | The clients to preview (default: `outlook`, `outlook-com`, `gmail`, `apple-mail`) |
| `dark` | Also a dark preview, where the client's dark mode is modelled (Apple Mail) |
| `widths` | The width a client's preview draws the email at, where it isn't the client's own: `{ "outlook-com": 540 }` for Outlook.com's reading pane beside the message list. Outlook.com and Gmail on the web match media queries at the browser window's width, not the pane's, so a narrow pane keeps the email's desktop styles, as it does for their readers |
| `computers` | Outlook.com and Gmail on the web draw with the reader's computer's fonts. Each is previewed on Windows (`outlook-com`, `gmail`: `Didot, Georgia` draws Georgia, as it does for Windows readers, even when you open the file on a Mac) and on a Mac (`outlook-com.mac`, `gmail.mac`). `computers: ["windows"]` keeps one |
| `fonts` | `"url"` (the default) loads the open fonts the previews draw with from a CDN; `"inline"` puts them in each file, so it draws offline |
| `plugins`, and `render()`'s other options | Passed to `render()`. The email client checks for the clients previewed are added for you |

`renderInEmailClients()` returns:

- `previews`: `{ id, client, computer, variant, dark, width, filename, html, approximate }` for each client and variant, light before dark;
- `skipped`: what wasn't previewed, and why (a dark mode that isn't modelled);
- `diagnostics`: `render()`'s, with the email client checks for the clients previewed.

A preview isn't the email you send: that's `render()`'s `html`.

## What a preview tells you

Each file lists, at its top, what the client changed and anything it couldn't draw as the client does:

- **Removed:** what the client removed or rewrote, and how often (rounded corners, `rgba()` colours, a `<style>` rule).
- **Missing:** a font the machine opening the file doesn't have, the email's own web font where it didn't load, an image that didn't load.
- **Fonts:** the system fonts it drew with.
- **Findings:** a Heading or Button classic Outlook draws on more lines, text that doesn't read in Apple Mail's dark mode, and where Gmail clips the email.

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

## Checks and previews

The same package checks a template without drawing it: `emailClients()` is a plugin for `validate()` and `render()`, and names the clients each problem is about, with the fix. See [Diagnostics](/docs/diagnostics).

```tsx
import { validate } from "@hyper-elements/react";
import { emailClients } from "@hyper-elements/email-clients";

const { diagnostics } = validate(welcome, { plugins: [await emailClients()] });
// info email/outlook-degraded … borderRadius on this Column in classic Outlook: square corners [outlook]
```

Checks cover more clients (Yahoo, AOL, Outlook for Mac and others, from caniemail's tables); previews draw the ones there's a model of.

## Limits

- **Open previews in a Chromium browser** (Chrome, Edge, Arc, or Playwright's Chromium). The previews are drawn by the browser opening them.
- **Classic Outlook is an approximation.** Word's layout is modelled, not run: most words land where Outlook puts them, but some lines break differently.
- **Fonts come from your machine** where the client draws with a system font (Arial, Georgia, Verdana and the like), and from open fonts of the same widths where your machine doesn't have the client's (Segoe UI, Calibri, Consolas). A missing font is listed.
- **Dark mode is Apple Mail's.** Gmail's and Outlook's dark modes aren't previewed yet.
- **For an email that matters, send a test too.** A preview is the fast loop; a real inbox is the final check.

The models of the clients are a separate package, `@hyper-elements/email-client-models`, installed with this one. It's free to use under its own licence; `@hyper-elements/email-clients` is MIT.
