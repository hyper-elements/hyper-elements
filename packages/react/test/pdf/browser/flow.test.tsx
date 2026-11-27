/**
 * The print HTML drawn from a Document's plan (`render(design, { plan })`) has its PDF's pages: as many sheets when
 * Chromium prints it, each with the same words, nothing cut off its content's room, and a part that goes on to the next
 * page down to the room's foot. Chromium lays out the HTML; pdf.js
 * reads the PDF. Arial, the HTML's font, has Helvetica's widths, the PDF's.
 */
import { chromium, type Browser } from "playwright";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { ReactElement } from "react";
import { Column, Document, Heading, LineBreak, Link, PageFooter, PageHeader, PageNumber, Row, Section, Span, Table, TableCell, TableRow, Text, render } from "@hyper-elements/react";
import { renderPdf } from "../../../src/pdf";

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => browser?.close());

const font = { fontFamily: "Arial, Helvetica, sans-serif" };
const words = (text: string) => text.replace(/\s+/g, "");

/** Each PDF page's words. */
async function pdfPages(pdf: Uint8Array): Promise<string[]> {
  const document = await getDocument({ data: pdf.slice(), useSystemFonts: false, disableFontFace: true, verbosity: 0 }).promise;
  const pages: string[] = [];
  for (let n = 1; n <= document.numPages; n++) {
    const items = (await (await document.getPage(n)).getTextContent()).items.filter((item): item is { str: string } & typeof item => "str" in item);
    pages.push(words(items.map((item) => item.str).join("")));
  }
  return pages;
}

const designs: Record<string, ReactElement> = {
  "long text, a header and a footer": (
    <Document style={font}>
      <PageHeader>
        <Text style={{ fontSize: 10 }}>Quarterly report</Text>
      </PageHeader>
      <PageFooter>
        <Text style={{ fontSize: 10, textAlign: "right" }}>
          Page <PageNumber /> of <PageNumber total />
        </Text>
      </PageFooter>
      <Heading level={1}>Results</Heading>
      {Array.from({ length: 50 }, (_, i) => (
        <Text key={i}>{`Paragraph ${i + 1}: Elements writes the same design to email, the web, print and PDF, so this stands in for a section of a report.`}</Text>
      ))}
    </Document>
  ),
  "a justified paragraph with bold runs": (
    <Document style={font}>
      <Text style={{ textAlign: "justify" }}>
        {Array.from({ length: 200 }, (_, i) => (i % 7 === 3 ? <Span key={i} style={{ fontWeight: 700 }}>{`Sentence ${i + 1} in bold. `}</Span> : `Sentence ${i + 1} of one long paragraph. `))}
      </Text>
    </Document>
  ),
  "a table with a header row, in a padded Section": (
    <Document style={font}>
      <Section style={{ padding: 24, backgroundColor: "#f3f4f6" }}>
        <Table>
          <TableRow header>
            <TableCell>Item</TableCell>
            <TableCell>Amount</TableCell>
          </TableRow>
          {Array.from({ length: 70 }, (_, i) => (
            <TableRow key={i}>
              <TableCell>{`Row ${i + 1}`}</TableCell>
              <TableCell>$1.00</TableCell>
            </TableRow>
          ))}
        </Table>
      </Section>
    </Document>
  ),
  "a Row of Columns taller than a page, centered": (
    <Document style={font}>
      <Row style={{ gap: 16, justifyContent: "center" }}>
        <Column style={{ width: 360, padding: 8, backgroundColor: "#f3f4f6" }}>
          {Array.from({ length: 30 }, (_, i) => (
            <Text key={i}>{`Paragraph ${i + 1} of the long column, which goes on to the next pages in its own place.`}</Text>
          ))}
        </Column>
        <Column style={{ width: 200 }}>
          <Text>A short column beside it, which ends on the first page.</Text>
        </Column>
      </Row>
    </Document>
  ),
};

