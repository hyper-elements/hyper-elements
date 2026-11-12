---
title: "Command line"
description: "Render, check and preview templates from the shell with @hyper-elements/cli: HTML and plain text, PDFs and images, the email client checks and previews, with JSON and stable exit codes for agents and CI."
---

`@hyper-elements/cli` renders, checks and previews templates from the shell, with no script of your own. It writes an Email's HTML and plain text, a Page's HTML, a Document's PDF and a Canvas's image, runs the email client checks, and draws an Email as each email client shows it. Every command has stable exit codes, and `--json` for agents and CI.

```bash
npx hyper-elements check emails/           # validate each template, with the email client checks
npx hyper-elements render emails/          # out/welcome.html, out/welcome.txt, …
npx hyper-elements outline emails/welcome.tsx
npx hyper-elements preview emails/welcome.tsx --findings   # each email client's view, drawn in Chromium
npx hyper-elements dev emails/             # a local page showing each template, rendered again on each change
```

## Install

```bash
npm install -D @hyper-elements/cli
```

Install it beside `@hyper-elements/react` 0.4, in the project that holds your templates: the CLI loads Elements, React and `@hyper-elements/email-clients` the way each template does, so it renders with your versions. Then run it as `npx hyper-elements`. It runs on Node.js 20.6 or later, and on Bun 1.3 or later as `bunx --bun hyper-elements`.

