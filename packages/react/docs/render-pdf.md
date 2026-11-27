# PDF output: `@hyper-elements/react/pdf`

PDF output for [Hyper Elements](https://github.com/hyper-elements/hyper-elements): a `<Document>` from `@hyper-elements/react` written as a PDF on the server, with react-pdf, without a browser or the network. Its pages, header, footer and page numbers are the print HTML's, laid out at the same widths.

## Installation

```bash
npm install @hyper-elements/react @react-pdf/renderer react
```

`/pdf` is an entry of `@hyper-elements/react`. Its engine is an optional peer dependency, so a project that doesn't import `/pdf` installs nothing for it, and the main entry never loads it:

| Package | Version | Why |
|---------|---------|-----|
| `@hyper-elements/react` | `^0.3.0` | The elements, and this entry |
| `@react-pdf/renderer` | `^4.9.0` | Draws the pages (optional: only for `/pdf`) |
| `@react-pdf/textkit` | `^7.0.1` | Measures the pages without drawing them, for `paginate()` and `createPaginator()` (optional: without it, `paginate()` draws the PDF to measure it, and `createPaginator()` rejects) |
| `react` | `>=18` | |

The tree `prepare()` lays out says its format (its layout version), and `renderPdf` reads the one it's built with. Where the `@hyper-elements/react` it loads writes another (a second install beside it), it throws an `ElementsError` (`pdf/version`) rather than drawing the design wrong.

Node.js only: it writes the PDF on the server.

## Quick Start

```tsx
import { readFile, writeFile } from "node:fs/promises";
import { Document, Heading, Image, PageFooter, PageNumber, Text } from "@hyper-elements/react";
import { renderPdf } from "@hyper-elements/react/pdf";

const Invoice = () => (
  <Document size="A4" margin={48} title="Invoice 2705" style={{ fontFamily: "Inter, sans-serif" }}>
    <Image src={{ src: "https://cdn.acme.com/logo.png", width: 240, height: 80 }} alt="Acme" style={{ width: 120 }} />
    <Heading level={1}>Invoice 2705</Heading>
    <Text>Thank you for your order.</Text>
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
await writeFile("invoice.pdf", pdf);
```

`renderPdf(element, options)` returns `{ pdf, diagnostics }`: the file's bytes, and the warnings and notes. Errors reject with an `ElementsError` listing them. The same design writes the same bytes (`date`, a fixed date by default, is when the PDF says it was made).

## Fonts and images are given as bytes

Nothing is fetched. Give each file the design needs:

- **Fonts** in `fonts`: `{ family, src, weight?, style? }`, one entry per file, `src` a TTF, OTF or WOFF file's bytes. `family` is the name the design's `fontFamily` stacks use. The files in a Document's `fonts` prop are its HTML's: `renderPdf` doesn't load them, `data:` URIs included.
- **Images** in `images`, by the URL the design gives them (`{ "https://…/logo.png": bytes }`), or as `data:` URIs in the design. A PDF draws PNG and JPEG. A Video shows its thumbnail where its file is given (its own, or a YouTube video's by the URL `img.youtube.com/vi/<id>/0.jpg`), else its title, linked to the video.

Text whose `fontFamily` has no file given is drawn in a standard PDF font: Helvetica, Times or Courier, whichever is closest.

## Diagnostics

| Code | Severity | When |
|------|----------|------|
| `pdf/root` | error | The design isn't a Document |
| `pdf/version` | error | The `@hyper-elements/react` loaded lays the design out in another layout version than `/pdf` reads |
| `pdf/image` | error | An image isn't given, or its file isn't a PNG or JPEG |
| `pdf/image` | warning | An image is SVG: its alt text is shown in its box (in a line of text, its room is left empty) |
| `pdf/font` | warning | A font in the Document's `fonts` isn't given; a file given is WOFF2; or text in a standard PDF font has characters it can't draw (it draws Western European ones only) |
| `pdf/font-weight` | warning | Text in a weight or style of a family that isn't given: it's drawn in the nearest file given |
| `pdf/unsupported` | warning | What a PDF can't show that the HTML can: a hover, a Video's player |
| `pdf/layout` | warning | The installed `@react-pdf/renderer` doesn't say where it laid the PDF out, so content that doesn't fit a page isn't moved on to the next: update it |
| `pdf/layer` | warning | Text laid over a Layer is taller than the Layer (its first child), which the PDF doesn't draw |
| `pdf/measure` | warning | A paginator measured a block without drawing it as a guess (react-pdf may lay it out otherwise): its pages from there on may differ from the PDF's. `renderPdf()` and `paginate()` measure it exactly |
| `document/overflow` | warning | A page's content is taller than its room (the page less its margins, header and footer), measured with its fonts. Named at the first block cut off |

`validate()` from `@hyper-elements/react` reports `pdf/unsupported` and `document/overflow` without rendering. Without the fonts its `document/overflow` is an estimate. The font and image checks need the files, so `renderPdf`, `paginate()` and a paginator make them, and measure.

## Pages that flow

Content that doesn't fit its page goes on to the next, with the Document's `PageHeader` and `PageFooter` on each page and each `PageNumber` numbered for the pages there are:

- **Text** splits between its lines, leaving two lines at least on each side. Text written right to left (`dir="rtl"`, or `"auto"` and its first letter Hebrew or Arabic) is laid out right to left and splits the same way.
- **A Section, a Column and a List** split between and inside what they hold. A Section that's cut keeps its top padding and border on its first part and its bottom ones on its last. A part that goes on to the next page fills the rest of its page, its background down to the page's foot, as a browser draws a box broken between pages.
- **A Row of Columns** that fits on a page goes on to the next whole. One taller than a page goes on by its columns: each in its own place, split its own way, a column that has ended keeping its room empty.
- **A Table** splits between its rows, and its header rows (`<TableRow header>`) start each page it goes on to.
- **A Heading** isn't left last on a page: it goes on with what follows it.
- **A `Document.Page`** that's too long goes on to pages after it, with its background. A `PageBreak` still starts a new page.

A Document whose pages fit is drawn once, as written; one that doesn't is drawn a second time, flowed, a paragraph split between pages drawn line by line as it was laid out.

The print HTML has the same pages when it's drawn from the PDF's plan:

```tsx
import { render } from "@hyper-elements/react";
import { paginate, renderPdf } from "@hyper-elements/react/pdf";

const { pdf, plan } = await renderPdf(design, { fonts });
const { html } = await render(design, { plan }); // the same pages, the same words on each

// Or the plan alone, without drawing the PDF: const { plan } = await paginate(design, { fonts });
```

`paginate()` measures the pages with react-pdf's own text layout (`@react-pdf/textkit`, the same package react-pdf draws with) and its layout's arithmetic, without drawing them: the plan is the one `renderPdf()` makes from the PDF it draws, line for line. `renderPdf()` draws first: a Document that fits is drawn once, as it always was.

A paginator measures a block it doesn't follow exactly (text laid over a Layer that wraps, an image whose file it can't read) as a guess, and says so with a `pdf/measure` warning naming it: a page view keeps working, its pages from that block on maybe not the PDF's. `paginate()` and `renderPdf()` measure it exactly, by drawing.

A plan is drawn only for the Document it was made from: it carries a hash of it (`design`), and `render()` draws one made from another version (a page view's, a keystroke old) as written, with a `render/plan` warning. Where the installed `@react-pdf/textkit` isn't the one `@react-pdf/renderer` lays text out with (another version beside it), `paginate()` draws the PDF to measure it, and `createPaginator()` rejects.

## Pages as a Document is edited

`createPaginator(options)` takes `renderPdf`'s options and makes a paginator for Documents drawn with those fonts and images. It loads and reads the fonts once, and keeps each block of text it lays out, so paginating again after a keystroke lays out only the paragraph that changed. Its `paginate()` answers at once (it isn't a Promise), with `paginate()`'s plan and diagnostics. With `{ diagnostics: false }` it gives the plan alone, without the measuring its diagnostics take: for pages kept up to date as someone types.

```tsx
import { createPaginator } from "@hyper-elements/react/pdf";

const paginator = await createPaginator({ fonts });

// On each edit:
const { plan } = paginator.paginate(design, { diagnostics: false });
```

- **Anywhere:** it runs in Node, in a browser and in a Worker, with react-pdf's browser build (which bundlers pick); it uses nothing of Node's. A Document is paginated to the same plan in each.
- **Fast:** on a laptop, a 28-page report is paginated again in about 7ms after a keystroke (12ms with its diagnostics), where `paginate()` takes about 65ms.
- **Its fonts:** text in a font it wasn't given is drawn in a standard PDF font, as `renderPdf()` draws it. Make another paginator for other fonts.
- `cacheSize` sets how many blocks of text it keeps laid out (10,000 by default).

## Where each line is, and where a caret goes

A paginator's `paginate(design, { layout: true })` gives its `layout` too, without drawing the PDF: `layoutDocument()`'s pages and nodes, each text node with its `text` (as its PDF draws it) and its `lineBoxes`. Each line has:

- its characters in the node's `text`: `start` and `end`, in UTF-16 code units (as a JavaScript string counts them);
- its box, in px from its page's top left: `x` and `width` (from its leftmost character to its rightmost), `y` and `height`, and its `baseline`;
- its `runs`: its characters in runs each written one way (`rtl` where right to left), each with its `carets`, where a caret goes before each character and after its last.

A ListItem's, a TableCell's and a Button's text is their own. Three plain functions of the layout read it, so a page view can paginate in a Worker and find a caret where the pointer is:

```tsx
import { caretAt, caretBox, createPaginator, selectionBoxes } from "@hyper-elements/react/pdf";

const { layout } = paginator.paginate(design, { layout: true });
const caret = caretAt(layout, { page: 1, x: 120, y: 300 }); // { path, offset, page, affinity }: the nearest
const box = caretBox(layout, caret); // { page, x, y, height }: where it's drawn
const boxes = selectionBoxes(layout, { path: caret.path, start: 0, end: 20 }); // a box for each stretch on each line
```

- **Where the PDF draws it:** each character is where its glyph is, with the spaces justified or squeezed to fit; a glyph drawn for several characters (a ligature) shares its width between them.
- **Right to left:** text written right to left runs from its right, and words written left to right in it from their left. A selection across them has a box for each stretch drawn apart.
- **Between characters:** a caret never goes inside one (a UTF-16 pair, or a letter and its accent).
- **Two places:** where an offset is in two (the end of a line and the start of the next, or where text written one way meets text written the other), `affinity` says which: `"after"` (by default) or `"before"`. `caretAt()` gives the side it found the caret on, so `caretBox()` of it is where it was found. A node in a PageHeader or PageFooter is on every page, with that page's text (its page number): give `page` for its caret on one.
- **No characters:** an empty text, and the end of one that ends in a line break, have a line with no characters, as tall as one of its text and where its first character would go, so a caret goes there too. The PDF draws nothing for it.

A keystroke on a 28-page report is laid out again with its lines in about 12ms. To draw text where its carets are, draw it in the same font files.

## Pages drawn for a page view

A paginator's `paginate(design, { svg: true })` gives each page drawn as an SVG, without drawing the PDF: everything where its PDF draws it. Each box's background and borders, each image and drawing, each word from where its characters are; nothing is laid out again. It's shown in px, its coordinates the PDF's points, so a layout's px (and its carets) are over it:

```tsx
import { createPaginator, fontFaces } from "@hyper-elements/react/pdf";

const paginator = await createPaginator({ fonts });
const { svg, layout } = paginator.paginate(design, { svg: true, layout: true });

style.textContent = fontFaces(fonts); // once: the font files, as @font-face rules
view.innerHTML = svg.join(""); // a page view, each page as its PDF draws it
```

- **The same fonts:** its text is drawn in the families the Document names. `fontFaces(fonts)` gives an @font-face for each file a paginator is given: in a page with them, Chromium draws each glyph where the PDF does (within a twentieth of a point, tested). Text in a standard PDF font is drawn in the browser's nearest (Arial has Helvetica's widths), so it's close, not exact.
- **Text written right to left** is drawn a word at a time from its right, so its letters join as they do in the PDF.
- **The pages a view shows:** `layout: { pages: [4, 5] }` and `svg: { pages: [4, 5] }` lay out and draw those pages only (from 1, as planned); the plan is always all of it. Each plan page has a `hash` of what's drawn on it, the same where nothing on it changed: draw again only the pages whose hash did. `svg: { shareImages: true }` defines each image once, in `svgImages` (an SVG of symbols to put in the page before the pages), and each page draws it from there: a long Document's header image is in the page once, not in every page (its ids come from its files, so a page drawn before still finds it). A layout of some pages has `only`, and `caretAt()` asked of another page says so. A 108-page report is paginated with two pages laid out and drawn in about 40ms on a laptop, or about 26ms given as a Snapshot (`snapshot(design)`): a React element is rendered to read it, each time. Each keystroke is the whole Document's work, so it grows with the Document. In a page view, do it in a Worker.

