# Your own components in the Unlayer editor

A component you write once with `component()` is a tag in a template and a tool in the Unlayer editor: a block someone drags in and edits by its props, drawn by Hyper Elements. There is no second definition to keep, and no HTML to write by hand for the canvas, for web and for email.

This example is a whole email made that way. Oyen (a fictional maker of audio instruments) announces a field recorder with five components of its own: an announcement, a drawing's callouts, a spec sheet's lines, a field note and a price band.

## Run it

From the repository root, with Node.js 20+ and pnpm 9:

```bash
pnpm install
pnpm build    # builds the packages this example imports
pnpm --filter @unlayer/custom-components-in-editor-example build
pnpm --filter @unlayer/custom-components-in-editor-example preview
```

Open <http://127.0.0.1:3003/editor.html?projectId=YOUR_PROJECT_ID>. Custom tools are part of an Unlayer project's plan, so the editor draws them only for a project that has them. Click a callout, the price or a spec line: its fields are its component's props.

`build` writes to `output/`:

| File | What it is |
|------|------------|
| `email.html` | The dispatch rendered as it is, with `render()` |
| `design.json` | The same dispatch as the editor's design, from `toDesign(…, { customTools: true })`: each component is a block of its own tool |
| `tools.js` | The editor's custom JavaScript: `registerTools()` with the components, bundled |

## How it fits together

| File | What it does |
|------|--------------|
| [`src/components.tsx`](./src/components.tsx) | Oyen's components. Plain Hyper Elements: nothing in it knows about an editor |
| [`src/email.tsx`](./src/email.tsx) | The dispatch: plain blocks and the components, as tags |
| [`src/tools.ts`](./src/tools.ts) | `registerTools(unlayer, components)`: each component becomes a tool, with a field for each prop |
| [`src/design.tsx`](./src/design.tsx) | `toDesign(<Dispatch />, { customTools: true })`: the email as a design the editor opens |
| [`editor.html`](./editor.html) | Creates the editor with `customJS: [tools]` and loads the design |

To read an edited design back as a template, pass the components:

```ts
import { fromDesign } from "@hyper-elements/react/builder";
import { components } from "./src/components";

const { element, code, report } = fromDesign(edited, { displayMode: "email", components });
```

Each tool's block comes back as its component (`<oyen.Callout number={2} … />`), its values checked by its props' kinds.

## Which editor a prop gets

A prop says what its value is; the editor picks its control from that. A callout's number is a `prop.number`, and it asks for the editor's counter by name:

```tsx
number: prop.number({ label: "Number", min: 1, max: 99, integer: true, default: 1, editor: "counter" }),
```

The price asks for an editor of Oyen's own, which `src/tools.ts` registers with `unlayer.registerPropertyEditor` and names in `registerTools()`:

```tsx
price: prop.number({ label: "Price", min: 0, default: 349, editor: "currency" }),
```

```ts
registerTools(unlayer, components, { editors: ["currency"] });
```

The price is still a number, checked as one. Without that registration, it would be edited with a number's own control.

## What to know

- **Five components, on purpose.** A project's plan sets how many custom tools it has, and the editor doesn't export the blocks of a tool past that number.
- **Each component sets its own font and colors.** In the editor a component is drawn on its own, at its column's width, with no template around it.
- **The editor loads the web fonts it was created with.** `editor.html` registers Geist and Geist Mono, so the canvas draws them and what the editor exports links them.
- **Add your own.** Write a component in `src/components.tsx`, add it to `components`, and build again: it's a tool in the panel, and a tag in any template.
