---
title: "Visual editing"
description: "Turn a template into design JSON for Unlayer's builder with toDesign(), and read an edited design back as a template with fromDesign()."
---

You or an agent writes the template in code. Someone else changes the copy in a visual editor. You don't maintain two versions, and you don't hand-build design JSON.

`@hyper-elements/react/builder` connects your templates to Unlayer's builder, the drag-and-drop email and page editor:

- `toDesign(element)` writes a template as the builder's design JSON, for its `loadDesign()`.
- `fromDesign(design, options)` reads a design back as a template: an element to render, and its JSX source.

Rendering needs no Unlayer account or API key. The builder is Unlayer's product, with its own project setup.

## Template to design

```tsx
import { mkdir, writeFile } from "node:fs/promises";
import { toDesign } from "@hyper-elements/react/builder";
import { Email, Text } from "@hyper-elements/react";

const { design, report } = toDesign(
  <Email width={600}>
    <Text>Welcome to your new workspace.</Text>
  </Email>
);
for (const line of report) console.warn(line);
await mkdir("output", { recursive: true });
await writeFile("output/design.json", JSON.stringify(design, null, 2));
```

`design` is a serializable object with `body`, `counters` and `schemaVersion`. It holds design structure, not HTML, and no Elements data. Keep the schema version and counters it writes.

`toDesign()` is synchronous. It takes an `Email`, a `Page` or a `Document`. A `Canvas` has no design. It renders the template once with React, as `render()` does, so hooks, Context, Fragments and your own components work, at the root too.

## The report

`report` lists what the builder can't hold as it is, one line each, with the path to the block. It's empty when everything maps to a builder tool. A `Table`, for example:

```text
root.children[1]: a Table isn't a tool of the builder's: it's an HTML block of its own markup in the builder (it can be moved, not edited)
```

Read the report before you promise an editor user that a block is editable.

## What the builder holds

The builder holds what its tools can. Two things happen to the rest:

