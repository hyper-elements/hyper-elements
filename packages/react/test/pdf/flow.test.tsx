/**
 * A Document's content that doesn't fit its page goes on to the next: each PDF read back with pdf.js (the words on
 * each page) and laid out with layoutDocument() (where each block landed).
 */
import { readFileSync } from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { Column, Document, Heading, Image, Layer, LineBreak, List, ListItem, PageBreak, PageFooter, PageHeader, PageNumber, prepare, render, Row, Section, Span, Table, TableCell, TableRow, Text, Video } from "@hyper-elements/react";
import type { PlannedPart } from "@hyper-elements/core";
import { reactPdf, writeDocument } from "@hyper-elements/core/pdf";
import { createPaginator, designPages, layoutDocument, paginate, renderPdf } from "../../src/pdf";
import { fromDesign, toDesign } from "../../src/builder";
import { arabic, arabicFonts, arabicGiven, arabicSentences } from "./arabic";

/** Each page's words, joined by spaces. */
async function words(pdf: Uint8Array): Promise<string[]> {
  const document = await getDocument({ data: pdf.slice(), useSystemFonts: false, disableFontFace: true, verbosity: 0 }).promise;
  const pages: string[] = [];
  for (let n = 1; n <= document.numPages; n++) {
    const items = (await (await document.getPage(n)).getTextContent()).items.filter((item): item is { str: string } & typeof item => "str" in item);
    pages.push(items.map((item) => item.str).join(" ").replace(/\s+/g, " ").trim());
  }
  return pages;
}

const sentences = (count: number, what: string) => Array.from({ length: count }, (_, i) => `Sentence ${i + 1} of ${what}.`).join(" ");

