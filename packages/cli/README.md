# @hyper-elements/cli

Preview [Hyper Elements](https://hyperelements.dev) templates with no setup.

```bash
npx hyper-elements preview welcome.tsx
```

It renders the template with your project's `@hyper-elements/react` and React, and writes `preview/welcome/`:

- `welcome.html` and `welcome.txt`: the email and its plain-text version;
- `desktop.png` (800px wide) and `phone.png` (375px wide): full-page screenshots;
- `report.txt`: every problem found.

It also checks the design (`@hyper-elements/react/check`) and prints what to fix: a `{{merge tag}}` a reader would see, a table that keeps four columns on a phone, faint text, an image without alt text, a phone number that can split across lines. Each message says what to write instead.

No tsconfig, `"type": "module"` or tsx is needed: the template is bundled with esbuild. Its default export is a component (or an element) whose root is an `Email`, `Page`, `Document` or `Canvas`:

```tsx
import { Email, Heading } from "@hyper-elements/react";

export default function Welcome({ name = "Ada" }: { name?: string }) {
  return (
    <Email>
      <Heading level={1}>Welcome, {name}</Heading>
    </Email>
  );
}
```

Props come from `--props data.json`, or from `export const previewProps = { … }` in the file.

Screenshots use the Google Chrome installed on the machine, or a Chromium installed by Playwright (`npx playwright install chromium`), or the browser at `HYPER_ELEMENTS_CHROME`. Without one, everything else still runs.

## Starter templates

```bash
npx hyper-elements new                     # lists them
npx hyper-elements new receipt order.tsx   # copies one to start from
```

## Options

- `--out <dir>`: where to write (default `preview/<name>` beside the template)
- `--props <file.json>`: the template's props
- `--no-screenshots`
- `--desktop <px>`, `--phone <px>`: the screenshot widths (800 and 375)

Exit code 1 means the template has errors or doesn't compile; warnings don't fail it.
