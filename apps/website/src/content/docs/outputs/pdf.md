---
title: "PDF"
description: "Render a Document root to print-ready HTML, or to a PDF file with @hyper-elements/react/pdf on the server, with no browser and no network."
---

A `<Document>` root lays its content out on pages of a fixed size, with a header and a footer on each. `render()` writes it as print-ready HTML, and `renderPdf()` from `@hyper-elements/react/pdf` writes it as a PDF, on your server, with no headless Chrome.

```tsx
import { readFile, writeFile } from "node:fs/promises";
import { Document, Heading, Image, PageBreak, PageFooter, PageHeader, PageNumber, Text, Table, TableCell, TableRow } from "@hyper-elements/react";
import { renderPdf } from "@hyper-elements/react/pdf";

const Invoice = () => (
  <Document size="A4" margin={48} title="Invoice 2705" style={{ fontFamily: "Inter, sans-serif", gap: 16 }}>
    <PageHeader style={{ padding: [0, 0, 16, 0] }}>
      <Image src={{ src: "https://cdn.acme.com/logo.png", width: 240, height: 80 }} alt="Acme" style={{ width: 120 }} />
    </PageHeader>
    <Heading level={1}>Invoice 2705</Heading>
    <Text>Thank you for your order.</Text>
    <Table style={{ cellPadding: [8, 0], rowBorder: "1px solid #e4e4e7" }}>
      <TableRow header>
        <TableCell>Item</TableCell>
        <TableCell style={{ textAlign: "right" }}>Price</TableCell>
      </TableRow>
      <TableRow>
        <TableCell>Linen shirt</TableCell>
        <TableCell style={{ textAlign: "right" }}>$48.00</TableCell>
      </TableRow>
    </Table>
    <PageBreak />
    <Heading level={2}>Terms</Heading>
    <Text>Payment is due in 30 days.</Text>
    <PageFooter>
      <Text style={{ fontSize: 10, textAlign: "right" }}>
        Page <PageNumber /> of <PageNumber total />
      </Text>
    </PageFooter>
  </Document>
);

const { pdf, diagnostics } = await renderPdf(<Invoice />, {
  fonts: [
    { family: "Inter", src: await readFile("fonts/Inter-Regular.ttf") },
    { family: "Inter", src: await readFile("fonts/Inter-Bold.ttf"), weight: 700 },
  ],
  images: { "https://cdn.acme.com/logo.png": await readFile("images/logo.png") },
});
for (const { code, message } of diagnostics) console.warn(code, message);
await writeFile("invoice.pdf", pdf);
```

## Install

```bash
npm install @hyper-elements/react @react-pdf/renderer react react-dom
```

| Peer dependency | Version | Why |
|-----------------|---------|-----|
| `@react-pdf/renderer` | `^4.9.0` (optional: only for `/pdf`) | Draws the pages |
| `react`, `react-dom` | `>=18` | |

`/pdf` is an entry of `@hyper-elements/react`. Its engine is an optional peer dependency, so a project that doesn't import `/pdf` installs nothing for it, and the main entry never loads it.

It runs in Node.js only. If it loads a second copy of `@hyper-elements/react` that lays designs out in another version, `renderPdf()` throws an `ElementsError` (`pdf/version`) rather than drawing the design wrong.

## The Document

| Prop | Takes | Default |
|------|-------|---------|
| `size` | `"A3"`, `"A4"`, `"A5"`, `"Letter"`, `"Legal"`, `"Tabloid"` | `"A4"` |
| `orientation` | `"portrait"`, `"landscape"` | `"portrait"` |
| `margin` | Insets around each page's content, its header and footer too, in px at 96 to the inch | 48 on every side |
| `title`, `lang`, `dir`, `fonts` | As on every root | |

A Document's width comes from its size and margin: an A4 page with 48px margins has 698px of content. It has no phone layout, so `mobile` styles are an error in one.

### Pages

The content goes on pages in one of two ways:

