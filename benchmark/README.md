# Agent benchmark

How long a coding agent takes to make a correct email or social image with Hyper Elements and with the tools agents
reach for otherwise, and how many tokens it spends. The email and image results are on
[hyperelements.dev/docs/benchmark](https://hyperelements.dev/docs/benchmark).

Three suites, each with its own briefs, kits and checker, run by one harness (`lib/`):

- **email** (`suites/email`): Hyper Elements, React Email, MJML and hand-written HTML.
- **image** (`suites/image`): Hyper Elements' `<Canvas>`, an HTML page screenshotted by Playwright, and drawing with
  `@napi-rs/canvas`.
- **skill** (`suites/skill`): evals of Hyper Elements' agent guide and skill: this checkout's against the last
  release's, with Hyper Elements only. Its results aren't published.

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
(`--settings`, `permissions.deny`). Those rules cover Claude Code's file tools, not what a `node` command opens. The
audit (`lib/audit.mjs`) reads the paths a run's tool calls name: every path named outside its directory is recorded,
and a run that got one is marked `valid: false` and left out of the report (a file the run made itself after it
started is its own). A path a command builds at run time (`os.homedir()` in a `node -e`) names nothing, so the audit
can't see it; the skill suite runs Bash in Claude Code's OS-level sandbox for that. A
finished run is kept in `runs/<stamp>/` without its `node_modules`; `node lib/audit.mjs runs/<stamp>` audits kept
runs again. The email results below predate this: their runs weren't isolated.

Check and render runs are counted from commands that run `node tools/check.mjs` (or `tools/render.mjs`), not ones
that only read the file.

## Email suite

- **Five briefs** (`suites/email/briefs/*.json`): a password reset, a product launch, an order receipt, a newsletter
  and an event invite. Each gives the exact copy, links and images, and the layout: columns side by side on desktop
  and stacked on phones, a line-item table, a hover color.
- **Four kits** (`suites/email/kits/`), and two variants of `he`:
  - `he`: write `emails/email.tsx` with `@hyper-elements/react`; `node tools/render.mjs`, which prints the email's
    problems with `formatDiagnostics()`: each with the email clients it's about, what to change and a link.
  - `he-plain`: the `he` kit (`"extends": "he"` in its kit.json), but its render tool prints each problem without its
    email clients, fix and link (`tools/print.mjs`), as 0.3.0 printed them. Not in the default kits: it's
    run beside `he` to see what those fields change.
  - `he-cli`: the `he` kit (`"extends": "he"`), but its render tool is the command line, `@hyper-elements/cli`, in
    place of the esbuild script: `npx hyper-elements check emails/email.tsx --rendered --json`, then, where that
    passes, `npx hyper-elements render emails/email.tsx --json` (`tools/render.mjs` runs both and prints the problems
    with `formatDiagnostics()`, as the CLI's text output does, and their JSON on the last line with `--json`). The agent
    still runs `node tools/render.mjs`: its allowed commands don't include `npx hyper-elements`. `npm run setup`
    installs the CLI from the same checkout as the engine (`packages/cli`, built), and its kit.json `needs` it, so a
    batch without it stops before any session. Not in the default kits: it's run beside `he` to see whether checking
    and rendering with the CLI is any worse for an agent than the script, before the agent guide names the CLI.
  - `react-email`: write `emails/email.tsx` with `@react-email/components`; `node tools/render.mjs`.
  - `mjml`: write `emails/email.mjml` with MJML (`mjml` 5.4.1); `node tools/render.mjs`, which prints MJML's
    validation warnings. MJML's defaults are left as they are: its default font links a Google Fonts stylesheet,
    which the checker fails until the email sets its own font.
  - `html`: write `out/email.html` by hand.
- **One bar** (`suites/email/check.mjs`, copied into each run as `tools/check.mjs`): in headless Chromium at 800px
  and 375px: the copy, the links, the buttons (link, color, size, hover), the images (loaded, alt text, size), table
  layout with no flex or grid, a hidden preview text, 600px content, no sideways scroll on a phone, columns side by
  side on desktop and stacked on a phone, and line items on one line with the price on the right.

- **Email client warnings left** (kits whose kit.json names a `diagnostics` tool: `he`, `he-plain`, `he-cli`): after the run,
  the harness runs `node tools/render.mjs --json` on the finished email and records, in the row's `emailClients`,
  the warnings and notes that name email clients (from Elements 0.4, where `@hyper-elements/email-clients` is installed
  beside the engine: the render tool passes its plugin) (a WebP image classic Outlook doesn't show, phone styles some apps
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

## Skill suite

Whether a change to the guide (GUIDE.md), the skill (SKILL.md) or the diagnostics agents read makes agents write
templates better or worse. Not a merge gate: a maintainer runs it when those change, before a release, and when a new
model ships.

- **Ten tasks** (`suites/skill/briefs/`, the `core` group of `suite.json`), across the four roots: the email suite's
  event invite and receipt; a weekly digest with phone styles, a `Menu` and `Social` (`digest`); a landing page with
  `Section` bands, a `Grid` and its own phone width (`landing`); an A4 invoice as a PDF (`invoice`); the image suite's
  launch card (`launch`); a change to a written email (`change`); a page from a Tailwind mockup (`tailwind`); a report
  built from an array, with merge tags and its plain text (`report`); and a welcome email with no exact copy
  (`welcome`). A brief's `run` replaces the suite's prompt, render command, checker, folders, specs or sources, adds
  tools, gives start files, and can limit the kits it runs in or name a probe (`requires`) an engine must pass.
- **Six kits** (`suites/skill/kits/`), each an engine and docs:

  | Kit | Engine | Docs | How they're given |
  |---|---|---|---|
  | `candidate` | this checkout | its own | GUIDE.md imported from CLAUDE.md |
  | `release` | the last release (v0.3.0) | its own | the same |
  | `release-docs` | this checkout | the last release's | the same |
  | `negative` | this checkout | `23e3b258`'s (the props the guide no longer teaches) | the same |
  | `skill` | this checkout | its SKILL.md | at `.claude/skills/hyper-elements/`, the Skill tool allowed |
  | `none` | this checkout | none | REFERENCE.md and the types are still in `node_modules` |

  CLAUDE.md is the same conventions in every kit (`suites/skill/conventions/<root>.md`), with the guide's import where
  the kit has one. An engine is a build installed under a name (`engines/<name>/`), and a docs set the guide, reference
  and skill at a git ref (`docs-sets/<name>/`); each row records its own.
- **The checks** (`suites/skill/check*.mjs`, copied into each run's `tools/`): `check.mjs` runs each check the brief's
  spec names. `email` is the email suite's checker; `page` its copy, links, buttons, images and columns on a Page at
  each width the spec lists; `styles` computed styles, hover styles, the space between two texts, what's hidden on
  phones and bands spanning the window, in Chromium; `pdf` reads the PDF with pdf.js (pages, A4, the copy in order,
  the table's header and right-aligned totals, the fonts embedded); `change` compares a changed email with its start's
  render (nothing else changed, and the asked changes hold); `text` the plain-text output; `open` a brief with no
  exact copy (no warnings, the components asked for, fits a phone, images load).
- **Grades from evidence the agent can't write** (`lib/grade.mjs`):
  - **The grading pass** decides `pass`. The run's sources are copied into a fresh directory, everything but `out/` and
    `.cache/` is made read-only, the render runs, and only after it exits are the checker and its specs copied in and
    run. A template can't replace a checker that isn't there yet. A checker that exits without its JSON result is a
    `harnessError`, counted and left out, not a failed task. The session's own last check is kept as `sessionCheck`.
  - **Tamper hashes**: the run's `tools/`, `docs/`, fonts, images, `.claude/`, the engine and its conventions, hashed
    before and after the session. Any change is `tampered`.
  - **A static scan** of the sources, with TypeScript's parser: a child process, a worker, a write through `fs` or a
    hold on the process (`process.on`, `exit`) is `tampered`. What a template reads that the replay doesn't pin (the
    clock through `performance`, `process`, `crypto`, a Node module, a path, a stack) is `readsUnpinned`: context, not a
    mark. It reads calls and imports, never text, so copy that says "rm" passes.
- **Attempts recomputed, not read** (`lib/replay.mjs`). After the session, its directory is moved aside and a pristine
  run made at the same path; the session is replayed there in order, and every Bash call's `tsc`, render and check
  steps run again. Each event must be replayable:
  - a Write or Edit of a source, or a Read, Glob or Grep inside the run
  - a tool that changes no file (TodoWrite, Skill)
  - a Bash command Claude Code refused to run (an error with no exit code and no result line), which changed nothing.
    One that did run, taken for refused, leaves the replay's files different, and the next step's input hash or the
    final sources catch it.
  - a Bash call whose steps, joined by `&&`, `||` and `;`, are each one of these:
    - **a tool:** `npx tsc --noEmit`, the render command or `node tools/check.mjs`, run again; or one piped with
      `2>&1` into `tail` (`node tools/render.mjs 2>&1 | tail -20`), or `tsc` into `head`, whose replay goes
      through the same filter before it's compared. The attempt still takes the tool's own exit code and its whole
      output. A filter that hides the step's result line is the cutoff.
    - **a read** of paths in the run: `ls`, `cat`, `wc`, `head`, `tail`, `cut`, `file`, `grep` (with `--include`),
      `sed -n <lines>p` or `find` with tests only (`-maxdepth`, `-type`, `-name`), or a pipeline of reads
      (`cat src/template.tsx | head -50`), maybe with `>/dev/null`; or an `echo`, which may print `$?`
      (`echo "exit $?"`). It runs in the replay too, whose files are the session's at that point, so its status
      decides what runs next as it did in the session (`node tools/check.mjs; cat out/email.txt`). Its output isn't
      compared; the call's status is, read-only calls included. Any other pipeline with a tool in it is the cutoff.
    - **a `cd`** to a folder in the run. Claude Code keeps the folder for the calls after it, and so does the replay:
      reads and file steps there take their paths from it, and a tool run from anywhere but the run is the cutoff.
    - **a file step**, made in the replay too, in order with the tools: a `mkdir -p` in the run; `cat > <source>`
      fed by a quoted heredoc (the lines after its end are more steps, as if joined by `;`); or a `sed -i` of plain
      substitutions (`s|a|b|g`, no flag that writes) on sources, in this platform's form (`sed -i ''` on macOS).
      On macOS, GNU's form `sed -i '<script>' <file>` is recorded as a failure that changes nothing, without
      running it: BSD sed takes the script as the backup suffix and the path as the script, and always fails.

  `2>&1` and `2>/dev/null` are allowed after any step, and a trailing `;`. Leading assignments of plain values
  (`P=/the/run; sed -n 1,20p $P/docs/REFERENCE.md`) are expanded where the command has no single quote or heredoc. In
  double quotes a `$` that can't start an expansion is itself (`grep "^### Table$\|^### Row$"`). A step is judged
  when it runs, so one that a `&&` or `||` skipped isn't the cutoff. The replay makes Claude Code's own
  `.claude/.cc-writes` where the session's folder has it. The first event that isn't replayable is the *cutoff*:
  nothing from it on is verified. The render tools and checker print a result line signed with a secret only the session's environment holds
  (`[render] ok <out> in=<inputs> mac=…`); a call's lines must be the replay's, line for line. A call whose results
  differ is a `mismatch`: cut off there, and listed for a maintainer, never `tampered` by itself. The render tools pin
  what a template could read differently in a replay: the clock (`Date`, `Intl.DateTimeFormat`) at the batch's start,
  and `Math.random`, seeded. From the verified calls: the first try (every attempt up to the first render had no
  error), the fix rounds, and the mistakes (`prop/unknown mobile`, `ts/TS2322 mobile`), each verified only where its
  attempts are before the cutoff.
- **The sandbox.** The skill suite's sessions run Bash in Claude Code's OS-level sandbox: writes only in the run and
  never to its guarded files, no reads of the repository or the home folder (node's install and Playwright's browsers
  aside), no network, no retry outside it. Playwright's browsers live at the run root (`node lib/setup.mjs --browsers`),
  each session's `TMPDIR` is in its run, and the checkers' Chromium runs single-process (on macOS its other processes
  need a Mach service the sandbox refuses). `NODE_USE_SYSTEM_CA` (and `--use-system-ca`) is dropped from sessions: in
  the sandbox node prints an error for each certificate it can't read, which agents then filter with a pipe. The run root and `/tmp` stay readable: a command must read its run's
  parent folders, and Claude Code's Bash tool writes to `/tmp/claude-<uid>`. So a sandboxed command can read another
  run in progress; the audit catches one that names it. Before every batch, **a sandbox probe** (one session, or `npm
  run preflight -- --sandbox`) must pass the checker and `tsc` in the sandbox, and fail to read the home folder,
  to run a command chained to the checker outside it, and to change `tools/check.mjs`.
- **The preflight** (`npm run preflight`, no API; it also runs before every batch): every brief's reference solution
  (`suites/skill/reference/`) renders and passes its checks; each engine renders its own guide's example and each start
  file; each `requires` probe decides the tasks an engine can't run (v0.3.0 has no `breakpoints`, so `landing` is N/A
  for `release`); and the change task's baseline is measured. `--skill-discovery` is the smoke run (one session, about
  $0.25): the `skill` kit's session must list `hyper-elements` among its skills.
- **The report** (`npm run report -- results/<stamp>-skill-<model>.jsonl`, `lib/report-skill.mjs`) reads the batch's
  `plan.json` beside the results. Per arm (kit, with its engine's version and commit):
  - **First try valid**, over the rows whose first try the replay verified, with Wilson's interval for description.
    Each arm shows how many rows that is; runs with no render are counted on their own line.
  - **All 3 runs valid**, for each task with three or more verified first tries (the chance three of its runs all are).
  - **Final pass**, from the grading pass.
  - **Median fix rounds**, with the runs that never rendered cleanly.
  - **Warnings left**, and how many runs opened REFERENCE.md or the engine's `dist`.
  - **Medians** of turns, tokens, cost and seconds.
  - **Left out**: tampered, harness errors, and runs that reached outside their directory.

  Below that table come:
  - **The comparison.** Each arm against `release` (or `candidate`; `--compare <base>,<other>` picks the pair): each
    task's first-try rate in one arm minus the other, averaged over the tasks both ran, with a 95% bootstrap
    interval over tasks. A difference is called only when the interval excludes zero, and it's "inconclusive:
    coverage" when either arm has under 80% of those rows verified. Tasks left out of it are named, with the reason
    (N/A for an engine, incomplete, no verified first try).
  - **The per-task table**, with each task's difference.
  - **The mistakes**, by how many runs made each, per arm and task.
  - **What cut the replays off**, per arm.
  - **The rows left out**, and why.
  - **The mismatch list**: each row's call, both result lines, the output, what the template read unpinned, and its
    transcript.

  A maintainer who finds a mismatch was tampering marks it in `results/<stamp>-skill-<model>.marks.json`
  (`{ "candidate change #2": { "tampered": "ran a swapped render tool" } }`), which leaves the row out. A batch the
  cost cap stopped, or one with rows missing against its plan, is reported as partial. Rates then cover only the
  task and arm cells whose planned runs all finished.

  When the batch has the `negative` and `candidate` arms, the report adds the negative control's verdict, with these
  checks:
  - the negative arm's first try is 30 points lower
  - half its runs made a mistake naming `mobile` or `hover`
  - the candidate passed every run

  It's "inconclusive: coverage" when either arm has under 80% of its planned runs verified.
- **Its own tests** (`npm test`, no API): kits, engines, docs sets and briefs; every reference renders, type-checks
  and passes; and 20 references broken on purpose each fail the check named (no breakpoints, each Tailwind class
  left out, a Letter or two-page PDF, totals on the left, Helvetica in place of Inter, another color changed, a word
  changed, an item missing from the plain text, an image with no size, no `MergeTag`…). The replay is tested on
  simulated sessions, and the report on fixtures:
  - the paired interval's known answer, which changes when one arm's tasks are relabelled though its rate doesn't
  - the 80% coverage line
  - partial batches
  - N/A tasks
  - the rows left out
  - the mismatch list and a maintainer's mark
  - each of the negative control's verdicts

```bash
(cd .. && pnpm install && pnpm build)
HYPER_ELEMENTS_PACKAGE=../packages/react node lib/setup.mjs --as candidate   # again after any change to the packages
git worktree add /tmp/he-v0.3.0 v0.3.0 && (cd /tmp/he-v0.3.0 && pnpm install --frozen-lockfile)
HYPER_ELEMENTS_PACKAGE=/tmp/he-v0.3.0/packages/react node lib/setup.mjs --as release && git worktree remove /tmp/he-v0.3.0
node lib/setup.mjs --docs-from v0.3.0 --as release
node lib/setup.mjs --docs-from 23e3b258 --as negative
node lib/setup.mjs --browsers                                       # Chromium at the run root, for the sandbox
npm test
npm run bench -- --suite skill --kits candidate,release --briefs core --reps 3 --model claude-sonnet-5-5 --concurrency 4 --max-cost-usd 60
npm run report -- results/<stamp>-skill-claude-sonnet-5-5.jsonl
```

Each row keeps its session's secret once the session is over, so `node lib/rereplay.mjs <results>.jsonl` replays a
finished batch again after a change to the replay: each kept run (`runs/<stamp>/`) is put back at the session's
path, replayed with the batch's clock, and the row's replay figures rewritten. It needs no model.

`--dry-run` lists the jobs and estimates their cost; `--max-cost-usd` starts no new job once the finished runs cost
that much (the results file then ends with `{"partial":true}`); `results/<stamp>-skill-<model>.plan.json` is the
planned matrix. `--resume` with the batch's `--stamp` and `--model` finishes a batch that stopped: the kits, tasks,
reps and clock come from its plan.json, only the jobs without a row run, and `--max-cost-usd` counts the whole batch.
It refuses when the job list, the N/A tasks, task 7's baseline, Claude Code's version or a kit's engine or docs
differ from the batch's. The stops it resumed from move from the results file to plan.json's `resumes`.
`BENCH_RUN_ROOT` sets where runs are made (the system's temporary folder by default; never under
`/tmp`, which the sessions are denied). A candidate engine whose checkout changed since `--as candidate` is refused.

### Skill: the first baseline, 2026-11-09 (`results/2026-11-09-baseline-skill-claude-sonnet-5-5.jsonl`)

`candidate` (this checkout at `493e649c`) against `release` (v0.3.0), the 10 core tasks, three runs each with Sonnet:
57 runs (`landing` is N/A for release, which has no `breakpoints`), $45.29, plus $0.73 for the sandbox probe.
**No clear difference, and the tasks are near saturation for Sonnet.**

| | candidate | release |
|---|---|---|
| First try valid | 28/29 (97%) | 26/27 (96%) |
| Verified first tries | 29/30 | 27/27 |
| All 3 runs valid | 9/9 tasks | 8/9 tasks |
| Final pass | 30/30 | 27/27 |
| Median fix rounds | 0 | 0 |
| Opened REFERENCE.md | 15/30 | 9/27 |
| Median turns, output tokens, cost | 8, 2,490, $0.79 | 8, 2,438, $0.78 |
| Mistakes | `build/syntax` ×1 (`report`) | `style/unknown padding` and `ts/TS2353 padding` ×1 (`welcome`) |

The difference averaged over the 9 shared tasks is −2 points (−17, +11). Two first tries in 56 failed:
- **candidate `report`:** a heredoc that wrote `<RowstackOnMobile`, a JSX syntax error.
- **release `welcome`:** `padding` on the Email root, though both guides list it among their common mistakes.

Every other first try was valid. The tasks count as saturated when first-try validity is 95% or more on every task,
for Sonnet and Haiku both; then the check stops being worth running until harder tasks are added. For Sonnet that holds, apart from a typo. For Haiku it doesn't (below). The
candidate opened REFERENCE.md in half its runs, more than the release did (9 of 27), though every first try was
valid either way.

Replayed again offline after two changes to the replay, which moved coverage from 90% and 81% to 97% and 100%:
- read steps now run in the replay. Every `report` run checked its plain text with `…; cat out/email.txt`, whose
  status the replay had treated as unknown.
- `tsc | head` is accepted, and BSD sed's misread `-i` form is recorded as the failure it is.

### Skill: the Haiku baseline, 2026-11-09 (`results/2026-11-09-baseline-haiku-skill-claude-haiku-5-5.jsonl`)

The same 57 runs with Haiku 5.5. The cost cap stopped it after 19 runs, and `--resume` finished the other 38 as the
same batch (same clock, engines and plan). $93.81 as Claude Code 2.1.238 counts it, which prices Haiku 5.5 at about
twice Sonnet 5.5. **No clear difference, and the tasks aren't saturated for Haiku.**

| | candidate | release |
|---|---|---|
| First try valid | 25/28 (89%) | 23/24 (96%) |
| Verified first tries | 28/30 | 24/27 |
| All 3 runs valid | 6/8 tasks | 5/6 tasks |
| Final pass | 30/30 | 27/27 |
| Median fix rounds | 0 | 0 |
| Opened REFERENCE.md | 19/30 | 16/27 |
| Median turns, output tokens, cost | 9, 5,589, $1.60 | 9, 6,116, $1.67 |

The difference averaged over the 9 shared tasks is −6 points (−20, +7). Four first tries failed. Three were fixed in
one round, and the replay of `landing` stopped before its fix:
- **candidate `receipt`:** `borderTop`, a Divider's style, on another block.
- **candidate `landing`:** `previewText`, an Email's prop, on the Page.
- **candidate `welcome`:** an `alignSelf` the phone styles don't take.
- **release `launch`:** an Image's `width` and `height` as props, not in `src` or `style`.

Below 95% on a task: candidate `receipt` (1 of 2 verified), `landing` and `welcome` (2 of 3), and release `launch`
(2 of 3). So the tasks aren't saturated. Haiku made more of the guide's kind of mistake than Sonnet
did, and opened REFERENCE.md more often. Every run passed in the end.

Haiku looks around with commands Sonnet didn't use, so the replay grew to cover them before the batch was rated:
`file`, `find`, `cut`, `grep --include`, `echo "… $?"`, `>/dev/null`, `P=<path>; … $P`, and `cd`, whose folder
Claude Code keeps from call to call. A `mkdir -p` in a guarded folder fails in the replay as the sandbox fails it.
Replaying the other batches again changed none of their figures.

### Skill: the negative control, 2026-11-09 (`results/2026-11-09b-negative-skill-claude-sonnet-5-5.jsonl`)

The `negative` arm (the guide at `23e3b258`, which teaches `mobile` and `hover` as props) against `candidate`, on
`digest`, `landing`, `change` and `tailwind`, five runs each with Sonnet: 40 runs, $33.67, plus $0.73 for the sandbox
probe. **Passed.** The pipeline sees a regression whose cause is known.

| | candidate | negative |
|---|---|---|
| First try valid | 20/20 | 0/20 |
| Verified first tries | 20/20 | 20/20 |
| Final pass | 20/20 | 20/20 |
| Runs with a mistake naming `mobile` or `hover` | 0 | 20 |
| Median fix rounds | 0 | 1 |
| Opened REFERENCE.md | 13/20 | 15/20 |
| Median turns, output tokens, cost | 8, 2,012, $0.77 | 11, 3,235, $0.90 |

The difference averaged over the four tasks is −100 points, with a bootstrap interval of (−100, −100). The negative
arm's mistakes were `prop/unknown mobile` in 20 runs and `prop/unknown hover` in 15, plus `ts/TS2322 mobile` in 4 and
`ts/TS2322 hover` in 2, from the runs that type-checked first. Each run then fixed them, so final pass doesn't move:
a guide's regression shows in the first try, the fix rounds and the cost, not in whether the agent gets there.

Getting there took two batches and changes to the replay. The rules were tested before they were used, and none of
the changes can verify a step on evidence it doesn't have:
- **The first batch** (`results/2026-11-09-negative-skill-claude-sonnet-5-5.jsonl`, $33.38) was inconclusive on
  coverage: 4 and 6 of 20 first tries verified. Sonnet opens with `ls … 2>&1; cat … | head -50`, writes the template
  with a heredoc, and pipes each tool into `tail`. The replay then refused all three. It now takes them (above).
- **The second batch's sandbox probe** failed before any job: Sonnet declined to append to `tools/check.mjs`, which
  CLAUDE.md and the prompt both told it not to change. The probe's prompt now says the refusal is what's tested.
- **The second batch** first gave 12 and 9 of 20. 19 of its cutoffs were commands Claude Code itself refused to run
  ("Contains brace with quote character (expansion obfuscation)", for a heredoc of JSX), which the replay had run
  anyway. A refused command is now a call that changed nothing. `lib/rereplay.mjs` replayed the batch with that
  rule, with no new sessions: 20 and 20 of 20.

What's left cuts off only after the first try: a `python3` heredoc that edits the template (9 negative runs) and a
render piped into `head` (1). These leave fix rounds unverified for half the negative arm.

## Running it

```bash
npm ci
npx playwright install chromium                                 # the email checker and the image suite's Playwright kit
(cd .. && pnpm install && pnpm build)                           # the engine, built from this checkout
HYPER_ELEMENTS_PACKAGE=../packages/react npm run setup          # again after every npm ci / npm install (also installs packages/cli)
npm run bench -- --suite email --kits he,react-email,mjml,html --briefs all --reps 3 --model sonnet --concurrency 4
npm run bench -- --suite email --kits he,he-plain --briefs all --reps 4 --model sonnet --concurrency 4   # the warnings' new fields
npm run bench -- --suite email --kits he,he-cli --briefs all --reps 4 --model sonnet --concurrency 4     # the script against the CLI
npm run selftest                                                # the image checker's own test; no API
npm run bench -- --suite image --kits he,playwright,canvas --briefs all --reps 4 --model sonnet --concurrency 4
npm run report -- results/<stamp>-<suite>-sonnet.jsonl
npm run charts                                                  # the README's and the website's two charts; no API
HYPER_ELEMENTS_PACKAGE=../packages/react npm run runtime
```

`npm run charts` (`lib/charts.mjs`) draws `apps/website/public/img/hyper-elements-agent-benchmark.svg` and
`hyper-elements-image-benchmark.svg`, which the repository's README and the website's benchmark page show, from the
batches named at the top of the file. To chart a new batch, change its `source` there, and the labels and notes that
describe its results.

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
