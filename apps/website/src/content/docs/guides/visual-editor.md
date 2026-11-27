---
title: "Visual editing"
description: "Turn a design into Unlayer design JSON for its builder with toDesign(), and read an edited builder design back as a design with fromDesign()."
---

You or an agent writes the design in code. Someone else changes the copy in a visual editor. You don't maintain two versions, and you don't hand-build the builder's design JSON.

`@hyper-elements/react/builder` connects your designs to Unlayer's builder, the drag-and-drop email and page editor:

- `toDesign(element)` writes a design as a builder design, the builder's design JSON, for its `loadDesign()`.
- `fromDesign(design, options)` reads a builder design back as a design: an element to render, and its JSX source.

Rendering needs no Unlayer account or API key. The builder is Unlayer's product, with its own project setup.

## Design to builder design

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

`design` is a serializable object with `body`, `counters` and `schemaVersion`. It holds the builder's structure, not HTML, and no Elements data. Keep the schema version and counters it writes.

`toDesign()` is synchronous. It takes an `Email`, a `Page` or a `Document`. A `Canvas` has no builder design. It renders the design once with React, as `render()` does, so hooks, Context, Fragments and your own components work, at the root too.

## The report

`report` lists what the builder can't hold as it is, one line each, with the path to the block. It's empty when everything maps to a builder tool. A `Table` in an `Email` with a line between its rows (`rowBorder`), which the builder's table can't draw, for example:

```text
root.children[1]: the builder's table doesn't draw it as it is (a line between rows only): it's an HTML block of its own markup in the builder (it can be moved, not edited)
```

Read the report before you promise an editor user that a block is editable.

## What the builder holds

The builder holds what its tools can. Two things happen to the rest:

- **Hidden properties.** A style or prop a tool has no field for is a hidden property of that tool. It's kept in the builder design under its own name and drawn by Elements, but the builder shows no control for it yet.
- **HTML blocks.** What no tool shows (a `Layer`, an `Svg`, a box nested in a column, your own `defineElement()`) goes in as an HTML block of its rendered markup. An editor user can move it, not edit it. In a `Document`, the builder keeps an HTML block but doesn't draw or export it, so it isn't in the builder's PDF. The report names each one. Your own elements can be tools of the builder instead: see [Your own elements as tools](#your-own-elements-as-tools).
- **Tables.** A `Table` is the builder's table: its header and footer rows, each cell's words and each column's share, what its rows share (text styles, background, padding) and each cell's own. The builder draws one border around every cell and has no cells across columns, no table width and no phone values. In an `Email` or a `Page`, a table the builder would draw otherwise (a line between rows only, a cell spanning columns, a border around the table, a width, a column of a fixed width) stays an HTML block, which draws it exactly. In a `Document`, where the builder doesn't draw an HTML block, it's the builder's table all the same: a line between rows is drawn above the first row and below the last too, and a cell spanning columns is a cell for each column. A table with an image in a cell, or a row, a cell or words in a cell hidden on phones or desktops, stays an HTML block. The report says each. `fromDesign()` reads a table back as a `Table`, one made in the builder too.

Two smaller details: a line height goes into the builder's field as a whole percentage, as browsers draw it, so `24px` at 13px becomes `185%`, a twentieth of a pixel taller there. The builder has no page numbers yet, so a `PageNumber` goes in as its token, which the editor's PDF prints as it is. The report says so.

## Load it in the builder

Create the editor, load the builder design when it's ready, and export when the user is done:

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

