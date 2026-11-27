/**
 * A Document measured without drawing it (react-pdf-measure.ts: react-pdf's own text layout, and the page model's
 * arithmetic) as react-pdf lays it out when it draws it: every block's box and every line (its characters, its top, its
 * width and its glyphs' advances) within 0.05 points, over the gallery's, the stress set's and the templates' Documents
 * and designs made to stress it (every alignment, bold runs, letter spacing, a transform, a line's image, a font file
 * with its kerning, text written right to left, padding, borders and gaps, Rows (split by their columns too), Lists, Tables). What the plan is made from before anything's drawn.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement, type ReactElement } from "react";
import { Button, Column, Document, Heading, Image, Layer, List, ListItem, PageFooter, PageHeader, PageNumber, prepare, Row, Section, Span, Table, TableCell, TableRow, Text, Video } from "@hyper-elements/react";
import type { PlannedPart } from "@hyper-elements/core";
import { createLayout, flowDocument, reactPdf, reactPdfLayout, textkitAgrees, writeDocument, type Block, type DrawnDocument, type Layout, type PlacedPage, type Textkit } from "@hyper-elements/core/pdf";
import { gallery } from "../../src/primitives/examples/gallery";
import { stress } from "../../src/primitives/examples/stress";
import { arabicFonts, arabicSentences } from "./arabic";
import { png } from "./png";
const liberation = (name: string) => readFileSync(join(dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json")), "standard_fonts", name));
const PNG = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==`;
const photo = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../../templates/_assets/companies/nike/pick-1.jpg"));
/** The photo turned on its side by its EXIF (orientation 6): an APP1 segment after its start. */
const turned = Buffer.concat([photo.subarray(0, 2), Buffer.from([0xff, 0xe1, 0, 34, ...Buffer.from("Exif\0\0", "latin1"), 0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, 6, 0, 0, 0, 0, 0, 0]), photo.subarray(2)]);
const jpeg = (bytes: Buffer) => `data:image/jpeg;base64,${bytes.toString("base64")}`;
const para = (i: number) => `Paragraph ${i}: Elements writes the same design to email, the web, print and PDF, so this stands in for a section.`;
const synthetic: Record<string, ReactElement> = {
  aligned: <Document>{(["left", "center", "right", "justify"] as const).map((a) => <Text key={a} style={{ textAlign: a }}>{Array.from({ length: 30 }, (_, i) => (i % 5 === 2 ? <Span key={i} style={{ fontWeight: 700 }}>{`Bold ${i}. `}</Span> : `Sentence ${i} of a paragraph. `))}</Text>)}</Document>,
  styled: <Document><PageHeader style={{ padding: [0, 0, 8, 0] }}><Text style={{ fontSize: 10 }}>Header</Text></PageHeader><PageFooter><Text style={{ fontSize: 10, textAlign: "right" }}>Page <PageNumber /> of <PageNumber total /></Text></PageFooter><Heading level={2}>Title</Heading><Text style={{ letterSpacing: 1, textTransform: "uppercase" }}>{para(1)}</Text><Text style={{ fontSize: 22, lineHeight: 1.2 }}>{para(2)}</Text><Text>Inline <Image src={{ src: PNG, width: 12, height: 12 }} alt="x" /> image in a line, {para(3)}</Text></Document>,
  boxes: <Document style={{ gap: 12 }}><Section style={{ padding: 24, border: { top: { width: 2, style: "solid", color: "#000000" } }, backgroundColor: "#eeeeee", gap: 8 }}>{Array.from({ length: 4 }, (_, i) => <Text key={i}>{para(i)}</Text>)}</Section><Row style={{ gap: 16 }}><Column><Text>{para(5)}</Text><Text>{para(6)}</Text></Column><Column style={{ width: 200 }}><Text>{para(7)}</Text></Column></Row><List type="number"><ListItem>{para(8)}</ListItem><ListItem>{para(9)}</ListItem></List><Table><TableRow header><TableCell>Item</TableCell><TableCell>Amount</TableCell></TableRow>{Array.from({ length: 5 }, (_, i) => <TableRow key={i}><TableCell>{para(i)}</TableCell><TableCell>$1.00</TableCell></TableRow>)}</Table></Document>,
  long: (
    <Document>
      <PageHeader>
        <Text style={{ fontSize: 10 }}>Header</Text>
      </PageHeader>
      <Section style={{ padding: 24, backgroundColor: "#f3f4f6", gap: 6 }}>
        {(["left", "center", "right", "justify"] as const).map((textAlign) => (
          <Text key={textAlign} style={{ textAlign }}>
            {Array.from({ length: 60 }, (_, i) => (i % 7 === 3 ? <Span key={i} style={{ fontWeight: 700 }}>{`Bold ${i}. `}</Span> : `Sentence ${i} of a long paragraph. `))}
          </Text>
        ))}
      </Section>
      <Table>
        <TableRow header>
          <TableCell>Item</TableCell>
          <TableCell>Amount</TableCell>
        </TableRow>
        {Array.from({ length: 40 }, (_, i) => (
          <TableRow key={i}>
            <TableCell>{para(i)}</TableCell>
            <TableCell>$1.00</TableCell>
          </TableRow>
        ))}
      </Table>
    </Document>
  ),
  // Images sized by their files, where nothing gives their height: a wide PNG, a photo as wide as its page, one turned
  // on its side by its EXIF, a video's thumbnail, and one taller than its page (no taller than its area).
  sized: (
    <Document style={{ gap: 8 }}>
      <Image src={png(40, 10)} alt="Wide" style={{ width: 300 }} />
      <Image src={jpeg(photo)} alt="A photo" />
      <Image src={png(2000, 100)} alt="Wider than its page" />
      <Row style={{ gap: 12 }}>
        <Column style={{ width: 140 }}>
          <Image src={jpeg(turned)} alt="Turned" style={{ width: 120 }} />
        </Column>
        <Column>
          <Text>{para(1)}</Text>
        </Column>
      </Row>
      <Video src="https://www.youtube.com/watch?v=dQw4w9WgXcQ" thumbnail={png(16, 9)} style={{ width: 240 }} />
      <Image src={png(2, 30)} alt="Taller than its page" style={{ width: 400 }} />
      <Text>{para(2)}</Text>
    </Document>
  ),
  // Buttons, as wide as their words: react-pdf lays a Button's words out at the width it's offered and keeps those lines,
  // aligned back into its box.
  buttons: (
    <Document style={{ gap: 8 }}>
      {["invoice", "$1,234.56 well-known quarterly:", "quarterly: incomprehensibilities, amount", "Read the whole report, with every chart and table in it, as it was sent to the board"].map((words, i) => (
        <Button key={i} href="https://example.com">
          {words}
        </Button>
      ))}
      <Row style={{ gap: 12 }}>
        <Column style={{ width: 120 }}>
          <Button href="https://example.com">quarterly: incomprehensibilities, amount</Button>
        </Column>
        <Column>
          <Button href="https://example.com">$1,234.56 well-known quarterly:</Button>
        </Column>
      </Row>
    </Document>
  ),
  embedded: <Document style={{ fontFamily: "Liberation" }}>{Array.from({ length: 12 }, (_, i) => <Text key={i} style={{ textAlign: i % 2 ? "justify" : "left" }}>{`AVATAR WAVE Type ${i}: ` + para(i)}</Text>)}</Document>,
  // Rows of Columns taller than a page, split by their columns: one centered across its page, with a column that ends
  // early and keeps its room; one stretched down it, a column with a background going on beside one that ends.
  rows: (
    <Document style={{ gap: 12 }}>
      <Row style={{ gap: 16, justifyContent: "center" }}>
        <Column style={{ width: 300, padding: 8, backgroundColor: "#f3f4f6" }}>{Array.from({ length: 14 }, (_, i) => <Text key={i}>{para(i)}</Text>)}</Column>
        <Column style={{ width: 160 }}>{Array.from({ length: 3 }, (_, i) => <Text key={i}>{para(i)}</Text>)}</Column>
      </Row>
      <Row style={{ gap: 12, alignItems: "stretch" }}>
        <Column style={{ padding: 12, backgroundColor: "#e5e7eb" }}>{Array.from({ length: 4 }, (_, i) => <Text key={i}>{para(i)}</Text>)}</Column>
        <Column style={{ padding: 12, backgroundColor: "#fef3c7", gap: 6 }}>{Array.from({ length: 30 }, (_, i) => <Text key={i}>{para(i)}</Text>)}</Column>
      </Row>
    </Document>
  ),
  // Written right to left, in a font with Arabic letters: every alignment, a run of another color, English words in
  // it, and an English paragraph with Arabic in it; long enough to flow.
  arabic: (
    <Document dir="rtl" style={{ fontFamily: "Noto Arabic" }}>
      <Heading level={2}>عنوان التقرير</Heading>
      {(["right", "center", "left", "justify"] as const).map((textAlign, n) => (
        <Text key={textAlign} style={{ textAlign }}>
          {Array.from({ length: 24 }, (_, i) => (i % 4 === 1 ? <Span key={i} style={{ color: "#b91c1c" }}>{`ملف PDF رقم ${n * 24 + i}، كلمة Elements هنا. `}</Span> : `${arabicSentences(1, n * 24 + i)} `))}
        </Text>
      ))}
      <Text dir="ltr">{Array.from({ length: 12 }, (_, i) => `Sentence ${i} quotes «مرحبا بالعالم» in Arabic, then goes on. `)}</Text>
    </Document>
  ),
};
const fonts = [{ family: "liberation", data: new Uint8Array(liberation("LiberationSans-Regular.ttf")), weight: 400, style: "normal" as const }];
/** The font files a design is drawn with: its own family's, for those that name one. */
const given: Record<string, typeof fonts> = { embedded: fonts, arabic: arabicFonts };
/** The templates' Document designs (templates/documents/<name>/designs/*.tsx), each its default export. */
async function templateDesigns(): Promise<Array<[string, ReactElement]>> {
  const folder = join(dirname(fileURLToPath(import.meta.url)), "../../../../templates/documents");
  const files = readdirSync(folder).flatMap((name) => (existsSync(join(folder, name, "designs")) ? readdirSync(join(folder, name, "designs")).filter((file) => file.endsWith(".tsx")).map((file) => join(folder, name, "designs", file)) : []));
  return Promise.all(files.map(async (file) => [file.slice(folder.length + 1), createElement(((await import(file)) as { default: () => ReactElement }).default)] as [string, ReactElement]));
}

