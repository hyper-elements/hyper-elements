---
title: "Designs"
description: "Every design has one root (Email, Page, Document or Canvas) that decides its output. Root props, your own functions, and sharing content."
---

A design is JSX with one root, and the root decides what `render()` writes. This page covers the four roots, their props, and how to build designs out of your own functions.

```tsx
import { Email, Heading, Text } from "@hyper-elements/react";

const welcome = (
  <Email width={600} previewText="Thanks for signing up" lang="en">
    <Heading>Welcome</Heading>
    <Text>Thanks for signing up.</Text>
  </Email>
);
```

That is a whole email. A root stacks its children down its content width, centered in the window, so you don't need a `Row`, a `Column` or a container to start.

## The four roots

| Root | Output | Width |
|------|--------|-------|
| [`Email`](/docs/elements/email) | Email-safe HTML | `width`, 600 by default |
| [`Page`](/docs/elements/page) | A responsive web page | `width`, 1200 by default: the widest the content gets |
| [`Document`](/docs/elements/document) | Print-ready HTML on pages of its size, and a PDF with `@hyper-elements/react/pdf` | From its `size`, `orientation` and `margin` |
| [`Canvas`](/docs/elements/canvas) | An image with `@hyper-elements/react/image` (and HTML from `render()`, to look at) | `width` 1200 and `height` 630 by default |

A design has exactly one root. A `<div>` or any other HTML element around it is an error.

## Root props

