# Agent benchmark

How long a coding agent takes to make a correct email or social image with Hyper Elements and with the tools agents
reach for otherwise, and how many tokens it spends. The email and image results are on
[hyperelements.dev/docs/benchmark](https://hyperelements.dev/docs/benchmark).

Two suites, each with its own briefs, kits and checker, run by one harness (`lib/`):

- **email** (`suites/email`): Hyper Elements, React Email, MJML and hand-written HTML.
- **image** (`suites/image`): Hyper Elements' `<Canvas>`, an HTML page screenshotted by Playwright, and drawing with
  `@napi-rs/canvas`.

## How a run works

The agent is Claude Code, headless (`claude -p`), with the suite's prompt ("Build the email/image described in
BRIEF.md, following CLAUDE.md. It's done when `node tools/check.mjs` passes."). It may edit files and run node, tsc,
ls and cat; no web, subagents or skills. A kit's `kit.json` names the files the agent writes and the docs it imports;
Hyper Elements' CLAUDE.md imports its agent guide (GUIDE.md), as the docs tell users to set it up, so the guide's
tokens count against it. One row per run goes to `results/<stamp>-<suite>-<model>.jsonl`, with what made it: the
Claude Code version, the engine's commit (and whether its tree was dirty), the package versions, Node and the OS.

**Isolation (image suite).** An agent uses what it can reach: with runs side by side in the repository, agents
globbed the benchmark and copied its reference solutions and other runs' work. So each run is a directory of its own
in the system's temporary folder, with its own copy of `node_modules` (cloned, no link out: `npm run setup` copies
Hyper Elements' `dist` in), and Claude Code denies reading or editing the repository, the home folder and `/tmp`
(`--settings`, `permissions.deny`). What a rule can't stop (`node` reading a file) the audit catches
(`lib/audit.mjs`): every path a run's tool calls named outside its directory is recorded, and a run that got one is
marked `valid: false` and left out of the report (a file the run made itself after it started is its own). A
finished run is kept in `runs/<stamp>/` without its `node_modules`; `node lib/audit.mjs runs/<stamp>` audits kept
runs again. The email results below predate this: their runs weren't isolated.

Check and render runs are counted from commands that run `node tools/check.mjs` (or `tools/render.mjs`), not ones
that only read the file.

## Email suite

- **Five briefs** (`suites/email/briefs/*.json`): a password reset, a product launch, an order receipt, a newsletter
  and an event invite. Each gives the exact copy, links and images, and the layout: columns side by side on desktop
  and stacked on phones, a line-item table, a hover color.
- **Four kits** (`suites/email/kits/`):
  - `he`: write `emails/email.tsx` with `@hyper-elements/react`; `node tools/render.mjs`, which prints the email's
    problems with `formatDiagnostics()`: each with the email clients it's about, what to change and a link.
  - `he-plain`: the `he` kit (`"extends": "he"` in its kit.json), but its render tool prints each problem without its
    email clients, fix and link (`tools/print.mjs`), as 0.3.0 printed them. Not in the default kits: it's
    run beside `he` to see what those fields change.
  - `react-email`: write `emails/email.tsx` with `@react-email/components`; `node tools/render.mjs`.
  - `mjml`: write `emails/email.mjml` with MJML (`mjml` 5.4.1); `node tools/render.mjs`, which prints MJML's
    validation warnings. MJML's defaults are left as they are: its default font links a Google Fonts stylesheet,
    which the checker fails until the email sets its own font.
  - `html`: write `out/email.html` by hand.
- **One bar** (`suites/email/check.mjs`, copied into each run as `tools/check.mjs`): in headless Chromium at 800px
  and 375px: the copy, the links, the buttons (link, color, size, hover), the images (loaded, alt text, size), table
  layout with no flex or grid, a hidden preview text, 600px content, no sideways scroll on a phone, columns side by
  side on desktop and stacked on a phone, and line items on one line with the price on the right.

- **Email client warnings left** (kits whose kit.json names a `diagnostics` tool: `he`, `he-plain`): after the run,
  the harness runs `node tools/render.mjs --json` on the finished email and records, in the row's `emailClients`,
  the warnings and notes that name email clients (a WebP image classic Outlook doesn't show, phone styles some apps
  ignore) and how many of each code. The check doesn't require none: this is what the email would still get wrong in
  some app. The report gives, per kit, how many emails had none, the median left and the codes, and `he` against
  `he-plain` (one-sided Mann–Whitney: whether printing the clients, fix and link leaves fewer).

## Image suite

- **Five briefs** (`suites/image/briefs/*.json`): a blog post OG card (1200×630), a product launch card over a
  background image (1200×630), a conference banner (1500×500), a podcast episode card (1080×1080) and a quote card
  in Lora italic (1200×675). Each gives the exact copy, sizes, colors, fonts and images.
- **Three kits** (`suites/image/kits/`), each the same instructions: write `cards/render.ts(x)`, whose default export
  returns the PNG's bytes, and anything else in `cards/`:
  - `he`: a `<Canvas>` rendered with `renderImage` from `@hyper-elements/react/image` (Satori and resvg underneath);
  - `playwright`: an HTML page, written however the agent likes, screenshotted by Playwright's Chromium;
  - `canvas`: drawn with `@napi-rs/canvas` (Skia's Canvas 2D API: `fillText`, `drawImage`, paths).

  The fonts (`fonts/`: Inter regular and bold, Lora italic, and Inter regular as WOFF2) and images (`assets/`) are
  files, and there's no network (`tools/render.mjs` makes `fetch` fail, and turns it off inside Playwright's browser),
  so every kit loads them from disk.
- **One bar** (`suites/image/check/`, copied into each run's `tools/`), no browser:
  - `tools/render.mjs` (the same in every kit) runs `cards/render.ts(x)` and writes `out/card.png` and
    `out/card.trace.json`: the text drawn, its fonts and the font files given, recorded by a stand-in for the kit's
    library: Satori's input (`tools/tap.mjs`, which Hyper Elements calls), each `fillText` with the context's font
    and color (`tools/tap-canvas.mjs`), or each element's text and computed style and the files the page's
    `@font-face` rules load (`tools/tap-playwright.mjs`, at the screenshot).
  - From the trace: each text exactly (one typo fails), its font file (the same face in another format counts),
    weight, style, size and color.
  - From the pixels: the size; the background and the outer 8px; each image, found by cross-correlation with its
    colors, at its width and place, round or rounded where asked; the color around a pill or card; and the text as
    shown, read by OCR (tesseract.js, offline) on a mask of the text colors: readable, in its color, inside the safe
    margin, on no more lines than asked, aligned as asked, not over another text, and where the brief puts it.
- **The checker's own test** (`npm run selftest`, no API): every kit's reference of every brief
  (`suites/image/reference`; the Playwright kit's are the HTML in `reference/satori`) type-checks, renders and passes;
  the references with their font sizes and padding changed are read by OCR (252 of 252 texts); and 21 references
  broken on purpose each fail the check named (a typo, text in the background's color, text near an edge, the wrong
  background, size, font or color, no logo, a square avatar, a pill in the wrong color, no bold file, a font from the
  network, a page with no `@font-face`, text hidden with CSS, a PNG not written by the render…).
- **Runtime facts** (`npm run runtime`, no API): per kit, what `npm install` adds (and Playwright's browser), and
  from the references, a fresh process's import and first render, a warm render, and whether the same template gives
  the same bytes.

## Running it

```bash
npm ci
npx playwright install chromium                                 # the email checker and the image suite's Playwright kit
(cd .. && pnpm install && pnpm build)                           # the engine, built from this checkout
HYPER_ELEMENTS_PACKAGE=../packages/react npm run setup          # again after every npm ci / npm install
npm run bench -- --suite email --kits he,react-email,mjml,html --briefs all --reps 3 --model sonnet --concurrency 4
npm run bench -- --suite email --kits he,he-plain --briefs all --reps 4 --model sonnet --concurrency 4   # the warnings' new fields
npm run selftest                                                # the image checker's own test; no API
npm run bench -- --suite image --kits he,playwright,canvas --briefs all --reps 4 --model sonnet --concurrency 4
npm run report -- results/<stamp>-<suite>-sonnet.jsonl
HYPER_ELEMENTS_PACKAGE=../packages/react npm run runtime
```

`claude` must be signed in. A run costs about $0.25–$1. The image suite's fonts' and images' sources and hashes are
in `suites/image/fonts/MANIFEST.json` and `suites/image/assets/MANIFEST.json` (`node suites/image/assets/make.mjs`
draws its images again, byte for byte).

## Image: 2026-11-08 (`results/2026-11-08b-image-sonnet.jsonl`)

Claude Code 2.1.238 with Claude Sonnet 5 (`claude-sonnet-5`); Hyper Elements 0.3.0 at `d66930a1` (main), Playwright
1.60.0 (Chromium 1223), `@napi-rs/canvas` 1.0.13. 60 runs, 20 per kit (4 per brief), all passing, all valid.

| | Hyper Elements | Playwright | canvas |
|---|---|---|---|
| Median time to a passing image | **76 s** | 91 s | 125 s |
| Output tokens (median) | **5,096** | 6,846 | 9,132 |
| First check passed | **17 of 20** | 14 of 20 | 16 of 20 |
| Cost (median) | $0.60 | **$0.55** | $0.66 |

- Against canvas, Hyper Elements was faster in 57 of 80 pairings within a brief, 1.65× by the medians (one-sided
  Mann–Whitney p = 0.003), and wrote fewer output tokens (p = 0.002).
- Against Playwright, it was faster in 40 of 80 pairings (p = 0.35): about as fast. By brief (Hyper Elements /
  Playwright): podcast 56 s / 92 s, quote 85 s / 99 s, event 94 s / 99 s, blog 80 s / 73 s, launch 165 s / 100 s.
  On launch, agents lost time on a pill as wide as its words: a `Text` in a `Column` takes the column's width, and
  `Text` has no `alignSelf` (a `Row` with the `Text` at `flex: "none"` does it).
- Three canvas runs were first marked invalid for "reaching" `/inter/i.test`, `/letter` and `/round`: regular
  expressions in a `node -e` script, not paths. The audit now skips a name that doesn't exist where neither its
  folder does or its folder is the root, and each row says it was re-audited (`auditNote`).

**A first batch** (`results/2026-11-08-pilot-image-sonnet.jsonl` and `results/2026-11-08-image-sonnet.jsonl`, 60
runs, all passing) gave Hyper Elements 106 s, Playwright 87 s and canvas 139 s. Its Hyper Elements kit, alone, asked
for two files (`cards/card.tsx` and a `cards/render.tsx` importing it), and agents' `import Card from "./card.tsx"`
failed `tsc` (TS5097) in 11 of its 20 runs. The kits were then given the same instructions and every kit's tsconfig
`allowImportingTsExtensions`, and all three were run again: the results above.

Runtime facts (`results/2026-11-08-image-runtime.json`, Apple M5 Max, Node 25.9.0; medians over the five briefs):

| | Hyper Elements | Playwright | canvas |
|---|---|---|---|
| Install | 29.0 MB, 42 packages | 22.3 MB, 8 packages, **and a 200 MB browser** | 29.9 MB, 12 packages |
| Native binary | resvg | none (a browser) | Skia |
| Cold start (import + first render) | **126 ms** | 382 ms | 190 ms |
| Warm render | 19 ms | 201 ms | **17 ms** |
| Same bytes every render | yes | yes | yes |

The Playwright reference launches its browser for every render, as its render script is written; an app that keeps
the browser open renders faster.

## Email: 2026-11-08 (`results/2026-11-08-sonnet.jsonl`)

Claude Code 2.1.238 with Claude Sonnet 5 (`claude-sonnet-5`), Hyper Elements 0.3.0 (this
repository at 23e3b258, `@hyper-elements/react` with `GUIDE.md`), MJML 5.4.1, React Email components 1.0.12.
All four kits ran in one interleaved batch: 16 runs per kit, three per brief plus one pilot launch email
each. Every run reached the bar.

| | Hyper Elements | MJML | Hand-written HTML | React Email |
|---|---|---|---|---|
| Median time to a passing email | **33s** | 43s | 60s | 86s |
| Median output tokens | **1,831** | 2,762 | 4,903 | 6,215 |
| Passed the check the first time it ran | **16 of 16** | **16 of 16** | 6 of 16 | 12 of 16 |
| Median turns | 9 | 9 | 8.5 | 18 |
| Median tokens in all (context included) | 594k | 527k | 501k | 1,000k |
| Median cost | $0.44 | $0.40 | $0.43 | $0.64 |

| Median seconds per brief | Hyper Elements | MJML | Hand-written HTML | React Email |
|---|---|---|---|---|
| Password reset | **25s** | 29s | 36s | 36s |
| Product launch | 44s | **37s** | 76s | 109s |
| Order receipt | **42s** | 49s | 67s | 92s |
| Newsletter | **32s** | 45s | 55s | 74s |
| Event invite | **35s** | 56s | 56s | 138s |

- Hyper Elements was the fastest at the median: 1.3× faster than MJML, 1.8× faster than hand-written HTML
  and 2.6× faster than React Email. It was the fastest on four of the five briefs; MJML was faster on the
  launch email. Within a brief, it was faster in 40 of 52 pairings with MJML (Mann–Whitney, one-sided,
  p < 0.01), 48 of 52 with HTML and 51 of 52 with React Email (p < 0.001 for each).
- It writes the fewest output tokens: 1.5× fewer than MJML, 2.7× fewer than HTML, 3.4× fewer than React
  Email. It doesn't use the fewest tokens in all: its guide is in the context of every turn (cached), so
  it costs about what MJML and HTML cost, and less than React Email.
- MJML's and Hyper Elements' first check passed every time. Hand-written HTML's first checks failed on
  columns not side by side (3), links missing (3), and scrolling sideways on a phone (4); React Email's on
  scrolling sideways on a phone (4).
- The event invite's hover color is MJML's slowest brief: it has no attribute for one, so each agent
  worked out which element of `mj-button`'s markup to style from `<mj-style>`, by reading its source in
  node_modules, compiling test snippets, or reading the compiled HTML.
- An earlier batch of MJML alone the same day (`results/2026-11-08-mjml-sonnet.jsonl`, 16 runs) had the same
  median, 43s, and also passed its first check 16 of 16 times.

"Passed the check the first time it ran" is counted differently from 2026-11-06. Until this batch,
`bench.mjs` took the first Bash command that *mentioned* `tools/check.mjs` as the first check, so an agent
that read the checker (`cat tools/check.mjs`) before running it was counted as failing its first check, and
`checkRuns` counted the read. It now counts only `node tools/check.mjs`. The rows of the MJML-only batch
were recounted from their transcripts.

## Email: 2026-11-06 (`results/2026-11-06-sonnet.jsonl`)

Claude Code 2.1.238 with Claude Sonnet 5 (`claude-sonnet-5`), Hyper Elements 0.3, React Email
components 1.0.12. These runs imported the components from `@hyper-elements/react/primitives`, and the guide
was `PRIMITIVES.md`: the engine's names before it was merged. The kit now uses `@hyper-elements/react` and `GUIDE.md`. 16 runs per kit: three per brief, plus one pilot launch email each. Every run reached
the bar.

| | Hyper Elements | Hand-written HTML | React Email |
|---|---|---|---|
| Median time to a passing email | **35s** | 65s | 76s |
| Median output tokens | **2,346** | 5,676 | 5,745 |
| Passed the check on the first run (miscounted, see 2026-11-08) | **11 of 16** | 4 of 16 | 5 of 16 |
| Median turns | 8 | 9 | 17.5 |
| Median tokens in all (context included) | 402k | 375k | 723k |
| Median cost | $0.35 | $0.34 | $0.50 |

- Hyper Elements was the fastest on every brief: 1.9× faster than hand-written HTML and 2.2× faster
  than React Email at the median. Within a brief, it was faster in 48 of 52 pairings with HTML and 47 of
  52 with React Email (Mann–Whitney, one-sided, p < 0.001 for each).
- It writes 2.4× fewer output tokens. It doesn't use fewer tokens in all than hand-written HTML: its
  guide is in the context of every turn (cached), so the cost is the same as HTML's.

Not measured: other agents and models, and longer or less specified emails. The agent could read the checker's source, the same for
every kit. In the first batch the receipt's line-item check failed correct tables (adjacent cells
touch); it was fixed and the receipt run again, and the first batch's receipts aren't in the results.