describe("a Document's content that doesn't fit its page", () => {
  it("goes on to the next pages: a paragraph split between its lines, going on where it stopped, two lines at least on each side", async () => {
    // 200 sentences: 75 lines of 18 points, for rooms of 769.89 (42 lines). Its parts are drawn line by line, as they were
    // laid out: the 42 on page 1 stay 42 (drawn as paragraphs, they'd break into 43).
    const text = sentences(200, "one long paragraph");
    const design = (
      <Document>
        <Text>{text}</Text>
      </Document>
    );
    const { pdf, diagnostics } = await renderPdf(design);
    expect(diagnostics).toEqual([]);
    const pages = await words(pdf);
    expect(pages).toHaveLength(2);
    expect(pages.join(" ")).toBe(text);
    const { nodes } = await layoutDocument(design);
    expect(nodes.map(({ page, part, lines, cut }) => ({ page, part, cut, lines: lines! >= 2 }))).toEqual([
      { page: 1, part: 0, cut: undefined, lines: true },
      { page: 2, part: 1, cut: undefined, lines: true },
    ]);
    // Each part's characters of the paragraph's text: the first from its start, the second from where it stopped.
    expect(nodes[0].chars!.start).toBe(0);
    expect(nodes[1].chars).toEqual({ start: nodes[0].chars!.end, end: text.length });
  });

  /** Page 1's lines, by their baselines: their words, and where they start and end. */
  const lines = async (pdf: Uint8Array) => {
    const document = await getDocument({ data: pdf.slice(), useSystemFonts: false, disableFontFace: true, verbosity: 0 }).promise;
    const items = (await (await document.getPage(1)).getTextContent()).items.filter((item): item is { str: string; width: number; transform: number[] } & typeof item => "str" in item && item.str.trim() !== "");
    const rows = new Map<number, typeof items>();
    for (const item of items) rows.set(Math.round(item.transform[5] * 10) / 10, [...(rows.get(Math.round(item.transform[5] * 10) / 10) ?? []), item]);
    return [...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([y, row]) => ({ y, words: row.map((item) => item.str).join("").replace(/\s+/g, ""), start: Math.min(...row.map((item) => item.transform[4])), end: Math.max(...row.map((item) => item.transform[4] + item.width)) }));
  };

  it("draws a split paragraph's lines where the paragraph set them, in every alignment: the same words, within 2 points", async () => {
    for (const textAlign of ["left", "center", "right", "justify"] as const) {
      // Bold runs among plain ones, and lines its engine squeezes, stretches (justified) or breaks a word in.
      const design = (
        <Document>
          <Text style={{ textAlign }}>
            {Array.from({ length: 200 }, (_, i) => (i % 7 === 3 ? <Span key={i} style={{ fontWeight: 700 }}>{`Sentence ${i + 1} in bold. `}</Span> : `Sentence ${i + 1} of one long paragraph. `))}
          </Text>
        </Document>
      );
      const { root } = prepare(design);
      // The paragraph drawn whole (cut at the page's end, as before it was flowed), and the PDF.
      const whole = await lines((await reactPdf(writeDocument(root!, { families: new Set(), fonts: [], image: () => undefined, date: new Date(0) }))).pdf);
      const { pdf, diagnostics } = await renderPdf(design);
      const painted = await lines(pdf);
      expect(diagnostics).toEqual([]);
      expect(painted.length).toBe(42);
      painted.forEach((line, i) => {
        expect(line.words, `${textAlign}, line ${i + 1}`).toBe(whole[i].words);
        expect(line.y).toBeCloseTo(whole[i].y, 1);
        expect(Math.abs(line.start - whole[i].start), `${textAlign}, line ${i + 1}'s start`).toBeLessThan(2);
        expect(Math.abs(line.end - whole[i].end), `${textAlign}, line ${i + 1}'s end`).toBeLessThan(2);
      });
    }
  });

  it("keeps a blank line in a split paragraph as tall as in a whole one: a letter's line between its greeting and its body", async () => {
    // A letter on A4 fits its page; on A5 it goes on to a second. Between two line breaks, nothing (or spaces only).
    const letter = (size: "A4" | "A5", blank: string) => (
      <Document size={size}>
        <Text>
          Dear Ms Rivera,
          <LineBreak />
          {blank}
          <LineBreak />
          Thank you for your order. {sentences(size === "A5" ? 90 : 30, "the letter")}
        </Text>
      </Document>
    );
    for (const blank of ["", "   "]) {
      const gap = async (size: "A4" | "A5") => {
        const { pdf, plan } = await renderPdf(letter(size, blank));
        expect(plan.pages, size).toHaveLength(size === "A4" ? 1 : 2);
        const page = await lines(pdf);
        return page.find((line) => line.words.startsWith("Dear"))!.y - page.find((line) => line.words.startsWith("Thank"))!.y;
      };
      // Two lines of 18 points: drawn with no text, the blank line was 0 tall, and the body 18 points higher.
      expect(await gap("A4"), JSON.stringify(blank)).toBeCloseTo(36, 1);
      expect(await gap("A5"), JSON.stringify(blank)).toBeCloseTo(36, 1);
    }
  });

  it("splits a paragraph written right to left between its lines, each drawn as the paragraph set it: the same words, within 2 points", async () => {
    // A line of it is reported as drawn, its words reordered: it's matched to the paragraph's characters all the same.
    for (const textAlign of ["right", "justify", "left"] as const) {
      const design = (
        <Document dir="rtl" style={{ fontFamily: "Noto Arabic" }}>
          <Text style={{ textAlign }}>
            {Array.from({ length: 90 }, (_, i) => (i % 5 === 2 ? <Span key={i} style={{ color: "#b91c1c" }}>{`ملف PDF رقم ${i + 1}، مع كلمة Elements هنا. `}</Span> : `${arabicSentences(1, i + 1)} `))}
          </Text>
        </Document>
      );
      const { root } = prepare(design);
      const whole = await lines((await reactPdf(writeDocument(root!, { families: new Set(["noto arabic"]), fonts: arabicFonts, image: () => undefined, date: new Date(0) }))).pdf);
      const { pdf, diagnostics, plan } = await renderPdf(design, { fonts: arabicGiven });
      const painted = await lines(pdf);
      expect(diagnostics).toEqual([]);
      expect(plan.pages).toHaveLength(2);
      expect(painted.length).toBeGreaterThan(30);
      painted.forEach((line, i) => {
        expect(line.words, `${textAlign}, line ${i + 1}`).toBe(whole[i].words);
        expect(line.y).toBeCloseTo(whole[i].y, 1);
        expect(Math.abs(line.start - whole[i].start), `${textAlign}, line ${i + 1}'s start`).toBeLessThan(2);
        expect(Math.abs(line.end - whole[i].end), `${textAlign}, line ${i + 1}'s end`).toBeLessThan(2);
      });
      // Planned the same without drawing.
      expect((await paginate(design, { fonts: arabicGiven })).plan).toEqual(plan);
    }
  });

  it("is planned the same without drawing (paginate()) as from the PDF's own layout (renderPdf())", async () => {
    const designs = [
      <Document key="text">
        <Text style={{ textAlign: "justify" }}>{sentences(200, "one long paragraph")}</Text>
      </Document>,
      <Document key="table">
        <PageFooter>
          <Text>
            Page <PageNumber /> of <PageNumber total />
          </Text>
        </PageFooter>
        <Section style={{ padding: 24 }}>
          <Heading level={2}>Rows</Heading>
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
      </Document>,
    ];
    for (const design of designs) {
      const drawn = await renderPdf(design);
      const planned = await paginate(design);
      expect(planned.plan.pages.length).toBeGreaterThan(1);
      expect(planned.plan).toEqual(drawn.plan);
      expect(planned.diagnostics).toEqual(drawn.diagnostics);
    }
  });

  it("is planned by a paginator as paginate() plans it, as it's typed into, and without diagnostics when asked", async () => {
    const report = (typed: string) => (
      <Document fonts={[{ family: "Inter", src: "https://example.com/inter.woff" }]}>
        <Heading level={2}>Report</Heading>
        {Array.from({ length: 30 }, (_, i) => (
          <Text key={i} style={{ textAlign: i % 2 ? "justify" : "left" }}>
            {sentences(10, `paragraph ${i}`)}
            {i === 3 ? typed : ""}
          </Text>
        ))}
      </Document>
    );
    const arabic = (
      <Document dir="rtl" style={{ fontFamily: "Noto Arabic" }}>
        <Text style={{ textAlign: "justify" }}>{arabicSentences(200)}</Text>
      </Document>
    );
    const paginator = await createPaginator({ fonts: arabicGiven });
    for (const design of [report(""), report(" and"), report(" and more"), arabic]) {
      const planned = await paginate(design, { fonts: arabicGiven });
      expect(planned.plan.pages.length).toBeGreaterThan(1);
      expect(paginator.paginate(design)).toEqual(planned);
      // Without diagnostics: the same plan, and nothing said.
      expect(paginator.paginate(design, { diagnostics: false })).toEqual({ plan: planned.plan, diagnostics: [] });
    }
    // The report says its font isn't given, with its diagnostics; a template with errors throws without them too.
    expect(paginator.paginate(report("")).diagnostics.map((d) => d.code)).toContain("pdf/font");
    const broken = (
      <Document>
        <Image src="https://example.com/photo.png" alt="A photo" />
      </Document>
    );
    expect(() => paginator.paginate(broken, { diagnostics: false })).toThrow(/images option/);
  });

  it("keeps a page view going where a paginator can't measure a block exactly: its best guess, and a warning from that block on", async () => {
    // Text laid over a Layer that wraps: react-pdf lays it out at a width of its own, which isn't followed.
    const design = (
      <Document>
        <Text>{sentences(20, "before")}</Text>
        <Row>
          <Column style={{ width: 160 }}>
            <Layer>
              <Text>Under it.</Text>
              <Text id="over">{sentences(3, "laid over")}</Text>
            </Layer>
          </Column>
          <Column>
            <Text>Beside it.</Text>
          </Column>
        </Row>
        <Text>{sentences(200, "after")}</Text>
      </Document>
    );
    const paginator = await createPaginator();
    const { plan, diagnostics, layout } = paginator.paginate(design, { layout: true });
    expect(plan.pages.length).toBeGreaterThan(1);
    const warning = diagnostics.find((d) => d.code === "pdf/measure")!;
    expect(warning).toMatchObject({ severity: "warning", path: "root.children[1].children[0].children[0].children[1]" });
    expect(layout!.nodes.some((node) => node.id === "over")).toBe(true);
    // paginate() and renderPdf() measure it by drawing: exact, nothing guessed.
    const drawn = await paginate(design);
    expect(drawn.diagnostics.map((d) => d.code)).not.toContain("pdf/measure");
    expect(drawn.plan).toEqual((await renderPdf(design)).plan);
  });

  it("draws each family a paginator is given as that family, where another is given the same font file as another family", async () => {
    const page = (family: string, words: string) => (
      <Document dir="rtl" style={{ fontFamily: family }}>
        <Text>{words}</Text>
      </Document>
    );
    const first = await createPaginator({ fonts: [{ family: "Primary", src: arabic }] });
    expect(first.paginate(page("Primary", arabicSentences(1)), { svg: true }).svg![0]).toContain(`font-family="'primary'"`);
    const second = await createPaginator({ fonts: [{ family: "Secondary", src: arabic }] });
    expect(second.paginate(page("Secondary", arabicSentences(1)), { svg: true }).svg![0]).toContain(`font-family="'secondary'"`);
    // Typed into after the other was made: what's laid out anew is still in its own family.
    const typed = first.paginate(page("Primary", arabicSentences(2)), { svg: true }).svg![0];
    expect(typed).toContain(`font-family="'primary'"`);
    expect(typed).not.toContain("secondary");
  });

  it("goes on between a table's rows, its header row on top of each page, each row once", async () => {
    const rows = Array.from({ length: 70 }, (_, i) => `Row ${i + 1}`);
    const { pdf } = await renderPdf(
      <Document>
        <Table>
          <TableRow header>
            <TableCell>Item</TableCell>
            <TableCell>Amount</TableCell>
          </TableRow>
          {rows.map((row) => (
            <TableRow key={row}>
              <TableCell>{row}</TableCell>
              <TableCell>$1.00</TableCell>
            </TableRow>
          ))}
        </Table>
        <Text>Total: $70.00</Text>
      </Document>
    );
    const pages = await words(pdf);
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) expect(page.startsWith("Item Amount")).toBe(true);
    expect(pages.join(" ").match(/Row \d+/g)).toEqual(rows);
    expect(pages[pages.length - 1].endsWith("Total: $70.00")).toBe(true);
  });

  it("doesn't leave a heading last on a page: it goes on with what follows it", async () => {
    // 41 lines of 18 points (738) leave 31.89 of 769.89: the heading's 22.5 fit, the text after it doesn't.
    const design = (
      <Document>
        {Array.from({ length: 41 }, (_, i) => (
          <Text key={i}>Line {i + 1}</Text>
        ))}
        <Heading level={2}>Next section</Heading>
        <Text>Its first paragraph.</Text>
      </Document>
    );
    const { nodes } = await layoutDocument(design);
    const page = (path: string) => nodes.find((node) => node.path === path)?.page;
    expect([page("root.children[40]"), page("root.children[41]"), page("root.children[42]")]).toEqual([1, 2, 2]);
  });

  it("goes on between a list's items", async () => {
    const items = Array.from({ length: 60 }, (_, i) => `Item ${i + 1}`);
    const { pdf } = await renderPdf(
      <Document>
        <List>
          {items.map((item) => (
            <ListItem key={item}>{item}</ListItem>
          ))}
        </List>
      </Document>
    );
    const pages = await words(pdf);
    expect(pages.length).toBe(2);
    expect(pages.join(" ").match(/Item \d+/g)).toEqual(items);
  });

  it("cuts a Section where its page ends: its top padding on its first part only, its bottom padding on its last", async () => {
    const design = (
      <Document>
        <Section style={{ padding: 24, backgroundColor: "#f3f4f6" }}>
          {Array.from({ length: 60 }, (_, i) => (
            <Text key={i}>Line {i + 1}</Text>
          ))}
        </Section>
      </Document>
    );
    const { pages, nodes } = await layoutDocument(design);
    expect(pages).toHaveLength(2);
    const section = nodes.filter((node) => node.path === "root.children[0]");
    const first = (page: number) => nodes.find((node) => node.page === page && node.path.startsWith("root.children[0].children["))!;
    // Page 1: 24px of padding above its first line. Page 2: none, and the padding below its last line.
    expect(first(1).y - section[0].y).toBeCloseTo(24, 1);
    expect(first(2).y - section[1].y).toBeCloseTo(0, 1);
    const second = nodes.filter((node) => node.page === 2 && node.path.startsWith("root.children[0].children["));
    const last = second[second.length - 1];
    expect(section[1].y + section[1].height - (last.y + last.height)).toBeCloseTo(24, 1);
  });

  it("ends a Section or a Row with its bottom padding and border on its page: what's last goes on with them where they don't fit after it", async () => {
    const line = (i: number) => (
      <Text key={i} style={{ fontSize: 14, lineHeight: 1.5 }}>
        Line {i + 1}
      </Text>
    );
    const footer = (
      <PageFooter>
        <Text style={{ fontSize: 11 }}>
          Page <PageNumber /> of <PageNumber total />
        </Text>
      </PageFooter>
    );
    // As many lines as end anywhere in the last 60px of a page: some of them within its bottom padding and border.
    const sections = Array.from({ length: 11 }, (_, n) => (
      <Document size="A4" margin={48}>
        {footer}
        <Section style={{ padding: 40, border: "2px solid #336", backgroundColor: "#eef" }}>{Array.from({ length: 40 + n }, (_, i) => line(i))}</Section>
      </Document>
    ));
    const rows = Array.from({ length: 11 }, (_, n) => (
      <Document size="A4" margin={48}>
        <Row style={{ padding: 40, gap: 16, backgroundColor: "#eef" }}>
          <Column>{Array.from({ length: 88 + n }, (_, i) => line(i))}</Column>
          <Column>{Array.from({ length: 5 }, (_, i) => line(i))}</Column>
        </Row>
      </Document>
    ));
    for (const [i, design] of [...sections, ...rows].entries()) {
      const { pages, nodes, diagnostics } = await layoutDocument(design);
      const label = i < sections.length ? `a Section of ${40 + i} lines` : `a Row of ${88 + i - sections.length} lines`;
      expect(diagnostics.filter((d) => d.code === "document/overflow"), label).toEqual([]);
      const parts = nodes.filter((node) => node.path === "root.children[0]" || node.path === "root.children[1]").filter((node) => node.type === "Section" || node.type === "Row");
      for (const part of parts) {
        const { room } = pages.find((page) => page.page === part.page)!;
        expect(part.y + part.height, `${label}, page ${part.page}`).toBeLessThanOrEqual(room.bottom + 0.5);
      }
      // Its last part ends with its bottom padding below its last line.
      const last = parts[parts.length - 1];
      const lines = nodes.filter((node) => node.page === last.page && node.type === "Text" && node.path.startsWith(`${last.path}.children[`));
      const bottom = Math.max(...lines.map((node) => node.y + node.height));
      expect(last.y + last.height - bottom, label).toBeGreaterThanOrEqual(40 - 0.5);
    }
  });

  it("goes on with a table in a padded Column that ends past its page, its padding where the Column ends: each row once, without end", async () => {
    // A page's room is 1,026.5px; the header row is 24px. Rows from 950px to 1,010px tall: below the header row, some fit
    // a page only without the Column's bottom padding (12px), which goes where the Column ends, not where the table goes
    // on; others fit only without the header row.
    for (let height = 950; height <= 1010; height += 5) {
      const design = (
        <Document size="A4" margin={48}>
          <Column style={{ padding: 12, backgroundColor: "#eef" }}>
            <Table>
              <TableRow header>
                <TableCell>Item</TableCell>
              </TableRow>
              {Array.from({ length: 3 }, (_, i) => (
                <TableRow key={i} style={{ height }}>
                  <TableCell>{`Row ${i + 1}`}</TableCell>
                </TableRow>
              ))}
            </Table>
          </Column>
        </Document>
      );
      const { plan, diagnostics } = await paginate(design);
      const parts = plan.pages.flatMap((page) => page.parts).flatMap(function all(part: PlannedPart): PlannedPart[] {
        return [part, ...(part.children ?? []).flatMap(all)];
      });
      // Each row once, on a page of its own (with the header row again where it fits), on 4 pages at most.
      for (let i = 1; i <= 3; i++) expect(parts.filter((part) => part.path === `root.children[0].children[0].children[${i}]`), `row ${i}, rows ${height}px`).toHaveLength(1);
      expect(plan.pages.length, `rows ${height}px`).toBeLessThanOrEqual(4);
      // Nothing cut off where a row fits a page with the header row above it and the Column's padding below (past that,
      // its last page is a few pixels short, as it is on any page).
      if (24 + height + 12 <= 1026) expect(diagnostics.filter((d) => d.code === "document/overflow"), `rows ${height}px`).toEqual([]);
    }
  });

  it("goes on past a bordered table whose last row fits only without its border, and draws what follows it", async () => {
    // A header row and a body row fit the room (1,026.5px) together; with the table's bottom border below, they don't.
    const design = (
      <Document size="A4" margin={48}>
        <Table style={{ border: { bottom: "6px solid #333" } }}>
          <TableRow header style={{ height: 24 }}>
            <TableCell>Inventory column</TableCell>
          </TableRow>
          <TableRow style={{ height: 1000 }}>
            <TableCell>Inventory item</TableCell>
          </TableRow>
        </Table>
        <Column style={{ height: 700 }}>
          <Text>First following block</Text>
        </Column>
        <Column style={{ height: 700 }}>
          <Text>Second following block</Text>
        </Column>
      </Document>
    );
    const { plan, pdf } = await renderPdf(design);
    // The table ends on its first page (its border a few pixels past the room, as on any page), then a page each.
    expect(plan.pages.map((page) => page.parts.map((part) => part.path))).toEqual([["root.children[0]"], ["root.children[1]"], ["root.children[2]"]]);
    expect(await words(pdf)).toEqual(["Inventory column Inventory item", "First following block", "Second following block"]);
  });

  it("fills the rest of a page with a part that goes on to the next, as a browser does: its background to the room's foot", async () => {
    const { pages, nodes } = await layoutDocument(
      <Document>
        <Section style={{ padding: 24, backgroundColor: "#f3f4f6" }}>
          <Column style={{ padding: 12, backgroundColor: "#e5e7eb" }}>
            {Array.from({ length: 12 }, (_, i) => (
              <Text key={i}>{sentences(20, `paragraph ${i + 1}`)}</Text>
            ))}
          </Column>
        </Section>
      </Document>
    );
    expect(pages.length).toBeGreaterThan(1);
    const bottom = (path: string, page: number) => {
      const node = nodes.find((node) => node.path === path && node.page === page)!;
      return node.y + node.height;
    };
    for (const path of ["root.children[0]", "root.children[0].children[0]"]) {
      // Down to the room's foot on each page it goes on from, though its lines end above it (two at least stay together)…
      for (const page of pages.slice(0, -1)) expect(bottom(path, page.page), `${path} on page ${page.page}`).toBeCloseTo(page.room.bottom, 0);
      // …and on its last, where it ends.
      expect(bottom(path, pages.length)).toBeLessThan(pages[pages.length - 1].room.bottom - 100);
    }
    // A table that goes on ends with its last row on the page (its rows would be stretched with it in the print HTML).
    const table = await layoutDocument(
      <Document>
        <Table>
          {Array.from({ length: 80 }, (_, i) => (
            <TableRow key={i}>
              <TableCell>{`Row ${i + 1}`}</TableCell>
            </TableRow>
          ))}
        </Table>
      </Document>
    );
    const part = table.nodes.find((node) => node.path === "root.children[0]" && node.page === 1)!;
    const rows = table.nodes.filter((node) => node.page === 1 && /^root\.children\[0\]\.children\[\d+\]$/.test(node.path));
    expect(part.y + part.height).toBeCloseTo(Math.max(...rows.map((row) => row.y + row.height)), 1);
  });

  it("splits a Row of Columns taller than a page by its columns: each goes on in its own place, one that has ended keeps its room", async () => {
    // Centered: were a column that has ended left out, the one going on would move to the middle.
    const design = (
      <Document>
        <Row style={{ gap: 16, justifyContent: "center" }}>
          <Column style={{ width: 300, padding: 8, backgroundColor: "#f3f4f6" }}>
            {Array.from({ length: 16 }, (_, i) => (
              <Text key={i}>{sentences(12, `the long column's paragraph ${i + 1}`)}</Text>
            ))}
          </Column>
          <Column style={{ width: 200 }}>
            {Array.from({ length: 3 }, (_, i) => (
              <Text key={i}>{sentences(4, `the short column's paragraph ${i + 1}`)}</Text>
            ))}
          </Column>
        </Row>
      </Document>
    );
    const { pdf, plan, diagnostics } = await renderPdf(design);
    expect(diagnostics).toEqual([]);
    expect(plan.pages.length).toBeGreaterThan(2);
    // Every sentence of each column drawn once (a word broken across lines joined again).
    const all = (await words(pdf)).join(" ").replace(/(\w)- (\w)/g, "$1$2");
    expect(all.match(/of the long column's paragraph/g)).toHaveLength(16 * 12);
    expect(all.match(/of the short column's paragraph/g)).toHaveLength(3 * 4);
    const { nodes } = await layoutDocument(design);
    const column = (i: number, page: number) => nodes.find((node) => node.path === `root.children[0].children[${i}]` && node.page === page);
    for (let page = 2; page <= plan.pages.length; page++) {
      expect(column(0, page)!.x, `the long column on page ${page}`).toBeCloseTo(column(0, 1)!.x, 1);
      // The short one ended on page 1: its room is kept, with nothing drawn.
      expect(column(1, page)).toBeUndefined();
    }
    // The plan: each column's last part is one, on a page where it has something; an empty part is neither its first nor its last.
    const parts = plan.pages.flatMap((page) => page.parts).flatMap(function all(part: PlannedPart): PlannedPart[] {
      return [part, ...(part.children ?? []).flatMap(all)];
    });
    for (const i of [0, 1]) {
      const path = `root.children[0].children[${i}]`;
      expect(parts.filter((part) => part.path === path && part.last)).toHaveLength(1);
      expect(parts.filter((part) => part.path === path && part.first)).toHaveLength(1);
    }
    expect(parts.filter((part) => part.empty).length).toBe(plan.pages.length - 1);
    expect(parts.filter((part) => part.empty).every((part) => !part.first && !part.last && !part.children)).toBe(true);
  });

  it("keeps a Row of Columns that fits on a page together: it goes on to the next page whole, with its heading", async () => {
    const { nodes } = await layoutDocument(
      <Document>
        {Array.from({ length: 30 }, (_, i) => (
          <Text key={i}>{`Paragraph ${i + 1}.`}</Text>
        ))}
        <Heading level={2}>Side by side</Heading>
        <Row style={{ gap: 16 }}>
          {[0, 1].map((n) => (
            <Column key={n}>
              {Array.from({ length: 10 }, (_, i) => (
                <Text key={i}>{sentences(3, `column ${n + 1}'s paragraph ${i + 1}`)}</Text>
              ))}
            </Column>
          ))}
        </Row>
      </Document>
    );
    const row = nodes.filter((node) => node.path === "root.children[31]");
    expect(row.map((node) => [node.page, node.part, node.cut])).toEqual([[2, 0, undefined]]);
    expect(nodes.find((node) => node.path === "root.children[30]")!.page).toBe(2);
  });

  it("goes on from a Document.Page to pages with its background, then the next page starts", async () => {
    const { pages, nodes } = await layoutDocument(
      <Document>
        <Document.Page style={{ backgroundColor: "#fef3c7" }}>
          {Array.from({ length: 60 }, (_, i) => (
            <Text key={i}>Line {i + 1}</Text>
          ))}
        </Document.Page>
        <Document.Page>
          <Text>Back page</Text>
        </Document.Page>
      </Document>
    );
    expect(pages).toHaveLength(3);
    expect(nodes.find((node) => node.path === "root.children[1].children[0]")?.page).toBe(3);
    const { pdf } = await renderPdf(
      <Document>
        <Document.Page style={{ backgroundColor: "#fef3c7" }}>
          {Array.from({ length: 60 }, (_, i) => (
            <Text key={i}>Line {i + 1}</Text>
          ))}
        </Document.Page>
      </Document>
    );
    // The page's background, as its fill color (0.996 0.953 0.78), on both pages it goes on.
    const document = await getDocument({ data: pdf.slice(), verbosity: 0 }).promise;
    for (let n = 1; n <= document.numPages; n++) {
      const { argsArray } = await (await document.getPage(n)).getOperatorList();
      expect(JSON.stringify(argsArray)).toMatch(/"#fef3c7"|\[254,243,199\]|0\.99[0-9]*,0\.95[0-9]*,0\.78/);
    }
  });

  it("numbers each page's footer for the pages there are", async () => {
    const { pdf } = await renderPdf(
      <Document>
        <PageFooter>
          <Text>
            Page <PageNumber /> of <PageNumber total />
          </Text>
        </PageFooter>
        <Text>{sentences(300, "a report")}</Text>
      </Document>
    );
    const pages = await words(pdf);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.map((page) => /Page (\d+) of (\d+)$/.exec(page)?.slice(1).join("/"))).toEqual(pages.map((_, i) => `${i + 1}/${pages.length}`));
  });

  it("draws a plan only for the Document it was made from: one made before an edit is set aside, with a warning", async () => {
    const report = (typed: string) => (
      <Document>
        {Array.from({ length: 40 }, (_, i) => (
          <Text key={i}>{sentences(10, `paragraph ${i}${i === 3 ? typed : ""}`)}</Text>
        ))}
      </Document>
    );
    const { plan } = await paginate(report(""));
    expect(plan.pages.length).toBeGreaterThan(1);
    expect(plan.design).toMatch(/^[0-9a-f]{16}$/);
    // The same Document: its plan's pages, nothing said.
    const same = await render(report(""), { plan });
    expect(same.diagnostics.map((d) => d.code)).not.toContain("render/plan");
    expect(same.body.match(/<section /g)).toHaveLength(plan.pages.length);
    // Edited since: its pages as written (one), and a warning.
    const edited = await render(report(" typed"), { plan });
    expect(edited.diagnostics.map((d) => [d.code, d.severity])).toContainEqual(["render/plan", "warning"]);
    expect(edited.body.match(/<section /g)).toHaveLength(1);
    // Its text styles changed from above (written right to left, then aligned left): another Document.
    const rtl = (style?: { textAlign: "left" }) => (
      <Document dir="rtl" style={style}>
        {Array.from({ length: 60 }, (_, i) => (
          <Text key={i}>Report entry {i + 1}</Text>
        ))}
      </Document>
    );
    const { plan: before } = await paginate(rtl());
    expect((await render(rtl({ textAlign: "left" }), { plan: before })).diagnostics.map((d) => d.code)).toContain("render/plan");
    // A plan made without one (an older plan, or by hand) is drawn as before.
    const { design, ...older } = plan;
    expect(design).toBeDefined();
    expect((await render(report(" typed"), { plan: older })).diagnostics.map((d) => d.code)).not.toContain("render/plan");
  });

  it("numbers a page number in the content on the page it goes on to, in the PDF and the print HTML alike", async () => {
    const design = (
      <Document size="A5">
        <PageFooter>
          <Text>
            Footer <PageNumber /> of <PageNumber total />
          </Text>
        </PageFooter>
        {Array.from({ length: 40 }, (_, i) => (
          <Text key={i}>Body row {i + 1}</Text>
        ))}
        <Text>
          Body page <PageNumber /> of <PageNumber total />
        </Text>
      </Document>
    );
    const { pdf, plan } = await renderPdf(design);
    expect(plan.pages).toHaveLength(2);
    const pages = await words(pdf);
    expect(pages[1]).toContain("Body page 2 of 2");
    expect(pages[1]).toContain("Footer 2 of 2");
    const { html } = await render(design, { plan });
    expect(html.replace(/<[^>]+>/g, "")).toContain("Body page 2 of 2");
  });

  it("measures a page number in the content as wide as it's drawn when its count grows a digit, so its line isn't cut off", async () => {
    // "Total 1" fits its width; "Total 10" wraps: a line more than it was measured with, under the room's foot.
    const design = (
      <Document size="A5" margin={{ top: 300, bottom: 300, left: 48, right: 48 }}>
        {Array.from({ length: 7 }, (_, i) => (
          <Text key={i}>Opening record {i + 1}</Text>
        ))}
        <Text id="total" style={{ width: 68, fontFamily: "Courier" }}>
          Total <PageNumber total />
        </Text>
        {Array.from({ length: 75 }, (_, i) => (
          <Text key={i}>Closing record {i + 1}</Text>
        ))}
      </Document>
    );
    const layout = await layoutDocument(design);
    expect(layout.pages.length).toBeGreaterThanOrEqual(10);
    const total = layout.nodes.find(({ id }) => id === "total")!;
    expect(total.lines).toBe(2);
    expect(layout.nodes.filter((node) => node.cut)).toEqual([]);
    const { pdf, plan } = await renderPdf(design);
    expect((await words(pdf))[total.page - 1]).toContain(`Total ${layout.pages.length}`);
    // Measured with the numbers it's drawn with (its page, and the count): the plan says so, for the print HTML to cut
    // its text by; the same without drawing.
    expect(plan.numbered).toEqual({ [total.path]: { number: total.page, total: plan.pages.length } });
    expect((await paginate(design)).plan).toEqual(plan);
  });

  it("measures a page number in the content as wide as it's drawn, its figure wider though its digits are as many", async () => {
    // In Inter, "Page 1" fits 50px; "Page 4", a wider figure, wraps: measured as drawn, it goes on whole, not cut off.
    const fonts = [{ family: "Inter", src: readFileSync(new URL("../../../../templates/_assets/fonts/Inter-400.ttf", import.meta.url)) }];
    const row = { fontSize: 16, lineHeight: 1.5 };
    const design = (
      <Document size="A5" margin={{ top: 300, bottom: 300, left: 48, right: 48 }}>
        {Array.from({ length: 31 }, (_, i) => (
          <Text key={i} style={row}>
            Record {i + 1}
          </Text>
        ))}
        <Text id="numbered" style={{ ...row, fontFamily: "Inter", width: 50 }}>
          Page <PageNumber />
        </Text>
      </Document>
    );
    const drawn = await layoutDocument(design, { fonts });
    expect(drawn.pages.length).toBeGreaterThan(3);
    expect(drawn.nodes.find((node) => node.id === "numbered")!.cut).toBeUndefined();
    expect((await paginate(design, { fonts })).plan).toEqual((await createPaginator({ fonts })).paginate(design).plan);
  });

  it("measures a page number in a list item beside a list in it as it's drawn, so the list goes on whole", async () => {
    const design = (
      <Document size="A5" margin={{ top: 300, bottom: 300, left: 48, right: 48 }}>
        {Array.from({ length: 6 }, (_, i) => (
          <Text key={i}>Opening record {i + 1}</Text>
        ))}
        <List id="numbered-list" style={{ width: 92, fontFamily: "Courier" }}>
          <ListItem>
            Total <PageNumber total />
            <List>
              <ListItem>OK</ListItem>
            </List>
          </ListItem>
        </List>
        {Array.from({ length: 75 }, (_, i) => (
          <Text key={i}>Closing record {i + 1}</Text>
        ))}
      </Document>
    );
    const layout = await layoutDocument(design);
    expect(layout.pages.length).toBeGreaterThanOrEqual(10);
    expect(layout.nodes.filter((node) => node.cut)).toEqual([]);
    expect(layout.nodes.find((node) => node.id === "numbered-list")?.page).toBe(2);
    const { plan } = await renderPdf(design);
    expect((await createPaginator()).paginate(design).plan).toEqual(plan);
    expect((await paginate(design)).plan).toEqual(plan);
  });

  it("plans the same pages and hashes from every entry point where page numbers grow a digit", async () => {
    const design = (
      <Document size="A5">
        <PageFooter>
          <Text style={{ width: 68, fontFamily: "Courier" }}>
            Total <PageNumber total />
          </Text>
        </PageFooter>
        {Array.from({ length: 270 }, (_, i) => (
          <Text key={i}>Record {i + 1}</Text>
        ))}
        <Text style={{ width: 68, fontFamily: "Courier" }}>
          Page <PageNumber /> of <PageNumber total />
        </Text>
      </Document>
    );
    const { plan } = await renderPdf(design);
    expect(plan.pages.length).toBeGreaterThanOrEqual(10);
    const paginator = await createPaginator();
    for (const other of [(await paginate(design)).plan, paginator.paginate(design).plan, paginator.paginate(design, { diagnostics: false }).plan, paginator.paginate(design, { diagnostics: false, layout: { pages: [3] }, svg: { pages: [3] } }).plan]) expect(other).toEqual(plan);
  });

  it("measures a footer as tall as it's drawn when its count of pages grows a digit, so nothing above it is cut off", async () => {
    // "Total 1" fits the footer's width; "Total 10" wraps, so every page's footer is a line taller than it was measured.
    const design = (
      <Document size="A5">
        <PageFooter>
          <Text style={{ width: 68, fontFamily: "Courier" }}>
            Total <PageNumber total />
          </Text>
        </PageFooter>
        {Array.from({ length: 270 }, (_, i) => (
          <Text key={i}>Record {i + 1}</Text>
        ))}
      </Document>
    );
    const layout = await layoutDocument(design);
    expect(layout.pages.length).toBeGreaterThanOrEqual(10);
    expect(layout.nodes.filter((node) => node.cut)).toEqual([]);
    // Every record on a page, once, and the same plan without drawing.
    const { plan } = await renderPdf(design);
    expect(plan.pages.flatMap((page) => page.parts.map((part) => part.path))).toHaveLength(270);
    expect((await paginate(design)).plan).toEqual(plan);
    const paginator = await createPaginator();
    expect(paginator.paginate(design, { diagnostics: false }).plan).toEqual(plan);
  });

  it("is planned the same without drawing where an image is sized by its file: a video's thumbnail", async () => {
    const thumbnail = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const design = (
      <Document size="A5">
        <Video src="https://www.youtube.com/watch?v=dQw4w9WgXcQ" thumbnail={{ src: thumbnail, width: 1, height: 1 }} style={{ width: 300 }} />
        {Array.from({ length: 24 }, (_, i) => (
          <Text key={i}>Details row {i + 1}</Text>
        ))}
      </Document>
    );
    const drawn = await renderPdf(design);
    expect(drawn.plan.pages).toHaveLength(2);
    expect((await paginate(design)).plan).toEqual(drawn.plan);
  });

  it("keeps an SVG in a line of text one character of it, so the print HTML's pages have the PDF's words", async () => {
    const src = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==";
    const design = (
      <Document size="A5">
        <Text>
          <Image src={{ src, width: 16, height: 16 }} alt="An inline icon" /> {Array.from({ length: 115 }, (_, i) => `The report entry ${i + 1} continues onto another page. `).join("")}
          THE-END
        </Text>
      </Document>
    );
    const { plan, pdf } = await renderPdf(design);
    expect(plan.pages.length).toBeGreaterThan(1);
    const pdfPages = await words(pdf);
    const { body } = await render(design, { plan });
    const htmlPages = body.match(/<section [\s\S]*?<\/section>/g)!.map((page) => page.replace(/<[^>]+>/g, "").replace(/\s/g, ""));
    expect(htmlPages).toEqual(pdfPages.map((page) => page.replace(/\s/g, "")));
  });

  it("goes on with a line a page where not even one fits, and says what's cut off", async () => {
    const design = (
      <Document size="A5" margin={{ top: 388, bottom: 388, left: 48, right: 48 }}>
        <Text>{Array.from({ length: 5 }, (_, i) => `Record ${i + 1}`).join("\n")}</Text>
      </Document>
    );
    const { plan, diagnostics } = await renderPdf(design);
    expect(plan.pages).toHaveLength(5);
    expect(diagnostics.map(({ code }) => code)).toContain("document/overflow");
    expect((await paginate(design)).plan).toEqual(plan);
  });
});

describe("a builder design's parts on each page", () => {
  /** A builder design of a Document that runs to several pages: a long text, a band of two columns, a long table. */
  const design = () =>
    JSON.parse(
      JSON.stringify(
        toDesign(
          <Document size="A5">
            <PageHeader><Text>Acme</Text></PageHeader>
            <Heading>Report</Heading>
            <Text>{sentences(60, "the introduction")}</Text>
            <Section style={{ backgroundColor: "#eeeeff" }}>
              <Row><Column><Text>Left</Text></Column><Column><Text>Right</Text></Column></Row>
            </Section>
            <Table>
              <TableRow header><TableCell>Item</TableCell><TableCell>Qty</TableCell></TableRow>
              {Array.from({ length: 40 }, (_, i) => (
                <TableRow key={i}><TableCell>Item {i + 1}</TableCell><TableCell>{i + 1}</TableCell></TableRow>
              ))}
            </Table>
            <PageBreak />
            <Text>After the break</Text>
            <PageFooter><Text>Thanks</Text></PageFooter>
          </Document>,
        ).design,
      ),
    );

  it("names a part of the design for every part of every page of the template read back", async () => {
    const { element, parts } = fromDesign(design(), { displayMode: "document" });
    const { plan } = await paginate(element);
    expect(plan.pages.length).toBeGreaterThan(3);
    const unnamed: string[] = [];
    const visit = (part: PlannedPart) => {
      if (!parts[part.path]) unnamed.push(part.path);
      part.children?.forEach(visit);
    };
    plan.pages.forEach((page) => page.parts.forEach(visit));
    expect(unnamed).toEqual([]);
  });

  it("lists each page's parts of the design in order, each once, and where each starts and ends", async () => {
    const { element, parts } = fromDesign(design(), { displayMode: "document" });
    const { plan } = await paginate(element);
    const pages = designPages(plan, parts);
    expect(pages).toHaveLength(plan.pages.length);
    const on = (at: string) => pages.flatMap((page, n) => page.filter((part) => part.at === at).map((part) => ({ n, first: part.first, last: part.last })));
    // The long text: its first part on one page, its last on the next.
    const text = on("rows[0].columns[0].contents[1]");
    expect(text).toEqual([{ n: 0, first: true, last: false }, { n: 1, first: false, last: true }]);
    expect(pages[0][1]).toEqual({ at: "rows[0].columns[0].contents[1]", id: "u_content_paragraph_1", first: true, last: false });
    // The band of two columns: the row, then each column, then its block.
    const band = pages.flatMap((page) => page.map((part) => part.at)).filter((at) => at.startsWith("rows[1]"));
    expect(band).toEqual(["rows[1]", "rows[1].columns[0]", "rows[1].columns[0].contents[0]", "rows[1].columns[1]", "rows[1].columns[1].contents[0]"]);
    // The table: started on its first page, ended on its last; its header on each; each row on one page, whole.
    const table = on("rows[2].columns[0].contents[0]");
    expect(table.length).toBeGreaterThan(1);
    expect(table.map(({ first, last }) => [first, last])).toEqual(table.map((_, i) => [i === 0, i === table.length - 1]));
    const header = on("rows[2].columns[0].contents[0].values.table.headers[0]");
    expect(header).toEqual(table.map(({ n }) => ({ n, first: true, last: true })));
    for (let i = 0; i < 40; i++) {
      const row = on(`rows[2].columns[0].contents[0].values.table.rows[${i}]`);
      expect(row).toHaveLength(1);
      expect(row[0]).toMatchObject({ first: true, last: true });
    }
    // After the page break, its own page; the header and footer are on every page, and listed on none.
    expect(pages[pages.length - 1]).toEqual([{ at: "rows[4].columns[0].contents[0]", id: "u_content_paragraph_4", first: true, last: true }]);
    expect(pages.flat().filter((part) => /^(headers|footers)/.test(part.at))).toEqual([]);
    pages.forEach((page) => expect(new Set(page.map((part) => part.at)).size).toBe(page.length));
  });

  it("starts and ends a part made of several nodes where its first starts and its last ends", async () => {
    const paragraphs = `<p>${sentences(160, "the first paragraph")}</p><p>${sentences(160, "the second paragraph")}</p>`;
    const single = (contents: Array<Record<string, unknown>>) => ({ body: { rows: [{ cells: [1], columns: [{ contents, values: {} }], values: {} }], values: {} } });
    // A text of two paragraphs, a node each, over three pages: it starts on the first and ends on the last.
    const text = fromDesign(single([{ type: "text", values: { _meta: { htmlID: "u_content_text_1" }, text: paragraphs } }]), { displayMode: "document" });
    const textPlan = (await paginate(text.element)).plan;
    const textPages = designPages(textPlan, text.parts);
    expect(textPages.length).toBeGreaterThan(2);
    expect(textPages.map((page) => page.map(({ first, last }) => ({ first, last })))).toEqual(textPages.map((_, i) => [{ first: i === 0, last: i === textPages.length - 1 }]));
    // The same with `parts` in another order (stored, or sent and sorted): each path's place says which comes first.
    const entries = Object.entries(text.parts);
    expect(designPages(textPlan, Object.fromEntries([...entries].reverse()))).toEqual(textPages);
    expect(designPages(textPlan, JSON.parse(JSON.stringify(Object.fromEntries([...entries].sort(([a], [b]) => (a < b ? -1 : 1))))))).toEqual(textPages);
    // A row with a band, split by a page break in its column: a band each side, the row's and its column's parts.
    const { design } = toDesign(<Document size="A5"><Text>Before</Text><Text>After</Text></Document>);
    const row = (design.body as any).rows[0];
    row.values.backgroundColor = "#eeeeff";
    row.columns[0].values.backgroundColor = "#ffeeee";
    row.columns[0].contents.splice(1, 0, { type: "page_break", values: {} });
    const band = fromDesign(design, { displayMode: "document" });
    const bandPages = designPages((await paginate(band.element)).plan, band.parts);
    expect(bandPages.map((page) => page.filter((part) => !part.at.includes("contents")).map(({ at, first, last }) => ({ at, first, last })))).toEqual([
      [{ at: "rows[0]", first: true, last: false }, { at: "rows[0].columns[0]", first: true, last: false }],
      [{ at: "rows[0]", first: false, last: true }, { at: "rows[0].columns[0]", first: false, last: true }],
    ]);
  });

  it("lists a row's column on the pages it has something on: not on one after it ends, as its row goes on", async () => {
    const { design } = toDesign(
      <Document size="A5">
        <Row>
          <Column><Text>Short</Text></Column>
          <Column><Text>{sentences(160, "the long column")}</Text></Column>
        </Row>
      </Document>,
    );
    const { element, parts } = fromDesign(design, { displayMode: "document" });
    const pages = designPages((await paginate(element)).plan, parts);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages[0].map((part) => part.at)).toEqual(["rows[0]", "rows[0].columns[0]", "rows[0].columns[0].contents[0]", "rows[0].columns[1]", "rows[0].columns[1].contents[0]"]);
    expect(pages[1]).toEqual([
      { at: "rows[0]", id: "u_row_1", first: false, last: pages.length === 2 },
      { at: "rows[0].columns[1]", id: "u_column_2", first: false, last: pages.length === 2 },
      { at: "rows[0].columns[1].contents[0]", id: "u_content_paragraph_2", first: false, last: pages.length === 2 },
    ]);
  });
});