/** Every design measured: the gallery's, the stress tests' printed ones, the templates' and the ones above. */
const corpus = async (): Promise<Array<[string, ReactElement]>> => [
  ...Object.entries(gallery),
  ...Object.entries(stress).filter(([, e]) => e.roots !== "screen").map(([n, e]) => [n, e.template] as [string, ReactElement]),
  ...(await templateDesigns()),
  ...Object.entries(synthetic),
];

/** What a comparison counted, and each difference it found. */
interface Tally {
  blocks: number;
  lines: number;
  boxes: number;
  edges: number;
  unmeasured: number;
  differences: string[];
}
const tally = (): Tally => ({ blocks: 0, lines: 0, boxes: 0, edges: 0, unmeasured: 0, differences: [] });

/**
 * A Document's pages measured without drawing and as react-pdf draws them, each difference past 0.05 points in `out`:
 * every box, every line and every character's edges. `strict`: one not measured without drawing is a difference too.
 * `skew` moves what's measured down by it (a measurer that's off, to show the comparison finds one). Its pages as
 * measured without drawing, or as drawn where they weren't.
 */
async function compare(document: DrawnDocument, label: string, out: Tally, strict = true, skew = 0): Promise<PlacedPage[]> {
  const drawless = await reactPdfLayout(document);
  const drawn = (await reactPdf(document, { edges: true })).placed!;
  if (!drawless) {
    out.unmeasured++;
    if (strict) out.differences.push(`${label}: not measured without drawing`);
    return drawn;
  }
  // As many pages: one more or fewer is a difference, not a crash.
  if (drawn.length !== drawless.length) out.differences.push(`${label}: ${drawn.length} pages drawn, ${drawless.length} measured`);
  drawn.forEach((page, i) => {
    const d = drawless[i];
    if (!d) return;
    if (Math.abs(page.room.top - d.room.top) > 0.05 || Math.abs(page.room.bottom - d.room.bottom) > 0.05) out.differences.push(`${label} page ${i + 1}: its room`);
    const byPath = new Map(d.blocks.map((b) => [b.path, { ...b, y: b.y + skew }]));
    for (const b of page.blocks) {
      const m = byPath.get(b.path);
      out.blocks++;
      if (!m) {
        out.differences.push(`${label} ${b.path}: not measured`);
        continue;
      }
      if (Math.abs(b.y - m.y) > 0.05 || Math.abs(b.height - m.height) > 0.05 || Math.abs(b.x - m.x) > 0.05 || Math.abs(b.width - m.width) > 0.05) out.differences.push(`${label} ${b.path}: drawn ${JSON.stringify([b.x, b.y, b.width, b.height].map((v) => +v.toFixed(2)))}, measured ${JSON.stringify([m.x, m.y, m.width, m.height].map((v) => +v.toFixed(2)))}`);
      if ((b.lines?.length ?? 0) !== (m.lines?.length ?? 0)) {
        out.differences.push(`${label} ${b.path}: ${b.lines?.length} lines drawn, ${m.lines?.length} measured`);
        continue;
      }
      (b.lines ?? []).forEach((l, j) => {
        out.lines++;
        const k = m.lines![j];
        if (l.text !== k.text || Math.abs(l.top - k.top) > 0.05 || Math.abs(l.width - k.width) > 0.05 || Math.abs(l.natural - k.natural) > 0.05) out.differences.push(`${label} ${b.path} line ${j + 1}: drawn ${JSON.stringify([l.text, +l.top.toFixed(2), +l.width.toFixed(2), +l.natural.toFixed(2)])}, measured ${JSON.stringify([k.text, +k.top.toFixed(2), +k.width.toFixed(2), +k.natural.toFixed(2)])}`);
      });
      // Where each line's text is drawn, and each of its characters: its left and right edge across the page. A
      // measured line with no characters (a caret's, in an empty text or after its line break) draws nothing.
      const measuredBoxes = (m.boxes ?? []).filter((box) => !box.blank);
      if ((b.boxes?.length ?? 0) !== measuredBoxes.length) {
        out.differences.push(`${label} ${b.path}: ${b.boxes?.length} line boxes drawn, ${measuredBoxes.length} measured`);
        continue;
      }
      (b.boxes ?? []).forEach((l, j) => {
        const k = measuredBoxes[j];
        out.boxes++;
        if (Math.abs(l.top - k.top) > 0.05 || Math.abs(l.height - k.height) > 0.05 || Math.abs(l.ascent - k.ascent) > 0.05) out.differences.push(`${label} ${b.path} line box ${j + 1}: drawn ${JSON.stringify([l.top, l.height, l.ascent])}, measured ${JSON.stringify([k.top, k.height, k.ascent])}`);
        if (!l.edges || !k.edges || l.edges.length !== k.edges.length) {
          out.differences.push(`${label} ${b.path} line box ${j + 1}: ${l.edges?.length} characters drawn, ${k.edges?.length} measured`);
          return;
        }
        for (let c = 0; c < l.edges.edges.length; c++) {
          out.edges++;
          if (Math.abs(l.x + l.edges.edges[c] - (k.x + k.edges.edges[c])) > 0.05 || l.edges.rtl[c >> 1] !== k.edges.rtl[c >> 1]) {
            out.differences.push(`${label} ${b.path} line box ${j + 1}: character ${c >> 1}'s ${c % 2 ? "right" : "left"} edge drawn at ${(l.x + l.edges.edges[c]).toFixed(2)}, measured at ${(k.x + k.edges.edges[c]).toFixed(2)}`);
            break;
          }
        }
      });
    }
  });
  return drawless;
}

