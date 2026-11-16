---
title: "Check HTML emails in GitHub Actions without rewriting your templates"
description: "Check existing HTML emails in GitHub Actions with Hyper Elements, fail on warnings, and keep machine-readable diagnostics without changing template frameworks."
slug: "html-email-checks-github-actions"
date: 2026-11-16
hero: "/img/blog/html-email-ci-workflow.webp"
heroAlt: "An HTML email passes through CLI checks before a pull request is merged."
---

You can check an existing HTML email in GitHub Actions with `@hyper-elements/cli`: install the CLI, pass it the exported HTML file, and let its exit status fail the job. Add `--max-warnings 0` when warnings should block a change. You don’t need to rewrite the email in React or move it out of MJML, React Email, or your current builder.


This tutorial checks one committed file, `emails/receipt.html`, in an existing npm repository on GitHub.com. The result is a workflow that reports compatibility and HTML lint findings, fails when your policy requires it, and keeps JSON Lines diagnostics for review. It does not send an email or certify its appearance in real inboxes.



## How do I check an existing HTML email?


Use Node.js 20.6 or later, the CLI’s documented minimum. The workflow below selects Node.js 24 explicitly. From the repository root, install the CLI as a development dependency:


```bash
npm install -D @hyper-elements/cli
npx hyper-elements check emails/receipt.html --max-warnings 0
```


Commit the changed `package.json` and `package-lock.json`. Local installation lets CI use your reviewed dependency lockfile instead of fetching a new CLI release on every check. Update that dependency through your normal review process so local development and CI move together.


Already have exported HTML? Use it directly. Otherwise, save this deliberately flawed receipt as `emails/receipt.html`. Its “Click here” link gives us a specific, documented lint warning to repair:


```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Your Northline receipt</title>
  </head>
  <body>
    <h1>Thanks for your order</h1>
    <p>Your receipt for order NL-1042 is ready.</p>
    <p><a href="https://example.com/orders/NL-1042">Click here</a></p>
  </body>
</html>
```


