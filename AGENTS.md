# AGENTS.md: Hyper Elements

Guidance for contributors and coding agents working in this repository. `CONTRIBUTING.md` covers setup and the
pull request process; `packages/core/README.md` explains the writers and how to add a component.

## What this project is

A pnpm monorepo of React components that render to email-safe HTML (tables for Outlook and Gmail), responsive web
HTML, print HTML, PDFs and images. A template is written once in JSX; its root decides the output.

## Commands

```bash
pnpm install          # Install all dependencies
pnpm build            # Build the packages in packages/ (core, then react, then migrate)
pnpm test             # Run every package's unit tests (Vitest)
pnpm test:coverage    # The same, with coverage
```

Per package:

```bash
cd packages/react && pnpm test -- --watch                 # Watch mode
cd packages/react && pnpm storybook                       # Storybook dev server
pnpm --filter @hyper-elements/react typecheck             # Type contract (also core's and migrate's `typecheck`)
UPDATE_REFERENCE=1 pnpm --filter @hyper-elements/react test reference   # Rewrite GUIDE.md, REFERENCE.md and the skill
pnpm --filter @hyper-elements/website generate            # Re-render the website's examples (needs `pnpm build`)
```

Local development uses the Node version in `.nvmrc`; CI runs Node 20.

## Layout

| Path | Package | Published | Purpose |
|------|---------|-----------|---------|
| `packages/react` | `@hyper-elements/react` | Yes | The components and `render()` (main entry); the builder adapter (`/builder`); a `Document` as a PDF with react-pdf (`/pdf`: `renderPdf()`) and a `Canvas` as PNG or SVG with Satori and resvg (`/image`: `renderImage()`). The PDF and image engines are optional peer dependencies, imported only by their own entries: `dist/primitives.js` imports neither. |
| `packages/migrate` | `@hyper-elements/migrate` | Yes | The `npx @hyper-elements/migrate` CLI: converts React Email templates (`src/react-email/`, API at `@hyper-elements/migrate/react-email`) and Unlayer Elements templates (`--from unlayer-elements`: the command in `src/legacy/`, the codemod in `src/convert/elements/`, API at `@hyper-elements/migrate/elements`), checks each against its original and writes a report; `compare` checks a template migrated by hand. What the converters share is in `src/convert/` (the Elements tree, the report, the TSX printer, the content check). Fidelity benchmark in `bench/`, results in `FIDELITY.md`. |
| `packages/core` | `@unlayer-internal/elements-core` | No (bundled into react) | The template tree (internal), component definitions, value kinds, validation, custom components, layout, and the writers: `src/writers/` (web HTML, email HTML, print HTML, plain text), `src/pdf/` and `src/image/` (a Document or Canvas as data to draw, with one adapter file per engine; entries `./pdf` and `./image`). Framework-neutral apart from those two. |
| `apps/website` | `@hyper-elements/website` | No | hyperelements.dev, an Astro site. Its previews are real output from `scripts/generate.mjs`, committed; see `apps/website/README.md`. `apps/website/benchmark/` is the agent benchmark. |
| `examples/` | | No | `demo` (`@unlayer/elements-demo`, the showcase app), `content-workflows` (email, JSON and PDF recipes; tested in CI), `react-email-in-editor`, `nextjs-app-router` |
| `skills/hyper-elements/SKILL.md` | | | The agent skill for writing templates, generated from the component definitions like `GUIDE.md` |
| `tests/` | | No | Consumer apps that install the packed package (see Testing) |

## Template structure

```
Email / Page / Document / Canvas   (the root: which output render() writes)
  └─ Section                       (a band across the window, optional)
      └─ Row                       (its Columns side by side, stacked on phones)
          └─ Column                (its children stacked)
              └─ Heading / Text / Button / Image / …   (text runs inside: Span, Link, LineBreak, MergeTag)
```

A root, a `Section` and a `Column` stack what they hold. Styles go in `style` (typed; a number is px), phone styles
in its `mobile` block and hover styles in its `hover` block: `style={{ padding: 24, mobile: { padding: 16 } }}`. The
conditions are one list in `packages/core/src/conditions.ts`, each with its support per output. A Page's phone width is
its `breakpoints={{ mobile }}` (480px where it isn't set); an Email's is its width + 20px. There are no margins: space
between blocks is the parent's `gap`. Every
component and prop is listed in `packages/react/GUIDE.md` and `REFERENCE.md`, which `src/primitives/reference.ts`
writes from the definitions. Don't edit them by hand.

## Components

Components aren't hand-written. Each is a definition in `packages/core/src/components.ts` (props, styles, children,
targets, support per output, editors), and `packages/react/src/primitives/components.tsx` makes a React component of
each, so its prop types come from the same definition that validates them. `component()`
(`packages/react/src/primitives/custom.tsx`) makes a template's own component from them.

