# @hyper-elements/cli

Check existing HTML emails and preview Outlook, Gmail and Apple Mail locally, with no React or Hyper Elements
installation required:

```bash
npx @hyper-elements/cli check email.html
npx @hyper-elements/cli preview email.html
```

The preview command writes `out/clients/email/outlook.html` and the other client previews to open in Chromium or Chrome.
To collect browser findings automatically, see [Previews](#previews) for `playwright-core` and browser setup.

Render, check and preview [Hyper Elements](https://github.com/hyper-elements/hyper-elements) designs from the shell,
with no script of your own: an Email's HTML and plain text, a Page's HTML, a Document's PDF, a Canvas's image, the email
client checks, and an Email as each email client draws it, with stable exit codes and JSON for agents and CI.

For designs, install `@hyper-elements/cli` beside `@hyper-elements/react` in your project (`npm install -D @hyper-elements/cli`),
then use the `hyper-elements` command:

```bash
npx hyper-elements render emails/          # out/emails/welcome.html, out/emails/welcome.txt, … paths kept
npx hyper-elements render docs/ cards/     # out/docs/invoice.pdf, out/cards/social.png
npx hyper-elements check emails/ --json    # validate() and the email client checks; exit 1 on errors
npx hyper-elements outline emails/welcome.tsx
npx hyper-elements preview emails/welcome.tsx   # out/clients/emails/welcome/outlook.html, …
npx hyper-elements describe Button --root Email --json
npx hyper-elements design new templates/launch.tsx -o designs/orbit.values.json --values brief.json
npx hyper-elements render designs/orbit.values.json   # out/designs/orbit.square.png, out/designs/orbit.landscape.png
npx @hyper-elements/cli check email.html   # any HTML email: the email client checks, with nothing installed
npx hyper-elements dev emails/ docs/       # a page on 127.0.0.1 showing each design, rendered again on each change
```

A design file is a module whose default export is a component that renders an `<Email>`, a `<Page>`, a `<Document>` or a
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
| `render <files or folders…>` | Writes each design's output under `--out` (default `out/`), at its path relative to the current folder (or `--base <dir>`), whatever else is given with it: an Email's `name.html` and `name.txt`, a Page's `name.html`, a Document's `name.pdf` (with `--html`, its print HTML `name.html` too), a Canvas's `name.png` (`name.svg` with `--format svg`; `--scale 2` for twice the pixels). `--stdout` writes one design's HTML, PDF or image to stdout; `--pretty` indents the HTML. Where the project has `@hyper-elements/email-clients`, an Email's and a Page's HTML is rendered with its email client checks, as `check` runs them (`--clients` picks the clients). |
| `check <files or folders…>` | Validates each design and writes nothing. Where the project has `@hyper-elements/email-clients`, its email client checks run too (`--clients gmail,outlook` picks the clients); [lint](#lint)'s checks run on an Email and a Page (`--no-lint` leaves them out). `--rendered` also renders, for the checks only the written HTML has (Gmail's size limit). `--max-warnings N` fails the run past N warnings. An HTML email is checked too: see [Any HTML email](#any-html-email). |
| `outline <file>` | Prints the design laid out: each block with its width. |
| `preview <files or folders…>` | Writes each Email as the email clients draw it, with the project's `@hyper-elements/email-clients` (`renderInEmailClients()`): one self-contained HTML file per client and variant, in `<out>/clients/<its path>/<name>/` (its path from the current folder, or `--base`), named by the preview (`outlook.html`, `gmail.mac.html`, `apple-mail.dark.html`). `--clients`, `--dark` and `--fonts inline` are `renderInEmailClients()`'s options. `--findings` draws each file in Chromium and reports what it found; `--screenshots` also writes a PNG of each; `--serve` serves them on `127.0.0.1`. See [Previews](#previews); an HTML email is previewed too ([Any HTML email](#any-html-email)). |
| `inspect <files or folders…>` | Lists what each design holds, as `inspect()` gives it: each element at its path, what it's given, whether its root takes it, and the problems found on it. |
| `describe [Element \| template.tsx]` | Lists every element a design can use (or one), with its props and styles, from `describeElements()` (or `describeElement()`); `--root Email` narrows it to what that root takes. No design is loaded: it reads the `@hyper-elements/react` the current folder resolves. Given a template module (a path, or a name ending in `.tsx`, `.ts`, `.jsx`, `.js`), what the template's `describe()` says: its formats, each field with its kind, guidance and image regions, its rules, and `valuesSchema`. See [Templates](#templates). |
| `design new <template> -o <name.values.json>` | Writes a values file, a design made from a template: `--values brief.json` and `--set field=value` give the values, checked by the template in every format; nothing is written where they fail (exit 1), unless `--draft`. See [Templates](#templates). |
| `design set <name.values.json> <field=value>…` | Changes some of a values file's values, checked as `design new` checks them: the file is rewritten only if they pass, and only the values named change. |
| `template extract <design> --id <id> --field <id>… -o <file>` | Writes a template from a design a person approved, by a codemod on its source (no design code runs): each `--field` names an `id` in the design. See [Templates](#templates). |
| `dev <files or folders…>` | Serves a page on `127.0.0.1` that shows each design, and renders them again when the project changes, until Ctrl-C. See [dev](#dev). |
| `migrate …` | Runs [`@hyper-elements/migrate`](https://www.npmjs.com/package/@hyper-elements/migrate) with the arguments given, unchanged: the project's, else `npx @hyper-elements/migrate`. Its output and exit codes are migrate's. |

A folder is searched for designs (and, for `render`, `check`, `inspect` and `outline`, values files), leaving out
`node_modules`, build output, and folders whose name starts with `.` or `_` (shared parts).

## PDFs and images

A Document is drawn with the project's `@hyper-elements/react/pdf` and `@react-pdf/renderer`, a Canvas with its
`@hyper-elements/react/image`, `satori` and `@resvg/resvg-js` (Elements' optional peers): install them beside
Elements. Without them, the design fails with an error naming what to install.

Neither renderer loads a font or an image itself. The CLI loads what the design names (`templateAssets()` lists
them) and gives them the files:

| Source | Read from |
|---|---|
| `fonts/Inter.ttf`, `./logo.png` | the design's folder |
| `/logo.png` | `--public <dir>`; by default the first `public/` beside a `package.json`, from the design's folder up to the workspace root |
| `data:` | the URI itself (a font's is decoded and given like a file) |
| `https://…`, `http://…` | fetched, and cached by URL in `node_modules/.cache/hyper-elements/` in the nearest `node_modules` above the design (else the OS's cache folder, under `hyper-elements/`) |

A cached file is used until `--refresh` fetches it again; `--offline` fetches nothing, and a URL not in the cache fails
the design (`cli/offline`, exit 1). A cache entry is written only once a whole 2xx response has arrived; a cache
folder the CLI can't write is read from only. Any other source (a scheme-relative `//host/…`, another scheme), and
one that can't be loaded (a 404, a missing file, a stylesheet URL such as Google Fonts' `css2` where a font file's own
URL belongs), is left out with a `cli/asset` warning naming it and why, and the renderer's own diagnostic follows
(`pdf/font`, `pdf/image`, `image/font`, `image/image`). A variable font's weight range is given at its lower bound.

Give TTF, OTF or WOFF fonts: neither renderer draws WOFF2 (Google Fonts' default), and a Canvas with no font it can
draw fails with `image/font`. A Document without one is drawn in standard PDF fonts, with `pdf/font` saying why.

With an Elements from before `templateAssets()` (0.4.3 adds it), a Document and a Canvas still write their HTML, with
a `cli/html-only` note.

## Templates

A template (`template()` from `@hyper-elements/react/template`) is a design with fields: what may change, and the
rules each value must meet. A design made from one is written as TSX, the template as its root, or as data, a values
file (`name.values.json`: its template's module, id and version, the formats wanted, and the values). The
[brand-templates skill](../../skills/brand-templates/SKILL.md) teaches an agent both, and writing templates.

```tsx
// designs/june.tsx
import { Column, Heading, Text } from "@hyper-elements/react";
import Newsletter from "../templates/newsletter";

export default () => <Newsletter subject="What's new in June" body={<Column><Heading level={2}>Faster exports</Heading><Text>…</Text></Column>} />;
```

```bash
npx hyper-elements describe templates/launch.tsx --json        # its formats, fields, image regions and rules
npx hyper-elements design new templates/launch.tsx -o designs/orbit.values.json \
  --values brief.json --set artwork=@art/waves.png --source artwork=source.json
npx hyper-elements check designs/orbit.values.json --json      # values, images against their files, fit, each format
npx hyper-elements render designs/orbit.values.json            # out/designs/orbit.square.png, orbit.landscape.png
npx hyper-elements design set designs/orbit.values.json launchDate=2026-12-10   # one value; the rest as it was
```

```json
{
  "version": 1,
  "template": { "module": "../templates/launch.tsx", "id": "acme.LaunchGraphic", "version": "1.0.0", "sha256": "…" },
  "formats": ["square", "landscape"],
  "values": { "headline": "Meet Orbit", "launchDate": "2026-12-03", "artwork": { "src": "../art/waves.png", "width": 2160, "height": 1360 } },
  "assets": { "artwork": { "sha256": "…", "source": { "kind": "generated" } } }
}
```

- **Each format is an input.** `render`, `check`, `inspect` and `outline` run a values file once per format it lists,
  each with its own line (`templateFormat`) and file, `<name>.<format>.<ext>`. `--template-format square` runs one;
  `--format` is still a Canvas's png or svg. `outline` and `--stdout` take one input, so a file of two formats needs
  `--template-format`. A template with formats checks a file that lists none as `template/format`.
- **What's checked.** The template reads the values (`template/…` diagnostics, each with its `field`), then its
  design is checked as any design is. A Canvas is drawn strict (a font that isn't given fails) and measured at the
  scale it's rendered at (the format's, or `--scale`): fitted text, and each image against its region and its file
  (`template/asset-pixels`, `template/asset-cropped`, `template/asset-type`). `check --json` adds `fits`, `regions`
  (each image's box and the pixels it needs), `rules` and `review` (what a reviewer looks at by eye; never an error).
  `render` checks the same, and writes nothing for an input that fails. For an Email, a Page and a Document, an image
  that's a file beside the design is read too, and checked against its rules for its type, its transparency and the
  size it's given as (`template/asset-type`, `template/asset-alpha`, `template/asset-size`); one that isn't read (a
  URL) leaves those undecided, said as `template/asset-unread`.
- **Paths.** The module is relative to the values file (or a package specifier, kept as given), and so are the image
  files of a Canvas or a Document, which the CLI reads to draw it. An Email's or a Page's image `src` is written as
  it's given: a URL, a service's tag (`{{logo_url}}`), `cid:`. A module changed under the same version is `template/changed`; a newer minor version is read again, a
  newer major through the template's migrations, and an older one is `template/version`.
- **A template module** is an input too: `check`, `inspect` and `outline` run it with its `example` in each format, its
  diagnostics each with its `templateFormat`. `render` of one is `cli/render-template` (exit 2): render a values file.
- **`design new` and `design set`.** A value is JSON where it parses, else text; `@path` is an image file, whose size is
  read from it and whose hash goes in `assets`, and `--source field=source.json` records where it came from. An
  image's entry follows its file: moved to another field, it keeps its hash and source; changed under the same name,
  it has no source until one is given (`template/asset-changed`), and `check`'s `review` lists an image with no
  source. A value the template refuses exits 1 and leaves the file's bytes as they were. `design set` reads the file
  as its template takes it now (its migrations run, for a draft too) and checks it after the sets, so a set can repair
  a file whose values the template refuses; a file of another template, or of a newer version, is left as it is.
  `--draft` writes the file
  anyway, with `"draft": true` and what's `missing`; `render` refuses a draft (`cli/draft`), and a `design set` that
  completes it removes both. With `--json`, one line: the file, its template, the paths that `changed`, the
  diagnostics.

- **TSX template designs.** A design whose root is a template is found in the child that loads it, set aside, and
  loaded again in a process of its own (a capture child) as far as its template's props; it's then checked like a
  values file, one input per format (`june.square.png`), in a template child that loads the template and not the
  design. Its slots' JSX is captured there and checked by the template. It's rendered with the props any design is:
  `--props file.json`, then its `PreviewProps`. A design whose template can't be found among
  its own imports, or whose props aren't data (a function), is `cli/template-design`. `design new <template> --from
  designs/june.tsx -o june.values.json` writes its values file.
- **Slots stored as modules.** A values file's slot can be `{ "module": "./june.body.tsx" }`, relative to it
  (`design set june.values.json body=@designs/june.body.tsx`). The module runs in a capture child, which can only reply
  with its capture: one that throws, sends anything else, replies twice, sends more than 8 MB or exits first is
  `cli/slot-module` (exit 1), and nothing is written. Its hash is kept in `assets`, as an image's is.
- **Trusted templates.** `"hyperElements": { "templates": ["templates/**", "@acme/brand-templates"] }` in the nearest
  `package.json` lists the templates a design may use: paths and globs relative to it, and packages. A template
  module, a values file's or a design's template outside it is `cli/template-untrusted` (exit 1). A template child
  then loads only what the list holds, installed packages and its own loader modules: anything else a template
  imports, statically, dynamically or with `require()`, is refused before it runs, naming who imported it. Without the
  list, templates load as any design does, with `"trusted": false` and a `cli/template-untrusted` warning. A design
  kept in a listed folder still runs as a design. A `package.json` that can't be read as JSON stops the run (exit 2):
  it can't say there's no list. On Bun,
  whose plugins can't see every load, a project with the list runs its templates on Node (exit 2 on Bun).
- **From an existing design.** `template extract designs/orbit.tsx --id acme.LaunchGraphic --field headline --field
  features --field artwork -o templates/launch-graphic.tsx` turns a design into a template. Each `--field` names an
  `id`: a literal text child becomes a `prop.text` field and an Image's literal `src` a `field.image`, the literal its
  `example`; siblings with ids `features-0`, `features-1`, … become one `prop.list`. The node keeps its `id` (it's
  output) and gains `field`. A value that isn't a literal is `extract/not-literal`, with its line and column, and
  nothing is written (exit 1). Relative imports and `src` paths are rewritten for the template's folder, and the rest
  of the file stays as written. The template renders its example to the design's bytes; add its rules and formats,
  set its `version`, and `check` it.
- **`--require-template [id]`** on `check` and `render` fails every input (exit 1, nothing written) that isn't a
  design a template checked, or one of another template. It checks a design's content, not its code: a TSX design
  and a slot module are code, run before the template checks anything, so review them as code. A values file with no
  slot module runs nothing, and is the input to take from agents and unreviewed sources.

Templates need `@hyper-elements/react` 0.5 (its `/template` entry); with 0.4, a template module or a values file is
`cli/elements-version` (exit 2). Without a trusted list, loading a values file or a template design runs its template's
code, as loading any design does.

## Previews

`preview` needs `@hyper-elements/email-clients` where the design is (`npm i -D @hyper-elements/email-clients`; without
it, exit 2). A design whose root isn't an Email is skipped, and each preview `renderInEmailClients()` doesn't make (a
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
`findings` the page wrote, and the input names the browser (`"browser": "chromium 148.0.7778.96, playwright"`). A
preview whose page says `error` fails its design (`cli/preview-failed`, exit 1); one that's `incomplete` doesn't.
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
`<out>/clients/stdin/`). A folder's HTML files aren't picked up, since a folder of designs often holds the HTML
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
clients `--clients` names or, by default, those the plugin checks a design for (Yahoo and AOL among them, which have
no model to preview with: their checks still run), and writes nothing. `preview` writes the previews, with `--findings`,
`--screenshots` and `--serve` as for a design.

No design code runs, so neither React nor Elements is needed, or loaded: `npx @hyper-elements/cli check email.html`
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
| it's from before 1.8.0 (checks designs only) | an `info` `email/captured-checks`; the checks from caniemail's tables run |
| its check throws on this email | an `email/captured-checks` warning; the checks from caniemail's tables run |

## dev

`dev` prints its URL and serves, until Ctrl-C (exit 0), a page that lists the designs and shows the one picked: an
Email or a Page at desktop width and at 375px, a Document's PDF, a Canvas's image, its diagnostics (with the email client
checks where the project has `@hyper-elements/email-clients`), and, for an Email with email-clients, links to its
previews in each email client (`preview`'s files). It takes `render`'s `--props`, `--public`, `--offline` and
`--timeout`, and `preview`'s `--clients`, `--dark` and `--fonts`; it writes nothing in the project (what it renders is
kept in a temporary folder of its own, removed when it exits), and what's wrong is said on the page and on stderr. Under
Bun, a Document shows `cli/bun` instead of its PDF, as `render` does there. It serves on a free port; `--port <n>` picks
one (1 to 65535; exit 2 where it's in use), to forward from a container or a remote machine. The URL's path still starts
with a random token.

Each change renders every design again in new child processes, one per package and tsconfig as `render` runs them,
on the runtime the CLI was started with: every import is fresh, and a design that loops or leaks ends with its child
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
it (`Rendered 3 designs in 212 ms, after a change to src/word.ts`).

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
version. That copy is the project's where the design (or the HTML file) resolves one, so the project picks lint's
version with `npm i -D @hyper-elements/lint`; otherwise it's the CLI's own, with an `info` note, `cli/lint-copy`.

## Output and exit codes

Text by default, with each design's diagnostics as `formatDiagnostics()` writes them. With `--json`, stdout holds one
JSON line per design, then a summary line, and nothing else: what designs print goes to stderr. A diagnostic at no
path in the design (the CLI's own, `cli/…`) is printed without one: `info cli/not-a-template: …`.

A design that doesn't load says why in its `error`, in one line: a syntax error, in the design or a module it
imports, as its file, line, column and reason (`emails/welcome.tsx:3:34: Unexpected closing "Emal" tag does not match
opening "Email" tag`; on Bun, in Bun's words), with "(and N more errors)" where there are more.

```json
{"version":1,"command":"check","file":"emails/welcome.tsx","input":"template","root":"Email","status":"ok","outputs":[],"diagnostics":[]}
{"version":1,"summary":{"templates":1,"errors":0,"warnings":0,"skipped":0,"late":[]},"exitCode":0}
```

An HTML email's line has `"input": "html"` and `"root": null` ([Any HTML email](#any-html-email)); a values file's
`"input": "values"`, its `templateFormat` and its `template` ([Templates](#templates)).
`inspect --json` writes `{"version":1,"command":"inspect","file","status","inspection"}` per design, `inspection`
being `inspect()`'s result as it is (`null`, with `diagnostics` and `error`, where the design didn't load), then the
summary line. `describe --json` writes one line, `describeElements()`'s or `describeElement()`'s result as it is,
with its own `version`. `outline` is text only.

- **0**: every design rendered, checked or previewed without errors.
- **1**: a design has errors, failed to load or threw; a values file is wrong (`cli/values-file`), a draft
  (`cli/draft`), or its values fail its template; loads two copies of React, ran past `--timeout`, needs a PDF
  or image engine that isn't installed, or names a URL that isn't cached with `--offline`; an HTML email isn't a whole
  email, or the email client models can't be used for it (see [Any HTML email](#any-html-email)); a preview failed in
  the browser; or the run passed `--max-warnings`.
- **2**: the run couldn't do what it was asked: a usage error, an unsupported runtime, no designs (none found in the
  folders given, or no input, folder or file, that turned out to be one: each is still listed, as skipped), Elements
  missing or outside the supported range (or too old for templates), outputs that would collide, `render` of a
  template module, `outline` of a template's formats without `--template-format`, a Canvas `check` can't measure
  without the image engines, a design that called `process.exit`, design
  code that threw outside a render, or a Document's PDF on Bun; `preview` without email-clients, or `--findings` with
  no browser found; `describe` for an element or root there isn't. A run with at least one design skips the inputs
  that aren't designs and exits as its designs do.

## How it runs designs

The CLI loads Elements, React and email-clients the way each design does: through a small module it writes beside the
design (named `.hyper-elements-<pid>-<n>.<ext>`, deleted as soon as it's loaded), so a design's path aliases,
workspace packages and module type all apply. The design's folder must be writable. Designs run in child processes,
one per package and tsconfig, and every process a design starts without detaching it ends with its child. A child
whose CLI is killed (or, on Windows, ended by another process) ends by itself, with the processes it started. A React the
design loads only during its render isn't counted among the copies of React it loads.

It runs on Node.js 20.6 or later (`npx hyper-elements`, TypeScript compiled with tsx) or Bun 1.3 or later
(`bunx --bun hyper-elements`; plain `bunx` follows the command's Node shebang and runs Node). Both give the same output,
byte for byte, and where Bun can't, the CLI says so rather than write something else:

- **A Canvas's PNG and SVG** are the same on Bun (Satori and resvg's native addon load, and draw the same pixels).
- **A Document's PDF** isn't: Bun's zlib compresses the PDF's streams differently, so the file differs from Node's
  although what it holds is the same. On Bun, on every platform, `render` refuses a Document (`cli/bun`, exit 2): run
  it with Node. `check` and `outline` work on Bun for every root.
- **`preview`**, `--findings` included, gives the same files and findings on Bun.

Under Bun a design resolves only what its project has installed (no auto-install).

The project needs `@hyper-elements/react` 0.4 or 0.5 (0.5 for templates).

## License

MIT