- **Hidden properties.** A style or prop a tool has no field for is a hidden property of that tool. It's kept in the design under its own name and drawn by Elements, but the builder shows no control for it yet.
- **HTML blocks.** What no tool shows (a `Layer`, an `Svg`, a `Table`, a box nested in a column, your own `component()`) goes in as an HTML block of its rendered markup. An editor user can move it, not edit it. The report names each one. Your own components can be tools of the builder instead: see [Your own components as tools](#your-own-components-as-tools).

Two smaller details: a line height goes into the builder's field as a whole percentage, as browsers draw it, so `24px` at 13px becomes `185%`, a twentieth of a pixel taller there. The builder has no page numbers yet, so a `PageNumber` goes in as its token, which the editor's PDF prints as it is. The report says so.

## Load it in the builder

Create the editor, load the design when it's ready, and export when the user is done:

```html
<div id="editor" style="height: 80vh"></div>
<script src="https://editor.unlayer.com/embed.js"></script>
<script>
  const editor = unlayer.createEditor({
    id: "editor",
    displayMode: "email",
    // Add your projectId and allowed domain for your deployed integration.
  });
  editor.addEventListener("editor:ready", async () => {
    const response = await fetch("./output/design.json");
    editor.loadDesign(await response.json());
  });
  function save() {
    editor.exportHtml(({ design, html }) => {
      // Store `design` in your application. Load it next time to keep the edits.
    });
  }
</script>
```

Match the editor's `displayMode` to the template's root: `email` for an `Email`, `web` for a `Page`, `document` for a `Document`. Which tools and features the editor offers depends on its version and your project's configuration. Unlayer's docs cover [installing the editor](https://docs.unlayer.com/builder/installation) and [loading and saving designs](https://docs.unlayer.com/builder/load-and-save-designs).

> **Warning:** Once an editor user has changed a design, store their latest JSON and load that. Regenerating the design from your React source and reloading it overwrites their changes. Keep the template source and the saved designs as separate records.

## Design back to template

```tsx
import { readFile } from "node:fs/promises";
import { fromDesign } from "@hyper-elements/react/builder";
import { render } from "@hyper-elements/react";

const saved = JSON.parse(await readFile("edited.design.json", "utf8"));
const { element, code, report } = fromDesign(saved, { displayMode: "email" });
const { html, text } = await render(element);
```

- `element` renders the design. `render(element)` gives HTML and a plain-text body that match the edits, ready to [send](/docs/guides/sending).
- `code` is the same template as JSX in the new components.
- `report` lists what the template can't hold.

Pass the `displayMode` the design was made in: `email` gives an `Email`, `web` a `Page`, `document` a `Document`. Without one, a design with a header, a footer or a page break becomes a `Document`, any other an `Email`. `name` sets the component's name in `code`. `fromDesign()` reads designs made by `toDesign()`, edited in the builder, or made there from scratch. The builder's own HTML blocks come back as `Html` blocks.

### What comes back

The design as it stands, with its sample values. A design holds content and settings, not code, so the original's props, loops, conditions, hooks and event handlers don't come back.

What the builder can't arrange comes back with the same look, but flatter:

- a `Section` around several `Row`s comes back as a `Section` each;
- a box's padding comes back on its blocks;
- a `Grid` comes back as `Row`s of `Column`s.

The space between blocks comes back as padding too. A `Column` with `gap: 16` comes back like this, drawn the same:

```tsx
<Column style={{ padding: 32, backgroundColor: "#ffffff" }}>
  <Heading style={{ fontSize: 24 }}>{"Welcome, "}<MergeTag name="first_name" /></Heading>
  <Text style={{ padding: [16, 0, 0, 0] }}>Your Pro workspace is ready.</Text>
</Column>
```

### Untrusted designs: `toSafeHtml`

A design's markup comes back as it is. If your designs can hold content you don't trust, pass your sanitizer as `toSafeHtml`, a function from an HTML string to a safe one. Every builder HTML block's markup, and every text's before it's read, goes through it:

```tsx
const { element } = fromDesign(saved, { displayMode: "email", toSafeHtml });
```

## Your own components as tools

A component you made with [`component()`](/docs/custom-components) can be a tool of the builder: a block an editor user drags in and edits by its props, drawn by Elements. You write it once. There's no separate tool to write, and no HTML to write by hand for the canvas, for web and for email.

```tsx
import { Text, component, prop } from "@hyper-elements/react";

export const Callout = component({
  type: "acme.Callout",
  label: "Callout",
  props: {
    number: prop.number({ label: "Number", min: 1, integer: true, default: 1 }),
    title: prop.text({ label: "Title", required: true }),
    color: prop.color({ label: "Disc", default: "#FF5B1F" }),
  },
  render: ({ number, title, color }) => <Text style={{ color }}>{`${number}. ${title}`}</Text>,
});
```

Three calls connect it, all from `@hyper-elements/react/builder`:

1. **Register the tools**, in the builder's custom JavaScript (its `customJS`), where `unlayer.registerTool` is:

   ```ts
   import { registerTools } from "@hyper-elements/react/builder";

   const names = registerTools(unlayer, [Callout]); // ["acme_callout"]
   ```

   Each component becomes one tool. Its name is the component's type in the builder's words (`acme.Callout` is `acme_callout`): `registerTools()` returns the names, and `toolName(Callout)` gives one. Its label is the component's, and it has a field for each prop. A block dragged in from the panel starts with each prop's `default`; a prop with none starts unset.

2. **Write the design with them**: `toDesign(element, { customTools: true })` writes each of your components as its tool's block, its props the block's values, where it would otherwise be an HTML block.

3. **Read it back with them**: `fromDesign(design, { components: [Callout] })` reads each of those blocks back as the component, its values checked by its props' kinds. Its code writes the component by the name its type ends with (`<Callout … />`), and lists each one's type at the top, to import from where you define it. Two of your components with the same name, or one named as a component the code imports, are each written with their namespace (`AcmeCard`). A value a prop doesn't take is left out and reported. So is a block with no value for a prop its component needs (one dragged in and not filled yet), as the builder leaves it out of what it exports. What the builder keeps on the block that a component has no place for (a display condition, an anchor, a prop's value on phones) isn't read, and the report says so, as it does for the builder's own blocks.

### Which editor a prop gets

A prop's kind says what its value is. The builder edits it with its own property editor for that kind:

| Prop | The builder's editor |
|------|----------------------|
| `prop.text()` | `text` |
| `prop.text()` with an `enum` | `dropdown`, with its texts |
| `prop.color()` | `color_picker` |
| `prop.number()` with `integer: true` | `counter`, between the prop's `min` and `max` |
| `prop.number()` | `text`: a number that isn't whole is kept as text (`"7.99"`) |
| `prop.length()` | `counter` for px, from the prop's `min`; `text` where it takes another unit (`"50%"`) |
| `prop.boolean()` | `toggle` |
| `prop.choice()` | `dropdown`, with its values |
| `prop.fontWeight()` | `dropdown`, 100 to 900 |
| `prop.link()` | `link` |
| `prop.image()` | `image` |
| `prop.fontFamily()` | `font_family` |

There's no editor to name: what a prop says about its value is what its editor gets. A whole number's `min` and `max` are where the counter stops, and a text's `enum` is its dropdown's choices:

```tsx
quantity: prop.number({ label: "Quantity", min: 0, max: 10, integer: true }),
width: prop.length({ label: "Width", units: ["px", "%"] }),
background: prop.color({ label: "Background", transparency: true }),
price: currency({ label: "Price", symbol: "€", min: 0 }),
```

A color may be see-through unless its `transparency` is `false`, which takes an opaque color alone. The builder's color picker gives see-through colors in a page, not in an email.

For an editor of your own, a prop is a property you define once (`currency` here), and then give the builder a control for. Its value stays its kind's: a price is still a number, checked as one.

### Your own property editor

Define a property where your components are: one of `prop`'s helpers, with an editor of your own. A definition is data: its name, the helper it's made on, and the options its editor takes. There's no control in it, so a template that uses it renders anywhere.

```ts
import { defineProperty, prop } from "@hyper-elements/react";

export const currency = defineProperty({
  name: "acme.currency",
  base: prop.number,
  options: {
    symbol: prop.text({ enum: ["$", "€", "£"], default: "$" }),
  },
});
```

- **`name`** is a namespace, a dot and a word: `acme.currency`.
- **`base`** is the helper the prop is made with: `prop.text`, `prop.number`, `prop.color`, `prop.boolean`, `prop.length`, `prop.fontFamily`, `prop.fontWeight`, `prop.image` or `prop.link`. For one of a few values it's `prop.text`, and the prop gives its `enum`.
- **`options`** are what the editor takes besides the value. Each is made with a helper too, with no label: `prop.text({ enum: ["$", "€", "£"] })` for one of a few texts, `prop.number({ min: 0 })`, `prop.boolean({})`. One with a `default` is always there, and one with `required: true` must be given.

Called, it's a prop. It takes what its base takes, and its own options:

```tsx
price: currency({ label: "Price", min: 0, default: 49, symbol: "€" }),
shipping: currency({ label: "Shipping", min: 0, default: 5 }),
```

The prop is its base's: a number, from 0. That holds whoever writes the value, an editor user, your code or an agent. Its own options say how it's edited, and nothing else. Each is checked by its kind, as a prop is: an option the property doesn't have, or a `symbol` that isn't one of the three, is a type error, and refused where it's written.

Then give the builder the property's control, in `registerTools()`'s `editors`, under the property's name:

```ts
import { registerTools, type EditorWidget } from "@hyper-elements/react/builder";

const currencyField: EditorWidget<typeof currency> = {
  // Its markup. The builder draws nothing around an editor of your own: its label is here too.
  render: (value, update, { label, symbol }) => `<label>${label}</label> ${symbol} <input type="number" value="${value ?? ""}" />`,
  // Once that's in the page: call update() with the new value.
  mount: (node, value, update) => {
    node.querySelector("input").onchange = (event) => update(Number(event.target.value));
  },
};

registerTools(unlayer, [PriceBand], { editors: { [currency.name]: currencyField } });
```

`EditorWidget<typeof currency>` types the control from the property: its value is a number, and its options are the prop's label and the property's own, each as the prop has it. It's given the prop's value as the prop has it (a price as a number) and gives back the same. One you registered yourself with `unlayer.registerPropertyEditor` under that name is `true` there (`editors: { [currency.name]: true }`): it's given the value as the builder keeps it.

A property with no control in `editors` is edited with its base's editor, so a component still works in a builder that doesn't have yours. A name in `editors` that no prop of the components is edited with is refused, so a mistyped one doesn't go unnoticed.

### A field that fills several props

Some of what a tool does is the builder's and not the component's: a product picked from your store fills the photo, the name, the price and the link at once. Pass those as the tool's settings, by the component's type:

```ts
registerTools(unlayer, [ProductCard], {
  tools: {
    "acme.ProductCard": {
      // A field of the tool that isn't a prop of the component, shown above its own.
      properties: { product: { label: "From the store", widget: "store_picker" } },
      // The builder's hook when a field changes: return the block's values.
      transformer: (values, source) => (source.name === "product" ? { ...values, ...fromStore(source.value) } : values),
    },
  },
});
```

`properties` are the builder's, each as it takes one. Any other setting (`transformer`, `usageLimit`, `position`) is passed to the builder's `registerTool()` as it is. What the component gives its tool is no setting, and is refused: its name, label, fields and drawing, its icon (that's `icons`), and what a block starts with (each prop's `default`). In a `transformer` the values are as the builder keeps them: an image is `{ url, width, height }`, a link `{ name: "web", values: { href, target } }`, a number that isn't whole text (`"7.99"`). Write one as text there: the builder's text field gives a tool nothing for a number, and its default is drawn. The value of a field that isn't a prop stays in the block, and isn't the component's.

### What to know

- **The component's code has to be loaded in the builder.** A design with a custom tool's block opened where the tool isn't registered shows the builder's "Missing" block there, and exports it.
- **A project's plan sets how many custom tools it has.** The builder leaves a tool past that number out of its panel and doesn't export its blocks, so register no more components than the plan has tools.
- **A component is drawn on its own in the builder**, at its column's width, with no template around it. Give it its own font and colors instead of taking the root's. A theme's token in a prop is written as the value it has there.
- **A component placed where a Section goes** (`placement: "section"`) stays an HTML block: a tool is a block in a column. `registerTools()` registers no tool for it.
- **A prop can't have the name of one of the builder's own values for a block**: `containerPadding`, `anchor`, `displayCondition`, `hideDesktop`, `hideMobile`, `selectable`, `draggable`, `duplicatable`, `deletable`, `hideable`, `locked`, or one that starts with `_`. `registerTools()` refuses the component, and `toDesign()` keeps it an HTML block.
- **A block is drawn at the room its column leaves it**: the column's share of the content width, less the column's padding and border and the block's own padding. In a row of several columns it keeps that width on phones, where the builder stacks the columns. Its phone styles start where the email's do.
- **The builder's canvas isn't given a column's padding or border.** What the builder exports is, and is drawn at the room the block has. In the canvas, a block in a column with padding or a border is drawn as wide as the column without them, so a `Row` in your component can show its columns one under the other there. A `Row`'s `gap` and a `Column`'s `padding` are the builder's columns' padding.
- **In a Document, the builder doesn't draw a component's block.** These tools are for emails and pages: the builder's document mode keeps the block but doesn't draw or export it, as with an HTML block there. `toDesign()`'s report says so, and `fromDesign()` reads the block back as the component.
- **With the builder's `safeHtml` on**, a text field's value reaches a tool as HTML: a `<` typed in it is drawn as `&lt;` in the canvas and in what the builder exports (`fromDesign()` reads the text as it was typed). The builder also takes the comments for classic Outlook out of what a custom tool exports, so a `Row` inside a component is stacked there.
- **The builder's image editor has a width control, which a component doesn't read.** It takes the image's URL and size from it, and sizes the image itself in its `render`.
- `registerTools()` takes `displayMode: "web"` for a builder of pages, so the canvas draws a Page's markup, and `icons` for each tool's icon in the panel.

The [custom components example](https://github.com/hyper-elements/hyper-elements/tree/main/examples/custom-components-in-editor) has two sets made this way: five tools a shop reuses (a product filled from a store, a testimonial, a coupon, an order tracker, a ticket with its barcode), and a whole email's own parts.

## Limits

- A component that is async or suspends makes `toDesign()` throw, as it makes `render()` reject. Fetch data before you build the tree.
- Plain markup among the components (a `<div>`, a `<b>`) makes `toDesign()` throw too. Use the components, or an `Html` block for raw HTML, which the editor edits as HTML.
- Don't construct or guess design JSON by hand. Generate it with `toDesign()`.