- **Runs split by [`PageBreak`](/docs/elements/pagebreak).** What follows a `PageBreak` starts the next page.
- **[`Document.Page`](/docs/elements/document-page)s.** Each one is a page, its children stacked inside the Document's margins.

```tsx
<Document size="Letter" orientation="landscape">
  <Document.Page style={{ gap: 16 }}>
    <Heading>Q3 report</Heading>
    <Text>Revenue grew 12%.</Text>
  </Document.Page>
  <Document.Page style={{ gap: 16 }}>
    <Heading level={2}>Details</Heading>
  </Document.Page>
</Document>
```

### Header, footer and page numbers

One [`PageHeader`](/docs/elements/pageheader) and one [`PageFooter`](/docs/elements/pagefooter) are drawn on every page, inside its margins. A second of either is an error. A [`PageNumber`](/docs/elements/pagenumber) in their text, or anywhere in the Document's text, is the number of the page it's on, and `<PageNumber total />` is how many pages there are.

A table row with `footer` ends the table.

## Print HTML

`render()` writes a Document as print HTML: a box of the paper's size for each page, with the header and footer in each, and a CSS `@page` rule for the paper's size and orientation, with no page margin.

```tsx
import { render } from "@hyper-elements/react";

const { html } = await render(<Invoice />);
```

Open it in a browser to look at the pages, or print it. If you print it to PDF with Playwright, pass `preferCSSPageSize: true` and `printBackground: true` to `page.pdf()`, and set the margin on the Document: a `margin` passed to `page.pdf()` changes nothing, since each page draws its own.

## renderPdf()

`renderPdf(element, options)` returns `{ pdf, diagnostics }`: the file's bytes, and the warnings and notes. Errors reject with an `ElementsError` listing them. Its pages, header, footer and page numbers are the print HTML's, laid out at the same widths.

The same design writes the same bytes. The `date` option is when the PDF says it was made: a fixed date by default, which is what keeps the bytes the same. Pass `new Date()` if you want the real one.

| Option | What it takes |
|--------|---------------|
| `fonts` | Font files, by family (below) |
| `images` | Image files, by URL (below) |
| `date` | When the PDF says it was made, a fixed date by default |

### Fonts and images

Nothing is fetched. Give each file the design needs, as bytes:

- **Fonts** in `fonts`: `{ family, src, weight?, style? }`, one entry per file. `src` is a TTF, OTF or WOFF file's bytes. `family` is the name your `fontFamily` stacks use. The files in a Document's `fonts` prop are for its HTML: `renderPdf()` doesn't load them, `data:` URIs included.
- **Images** in `images`, by the URL the design gives them (`{ "https://…/logo.png": bytes }`), or as `data:` URIs in the design. A PDF draws PNG and JPEG.

Text whose `fontFamily` has no file given is drawn in a standard PDF font: Helvetica, Times or Courier, whichever is closest. Those draw Western European characters only. For any other script, give a font file that has it.

