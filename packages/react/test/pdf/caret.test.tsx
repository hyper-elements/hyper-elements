/**
 * Where a caret goes on a Document's pages (caretAt(), caretBox()) and what a selection covers (selectionBoxes()), from
 * a paginator's layout with its lines: each line where its PDF draws it, read back with pdf.js, and each character
 * where it's drawn (the measuring test holds every character's edges to react-pdf's own, drawn).
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { ReactElement } from "react";
import { Button, Document, Image, LineBreak, List, ListItem, PageFooter, PageHeader, PageNumber, Section, Span, Table, TableCell, TableRow, Text } from "@hyper-elements/react";
import { caretAt, caretBox, createPaginator, renderPdf, selectionBoxes, type DocumentLayout, type DocumentLine, type DocumentNode } from "../../src/pdf";
import { arabic, arabicSentences } from "./arabic";
import { glyphs } from "./operators";
import { png } from "./png";

const sentences = (count: number, what: string) => Array.from({ length: count }, (_, i) => `Sentence ${i + 1} of ${what}.`).join(" ");
const liberation = new Uint8Array(readFileSync(join(dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json")), "standard_fonts", "LiberationSans-Regular.ttf")));
const fonts = [
  { family: "Noto Arabic", src: arabic },
  { family: "Liberation", src: liberation },
];

/** A Document with text of each kind a caret goes in: every alignment, a paragraph across pages, a list, a table, a button. */
const report = (
  <Document>
    <PageHeader>
      <Text style={{ fontSize: 10 }}>Quarterly report</Text>
    </PageHeader>
    {(["left", "center", "right", "justify"] as const).map((textAlign) => (
      <Text key={textAlign} style={{ textAlign }}>
        {sentences(8, textAlign)} <Span style={{ fontWeight: 700 }}>In bold.</Span> {sentences(3, `${textAlign}, after`)}
      </Text>
    ))}
    <Text style={{ textAlign: "justify" }}>{sentences(200, "one long paragraph")}</Text>
    <List type="number">
      <ListItem>{sentences(6, "a list item")}</ListItem>
    </List>
    <Table>
      <TableRow>
        <TableCell>{sentences(3, "a cell")}</TableCell>
        <TableCell>$1.00</TableCell>
      </TableRow>
    </Table>
    <Section>
      <Button href="https://example.com">Read more</Button>
    </Section>
  </Document>
);

const laidOut = async (design: ReactElement): Promise<DocumentLayout> => (await (await createPaginator({ fonts })).paginate(design, { layout: true })).layout!;
const lined = (layout: DocumentLayout) => layout.nodes.filter((node): node is DocumentNode & { lineBoxes: DocumentLine[]; text: string } => !!node.lineBoxes);
/** px in PDF points. */
const pt = (px: number) => px * 0.75;

