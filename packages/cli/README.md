# @hyper-elements/cli

Render and check [Hyper Elements](https://github.com/hyper-elements/hyper-elements) templates from the shell, with no
script of your own: an Email's HTML and plain text, a Page's HTML, and the email client checks, with stable exit codes
and JSON for agents and CI.

```bash
npx hyper-elements render emails/          # out/welcome.html, out/welcome.txt, … the folder's tree mirrored
npx hyper-elements check emails/ --json    # validate() and the email client checks; exit 1 on errors
npx hyper-elements outline emails/welcome.tsx
```

A template is a module whose default export is a component that renders an `<Email>`, a `<Page>`, a `<Document>` or a
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
| `render <files or folders…>` | Writes each template's output under `--out` (default `out/`), at its path relative to the folder holding every input: an Email's `name.html` and `name.txt`, a Page's `name.html`. A Document and a Canvas write their HTML for now (their PDF and image come in a later release). `--stdout` writes one template's HTML to stdout; `--pretty` indents it. |
| `check <files or folders…>` | Validates each template and writes nothing. Where the project has `@hyper-elements/email-clients`, its email client checks run too (`--clients gmail,outlook` picks the clients). `--rendered` also renders, for the checks only the written HTML has (Gmail's size limit). `--max-warnings N` fails the run past N warnings. |
| `outline <file>` | Prints the template laid out: each block with its width. |

A folder is searched for templates, leaving out `node_modules`, build output, and folders whose name starts with `.` or
`_` (shared parts).

## Output and exit codes

Text by default, with each template's diagnostics as `formatDiagnostics()` writes them. With `--json`, stdout holds one
JSON line per template, then a summary line, and nothing else: what templates print goes to stderr.

```json
{"version":1,"command":"check","file":"emails/welcome.tsx","input":"template","root":"Email","status":"ok","outputs":[],"diagnostics":[]}
{"version":1,"summary":{"templates":1,"errors":0,"warnings":0,"skipped":0,"late":[]},"exitCode":0}
```

- **0**: every template rendered or checked without errors.
- **1**: a template has errors, failed to load or threw, loads two copies of React, ran past `--timeout`, or the run
  passed `--max-warnings`.
- **2**: the run couldn't do what it was asked: a usage error, an unsupported runtime, no templates, Elements missing or
  outside the supported range, outputs that would collide, a template that called `process.exit`, or template code
  that threw outside a render.

## How it runs templates

The CLI loads Elements, React and email-clients the way each template does: through a small module it writes beside the
template (named `.hyper-elements-<pid>-<n>.<ext>`, deleted as soon as it's loaded), so a template's path aliases,
workspace packages and module type all apply. The template's folder must be writable. Templates run in child processes,
one per package and tsconfig, and every process a template starts without detaching it ends with its child. A React the
template loads only during its render isn't counted among the copies of React it loads.

It runs on Node.js 20.6 or later (`npx hyper-elements`, TypeScript compiled with tsx) or Bun 1.3 or later
(`bunx --bun hyper-elements`; plain `bunx` follows the command's Node shebang and runs Node). Both give the same output.
The project needs `@hyper-elements/react` 0.4.

## License

MIT
