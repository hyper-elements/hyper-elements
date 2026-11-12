# @hyper-elements/cli

Render and check [Hyper Elements](https://github.com/hyper-elements/hyper-elements) templates from the shell, with no
script of your own: an Email's HTML and plain text, a Page's HTML, a Document's PDF, a Canvas's image, and the email
client checks, with stable exit codes and JSON for agents and CI.

```bash
npx hyper-elements render emails/          # out/welcome.html, out/welcome.txt, … the folder's tree mirrored
npx hyper-elements render docs/ cards/     # out/docs/invoice.pdf, out/cards/social.png
npx hyper-elements check emails/ --json    # validate() and the email client checks; exit 1 on errors
npx hyper-elements outline emails/welcome.tsx
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

## Output and exit codes

Text by default, with each template's diagnostics as `formatDiagnostics()` writes them. With `--json`, stdout holds one
JSON line per template, then a summary line, and nothing else: what templates print goes to stderr.

```json
{"version":1,"command":"check","file":"emails/welcome.tsx","input":"template","root":"Email","status":"ok","outputs":[],"diagnostics":[]}
{"version":1,"summary":{"templates":1,"errors":0,"warnings":0,"skipped":0,"late":[]},"exitCode":0}
```

- **0**: every template rendered or checked without errors.
- **1**: a template has errors, failed to load or threw, loads two copies of React, ran past `--timeout`, needs a PDF
  or image engine that isn't installed, or names a URL that isn't cached with `--offline`; or the run passed
  `--max-warnings`.
- **2**: the run couldn't do what it was asked: a usage error, an unsupported runtime, no templates, Elements missing or
  outside the supported range, outputs that would collide, a template that called `process.exit`, template code that
  threw outside a render, or a Document's PDF on Bun.

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

The project needs `@hyper-elements/react` 0.4.

## License

MIT