To check an HTML email with nothing installed, run the package by its name: `npx @hyper-elements/cli check email.html` (see [Any HTML email](#any-html-email)).

`preview --findings` and `--screenshots` draw the previews in Chromium with `playwright-core`, an optional peer. Install it beside the CLI to use them (`npm install -D playwright-core`); nothing else needs it.

## A template

A template is a module whose default export is a component that renders an `<Email>`, a `<Page>`, a `<Document>` or a `<Canvas>`. Its props come from `--props file.json`, else the component's `PreviewProps`, else `{}`.

```tsx
// emails/welcome.tsx
import { Button, Column, Email, Heading, Text } from "@hyper-elements/react";

export default function Welcome({ name }: { name: string }) {
  return (
    <Email previewText="Your Acme account is ready" style={{ backgroundColor: "#f4f4f5" }}>
      <Column style={{ backgroundColor: "#ffffff", padding: 32, gap: 16, borderRadius: 8 }}>
        <Heading level={1} style={{ fontSize: 24 }}>Welcome, {name}</Heading>
        <Text>Your account is ready.</Text>
        <Button href="https://example.com/projects/new">Create a project</Button>
      </Column>
    </Email>
  );
}
Welcome.PreviewProps = { name: "Ada" };
```

Give the commands files or folders. A folder is searched for templates, leaving out `node_modules`, build output, and folders whose name starts with `.` or `_`, so shared parts can live in `emails/_components/`. TypeScript, path aliases and workspace packages work as they do in your project.

## Commands

| Command | What it does |
|---------|--------------|
| `render <files or folders…>` | Writes each template's output under `--out` (default `out/`): an Email's `name.html` and `name.txt`, a Page's `name.html`, a Document's `name.pdf`, a Canvas's `name.png` |
| `check <files or folders…>` | Runs `validate()` with the email client checks, and writes nothing |
| `outline <file>` | Prints the template laid out, each block with its width, as [`outline()`](/docs/rendering#outline) does |
| `preview <files or folders…>` | Writes each Email as the email clients show it, one file per client, with the [email client emulator](/docs/email-client-emulator) |
| `inspect <files or folders…>` | Lists each component of a template, what it's given, whether its root takes it and the problems found on it |
| `describe [Component]` | Lists the components a template can use, with their props and styles; `--root Email` narrows it to what that root takes |
| `dev <files or folders…>` | Serves a page on `127.0.0.1` that shows each template, rendered again when the project changes |
| `migrate …` | Runs [`@hyper-elements/migrate`](/docs/migrate/react-email) with the arguments given |

`npx hyper-elements --help` lists every option.

## render

```bash
npx hyper-elements render emails/
```

`render emails/` writes `out/welcome.html` and `out/welcome.txt`, and prints each template's diagnostics: with the email client checks where the project has `@hyper-elements/email-clients`, as `check` runs them (`--clients` picks the clients). Each output goes at the template's path relative to the folder holding every input, so `render emails/ docs/` writes `out/emails/…` and `out/docs/…`. `--pretty` indents the HTML, and `--stdout` writes one template's HTML, PDF or image to stdout. A template with errors writes nothing.

### PDFs and images

A Document is drawn with [`renderPdf()`](/docs/outputs/pdf) and a Canvas with [`renderImage()`](/docs/outputs/image), so install their engines beside Elements: `@react-pdf/renderer` for PDFs, `satori` and `@resvg/resvg-js` for images. `--html` also writes a Document's print HTML; `--format svg` writes a Canvas as SVG, and `--scale 2` with twice the pixels.

Neither engine loads a font or an image itself. The CLI loads the ones the template names and hands them over:

| Source | Read from |
|--------|-----------|
| `fonts/Inter.ttf`, `./logo.png` | The template's folder |
| `/logo.png` | `--public <dir>`; by default the first `public/` beside a `package.json`, from the template's folder up |
| `data:` | The URI itself |
| `https://…` | Fetched once and cached in `node_modules/.cache/hyper-elements/`; `--refresh` fetches again, `--offline` fetches nothing |

Give fonts as TTF, OTF or WOFF files: neither engine draws WOFF2, Google Fonts' default. A source that can't be loaded is left out with a `cli/asset` warning that says why. A Document's PDF is written on Node.js only: on Bun, `render` refuses a Document (`cli/bun`).

## check

```bash
npx hyper-elements check emails/
```

```text
✓ emails/welcome.tsx (Email)
    info email/outlook-degraded at root.children[0].style.borderRadius: borderRadius on this Column in classic Outlook: square corners [outlook] See: https://www.caniemail.com/features/css-border-radius/
1 template: 0 errors, 0 warnings, 0 skipped
```

`check` runs every check `render()` runs, without writing anything. Where the project has `@hyper-elements/email-clients` (`npm i -D @hyper-elements/email-clients`), its email client checks run too, naming the clients each problem is about; `--clients gmail,outlook` picks the clients. `--rendered` also renders each template, for the checks only the written HTML has (the email's size against Gmail's limit). `--max-warnings 0` fails the run on any warning.

## preview

```bash
npx hyper-elements preview emails/welcome.tsx
```

```text
✓ emails/welcome.tsx (Email)
  outlook: out/clients/welcome/outlook.html
  outlook-com: out/clients/welcome/outlook-com.html
  outlook-com.mac: out/clients/welcome/outlook-com.mac.html
  gmail: out/clients/welcome/gmail.html
  gmail.mac: out/clients/welcome/gmail.mac.html
  apple-mail: out/clients/welcome/apple-mail.html
1 template: 0 errors, 0 warnings, 0 skipped
```

`preview` writes each Email as the email clients show it, with the project's `@hyper-elements/email-clients` (`renderInEmailClients()`): one self-contained HTML file per client and variant, under `out/clients/<name>/`. `--clients`, `--dark` and `--fonts inline` are [its options](/docs/email-client-emulator#options). A template whose root isn't an Email is skipped.

A preview file draws the email when a browser opens it, and lists what the client changed. To have the CLI read those findings for you, add `--findings` (with `playwright-core` installed beside the CLI): it opens each file in Chromium and reports what it found. It uses the first of these that starts: the browser `CHROME_PATH` names, Playwright's own Chromium (`npx hyper-elements preview --install-browser` downloads it), then an installed Chrome or Edge. `--screenshots` also writes a PNG of each preview beside it.

`--serve` serves the previews on `127.0.0.1` and prints each one's URL, for a browser that can't open `file://` paths. It runs until Ctrl-C.

Nothing is sent anywhere to be drawn: the requests a preview makes are its stand-in fonts from jsDelivr (`--fonts inline` puts them in each file) and the email's own images and web fonts.

## Any HTML email

`check` and `preview` also take an HTML email however it was made (MJML, React Email, by hand, an email builder's export): an `.html` or `.htm` file given by name, or `-` to read one from stdin. No template code runs, so neither React nor Elements is needed:

```bash
npx @hyper-elements/cli check email.html
cat email.html | npx @hyper-elements/cli preview - --findings
```

Each diagnostic has the `line` in the file and an excerpt of it. A folder's HTML files aren't picked up, since a folder of templates often holds the HTML rendered from them: give them by name (`check emails/*.html`).

## dev

```bash
npx hyper-elements dev emails/ docs/
```

`dev` prints a URL on `127.0.0.1` and serves a page that lists the templates and shows the one you pick: an Email or a Page at desktop width and at 375px, a Document's PDF, a Canvas's image, its diagnostics, and, for an Email with `@hyper-elements/email-clients`, links to its previews in each email client. It renders every template again when the project's source, or a workspace package it depends on, changes. It writes nothing in the project, and runs until Ctrl-C.

## JSON and exit codes

With `--json`, stdout holds one JSON line per template, then a summary line, and nothing else. What templates print goes to stderr.

```json
{"version":1,"command":"check","file":"emails/broken.tsx","input":"template","root":"Email","status":"error","outputs":[],"diagnostics":[{"code":"style/unknown","severity":"error","message":"\"marginBottom\" isn't a style a Text takes: use the parent's gap, or padding. See Text in @hyper-elements/react/GUIDE.md","path":"root.children[0].style.marginBottom"}]}
{"version":1,"summary":{"templates":1,"errors":1,"warnings":0,"skipped":0,"late":[]},"exitCode":1}
```

Each diagnostic is the one [`validate()`](/docs/diagnostics) gives: `code`, `severity`, `message`, `path`, and the `clients` and `fix` where there are some. A template that doesn't load has no diagnostics but an `error`, which says why in one line; for a syntax error, in the template or a module it imports, that's the file, line, column and reason: `emails/welcome.tsx:3:34: Unexpected closing "Emal" tag does not match opening "Email" tag`. `preview --json` adds each preview's `path`, `ready` and `findings`, and the `browser` it drew in.

| Exit code | Means |
|-----------|-------|
| `0` | Every template rendered, checked or previewed without errors |
| `1` | A template has errors, failed to load or threw, or ran past `--timeout`; a PDF or image engine isn't installed; a preview failed in the browser; or the run passed `--max-warnings` |
| `2` | The run couldn't do what it was asked: a usage error, no templates (none found, or no input that turned out to be one, such as a file whose default export isn't a component: each is still listed, as skipped), Elements missing, a Document's PDF on Bun, `preview` without `@hyper-elements/email-clients`, or `--findings` with no browser found |

In CI, fail the build on any problem in your templates:

```bash
npx hyper-elements check emails/ --max-warnings 0
```

## With an agent

An agent that can run commands needs no script to check its work. A loop from the shell:

1. `npx hyper-elements check emails/welcome.tsx --json`: fix each error, by its `path` and `message`, until the exit code is `0`.
2. `npx hyper-elements outline emails/welcome.tsx`: compare the layout with what was asked.
3. `npx hyper-elements preview emails/welcome.tsx --findings --json`: each preview's `findings` say what that email client removed or changed, what was missing, and text it draws on more lines.

Where no Chromium is found, `preview --findings` still writes the files, gives each preview `"findings": null` and the line `"browser": null, "reason": "no-browser"`, and exits `2`. Where `playwright-core` isn't installed, the reason is `"no-playwright-core"`, and stderr says how to install it. An agent with a browser of its own opens each file (or the URLs `--serve` prints), waits for `<html data-email-client-ready>`, and reads the JSON in `#email-client-findings`. With no browser at all, `check`'s diagnostics are what it has. See [AI agents](/docs/guides/ai-agents) and [Email client emulator](/docs/email-client-emulator#test-an-email-from-the-shell).

## How it runs templates

Templates run in child processes, one per package and tsconfig, and each is loaded through a small module the CLI writes beside it for a moment, so a template resolves Elements and React as your own code does. The template's folder must be writable. `--timeout` (60 seconds by default) ends a group of templates that loops or hangs.

On Bun, the CLI gives the same output as on Node.js, byte for byte, except a Document's PDF, which it refuses there (Bun's zlib compresses the PDF's streams differently): render Documents with Node.js. `check`, `outline` and `preview` work on Bun for every root.
