# Invoice / PDF example

One invoice design, written with `@hyper-elements/react`, renders to print-ready HTML and then to a real PDF via Playwright. It demonstrates the `<Document>` root, `<Table>` for line items, subtotal / tax / total, a status badge (Paid / Due / Overdue), and `<PageFooter>` with page numbers.

All commands run from the repository root with **Node.js 20+** and **pnpm 9**.

## Install and run

```bash
pnpm install
pnpm build
pnpm --filter @hyper-elements/example-invoice-pdf exec playwright install chromium
pnpm --filter @hyper-elements/example-invoice-pdf render
```

Output files are written to `examples/invoice-pdf/output/`:

| File | Description |
|------|-------------|
| `invoice.document.html` | Print-ready HTML (`@page { size: A4 }`, CSS columns, no Outlook tables) |
| `invoice.pdf` | A4 PDF printed by Chromium from that HTML |

## How it works

### 1 — Render the Document to HTML

```ts
import { render } from "@hyper-elements/react";
import { invoiceDocument, sampleInvoice } from "./invoice.js";

const { html } = await render(invoiceDocument(sampleInvoice));
// html is a complete, self-contained HTML document with @page CSS.
```

`<Document size="A4">` tells Elements to write print HTML. The same `InvoiceData` object can drive an `<Email>` or `<Page>` by swapping the root — one component tree, every output.

### 2 — Convert the HTML to a PDF with Playwright

```ts
import { chromium } from "playwright";

export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.emulateMedia({ media: "print" });
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(Array.from(document.images, (img) => img.decode()));
    });
    // <Document size="A4"> already writes the @page CSS — no format or margin
    // overrides needed here.
    return await page.pdf({ preferCSSPageSize: true, printBackground: true });
  } finally {
    await browser.close();
  }
}
```

**Puppeteer** works the same way — replace `chromium.launch()` with `puppeteer.launch()` and `page.emulateMedia({ media: "print" })` with `page.emulateMediaType("print")`. The `pdf()` call is identical.

**Browserless alternative**: [`renderPdf()`](../../packages/react/docs/react-to-pdf.md) from `@hyper-elements/react/pdf` writes a PDF without Chromium using react-pdf.

## Invoice features

- **`<Table>` line items** — `<TableRow header>` for the column headers; one `<TableRow>` per line with description, quantity, unit price, and amount.
- **Subtotal / tax / total** — computed at render time from the data; never stored as markup.
- **Status badge** — `Paid`, `Due`, or `Overdue`, controlled by `data.paidOn`.
- **Payment details** — pay-online link and bank-transfer note, hidden when `paidOn` is set.
- **`<PageFooter>` with `<PageNumber>`** — repeats on every page when the table spans multiple pages.

## Run the tests

```bash
pnpm --filter @hyper-elements/example-invoice-pdf test
```

Tests verify HTML structure (invoice content, table headers, subtotal/tax/total, status badge) and that `htmlToPdf()` returns valid A4 PDF bytes.

## Adapt to your data

Replace `sampleInvoice` with your own `InvoiceData`. The `currency` and `lang` fields control `Intl.NumberFormat`; set them to match your locale.
