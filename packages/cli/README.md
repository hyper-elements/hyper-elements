# @hyper-elements/cli

Render, check and preview [Hyper Elements](https://github.com/hyper-elements/hyper-elements) templates from the shell,
with no script of your own: an Email's HTML and plain text, a Page's HTML, a Document's PDF, a Canvas's image, the email
client checks, and an Email as each email client draws it, with stable exit codes and JSON for agents and CI.

```bash
npx hyper-elements render emails/          # out/welcome.html, out/welcome.txt, … the folder's tree mirrored
npx hyper-elements render docs/ cards/     # out/docs/invoice.pdf, out/cards/social.png
npx hyper-elements check emails/ --json    # validate() and the email client checks; exit 1 on errors
npx hyper-elements outline emails/welcome.tsx
npx hyper-elements preview emails/welcome.tsx --findings   # out/clients/welcome/outlook.html, … drawn in Chromium
npx hyper-elements describe Button --root Email --json
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
| `render <files or folders…>` | Writes each template's output under `--out` (default `out/`), at its path relative to the folder holding every input: an Email's `name.html` and `name.txt`, a Page's `name.html`, a Document's `name.pdf` (with `--html`, its print HTML `name.html` too), a Canvas's `name.png` (`name.svg` with `--format svg`; `--scale 2` for twice the pixels). `--stdout` writes one template's HTML, PDF or image to stdout; `--pretty` indents the HTML. |
| `check <files or folders…>` | Validates each template and writes nothing. Where the project has `@hyper-elements/email-clients`, its email client checks run too (`--clients gmail,outlook` picks the clients). `--rendered` also renders, for the checks only the written HTML has (Gmail's size limit). `--max-warnings N` fails the run past N warnings. |
| `outline <file>` | Prints the template laid out: each block with its width. |
| `preview <files or folders…>` | Writes each Email as the email clients draw it, with the project's `@hyper-elements/email-clients` (`renderInEmailClients()`): one self-contained HTML file per client and variant, in `<out>/clients/<name>/`, named by the preview (`outlook.html`, `gmail.mac.html`, `apple-mail.dark.html`). `--clients`, `--dark` and `--fonts inline` are `renderInEmailClients()`'s options. `--findings` draws each file in Chromium and reports what it found; `--screenshots` also writes a PNG of each; `--serve` serves them on `127.0.0.1`. See [Previews](#previews). |
| `inspect <files or folders…>` | Lists what each template holds, as `inspect()` gives it: each component at its path, what it's given, whether its root takes it, and the problems found on it. |
| `describe [Component]` | Lists every component a template can use (or one), with its props and styles, from `describeComponents()` (or `describeComponent()`); `--root Email` narrows it to what that root takes. No template is loaded: it reads the `@hyper-elements/react` the current folder resolves. |
| `migrate …` | Runs [`@hyper-elements/migrate`](https://www.npmjs.com/package/@hyper-elements/migrate) with the arguments given, unchanged: the project's, else `npx @hyper-elements/migrate`. Its output and exit codes are migrate's. |

A folder is searched for templates, leaving out `node_modules`, build output, and folders whose name starts with `.` or
`_` (shared parts).

## PDFs and images

A Document is drawn with the project's `@hyper-elements/react/pdf` and `@react-pdf/renderer`, a Canvas with its
`@hyper-elements/react/image`, `satori` and `@resvg/resvg-js` (Elements' optional peers): install them beside
Elements. Without them, the template fails with an error naming what to install.

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
says what's in it). With `--findings` the CLI does that itself, in the first of these that starts:

1. the browser `CHROME_PATH` names;
2. Playwright's own Chromium, where one is downloaded (`hyper-elements preview --install-browser` downloads it);
3. an installed Chrome, then Edge.

Each preview gets `ready` (`ok`, `incomplete` where a font or image was missing, `error` where the preview failed) and the
`findings` the page wrote, and the input names the browser (`"browser": "chromium 148.0.7778.96, playwright"`). A
preview whose page says `error` fails its template (`cli/preview-failed`, exit 1); one that's `incomplete` doesn't.
Where no browser is found, the files are still written and the email client checks reported, each preview's `findings`
is `null`, the input has `"browser": null, "reason": "no-browser"`, and the run exits 2.

```json
{"version":1,"command":"preview","file":"emails/welcome.tsx","input":"template","root":"Email","status":"ok","outputs":["out/clients/welcome/gmail.html","out/clients/welcome/gmail.mac.html"],"diagnostics":[],"previews":[{"id":"gmail","client":"gmail","path":"out/clients/welcome/gmail.html","ready":"ok","findings":{…}},{"id":"gmail.mac","client":"gmail","path":"out/clients/welcome/gmail.mac.html","ready":"ok","findings":{…}}],"browser":"chromium 148.0.7778.96, playwright"}
```

`--serve` serves `<out>/clients/` on `127.0.0.1`, on a free port, for a browser that can't open `file://` paths. It
writes each preview's URL (`url`, beside its `path`, with `--json`) and no summary, and runs until Ctrl-C (exit 0). It
answers only requests for its own host (`127.0.0.1`, `localhost` or `[::1]` with its port) with no `Origin` or its own,
under the random path its URLs carry, for files in that folder.

Nothing is sent anywhere to be drawn. The requests a preview makes are its stand-in fonts from jsDelivr (`--fonts inline`
puts them in each file instead) and, once drawn, the email's own images and web fonts; `--install-browser` downloads
Chromium.

## Output and exit codes

Text by default, with each template's diagnostics as `formatDiagnostics()` writes them. With `--json`, stdout holds one
JSON line per template, then a summary line, and nothing else: what templates print goes to stderr.

```json
{"version":1,"command":"check","file":"emails/welcome.tsx","input":"template","root":"Email","status":"ok","outputs":[],"diagnostics":[]}
{"version":1,"summary":{"templates":1,"errors":0,"warnings":0,"skipped":0,"late":[]},"exitCode":0}
```

`inspect --json` writes `{"version":1,"command":"inspect","file","status","inspection"}` per template, `inspection`
being `inspect()`'s result as it is (`null`, with `diagnostics` and `error`, where the template didn't load), then the
summary line. `describe --json` writes one line, `describeComponents()`'s or `describeComponent()`'s result as it is,
with its own `version`. `outline` is text only.

- **0**: every template rendered, checked or previewed without errors.
- **1**: a template has errors, failed to load or threw, loads two copies of React, ran past `--timeout`, needs a PDF
  or image engine that isn't installed, or names a URL that isn't cached with `--offline`; a preview failed in the
  browser; or the run passed `--max-warnings`.
- **2**: the run couldn't do what it was asked: a usage error, an unsupported runtime, no templates, Elements missing or
  outside the supported range, outputs that would collide, a template that called `process.exit`, template code that
  threw outside a render, or a Document's PDF on Bun; `preview` without email-clients, or `--findings` with no browser
  found; `describe` for a component or root there isn't.

## How it runs templates

The CLI loads Elements, React and email-clients the way each template does: through a small module it writes beside the
template (named `.hyper-elements-<pid>-<n>.<ext>`, deleted as soon as it's loaded), so a template's path aliases,
workspace packages and module type all apply. The template's folder must be writable. Templates run in child processes,
one per package and tsconfig, and every process a template starts without detaching it ends with its child. A React the
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