describe("a paginator's layout with its lines", () => {
  it("has each character where its PDF draws it: the caret before it where its glyph starts", async () => {
    const layout = await laidOut(report);
    const { pdf } = await renderPdf(report, { fonts });
    const document = await getDocument({ data: pdf.slice(), useSystemFonts: false, disableFontFace: true, verbosity: 0 }).promise;
    const nodes = lined(layout);
    // Each kind has its lines: the paragraphs, the one across pages on each, the list item's, the cell's, the button's.
    expect(new Set(nodes.map((node) => node.type))).toEqual(new Set(["Text", "ListItem", "TableCell", "Button"]));
    expect(nodes.some((node) => node.part > 0)).toBe(true);
    let checked = 0;
    for (let n = 1; n <= document.numPages; n++) {
      const drawn = await glyphs(await document.getPage(n));
      for (const node of nodes.filter((node) => node.page === n)) {
        for (const line of node.lineBoxes) {
          const words = node.text.slice(line.start, line.end).trimEnd();
          if (!words) continue;
          // The glyphs on its baseline, across it, left to right: its characters (a space it ends in, or a hyphen where a
          // word is broken, after them).
          const on = drawn.filter((glyph) => Math.abs(glyph.baseline - pt(line.baseline)) < 0.3 && glyph.x >= pt(line.x) - 0.5 && glyph.x <= pt(line.x + line.width) + 0.5).sort((a, b) => a.x - b.x);
          expect([words, `${words}-`], `${node.path} on page ${n}`).toContain(on.map((glyph) => glyph.text).join("").trimEnd());
          words.split("").forEach((_, i) => {
            const caret = caretBox(layout, { path: node.path, offset: line.start + i, page: n })!;
            expect(Math.abs(pt(caret.x) - on[i].x), `${node.path} on page ${n}, character ${line.start + i}`).toBeLessThan(0.05);
          });
          checked += words.length;
        }
      }
    }
    expect(checked).toBeGreaterThan(5000);
  });

  it("puts a caret at a place back where it's drawn, at each offset of each line (caretAt() of caretBox())", async () => {
    const layout = await laidOut(report);
    for (const node of lined(layout)) {
      for (const line of node.lineBoxes) {
        for (let offset = line.start; offset <= line.end; offset++) {
          const box = caretBox(layout, { path: node.path, offset, page: node.page })!;
          const back = caretAt(layout, { page: box.page, x: box.x, y: box.y + box.height / 2 })!;
          expect(back.path).toBe(node.path);
          // The offset it's at, or one drawn in the same place (where a line's spaces end it, or a run meets the next),
          // on the side it was found: caretBox() of it is the same box, on the same line.
          expect(caretBox(layout, back), `${node.path} at ${offset}`).toEqual(box);
        }
      }
    }
  });

  it("puts the caret at the start of the next line after a line's last character, or (affinity before) at the end of its own", async () => {
    const layout = await laidOut(report);
    const node = lined(layout).find((node) => node.text.startsWith("Sentence 1 of left"))!;
    const [first, second] = node.lineBoxes;
    expect(first.end).toBe(second.start);
    const after = caretBox(layout, { path: node.path, offset: first.end })!;
    const before = caretBox(layout, { path: node.path, offset: first.end, affinity: "before" })!;
    expect(after).toEqual({ page: 1, x: second.x, y: second.y, height: second.height });
    expect(before.y).toBe(first.y);
    expect(before.x).toBeGreaterThan(second.x + 100);
    // On the next page, where a paragraph goes on: its first line there.
    const long = lined(layout).filter((node) => node.text.startsWith("Sentence 1 of one long"));
    expect(long.length).toBeGreaterThan(1);
    const [here, next] = long;
    const end = here.lineBoxes[here.lineBoxes.length - 1].end;
    expect(caretBox(layout, { path: here.path, offset: end })!.page).toBe(next.page);
    expect(caretBox(layout, { path: here.path, offset: end, affinity: "before" })!.page).toBe(here.page);
  });

  it("selects a stretch of text: a box on each line it's on, from caret to caret, across pages", async () => {
    const layout = await laidOut(report);
    const node = lined(layout).find((node) => node.text.startsWith("Sentence 1 of left"))!;
    const [first, second] = node.lineBoxes;
    // "Sentence 2" on the first line: from its caret to its caret.
    const from = node.text.indexOf("Sentence 2");
    const [box] = selectionBoxes(layout, { path: node.path, start: from, end: from + "Sentence 2".length });
    expect(box.x).toBe(caretBox(layout, { path: node.path, offset: from })!.x);
    expect(box.x + box.width).toBeCloseTo(caretBox(layout, { path: node.path, offset: from + "Sentence 2".length })!.x, 1);
    expect(box.y).toBe(first.y);
    // From the first line's middle into the second: two boxes.
    const across = selectionBoxes(layout, { path: node.path, start: from, end: second.start + 5 });
    expect(across.map(({ y }) => y)).toEqual([first.y, second.y]);
    // The long paragraph, all of it: a box on each of its lines on each page.
    const long = lined(layout).filter((node) => node.text.startsWith("Sentence 1 of one long"));
    const all = selectionBoxes(layout, { path: long[0].path, start: 0, end: long[0].text.length });
    expect(all.length).toBe(long.reduce((sum, node) => sum + node.lineBoxes.length, 0));
    expect(new Set(all.map((box) => box.page))).toEqual(new Set(long.map((node) => node.page)));
  });

  it("puts a caret in text written right to left from its right, English words in it left to right, each where it's drawn", async () => {
    const words = `${arabicSentences(1)} PDF ${arabicSentences(1, 2)}`;
    const design = (
      <Document dir="rtl" style={{ fontFamily: "Noto Arabic" }}>
        <Text>{words}</Text>
      </Document>
    );
    const layout = await laidOut(design);
    const [node] = lined(layout);
    const [line] = node.lineBoxes;
    expect(node.text).toBe(words);
    // The caret before its first character is at its right, after its last at its left.
    expect(caretBox(layout, { path: node.path, offset: 0 })!.x).toBeCloseTo(line.x + line.width, 1);
    expect(caretBox(layout, { path: node.path, offset: words.length })!.x).toBeCloseTo(line.x, 1);
    // "PDF", left to right: P, D and F each further right, in a run of its own.
    const p = words.indexOf("PDF");
    const xs = [0, 1, 2, 3].map((i) => caretBox(layout, { path: node.path, offset: p + i, affinity: i === 0 ? "after" : "before" })!.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    const run = line.runs.find((run) => run.start <= p && run.end >= p + 3 && !run.rtl)!;
    expect(run).toBeDefined();
    // A caret placed at P's left is before it.
    expect(caretAt(layout, { page: 1, x: xs[0] + 0.1, y: line.y + 1 })!.offset).toBe(p);
    // "PD": one box. "F" and the Arabic word after "PDF ", written on together: drawn apart, with "PD" between (the
    // word is left of "PDF", the F at its right), so two boxes.
    expect(selectionBoxes(layout, { path: node.path, start: p, end: p + 2 })).toHaveLength(1);
    const end = words.indexOf(" ", p + 4);
    const split = selectionBoxes(layout, { path: node.path, start: p + 2, end });
    expect(split).toHaveLength(2);
    expect(split.every((box) => box.y === line.y)).toBe(true);
    const pd = selectionBoxes(layout, { path: node.path, start: p, end: p + 2 })[0];
    expect(split.some((box) => box.x + box.width <= pd.x + 0.01) && split.some((box) => box.x >= pd.x + pd.width - 0.01)).toBe(true);
  });

  it("finds a caret on the side it's placed: the end of a line broken inside a word, where right-to-left text meets left-to-right", async () => {
    // A word broken by a hyphen where its line ends (no space between): the end of a line is the next's start.
    const long = await laidOut(
      <Document style={{ fontFamily: "Liberation" }}>
        <Text style={{ width: 200 }}>{"Internationalization ".repeat(6)}</Text>
      </Document>
    );
    const [node] = lined(long);
    const [first, second] = node.lineBoxes;
    expect(first.end).toBe(second.start);
    expect(node.text[first.end - 1]).not.toBe(" ");
    // Right of its first line's last character: the end of that line, not the next's start.
    const end = caretAt(long, { page: 1, x: first.x + first.width + 2, y: first.y + first.height / 2 })!;
    expect(end).toMatchObject({ offset: first.end, affinity: "before" });
    expect(caretBox(long, end)!.y).toBe(first.y);
    // At the next line's start: that line's.
    const start = caretAt(long, { page: 1, x: second.x, y: second.y + second.height / 2 })!;
    expect(start).toMatchObject({ offset: second.start, affinity: "after" });
    expect(caretBox(long, start)!.y).toBe(second.y);
    // "PDF" in Arabic: its first offset at the Arabic word's end (before), and at P's left (after), drawn apart.
    const words = `${arabicSentences(1)} PDF ${arabicSentences(1, 2)}`;
    const bidi = await laidOut(
      <Document dir="rtl" style={{ fontFamily: "Noto Arabic" }}>
        <Text>{words}</Text>
      </Document>
    );
    const [text] = lined(bidi);
    const offset = words.indexOf("PDF");
    for (const affinity of ["before", "after"] as const) {
      const box = caretBox(bidi, { path: text.path, offset, affinity })!;
      const hit = caretAt(bidi, { page: box.page, x: box.x, y: box.y + box.height / 2 })!;
      expect(hit, affinity).toMatchObject({ offset, affinity });
      expect(caretBox(bidi, hit)).toEqual(box);
    }
    expect(Math.abs(caretBox(bidi, { path: text.path, offset, affinity: "before" })!.x - caretBox(bidi, { path: text.path, offset })!.x)).toBeGreaterThan(10);
  });

  it("puts a caret in an empty text, and after a line break a text ends in, where its first character would go", async () => {
    const layout = await laidOut(
      <Document style={{ fontFamily: "Liberation" }}>
        <Text id="empty">{""}</Text>
        <Text id="centered" style={{ textAlign: "center" }}>{""}</Text>
        <Text id="broken">{"A line\n"}</Text>
        <Text id="next">Next</Text>
      </Document>
    );
    const node = (id: string) => layout.nodes.find((node) => node.id === id)!;
    const next = node("next").lineBoxes![0];
    // An empty text: a line as tall as one of its text, with no characters, at its start (its alignment's).
    for (const id of ["empty", "centered"]) {
      const [line] = node(id).lineBoxes!;
      expect(line, id).toMatchObject({ start: 0, end: 0, width: 0, height: next.height });
      const box = caretBox(layout, { path: node(id).path, offset: 0 })!;
      expect(caretAt(layout, { page: 1, x: box.x, y: box.y + box.height / 2 })!.path, id).toBe(node(id).path);
    }
    const content = node("empty");
    expect(node("empty").lineBoxes![0].x).toBe(content.x);
    expect(node("centered").lineBoxes![0].x).toBeCloseTo(content.x + content.width / 2, 0);
    // After a line break it ends in: a line under its last, as tall.
    const [line, after] = node("broken").lineBoxes!;
    expect(node("broken").lineBoxes).toHaveLength(2);
    expect(after).toMatchObject({ start: 7, end: 7, width: 0, y: line.y + line.height, height: line.height });
    expect(caretBox(layout, { path: node("broken").path, offset: 7 })).toEqual({ page: 1, x: content.x, y: after.y, height: after.height });
  });

  it("has a split paragraph's blank line where the paragraph drawn whole has it, with its carets, in every alignment", async () => {
    // A letter that fits its page, or, with a deep bottom margin, goes on to a second, its first part drawn line by line.
    // Between its greeting's line break and its body's: nothing, spaces, or spaces in a larger size (a line 72px tall).
    const blanks = { nothing: "", spaces: "   ", large: <Span style={{ fontSize: 48 }}>{"   "}</Span> };
    const letter = (split: boolean, textAlign: "left" | "center" | "right", blank: ReactElement | string) => (
      <Document margin={{ top: 48, right: 48, bottom: split ? 900 : 48, left: 48 }} style={{ fontFamily: "Liberation" }}>
        <Text style={{ textAlign }}>
          Dear Ms Rivera,
          <LineBreak />
          {blank}
          <LineBreak />
          Thank you for your order. {sentences(20, "the letter")}
        </Text>
      </Document>
    );
    const paginator = await createPaginator({ fonts });
    const cases = [...Object.entries(blanks).map(([name, blank]) => ["left", name, blank] as const), ["center", "nothing", ""] as const, ["right", "nothing", ""] as const];
    for (const [textAlign, name, blank] of cases) {
      const what = `${textAlign}, ${name}`;
      const whole = paginator.paginate(letter(false, textAlign, blank), { layout: true }).layout!;
      const split = paginator.paginate(letter(true, textAlign, blank), { layout: true }).layout!;
      expect(split.nodes.filter((node) => node.path === "root.children[0]").length, what).toBeGreaterThan(1);
      // Its greeting, the blank line after its line break, and the top of the line its body starts on (drawn with the
      // room its spaces were given, it can sit a point or two across from where the paragraph whole sets it).
      const first = (layout: DocumentLayout) =>
        layout.nodes
          .find((node) => node.path === "root.children[0]" && node.page === 1)!
          .lineBoxes!.slice(0, 3)
          .map(({ start, end, x, y, height }, i) => (i < 2 ? { start, end, x, y, height } : { start, y }));
      expect(first(split), what).toEqual(first(whole));
      const [, line] = first(whole) as Array<{ start: number; end: number; height: number }>;
      expect(line.start, what).toBe(16);
      expect(line.height, what).toBe(name === "large" ? 72 : 24);
      for (let offset = 0; offset <= line.end; offset++) {
        const { x, ...at } = caretBox(whole, { path: "root.children[0]", offset })!;
        const { x: splitX, ...splitAt } = caretBox(split, { path: "root.children[0]", offset, page: 1 })!;
        expect(splitAt, `${what}: offset ${offset}`).toEqual(at);
        expect(splitX, `${what}: offset ${offset}`).toBeCloseTo(x, 1);
      }
    }
  });

  it("has a footer's text on each page as that page draws it, its page number in it, on pages its content went on to", async () => {
    const layout = await laidOut(
      <Document>
        <PageFooter>
          <Text>Page <PageNumber /> of <PageNumber total /></Text>
        </PageFooter>
        <Text>{sentences(150, "a text that goes on")}</Text>
      </Document>
    );
    const footers = lined(layout).filter((node) => node.text.startsWith("Page"));
    expect(footers.map(({ page, text }) => ({ page, text }))).toEqual([
      { page: 1, text: "Page 1 of 2" },
      { page: 2, text: "Page 2 of 2" },
    ]);
    const [, second] = footers;
    expect(caretBox(layout, { path: second.path, offset: 6, page: 2 })).toMatchObject({ page: 2, y: second.lineBoxes[0].y });
  });

  it("has a page number's text in the content as the page it went on to draws it, with its lines", async () => {
    const layout = await laidOut(
      <Document size="A5">
        {Array.from({ length: 40 }, (_, i) => (
          <Text key={i}>Record {i + 1}</Text>
        ))}
        <Text id="number">
          Body page <PageNumber /> of <PageNumber total />
        </Text>
      </Document>
    );
    const node = layout.nodes.find(({ id }) => id === "number")!;
    expect(node.page).toBe(2);
    expect(node.text).toBe("Body page 2 of 2");
    expect(node.lineBoxes).toHaveLength(1);
    expect(caretBox(layout, { path: node.path, offset: 10, page: 2 })).toMatchObject({ page: 2, y: node.lineBoxes![0].y });
  });

  it("lays out and draws the pages a view asks for only, each as it is in the whole layout, and says which pages changed", async () => {
    const report = (typed: string) => (
      <Document>
        <PageFooter>
          <Text>
            Page <PageNumber /> of <PageNumber total />
          </Text>
        </PageFooter>
        {Array.from({ length: 50 }, (_, i) => (
          <Text key={i}>{sentences(12, `paragraph ${i}${i === 45 ? typed : ""}`)}</Text>
        ))}
      </Document>
    );
    const paginator = await createPaginator({ fonts });
    const whole = paginator.paginate(report(""), { layout: true, svg: true });
    const pages = whole.plan.pages.length;
    expect(pages).toBeGreaterThan(3);
    const some = paginator.paginate(report(""), { layout: { pages: [2] }, svg: { pages: [2, 3] } });
    expect(some.plan).toEqual(whole.plan);
    // Its layout: page 2's nodes, each as in the whole layout; every page's paper and room.
    expect(some.layout!.only).toEqual([2]);
    expect(some.layout!.nodes).toEqual(whole.layout!.nodes.filter((node) => node.page === 2));
    expect(some.layout!.pages).toEqual(whole.layout!.pages);
    // Its SVG: pages 2 and 3, as in the whole; the others not drawn.
    expect(some.svg!.map((svg, i) => (svg === undefined ? undefined : svg === whole.svg![i]))).toEqual(whole.svg!.map((_, i) => (i === 1 || i === 2 ? true : undefined)));
    // Every page's room as the whole layout has it, a footer that grows a digit's too, asked for or not.
    const footed = (
      <Document size="A5">
        <PageFooter>
          <Text style={{ width: 68, fontFamily: "Courier" }}>
            Page# <PageNumber />
          </Text>
        </PageFooter>
        {Array.from({ length: 270 }, (_, i) => (
          <Text key={i}>Record {i + 1}</Text>
        ))}
      </Document>
    );
    const full = paginator.paginate(footed, { layout: true, diagnostics: false });
    expect(full.plan.pages.length).toBeGreaterThanOrEqual(10);
    expect(paginator.paginate(footed, { layout: { pages: [10] }, diagnostics: false }).layout!.pages).toEqual(full.layout!.pages);
    // A page it wasn't laid out for: said, not an empty answer.
    expect(() => caretAt(some.layout!, { page: 1, x: 100, y: 100 })).toThrow(/pages 2 only, not page 1/);
    // Each page's hash: the same where nothing on it changed. Typed into the paragraph on the last page, the pages before
    // it are as they were; the page it's on isn't.
    const typed = paginator.paginate(report(" and more"), { diagnostics: false });
    expect(typed.plan.pages).toHaveLength(pages);
    const last = typed.plan.pages.findIndex((page) => page.parts.some((part) => part.path === "root.children[46]"));
    expect(last).toBeGreaterThan(2);
    typed.plan.pages.forEach((page, i) => expect(page.hash === whole.plan.pages[i].hash, `page ${i + 1}`).toBe(i < last && !whole.plan.pages[i].parts.some((part) => part.path === "root.children[46]")));
  });

  it("hashes a page by what's drawn on it, in any process: its images' bytes and its fonts' files, not what was seen before", async () => {
    const uri = "https://example.test/logo.png";
    const design = (
      <Document>
        <Image src={{ src: uri, width: 10, height: 10 }} alt="Logo" />
      </Document>
    );
    // Each in a process of its own (two Workers, two servers), with the package as built: another logo at the same URL, another
    // hash; the same logo, the same hash.
    const script = `
      import { createElement as el } from "react";
      import { Document, Image } from "@hyper-elements/react";
      import { createPaginator } from "@hyper-elements/react/pdf";
      const paginator = await createPaginator({ images: { "${uri}": Buffer.from(process.argv[1], "base64") } });
      const { plan } = paginator.paginate(el(Document, null, el(Image, { src: { src: "${uri}", width: 10, height: 10 }, alt: "Logo" })), { diagnostics: false });
      console.log(plan.pages[0].hash);
    `;
    const inProcess = (image: string) => {
      const run = spawnSync(process.execPath, ["--input-type=module", "-e", script, image.split(",")[1]], { encoding: "utf8" });
      expect(run.status, run.stderr).toBe(0);
      return run.stdout.trim();
    };
    expect(inProcess(png(10, 10, true))).not.toBe(inProcess(png(10, 10)));
    expect(inProcess(png(10, 10))).toBe(inProcess(png(10, 10)));
    expect(inProcess(png(10, 10))).toBe((await createPaginator({ images: { [uri]: Buffer.from(png(10, 10).split(",")[1], "base64") } })).paginate(design, { diagnostics: false }).plan.pages[0].hash);
    // Another file under the same family: another page.
    const font = (name: string) => readFileSync(new URL(`../../../../templates/_assets/fonts/${name}.ttf`, import.meta.url));
    const branded = (
      <Document style={{ fontFamily: "Brand" }}>
        <Text>Every word has its place.</Text>
      </Document>
    );
    const inter = (await createPaginator({ fonts: [{ family: "Brand", src: font("Inter-400") }] })).paginate(branded).plan.pages[0].hash;
    const mono = (await createPaginator({ fonts: [{ family: "Brand", src: font("JetBrainsMono-500") }] })).paginate(branded).plan.pages[0].hash;
    expect(mono).not.toBe(inter);
  });

  it("puts a caret between characters, never inside one: a letter and its accent, a pair of UTF-16 units", async () => {
    // "é" as e and an acute accent, and "𝐀" (a pair of UTF-16 units), in a font with each.
    const words = "Café and 𝐀 bold";
    const design = (
      <Document style={{ fontFamily: "Liberation" }}>
        <Text>{words}</Text>
      </Document>
    );
    const layout = await laidOut(design);
    const [node] = lined(layout);
    const accent = words.indexOf("́");
    const pair = words.indexOf("𝐀") + 1;
    for (const inside of [accent, pair]) {
      // An offset inside a character has its caret before it, and a place there is before it or after it.
      expect(caretBox(layout, { path: node.path, offset: inside })!.x).toBe(caretBox(layout, { path: node.path, offset: inside - 1 })!.x);
      const box = caretBox(layout, { path: node.path, offset: inside })!;
      expect([inside - 1, inside + 1]).toContain(caretAt(layout, { page: 1, x: box.x, y: box.y + 1 })!.offset);
    }
    // No place puts a caret inside one.
    const [line] = node.lineBoxes;
    for (let x = line.x - 5; x < line.x + line.width + 5; x += 0.5) {
      const { offset } = caretAt(layout, { page: 1, x, y: line.y + 1 })!;
      expect([accent, pair]).not.toContain(offset);
    }
  });
});
