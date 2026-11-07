# Agent benchmark

How long a coding agent takes to write a correct email with Hyper Elements, with React Email, with MJML
and as hand-written HTML, and how many tokens it spends. The results are on hyperelements.dev/docs/benchmark.

## What runs

- **Five briefs** (`briefs/*.json`): a password reset, a product launch, an order receipt, a newsletter
  and an event invite. Each gives the exact copy, links and images, and the layout: columns side by side
  on desktop and stacked on phones, a line-item table, a hover color.
- **Four kits** (`kits/`): what the agent starts with. Each has the same conventions file (CLAUDE.md)
  and the same checker. Hyper Elements' CLAUDE.md also imports its agent guide (GUIDE.md), as the
  docs tell users to set it up, so the guide's tokens count against it.
  - `he`: write `emails/email.tsx` with `@hyper-elements/react`; `node tools/render.mjs`.
  - `react-email`: write `emails/email.tsx` with `@react-email/components`; `node tools/render.mjs`.
  - `mjml`: write `emails/email.mjml` with MJML (`mjml` 5.4.1); `node tools/render.mjs`, which prints MJML's
    validation warnings. MJML's defaults are left as they are: its default font links a Google Fonts
    stylesheet, which the checker fails until the email sets its own font.
  - `html`: write `out/email.html` by hand.
- **One bar** (`lib/check.mjs`, copied into each run as `tools/check.mjs`): the same checks for every
  kit, in headless Chromium at 800px and 375px: the copy, the links, the buttons (link, color, size,
  hover), the images (loaded, alt text, size), table layout with no flex or grid, a hidden preview text,
  600px content, no sideways scroll on a phone, columns side by side on desktop and stacked on a phone,
  and line items on one line with the price on the right.
- **The agent**: Claude Code, headless (`claude -p`), the same prompt every run: "Build the email
  described in BRIEF.md, following CLAUDE.md. It's done when `node tools/check.mjs` passes." It may
  edit files and run node, tsc, ls and cat; no web, subagents or skills.

Each run gets a fresh directory and its full transcript is kept. One row per run goes to `results/`.

## Running it

```bash
npm install
HYPER_ELEMENTS_PACKAGE=/path/to/checkout/packages/react npm run setup   # until @hyper-elements/react is on npm
npm run bench -- --kits he,react-email,mjml,html --briefs all --reps 3 --model claude-sonnet-5 --concurrency 4
npm run report -- results/<stamp>.jsonl
```

`claude` must be signed in. A run costs about $0.25–$1.

## 2026-11-08 (`results/2026-11-08-sonnet.jsonl`)

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

## 2026-11-06 (`results/2026-11-06-sonnet.jsonl`)

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
