# The playground's sandbox

`/playground` runs code a visitor wrote, or code a link carried, and shows what Hyper Elements renders from it. This
folder is what runs that code. The page around it is `src/pages/playground.astro` and `src/playground/`.

```
playground/
  protocol.ts        what the page and the sandbox say to each other
  sandbox/runner.ts  the sandboxed frame's script: makes the workers, stops one that runs too long
  sandbox/core.ts    the worker: compiles the code (Sucrase), runs it, renders it with @hyper-elements/react
                     and @hyper-elements/lint's plugin (on an Email and a Page)
  sandbox/pdf.ts     adds @hyper-elements/react/pdf (react-pdf's browser build)
  sandbox/image.ts   adds @hyper-elements/react/image (Satori, resvg as WebAssembly)
  sandbox/clients.ts adds @hyper-elements/email-clients (the checks' plugin, the previews)
  sandbox/shims/     what the engines need of Node in a browser, fflate without the Worker it starts, and the React
                     and core the bundles share
```

`scripts/playground-runtime.mjs` bundles each of `sandbox/*.ts` into one script with esbuild, from this repository's
sources (`packages/*/src`), so it needs no `pnpm build`. `scripts/playground-integration.mjs` serves them at
`/playground/runtime/` in `astro dev` and writes them into the site in `astro build`.

## What it must hold

A link (`/playground#code=…`) runs code someone else wrote as soon as the page opens, and a template can hold markup
of its own (an `Html` block), which the engine writes as given. So:

- None of it runs on the site's origin: no access to the page, its storage or its cookies.
- It makes no requests of its own.
- A loop that never ends doesn't freeze the page.
- What it returns is only ever data.

`scripts/check-playground.mjs` holds the built page to each of these, with a control that shows each check can fail.

## The layers

```
the page                      the editor and everything shown. The only part that's trusted.
 │  postMessage
 ▼
<iframe sandbox="allow-scripts" srcdoc>      runner.ts. Its origin is its own (opaque).
 │     Content-Security-Policy: default-src 'none'; scripts from this document and from blob: only
 ▼
 Worker (a blob: URL)          core.ts. A visitor's code runs here, and nowhere else.
```

- **The frame** is made by `src/playground/sandbox.ts`. Its document is written by the page, and nothing a visitor
  wrote is ever part of it. It can fetch nothing, so the page fetches the bundles and posts them to it as text.
- **A worker answers one request and is closed.** The next request gets one nothing has run in, and a spare is kept
  loaded so it doesn't wait. A worker that hasn't answered in 8 seconds (25 for a PDF or an image) is closed, and the
  request is answered with `timeout`. If the frame itself stops answering, the page throws it away and makes another.
- **No network, twice.** The frame's policy denies its workers every request. A worker also deletes `fetch`,
  `XMLHttpRequest`, `WebSocket`, `importScripts`, `Worker` and the rest from its globals before any code runs, for a
  browser that doesn't hand a frame's policy to its workers.

## What comes back

The code shares its worker's globals, so it can post any result it likes (it can take over the worker's
`postMessage` and rewrite the answer): every field is read as written by a stranger. `src/playground/sandbox.ts`
keeps only the fields a result has, each of its type and under a size.

| What | How the page uses it |
| --- | --- |
| Diagnostics, the outline, plain text, logs, errors | As text, never as markup |
| The HTML | In the HTML tab as text; drawn only inside a sandboxed frame (below) |
| A PDF | Kept only if it starts `%PDF-`; shown from a blob the page types `application/pdf`, in the browser's own viewer |
| A PNG | Kept only if its first bytes agree; drawn by an `<img>` from a blob typed `image/png` |
| An SVG | Kept only if its first bytes agree; drawn by an `<img>`, which runs nothing in it, from a `data:` URL. An SVG can hold a script, and a blob the page makes has the site's origin: opened on its own ("Open image in new tab"), its script would run on the site. A `data:` document never has it |
| An email client's preview file | In a frame of its own, from a `data:` URL, running only the package's own two scripts (below) |

