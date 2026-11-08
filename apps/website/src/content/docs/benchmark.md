---
title: "Agent benchmark"
description: "A coding agent wrote the same five emails with Hyper Elements, MJML, React Email and hand-written HTML. With Hyper Elements it reached a passing email fastest and wrote the fewest tokens."
---

We gave a coding agent the same five emails to build four ways: with Hyper Elements, with MJML, with React Email, and as hand-written HTML. Each email was done when it passed the same checks. We timed how long that took and counted the tokens.

## Results

Claude Code 2.1.238 with Claude Sonnet 5 (`claude-sonnet-5`), 16 runs per approach, November 8, 2026. Every run reached a passing email.

| | Hyper Elements | MJML | Hand-written HTML | React Email |
|---|---|---|---|---|
| Median time to a passing email | **33s** | 43s | 60s | 86s |
| Median output tokens | **1,831** | 2,762 | 4,903 | 6,215 |
| Passed the checks the first time they ran | **16 of 16** | **16 of 16** | 6 of 16 | 12 of 16 |
| Median turns | 9 | 9 | 8.5 | 18 |
| Median tokens in all, context included | 594k | 527k | 501k | 1,000k |

- **Fastest.** Hyper Elements was 1.3× faster than MJML, 1.8× faster than hand-written HTML and 2.6× faster than React Email at the median, and the fastest on four of the five briefs (MJML was faster on the launch email). Within a brief it was faster in 40 of 52 pairings with MJML (one-sided Mann–Whitney, p < 0.01), 48 of 52 with HTML and 51 of 52 with React Email (p < 0.001 for each).
- **Fewest tokens written.** 1.5× fewer than MJML, 2.7× fewer than HTML and 3.4× fewer than React Email. The agent writes a short template; the engine writes the tables.
- **Right the first time.** Every Hyper Elements and MJML email passed the first time the agent ran the checks, against 6 of 16 hand-written HTML emails and 12 of 16 React Email ones.
- **Not the fewest tokens in all.** The guide is in the agent's context on every turn (cached), so the tokens in all are a little more than MJML's and hand-written HTML's, and fewer than React Email's.

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

Each run started in a fresh directory with the brief, a `CLAUDE.md` of conventions and the checker, and the same prompt: "Build the email described in BRIEF.md, following CLAUDE.md. It's done when `node tools/check.mjs` passes." The agent could edit files and run `node`, `tsc`, `ls` and `cat`, with no web access. The Hyper Elements project's `CLAUDE.md` also imported the package's guide, [as we tell you to set it up](/docs/guides/ai-agents), so its tokens count against Hyper Elements. The MJML project compiled `emails/email.mjml` with MJML's defaults.

## What it doesn't show

- One agent and one model. Other agents and models may differ.
- Short, fully specified emails. A vague brief or a long email may change the picture.
- Hyper Elements 0.3, MJML 5.4.1 and React Email components 1.0.12.

The harness, the briefs, the checks and every run's numbers are in the repository, in [`apps/website/benchmark`](https://github.com/hyper-elements/hyper-elements/tree/main/apps/website/benchmark). Run it yourself with your own agent.