A `Video` shows its thumbnail where its file is given (its own, or a YouTube video's by the URL `img.youtube.com/vi/<id>/0.jpg`), and otherwise its title, linked to the video.

### Diagnostics

| Code | Severity | When |
|------|----------|------|
| `pdf/root` | error | The design isn't a Document |
| `pdf/version` | error | A second copy of `@hyper-elements/react` lays the design out in another version |
| `pdf/image` | error | An image isn't given, or its file isn't a PNG or JPEG |
| `pdf/image` | warning | An image is SVG: its alt text is shown in its box (in a line of text, its room is left empty) |
| `pdf/font` | warning | A font in the Document's `fonts` isn't given, a file given is WOFF2, or text in a standard PDF font has characters it can't draw |
| `pdf/font-weight` | warning | Text in a weight or style of a family that isn't given. It's drawn in the nearest file given |
| `pdf/unsupported` | warning | What a PDF can't show that the HTML can: a hover, a Video's player, an `Html` block's markup (its plain text is drawn), a line too wide to wrap (it goes past the edge) |
| `pdf/layout` | warning | The installed `@react-pdf/renderer` doesn't say where it laid the PDF out, so content that doesn't fit a page isn't moved on to the next: update it |
| `pdf/layer` | warning | Text laid over a Layer is taller than the Layer (its first child), which the PDF doesn't draw |
| `pdf/measure` | warning | A paginator measured a block without drawing it as a guess (react-pdf may lay it out otherwise): its pages from there on may differ from the PDF's. `renderPdf()` and `paginate()` measure it exactly |
| `document/overflow` | warning | A page's content is taller than its room (the page less its margins, header and footer), measured with its fonts. Named at the first block cut off |

`validate()` from `@hyper-elements/react` reports `pdf/unsupported` and `document/overflow` without rendering. Without the fonts its `document/overflow` is an estimate, and it can miss a page that's only a little too tall. The font and image checks need the files, so `renderPdf()`, `paginate()` and a paginator make them, and measure.

### Pages that flow

Content that doesn't fit its page goes on to the next, with the `PageHeader` and `PageFooter` on each page and each `PageNumber` numbered for the pages there are:

- **Text** splits between its lines, leaving two lines at least on each side. Text written right to left is laid out right to left and splits the same way.
- **A Section, a Column and a List** split between and inside what they hold. A Section's top padding and border stay on its first part, its bottom ones on its last. A part that goes on to the next page fills the rest of its page, its background down to the page's foot.
- **A Row of Columns** that fits on a page goes on to the next whole. One taller than a page goes on by its columns, each in its own place, a column that has ended keeping its room empty.
- **A Table** splits between its rows, and its header rows start each page it goes on to.
- **A Heading** isn't left last on a page: it goes on with what follows it.
- **A `Document.Page`** that's too long goes on to pages after it, with its background. A `PageBreak` still starts a new page.

A Document whose pages fit is drawn once, as written. One that doesn't is drawn a second time, flowed.

For print HTML with the same pages, draw it from the PDF's plan:

```tsx
const { pdf, plan } = await renderPdf(design, { fonts });
const { html } = await render(design, { plan });
```

`paginate(design, { fonts })` gives the plan alone, measured without drawing the PDF: install `@react-pdf/textkit` beside `@react-pdf/renderer` for that (without it, `paginate()` draws the PDF to measure it). A plan is drawn only for the Document it was made from: `render()` draws one made from another version of it as written, with a `render/plan` warning.

### Pages as a Document is edited

`createPaginator({ fonts, images })` takes `renderPdf()`'s options and makes a paginator for Documents drawn with those fonts. It reads the fonts once and keeps each block of text it lays out, so paginating again after a keystroke lays out only the paragraph that changed. Its `paginate()` answers at once, with `paginate()`'s plan and diagnostics; `{ diagnostics: false }` gives the plan alone, faster:

```tsx
import { createPaginator } from "@hyper-elements/react/pdf";

const paginator = await createPaginator({ fonts });
const { plan } = paginator.paginate(design, { diagnostics: false });
```

It runs in Node, in a browser and in a Worker, to the same plan in each. On a laptop, a 28-page report is paginated again in about 7ms after a keystroke (12ms with its diagnostics). It needs `@react-pdf/textkit`.

### Lines and carets

A paginator's `paginate(design, { layout: true })` also gives its `layout`: `layoutDocument()`'s pages and nodes, each text node with its `text` and its `lineBoxes`, each line's characters in that text, its box, its baseline, and where a caret goes between its characters. `caretAt()`, `caretBox()` and `selectionBoxes()` read it:

```tsx
import { caretAt, caretBox, selectionBoxes } from "@hyper-elements/react/pdf";

const { layout } = paginator.paginate(design, { layout: true });
const caret = caretAt(layout, { page: 1, x: 120, y: 300 }); // the nearest: { path, offset, page, affinity }
const box = caretBox(layout, caret); // where it's drawn: { page, x, y, height }
const boxes = selectionBoxes(layout, { path: caret.path, start: 0, end: 20 });
```

Each character is where the PDF draws its glyph. Text written right to left runs from its right, a caret never goes inside a character, and `affinity` says where an offset in two places goes: the end of a line or the start of the next. `caretAt()` gives the side it found, so `caretBox()` of it is where it was found. An empty text, and the end of one that ends in a line break, have a caret too, where the first character would go.

### Pages drawn for a page view

A paginator's `paginate(design, { svg: true })` gives each page drawn as an SVG where its PDF draws everything: boxes, images, and each word from where its characters are. It's shown in px, its coordinates the PDF's points, so the layout's carets are over it. `fontFaces(fonts)` gives the font files as @font-face rules: in a page with them, each glyph is where the PDF draws it.

```tsx
const { svg } = paginator.paginate(design, { svg: true });
style.textContent = fontFaces(fonts);
view.innerHTML = svg.join("");
```

For a long Document, ask for the pages a view shows: `paginate(design, { layout: { pages: [4, 5] }, svg: { pages: [4, 5] } })` lays out and draws those only, and the plan is still all of it. Each plan page has a `hash` of what's drawn on it: draw again only the pages whose hash changed. With `svg: { shareImages: true }`, each image is defined once in `svgImages`, which goes in the page before them, and the pages draw it from there.

### A builder design's pages

A Document made in the Unlayer editor can follow the same plan, so the editor shows the PDF's pages. `fromDesign()` returns `parts`, the part of the builder design each node of its `element` stands for, and `designPages(plan, parts)` lists each page's parts of the design: where each is in the design's body (`at`) and its id there, in the order they're drawn, each with whether it starts (`first`) and ends (`last`) on the page. A row or a column is listed where the template has a node for it: a plain one-column row is its blocks, so they're listed without the row and its column (each block's `at` still names them).

