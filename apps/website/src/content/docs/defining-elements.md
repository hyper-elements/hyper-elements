---
title: "Defining elements"
description: "Build templates from your own function components, make named blocks with typed props using defineElement() and prop, and write raw markup with Html."
---

There are two ways to make elements of your own. A plain function that returns elements is enough for most templates. `defineElement()` makes a named block with typed, validated props, and `<Html>` writes markup no element says.

```tsx
import { Text } from "@hyper-elements/react";

function Footer({ company }: { company: string }) {
  return <Text style={{ fontSize: 12, color: "#71717a", textAlign: "center" }}>{company}</Text>;
}
```

## Plain function components

A function that returns elements is a component. Use it anywhere the element it returns can go:

```tsx
<Email>
  {/* … */}
  <Footer company="Acme Inc., 1 Market St, San Francisco" />
</Email>
```

`render()` runs it with React, so props, hooks, Context, Fragments, arrays and conditions work. It must return elements, not HTML tags, and it can't be async or suspend: fetch data first and pass it in as props.

Use plain functions for layouts, headers, footers and anything that's only code. They aren't named blocks: validation sees the elements they return, not the function.

## defineElement()

`defineElement()` makes a named, reusable block with its own typed props. Validation checks its props like a built-in element's, and every output renders it, because it's expanded into the built-in elements before layout.

```tsx
import { Button, Column, Heading, Image, Text, defineElement, prop } from "@hyper-elements/react";

export const ProductCard = defineElement({
  type: "acme.ProductCard",
  label: "Product card",
  props: {
    name: prop.text({ label: "Name", required: true }),
    photo: prop.image({ label: "Photo", required: true }),
    href: prop.link({ label: "Link", required: true }),
    price: prop.text({ label: "Price" }),
    accent: prop.color({ label: "Accent", default: "#0879a1" }),
    size: prop.choice(["compact", "large"], { label: "Size", default: "compact" }),
    soldOut: prop.boolean({ label: "Sold out", default: false }),
  },
  render: ({ name, photo, href, price, accent, size, soldOut }) => (
    <Column style={{ gap: 8 }}>
      <Image src={photo} alt={name} />
      <Heading level={3} style={{ fontSize: size === "large" ? 22 : 16 }}>{name}</Heading>
      {price ? <Text>{price}</Text> : null}
      <Button href={href} style={{ backgroundColor: soldOut ? "#a1a1aa" : accent }}>
        {soldOut ? "Sold out" : "Buy"}
      </Button>
    </Column>
  ),
});
```

Use it like any element:

```tsx
const photo = { src: "https://example.com/shirt.jpg", width: 560, height: 560 };

<Row style={{ gap: 16 }}>
  <ProductCard name="Linen shirt" photo={photo} href="https://example.com/p/1" price="$48.00" />
  <ProductCard name="Wool scarf" photo={photo} href="https://example.com/p/2" accent="#b91c1c" soldOut style={{ flex: 2 }} />
</Row>
```

A wrong value is a diagnostic with a path, like a built-in element's:

```text
error prop/invalid at root.children[0].props.size: size: expected one of "compact", "large", not "huge"
```

### The spec

| Field | What it is |
|-------|------------|
| `type` | A namespace, a dot and a capitalized name: `"acme.ProductCard"`. The namespace keeps it from clashing with built-in elements |
| `label` | Its name for people |
| `description` | Optional: what it's for |
| `props` | Its props, made with `prop.*` |
| `placement` | `"block"` (the default) goes where a block goes. `"section"` goes where a Section goes, and renders a Section |
| `render` | The block as built-in elements, from its props with defaults applied, and `{ theme }`: the theme's tokens where the instance is |

`render` is a pure function of its props: no hooks and no data, so it renders anywhere. It returns one element, which takes your element's place. Its second argument holds the [theme](/docs/themes)'s tokens as values, scopes around the instance included (`theme.colors.primary`), for values it works out itself; it's empty without a theme.

### Props

| Helper | Takes |
|--------|-------|
| `prop.text()` | Text |
| `prop.color()` | A color |
| `prop.image()` | An image: a URL, or `{ src, width, height }` |
| `prop.link()` | A link: a URL or a merge tag, or `{ href, target }` |
| `prop.boolean()` | `true` or `false` |
| `prop.number()` | A number, with optional `min`, `max` and `integer` |
| `prop.length()` | A length, px by default |
| `prop.choice(values, …)` | One of `values` |
| `prop.fontFamily()` | A font stack |
| `prop.fontWeight()` | A font weight |

Each takes `label`, and optionally a `description`, `required: true` or a `default`. Their types carry through to `render`'s props and to the JSX. A color, length or font prop also takes a theme's token in JSX, `<ProductCard accent={token("colors.primary")} />`, and `render` gets its value where the instance is.

### On each instance

Beside its own props, an instance takes `id`, `hidden`, and `style={{ flex }}` for its share of a Row. Its `flex` and `hidden` go onto the element it renders. It takes no `variant` or named styles: apply those in what it renders.

Ids inside one of your own elements are prefixed with the instance's `id`. Without one, they're left out (with an `id/dropped` note), so two instances never share an id.

### A section-level element

```tsx
import { Text, Section, defineElement, prop } from "@hyper-elements/react";

export const Banner = defineElement({
  type: "acme.Banner",
  label: "Banner",
  placement: "section",
  props: {
    text: prop.text({ label: "Text", required: true }),
    background: prop.color({ label: "Background", default: "#111827" }),
  },
  render: ({ text, background }) => (
    <Section style={{ backgroundColor: background, padding: [16, 40], color: "#ffffff", textAlign: "center" }}>
      <Text>{text}</Text>
    </Section>
  ),
});
```

## Html: markup as it is

For markup no element says, `<Html>` writes it as it is, in an email and on a page:

```tsx
import { Email, Html } from "@hyper-elements/react";

<Email>
  <Html html={'<p style="margin:0">Written <b>as it is</b>.</p>'} text="Written as it is." />
</Email>
```

Or give the markup as JSX inside the block, which React writes:

```tsx
<Html text="Written as JSX.">
  <p style={{ margin: 0 }}>Written <b>as JSX</b>.</p>
</Html>
```

`text` is what the block reads as in the plain-text version. Without it, the markup's words are used. A Document's PDF and a Canvas's image can't draw markup, so they draw that plain text, and say so.

> **Warning:** Nothing in an `Html` block is checked or escaped. Put only markup you wrote there, never a customer's data. Everywhere else, values you pass as children or props are escaped for you.

Html is the escape hatch, not the way in. Inside it, you're back to writing email HTML yourself: tables for Outlook, inline styles, and testing in each client.