## Rendering pipeline

```
JSX
  → one React render collects the template (packages/react/src/primitives/collect.tsx): each component records its
    props and renders markers around its children; React renders everything else (user components, hooks, Context,
    Fragments)
  → packages/core validates it (expanding custom components) and lays it out (each block's width)
  → the writers in packages/core/src/writers write the root's output: email, page or print HTML, and plain text
```

- `render()` is async and rejects with an `ElementsError` listing the template's problems. `validate()` checks
  without rendering, `outline()` prints the laid-out template. A component that is async or suspends is an error
  (`jsx/async`).
- The collecting render uses a react-dom module that isn't currently rendering (`src/utils/server-renderer.ts`), so
  an app's own server render can render a template and keep calling hooks afterwards.
- The stack of collecting renders and the render counter behind each render's nonce are shared by every copy of
  Elements in a process through `Symbol.for` (`src/utils/collect.ts`), not React context, so rendering works in
  Server Components.

## Dependencies

- The published package has no dependencies. React and react-dom are peers; react-pdf, Satori and resvg are optional
  peers; `packages/core` is bundled in (tsup's `noExternal`).
- Don't add `@unlayer/exporters` back. HTML comes from `packages/core/src/writers` and each builder tool's defaults
  from `packages/react/src/builder/tool-defaults.ts`. CI fails if a bundle imports it.

## Key files

| File | Purpose |
|------|---------|
| `packages/react/src/primitives/index.ts` | The main entry: the components, `component()`, `render()`, `validate()`, `outline()`, `prepare()` |
| `packages/core/src/components.ts` | Component definitions |
| `packages/core/src/writers/{email,page}/` | One writer per component per output (`Button.tsx`, `Row.tsx`, …), in a JSX that writes strings (`packages/core/src/writers/jsx.ts`, no React); each output's document shell is its `index.tsx` |
| `packages/core/src/resolve.ts` | Layout: the width of every block, which every output reads |
| `packages/react/src/utils/` | The collecting render: `collect.ts`, `server-renderer.ts`, `render-scope.ts` |
| `packages/react/src/builder/` | `/builder`. `toDesign()` writes a template as the Unlayer builder's design JSON (`raise.ts` and `tools.ts` build rows, columns and blocks; `design.ts` writes them over each tool's defaults, matching what Unlayer Elements 0.2's `renderToJson()` wrote). `fromDesign()` reads one back (`read.ts`, `rows.ts`, `blocks.ts`, `read-values.ts`, `read-runs.ts`, `lexical.ts`). It imports only its own files, the main entry's and React (`imports.test.ts`). `manifest.ts` lists every hidden property (a style or prop with no field in its tool) and the builder's own keys; a test holds `toDesign()` to it. |
| `packages/react/src/builder/tool-defaults.ts` | Each tool's default values and the design's schema version, in the editor's key order |

## Testing

Unit tests are Vitest files next to the code (`name.test.ts(x)`), plus `packages/react/test/` and
`packages/*/test/`. Notable suites:

- **Components**: `packages/react/src/primitives/` (`template`, `custom`, `content`, `reference` tests);
  `types.test-d.tsx` is the type contract that `pnpm typecheck` checks.
- **Generated docs**: `reference.test.tsx` fails if `GUIDE.md`, `REFERENCE.md` or `skills/hyper-elements/SKILL.md`
  differ from what the definitions write, or if the README's template is out of date.
- **Support per output**: `packages/core/test/writers/support.test.ts`. Every style and prop declares how each
  output shows it, must change the output or give a diagnostic (nothing dropped silently), and every declared limit
  is reported by `validate()`.
- **Hostile inputs**: `src/regression/hostile-input.test.tsx`. Markup in every user-facing value, in every root,
  must add no element or attribute (including inside Outlook's conditional comments), and the builder's design no
  markup where the builder reads HTML.
- **Render isolation**: `src/regression/render-isolation.test.tsx`. No render leaks into the next, the same input
  gives the same output, and a render reads no random numbers or the date (Next.js Cache Components fail a build on
  one).
- **Renders inside renders**: `src/utils/nested-renders.test.tsx`, `src/regression/edge-cases.test.tsx`,
  `src/regression/client-render.test.tsx`, `src/utils/react-server-react.test.tsx`; `src/regression/node-exit.test.ts`
  checks the built entries exit Node on React 18 and 19, load only react-dom/server, and use no `import.meta` or
  computed `require`.
- **Node environment**: `packages/react/src/node-import.test.ts`. The main entry and `/builder` import and render with
  no browser API, and each entry's types resolve under every `moduleResolution`.
- **PDF and image**: `packages/react/test/pdf/` and `test/image/` run in Node (the PDF read back with pdf.js, the
  image's size and bytes, determinism, diagnostics, one engine import per file). `pnpm --filter @hyper-elements/react
  test:browser` runs `test/*/browser/`: each PDF line starts within a point of Chromium's layout of the same HTML,
  and the image matches Chromium's drawing pixel by pixel, edges aside.
- **Consumer apps** (`tests/`, install the packed package): `nextjs-integration` (Next.js 15, Turbopack; a route
  handler, a Server Component and an edge route, checked by `verify.mjs`), `next14-integration` (Next.js 14,
  React 18), `next16-integration` (Next.js 16 with Cache Components, prerendered at build), `jest-integration`
  (Jest 30's jsdom environment, React 19).

Browser gates (need `pnpm build` and `playwright install chromium`):

- **Browser E2E** (`pnpm --filter @hyper-elements/react test:e2e`, `scripts/browser-e2e.mjs`): renders an Email, a
  Page and a Document of the same content from `dist/primitives.js` and checks fourteen things in Chromium, listed at
  the top of the script (zero `<p>` margins, one `<body>`, stacking on phones, hover, RTL, a computed-style baseline,
  overflow, preheader, accessibility, image sizes, CSS parsing, print, row padding, phone settings, locked blocks).
  Includes a negative control. Regenerate the baseline on purpose with `UPDATE_E2E_BASELINE=1 pnpm test:e2e`.
- **Browser runtime** (`test:browser-runtime`): bundles the entries and renders inside Chromium with no `process`
  global.
- **Layout** (`pnpm --filter @unlayer-internal/elements-core test:browser`, `packages/core/test/browser/`): every
  box's width in Chromium equals the resolver's, as a Page and as an Email (also with its `<style>` removed, as
  Gmail sometimes does), and Rows stack and hidden content hides at phone width.
- **Storybook smoke** (`test-storybook`, or `test-storybook:ci` against the static build): every story paints with no
  console or page errors. Storybook bundles from `src/`.
- **Storybook visual drift** (`test:visual`, after `pnpm build-storybook`): computed styles and text of every story
  at desktop and phone widths against `scripts/storybook-visual-baseline.json`. Regenerate with
  `UPDATE_VISUAL_BASELINE=1 pnpm test:visual`.
- **CSP** (`test:csp`, `scripts/csp-probe.mjs`): imports and renders `dist/primitives.js` and `dist/builder.js` under
  `--disallow-code-generation-from-strings`. Fails if the package evaluates a string.
- **Migration fidelity** (`pnpm --filter @hyper-elements/migrate test:fidelity`, `bench/smoke.ts`): converts
  `test/react-email/fixtures` both ways (codemod and runtime) and compares them with their React Email originals in
  Chromium at 700px and 375px, offline. Fails on lost or added words, links or images, words at another size on
  desktop, or moved words on desktop (and on phones for the fixtures in `PHONE_EXACT`).
- **Migration differential** (`test:differential`): mutates documents with fixed seeds and requires the check to
  fail every pair Chromium shows differently. A false pass is committed as a fixture under
  `test/react-email/differential/`, which the unit tests replay.

The full migration benchmark (`pnpm --filter @hyper-elements/migrate bench`) runs a local, uncommitted 106-template
corpus; results are in `packages/migrate/FIDELITY.md`.

### The migration content check

`packages/migrate/src/convert/cascade.ts` (tests in `test/convert/cascade.test.ts`) reads both documents with a small
CSS cascade and compares each word's size, weight, italics, case, underline, color, background and link target, at
desktop width, at 375px, at any wider breakpoint either side uses (`widerScreens`) and in dark mode where either side
has a `prefers-color-scheme: dark` rule. `geometry.ts` places each word at desktop width without a browser; a word
more than `MOVED_PX` (120px) away fails.

It fails closed:

- A property, visibility or position known on one side only is `unverified`, naming the rule that caused it, and
  the check fails. Unknown on both sides for the same reason (markup kept as it was) passes; a position unknown on
  both sides doesn't.
- CSS it doesn't model is carried as each word's `look` (`StyledDocument.look`): any property not in `MODELED` or
  `INERT` that changes something. Both sides must carry the same. `INERT` lists, with reasons, what can't change the
  words; a property in neither list is in doubt.
- `unmodeled()` in `geometry.ts` makes layouts it doesn't place unknown (grid, multicol, absolute or fixed position,
  wrapping flex, vertical writing, and others).

`checkFails` in `verify.ts` says whether the check found anything. The CLI's policy: `contentProblems()` (words,
links or images lost or added on any screen, preview text shown in the email, blocks the editor wouldn't get,
flipped boolean props that fail, content the original shows or hides by its props that the codemod drops, and
words added or hidden by CSS the check doesn't read) marks a template `✗` and exits 2. `lookProblems()` (styles,
positions, the look, what it can't read, phone styles applied at another breakpoint than Elements' 480px) lists it
as "looks different". Every template is written either way; `--strict` refuses to write one with any difference
(`--force` overrides).

## CI gates

`.github/workflows/test.yml` runs four jobs on pull requests to `main` (changes only under `apps/` skip it):

- **Tests**: `pnpm build`; typechecks of react, core and migrate; bundle budgets (`dist/primitives.js` 270,000 bytes,
  `dist/builder.js` 434,000 bytes, unminified ESM; raise one on purpose and say what grew); no bundle imports
  `@unlayer/exporters`; unit tests with coverage; the CSP gate.
- **Codemod**: `@hyper-elements/migrate`'s tests.
- **Storybook**: smoke test and visual drift.
- **Browser**: the content-workflows example's typecheck and tests; the demo app builds; browser runtime; browser
  E2E; the layout gate; PDF and image against Chromium; migration fidelity; migration differential; the Next.js 15,
  14 and 16 and Jest 30 consumer apps.

## Review bar for the migration tool

The tool's goal is an editable Unlayer template with the same content, not pixel parity: every template is written,
content that differs is flagged (`✗`, exit 2), and how it looks is listed ("looks different"). These block a merge
of the converter, the check or the CLI (`packages/migrate`), and of Elements changes made for them:

1. **Elements regressions**: code that rendered with the last release gives a reader something else (words, links,
   images, layout, plain text) or another design, and the change isn't a documented difference.
2. **Content the check misses**: it passes a migration whose content a reader gets differently: a word, link, image
   or alt text lost, added or out of order, or shown where the original hides it (or the reverse), on desktop,
   phones, wider screens or in dark mode.
3. **Broken or destructive writes**: the CLI changes a file it wasn't asked to, or one git can't restore (`--write`
   refuses those unless `--allow-dirty`), or writes a migrated template that doesn't compile where the original did.
4. **Wrong exit codes**: a run that skipped a real template, failed, or checked nothing exits `0`.

Not blockers: how a migration looks (a look difference the check misses is a gap worth fixing), a template the
converter can't map (it's kept as HTML that renders as before), a false fail, polish. Each blocker fix comes with a
test that fails without it. A false pass found by `test:differential` is committed as a fixture it replays.

## Common gotchas

- Styles go in `style={{ … }}`, never as props, and a number is px. There are no margins; use the parent's `gap`.
- An `Image` takes its file's size, `src={{ src, width, height }}`; `style.width` is the size shown.
- `render()` is async (`await render(element)`); `validate()`, `outline()`, `toDesign()` and `fromDesign()` aren't.
- Text goes in `Heading` or `Text`. Markup outside an `Html` block is an error (`jsx/markup`), and so is a component
  that's async or suspends (`jsx/async`).
- `packages/core` is private and bundled into react through tsup's `noExternal`; it's never installed on its own.
- `GUIDE.md`, `REFERENCE.md`, `skills/hyper-elements/SKILL.md` and the website's `src/generated/` are generated.
  Change the source and regenerate.