Run the check command above. Hyper Elements’ [link-text rule](https://www.hyperelements.dev/docs/lint#link-text) warns about generic link labels because screen readers can list links by their words alone. HTML lint diagnostics use codes such as `lint/link-text`, with a line and column rather than a React component path.


Replace only the anchor’s words:


```html
<a href="https://example.com/orders/NL-1042">View your receipt</a>
```


Check the file again and address any remaining findings. Changing the words resolves that specific issue; it is not a claim that the destination exists, the receipt total is correct, or every inbox renders the message identically. Keep the `example.com` address in this fixture, and use your real receipt URL in production.



## What goes in the GitHub Actions workflow?


Create `.github/workflows/check-email.yml` with the following complete workflow. It checks the committed HTML file, so it needs no template-build command, browser installation, sending credentials, or React dependency.


```yaml
name: Check email HTML

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  check-email:
    runs-on: ubuntu-latest
    steps:
      - name: Check out the repository
        uses: actions/checkout@v7
        with:
          persist-credentials: false

      - name: Set up Node.js
        uses: actions/setup-node@v7
        with:
          node-version: '24'
          package-manager-cache: false

      - name: Install locked dependencies
        run: npm ci --include=dev

      - name: Check the exported email
        shell: bash
        run: |
          mkdir -p reports
          status=0
          npx hyper-elements check emails/receipt.html \
            --max-warnings 0 --json \
            > reports/email-check.jsonl || status=$?
          cat reports/email-check.jsonl
          exit "$status"

      - name: Keep the diagnostic report
        if: ${{ !cancelled() }}
        uses: actions/upload-artifact@v7
        with:
          name: email-check-diagnostics
          path: reports/email-check.jsonl
          if-no-files-found: warn
          retention-days: 7
```


<figure style="margin:0 0 28px"><img src="/img/blog/html-email-ci-reporting.png" width="1600" height="1008" loading="lazy" alt="A zero check status passes and a nonzero status fails; either path can upload available diagnostics without changing the check result." style="display:block;width:100%;height:auto;border:1px solid var(--line);border-radius:14px"><figcaption style="margin-top:10px;color:var(--text-2);font-size:13px;line-height:1.6">The diagnostic upload is a separate step. Saving a report must not hide a failed email check.</figcaption></figure>


Change `main` if your default branch has another name. The pull-request event checks proposed changes; the push event rechecks changes that land on that branch. There are no path filters to maintain while you establish the check.


[npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci) requires a lockfile consistent with `package.json`. `--include=dev` makes the CLI available even if the environment would otherwise omit development dependencies. Run this workflow from the npm project root, or adapt the paths and working directory for a nested project.


The workflow requests only repository-content read access and disables persisted checkout credentials. Don’t add sending-service secrets: checking this HTML file doesn’t require them. Use fictional order data in committed fixtures; diagnostic excerpts and retained artifacts can contain email content. The example uses GitHub-hosted Ubuntu runners, not a self-hosted runner configuration.



## Why capture the exit status before uploading the report?


GitHub Actions runs an explicitly selected Bash shell with error handling and `pipefail`. A command that fails can stop the step before later commands run. The `|| status=$?` branch records the CLI’s failure without abandoning the step; `cat` prints the report, and `exit "$status"` returns the original check result.


That distinction matters more than whether the report looks tidy. Don’t add `|| true` to the check, and don’t set `continue-on-error` just to get an artifact. Either would weaken the failure signal you added CI to obtain.


The upload step uses `!cancelled()`, so it can run after a failed check without trying to continue a canceled job. If dependency installation failed before the report existed, `if-no-files-found: warn` reports its absence; it doesn’t replace the earlier failure with a pass. The artifact expires after seven days, subject to the repository’s retention limits. GitHub documents the status-function behavior in its [expression reference](https://docs.github.com/en/actions/reference/workflows-and-actions/expressions#status-check-functions) and the artifact settings in [upload-artifact](https://github.com/actions/upload-artifact).


Saving an artifact is not guaranteed: an upload can itself fail, and an interrupted run may leave no useful report. Read the failing step first. Also, a failed workflow is not automatically a merge prohibition; configure the email-check job as a required status check in your repository’s branch protection or ruleset if that is your policy.



## How do I know the workflow is enforcing the policy?


Use the same receipt fixture to review both outcomes. In a pull request, leave the link as “Click here” and confirm that the check fails with a link-text warning. Then change it to “View your receipt,” push the repair, and inspect the next run. If other findings remain, fix those too rather than assuming this one edit should make the entire job green.


Review the artifact as well as the status: does it name the file you intended to check? Can a teammate find the offending markup from the diagnostic? This small failure-and-repair exercise checks the workflow’s wiring and makes the warning policy visible to reviewers. It is not a visual regression test. Keep future changes to the warning policy as deliberate as changes to the email itself.


## Which findings should fail the check?


The CLI documents these exit statuses. Treat any nonzero status as a failed CI check rather than assuming every failure means the email itself is invalid:


<table><thead><tr><th>Exit status</th><th>How to interpret it</th></tr></thead><tbody><tr><td><code>0</code></td><td>The command completed without errors or exceeding its warning limit.</td></tr><tr><td><code>1</code></td><td>The check found errors, exceeded the warning limit, or encountered a documented processing failure.</td></tr><tr><td><code>2</code></td><td>The command couldn’t perform the requested operation, such as a usage error or no usable input.</td></tr></tbody></table>


Lint findings are warnings or informational notes, not errors. Without a warning limit, a warning can leave the command successful. `--max-warnings 0` makes warnings fail the run; informational notes still don’t become failures merely because you chose that flag. See the [CLI exit-code reference](https://www.hyperelements.dev/docs/cli#json-and-exit-codes) for the full list.


For an existing collection of emails, decide which warnings must be fixed before making the job required. Keep any rule changes narrow and intentional. Lint configuration belongs under `hyperElements.lint` in the project’s `package.json`; don’t disable all lint just to get a green check. The [lint options](https://www.hyperelements.dev/docs/lint#options) list supported rule severities.



## How do I read the saved diagnostics?


`--json` writes one JSON line per checked input followed by a summary line. This is JSON Lines, not one JSON array: parse each nonempty line separately if you build tooling around it. Standard error remains separate, so an installation or command-launch problem may be visible in the Actions log rather than the report.


For HTML lint findings, use the diagnostic code to identify the rule, then the line, column, message and suggested fix to locate the markup. Follow the rule’s documentation link when present. Use the summary line to understand the overall result rather than treating an individual diagnostic as the whole check.


After a failed run, open its job log or download `email-check-diagnostics` from the workflow run. Reproduce the same command locally, repair the source that generates the HTML, regenerate it when necessary, and commit the updated file. Editing only an exported file is temporary if the next export restores the problem.



## Why didn’t a folder check my exported HTML?


Hyper Elements deliberately doesn’t discover HTML files when given a folder: template folders often contain generated HTML beside their sources. For existing HTML, name the file explicitly as this tutorial does, or give the documented shell pattern `emails/*.html`. Don’t replace the filename with `emails/` and assume the same inputs were checked.


If your repository generates email HTML during CI, add its existing build step before this check and point at the generated file. That build remains your generator’s responsibility. This tutorial intentionally keeps one committed file as the contract so you can establish the check without combining several framework setups.



## Does this replace Outlook or Gmail inbox testing?


No. The CLI checks documented compatibility concerns and runs the HTML lint rules; passing those checks does not prove visual correctness, delivery, personalization, or accessibility. HTML lint doesn’t check contrast, text size, or merge syntax, because it lacks the template information those checks need. Outlook conditional comments are skipped by HTML lint.


For another review layer, the [email client emulator](https://www.hyperelements.dev/docs/email-client-emulator) creates local, modeled client previews. Those are not screenshots captured from real inboxes. Keep actual client testing and a test send for the clients and content that matter to you. Browser-based preview collection is deliberately outside this basic CI job.



## Frequently asked questions


### Do I need to migrate from React Email or MJML?


No. Hyper Elements’ CLI accepts an existing `.html` or `.htm` file regardless of how it was generated. This workflow checks the output, not the generator’s component source.


### Do I need Playwright or a browser in CI?


Not for the `check` command shown here. Collecting browser-drawn preview findings is a separate workflow with additional requirements documented under [preview](https://www.hyperelements.dev/docs/cli#preview).


### Will warnings block a pull request?


`--max-warnings 0` makes warnings fail the job. To block merging, also make that job a required check in your repository settings. Informational findings are not warnings.


### Where should I start if I’m writing a new React email?


Follow [Build and validate React emails with Claude Code](https://www.hyperelements.dev/blog/react-emails-claude-code) for the authoring and repair loop, then return here to check exported HTML in CI. If the same order needs a PDF, the [Node.js invoice tutorial](https://www.hyperelements.dev/blog/node-pdf-invoices-without-chrome) covers that separate output.


Start with one representative email and a pull request that demonstrates a warning and its repair. Once reviewers understand the failure and report, apply the same explicit policy to the rest of your exported emails.