## The preview

`src/playground/preview.ts` shows HTML in `<iframe sandbox="allow-scripts" srcdoc>`: an origin of its own, no popups,
forms or navigation of the page. The document is put together with `DOMParser`, never by searching the text:

- Every `<meta http-equiv="refresh">` and `<base>` is removed, so the frame can't be navigated.
- A Content-Security-Policy goes first in its head: images, fonts and styles over https, and one script, the page's
  own inspector, by a nonce the page makes after the HTML exists. A template's own scripts and handlers don't run.
- The inspector tells the page which block is under the pointer (an Email's block map says where each block is) and
  which link was clicked. The frame can't open a link: the page shows its address and opens `http:`, `https:` and
  `mailto:` ones from its own button.

### The email client previews

`@hyper-elements/email-clients`' preview files measure the email in frames they make and read, which an
origin-sandboxed document can't do. So each is loaded as `<iframe sandbox="allow-scripts allow-same-origin"
src="data:text/html;base64,…">`. A `data:` document always has an origin of its own, so `allow-same-origin` only lets
it reach the frames it made itself. The sandbox still takes away popups, forms, dialogs and navigation.

The file comes from the sandbox, so the code that ran can rewrite it, scripts included. The policy the page writes
first into its head lets only the package's two scripts run (the email client models and the preview's runtime), by
their sha256, and takes away the network. The page reads those hashes from the site, never from the sandbox:
`/playground/runtime/preview-scripts.json`, built with the clients bundle from the same sources
(`scripts/playground-runtime.mjs`, which stops the build if a script isn't the one its package's hash says). Without
them the page shows no preview rather than a looser policy.

**Never give that frame its document as `srcdoc` or from a `blob:` URL.** Both would have the site's origin, and with
those two flags a script in it would have the site. The check script fails on any frame with `allow-same-origin`
whose source isn't a `data:` URL.

## Requests the page makes for a template

- **The preview** loads the images, fonts and stylesheets a template names over https, as an email client would.
- **A PDF or an image** is drawn from files, not from the network. The worker says which fonts and images the
  template needs, and the page (`src/playground/assets.ts`) fetches them: a font by its family's name from
  Fontsource's files on jsDelivr, or the fallback from this site (Liberation Sans); the site's own images from the
  site, any other over https without cookies or a referrer. A few of each, each read no further than a size and
  given up on after a few seconds.

## Agents

`window.hyperElementsPlayground` and the WebMCP tools (`src/playground/agent.ts`) call the same sandbox, and so does a
link: its code is text put in the editor, run like code typed there.

A link's code, or an agent's, isn't the visitor's draft. The page keeps a draft in storage only once the visitor
changes the code here, and a draft that began as a link's still says so when it's opened again.

## What the compiler here adds

The code is compiled with Sucrase, which is fast and small and lets through two things a project's own compiler
wouldn't. The sandbox stops at both (`sandbox/core.ts`), so code that renders here compiles there:

- A closing tag that isn't its opening tag's (`<Text>…</Txt>`), found in Sucrase's own tokens.
- A name `@hyper-elements/react` doesn't export, said by name where it's used, with the nearest one it has.

## Known limits

- The page shows a PDF in the browser's own viewer, from a blob of the site's origin. A Blob's type is what the
  browser goes by, so it's read as a PDF and nothing else.
- A sandboxed frame shares the page's process in Chromium. The site keeps a theme choice and the visitor's own draft
  in storage, and nothing else.
- The preview loads remote images, so whoever wrote a link can tell it was opened.
- For a PDF or an image, the page itself fetches the images the template names, from any https host the code picks
  (`src/playground/assets.ts`). The request carries no cookies and no referrer, is read only where the host allows
  it (CORS), stops at 5 MB or 12 seconds, and there are at most 12 of them. It's still a request this page makes
  because code asked: the same reach an `<img>` in the preview has, from the page's own origin.
- Exports (HTML, PDF, PNG, SVG) are made by the code in the editor. The page says when that code came from a link.
