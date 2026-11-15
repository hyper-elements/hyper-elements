# @hyper-elements/cli

Check existing HTML emails and preview Outlook, Gmail and Apple Mail locally, with no React or Hyper Elements
installation required:

```bash
npx @hyper-elements/cli check email.html
npx @hyper-elements/cli preview email.html
```

The preview command writes `out/clients/email/outlook.html` and the other client previews to open in Chromium or Chrome.
To collect browser findings automatically, see [Previews](#previews) for `playwright-core` and browser setup.

Render, check and preview [Hyper Elements](https://github.com/hyper-elements/hyper-elements) templates from the shell,
with no script of your own: an Email's HTML and plain text, a Page's HTML, a Document's PDF, a Canvas's image, the email
client checks, and an Email as each email client draws it, with stable exit codes and JSON for agents and CI.

For templates, install `@hyper-elements/cli` beside `@hyper-elements/react` in your project (`npm install -D @hyper-elements/cli`),
then use the `hyper-elements` command:

```bash
npx hyper-elements render emails/          # out/emails/welcome.html, out/emails/welcome.txt, … paths kept
npx hyper-elements render docs/ cards/     # out/docs/invoice.pdf, out/cards/social.png
npx hyper-elements check emails/ --json    # validate() and the email client checks; exit 1 on errors
npx hyper-elements outline emails/welcome.tsx
npx hyper-elements preview emails/welcome.tsx   # out/clients/emails/welcome/outlook.html, …
npx hyper-elements describe Button --root Email --json
npx @hyper-elements/cli check email.html   # any HTML email: the email client checks, with nothing installed
npx hyper-elements dev emails/ docs/       # a page on 127.0.0.1 showing each template, rendered again on each change
```

A template is a module whose default export is a component that renders an `<Email>`, a `<Page>`, a `<Document>` or a
`<Canvas>`. Its props are, first to last: `--props file.json`, the component's `PreviewProps`, `{}`.

```tsx
// emails/welcome.tsx
import { Email, Text } from "@hyper-elements/react";

export default function Welcome({ name }: { name: string }) {
  return (
    <Email previewText={`Welcome, ${name}`}>
      <Text>Hi {name}</Text>
    </Email>
  );
}
Welcome.PreviewProps = { name: "Ada" };
```

## Commands

| Command | What it does |
|---|---|
| `render <files or folders…>` | Writes each template's output under `--out` (default `out/`), at its path relative to the current folder (or `--base <dir>`), whatever else is given with it: an Email's `name.html` and `name.txt`, a Page's `name.html`, a Document's `name.pdf` (with `--html`, its print HTML `name.html` too), a Canvas's `name.png` (`name.svg` with `--format svg`; `--scale 2` for twice the pixels). `--stdout` writes one template's HTML, PDF or image to stdout; `--pretty` indents the HTML. Where the project has `@hyper-elements/email-clients`, an Email's and a Page's HTML is rendered with its email client checks, as `check` runs them (`--clients` picks the clients). |
| `check <files or folders…>` | Validates each template and writes nothing. Where the project has `@hyper-elements/email-clients`, its email client checks run too (`--clients gmail,outlook` picks the clients); [lint](#lint)'s checks run on an Email and a Page (`--no-lint` leaves them out). `--rendered` also renders, for the checks only the written HTML has (Gmail's size limit). `--max-warnings N` fails the run past N warnings. An HTML email is checked too: see [Any HTML email](#any-html-email). |
| `outline <file>` | Prints the template laid out: each block with its width. |
| `preview <files or folders…>` | Writes each Email as the email clients draw it, with the project's `@hyper-elements/email-clients` (`renderInEmailClients()`): one self-contained HTML file per client and variant, in `<out>/clients/<its path>/<name>/` (its path from the current folder, or `--base`), named by the preview (`outlook.html`, `gmail.mac.html`, `apple-mail.dark.html`). `--clients`, `--dark` and `--fonts inline` are `renderInEmailClients()`'s options. `--findings` draws each file in Chromium and reports what it found; `--screenshots` also writes a PNG of each; `--serve` serves them on `127.0.0.1`. See [Previews](#previews); an HTML email is previewed too ([Any HTML email](#any-html-email)). |
| `inspect <files or folders…>` | Lists what each template holds, as `inspect()` gives it: each component at its path, what it's given, whether its root takes it, and the problems found on it. |
| `describe [Component]` | Lists every component a template can use (or one), with its props and styles, from `describeComponents()` (or `describeComponent()`); `--root Email` narrows it to what that root takes. No template is loaded: it reads the `@hyper-elements/react` the current folder resolves. |
| `dev <files or folders…>` | Serves a page on `127.0.0.1` that shows each template, and renders them again when the project changes, until Ctrl-C. See [dev](#dev). |
| `migrate …` | Runs [`@hyper-elements/migrate`](https://www.npmjs.com/package/@hyper-elements/migrate) with the arguments given, unchanged: the project's, else `npx @hyper-elements/migrate`. Its output and exit codes are migrate's. |

A folder is searched for templates, leaving out `node_modules`, build output, and folders whose name starts with `.` or
`_` (shared parts).

## PDFs and images

A Document is drawn with the project's `@hyper-elements/react/pdf` and `@react-pdf/renderer`, a Canvas with its
`@hyper-elements/react/image`, `satori` and `@resvg/resvg-js` (Elements' optional peers): install them beside
Elements. Without them, the template fails with an error naming what to install.

A Document's template must load as an ES module: in a package.json with `"type": "module"`, or as an `.mts` file.
react-pdf imports a package that only an `import` loads, and a template in a project without `"type": "module"`
(what `npm init` writes) is compiled to CommonJS, its dependencies' imports with it. There the template fails with
`cli/commonjs-import` (exit 2), saying to add `"type": "module"` to the package.json, or to put the templates in a
folder with a package.json of `{"type": "module"}`. Any package that only an `import` loads gives the same error.

Neither renderer loads a font or an image itself. The CLI loads what the template names (`templateAssets()` lists
them) and gives them the files:

| Source | Read from |
|---|---|
| `fonts/Inter.ttf`, `./logo.png` | the template's folder |
| `/logo.png` | `--public <dir>`; by default the first `public/` beside a `package.json`, from the template's folder up to the workspace root |
| `data:` | the URI itself (a font's is decoded and given like a file) |
| `https://…`, `http://…` | fetched, and cached by URL in `node_modules/.cache/hyper-elements/` in the nearest `node_modules` above the template (else the OS's cache folder, under `hyper-elements/`) |

A cached file is used until `--refresh` fetches it again; `--offline` fetches nothing, and a URL not in the cache fails
the template (`cli/offline`, exit 1). A cache entry is written only once a whole 2xx response has arrived; a cache
folder the CLI can't write is read from only. Any other source (a scheme-relative `//host/…`, another scheme), and
one that can't be loaded (a 404, a missing file, a stylesheet URL such as Google Fonts' `css2` where a font file's own
URL belongs), is left out with a `cli/asset` warning naming it and why, and the renderer's own diagnostic follows
(`pdf/font`, `pdf/image`, `image/font`, `image/image`). A variable font's weight range is given at its lower bound.

Give TTF, OTF or WOFF fonts: neither renderer draws WOFF2 (Google Fonts' default), and a Canvas with no font it can
draw fails with `image/font`. A Document without one is drawn in standard PDF fonts, with `pdf/font` saying why.

With an Elements from before `templateAssets()` (0.4.3 adds it), a Document and a Canvas still write their HTML, with
a `cli/html-only` note.

## Previews

`preview` needs `@hyper-elements/email-clients` where the template is (`npm i -D @hyper-elements/email-clients`; without
it, exit 2). A template whose root isn't an Email is skipped, and each preview `renderInEmailClients()` doesn't make (a
client with no model to draw with, a dark mode not measured) is an `info` diagnostic, `cli/preview-skipped`.

Without `--findings` it writes the files and needs no browser: open one in Chromium, wait for
`<html data-email-client-ready>` and read `#email-client-findings` (the
[email-clients README](https://github.com/hyper-elements/hyper-elements/tree/main/packages/email-clients#what-a-preview-says)
says what's in it). With `--findings` the CLI does that itself, with `playwright-core` (an optional peer: install it
beside the CLI, `npm install -D playwright-core`), in the first of these that starts:

1. the browser `CHROME_PATH` names;
2. Playwright's own Chromium, where one is downloaded (`hyper-elements preview --install-browser` downloads it);
3. an installed Chrome, then Edge.

Each preview gets `ready` (`ok`, `incomplete` where a font or image was missing, `error` where the preview failed) and the
`findings` the page wrote, and the input names the browser (`"browser": "chromium 148.0.7778.96, playwright"`). The
browser is started in Chromium's sandbox; one that can't start in it (as root in a container, or on GitHub's Ubuntu
runners) is started without, says so once on stderr, and has `, no sandbox` after its name. A preview whose page says
`error` fails its template (`cli/preview-failed`, exit 1); one that's `incomplete` doesn't.
Where no browser is found, the files are still written and the email client checks reported, each preview's `findings`
is `null`, the input has `"browser": null, "reason": "no-browser"`, and the run exits 2. Where `playwright-core` isn't
installed, the same, with `"reason": "no-playwright-core"` and stderr saying how to install it. Install both packages in
the project with `npm install -D @hyper-elements/cli playwright-core`, then run `npx hyper-elements preview email.html --findings`.

```json
{"version":1,"command":"preview","file":"emails/welcome.tsx","input":"template","root":"Email","status":"ok","outputs":["out/clients/emails/welcome/gmail.html","out/clients/emails/welcome/gmail.mac.html"],"diagnostics":[],"previews":[{"id":"gmail","client":"gmail","path":"out/clients/welcome/gmail.html","ready":"ok","findings":{…}},{"id":"gmail.mac","client":"gmail","path":"out/clients/welcome/gmail.mac.html","ready":"ok","findings":{…}}],"browser":"chromium 148.0.7778.96, playwright"}
```

`--serve` serves `<out>/clients/` on `127.0.0.1`, on a free port, for a browser that can't open `file://` paths. It
writes each preview's URL (`url`, beside its `path`, with `--json`) and no summary, and runs until Ctrl-C (exit 0). It
answers only requests for its own host (`127.0.0.1`, `localhost` or `[::1]` with its port) with no `Origin` or its own,
under the random path its URLs carry, for files in that folder.

Nothing is sent anywhere to be drawn. The requests a preview makes are its stand-in fonts from jsDelivr (`--fonts inline`
puts them in each file instead) and, once drawn, the email's own images and web fonts; `--install-browser` downloads
Chromium.

## Any HTML email

`check` and `preview` also take an HTML email however it was made (MJML, React Email, by hand, an email builder's
export): an `.html` or `.htm` file given by name, or `-` to read one from stdin (named `stdin`, its previews in
`<out>/clients/stdin/`). A folder's HTML files aren't picked up, since a folder of templates often holds the HTML
rendered from them: give them by name (`check emails/*.html`). `render`, `outline` and `inspect` exit 2 for HTML: it's
already HTML.

```bash
npx @hyper-elements/cli check email.html --json
cat email.html | npx @hyper-elements/cli preview -
```

To collect findings, install the CLI and its optional browser dependency together, and have Chrome, Edge or Playwright's Chromium installed:

```bash
npm install -D @hyper-elements/cli playwright-core
npx hyper-elements preview email.html --findings
```

If you need Chromium, download it once with `npx hyper-elements preview --install-browser`.

Both call `@hyper-elements/email-clients`' `renderInEmailClients(html)`. `check` keeps only its diagnostics, for the
clients `--clients` names or, by default, those the plugin checks a template for (Yahoo and AOL among them, which have
no model to preview with: their checks still run), and writes nothing. `preview` writes the previews, with `--findings`,
`--screenshots` and `--serve` as for a template.

No template code runs, so neither React nor Elements is needed, or loaded: `npx @hyper-elements/cli check email.html`
installs neither. email-clients is the one the HTML file's folder resolves where it's 0.4.3 or later (the first to take
HTML); otherwise the CLI's own copy, with an `info` note, `cli/email-clients-copy`, naming the project's version where
it has one.

An HTML email's diagnostics are email-clients' as it gives them: `path: "html"`, the `line` in the file (or `null`, for
one about the email as a whole) and an `excerpt` of it; the text output prints them at `file:line`. Their JSON line has
`"input": "html"` and `"root": null`:

```json
{"version":1,"command":"check","file":"email.html","input":"html","root":null,"status":"ok","outputs":[],"diagnostics":[{"code":"email/html-css","severity":"info","message":"This email may have position: absolute: the client removes it","clients":["outlook","gmail","yahoo"],"fix":"lay it out without position (a Layer puts content over an image)","see":"https://www.caniemail.com/features/css-position/","path":"html","line":3,"excerpt":"<head><style>.card { position: absolute; }</style></head>"}]}
```

A file that isn't a whole email (no `<html>` or no `<body>` tag) is that input's `error`, with email-clients' message.
Where the email client models can't be used, both commands do as email-clients does:

| What fails | `check` and `preview` |
|---|---|
| `@hyper-elements/email-client-models` doesn't import | the input's `error` (previews need the package): exit 1 |
| its WebAssembly doesn't compile | an `email/captured-checks` warning; the checks from caniemail's tables run, and the previews are made |
| it speaks a protocol email-clients doesn't read | `email-clients/version-mismatch`: the input's an error, exit 1 |
| it's from before 1.8.0 (checks templates only) | an `info` `email/captured-checks`; the checks from caniemail's tables run |
| its check throws on this email | an `email/captured-checks` warning; the checks from caniemail's tables run |

## dev

`dev` prints its URL and serves, until Ctrl-C (exit 0), a page that lists the templates and shows the one picked: an
Email or a Page at desktop width and at 375px, a Document's PDF, a Canvas's image, its diagnostics (with the email client
checks where the project has `@hyper-elements/email-clients`), and, for an Email with email-clients, links to its
previews in each email client (`preview`'s files). It takes `render`'s `--props`, `--public`, `--offline` and
`--timeout`, and `preview`'s `--clients`, `--dark` and `--fonts`; it writes nothing in the project (what it renders is
kept in a temporary folder of its own, removed when it exits), and what's wrong is said on the page and on stderr. Under
Bun, a Document shows `cli/bun` instead of its PDF, as `render` does there. It serves on a free port; `--port <n>` picks
one (1 to 65535; exit 2 where it's in use), to forward from a container or a remote machine. The URL's path still starts
with a random token.

Each change renders every template again in new child processes, one per package and tsconfig as `render` runs them,
on the runtime the CLI was started with: every import is fresh, and a template that loops or leaks ends with its child
(`--timeout`, `cli/timeout` on the page) while the server keeps serving. It renders after 100 ms with no change, so a
source change and the rebuild that follows it are each shown. It doesn't follow imports; it watches:

- the project's source: the folder of the nearest `package.json`, its `.tsx`, `.jsx`, `.ts`, `.js`, `.mts` and `.mjs`
  files (and `.cts` and `.cjs`), leaving out `node_modules`, build output (`dist`, `build`, `out`, …) and folders
  starting with `.`;
- each workspace package the project depends on (a `workspace:` or `link:` version, or a dependency installed as a
  symbolic link to a folder outside `node_modules`), and theirs: every file, `dist` and `build` included, so a package
  whose runtime is its build is shown again when it's rebuilt.

A file counts as changed when its modification time or size is new, or it's made or removed, so an event that comes
twice, or late, for a change already rendered doesn't render again. Each render's line on stderr says what changed for
it (`Rendered 3 templates in 212 ms, after a change to src/word.ts`).

The page shows an Email's and a Page's HTML in `<iframe sandbox>` without `allow-same-origin`, and serves it with a
`Content-Security-Policy: sandbox` of its own: an `Html` block's scripts run there, in an origin that isn't the page's,
and can't read the page, what it shows or its event stream. The server listens on `127.0.0.1` only, as `--serve` does:
it answers only its own host (`127.0.0.1`, `localhost` or `[::1]` with its port), with no `Origin` or its own (the event
stream too), under the random path its URL carries, and only its own files.

## Lint

`check`, `render` and `dev` also run [`@hyper-elements/lint`](https://www.hyperelements.dev/docs/lint) on each Email
and Page: links that don't say where they go, images without alternate text, faint or small text, headings out of
order, a missing `lang`, merge syntax typed by hand. Its findings are warnings and notes (`email/lint-<rule>`,
`page/lint-<rule>`, each with a fix and a docs link), so they change the exit code only past `--max-warnings`. `check` of
an HTML email runs its HTML rules (`lint/<rule>`, each at its line). `--no-lint` leaves them out.

Its options are in the `package.json` nearest the current folder:

```json
{ "hyperElements": { "lint": { "rules": { "text-size": "off" }, "kind": "marketing" } } }
```

They're read once when the run (or `dev`) starts. The CLI checks their shape before anything runs (exit 2); the copy of
lint that runs checks what they mean, and a rule, severity or kind it doesn't know is exit 2 too, naming that copy and its
version. That copy is the project's where the template (or the HTML file) resolves one, so the project picks lint's
version with `npm i -D @hyper-elements/lint`; otherwise it's the CLI's own, with an `info` note, `cli/lint-copy`.

## Output and exit codes

Text by default, with each template's diagnostics as `formatDiagnostics()` writes them. With `--json`, stdout holds one
JSON line per template, then a summary line, and nothing else: what templates print goes to stderr. A diagnostic at no
path in the template (the CLI's own, `cli/…`) is printed without one: `info cli/not-a-template: …`.

A template that doesn't load says why in its `error`, in one line: a syntax error, in the template or a module it
imports, as its file, line, column and reason (`emails/welcome.tsx:3:34: Unexpected closing "Emal" tag does not match
opening "Email" tag`; on Bun, in Bun's words), with "(and N more errors)" where there are more.

```json
{"version":1,"command":"check","file":"emails/welcome.tsx","input":"template","root":"Email","status":"ok","outputs":[],"diagnostics":[]}
{"version":1,"summary":{"templates":1,"errors":0,"warnings":0,"skipped":0,"late":[]},"exitCode":0}
```

An HTML email's line has `"input": "html"` and `"root": null` ([Any HTML email](#any-html-email)).
`inspect --json` writes `{"version":1,"command":"inspect","file","status","inspection"}` per template, `inspection`
being `inspect()`'s result as it is (`null`, with `diagnostics` and `error`, where the template didn't load), then the
summary line. `describe --json` writes one line, `describeComponents()`'s or `describeComponent()`'s result as it is,
with its own `version`. `outline` is text only.

- **0**: every template rendered, checked or previewed without errors.
- **1**: a template has errors, failed to load or threw, loads two copies of React, ran past `--timeout`, needs a PDF
  or image engine that isn't installed, or names a URL that isn't cached with `--offline`; an HTML email isn't a whole
  email, or the email client models can't be used for it (see [Any HTML email](#any-html-email)); a preview failed in
  the browser; or the run passed `--max-warnings`.
- **2**: the run couldn't do what it was asked: a usage error, an unsupported runtime, no templates (none found in the
  folders given, or no input, folder or file, that turned out to be one: each is still listed, as skipped), Elements
  missing or outside the supported range, outputs that would collide, a template that called `process.exit`, template
  code that threw outside a render, or a Document's PDF on Bun; `preview` without email-clients, or `--findings` with
  no browser found; `describe` for a component or root there isn't. A run with at least one template skips the inputs
  that aren't templates and exits as its templates do.

## How it runs templates

The CLI loads Elements, React and email-clients the way each template does: through a small module it writes beside the
template (named `.hyper-elements-<pid>-<n>.<ext>`, deleted as soon as it's loaded), so a template's path aliases,
workspace packages and module type all apply. The template's folder must be writable. Templates run in child processes,
one per package and tsconfig, and every process a template starts without detaching it ends with its child. A child
whose CLI is killed (or, on Windows, ended by another process) ends by itself, with the processes it started. A React the
template loads only during its render isn't counted among the copies of React it loads.

It runs on Node.js 20.6 or later (`npx hyper-elements`, TypeScript compiled with tsx) or Bun 1.3 or later
(`bunx --bun hyper-elements`; plain `bunx` follows the command's Node shebang and runs Node). Both give the same output,
byte for byte, and where Bun can't, the CLI says so rather than write something else:

- **A Canvas's PNG and SVG** are the same on Bun (Satori and resvg's native addon load, and draw the same pixels).
- **A Document's PDF** isn't: Bun's zlib compresses the PDF's streams differently, so the file differs from Node's
  although what it holds is the same. On Bun, on every platform, `render` refuses a Document (`cli/bun`, exit 2): run
  it with Node. `check` and `outline` work on Bun for every root.
- **`preview`**, `--findings` included, gives the same files and findings on Bun.

Under Bun a template resolves only what its project has installed (no auto-install).

The project needs `@hyper-elements/react` 0.4.

## License

MIT
