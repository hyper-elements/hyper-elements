---
title: "Command line reference"
description: "Every hyper-elements command and its options: render's files, fonts and images, check and lint, preview's findings and browsers, HTML emails, dev, templates, the JSON output, exit codes, agents, and how the CLI runs designs."
---

[Command line](/docs/cli) introduces the commands with one project. This page has every command and the details of each.

## Commands

| Command | What it does |
|---------|--------------|
| `render <files or folders…>` | Writes each design's output under `--out` (default `out/`): an Email's `name.html` and `name.txt`, a Page's `name.html`, a Document's `name.pdf`, a Canvas's `name.png` |
| `check <files or folders…>` | Runs `validate()` with the email client checks and lint, and writes nothing |
| `outline <file>` | Prints the design laid out, each block with its width, as [`outline()`](/docs/rendering#outline) does |
| `preview <files or folders…>` | Writes each Email as the email clients show it, one file per client, with the [email client emulator](/docs/email-client-emulator) |
| `dev <files or folders…>` | Serves a page on `127.0.0.1` that shows each design, rendered again when the project changes |
| `inspect <files or folders…>` | Lists each element of a design, what it's given, whether its root takes it and the problems found on it |
| `describe [Element \| template.tsx]` | Lists the elements a design can use, with their props and styles; `--root Email` narrows it to what that root takes. Given a template module, what the template takes: its formats, fields, image regions and rules |
| `design new <template> -o <name.values.json>` | Writes a design made from a [template](/docs/templates), as a values file, once the template has checked its values |
| `design set <name.values.json> <field=value>…` | Changes some of a values file's values, checked by the template; the file is left as it was if they fail |
| `template extract <design> --id <id> --field <id>… -o <file>` | Writes a template from an approved design: each `--field` names an `id` in it, whose literal text or image becomes a field |
| `migrate …` | Runs [`@hyper-elements/migrate`](/docs/migrate/react-email) with the arguments given |

## Options

| Option | Commands | What it does |
|--------|----------|--------------|
| `--out <dir>` | `render`, `preview` | Where files are written, `out` by default |
| `--base <dir>` | `render`, `preview` | Outputs keep their path from this folder, the current one by default |
| `--props <file.json>` | all | Props for every design given, in place of its `PreviewProps` |
| `--json` | all | One JSON line per design, then a summary line |
| `--clients <a,b>` | `render`, `check`, `preview`, `dev` | The email clients to check for, or to preview |
| `--no-lint` | `render`, `check`, `dev` | Leaves out lint's checks |
| `--max-warnings <n>` | `check` | Fails the run (exit 1) with more than `n` warnings |
| `--rendered` | `check` | Also renders, for the check only the written HTML has |
| `--stdout` | `render` | Writes the one design's HTML, PDF or image to stdout |
| `--pretty` | `render` | Indents the HTML |
| `--html` | `render` | Also writes a Document's print HTML |
| `--format <png\|svg>` | `render` | A Canvas's image format, `png` by default |
| `--scale <n>` | `render`, `check` | A Canvas's pixels per px, 1 by default |
| `--public <dir>` | `render`, `check`, `dev` | Where `/paths` are read from |
| `--refresh`, `--offline` | `render`, `check` | Fetch remote fonts and images again, or fetch nothing |
| `--dark` | `preview`, `dev` | Also the dark previews |
| `--fonts <url\|inline>` | `preview`, `dev` | Where a preview's stand-in fonts come from |
| `--findings`, `--screenshots` | `preview` | Draw each preview in Chromium and report what it found, or save a PNG of it |
| `--serve` | `preview` | Serves the previews on `127.0.0.1` until Ctrl-C |
| `--port <n>` | `dev` | The port to serve on |
| `--timeout <seconds>` | all | How long a process rendering designs may run, 60 by default |

The options for templates (`--template-format`, `--require-template`, and those of `design` and `template extract`) are in [Templates in the command line](/docs/templates/cli). `npx hyper-elements --help` prints all of them.

## render

`render` writes each output at the design's path from the current folder: `render emails/` writes `out/emails/welcome.html` and `out/emails/welcome.txt`. `--out <dir>` replaces `out`, and `--base emails` makes the paths start inside `emails/`: `out/welcome.html`.

It prints each design's diagnostics, with the email client checks where the project has `@hyper-elements/email-clients`, as `check` runs them. `--clients` picks the clients. `--pretty` indents the HTML, and `--stdout` writes one design's HTML, PDF or image to stdout. A design with errors writes nothing.

### PDFs and images

A Document is drawn with [`renderPdf()`](/docs/outputs/pdf) and a Canvas with [`renderImage()`](/docs/outputs/image), so install their engines beside Elements: `@react-pdf/renderer` for PDFs, `satori` and `@resvg/resvg-js` for images. `--html` also writes a Document's print HTML. `--format svg` writes a Canvas as SVG, and `--scale 2` with twice the pixels.

Neither engine loads a font or an image itself. The CLI loads the ones the design names and hands them over:

| Source | Read from |
|--------|-----------|
| `fonts/Inter.ttf`, `./logo.png` | The design's folder |
| `/logo.png` | `--public <dir>`; by default the first `public/` beside a `package.json`, from the design's folder up |
| `data:` | The URI itself |
| `https://…` | Fetched once and cached in `node_modules/.cache/hyper-elements/`; `--refresh` fetches again, `--offline` fetches nothing |

Give fonts as TTF, OTF or WOFF files: neither engine draws WOFF2, Google Fonts' default. A source that can't be loaded is left out with a `cli/asset` warning that says why. A Document's PDF is written on Node.js only: on Bun, `render` refuses a Document (`cli/bun`).

## check

`check` runs every check `validate()` runs, without writing anything.

- **Email client checks** run where the project has `@hyper-elements/email-clients` (`npm i -D @hyper-elements/email-clients`), naming the clients each problem is about. `--clients gmail,outlook` picks the clients.
- **[Lint](#lint)** runs on each Email and Page.
- **`--rendered`** also renders each design, for the one check that needs the written HTML: an email's size against Gmail's limit.
- **`--max-warnings 0`** fails the run on any warning.

## Lint

`check`, `render` and `dev` run [lint](/docs/lint) on each Email and Page: links that don't say where they go, images without alternate text, faint or small text, headings out of order, a missing `lang`, merge syntax typed into the text. Its findings are warnings and notes (`email/lint-<rule>`, `page/lint-<rule>`), so they change the exit code only past `--max-warnings`. `check` of an HTML email runs its HTML rules (`lint/<rule>`, each at its line). `--no-lint` leaves them out.

Its options go in the `package.json` nearest the current folder, read once when the run (or `dev`) starts:

```json
{
  "hyperElements": {
    "lint": { "rules": { "text-size": "off" }, "kind": "marketing" }
  }
}
```

[Lint](/docs/lint) lists the rules and what `kind` does. An option of the wrong shape, or a rule, severity or kind lint doesn't know, exits 2 before anything is checked. Lint is the project's copy where the design resolves one (`npm i -D @hyper-elements/lint` picks its version), else the CLI's own, with an `info` note, `cli/lint-copy`.

## preview

`preview` writes each Email as the email clients show it, with the project's `@hyper-elements/email-clients` (`renderInEmailClients()`): one self-contained HTML file per client and variant, under `out/clients/<its path>/<name>/` (`out/clients/emails/welcome/` for `emails/welcome.tsx`). `--clients`, `--dark` and `--fonts inline` are [its options](/docs/email-client-emulator#options). A design whose root isn't an Email is skipped.

A preview file draws the email when a browser opens it, and lists what the client changed.

- **`--findings`** has the CLI read those findings for you. It needs `playwright-core` installed beside the CLI (`npm install -D playwright-core`); nothing else does. It opens each file in Chromium and reports what it found. It uses the first of these that starts: the browser `CHROME_PATH` names, Playwright's own Chromium (`npx hyper-elements preview --install-browser` downloads it), then an installed Chrome or Edge.
- **`--screenshots`** also writes a PNG of each preview beside it.
- **`--serve`** serves the previews on `127.0.0.1` and prints each one's URL, for a browser that can't open `file://` paths. It runs until Ctrl-C.

Nothing is sent anywhere to be drawn: the requests a preview makes are its stand-in fonts from jsDelivr (`--fonts inline` puts them in each file) and the email's own images and web fonts.

## Any HTML email

`check` and `preview` also take an HTML email however it was made (MJML, React Email, by hand, an email builder's export): an `.html` or `.htm` file given by name, or `-` to read one from stdin. No design's code runs, so neither React nor Elements is needed:

```bash
npx @hyper-elements/cli check email.html
cat email.html | npx @hyper-elements/cli preview -
```

To draw the previews and collect findings automatically, install the CLI and `playwright-core` together, and have Chrome, Edge or Playwright's Chromium installed:

```bash
npm install -D @hyper-elements/cli playwright-core
npx hyper-elements preview email.html --findings
```

If you need Chromium, download it once with `npx hyper-elements preview --install-browser`.

Each diagnostic has the `line` in the file and an excerpt of it. `check` runs [lint](#lint)'s HTML rules on it too. A folder's HTML files aren't picked up, since a folder of designs often holds the HTML rendered from them: give them by name (`check emails/*.html`).

To try the client previews before installing anything, open the [email testing playground](/email-testing), which runs the email-clients package in your browser.

## dev

```bash
npx hyper-elements dev emails/ docs/
```

`dev` prints a URL on `127.0.0.1` and serves a page that lists the designs and shows the one you pick: an Email or a Page at desktop width and at 375px, a Document's PDF, a Canvas's image, its diagnostics, and, for an Email with `@hyper-elements/email-clients`, links to its previews in each email client.

It renders every design again when the project's source, or a workspace package it depends on, changes. It writes nothing in the project, and runs until Ctrl-C. It serves on a free port; `--port <n>` picks one, to forward from a container or a remote machine (the path still starts with a random token).

## Templates

A [template](/docs/templates) is a design with fields: what may change, and the rules each value must meet. A design made from one is a values file, `name.values.json`, or a TSX file whose root is the template.

`render`, `check`, `inspect` and `outline` run such a design once per format, each with its own line and file. A value the template refuses exits `1`, and `render` writes nothing for a format that fails. `--require-template` fails anything a template didn't check.

[Templates in the command line](/docs/templates/cli) has every command and flag, values files, trusted templates and the diagnostics. [Template examples](/docs/templates/examples) runs them on real ones.

## JSON and exit codes

With `--json`, stdout holds one JSON line per design, then a summary line, and nothing else. What designs print goes to stderr. A design's line, laid out here to read:

<!-- json: cliJson -->
```json
{
  "version": 1,
  "command": "check",
  "file": "drafts/broken.tsx",
  "input": "template",
  "root": "Email",
  "status": "error",
  "outputs": [],
  "diagnostics": [
    {
      "code": "style/unknown",
      "severity": "error",
      "message": "\"marginBottom\" isn't a style a Text takes: use the parent's gap, or padding. See Text in @hyper-elements/react/GUIDE.md",
      "path": "root.children[0].style.marginBottom"
    }
  ]
}
```

And the summary line:

<!-- part-of: cliJson -->
```json
{"version":1,"summary":{"templates":1,"errors":1,"warnings":0,"skipped":0,"late":[]},"exitCode":1}
```

The field names are older than the docs' words: `templates` counts the designs given, and `input` is `"template"` for a design file, `"html"` for an HTML email and `"values"` for a values file.

Each diagnostic is the one [`validate()`](/docs/diagnostics) gives: `code`, `severity`, `message`, `path`, and the `clients` and `fix` where there are some.

A design that doesn't load has no diagnostics but an `error`, which says why in one line. For a syntax error, in the design or a module it imports, that's the file, line, column and reason:

```text
emails/welcome.tsx:3:34: Unexpected closing "Emal" tag does not match opening "Email" tag
```

`preview --json` adds each preview's `path`, `ready` and `findings`, and the `browser` it drew in.

| Exit code | Means |
|-----------|-------|
| `0` | Every design rendered, checked or previewed without errors |
| `1` | A design has errors, failed to load or threw; a values file is wrong, a draft, or its values fail its template; a design ran past `--timeout`; a PDF or image engine isn't installed; a preview failed in the browser; or the run passed `--max-warnings` |
| `2` | The run couldn't do what it was asked: a usage error, `render` of a template module, templates with an Elements before 0.5, no designs (none found, or no input that turned out to be one, such as a file whose default export isn't a component: each is still listed, as skipped), Elements missing, a Document's PDF on Bun, `preview` without `@hyper-elements/email-clients`, or `--findings` with no browser found |

In CI, fail the build on any problem in your designs:

```bash
npx hyper-elements check emails/ --max-warnings 0
```

## With an agent

An agent that can run commands needs no script to check its work. A loop from the shell:

1. `npx hyper-elements check emails/welcome.tsx --json`: fix each error, by its `path` and `message`, until the exit code is `0`.
2. `npx hyper-elements outline emails/welcome.tsx`: compare the layout with what was asked.
3. `npx hyper-elements preview emails/welcome.tsx --findings --json`: each preview's `findings` say what that email client removed or changed, what was missing, and text it draws on more lines.

Where no Chromium is found, `preview --findings` still writes the files, gives each preview `"findings": null` and the line `"browser": null, "reason": "no-browser"`, and exits `2`. Where `playwright-core` isn't installed, the reason is `"no-playwright-core"`, and stderr says how to install it.

An agent with a browser of its own opens each file (or the URLs `--serve` prints), waits for `<html data-email-client-ready>`, and reads the JSON in `#email-client-findings`. With no browser at all, `check`'s diagnostics are what it has. See [AI agents](/docs/guides/ai-agents) and [Email client emulator](/docs/email-client-emulator#test-an-email-from-the-shell).

## How it runs designs

The CLI loads Elements, React and `@hyper-elements/email-clients` the way each design does, so it renders with your versions. Designs run in child processes, one per package and tsconfig. Each is loaded through a small module the CLI writes beside it for a moment, so the design's folder must be writable.

`--timeout` (60 seconds by default) ends a design that loops or hangs: it fails, and the designs after it in its group run in a new process.

On Bun, the CLI gives the same output as on Node.js, byte for byte, except a Document's PDF, which it refuses there (Bun's zlib compresses the PDF's streams differently): render Documents with Node.js. `check`, `outline` and `preview` work on Bun for every root.