## A builder design's pages

A Document made in the Unlayer editor can be paginated by this plan too, so the editor and every output show the same pages. `fromDesign()` from `@hyper-elements/react/builder` returns `parts`: the part of the design each node of its `element` stands for, by its path. `designPages(plan, parts)` turns a plan of that `element` into each page's parts of the design:

```tsx
import { fromDesign } from "@hyper-elements/react/builder";
import { designPages, paginate } from "@hyper-elements/react/pdf";

const { element, parts } = fromDesign(saved, { displayMode: "document" });
const { plan } = await paginate(element, { fonts });
const pages = designPages(plan, parts);
// pages[1]: [{ at: "rows[3].columns[0].contents[0]", id: "u_content_table_1", first: false, last: true },
//            { at: "rows[3].columns[0].contents[0].values.table.headers[0]", first: true, last: true }, …]
```

- **Each part:** `at` is where it is in the design's body (a row `rows[3]`, a column, a block, a table's `….values.table.rows[12]`), and `id` its id there (`values._meta.htmlID`), where it has one.
- **Each page** lists every part with something on it, in the order it's drawn (a row before its columns, a column before its blocks, a table before its rows), each once. A row or a column is listed where the template has a node for it: a row with several columns, a background or a look of its own, a column with a box of its own. A plain one-column row is its blocks in the template, so they're listed without the row and its column (each block's `at` still names them). `first` says the part starts on the page, `last` that it ends there; a part whole on the page is both. A table's header rows are on each page it runs to; the Document's header and footer are on every page and listed on none.
- **The same design:** `parts` holds for that `element` and that design. A design written again by `toDesign()` has ids of its own. A place is in the design as the builder loads it: a value the design leaves out is its tool's default (a table saved without its `table` value has the table tool's rows).
- **Where pages break inside a block:** the plan splits text between its lines and a Row between its columns. Where an editor moves whole blocks to the next page, its pages differ there.

