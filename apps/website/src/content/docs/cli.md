---
title: "Command line"
description: "Preview, check and render Hyper Elements designs from the shell with the hyper-elements command: a live page of your designs, the email client checks, and each design's HTML, PDF or image."
---

`@hyper-elements/cli` is the `hyper-elements` command. It previews, checks and renders your designs from the shell, with no script of your own.

| You want | Run |
|----------|-----|
| A live page of your designs while you write them | [`npx hyper-elements dev emails/`](#dev) |
| What's wrong with them, with the email client checks | [`npx hyper-elements check emails/`](#check) |
| Their HTML, PDFs and images, as files | [`npx hyper-elements render emails/`](#render) |
| An email as Outlook, Gmail and Apple Mail draw it | [`npx hyper-elements preview emails/welcome.tsx`](#preview) |
| A design's layout, as text | [`npx hyper-elements outline emails/welcome.tsx`](#outline) |

<figure class="diagram"><img src="/generated/core-concepts/cli-dev.png" width="1200" height="760" alt="The page dev serves: a list of the designs on the left, and on the right the receipt email's diagnostics and the email itself, drawn at desktop width"></figure>

Other readers of this page:

- **You have an HTML email, not a design.** `check` and `preview` take it as it is, with nothing installed. See [Any HTML email](#any-html-email).
- **You make designs from a template.** See [Templates in the command line](/docs/templates/cli).
- **You're an agent, or writing for one.** See [With an agent](/docs/cli/reference#with-an-agent).

## Install

```bash
npm install -D @hyper-elements/cli
```

Install it beside `@hyper-elements/react` 0.4 or 0.5 (0.5 for [templates](/docs/templates)), in the project that holds your designs, and run it as `npx hyper-elements`. It renders with your project's own versions of Elements and React. It runs on Node.js 20.6 or later, and on Bun 1.3 or later as `bunx --bun hyper-elements`.

Some of what it does needs a package you install only if you want it:

| For | Install |
|-----|---------|
| The email client checks and `preview`, for your designs | `@hyper-elements/email-clients` |
| A Document's PDF | `@react-pdf/renderer` |
| A Canvas's image | `satori` and `@resvg/resvg-js` |

## A design file

A design file is a module whose default export is a component that renders an `<Email>`, a `<Page>`, a `<Document>` or a `<Canvas>`:

<!-- example: cli/emails/welcome.tsx -->
```tsx
import { Button, Column, Email, Heading, Text } from "@hyper-elements/react";

export default function Welcome({ name }: { name: string }) {
  return (
    <Email
      lang="en"
      previewText="Your Acme account is ready. Create your first project."
      style={{ backgroundColor: "#f4f4f5" }}
    >
      <Column
        style={{
          backgroundColor: "#ffffff",
          padding: 32,
          gap: 16,
          borderRadius: 8,
        }}
      >
        <Heading level={1} style={{ fontSize: 24 }}>
          Welcome, {name}
        </Heading>
        <Text>Your account is ready.</Text>
        <Button href="https://example.com/new">Create a project</Button>
      </Column>
    </Email>
  );
}
Welcome.PreviewProps = { name: "Ada" };
```

Its props come from `--props file.json`, else the component's `PreviewProps`, else `{}`.

Give the commands files or folders. A folder is searched for designs, leaving out `node_modules`, build output, and folders whose name starts with `.` or `_`, so shared parts can live in `emails/_parts/`. TypeScript, path aliases and workspace packages work as they do in your project.

## dev

```bash
npx hyper-elements dev emails/
```

`dev` prints a URL on `127.0.0.1` and serves the page whose top is pictured above. It lists the designs and shows the one you pick: an Email or a Page at desktop width and at 375px, a Document's PDF, a Canvas's image, its diagnostics, and an Email's previews in each email client. It renders every design again when the project's source changes. It writes nothing in the project, and runs until Ctrl-C.

## check

```bash
npx hyper-elements check emails/
```

<!-- output: cliCheck -->
```text
✓ emails/receipt.tsx (Email)
    info email/outlook-degraded at root.children[1].style.borderRadius: borderRadius on this Column in classic Outlook: square corners [outlook] See: https://www.caniemail.com/features/css-border-radius/
    info email/outlook-degraded at root.children[1].children[4].style.borderRadius: borderRadius on this Button in classic Outlook: square corners [outlook] See: https://www.caniemail.com/features/css-border-radius/
    info email/phone-styles at root: On phones, the email's phone styles don't apply: it keeps its desktop styles (Rows still stack) [gmail-app-other] See: https://www.caniemail.com/features/css-at-media/
✓ emails/welcome.tsx (Email)
    info email/outlook-degraded at root.children[0].style.borderRadius: borderRadius on this Column in classic Outlook: square corners [outlook] See: https://www.caniemail.com/features/css-border-radius/
2 designs: 0 errors, 0 warnings, 0 skipped
```

`check` runs every check [`validate()`](/docs/rendering#validate) runs, and writes nothing. It adds two sets of checks `validate()` doesn't run by itself:

- **The email client checks**, where the project has `@hyper-elements/email-clients`. Each names the clients it's about, as `[outlook]` above: classic Outlook, the Windows desktop app.
- **[Lint](#lint)**, on each Email and Page.

An error fails the run (exit code 1). Warnings and notes (`info`, as above) don't, unless you pass `--max-warnings 0`, which fails it on any warning.

## render

```bash
npx hyper-elements render emails/welcome.tsx
```

<!-- output: cliRender -->
```text
✓ emails/welcome.tsx (Email) → out/emails/welcome.html, out/emails/welcome.txt
    info email/outlook-degraded at root.children[0].style.borderRadius: borderRadius on this Column in classic Outlook: square corners [outlook] See: https://www.caniemail.com/features/css-border-radius/
1 design: 0 errors, 0 warnings, 0 skipped
```

`render` writes each design's output under `out/`, at the design's path from the current folder:

| Root | Files |
|------|-------|
| Email | `name.html` and `name.txt` |
| Page | `name.html` |
| Document | `name.pdf` (and its print HTML with `--html`) |
| Canvas | `name.png` (or `name.svg` with `--format svg`) |

It prints the same diagnostics as `check`. A design with errors writes nothing. `--out <dir>` writes somewhere else, and `--base emails` leaves `emails/` out of the paths: `out/welcome.html`.

For a Document or a Canvas, the CLI loads the fonts and images the design names and hands them to the PDF or image engine. See [PDFs and images](/docs/cli/reference#pdfs-and-images).

## preview

```bash
npx hyper-elements preview emails/welcome.tsx
```

<!-- output: cliPreview -->
```text
✓ emails/welcome.tsx (Email)
    info email/outlook-degraded at root.children[0].style.borderRadius: borderRadius on this Column in classic Outlook: square corners [outlook] See: https://www.caniemail.com/features/css-border-radius/
  outlook: out/clients/emails/welcome/outlook.html
  outlook-com: out/clients/emails/welcome/outlook-com.html
  outlook-com.mac: out/clients/emails/welcome/outlook-com.mac.html
  gmail: out/clients/emails/welcome/gmail.html
  gmail.mac: out/clients/emails/welcome/gmail.mac.html
  apple-mail: out/clients/emails/welcome/apple-mail.html
  apple-mail.iphone: out/clients/emails/welcome/apple-mail.iphone.html
1 design: 0 errors, 0 warnings, 0 skipped
```

`preview` writes each Email as the email clients draw it: one self-contained HTML file per client. Open one in a browser. It draws the email, and lists what that client removed or changed:

<figure class="diagram"><img src="/generated/core-concepts/cli-preview.svg" width="880" height="481" alt="The welcome email's preview file for classic Outlook: a note that it removed border-radius, and the email drawn with square corners"></figure>

Nothing is sent anywhere to be drawn. To have the CLI open the files and report what each client changed, add `--findings`. See [preview](/docs/cli/reference#preview) in the reference, and the [email client emulator](/docs/email-client-emulator).

## outline

```bash
npx hyper-elements outline emails/welcome.tsx
```

<!-- output: cliOutline -->
```text
Email 600px: background #f4f4f5
  Column 600px: background #ffffff
    Heading h1 536px "Welcome, Ada"
    Text 536px "Your account is ready."
    Button: background #0879a1 "Create a project" → https://example.com/new
```

`outline` prints one design laid out, each block with its width, as [`outline()`](/docs/rendering#outline) does.

## Lint

`check`, `render` and `dev` run [lint](/docs/lint) on each Email and Page: links that don't say where they go, images without alternate text, faint or small text, and more. Its findings are warnings and notes, so they change the exit code only past `--max-warnings`. `--no-lint` leaves them out. Its options go in `package.json`. See [Lint](/docs/cli/reference#lint) in the reference.

## Any HTML email

`check` and `preview` also take an HTML email however it was made (MJML, React Email, by hand, an email builder's export). No design's code runs, so neither React nor Elements is needed, and the CLI brings the email client checks with it. Run the package by its name, with nothing installed:

```bash
npx @hyper-elements/cli check email.html
npx @hyper-elements/cli preview email.html
```

See [Any HTML email](/docs/cli/reference#any-html-email) in the reference. To try it in a browser first, open the [email testing playground](/email-testing).

## JSON and exit codes

Every command takes `--json`: one JSON line per design, then a summary line. And every command exits with one of three codes:

| Exit code | Means |
|-----------|-------|
| `0` | Every design rendered, checked or previewed without errors |
| `1` | A design has errors, failed to load, or the run passed `--max-warnings` |
| `2` | The run couldn't do what it was asked: a usage error, no designs found, Elements not installed |

In CI, fail the build on any problem in your designs:

```bash
npx hyper-elements check emails/ --max-warnings 0
```

[JSON and exit codes](/docs/cli/reference#json-and-exit-codes) in the reference has the JSON's fields and every case of each code.

## Next

- [Command line reference](/docs/cli/reference): every command and option, how fonts and images are loaded, and how the CLI runs your designs.
- [Templates in the command line](/docs/templates/cli): `describe`, `design new`, `design set` and values files.
