# Your own components in the Unlayer editor

A component you write once with `component()` is a tag in a template and a tool in the Unlayer editor: a block someone drags in and edits by its props, drawn by Hyper Elements. There is no second definition to keep, and no HTML to write by hand for the canvas, for web and for email.

This example has two sets of components, each a whole email:

- **A shop's tools** (`src/shop`): five tools a shop reuses. A **product** that can be filled from the store, a **testimonial** with its stars, a **coupon**, an **order tracker**, and a **ticket** whose barcode is drawn from its code.
- **Oyen's dispatch** (`src/oyen`): the parts one brand's launch email repeats (an announcement, a drawing's callouts, a spec sheet's lines, a field note, a price band).

## Run it

From the repository root, with Node.js 20+ and pnpm 9:

```bash
pnpm install
pnpm build    # builds the packages this example imports
pnpm --filter @hyper-elements/example-custom-components-in-editor build
pnpm --filter @hyper-elements/example-custom-components-in-editor preview
```

Open <http://127.0.0.1:3003/editor.html?projectId=YOUR_PROJECT_ID>. Custom tools are part of an Unlayer project's plan, so the editor draws them only for a project that has them. The links at the top switch between the two sets.

Things to try in the shop's set:

- Click the product, then pick another one under **From the store**: its photo, name, text, price and link fill in together, and each stays editable.
- Click the order tracker and change **Where it is**: the line, the words and what's still to come redraw.
- Click the ticket and type another **Code**: its barcode is drawn again from it.

`build` writes to `output/<set>/`:

| File | What it is |
|------|------------|
| `email.html` | The email rendered as it is, with `render()` |
| `design.json` | The same email as the editor's design, from `toDesign(…, { customTools: true })`: each component is a block of its own tool |
| `tools.js` | The editor's custom JavaScript: `registerTools()` with the components, bundled |

## How it fits together

| File | What it does |
|------|--------------|
| [`src/shop/components.tsx`](./src/shop/components.tsx) | The components. Plain Hyper Elements: nothing in it knows about an editor |
| [`src/shop/email.tsx`](./src/shop/email.tsx) | An email: plain blocks and the components, as tags |
| [`src/shop/tools.ts`](./src/shop/tools.ts) | `registerTools(unlayer, components, …)`: each component becomes a tool, with a field for each prop. Also the store picker |
| [`src/shop/design.tsx`](./src/shop/design.tsx) | `toDesign(<Weekly />, { customTools: true })`: the email as a design the editor opens |
| [`src/properties.ts`](./src/properties.ts) | A property of the example's own, for a price, as the components know it: its name, the helper it's made on, its options |
| [`src/currency.ts`](./src/currency.ts) | That property's control in the Unlayer editor, typed from its definition |
| [`editor.html`](./editor.html) | Creates the editor with `customJS: [tools]` and loads the design |

`src/oyen` has the same four files.

To read an edited design back as a template, pass the components:

```ts
import { fromDesign } from "@hyper-elements/react/builder";
import { components } from "./src/shop/components";

const { element, code, report } = fromDesign(edited, { displayMode: "email", components });
```

Each tool's block comes back as its component (`<shop.Ticket event="Lumen Conf 2027" … />`), its values checked by its props' kinds.

## Which editor a prop gets

A prop says what its value is; the editor picks its control from that. A testimonial's stars are a `prop.number`, and it asks for the editor's counter by name:

```tsx
rating: prop.number({ label: "Stars", min: 1, max: 5, integer: true, default: 5, editor: "counter" }),
```

A price is a property of the example's own. `src/properties.ts` defines it, as data: its name, the helper of `prop` it's made on, and its options, each made with a helper too.

```ts
export const currency = defineProperty({
  name: "example.currency",
  base: prop.number,
  options: { step: prop.number({ min: 0, default: 0.01 }) },
});
```

Called, it's the prop. It takes what `prop.number` takes, and its own options:

```tsx
price: currency({ label: "Price", min: 0, default: 49, step: 1 }),
```

`src/currency.ts` writes its control as the editor takes one (its markup, and what it does once that's in the page), and `registerTools()` registers it under the property's name:

```ts
registerTools(unlayer, components, { editors: { [currency.name]: currencyField } });
```

The control is given the price as the number it is, with the prop's label and the property's options, and gives a number back. The price is still checked as a number, from 0: that's its base's, whatever edits it. Without the control, it would be edited with a number's own field.

## A field that fills several props

The product's **From the store** field isn't a prop of the component: the card doesn't need to know where its name and price came from. It's the tool's, in the editor. `src/shop/tools.ts` registers a picker and passes two of the editor's own settings for that tool:

```ts
registerTools(unlayer, components, {
  tools: {
    "shop.ProductCard": {
      properties: { product: { label: "From the store", widget: "store_picker" } },
      transformer: (values, source) => (source.name === "product" ? { ...values, ...fromStore(source.value) } : values),
    },
  },
});
```

## A barcode with no image

The ticket's barcode is Code 39, drawn as the component's own columns from the code it's given: no image, no service, and it redraws as the code is typed. `bars()` in `src/shop/components.tsx` is the whole of it.

## What to know

- **Five components a set, on purpose.** A project's plan sets how many custom tools it has, and the editor doesn't export the blocks of a tool past that number.
- **Each component sets its own font and colors.** In the editor a component is drawn on its own, at its column's width, with no template around it.
- **Oyen's set uses web fonts.** `editor.html` registers Geist and Geist Mono, so the canvas draws them and what the editor exports links them.
- **Add your own.** Write a component in a set's `components.tsx`, add it to `components`, and build again: it's a tool in the panel, and a tag in any template.