## Where everything landed

`layoutDocument(design, options)` takes `renderPdf`'s options and gives the Document as its PDF lays it out, in px:

- `pages`: each page's `width` and `height`, and its `room` (`top` and `bottom`: below its header, above its footer).
- `nodes`: each block of the design on each `page` it's on, with `path`, `id`, `field`, `type`, its box (`x`, `y`, `width`, `height` from the page's top left) and a block of text's `lines`. A block that goes on to the next page has a node on each, numbered by `part` (from 0); a block of text's says which characters of its text it shows (`chars`). `cut` is `"some"` or `"all"` where the page's room ends before it does. A PageHeader's and a PageFooter's blocks are on every page.
- `diagnostics`: `renderPdf`'s.

It draws the PDF to measure it.

## Known limits

- **WOFF2 isn't drawn**: react-pdf would embed its letters blank. Give TTF, OTF or WOFF.
- **SVG images aren't drawn**: give a PNG or JPEG. An `Svg` (the element) is drawn as vectors.
- **The standard PDF fonts draw Western European characters only.** For any other script, give a font file that has it. Whether a file given has every character isn't checked.
- **What stays whole**: an image, an `Svg`, a Button, a block with a set height, and a Row whose columns sit at its middle or end (or wrap) don't split between pages. One taller than a page is cut off where it is, with `document/overflow`.
- **Text that changes direction across a line break** (Arabic quoted in an English paragraph, broken inside the quote) can be drawn up to a space's width from where the whole paragraph would set it, when its paragraph is split between pages. Its words and lines are the same.
- **The print HTML flows only when it's drawn from a plan** (`render(design, { plan })`): plain `render()` has no font files to measure with, so its pages hold what they're given and cut the rest.
- **No hover, no video player**: a Button shows its own colors, a Video its thumbnail or title.

## License

MIT
