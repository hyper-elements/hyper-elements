# hyperelements.dev

The Hyper Elements website: an [Astro](https://astro.build) site, built to static files. It needs Node.js 22.23.4 or later (Astro 7's minimum; `.nvmrc` has it).

```bash
pnpm --filter @hyper-elements/website dev        # http://localhost:4321
pnpm --filter @hyper-elements/website build      # static site in dist/
pnpm --filter @hyper-elements/website generate   # re-render the examples and the component reference
pnpm --filter @hyper-elements/website check:playground   # after build: the playground, in a browser
```

## Every preview is real output

Nothing on the site is a mockup. `scripts/generate.mjs` renders every example in `examples/` with Hyper Elements itself: the templates (`templates/`), one example per component (`components/`), and the home page's own examples (`showcase/`). It writes:

| Output | What |
|--------|------|
| `src/generated/examples.json` | Each example's source, HTML, plain text, outline and diagnostics |
| `src/generated/reference/*.md` | One page per component, split from the package's own `REFERENCE.md` |
| `public/generated/templates/` | Each Document template as a real PDF and each Canvas template as a real PNG |

`src/generated/migrate/before.tsx` and `after.tsx` aren't written by `generate`: they're a React Email template and what `@hyper-elements/migrate` wrote for it, committed by hand. Run the migrate CLI on `before.tsx` and replace `after.tsx` when the converter changes.

Everything generated is committed, so the site builds without the engine. Run `generate` after changing an example or the engine:

1. Build the engine first, from the repo root: `pnpm build`. The script renders with `packages/react`'s built `dist/`.
2. Run `pnpm --filter @hyper-elements/website generate`. The PDFs and PNGs need the templates' fonts as TTF files, so the first run fetches them from Google Fonts into `node_modules/.cache`; later runs use the cache.

An example that doesn't render fails the script with the engine's own error.

The examples import `@hyper-elements/react`. Until the packages are renamed, the script resolves that to the workspace's `@hyper-elements/react`. To render with another build, point it at that checkout's built `packages/react`:

```bash
HYPER_ELEMENTS_PACKAGE=/path/to/checkout/packages/react pnpm --filter @hyper-elements/website generate
```

The home page's client views (`public/generated/clients/*.png`: classic Outlook, Gmail, Apple Mail light
and dark) are images of the launch email (`examples/showcase/email.tsx`) in each client, committed as they
are. Replace them when the launch email changes.

The Email client emulator page's images (`public/generated/email-clients/*.png`) are its welcome email and two
templates, plus the launch email for the home page's emulator tile, each drawn by `@hyper-elements/email-clients` in classic
Outlook, Gmail, Apple Mail and the Gmail app and captured in Chromium.
Rebuild them after a release of the emulator, with the packages built and Playwright's Chromium installed:
`pnpm --filter @hyper-elements/website generate:email-clients`.

The comparison pages (`/compare/…`) show images of real output, not live previews, so the examples' own headings and copy
aren't read as the page's text: `public/generated/compare/*.jpg`, drawn in Chromium from `src/generated/examples.json`
by `scripts/compare-previews.mjs`. Its one email in two themes is `examples/brand/announcement.tsx`, rendered by
`examples/showcase/brand-north.tsx` and `brand-bloom.tsx`. Redraw them after `generate` when one of those examples changes:
`pnpm --filter @hyper-elements/website generate:compare`.

Images the examples use live in `public/img/` and are referenced as `https://hyperelements.dev/img/…`, so a copied example works anywhere. Previews load them from the site itself.

## Pages

| Route | Source |
|-------|--------|
| `/` | `src/pages/index.astro` |
| `/docs/…` | `src/content/docs/**/*.md`, in the order of `docsNav` in `src/lib/site.ts` |
| `/docs/components/…` | `src/generated/reference/*.md`, with the live example from `examples/components/` |
| `/components` | The component gallery |
| `/templates`, `/templates/<slug>` | `examples/templates/*.tsx` |
| `/playground` | `src/pages/playground.astro`, `src/playground/` and `playground/` (see below) |
| `/email-testing` | `src/pages/email-testing.astro` and `src/email-testing/`: existing HTML checked and previewed with the email-clients package |
| `/ai`, `/migrate` | Landing pages |
| `/compare/react-email`, `/compare/mjml` | `src/pages/compare/*.astro`: Hyper Elements and one other tool, side by side. Each page gives the other tool's facts to `src/components/ComparePage.astro`, which draws the page. Every comparison and alternatives page is listed in `src/lib/compare-pages.ts`, so each links to the others: add a new one there |
| `/alternatives/react-email`, `/alternatives/litmus` | `src/pages/alternatives/*.astro`: one tool's alternatives as a list. Each page gives the tools, the table, the questions and its own visual to `src/components/AlternativesPage.astro` |
| `/blog`, `/blog/<slug>` | Developer articles from `src/content/blog/*.md` |
| `/llms.txt`, `/llms-full.txt` | Every docs page, component and blog tutorial, for AI agents |

Names and links (package names, GitHub, install commands) are in `src/lib/site.ts`. The docs pages repeat the package names in their text, so a rename also needs a search and replace in `src/content/docs/`.

## The playground

`/playground` renders a template in the visitor's browser with the engine itself: an Email, a Page, a Document (print HTML and a PDF) or a Canvas (a PNG or an SVG), with its diagnostics, its outline and, for an Email, the email client checks and previews.