/** The designs whose pages end in a block that goes on to the next (a paragraph, a Section, a Row). */
const continuing = new Set(["a justified paragraph with bold runs", "a table with a header row, in a padded Section", "a Row of Columns taller than a page, centered"]);

describe("a Document's print HTML drawn from its plan", () => {
  for (const [name, design] of Object.entries(designs)) {
    it(`has its PDF's pages, each with the same words, nothing cut off: ${name}`, async () => {
      const { pdf, plan, diagnostics } = await renderPdf(design);
      expect(diagnostics).toEqual([]);
      const expected = await pdfPages(pdf);
      expect(expected.length).toBeGreaterThan(1);
      const { html } = await render(design, { plan });
      const page = await browser.newPage();
      await page.setContent(html);
      const sheets = await page.evaluate(() =>
        [...document.querySelectorAll(".elements-page")].map((sheet) => {
          const room = sheet.querySelector(":scope > div") as HTMLElement;
          const last = room.lastElementChild!;
          // How far above the room's foot its last block ends.
          return { words: (sheet as HTMLElement).innerText, overflow: room.scrollHeight - room.clientHeight, short: room.getBoundingClientRect().bottom - last.getBoundingClientRect().bottom };
        })
      );
      const printed = (await page.pdf({ preferCSSPageSize: true, printBackground: true })).toString("latin1").match(/\/Type\s*\/Page\b/g)?.length;
      await page.close();
      expect(sheets).toHaveLength(expected.length);
      expect(printed).toBe(expected.length);
      sheets.forEach((sheet, i) => {
        expect(words(sheet.words), `page ${i + 1}'s words`).toBe(expected[i]);
        expect(sheet.overflow, `page ${i + 1}'s content past its room`).toBeLessThanOrEqual(1);
        // A part that goes on to the next page fills the rest of its page, as its PDF's does.
        if (continuing.has(name) && i < sheets.length - 1) expect(sheet.short, `page ${i + 1}'s part that goes on, short of the room's foot`).toBeLessThanOrEqual(1);
      });
    });
  }

  it("is drawn as before without a plan: its content cut off its page, which says so", async () => {
    const design = designs["long text, a header and a footer"];
    const { html, diagnostics } = await render(design);
    expect(diagnostics.map((d) => d.code)).toContain("document/overflow");
    expect(html.match(/class="elements-page"/g)).toHaveLength(1);
  });

  it("keeps a split paragraph's blank line as tall as its PDF does: a letter's line between its greeting and its body", async () => {
    // Between two line breaks, nothing or spaces only (in a Link too): a line the browser would draw 0 tall.
    for (const blank of ["", "   ", <Link href="https://example.test/terms">{"   "}</Link>]) {
      const design = (
        <Document size="A5" style={font}>
          <Text id="letter">
            Dear Ms Rivera,
            <LineBreak />
            {blank}
            <LineBreak />
            Thank you for your order. {"Each clause sets out what each party agrees to. ".repeat(60).trimEnd()}
          </Text>
        </Document>
      );
      const what = typeof blank === "string" ? JSON.stringify(blank) : "spaces in a Link";
      const { pdf, plan } = await renderPdf(design);
      expect(plan.pages.length, what).toBeGreaterThan(1);
      // In the PDF, its greeting's baseline over its body's, in px: two lines of 24.
      const items = (await (await (await getDocument({ data: pdf.slice(), useSystemFonts: false, disableFontFace: true, verbosity: 0 }).promise).getPage(1)).getTextContent()).items;
      const baseline = (word: string) => (items.find((item) => "str" in item && item.str.startsWith(word)) as { transform: number[] }).transform[5];
      expect((baseline("Dear") - baseline("Thank")) / 0.75, what).toBeCloseTo(48, 1);
      const page = await browser.newPage();
      await page.setContent((await render(design, { plan })).html);
      const lines = await page.locator("#letter").evaluate((paragraph) => [...paragraph.children].slice(0, 3).map((line) => line.getBoundingClientRect().top));
      await page.close();
      expect(lines[2] - lines[0], what).toBeCloseTo(48, 1);
    }
  });
});