/** A Document measured as written, then as flowed and painted where it doesn't fit: whether it flowed. */
async function compareFlowed(design: ReactElement, files: typeof fonts, label: string, out: Tally, strict = true, skew = 0): Promise<boolean | undefined> {
  const { root } = prepare(design);
  if (root?.type !== "Document") return undefined;
  const context = { families: new Set(files.map((font) => font.family)), fonts: files, image: (src: string) => (src.startsWith("data:") ? src : undefined), date: new Date(0) };
  const written = writeDocument(root, context);
  const laid = await compare(written, label, out, strict, skew);
  // Its pages as flowed and painted (split text drawn line by line), where they don't fit: measured as drawn too.
  if (!laid.some(({ room, blocks: placed }) => placed.some((block) => block.y + block.height > room.bottom + 0.5))) return false;
  const { document, plan } = flowDocument(root, context, written, laid);
  const flowed = await compare(document, `${label} (flowed)`, out, strict, skew);
  // Each page as planned fits its room, as drawn, but where no plan could: a block placed whole in what runs past is
  // taller than the room, or what runs past starts at the room's top and holds one block placed whole (with the padding and borders
  // below, it fits no page). Else, what runs past fits a page; or only the padding and borders below its last part run
  // past, which moving its last block or line on would have left room for.
  const flat = (part: PlannedPart): PlannedPart[] => [part, ...(part.children ?? []).flatMap(flat)];
  const edge = (block?: Block) => (block && "style" in block ? Number(block.style.paddingBottom ?? 0) + Number(block.style.borderBottomWidth ?? 0) : 0);
  const alone = (part: PlannedPart): boolean => {
    const inside = (part.children ?? []).filter((child) => !child.empty);
    return inside.length === 1 && ((inside[0].first && inside[0].last) || alone(inside[0]));
  };
  // Each page goes on from the one before: none repeats it (planning that's gone round, placing nothing new).
  const shape = (part: PlannedPart): unknown => [part.path, part.first, part.last, part.empty, part.lines?.[0]?.start, part.lines?.length, part.children?.map(shape)];
  plan.pages.forEach((page, i) => {
    if (i && page.from === plan.pages[i - 1].from && JSON.stringify(page.parts.map(shape)) === JSON.stringify(plan.pages[i - 1].parts.map(shape))) out.differences.push(`${label} (flowed) page ${i + 1}: as page ${i}, nothing new placed`);
  });
  flowed.forEach(({ room, blocks }, i) => {
    const parts = plan.pages[i]?.parts ?? [];
    const over = blocks.find((block) => parts.some((part) => part.path === block.path) && block.y + block.height > room.bottom + 0.5);
    if (!over) return;
    const height = new Map(blocks.map((block) => [block.path, block.height]));
    const part = parts.find((p) => p.path === over.path)!;
    const tall = flat(part).some((inner) => inner.first && inner.last && (height.get(inner.path) ?? 0) > room.bottom - room.top + 0.5);
    if (tall || (Math.abs(over.y - room.top) < 0.5 && alone(part))) return;
    const written = new Map<string, Block>();
    const walk = (block: Block) => {
      if (block.path !== undefined) written.set(block.path, block);
      if ("children" in block) block.children.forEach(walk);
    };
    document.pages[i].content.forEach(walk);
    // The padding and borders below its part, and below its last block's, and so on down.
    let edges = 0;
    for (let at: PlannedPart | undefined = part; at; ) {
      edges += edge(written.get(at.path));
      const inside: PlannedPart[] = (at.children ?? []).filter((child) => !child.empty);
      at = inside.length ? inside[inside.length - 1] : undefined;
    }
    const past = over.y + over.height - room.bottom;
    if (over.height <= room.bottom - room.top + 0.5 || past <= edges + 0.5) out.differences.push(`${label} (flowed) page ${i + 1}: ${over.path} ends ${past.toFixed(2)} past its room`);
  });
  return true;
}