Match the editor's `displayMode` to the design's root: `email` for an `Email`, `web` for a `Page`, `document` for a `Document`. Which tools and features the editor offers depends on its version and your project's configuration. Unlayer's docs cover [installing the editor](https://docs.unlayer.com/builder/installation) and [loading and saving designs](https://docs.unlayer.com/builder/load-and-save-designs).

> **Warning:** Once an editor user has changed a builder design, store their latest JSON and load that. Regenerating the builder design from your React source and reloading it overwrites their changes. Keep the design's source and the saved builder designs as separate records.

## Builder design back to a design

```tsx
import { readFile } from "node:fs/promises";
import { fromDesign } from "@hyper-elements/react/builder";
import { render } from "@hyper-elements/react";

const saved = JSON.parse(await readFile("edited.design.json", "utf8"));
const { element, code, report } = fromDesign(saved, { displayMode: "email" });
const { html, text } = await render(element);
```

- `element` renders the builder design. `render(element)` gives HTML and a plain-text body that match the edits, ready to [send](/docs/guides/sending).
- `code` is the same design as JSX in the new elements.
- `report` lists what the design can't hold.

Pass the `displayMode` the builder design was made in: `email` gives an `Email`, `web` a `Page`, `document` a `Document`. Without one, a builder design with a header, a footer or a page break becomes a `Document`, any other an `Email`. `name` sets the component's name in `code`. `fromDesign()` reads builder designs made by `toDesign()`, edited in the builder, or made there from scratch. The builder's own HTML blocks come back as `Html` blocks.

### What comes back

The builder design as it stands, with its sample values. A builder design holds content and settings, not code, so the original's props, loops, conditions, hooks and event handlers don't come back.

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

### Untrusted builder designs: `toSafeHtml`

A builder design's markup comes back as it is. If your builder designs can hold content you don't trust, pass your sanitizer as `toSafeHtml`, a function from an HTML string to a safe one. Every builder HTML block's markup, and every text's before it's read, goes through it:

```tsx
const { element } = fromDesign(saved, { displayMode: "email", toSafeHtml });
```

A block of your own element isn't markup: its values are checked by its props and given to your element, which draws them as text. One whose `render` draws a prop's text as markup (an `Html` block of it) draws what's in the design, so sanitize it there.

## Your own elements as tools

An element you made with [`defineElement()`](/docs/custom-elements#defineelement) can be a tool of the builder: a block an editor user drags in and edits by its props, drawn by Elements. You write it once. There's no separate tool to write, and no HTML to write by hand for the canvas, for web and for email.

```tsx
import { Text, defineElement, prop } from "@hyper-elements/react";

export const Callout = defineElement({
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

   Each element becomes one tool. Its name is the element's type in the builder's words (`acme.Callout` is `acme_callout`): `registerTools()` returns the names, and `toolName(Callout)` gives one. Its label is the element's, and it has a field for each prop. A block dragged in from the panel starts with each prop's `default`; a prop with none starts unset.

2. **Write the design with them**: `toDesign(element, { customTools: true })` writes each of your elements as its tool's block, its props the block's values, where it would otherwise be an HTML block. One its tool can't draw on its own stays an HTML block, and the report says why (below).

3. **Read it back with them**: `fromDesign(design, { elements: [Callout] })` reads each of those blocks back as the element, its values checked by its props' kinds. Its code writes the element by the name its type ends with (`<Callout … />`), and lists each one's type at the top, to import from where you define it. Two of your elements with the same name, or one named as an element the code imports, are each written with their namespace (`AcmeCard`). A block with a value its prop doesn't take is left out and reported, as the builder can't export it either (below). So is a block with no value for a prop its element needs (one dragged in and not filled yet). Read `report` before you save what `fromDesign()` gives in place of a design: a block left out is said there, and nothing else marks it. Not every line is a block left out: others say what a block keeps that an element has no place for. What the builder keeps on the block that an element has no place for (a display condition, an anchor, a prop's value on phones) isn't read, and the report says so, as it does for the builder's own blocks.

### Which editor a prop gets

A prop's kind says what its value is. The builder edits it with its own property editor for that kind, or with a text field of `registerTools()`'s own, which keeps only a value the prop takes (below):

| Prop | Its field |
|------|----------------------|
| `prop.text()` | `registerTools()`'s text field |
| `prop.text()` with an `enum` | `dropdown`, with its texts |
| `prop.color()` | `color_picker`, told it takes no see-through color where `transparency` is `false` |
| `prop.number()` with `integer: true` | `counter`, between the prop's `min` and `max` |
| `prop.number()` | `registerTools()`'s text field: a number that isn't whole is kept as text (`"7.99"`) |
| `prop.length()` | `counter` for px, from the prop's `min`; `registerTools()`'s text field where it takes another unit (`"50%"`) |
| `prop.boolean()` | `toggle` |
| `prop.choice()` | `dropdown`, with its values |
| `prop.fontWeight()` | `dropdown`, 100 to 900 |
| `prop.link()` | `link` |
| `prop.image()` | `image` |
| `prop.fontFamily()` | `font_family` |
| `prop.date()` | `registerTools()`'s text field, a date as `YYYY-MM-DD` |
| `prop.list()`, `prop.object()`, `prop.blocks()` | `registerTools()`'s list field: a box for each item, with a field for each of its parts (below) |

There's no editor to name: what a prop says about its value is what its editor gets. A whole number's `min` and `max` are where the counter stops, and a text's `enum` is its dropdown's choices:

```tsx
quantity: prop.number({ label: "Quantity", min: 0, max: 10, integer: true }),
width: prop.length({ label: "Width", units: ["px", "%"] }),
background: prop.color({ label: "Background", transparency: true }),
price: currency({ label: "Price", symbol: "€", min: 0 }),
```

A color may be see-through unless its `transparency` is `false`, which takes an opaque color alone. The builder's color picker gives see-through colors in a page, not in an email. For a color that can't be see-through, `registerTools()` gives the picker `allowTransparent: false`, so it has no opacity to set there and no "transparent" to pick. A builder whose picker doesn't take that still offers see-through colors in a page, and shows none of your `colorPicker` colors for that prop: a see-through color picked there makes the block say why it can't be drawn, as a block saved with one does.

A list, an object, or a list of blocks is edited in a field of `registerTools()`'s own. Each item is a box with a field for each of its parts. It can be moved up or down or removed, and **+ Add item** adds one with its parts at their defaults, up to the list's `max`. A block in a list of blocks has its type to pick, which starts its parts again. The builder's own editors can't be drawn inside another field, so a part that's a color, a link, an image, a date or a font is typed (`#FF5B1F`, a URL), a choice or a font weight is picked, and a boolean is ticked. A part saved with more than its field shows, like a link's target, keeps it until it's typed again. The field gives the block its value once its user leaves a text (or presses Enter), and at once for the rest. A value its prop doesn't take stays in the field, with the item and the part under it (`Questions: item 2, Answer: is needed`), as any field's does.

```tsx
entries: prop.list(prop.object({ question: prop.text({ label: "Question", required: true }), answer: prop.text({ label: "Answer", required: true }) }, { label: "Entry" }), { label: "Questions", max: 8 }),
```

For an editor of your own, a prop is a property you define once (`currency` here), and then give the builder a control for. Its value stays its kind's: a price is still a number, checked as one.

### Your own property editor

Define a property where your elements are: one of `prop`'s helpers, with an editor of your own. A definition is data: its name, the helper it's made on, and the options its editor takes. There's no control in it, so a template that uses it renders anywhere.

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
  // Its markup. The builder draws nothing around an editor of your own: its label is here too. A text input, so
  // what's typed reaches the check as it is: unfinished input ("1e") isn't a number, where a number input gives "".
  render: (value, update, { label, symbol }) => `<label>${label}</label> ${symbol} <input type="text" inputmode="decimal" value="${value ?? ""}" />`,
  // Once that's in the page: call update() with the new value. An empty field is no price, not zero, and what isn't
  // a number as it's written in decimal ("0x10", which Number() reads as 16) isn't one.
  mount: (node, value, update) => {
    const input = node.querySelector("input");
    input.onchange = () => {
      const text = input.value.trim();
      update(text === "" ? undefined : /^[+-]?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i.test(text) ? Number(text) : Number.NaN);
    };
  },
};

registerTools(unlayer, [PriceBand], { editors: { [currency.name]: currencyField } });
```

`EditorWidget<typeof currency>` types the control from the property: its value is a number, and its options are the prop's label and the property's own, each as the prop has it. It's given the prop's value as the prop has it (a price as a number) and gives back the same. What it gives back is kept only where the prop takes it: a price below the prop's `min` isn't, and `registerTools()` says why under the control while the block keeps the price it had. A block saved with a value its prop doesn't take gives the control none (`undefined`), and why is said under it.

Any editing app checks a field the same way, with the same words: `checkValue(spec, held)` (from `@hyper-elements/react`) checks what a field holds against the prop it edits, an element's `definition.props.price`. `checkValue(Product.definition.props.price, "-5")` is `{ ok: false, message: "expected a number from 0, not -5" }`, and `checkValue(Product.definition.props.price, "129.50")` is `{ ok: true, value: 129.5 }`. An empty field is the prop not given, which a required prop refuses. One you registered yourself with `unlayer.registerPropertyEditor` under that name is `true` there (`editors: { [currency.name]: true }`): it's given the value as the builder keeps it.

A property with no control in `editors` is edited with its base's editor, so an element still works in a builder that doesn't have yours. A name in `editors` that no prop of the elements is edited with is refused, so a mistyped one doesn't go unnoticed.

### A field that fills several props

Some of what a tool does is the builder's and not the element's: a product picked from your store fills the photo, the name, the price and the link at once. Pass those as the tool's settings, by the element's type:

```ts
registerTools(unlayer, [ProductCard], {
  tools: {
    "acme.ProductCard": {
      // A field of the tool that isn't a prop of the element, shown above its own.
      properties: { product: { label: "From the store", widget: "store_picker" } },
      // The builder's hook when a field changes: return the block's values.
      transformer: (values, source) => (source.name === "product" ? { ...values, ...fromStore(source.value) } : values),
    },
  },
});
```

`properties` are the builder's, each as it takes one. Any other setting (`transformer`, `usageLimit`, `position`) is passed to the builder's `registerTool()` as it is. A `validator` runs after the tool's own, which reports a block that can't be drawn, and its errors follow. What the element gives its tool is no setting, and is refused: its name, label, fields and drawing, its icon (that's `icons`), and what a block starts with (each prop's `default`). In a `transformer` the values are as the builder keeps them: an image is `{ url, width, height }`, a link `{ name: "web", values: { href, target } }`, a number that isn't whole text (`"7.99"`). Write one as text there: the builder's text field gives a tool nothing for a number, and its default is drawn. The value of a field that isn't a prop stays in the block, and isn't the element's.

### What to know

- **The element's code has to be loaded in the builder.** A design with a custom tool's block opened where the tool isn't registered shows the builder's "Missing" block there, and exports it.
- **A project's plan sets how many custom tools it has.** The builder leaves a tool past that number out of its panel and doesn't export its blocks, so register no more elements than the plan has tools.
- **An element is drawn on its own in the builder**, at its column's width, with no template around it and no theme. Give it its own font and colors instead of taking the root's. A theme's token in a prop is written as the value it has there. `toDesign()` draws each element as its tool will, at the room the builder gives its block: one its tool can't draw so (one with a theme's token in its `render`, `token("colors.primary")`, or an image wider than that room) stays an HTML block of its markup, drawn as the template draws it, and its report says why.
- **A field keeps only a value its prop takes.** Each field checks what's typed in it as its prop does (`checkValue()`). One the prop doesn't take (a price below its `min`, a text past its `maxLength`) stays in the field, with why under it, and the block keeps the value it had, so the canvas draws what the design holds. Corrected, it's kept and drawn. A text, and a number or a length the builder keeps as text, is edited in a text field of `registerTools()`'s own, and a property editor of your own is checked the same way. What an input method is composing is kept once its user is done.
- **What can't be drawn isn't exported.** A block saved with a value its prop doesn't take, or with none for a prop its element needs, says what's wrong in the canvas in its place, and the builder's audit (its Audit tab, `unlayer.audit()`) lists it as an error at the block. So does the audit for a block its element's `render` can't draw at any room with its values (it throws, or takes a theme's token). Its export fails, naming the block and why, and so does an export while a field holds a value that isn't kept, as the block would go out with the value it had. The builder gives a failed export to your app as text in place of the HTML (`Failed to export html. …`), and a builder that reports it gives the result an `error` too: check it first. That text is plain: a value in it has its `<`, `>` and `&` written as JSON escapes them (`\u003c`), so what a field holds is never markup there. Run its audit before you export, and check that the HTML's body doesn't start so, as the [example](https://github.com/hyper-elements/hyper-elements/tree/main/examples/custom-elements-in-editor)'s download does. A block is never drawn with a default in place of its value.
- **An element placed where a Section goes** (`placement: "section"`) stays an HTML block: a tool is a block in a column. `registerTools()` registers no tool for it.
- **A tool is offered where its element goes.** An element with [`roots`](/docs/custom-elements#only-in-some-formats) is a tool in those roots' display modes alone: `email` for an `Email`, `web` for a `Page`, `document` for a `Document`. Without `roots`, it's in all three. `registerTools()` refuses an element that goes only in a `Canvas`, which the builder has no mode for. A saved block read back where its element doesn't go is left out, and `fromDesign()` says so.
- **A prop can't have the name of one of the builder's own values for a block**: `containerPadding`, `anchor`, `displayCondition`, `hideDesktop`, `hideMobile`, `selectable`, `draggable`, `duplicatable`, `deletable`, `hideable`, `locked`, or one that starts with `_`. `registerTools()` refuses the element, and `toDesign()` keeps it an HTML block.
- **A block is drawn at the room its column leaves it**: the column's share of the content width, less the column's padding and border and the block's own padding. In a row of several columns it keeps that width on phones, where the builder stacks the columns. Its phone styles start where the email's do.
- **The builder's canvas isn't given a column's padding or border.** What the builder exports is, and is drawn at the room the block has. In the canvas, a block in a column with padding or a border is drawn as wide as the column without them, so a `Row` in your element can show its columns one under the other there. A `Row`'s `gap` and a `Column`'s `padding` are the builder's columns' padding.
- **In a Document, an element's block is drawn as a page's.** The builder prints what it exports, with the document's own page size and margins, so its canvas and its export draw the element's Page markup there. Give `registerTools()` `displayMode: "document"` in a document builder, so the canvas draws the same. The element's `roots`, and its props', are checked as a Document's there. What it renders is drawn as a page's, though, so one with a `PageNumber` in it can't be drawn in the builder: a page number is a Document's own pages'.
- **A text is what's typed, with the builder's `safeHtml` on or off.** `registerTools()`'s own text field gives a tool the text as it's typed, which Elements writes as text: `A<B` is drawn as `A<B`, and `A&lt;B` typed so is those six characters. The builder also takes the comments for classic Outlook out of what a custom tool exports, so a `Row` inside an element is stacked there.
- **The builder's image editor has a width control, which an element doesn't read.** It takes the image's URL and size from it, and sizes the image itself in its `render`.
- **The builder's AI fills a field by the schema of its value.** Each field `registerTools()` draws itself says what the builder keeps there, and so does a control of yours given in `editors`, where the builder keeps the prop's value or its text. One for a link, an image or a font, which the builder keeps its own way, gives none.
- `registerTools()` takes `displayMode: "web"` for a builder of pages, or `"document"` for one of documents, so the canvas draws a Page's markup, and `icons` for each tool's icon in the panel.

The [custom elements example](https://github.com/hyper-elements/hyper-elements/tree/main/examples/custom-elements-in-editor) has two sets made this way: five tools a shop reuses (a product filled from a store, a testimonial, a coupon, an order tracker, a ticket with its barcode), and a whole email's own parts.

## Limits

- A component that is async or suspends makes `toDesign()` throw, as it makes `render()` reject. Fetch data before you build the tree.
- Plain markup among the elements (a `<div>`, a `<b>`) makes `toDesign()` throw too. Use the elements, or an `Html` block for raw HTML, which the editor edits as HTML.
- Don't construct or guess a builder design's JSON by hand. Generate it with `toDesign()`.