```tsx
import { fromDesign } from "@hyper-elements/react/builder";
import { designPages, paginate } from "@hyper-elements/react/pdf";

const { element, parts } = fromDesign(saved, { displayMode: "document" });
const pages = designPages((await paginate(element, { fonts })).plan, parts);
```

The plan splits text between its lines and a Row between its columns: where an editor moves whole blocks to the next page instead, its pages differ there.

### Where everything landed

`layoutDocument(design, { fonts, images })` takes `renderPdf()`'s options and gives the Document as its PDF lays it out:

- `pages`: each page's paper, and its room, the part below its header and above its footer, in px from its top.
- `nodes`: each block of the design on each page, with its box in px from the page's top left and a block of text's `lines`. A block that goes on to the next page has a node on each page, its `part` (from 0) and, for text, the `chars` of its text it shows. A PageHeader's and a PageFooter's blocks are on every page. `cut` is `"some"` where a cut goes through it and `"all"` where it's past the room: neither is drawn whole.
- `diagnostics`: `renderPdf()`'s.

```tsx
import { layoutDocument } from "@hyper-elements/react/pdf";

const { nodes } = await layoutDocument(<Invoice />, { fonts });
const total = nodes.find((node) => node.id === "total");
if (total?.page !== 1 || total.cut) throw new Error("The total isn't on page 1");
```

It draws the PDF to measure it, so it takes as long as `renderPdf()`.

## Limits

- **Some blocks stay whole.** An image, an `Svg`, a Button, a block with a set height, and a Row whose columns sit at its middle or end (or wrap) don't split between pages. One taller than a page is cut off where it is, and you get `document/overflow`, measured.
- **Text that changes direction across a line break** (Arabic quoted in an English paragraph, broken inside the quote) can sit up to a space's width from where the whole paragraph would set it, when the paragraph is split between pages.
- **The print HTML flows only when it's drawn from a plan.** Plain `render()` has no font files to measure with, so its pages hold what they're given.
- **WOFF2 isn't drawn.** react-pdf would embed its letters blank. Give TTF, OTF or WOFF.
- **SVG images aren't drawn.** Give a PNG or JPEG. An `Svg` element is drawn as vectors.
- **The standard PDF fonts draw Western European characters only.** Whether a font file you give has every character isn't checked.
- **No hover and no video player.** A Button shows its own colors, a Video its thumbnail or title.