it("measures each Document as react-pdf draws it, without drawing it", async () => {
  const cases = await corpus();
  const out = tally();
  let docs = 0;
  let flowed = 0;
  for (const [name, design] of cases) {
    const result = await compareFlowed(design as ReactElement, given[name] ?? [], name, out);
    if (result === undefined) continue;
    docs++;
    if (result) flowed++;
  }
  console.info(`Measured without drawing: ${docs} Documents (${flowed} flowed too), ${out.blocks} blocks, ${out.lines} lines, ${out.boxes} line boxes, ${out.edges / 2} characters; ${out.unmeasured} not measured, ${out.differences.length} different`);
  expect(out.differences).toEqual([]);
  // The corpus holds what it should: the templates, and enough of every kind.
  expect(docs).toBeGreaterThan(15);
  expect(out.lines).toBeGreaterThan(300);
  expect(flowed).toBeGreaterThan(0);
});

/** A number from 0 up to 1, the next of a seed's (mulberry32): the same seed, the same numbers. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WORDS = "the a report of invoice total amount paid due date Elements writes design email web print PDF section international characterization incomprehensibilities, quarterly: results; (draft) “quoted” 2026 $1,234.56 100% A-B well-known e.g. Ω café naïve".split(" ");

/** A Document made from a seed: text of every kind in Sections, Rows of Columns, Lists, Tables, Layers, images, a Button, a header and a footer, on a paper and margins of its own. */
function generated(seed: number): ReactElement {
  const next = random(seed);
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)];
  const int = (from: number, to: number) => from + Math.floor(next() * (to - from + 1));
  const chance = (p: number) => next() < p;
  let key = 0;
  const words = (count: number) => Array.from({ length: count }, () => pick(WORDS)).join(" ");
  const textStyle = () => ({
    ...(chance(0.6) ? { textAlign: pick(["left", "center", "right", "justify"] as const) } : {}),
    ...(chance(0.4) ? { fontSize: pick([9, 10, 12, 14, 18, 24]) } : {}),
    ...(chance(0.2) ? { letterSpacing: pick([0.5, 1, 2.5]) } : {}),
    ...(chance(0.25) ? { lineHeight: pick([1, 1.2, 1.6, 2]) } : {}),
    ...(chance(0.15) ? { padding: pick([2, 6, 12]) } : {}),
  });
  const text = (): ReactElement => (
    <Text key={key++} style={textStyle()}>
      {Array.from({ length: int(1, 4) }, () =>
        chance(0.3) ? (
          <Span key={key++} style={{ ...(chance(0.5) ? { fontWeight: 700 } : { color: "#b91c1c" }), ...(chance(0.2) ? { backgroundColor: "#fef3c7" } : {}), ...(chance(0.2) ? { textDecoration: "underline" } : {}) }}>
            {`${words(int(1, 6))} `}
          </Span>
        ) : (
          `${words(int(1, 40))} `
        )
      )}
    </Text>
  );
  const image = (sized: boolean): ReactElement => <Image key={key++} src={png(int(1, 40), int(1, 40))} alt="A picture" style={sized || chance(0.6) ? { width: int(20, 300) } : {}} />;
  const block = (depth: number): ReactElement => {
    const kind = depth > 2 ? pick(["text", "text", "image", "heading"]) : pick(["text", "text", "text", "heading", "section", "row", "list", "table", "image", "layer", "button"]);
    switch (kind) {
      case "heading":
        return <Heading key={key++} level={pick([1, 2, 3, 4] as const)}>{words(int(1, 8))}</Heading>;
      case "section":
        return (
          <Section key={key++} style={{ padding: pick([0, 8, 16, 32]), gap: pick([0, 4, 12]), ...(chance(0.5) ? { backgroundColor: "#f3f4f6" } : {}), ...(chance(0.3) ? { border: { top: { width: pick([1, 3]), style: "solid", color: "#2563eb" } } } : {}) }}>
            {Array.from({ length: int(1, 4) }, () => block(depth + 1))}
          </Section>
        );
      case "row":
        return (
          <Row key={key++} style={{ gap: pick([0, 8, 16]), ...(chance(0.3) ? { alignItems: pick(["stretch", "center", "start", "end"] as const) } : {}) }}>
            {Array.from({ length: int(2, 3) }, () => (
              <Column key={key++} style={{ ...(chance(0.4) ? { width: pick([120, 160, 200]) } : {}), ...(chance(0.4) ? { padding: pick([4, 12]) } : {}), ...(chance(0.3) ? { backgroundColor: "#e5e7eb" } : {}) }}>
                {Array.from({ length: int(1, 3) }, () => (chance(0.15) ? image(true) : block(depth + 2)))}
              </Column>
            ))}
          </Row>
        );
      case "list":
        return (
          <List key={key++} type={pick(["number", "bullet"] as const)}>
            {Array.from({ length: int(1, 4) }, () => (
              <ListItem key={key++}>{words(int(1, 30))}</ListItem>
            ))}
          </List>
        );
      case "table":
        return (
          <Table key={key} style={key++ % 2 ? undefined : { border: "3px solid #333333" }}>
            <TableRow header>
              <TableCell>Item</TableCell>
              <TableCell>Amount</TableCell>
            </TableRow>
            {Array.from({ length: int(1, 8) }, () => (
              <TableRow key={key++}>
                <TableCell>{words(int(1, 20))}</TableCell>
                <TableCell>{`$${int(1, 999)}.00`}</TableCell>
              </TableRow>
            ))}
          </Table>
        );
      case "image":
        return image(false);
      case "layer":
        return (
          <Layer key={key++}>
            {text()}
            <Text style={{ textAlign: pick(["left", "right", "center"] as const), color: "#9ca3af" }}>{words(int(1, 5))}</Text>
          </Layer>
        );
      case "button":
        return <Button key={key++} href="https://example.com">{words(int(1, 3))}</Button>;
      default:
        return text();
    }
  };
  const margin = pick([24, 36, 48, 72]);
  return (
    <Document key="document" size={pick(["A4", "A5", "Letter"] as const)} margin={{ top: margin, bottom: margin, left: pick([24, 48]), right: pick([24, 48]) }} style={{ gap: pick([0, 8, 12]), ...(chance(0.7) ? { fontFamily: "Liberation" } : {}) }}>
      {chance(0.4) ? (
        <PageHeader>
          <Text style={{ fontSize: 10 }}>{words(int(1, 6))}</Text>
        </PageHeader>
      ) : null}
      {chance(0.4) ? (
        <PageFooter>
          <Text style={{ fontSize: 10, textAlign: "right" }}>
            Page <PageNumber /> of <PageNumber total />
          </Text>
        </PageFooter>
      ) : null}
      {Array.from({ length: int(2, 14) }, () => block(0))}
    </Document>
  );
}