| Prop | Roots | What it does |
|------|-------|--------------|
| `width` | Email, Page, Canvas | The content width in px |
| `height` | Canvas | The image's height in px. What's past it is cut |
| `previewText` | Email | Shown after the subject in inbox lists, not in the email |
| `description` | Page | The page's meta description |
| `title` | all | The document's `<title>`, shown in a browser tab and by some email clients |
| `lang` | all | The language, as a BCP 47 tag (`"en"`, `"ar"`) |
| `dir` | all | `"ltr"`, `"rtl"` or `"auto"`. Text starts on that side unless you align it |
| `fonts` | all | The font files the design loads. See [Styles](/docs/styles#fonts) |
| `size` | Document | `"A3"`, `"A4"`, `"A5"`, `"Letter"`, `"Legal"` or `"Tabloid"`, `"A4"` by default |
| `orientation` | Document | `"portrait"` or `"landscape"`, `"portrait"` by default |
| `margin` | Document | Around each page's content, 48px on each side by default (96px to the inch) |

A root's width is a prop, not a style, and a root has no padding. Put padding on a `Column` (a card) or a `Section` (a band) inside it:

```tsx
<Email width={640} style={{ backgroundColor: "#f4f4f5" }}>
  <Column style={{ backgroundColor: "#ffffff", padding: 32 }}>
    <Text>The card has the padding, not the root.</Text>
  </Column>
</Email>
```

The root's `style` takes the text styles every block inherits (`color`, `fontFamily`, `fontSize`, `lineHeight` and the rest), `backgroundColor`, `gap` and `alignItems`. A `Canvas` also takes `padding` and `justifyContent`. See [Styles](/docs/styles).

## What goes inside

| Kind | Elements |
|------|------------|
| Layout | [`Section`](/docs/elements/section), [`Row`](/docs/elements/row), [`Column`](/docs/elements/column), [`Grid`](/docs/elements/grid), [`Layer`](/docs/elements/layer) |
| Text | [`Heading`](/docs/elements/heading) (`level` 1 to 6), [`Text`](/docs/elements/text) |
| Inside text | [`Span`](/docs/elements/span), [`Link`](/docs/elements/link), [`LineBreak`](/docs/elements/linebreak), [`MergeTag`](/docs/elements/mergetag) |
| Blocks | [`Button`](/docs/elements/button), [`Image`](/docs/elements/image), [`Divider`](/docs/elements/divider), [`List`](/docs/elements/list), [`Table`](/docs/elements/table), [`Video`](/docs/elements/video), [`Social`](/docs/elements/social), [`Menu`](/docs/elements/menu), [`Svg`](/docs/elements/svg) (not in an Email), [`Html`](/docs/elements/html) |
| Parts | [`ListItem`](/docs/elements/listitem) in a `List`; [`TableRow`](/docs/elements/tablerow) and [`TableCell`](/docs/elements/tablecell) in a `Table` |
| Shapes, in an `Svg` | [`Rect`](/docs/elements/rect), [`Circle`](/docs/elements/circle), [`Ellipse`](/docs/elements/ellipse), [`Line`](/docs/elements/line), [`Polygon`](/docs/elements/polygon), [`Path`](/docs/elements/path) |
| Document parts | [`Document.Page`](/docs/elements/document-page), [`PageBreak`](/docs/elements/pagebreak), [`PageHeader`](/docs/elements/pageheader), [`PageFooter`](/docs/elements/pagefooter), [`PageNumber`](/docs/elements/pagenumber) |

Text is elements, not HTML. Inside a `Text`, a `Span` styles a run, a `Link` links one, a `LineBreak` breaks the line and a `MergeTag` writes a merge tag:

```tsx
<Text>
  Order <Span style={{ fontWeight: 700 }}>#10482</Span> ships tomorrow.<LineBreak />
  <Link href="https://example.com/orders/10482">Track it</Link>
</Text>
```

`<b>`, `<br>`, `<div>` and other HTML elements in a design are errors (`jsx/markup`). For markup no element says, there's [`<Html>`](/docs/custom-elements#html-markup-as-it-is).

## Your own functions

A function that returns elements is a part of your own, to use wherever those elements can go. It's a React component,
so write designs the way you write the rest of your React app:

```tsx
import { Column, Email, Heading, Text } from "@hyper-elements/react";

function Footer({ company }: { company: string }) {
  return <Text style={{ fontSize: 12, color: "#71717a", textAlign: "center" }}>{company}</Text>;
}

export function OrderShipped({ name, items }: { name: string; items: string[] }) {
  return (
    <Email previewText="Your order is on its way" style={{ gap: 16 }}>
      <Column style={{ gap: 8 }}>
        <Heading level={1}>On its way, {name}</Heading>
        {items.map((item) => (
          <Text key={item}>{item}</Text>
        ))}
      </Column>
      <Footer company="Acme Inc." />
    </Email>
  );
}
```

`render()` runs your functions with React, so props, hooks, Context, Fragments, arrays and conditions work as React shows them.

A function that's async or suspends is an error (`jsx/async`): `render()` doesn't wait for it. Fetch your data first and pass it in as props.

Data you pass as children or props is escaped when the HTML is written, so a customer's name can't add markup.

## Share content between roots

Write the content once, and give each output its root:

```tsx
import { Button, Column, Document, Email, Heading, Page, Text, Span, render } from "@hyper-elements/react";

interface Invoice {
  number: string;
  customer: string;
  total: string;
  url: string;
}

function InvoiceContent({ invoice }: { invoice: Invoice }) {
  return (
    <Column style={{ backgroundColor: "#ffffff", padding: 24, gap: 16 }}>
      <Heading level={1} style={{ fontSize: 28 }}>Payment receipt</Heading>
      <Text>Invoice <Span style={{ fontWeight: 700 }}>{invoice.number}</Span></Text>
      <Text>Thank you, {invoice.customer}. You paid {invoice.total}.</Text>
      <Button href={invoice.url}>View invoice</Button>
    </Column>
  );
}

const invoice = { number: "INV-1001", customer: "Ada Lovelace", total: "$49.00", url: "https://example.com/invoices/INV-1001" };
const title = `Invoice ${invoice.number}`;

const email = await render(<Email title={title} previewText="Your payment receipt is ready."><InvoiceContent invoice={invoice} /></Email>);
const page = await render(<Page title={title} width={600}><InvoiceContent invoice={invoice} /></Page>);
const printed = await render(<Document title={title} size="A4" margin={48}><InvoiceContent invoice={invoice} /></Document>);
```

`render()` needs no mode: the root says what to write. `email.html` is email HTML, `page.html` a web page and `printed.html` print HTML. For the PDF itself, pass the same `Document` to `renderPdf()`. See [PDF](/docs/outputs/pdf).

Shared content doesn't mean identical pixels. Email is written as tables, a page with flexbox, and a document on pages of a fixed size. Each output's page says what it does differently.

## Next

- [Layout](/docs/layout): arrange blocks with Section, Row, Column, Grid and Layer.
- [Custom elements](/docs/custom-elements): named blocks with typed props.
