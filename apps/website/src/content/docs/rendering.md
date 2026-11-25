---
title: "Rendering"
description: "render() turns a design into HTML and plain text, renderPdf() into a PDF and renderImage() into an image. Their results and options, validate() and outline(), merge tags, and where they run."
---

`render()` turns a design into the output its root asks for. `validate()` runs the same checks without writing anything, and `outline()` prints the layout as text.

```tsx
import { render } from "@hyper-elements/react";

const { html, text } = await render(<Receipt />);
```

<figure class="diagram"><img src="/generated/core-concepts/rendering-flow.svg" width="880" height="318" alt="A design goes through four steps: it is collected in one React render, checked, laid out, and written. validate() and outline() stop after the layout: one returns what is wrong, the other prints the layout. render(), renderPdf() and renderImage() go on to write the output."></figure>

| You want | Call | From |
|----------|------|------|
| An Email's or a Page's HTML, and its plain text | [`render()`](#render) | `@hyper-elements/react` |
| A Document as a PDF | [`renderPdf()`](#renderpdf) | `@hyper-elements/react/pdf` |
| A Canvas as a PNG or an SVG | [`renderImage()`](#renderimage) | `@hyper-elements/react/image` |
| What's wrong with a design, without writing it | [`validate()`](#validate) | `@hyper-elements/react` |
| The layout, as text | [`outline()`](#outline) | `@hyper-elements/react` |

The examples on this page use one receipt email:

<figure class="diagram"><img src="/generated/core-concepts/rendering-receipt.svg" width="880" height="559" alt="The receipt email on desktop, its two columns side by side under the table, and on a phone, the columns stacked and the heading smaller"></figure>

<details>
<summary>The receipt's source</summary>

<!-- example: rendering/receipt.tsx -->
```tsx
import {
  Button,
  Column,
  Email,
  Heading,
  Image,
  LineBreak,
  Link,
  List,
  ListItem,
  MergeTag,
  Row,
  Span,
  Table,
  TableCell,
  TableRow,
  Text,
} from "@hyper-elements/react";

const logo = {
  src: "https://hyperelements.dev/img/orbit-logo.png",
  width: 252,
  height: 128,
};

export default function Receipt() {
  return (
    <Email
      lang="en"
      previewText="Order #10482 has shipped. Here is your receipt."
      style={{ backgroundColor: "#f4f4f5", gap: 16 }}
    >
      <Image src={logo} alt="Orbit" style={{ width: 96 }} />
      <Column
        style={{
          backgroundColor: "#ffffff",
          padding: 32,
          gap: 16,
          borderRadius: 8,
        }}
      >
        <Heading
          level={1}
          style={{ fontSize: 24, mobile: { fontSize: 20 } }}
        >
          Thanks for your order, <MergeTag name="first_name" />
        </Heading>
        <Text>
          Order <Span style={{ fontWeight: 700 }}>#10482</Span> shipped.
          <LineBreak />
          <Link href="https://example.com/orders/10482">Track it</Link>
        </Text>
        <Table
          style={{ cellPadding: [8, 0], rowBorder: "1px solid #e4e4e7" }}
        >
          <TableRow header>
            <TableCell>Item</TableCell>
            <TableCell style={{ textAlign: "right" }}>Price</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Linen shirt</TableCell>
            <TableCell style={{ textAlign: "right" }}>$48.00</TableCell>
          </TableRow>
        </Table>
        <Row style={{ gap: 16 }}>
          <Column>
            <Text style={{ fontWeight: 700 }}>Shipping to</Text>
            <Text>Ada Lovelace, London</Text>
          </Column>
          <Column>
            <Text style={{ fontWeight: 700 }}>Next steps</Text>
            <List type="number">
              <ListItem>We pack it</ListItem>
              <ListItem>You track it</ListItem>
            </List>
          </Column>
        </Row>
        <Button
          href="https://example.com/orders/10482"
          style={{ backgroundColor: "#15132e", borderRadius: 6 }}
        >
          View your order
        </Button>
      </Column>
      <Text style={{ fontSize: 14, color: "#52525b", textAlign: "center" }}>
        Orbit Inc., 1 Market St, San Francisco
      </Text>
    </Email>
  );
}
```

</details>

## render()

`render(element, options?)` is async. It resolves to:

| Field | What it is |
|-------|------------|
| `html` | The whole document, with no React hydration markers and no client-side JavaScript |
| `text` | The plain-text version, from the same design |
| `head` | What goes in `<head>`: meta tags, the title, the stylesheet |
| `body` | What goes in `<body>` |
| `bodyStyle` | The body's own inline style |
| `diagnostics` | Warnings and notes (severity `warning` and `info`). Errors aren't here: they make `render()` reject |

`head`, `body` and `bodyStyle` are for embedding the output in a page of your own. See [Web pages](/docs/outputs/page#embed-it-in-your-own-page).

A design with errors doesn't render. `render()` rejects with an `ElementsError`, whose `diagnostics` give each problem's `code`, `message` and `path`:

```tsx
import { ElementsError, render } from "@hyper-elements/react";

try {
  await render(<Receipt />);
} catch (error) {
  if (error instanceof ElementsError) {
    for (const { code, message, path } of error.diagnostics) {
      console.error(code, path, message);
    }
  }
  throw error;
}
```

### The plain-text version

`text` is written from the same design, so it never drifts from the HTML. Headings are in capitals, links and buttons show their URL in brackets, list items get their numbers (or a `-`), a table's cells are joined with `|`, and an image shows its alt text. The receipt's:

<!-- output: receiptText -->
```text
[Orbit]

THANKS FOR YOUR ORDER, {{first_name}}

Order #10482 shipped.
Track it (https://example.com/orders/10482)

Item | Price
Linen shirt | $48.00

Shipping to

Ada Lovelace, London

Next steps

1. We pack it
2. You track it

View your order (https://example.com/orders/10482)

Orbit Inc., 1 Market St, San Francisco
```

The preview text isn't in it.

### Options

| Option | Default | What it does |
|--------|---------|--------------|
| `pretty` | `false` | Indents the HTML, for reading it. For sending, keep the compact HTML: white space may change how some email clients show it |
| `mergeTag` | `` (name) => `{{name}}` `` | A function from a merge tag's name to how it's written |
| `plugins` | None | Packages that add checks, such as `@hyper-elements/email-clients`. `validate()` takes them too. See [validate()](#validate) |
| `classPrefix` | `"e"` | What every class name in the stylesheet starts with, for HTML embedded where other CSS is. A Document's page boxes keep the class `elements-page` |
| `hideBelow` | Where the phone styles start | In an Email, the window width in px at and below which what's hidden on phones is hidden |
| `blockMap` | `false` | For tools that preview a design: also returns `blocks`, the UTF-8 byte offset of each block in `html` with its place in the design, for every root. The HTML stays the same. Not with `pretty` ([REFERENCE.md](https://github.com/hyper-elements/hyper-elements/blob/main/packages/react/REFERENCE.md#for-tools-where-each-block-is-in-the-html)) |

```tsx
const { html } = await render(<Receipt />, {
  pretty: true,
  classPrefix: "acme-",
});
```

## renderPdf()

A `Document` becomes a PDF with `renderPdf()`, from `@hyper-elements/react/pdf`. It needs `@react-pdf/renderer` installed, and no browser. This is the receipt from [Designs](/docs/designs#share-content-between-roots), as a Document:

<!-- example: rendering/_scripts/pdf.tsx -->
```tsx
import { writeFile } from "node:fs/promises";
import { renderPdf } from "@hyper-elements/react/pdf";
import ReceiptDocument from "../../designs/receipt-document";

const { pdf, diagnostics } = await renderPdf(<ReceiptDocument />);
for (const { code, message } of diagnostics) console.warn(code, message);
await writeFile("receipt.pdf", pdf);
```

<figure class="diagram"><img src="/generated/core-concepts/rendering-pdf.svg" width="720" height="409" alt="The top of the PDF's first page: the receipt inside the A4 page's margins"></figure>

`render()` of the same Document writes print-ready HTML, for a browser to print. [Documents and PDF](/docs/outputs/pdf) covers pages, headers, footers, fonts and images.

## renderImage()

A `Canvas` becomes a PNG with `renderImage()`, from `@hyper-elements/react/image`, or an SVG with its `format: "svg"` option. It needs `satori` and `@resvg/resvg-js` installed, and no browser. You give it the font files as bytes:

<!-- example: rendering/_scripts/image.tsx -->
```tsx
import { readFile, writeFile } from "node:fs/promises";
import { renderImage } from "@hyper-elements/react/image";
import Card from "../../designs/card";

const regular = await readFile("fonts/Inter-Regular.ttf");
const bold = await readFile("fonts/Inter-Bold.ttf");

const { image, width, height } = await renderImage(<Card />, {
  fonts: [
    { family: "Inter", src: regular },
    { family: "Inter", src: bold, weight: 700 },
  ],
});
console.log(`${width}×${height}`);
await writeFile("card.png", image);
```

<figure class="diagram"><img src="/generated/core-concepts/rendering-image.svg" width="720" height="423" alt="The image: a social card 1200 by 630, with a name, a large headline and a line of text"></figure>

<details>
<summary>The card's source</summary>

<!-- example: designs/card.tsx -->
```tsx
import {
  Canvas,
  Circle,
  Column,
  Heading,
  Path,
  Rect,
  Row,
  Svg,
  Text,
} from "@hyper-elements/react";

const fonts = [
  { family: "Inter", src: "../fonts/Inter-Regular.ttf", weight: 400 },
  { family: "Inter", src: "../fonts/Inter-Bold.ttf", weight: 700 },
];
const INK = "#15132e";
const SUN = "#ffc93c";
const TEAL = "#2dd4bf";
const CORAL = "#ff6b57";
const PINK = "#f9a8d4";
const MIST = "#e0e7ff";

// Six tiles, two across: each a ground, and a shape drawn on it.
const T = 210;
const tiles = [
  [TEAL, "quarter", SUN],
  [CORAL, "dot", MIST],
  [SUN, "ring", INK],
  [INK, "quarter", PINK],
  [PINK, "dot", CORAL],
  [MIST, "quarter", TEAL],
] as const;

function Tile({ at }: { at: number }) {
  const [ground, shape, color] = tiles[at];
  const [x, y] = [(at % 2) * T, Math.floor(at / 2) * T];
  const [cx, cy] = [x + T / 2, y + T / 2];
  const quarter = `M${x} ${y}h${T}a${T} ${T} 0 0 1 ${-T} ${T}z`;
  const ring = { fill: "transparent", stroke: color, strokeWidth: 30 };
  return (
    <>
      <Rect x={x} y={y} width={T} height={T} style={{ fill: ground }} />
      {shape === "quarter" && <Path d={quarter} style={{ fill: color }} />}
      {shape === "dot" && (
        <Circle cx={cx} cy={cy} r={64} style={{ fill: color }} />
      )}
      {shape === "ring" && <Circle cx={cx} cy={cy} r={62} style={ring} />}
    </>
  );
}

export default function Card() {
  return (
    <Canvas
      width={1200}
      height={630}
      fonts={fonts}
      style={{
        backgroundColor: "#4f46e5",
        color: "#ffffff",
        fontFamily: "Inter",
      }}
    >
      <Row style={{ height: 630 }}>
        <Column
          style={{
            height: 630,
            padding: 64,
            justifyContent: "space-between",
          }}
        >
          <Text style={{ fontSize: 32, fontWeight: 700 }}>Orbit</Text>
          <Heading level={1} style={{ fontSize: 80, lineHeight: 1.05 }}>
            Release notes that write themselves
          </Heading>
          <Text style={{ fontSize: 28, fontWeight: 700, color: SUN }}>
            Out now at orbit.example
          </Text>
        </Column>
        <Svg width={2 * T} height={3 * T} style={{ flex: "none" }}>
          {tiles.map((tile, at) => (
            <Tile key={tile.join()} at={at} />
          ))}
        </Svg>
      </Row>
    </Canvas>
  );
}
```

</details>

[Images](/docs/outputs/image) covers fonts, pictures, fitting text and what a Canvas can't draw.

## Merge tags

A [`MergeTag`](/docs/elements/mergetag) is a value your sending service fills in, written in that service's syntax:

```tsx
<Text>
  Hi <MergeTag name="first_name" />, your order has shipped.
</Text>
```

By default it's written as `{{first_name}}`, in the HTML and in the plain text. For another syntax, pass `mergeTag`:

```tsx
// Mailchimp-style: *|FIRST_NAME|*
await render(<Receipt />, { mergeTag: (name) => `*|${name.toUpperCase()}|*` });

// Liquid with spaces: {{ first_name }}
await render(<Receipt />, { mergeTag: (name) => `{{ ${name} }}` });
```

What `mergeTag` returns goes into the HTML as it is, with the name in it escaped, so a syntax with `<` in it (`<%= name %>`) works there too.

A link can be a merge tag as well: `href` takes a URL or a tag, so `<Link href="{{unsubscribe_url}}">` writes `href="{{unsubscribe_url}}"`.

### Tags typed into your text

Prefer `MergeTag`: it follows the `mergeTag` option, so a design moves to another sending service without edits. [Lint](/docs/lint), the checks for what makes an email hard to read, warns where merge syntax is typed into the text instead (`email/lint-merge-syntax`).

Typed tags still work where you need them, for what `MergeTag` doesn't write, such as a condition. Text you write is escaped, and tags without `<`, `>` or `&` in them pass through unchanged: `{{code}}`, `*|FNAME|*` and `{% if vip %}` reach the HTML and the plain text as you wrote them. A tag with `<` in it, typed as text, is escaped in the HTML (`&lt;%= name %&gt;`).

## validate()

`validate(element, options?)` runs the checks `render()` runs, all but one, without writing anything. It's synchronous. What's wrong with the design comes back in `diagnostics`, not as an error:

```tsx
import { validate } from "@hyper-elements/react";

const { valid, diagnostics } = validate(<Receipt />);
```

`valid` is `false` when there's an error. Warnings and notes leave it `true`.

It checks props, styles, children and ids, lays the design out, and reports what the output can't show as asked. The one check it leaves to `render()` needs the written HTML: an email's size against Gmail's limit.

Email client checks aren't built in. They come from a plugin, which `validate()` and `render()` both take:

```tsx
import { emailClients } from "@hyper-elements/email-clients";

const { diagnostics } = validate(<Receipt />, {
  plugins: [await emailClients()],
});
```

See [Diagnostics](/docs/diagnostics).

## outline()

`outline(element)` prints the laid-out design: each block on a line under what holds it, with its width on desktop and what it shows (a heading's words, a link's URL, an image's alt text), and whether a Row stacks on phones. Use it to check a layout without reading HTML, in a test or from an AI coding agent.

```tsx
import { outline } from "@hyper-elements/react";

console.log(outline(<Receipt />));
```

<!-- output: receiptOutline -->
```text
Email 600px: background #f4f4f5
  Image 96px [Orbit] https://hyperelements.dev/img/orbit-logo.png
  Column 600px: background #ffffff
    Heading h1 536px "Thanks for your order, {{first_name}}"
    Text 536px "Order #10482 shipped. / Track it (https://example.com/orders/10482)"
    Table 536px
      TableRow 536px
        TableCell 268px "Item"
        TableCell 268px "Price"
      TableRow 536px
        TableCell 268px "Linen shirt"
        TableCell 268px "$48.00"
    Row 536px: 2 side by side, stacked on phones
      Column 260px
        Text 260px "Shipping to"
        Text 260px "Ada Lovelace, London"
      Column 260px
        Text 260px "Next steps"
        List 260px
          ListItem 236px "We pack it"
          ListItem 236px "You track it"
    Button: background #15132e "View your order" → https://example.com/orders/10482
  Text 600px "Orbit Inc., 1 Market St, San Francisco"
```

Like `render()`, it throws an `ElementsError` when the design has errors.

## The same input, the same output

A design renders the same every time. Rules that inline styles can't express (phone styles, hiding, hover) go in a stylesheet under short classes named after the rule's content, like `.e3k9fa`. The same rule always gets the same class, and the HTML gets no generated ids, only the `id`s you write. Snapshot tests stay stable, and diffs show real changes.

`renderPdf()` and `renderImage()` hold to the same rule: the same design writes the same bytes.

## Where it runs

`render()` runs on your server, with no network calls. It works in plain Node.js, and in Next.js route handlers, Server Components and Client Components' server render. Elements keeps none of its own state in React context, which Server Components don't have, so it renders there too.

`@hyper-elements/react/pdf` and `@hyper-elements/react/image` run in Node.js only.

Fetch your data before you render, and pass it in as props: `render()` doesn't wait for a component that's async or suspends (`jsx/async`).