// MEASURE_SEEDS=5000 for more: a seed that fails is named, and is the same Document each time.
const seeds = Number(process.env.MEASURE_SEEDS ?? 200);

/**
 * Where a Document isn't measured exactly (a block it doesn't follow), a paginator guesses it and says where: measured
 * guessing, it must be as react-pdf draws it up to the first block guessed, in the order drawn.
 */
async function attributed(design: ReactElement, files: typeof fonts, label: string, layout: Layout, out: string[]): Promise<boolean> {
  const { root } = prepare(design);
  if (root?.type !== "Document") return false;
  const context = { families: new Set(files.map((font) => font.family)), fonts: files, image: (src: string) => (src.startsWith("data:") ? src : undefined), date: new Date(0) };
  const written = writeDocument(root, context);
  if (layout.measure(written)) return false;
  const guessed = layout.guess(written)!;
  expect(guessed.guesses.length, label).toBeGreaterThan(0);
  const drawn = (await reactPdf(written, { edges: true })).placed!;
  const order = drawn.flatMap((page, i) => page.blocks.map((block) => ({ page: i, block })));
  const at = (path: string) => order.findIndex(({ block }) => block.path === path || block.path.startsWith(`${path}.`) || path.startsWith(`${block.path}.`));
  const first = Math.min(...guessed.guesses.map((path) => (at(path) < 0 ? 0 : at(path))));
  const differs = order.findIndex(({ page, block }) => {
    const m = guessed.placed[page]?.blocks.find((other) => other.path === block.path);
    return !m || Math.abs(m.y - block.y) > 0.05 || Math.abs(m.height - block.height) > 0.05 || Math.abs(m.x - block.x) > 0.05 || Math.abs(m.width - block.width) > 0.05 || (m.lines?.length ?? 0) !== (block.lines?.length ?? 0);
  });
  if (differs >= 0 && differs < first) out.push(`${label}: ${order[differs].block.path} differs before ${guessed.guesses[0]}, the first guessed`);
  return true;
}

