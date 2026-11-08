---
title: "Agent benchmark"
description: "Compare time to a passing email or image, output tokens and first-check passes across Hyper Elements and other approaches, using the same briefs and checks."
---

We gave a coding agent five email briefs and five image briefs to build with Hyper Elements and other approaches. Each result was done when it passed the same checks for its brief. We timed how long that took and counted the output tokens.

[Email results](#results) · [Image results](#image-results)

The email comparison uses Hyper Elements, MJML, React Email and hand-written HTML. The image comparison uses Hyper Elements, Playwright and Canvas 2D.

## Results

16 runs per approach. Every run reached a passing email.

[![Agent benchmark comparing Hyper Elements, MJML, hand-written HTML, and React Email on median time, output tokens, and first-check passes. Full results follow in the table.](/img/hyper-elements-agent-benchmark.svg)](/img/hyper-elements-agent-benchmark.svg "Open the benchmark chart at full size")

| | Hyper Elements | MJML | Hand-written HTML | React Email |
|---|---|---|---|---|
| Median time to a passing email | **33s** | 43s | 60s | 86s |
| Median output tokens | **1,831** | 2,762 | 4,903 | 6,215 |
| Passed the checks the first time they ran | **16 of 16** | **16 of 16** | 6 of 16 | 12 of 16 |
| Median turns | 9 | 9 | 8.5 | 18 |

- **Fastest.** Hyper Elements was 1.3× faster than MJML, 1.8× faster than hand-written HTML and 2.6× faster than React Email at the median, and the fastest on four of the five briefs (MJML was faster on the launch email). Within a brief it was faster in 40 of 52 pairings with MJML (one-sided Mann–Whitney, p < 0.01), 48 of 52 with HTML and 51 of 52 with React Email (p < 0.001 for each).
- **Fewest output tokens.** 1.5× fewer than MJML, 2.7× fewer than HTML and 3.4× fewer than React Email. The agent writes a short template; the engine writes the tables.
- **Right the first time.** Every Hyper Elements and MJML email passed the first time the agent ran the checks, against 6 of 16 hand-written HTML emails and 12 of 16 React Email ones.

## The emails

Five briefs, each with the exact copy, links and images, and its layout:

| Brief | What makes it hard |
|---|---|
| Password reset | A sized logo, a button, a preview text |
| Product launch | A hero image, three feature columns that stack on phones |
| Order receipt | Line items with the price on the right, two address columns |
| Newsletter | Two stories, each an image beside text, stacked on phones |
| Event invite | Three detail columns, a button with a hover color |

## The checks

Every approach was held to the same checks, run in headless Chromium at 800px and at 375px wide:

- the copy, the links and the preview text (present, and hidden);
- each button's link, color, size and hover color;
- each image loaded, with alt text, at its size;
- a table layout with no flex or grid, content 600px wide, and no sideways scroll on a phone;
- columns side by side on desktop and stacked on a phone, and line items on one line.

## How it ran

Each run started in a fresh directory with the brief, a `CLAUDE.md` of conventions and the checker, and the same prompt: "Build the email described in BRIEF.md, following CLAUDE.md. It's done when `node tools/check.mjs` passes." The agent could edit files and run `node`, `tsc`, `ls` and `cat`, with no web access. The Hyper Elements project's `CLAUDE.md` also imported the package's guide, [as we tell you to set it up](/docs/guides/ai-agents). The MJML project compiled `emails/email.mjml` with MJML's defaults.

## What it doesn't show

- One agent and one model. Other agents and models may differ.
- Short, fully specified emails. A vague brief or a long email may change the picture.
- Hyper Elements 0.3, MJML 5.4.1 and React Email components 1.0.12.

## Image results

Five briefs, four runs per brief per approach: **60 valid, isolated runs**, all of which reached a passing image.

[![Image agent benchmark comparing Hyper Elements, Playwright and Canvas 2D on median time, output tokens and first-check passes. Full results follow in the table.](/img/hyper-elements-image-benchmark.svg)](/img/hyper-elements-image-benchmark.svg "Open the image benchmark chart at full size")

| | Hyper Elements | Playwright | Canvas 2D |
|---|---|---|---|
| Median time to a passing image | **76s** | 91s | 125s |
| Median output tokens | **5,096** | 6,846 | 9,132 |
| Passed the checks the first time they ran | **17 of 20** | 14 of 20 | 16 of 20 |

- **Against Canvas 2D:** 1.65× faster and 1.8× fewer output tokens at the median. Hyper Elements was faster in 57 of 80 pairings within a brief (one-sided Mann–Whitney, p = 0.003); the output-token comparison also favored Hyper Elements (p = 0.002).
- **Against Playwright:** a lower overall median, but no clear speed advantage within briefs (40 of 80 pairings, p = 0.35). Playwright was faster on the blog and launch cards; Hyper Elements was faster on the podcast, quote and event briefs.
- **First-check passes:** 17 of 20 with Hyper Elements, 14 of 20 with Playwright and 16 of 20 with Canvas 2D. Every run eventually passed.

### The images

Each brief specifies the exact copy, dimensions, colors, fonts and images. All approaches use the same local fonts and image files, with no network access.

| Brief | Output | What it checks |
|---|---|---|
| Blog post OG card | 1200 × 630 | Title, author and logo placement |
| Product launch card | 1200 × 630 | Background image, headline and pill |
| Conference banner | 1500 × 500 | Wide layout, event details and safe margins |
| Podcast episode card | 1080 × 1080 | Square layout and rounded artwork |
| Quote card | 1200 × 675 | Lora italic, attribution and text wrapping |

### Image checks and setup

Each approach received the same instructions: write a renderer that returns PNG bytes. Hyper Elements used `Canvas` and `renderImage()` (Satori and resvg); Playwright took a Chromium screenshot of HTML; Canvas 2D drew with `@napi-rs/canvas`.

The shared checker reads a rendering trace to verify exact text, font files, weight, style, size and color. It also checks the PNG's dimensions, background and image placement, and uses offline OCR to check readable text, safe margins, wrapping, alignment and overlaps. Each run starts in an isolated directory; an audit rejects runs that reach outside it.

These results use Hyper Elements 0.3.0, Playwright 1.60.0 and `@napi-rs/canvas` 1.0.13. They measure one agent and model on five fully specified images. They measure the agent's work through a passing result, including repairs, rather than render speed alone.

The chart uses the [final 60-run batch](https://github.com/hyper-elements/hyper-elements/blob/main/apps/website/benchmark/results/2026-11-08b-image-sonnet.jsonl). It excludes the earlier batch, which was rerun after the kit instructions and TypeScript import settings were made consistent. See the [image benchmark notes](https://github.com/hyper-elements/hyper-elements/tree/main/apps/website/benchmark#image-2026-11-08-results2026-11-08b-image-sonnetjsonl) for the per-brief results and rerun details.

The harness, the briefs, the checks and every run's numbers are in the repository, in [`apps/website/benchmark`](https://github.com/hyper-elements/hyper-elements/tree/main/apps/website/benchmark). Run it yourself with your own agent.