- **The engine it runs is this repository's, from its sources.** `scripts/playground-runtime.mjs` bundles `packages/*/src` with esbuild into the scripts the page's sandbox loads (`/playground/runtime/*.js`), so the playground needs no `pnpm build` and always runs the checkout it's built from. It does need the workspace installed: React, react-pdf and Satori are resolved from `packages/react` and `packages/internal/core`, as `generate` resolves them.
- **The code runs in a sandbox**: a frame with an origin of its own and no network, in a worker that's closed after each render. `playground/README.md` says how, and what the page does with what comes back. Read it before changing a frame's `sandbox` or how a preview's document is made.
- **Templates** (the playground's Template menu, `starters` in its API) are the site's examples, listed in `src/lib/playground.ts`. The browser check's own templates are in `scripts/fixtures/`.
- **Agents** drive it by a link (`#code=`), by `window.hyperElementsPlayground` or by WebMCP tools (`src/playground/agent.ts`). The page documents all three under the bench.

After `build`, run `pnpm --filter @hyper-elements/website check:playground`. It opens the built page in Chromium (Playwright's, from `packages/react`) and checks that every root renders, that a broken template shows its diagnostics, that a mismatched closing tag and a misspelled import are errors with their lines, that code from a link can't reach the site's origin or the network and isn't kept as the visitor's draft, that markup in a template doesn't run in the preview, and that a loop is stopped. It makes no requests off this machine.

## Email testing

`/email-testing` opens a full-height HTML editor beside 14 client/device thumbnails: classic Outlook;
Outlook.com, Gmail, Yahoo and AOL on Windows and Mac; Gmail on Android and iPhone, plus other accounts;
and Apple Mail on Mac and iPhone. Clicking a card opens that exact variant in the right panel; All clients returns
to the overview. Dark mode swaps in supported dark variants. Thumbnails fill each card's width and crop vertically,
preserving the client's native layout width. Edits update previews after a short
pause, with an option to turn live updates off. Visitors can paste and edit HTML directly.
The editor uses CodeMirror's HTML language support to color tags, attributes, comments and embedded CSS, with
line numbers, undo/redo and the existing preview shortcut. Its source textarea remains synchronized for browser agents.
The sandbox also runs `lintHtml()` from `@hyper-elements/lint/html`. Line-specific lint, input-validation and
email-client findings appear beside the code as warning/error icons with hover details and suggested fixes.
Document-wide input errors appear on line 1; findings without a source line stay in the Checks drawer.
Editing clears old markers, and the next completed check replaces them. These are the packages' supported checks,
not a full HTML conformance validator.
The default recreates the MacBook Pro email from the [Unlayer Elements playground](https://examples.unlayer.com/examples/elements-playground/).
Its Hyper Elements source is `examples/email-testing/macbook-pro.tsx`; `render()` writes the editable, indented HTML
to `src/generated/email-testing.html`. After building the packages, regenerate it with
`pnpm --filter @hyper-elements/website generate:email-testing` (also included in `generate`), or add `--check`
to verify the committed HTML matches its source. Do not edit the generated HTML by hand.
All six original images and the small client logos live under `public/img/email-testing/`, with sources in its
README. Production image URLs stay in the editor; previews resolve them against the current deployment.
Validation, lint and compatibility checks are in a drawer; the docs and agent text endpoints describe library and agent use. The canvas and thumbnails hide
the preview file's explanatory header. Full previews fit the panel's width and expand to their full content height,
leaving one vertical scrollbar on the surrounding panel. Scrolling is disabled inside both iframe layers.
Clients are selected from their cards. Both views use opaque origins and allow only trusted scripts; the full
preview adds a site-written height reporter with a fresh nonce. The page reuses the playground's runtime,
worker timeouts, result validation, and isolated preview frames. The `html-previews` request calls
`renderInEmailClients(html)` directly; the input never enters the JSX compiler. HTML is not uploaded or persisted.
The package's preview may load referenced images and fonts. Both the window API and WebMCP tool update the same UI
and return diagnostics and preview metadata; `ok` describes successful generation, not a compatibility guarantee.

After a website build, run `pnpm --filter @hyper-elements/website check:email-testing`. It covers input validation,
HTML editing, live thumbnails, opening and returning from full previews, panel-only scrolling, client and dark variants, diagnostics, JSON download,
agent access, responsive layout, discovery links,
and isolation of hostile HTML. `check:playground` also runs because these pages share the runtime.

## Writing docs

A page is Markdown with a quoted `title` and `description` in its frontmatter, no H1, and links as `/docs/<slug>`. Add it to `docsNav` in `src/lib/site.ts` to put it in the sidebar, llms.txt and the previous/next links. Every code sample should run against the engine: the pages here were checked that way.

## Deploying

`dist/` is a static site: Cloudflare Pages, Vercel, Netlify or GitHub Pages all serve it with `hyperelements.dev` as the custom domain. Build command `pnpm --filter @hyper-elements/website build`, output `apps/website/dist`, on Node.js 22.23.4 or later (set the host's Node version to match).

On Vercel, only `main` deploys: `vercel.json` turns off deployments for every other branch, so pull requests get no site preview. Check a change locally with `dev` or `build` and `preview`.

## Blog articles

Write Markdown in `src/content/blog/` with `title`, `description`, `slug`, `date`, `hero` and `heroAlt` frontmatter. `slug` is the URL segment, and `date` is the editorial date (set it to the intended publication day at review). Store article images under `public/img/blog/`. The index and article pages reuse the site layout, theme and code highlighting. Article pages set their own social image and canonical URL; the sitemap includes them at build time.

Review articles and infrastructure through a pull request. Opening a PR does not publish the article; only merging to main can deploy it. Conceptual article artwork is an illustration, not an output preview.

After `build`, run `pnpm --filter @hyper-elements/website check:blog` to check all articles’ routes, metadata, internal links, anchors, images, screenshot placement, sitemap and existing text-discovery endpoints. This checks site integration only, not the reader’s sample project.