it("measures Documents made at random as react-pdf draws them, or doesn't measure them: never otherwise", async () => {
  const out = tally();
  let flowed = 0;
  const layout = (await createLayout(fonts))!;
  const early: string[] = [];
  let guessed = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    if (await compareFlowed(generated(seed), fonts, `seed ${seed}`, out, false)) flowed++;
    if (await attributed(generated(seed), fonts, `seed ${seed}`, layout, early)) guessed++;
  }
  // Where it isn't measured exactly, guessed: as drawn up to the first block guessed.
  expect(early).toEqual([]);
  if (out.unmeasured) expect(guessed).toBeGreaterThan(0);
  console.info(`Made at random and measured: ${seeds} Documents (${flowed} flowed too), ${out.blocks} blocks, ${out.lines} lines, ${out.edges / 2} characters; ${out.unmeasured} not measured (${guessed} as written, guessed: as drawn up to the first guess), ${out.differences.length} different`);
  expect(out.differences).toEqual([]);
  // Most are measured: one that isn't is drawn to measure it, which is slower, not wrong.
  expect(out.unmeasured).toBeLessThan(seeds * 0.25);
  expect(flowed).toBeGreaterThan(seeds / 4);
}, 30_000 + seeds * 40);

it("doesn't measure what it doesn't follow: text laid over a Layer that wraps, padding wider than its box", async () => {
  const written = (design: ReactElement) => writeDocument(prepare(design).root!, { families: new Set(), fonts: [], image: (src: string) => src, date: new Date(0) });
  const wraps = (
    <Document>
      <Layer>
        <Text>Under the layer.</Text>
        <Text style={{ textAlign: "center" }}>{para(1)}</Text>
      </Layer>
    </Document>
  );
  const narrow = (
    <Document>
      <Row>
        <Column style={{ width: 24, padding: 12 }}>
          <Text style={{ padding: 12 }}>{para(2)}</Text>
        </Column>
      </Row>
    </Document>
  );
  for (const design of [wraps, narrow]) expect(await reactPdfLayout(written(design))).toBeUndefined();
  // A line laid over a Layer on its own is measured.
  const line = (
    <Document>
      <Layer>
        <Text>{para(1)}</Text>
        <Text style={{ textAlign: "right" }}>Draft</Text>
      </Layer>
    </Document>
  );
  expect(await reactPdfLayout(written(line))).toBeDefined();
});

