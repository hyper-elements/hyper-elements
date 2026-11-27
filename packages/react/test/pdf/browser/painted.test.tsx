/**
 * A Document's pages drawn as SVG (a paginator's `svg: true`), shown in Chromium with fontFaces(): each glyph Chromium
 * draws where the PDF draws it (read from the PDF's drawing operators with pdf.js), and each box where its PDF has it.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { chromium, type Browser } from "playwright";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { Button, Column, Document, Heading, Image, Layer, List, ListItem, PageFooter, PageHeader, PageNumber, Row, Section, Span, Table, TableCell, TableRow, Text } from "@hyper-elements/react";
import { createPaginator, fontFaces, renderPdf, type PdfFont } from "../../../src/pdf";
import { arabic, arabicSentences } from "../arabic";
import { glyphs, images } from "../operators";
import { png } from "../png";

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => browser?.close());

const liberation = (name: string) => new Uint8Array(readFileSync(join(dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json")), "standard_fonts", name)));
const fonts: PdfFont[] = [
  { family: "Liberation", src: liberation("LiberationSans-Regular.ttf") },
  { family: "Liberation", src: liberation("LiberationSans-Bold.ttf"), weight: 700 },
  { family: "Noto Arabic", src: arabic },
];
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const sentences = (count: number, what: string) => Array.from({ length: count }, (_, i) => `Sentence ${i + 1} of ${what}.`).join(" ");
const solid = { width: 1, style: "solid" as const, color: "#000000" };

const report = (
  <Document style={{ fontFamily: "Liberation" }}>
    <PageHeader>
      <Text style={{ fontSize: 10, color: "#666666" }}>Quarterly report</Text>
    </PageHeader>
    <PageFooter>
      <Text style={{ fontSize: 10, textAlign: "right" }}>
        Page <PageNumber /> of <PageNumber total />
      </Text>
    </PageFooter>
    <Heading level={1}>Results</Heading>
    <Section style={{ padding: 16, backgroundColor: "#f3f4f6", border: { top: { width: 3, style: "solid", color: "#2563eb" } } }}>
      <Text style={{ textAlign: "justify" }}>
        {sentences(10, "a justified paragraph")} <Span style={{ fontWeight: 700, color: "#b91c1c" }}>In bold red.</Span> <Span style={{ textDecoration: "underline" }}>Underlined words.</Span> {sentences(4, "the end")}
      </Text>
    </Section>
    <Row style={{ gap: 16 }}>
      <Column style={{ width: "50%", padding: 12, backgroundColor: "#fef3c7" }}>
        <Text style={{ textAlign: "center" }}>{sentences(5, "the left column")}</Text>
      </Column>
      <Column style={{ padding: 12, border: { top: solid, right: solid, bottom: solid, left: solid } }}>
        <Text dir="rtl" style={{ fontFamily: "Noto Arabic" }}>
          {arabicSentences(3)} PDF {arabicSentences(2, 4)}
        </Text>
      </Column>
    </Row>
    <List type="number">
      <ListItem>{sentences(4, "a list item")}</ListItem>
      <ListItem>{sentences(2, "another")}</ListItem>
    </List>
    <Table>
      <TableRow header>
        <TableCell>Item</TableCell>
        <TableCell>Amount</TableCell>
      </TableRow>
      {[1, 2, 3].map((i) => (
        <TableRow key={i}>
          <TableCell>{`Row ${i}`}</TableCell>
          <TableCell>$1.00</TableCell>
        </TableRow>
      ))}
    </Table>
    <Image src={{ src: PNG, width: 120, height: 60 }} alt="A swatch" />
    <Layer>
      <Text>Under the layer, a line of its own.</Text>
      <Text style={{ textAlign: "right", color: "#9ca3af" }}>Drawn over it</Text>
    </Layer>
    <Text style={{ letterSpacing: 4 }}>Letters spaced out, each where it is drawn</Text>
    <Text>
      Status <Image src={{ src: PNG, width: 14, height: 14 }} alt="OK" /> ready, an image in a line.
    </Text>
    <Button href="https://example.com">Read more</Button>
    <Text style={{ textAlign: "right" }}>{sentences(120, "a long paragraph")}</Text>
  </Document>
);

/** Each glyph Chromium draws of each page's SVG: where it starts and its baseline (in the SVG's units, the PDF's points), and its character. */
async function shown(svg: string[]): Promise<Array<Array<{ x: number; baseline: number; text: string }>>> {
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><html><head><style>${fontFaces(fonts)}</style></head><body style="margin:0">${svg.join("")}</body></html>`);
  return page.evaluate(async () => {
    for (const family of ["Liberation", "Noto Arabic"]) await document.fonts.load(`12px '${family}'`);
    await document.fonts.ready;
    return Array.from(document.querySelectorAll("body > svg")).map((svg) =>
      Array.from(svg.querySelectorAll("text")).flatMap((text) => {
        const content = text.textContent ?? "";
        const baseline = Number(text.getAttribute("y"));
        return Array.from(content, (char, i) => ({ x: text.getStartPositionOfChar(i).x, baseline, text: char }));
      })
    );
  });
}

describe("a Document's pages drawn as SVG", () => {
  it("has Chromium draw each glyph where its PDF draws it, in the same fonts", async () => {
    const paginator = await createPaginator({ fonts });
    const { svg, plan } = paginator.paginate(report, { svg: true });
    expect(svg).toHaveLength(plan.pages.length);
    expect(plan.pages.length).toBeGreaterThan(1);
    const inChromium = await shown(svg as string[]);
    const { pdf } = await renderPdf(report, { fonts });
    const document = await getDocument({ data: pdf.slice(), useSystemFonts: false, disableFontFace: true, verbosity: 0 }).promise;
    let checked = 0;
    let worst = 0;
    for (let n = 1; n <= document.numPages; n++) {
      // Its letters and digits (Arabic glyphs are drawn joined, as their own forms): each in Chromium on the same
      // baseline, at the same place.
      const drawn = (await glyphs(await document.getPage(n))).filter((glyph) => /^[A-Za-z0-9$]$/.test(glyph.text));
      const there = inChromium[n - 1];
      for (const glyph of drawn) {
        const near = there.filter((other) => other.text === glyph.text && Math.abs(other.baseline - glyph.baseline) < 0.3);
        const nearest = Math.min(...near.map((other) => Math.abs(other.x - glyph.x)));
        expect(nearest, `"${glyph.text}" on page ${n} at ${glyph.x.toFixed(2)}, ${glyph.baseline.toFixed(2)}`).toBeLessThan(0.3);
        worst = Math.max(worst, nearest);
        checked++;
      }
    }
    console.info(`Drawn in Chromium where the PDF draws them: ${checked} glyphs, the farthest ${worst.toFixed(3)} points off`);
    expect(checked).toBeGreaterThan(3000);
  });

  it("draws each box where its PDF has it: backgrounds, borders, the image, its content cut to its room", async () => {
    const paginator = await createPaginator({ fonts });
    const { svg, layout } = paginator.paginate(report, { svg: true, layout: true });
    const page1 = svg![0]!;
    const pt = (px: number) => Math.round(px * 0.75 * 100) / 100;
    const box = (type: string) => layout!.nodes.find((node) => node.page === 1 && node.type === type)!;
    // The Section's background, the Column's, the Image: each at its box (the layout's, in px; the SVG's in points).
    const section = box("Section");
    expect(page1).toContain(`<rect x="${pt(section.x)}" y="${pt(section.y)}" width="${pt(section.width)}" height="${pt(section.height)}" fill="#f3f4f6"/>`);
    const image = box("Image");
    expect(page1).toMatch(new RegExp(`<image x="${pt(image.x)}" y="${pt(image.y)}" width="${pt(image.width)}" height="${pt(image.height)}"`));
    // The Section's top border (3px, 2.25 points) inside its box, its middle 1.125 points down; the Column's, all four sides.
    expect(page1).toContain(`<line x1="${pt(section.x)}" y1="${Math.round((pt(section.y) + 1.125) * 100) / 100}" x2="${pt(section.x + section.width)}"`);
    expect(page1).toMatch(/<rect [^>]*fill="none" stroke="#000000" stroke-width="0.75"\/>/);
    // Each image where its PDF draws it, the one in a line of text too (on its baseline, fitted on its bottom edge).
    const { pdf } = await renderPdf(report, { fonts });
    const document = await getDocument({ data: pdf.slice(), useSystemFonts: false, disableFontFace: true, verbosity: 0 }).promise;
    const drawn = await images(await document.getPage(1));
    const inSvg = [...page1.matchAll(/<image x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)].map((m) => m.slice(1).map(Number));
    expect(drawn.length).toBe(2);
    expect(inSvg.length).toBe(2);
    for (const image of drawn) {
      const near = inSvg.filter(([x, y, width, height]) => Math.abs(x - image.x) < 0.05 && Math.abs(y - image.y) < 0.05 && Math.abs(width - image.width) < 0.05 && Math.abs(height - image.height) < 0.05);
      expect(near, JSON.stringify(image)).toHaveLength(1);
    }
    expect(page1).toContain('preserveAspectRatio="xMidYMax meet"');
    // Its content cut to its room: below the header, above the footer, inside the margins.
    const [room] = layout!.pages;
    expect(page1).toContain(`viewBox="36 ${pt(room.room.top)} ${523.28} ${pt(room.room.bottom - room.room.top)}" overflow="hidden"`);
  });

  it("defines each image once where asked, drawn from it on every page: a long Document's header image in the page once", async () => {
    const header = png(400, 400, true);
    const design = (
      <Document>
        <PageHeader>
          <Image src={header} alt="Letterhead" style={{ width: 120 }} />
        </PageHeader>
        {Array.from({ length: 100 }, (_, i) => (
          <Text key={i}>{sentences(125, `paragraph ${i}`)}</Text>
        ))}
      </Document>
    );
    const paginator = await createPaginator();
    const inline = paginator.paginate(design, { diagnostics: false, svg: true });
    const shared = paginator.paginate(design, { diagnostics: false, svg: { shareImages: true } });
    const pages = shared.svg!.length;
    expect(pages).toBeGreaterThanOrEqual(100);
    expect(header.length).toBeGreaterThan(140_000);
    // Each page draws it inline otherwise: its file in every page.
    expect(inline.svg!.every((page) => page!.includes(header))).toBe(true);
    // Shared: in svgImages once (its href, and xlink:href for older readers), in no page: each page smaller than drawn
    // inline by the image, all of it a fraction of the pages drawn inline.
    expect(shared.svgImages!.split(header).length - 1).toBe(2);
    expect(shared.svg!.every((page, i) => !page!.includes("data:image") && page!.length < inline.svg![i]!.length - header.length + 300)).toBe(true);
    const total = (svg: Array<string | undefined>, extra = 0) => svg.reduce((sum, page) => sum + page!.length, extra);
    expect(total(shared.svg!, shared.svgImages!.length)).toBeLessThan(total(inline.svg!) / 4);
    // In Chromium, each page's image drawn from its symbol where the PDF draws it.
    const page = await browser.newPage();
    await page.setContent(`<!doctype html><html><body style="margin:0">${shared.svgImages}${shared.svg!.slice(0, 2).join("")}</body></html>`);
    const boxes = await page.evaluate(() =>
      Array.from(document.querySelectorAll("body > svg[viewBox] use")).map((use) => {
        const box = (use as SVGGraphicsElement).getBBox();
        return [box.x, box.y, box.width, box.height].map((v) => Math.round(v * 100) / 100);
      })
    );
    const { pdf } = await renderPdf(design);
    const file = await getDocument({ data: pdf.slice(), verbosity: 0 }).promise;
    const drawn = await images(await file.getPage(1));
    expect(boxes).toHaveLength(2);
    expect(boxes[0]).toEqual([drawn[0].x, drawn[0].y, drawn[0].width, drawn[0].height].map((v) => Math.round(v * 100) / 100));
    expect(boxes[0][2]).toBeGreaterThan(0);
  });
});