it("lays what's over a Layer over all of it where it has a height of its own, aligned where the PDF draws it", async () => {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { glyphs } = await import("./operators");
  const { createPaginator, renderPdf } = await import("../../src/pdf");
  const paginator = await createPaginator();
  for (const height of [24, 72]) {
    const design = (
      <Document style={{ fontFamily: "Courier" }}>
        <Layer style={{ height, alignItems: "end" }}>
          <Text>Background</Text>
          <Text id="over" style={{ textAlign: "right" }}>Overlay</Text>
        </Layer>
      </Document>
    );
    const { layout } = paginator.paginate(design, { layout: true });
    const [line] = layout!.nodes.find(({ id }) => id === "over")!.lineBoxes!;
    const { pdf } = await renderPdf(design);
    const drawn = await glyphs(await (await getDocument({ data: pdf.slice(), verbosity: 0 }).promise).getPage(1));
    const o = drawn.find(({ text }) => text === "O")!;
    expect(line.baseline * 0.75, `a ${height}px Layer`).toBeCloseTo(o.baseline, 1);
    expect(line.x * 0.75, `a ${height}px Layer`).toBeCloseTo(o.x, 1);
  }
});

it("measures with a textkit only where it lays text out as react-pdf draws it, not another version beside it", async () => {
  const module = await import("@react-pdf/textkit");
  const kit: Textkit = {
    engine: module.default({ bidi: module.bidi, linebreaker: module.linebreaker, justification: module.justification, textDecoration: module.textDecoration, scriptItemizer: module.scriptItemizer, wordHyphenation: module.wordHyphenation, fontSubstitution: module.fontSubstitution }) as Textkit["engine"],
    fromFragments: module.fromFragments,
  };
  expect(await textkitAgrees(kit)).toBe(true);
  // One that breaks lines elsewhere (as another version might): a tenth narrower.
  const other: Textkit = { ...kit, engine: (text, box, options) => kit.engine(text, { ...box, width: (box as { width: number }).width * 0.9 }, options) };
  expect(await textkitAgrees(other)).toBe(false);
});

it("finds a measurer that's off: what's measured a tenth of a point down is different, for every Document made at random", async () => {
  for (let seed = 1; seed <= 5; seed++) {
    const out = tally();
    await compareFlowed(generated(seed), fonts, `seed ${seed}`, out, false, 0.1);
    expect(out.unmeasured > 0 || out.differences.length > 0, `seed ${seed}`).toBe(true);
    if (!out.unmeasured) expect(out.differences.length).toBeGreaterThan(0);
  }
});

it("measures each Document with a Layout made once as without one, laying out again only the text that's changed", async () => {
  // A Layout for each set of fonts, made once and kept: each Document measured as reactPdfLayout() measures it, then
  // again from what it laid out before, laying out nothing.
  const layouts = new Map<unknown, Layout>();
  let docs = 0;
  for (const [name, design] of await corpus()) {
    const { root } = prepare(design as ReactElement);
    if (root?.type !== "Document") continue;
    docs++;
    const files = given[name] ?? [];
    if (!layouts.has(files)) layouts.set(files, (await createLayout(files))!);
    const layout = layouts.get(files)!;
    const context = { families: new Set(files.map((font) => font.family)), fonts: files, image: (src: string) => (src.startsWith("data:") ? src : undefined), date: new Date(0) };
    const written = writeDocument(root, context);
    const measured = layout.measure(written);
    expect(measured, name).toEqual(await reactPdfLayout(written));
    const laid = layout.laid;
    expect(layout.measure(written), name).toEqual(measured);
    expect(layout.laid, name).toBe(laid);
  }
  expect(docs).toBeGreaterThan(15);

  // A paragraph of a report changed, as a keystroke changes it: that paragraph is laid out again, and nothing else.
  const report = (typed: string) => (
    <Document>
      {Array.from({ length: 40 }, (_, i) => (
        <Text key={i}>
          {para(i)}
          {i === 7 ? typed : ""}
        </Text>
      ))}
    </Document>
  );
  const layout = (await createLayout([]))!;
  const written = (typed: string) => writeDocument(prepare(report(typed)).root!, { families: new Set(), fonts: [], image: () => undefined, date: new Date(0) });
  layout.measure(written(""));
  expect(layout.laid).toBe(40);
  for (const typed of [" a", " an", " and"]) {
    const before = layout.laid;
    const measured = layout.measure(written(typed));
    expect(layout.laid - before).toBe(1);
    expect(measured).toEqual(await reactPdfLayout(written(typed)));
  }
});
