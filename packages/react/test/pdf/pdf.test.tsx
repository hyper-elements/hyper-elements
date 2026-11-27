/**
 * PDFs read back with pdf.js: their pages (how many, their paper), the words on each and where the first sits, and
 * that nothing is fetched (an image it isn't given is an error, not a request).
 */
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { ReactElement } from "react";
import { COMPONENTS, LAYOUT_VERSION } from "@hyper-elements/core";
import {
  Button,
  Circle,
  Column,
  Divider,
  Document,
  Email,
  Grid,
  Heading,
  Html,
  Image,
  Layer,
  Link,
  List,
  ListItem,
  Menu,
  PageBreak,
  PageFooter,
  PageHeader,
  PageNumber,
  Text,
  prepare,
  Rect,
  Row,
  Section,
  Social,
  Span,
  Svg,
  Table,
  TableCell,
  TableRow,
  validate,
  Video,
} from "@hyper-elements/react";
import { reactPdf, SourceCache, sourcesKept, writeDocument, type Block } from "@hyper-elements/core/pdf";
import { images } from "./operators";
import { png } from "./png";
import { createPaginator, layoutDocument, paginate, renderPdf, templateAssets, type DocumentNode } from "../../src/pdf";
import { arabicFonts, arabicSentences } from "./arabic";
import { toWoff, toWoff2 } from "./woff";

/** What prepare() gives, where a test gives another layout version (another copy of Elements, newer or older). */
const other = vi.hoisted(() => ({ prepared: undefined as { layout?: number } | undefined }));
vi.mock("@hyper-elements/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@hyper-elements/react")>();
  return {
    ...actual,
    prepare: (element: ReactElement) => {
      if (!other.prepared) return actual.prepare(element);
      const { layout: _, ...prepared } = actual.prepare(element);
      return { ...prepared, ...other.prepared };
    },
  };
});

/** Liberation Sans (SIL OFL), as pdf.js ships it. */
const liberation = (name: string) => readFileSync(join(dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json")), "standard_fonts", name));
/** The fonts a PDF embeds, each named by its file's own name (after a subset's tag: "ABCDEF+LiberationSans-Bold"). */
const embedded = (pdf: Uint8Array) => [...new Set([...Buffer.from(pdf).toString("latin1").matchAll(/\/BaseFont \/[A-Z]{6}\+([\w-]+)/g)].map((match) => match[1]))];

/** fontkit, as react-pdf's pdfkit reads fonts with it (test-only: it reads back the fonts a PDF embeds). */
const fontkit = createRequire(createRequire(createRequire(import.meta.url).resolve("@react-pdf/renderer/package.json")).resolve("pdfkit"))("fontkit") as {
  create(data: Buffer): { numGlyphs: number; getGlyph(id: number): { path: { commands: unknown[] } } };
};
/** Each font file a PDF embeds: its glyphs (.notdef aside), and how many have an outline (a letter drawn, not blank). */
function glyphs(pdf: Uint8Array): Array<{ glyphs: number; outlined: number }> {
  const text = Buffer.from(pdf).toString("latin1");
  return [...text.matchAll(/\/FontFile2 (\d+) 0 R/g)].map(([, id]) => {
    const object = new RegExp(`\\n${id} 0 obj\\s*<<([\\s\\S]*?)>>\\s*stream\\r?\\n`).exec(text)!;
    const start = object.index + object[0].length;
    const data = Buffer.from(pdf.subarray(start, start + Number(/\/Length (\d+)/.exec(object[1])![1])));
    const font = fontkit.create(/FlateDecode/.test(object[1]) ? inflateSync(data) : data);
    const ids = Array.from({ length: font.numGlyphs - 1 }, (_, i) => i + 1);
    const outlined = (id: number) => {
      try {
        return font.getGlyph(id).path.commands.length > 0;
      } catch {
        return false;
      }
    };
    return { glyphs: ids.length, outlined: ids.filter(outlined).length };
  });
}

/** A 1×1 PNG. */
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
const PNG_URI = `data:image/png;base64,${Buffer.from(PNG).toString("base64")}`;

interface Read {
  pages: Array<{ size: [number, number]; words: string; first?: { str: string; x: number; y: number } }>;
}

async function read(pdf: Uint8Array): Promise<Read> {
  const document = await getDocument({ data: pdf.slice(), useSystemFonts: false, disableFontFace: true, verbosity: 0 }).promise;
  const pages: Read["pages"] = [];
  for (let n = 1; n <= document.numPages; n++) {
    const page = await document.getPage(n);
    const [, , width, height] = page.view;
    const items = (await page.getTextContent()).items.filter((item): item is { str: string; transform: number[] } & typeof item => "str" in item && item.str.trim() !== "");
    pages.push({
      size: [Math.round(width), Math.round(height)],
      // pdf.js splits a line into items where its style changes: joined with spaces, less those before punctuation.
      words: items.map((item) => item.str).join(" ").replace(/\s+/g, " ").replace(/ ([.,!?])/g, "$1").trim(),
      // From the top left, in points.
      first: items[0] && { str: items[0].str, x: Math.round(items[0].transform[4] * 10) / 10, y: Math.round((height - items[0].transform[5]) * 10) / 10 },
    });
  }
  return { pages };
}

const invoice = (
  <Document size="A4" margin={48} title="Invoice 2705">
    <PageHeader>
      <Text style={{ fontSize: 10, color: "#666666" }}>Acme · Invoice</Text>
    </PageHeader>
    <Heading level={1} style={{ fontSize: 24 }}>
      Invoice 2705
    </Heading>
    <Text>
      Thank you for your <Span style={{ fontWeight: 700 }}>order</Span>. Questions? <Link href="https://acme.test/help">Contact us</Link>.
    </Text>
    <Row style={{ gap: 16 }}>
      <Column>
        <Text>Pro plan</Text>
      </Column>
      <Column>
        <Text style={{ textAlign: "right" }}>$25.00</Text>
      </Column>
    </Row>
    <Image src={{ src: PNG_URI, width: 40, height: 40 }} alt="Logo" />
    <PageBreak />
    <Document.Page>
      <Text>Terms and conditions</Text>
    </Document.Page>
    <PageFooter>
      <Text style={{ fontSize: 10, textAlign: "right" }}>
        Page <PageNumber /> of <PageNumber total />
      </Text>
    </PageFooter>
  </Document>
);

describe("renderPdf", () => {
  it("writes each page on the Document's paper, its header and footer on each, numbered", async () => {
    const { pdf, diagnostics } = await renderPdf(invoice);
    expect(Buffer.from(pdf.subarray(0, 5)).toString()).toBe("%PDF-");
    expect(diagnostics.filter((d) => d.severity !== "info")).toEqual([]);
    const { pages } = await read(pdf);
    // A4: 595 × 842 points.
    expect(pages.map((page) => page.size)).toEqual([
      [595, 842],
      [595, 842],
    ]);
    expect(pages[0].words).toBe("Acme · Invoice Invoice 2705 Thank you for your order. Questions? Contact us. Pro plan $25.00 Page 1 of 2");
    expect(pages[1].words).toBe("Acme · Invoice Terms and conditions Page 2 of 2");
  });

  it("starts the content inside the margins, as the print HTML does: 48px is 36 points", async () => {
    const { pages } = await read((await renderPdf(invoice)).pdf);
    const first = pages[0].first!;
    expect(first.str).toBe("Acme · Invoice");
    expect(first.x).toBe(36);
    // The first line's baseline, a 10pt line down from the top margin.
    expect(first.y).toBeGreaterThan(36);
    expect(first.y).toBeLessThan(36 + 13);
  });

  it("makes each page's box the room inside its margins, no taller (react-pdf warned it can't wrap one taller on every A4 page)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      for (const props of [{ size: "A4" }, { size: "A4", orientation: "landscape" }, { size: "Letter", margin: 50.3 }, { size: "A3", margin: 0 }] as const) {
        await renderPdf(
          <Document {...props}>
            <Text>One line</Text>
          </Document>
        );
      }
      expect(warn.mock.calls.map((call) => String(call[0]))).toEqual([]);
    } finally {
      warn.mockRestore();
    }
  });

  it("writes the same file for the same template", async () => {
    const [a, b] = await Promise.all([renderPdf(invoice), renderPdf(invoice)]);
    expect(Buffer.from(a.pdf).equals(Buffer.from(b.pdf))).toBe(true);
  });

  it("fetches nothing: an image it isn't given is an error; given by its URL, it's drawn", async () => {
    const template = (
      <Document>
        <Image src={{ src: "https://cdn.acme.test/logo.png", width: 40, height: 40 }} alt="Logo" />
      </Document>
    );
    await expect(renderPdf(template)).rejects.toMatchObject({ diagnostics: [expect.objectContaining({ code: "pdf/image", path: "root.children[0].props.src" })] });
    const { pdf } = await renderPdf(template, { images: { "https://cdn.acme.test/logo.png": PNG } });
    expect((await read(pdf)).pages).toHaveLength(1);
    await expect(renderPdf(template, { images: { "https://cdn.acme.test/logo.png": new TextEncoder().encode("GIF89a") } })).rejects.toMatchObject({
      diagnostics: [expect.objectContaining({ code: "pdf/image", message: "This image's file isn't a PNG or JPEG, the formats a PDF draws" })],
    });
  });

  it("says an SVG image isn't drawn (react-pdf draws PNG and JPEG), and shows its alt text in its box, or in a line leaves its room", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#ff0000"/></svg>';
    const template = (
      <Document>
        <Image src={{ src: "https://cdn.acme.test/logo.svg", width: 80, height: 40 }} alt="Acme logo" />
        <Image src={{ src: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`, width: 40, height: 40 }} alt="" />
        <Text>Below</Text>
        <Text>
          Status <Image src={{ src: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`, width: 16, height: 16 }} alt="OK" /> ready
        </Text>
      </Document>
    );
    const { pdf, diagnostics } = await renderPdf(template, { images: { "https://cdn.acme.test/logo.svg": new TextEncoder().encode(svg) } });
    const message = "A PDF draws PNG and JPEG images, not SVG: give this one as a PNG or JPEG (its file in renderPdf's images option, by its URL, or a data: URI). Meanwhile its alt text is shown in its box, or, in a line of text, its room is left empty";
    expect(diagnostics.map((d) => [d.code, d.severity, d.path, d.message])).toEqual([
      ["pdf/image", "warning", "root.children[0].props.src", message],
      ["pdf/image", "warning", "root.children[1].props.src", message],
      ["pdf/image", "warning", "root.children[3].children[1].props.src", message],
    ]);
    // In a line, its room (one character of the line, as the print HTML counts it), with nothing in it.
    expect((await read(pdf)).pages[0].words).toBe("Acme logo Below Status ready");
    // Each in a box of the image's size (40px tall: 30 points), so what's around it is where it was.
    const { root } = prepare(template);
    const { content } = writeDocument(root!, { families: new Set(), fonts: [], image: () => undefined, date: new Date(0) }).pages[0];
    expect(content.slice(0, 2).map((block) => [block.kind, "style" in block ? [block.style.width, block.style.height] : []])).toEqual([
      ["box", [60, 30]],
      ["box", [30, 30]],
    ]);
    const line = content[3];
    expect(line.kind === "text" && line.runs.map((run) => (typeof run === "string" ? run : [run.kind, run.style.width, run.style.height]))).toEqual(["Status ", ["image", 12, 12], " ready"]);
  });

  it("says where text laid over a Layer is taller than the Layer, which the PDF doesn't draw (nor its page in SVG)", async () => {
    const design = (
      <Document>
        <Layer style={{ width: 160 }}>
          <Text>Under</Text>
          <Text>Laid over it, words that go on past the Layer's one line of height</Text>
        </Layer>
      </Document>
    );
    const { pdf, diagnostics } = await renderPdf(design);
    expect(diagnostics.map((d) => [d.code, d.severity, d.path])).toContainEqual(["pdf/layer", "warning", "root.children[0].children[1]"]);
    expect((await read(pdf)).pages[0].words).toBe("Under");
    const paginated = (await createPaginator()).paginate(design, { svg: true });
    expect(paginated.diagnostics.map((d) => d.code)).toContain("pdf/layer");
    expect(paginated.svg![0]).toContain(">Under<");
    expect(paginated.svg![0]).not.toContain("Laid");
  });

  it("draws an Image with no width given or known as wide as its file, no wider than its parent, as the print HTML does", async () => {
    // 40 by 20 pixels: 30 by 15 points. 2,000 by 100: as wide as the page's content (A4, 36 points each side).
    const { pdf } = await renderPdf(
      <Document>
        <Image src={png(40, 20)} alt="Small" />
        <Image src={png(2000, 100)} alt="Wide" />
      </Document>
    );
    const drawn = await images(await (await getDocument({ data: pdf.slice(), verbosity: 0 }).promise).getPage(1));
    expect(drawn.map(({ width, height }) => [Math.round(width * 100) / 100, Math.round(height * 100) / 100])).toEqual([
      [30, 15],
      [523.28, 26.16],
    ]);
  });

  it("draws a Document whose JPEG is cut short, leaving the image out as react-pdf does, its size given or not", async () => {
    // A JPEG cut off just after its APP1 segment's length.
    const src = "data:image/jpeg;base64,/9j/4QAi";
    for (const image of [<Image key="given" src={{ src, width: 40, height: 40 }} alt="Uploaded" />, <Image key="width" src={src} alt="Uploaded" style={{ width: 40 }} />]) {
      const { pdf } = await renderPdf(<Document>{image}<Text>The rest of the report</Text></Document>);
      expect((await read(pdf)).pages[0].words).toContain("The rest of the report");
    }
  });

  it("draws a pill's rounded background inside its box in a paginator's SVG, its corners no rounder than react-pdf draws them", async () => {
    const design = (
      <Document>
        <Text>Previous row</Text>
        <Button id="pill" href="https://example.test/paid" style={{ width: 120, backgroundColor: "#345678", borderRadius: 999 }}>
          Paid
        </Button>
      </Document>
    );
    const box = (await layoutDocument(design)).nodes.find((node) => node.id === "pill")!;
    const svg = (await createPaginator()).paginate(design, { svg: true }).svg![0]!;
    const path = /<path d="([^"]+)" fill="#345678"\/>/.exec(svg)![1];
    // The x of each point it goes through: a move's, a line across's, an arc's end.
    const xs = (path.match(/[MHVA][^MHVAZ]*/g) ?? []).flatMap((step) => {
      const numbers = step.slice(1).trim().split(/[ ,]+/).map(Number);
      return step[0] === "M" ? [numbers[0]] : step[0] === "H" ? [numbers[0]] : step[0] === "A" ? [numbers[5]] : [];
    });
    expect(Math.min(...xs), path).toBeGreaterThanOrEqual(box.x * 0.75 - 0.01);
    expect(Math.max(...xs), path).toBeLessThanOrEqual((box.x + box.width) * 0.75 + 0.01);
  });

  it("defines every image of the Document in svgImages, not only those on the pages drawn now", async () => {
    const late = png(30, 20, true);
    const design = (
      <Document>
        {Array.from({ length: 120 }, (_, i) => (
          <Text key={i}>Record {i + 1}: a line of a long report, long enough to go on for several pages.</Text>
        ))}
        <Image src={late} alt="On a later page" style={{ width: 120 }} />
      </Document>
    );
    const { plan, svg, svgImages } = (await createPaginator()).paginate(design, { diagnostics: false, svg: { pages: [1], shareImages: true } });
    expect(plan.pages.length).toBeGreaterThan(2);
    expect(svg![0]).not.toContain("<use");
    expect(svgImages).toContain(late);
  });

  it("measures an image on a page too short for it as react-pdf draws it: 0 tall, not less", async () => {
    const design = (
      <Document size="A5" margin={{ top: 391, bottom: 391, left: 48, right: 48 }}>
        <Image id="image" src={png(10, 10)} alt="Logo" />
        <Text>Caption</Text>
      </Document>
    );
    const preview = (await createPaginator()).paginate(design, { layout: true });
    const drawn = await layoutDocument(design);
    expect((await paginate(design)).plan).toEqual((await renderPdf(design)).plan);
    expect(preview.layout!.nodes.find((node) => node.id === "image")!.height).toBe(drawn.nodes.find((node) => node.id === "image")!.height);
  });

  it("draws the image a buffer holds now, where one given before is written over (a server's reused buffer)", async () => {
    const uri = "https://example.test/avatar.png";
    const bytes = (noise: boolean) => Buffer.from(png(1, 1, noise).split(",")[1], "base64");
    const design = (
      <Document>
        <Image src={{ src: uri, width: 24, height: 24 }} alt="Avatar" />
      </Document>
    );
    const shared = bytes(false);
    const replacement = bytes(true);
    expect(shared).not.toEqual(replacement);
    const before = await renderPdf(design, { images: { [uri]: shared } });
    shared.set(replacement);
    const replaced = await renderPdf(design, { images: { [uri]: shared } });
    const fresh = await renderPdf(design, { images: { [uri]: replacement } });
    expect(fresh.pdf).not.toEqual(before.pdf);
    expect(Buffer.from(replaced.pdf).equals(fresh.pdf)).toBe(true);
  });

  it("keeps the last few large images it read and hashed, not the last 1,000: a server's memory stays level", async () => {
    // 24 Documents, each with its own photo (1 MB, 1.4 million characters as base64), in a box and in a line, drawn
    // and paginated with its pages in SVG, each image defined once: its size read, its bytes hashed for its page's hash
    // and its SVG symbol's id, its number in a line's key.
    const paginator = await createPaginator();
    const options = { diagnostics: false, svg: { shareImages: true } } as const;
    const signed = (photo: string) => (
      <Document>
        <Image src={{ src: photo, width: 200 }} alt="Photo" />
        <Text>
          Signed <Image src={{ src: photo, width: 16, height: 16 }} alt="" />
        </Text>
      </Document>
    );
    let last = "";
    for (let i = 0; i < 24; i++) {
      last = png(1000 + i, 1000, true);
      await renderPdf(signed(last));
      paginator.paginate(signed(last), options);
    }
    // At most 16 million characters of them in any one cache (the last 11 or so), where it kept all 24 (34 million).
    expect(sourcesKept()).toBeLessThanOrEqual(16_000_000);
    expect(sourcesKept()).toBeGreaterThan(10_000_000);
    const kept = vi.spyOn(SourceCache.prototype, "set");
    try {
      // The last is kept: paginated again, nothing of it is worked out again.
      paginator.paginate(signed(last), options);
      expect(kept.mock.calls.filter(([src]) => src === last)).toEqual([]);
      // A logo too long to keep with them (a 12 MB file, 16.3 million characters), in the header of 16 pages, is kept
      // apart: its size and its two hashes worked out once each, not on each page, and the photo is still kept.
      const large = png(4000, 3050, true);
      expect(large.length).toBeGreaterThan(16_000_000);
      kept.mockClear();
      const { plan } = paginator.paginate(
        <Document>
          <PageHeader>
            <Image src={{ src: large, width: 48, height: 36 }} alt="Logo" />
          </PageHeader>
          {Array.from({ length: 16 }, (_, i) => (
            <Document.Page key={i}>
              <Text>{`Page ${i + 1}`}</Text>
            </Document.Page>
          ))}
        </Document>,
        options
      );
      expect(plan.pages).toHaveLength(16);
      expect(kept.mock.calls.filter(([src]) => src === large)).toHaveLength(3);
      kept.mockClear();
      paginator.paginate(signed(last), options);
      expect(kept.mock.calls.filter(([src]) => src === last)).toEqual([]);
    } finally {
      kept.mockRestore();
    }
  });

  it("sizes a whole JPEG with padding after its end as react-pdf draws it, with a width or without", async () => {
    const original = readFileSync(new URL("../../../../templates/_assets/images/speaker.jpg", import.meta.url));
    const url = "https://example.test/photo.jpg";
    for (const width of [120, undefined]) {
      const design = (
        <Document size="A5" margin={{ top: 300, bottom: 300, left: 48, right: 48 }}>
          <Image id="photo" src={url} alt="Speaker" style={{ width }} />
          <Text>Caption</Text>
        </Document>
      );
      const padded = { images: { [url]: Buffer.concat([original, Buffer.alloc(32)]) } };
      const drawn = (await layoutDocument(design, padded)).nodes.find((node) => node.id === "photo")!.height;
      expect(drawn, `width ${width}`).toBeGreaterThan(0);
      const { pdf } = await renderPdf(design, padded);
      expect(await images(await (await getDocument({ data: pdf.slice(), verbosity: 0 }).promise).getPage(1)), `width ${width}`).toHaveLength(1);
      const preview = (await createPaginator(padded)).paginate(design, { layout: true });
      expect(preview.layout!.nodes.find((node) => node.id === "photo")!.height, `width ${width}`).toBeCloseTo(drawn);
    }
  });

  it("measures a PNG cut short (its header whole) as react-pdf draws it, left out: the same plan without drawing", async () => {
    const bytes = Buffer.from(png(100, 700).split(",")[1], "base64").subarray(0, 33);
    const design = (
      <Document size="A5">
        <Image src={`data:image/png;base64,${bytes.toString("base64")}`} alt="A damaged upload" />
        {Array.from({ length: 10 }, (_, i) => (
          <Text key={i}>Record {i + 1}</Text>
        ))}
      </Document>
    );
    expect((await paginate(design)).plan.pages.map((page) => page.parts.length)).toEqual((await renderPdf(design)).plan.pages.map((page) => page.parts.length));
  });

  it("draws a Video's thumbnail given in images: its own, or a YouTube video's by the URL it's derived from", async () => {
    // The images a PDF draws, as pdf.js reads its drawing operators.
    const images = async (pdf: Uint8Array) => {
      const { fnArray } = await (await (await getDocument({ data: pdf.slice(), verbosity: 0 }).promise).getPage(1)).getOperatorList();
      return fnArray.filter((fn) => fn === OPS.paintImageXObject).length;
    };
    const youtube = <Video src="https://www.youtube.com/watch?v=dQw4w9WgXcQ" title="Our launch" />;
    const own = <Video src="https://vimeo.com/76979871" title="Our launch" thumbnail={{ src: "https://cdn.acme.test/launch.png", width: 64, height: 36 }} />;
    for (const [video, url] of [
      [youtube, "https://img.youtube.com/vi/dQw4w9WgXcQ/0.jpg"],
      [own, "https://cdn.acme.test/launch.png"],
    ] as const) {
      const { pdf } = await renderPdf(<Document>{video}</Document>, { images: { [url]: PNG } });
      expect(await images(pdf)).toBe(1);
      expect((await read(pdf)).pages[0].words).toBe("");
      // Not given, its title.
      const { pdf: titled } = await renderPdf(<Document>{video}</Document>);
      expect(await images(titled)).toBe(0);
      expect((await read(titled)).pages[0].words).toBe("Our launch");
    }
  });

  it("notes a web font it isn't given, and draws its text in a standard PDF font", async () => {
    const { diagnostics, pdf } = await renderPdf(
      <Document fonts={[{ family: "Inter", src: "https://fonts.acme.test/inter.woff2" }]} style={{ fontFamily: "Inter, sans-serif" }}>
        <Text>Hello</Text>
      </Document>
    );
    expect(diagnostics.map((d) => [d.code, d.severity])).toEqual([["pdf/font", "warning"]]);
    expect((await read(pdf)).pages[0].words).toBe("Hello");
  });

  it("draws a font file it's given that's WOFF as it draws a TTF, each letter's outline embedded, and says nothing", async () => {
    const ttf = liberation("LiberationSans-Regular.ttf");
    const template = (
      <Document fonts={[{ family: "Brand", src: "https://fonts.acme.test/brand.woff" }]} style={{ fontFamily: "Brand, sans-serif" }}>
        <Text>Hello</Text>
      </Document>
    );
    for (const src of [ttf, toWoff(ttf)]) {
      const { diagnostics, pdf } = await renderPdf(template, { fonts: [{ family: "Brand", src }] });
      expect(diagnostics).toEqual([]);
      expect(embedded(pdf)).toEqual(["LiberationSans"]);
      // H, e, l and o.
      expect(glyphs(pdf)).toEqual([{ glyphs: 4, outlined: 4 }]);
      expect((await read(pdf)).pages[0].words).toBe("Hello");
    }
  });

  it("says a font file that's WOFF2 isn't drawn (react-pdf would embed its letters blank), and draws its text as for a font not given", async () => {
    const regular = liberation("LiberationSans-Regular.ttf");
    const template = (
      <Document fonts={[{ family: "Brand", src: "https://fonts.acme.test/brand.woff2" }]} style={{ fontFamily: "Brand, sans-serif" }}>
        <Text>Hello</Text>
        <Text style={{ fontWeight: 700 }}>Bold</Text>
      </Document>
    );
    // A WOFF2 as Google Fonts' are (glyf and loca transformed: test/woff.ts), alone or beside the family's TTF.
    const alone = await renderPdf(template, { fonts: [{ family: "Brand", src: toWoff2(regular) }] });
    expect(alone.diagnostics.map((d) => [d.code, d.severity, d.message])).toEqual([
      ["pdf/font", "warning", "Brand's file is WOFF2: a PDF draws TTF, OTF and WOFF files. Its text is drawn in a standard PDF font meanwhile"],
    ]);
    expect(glyphs(alone.pdf)).toEqual([]);
    expect((await read(alone.pdf)).pages[0].words).toBe("Hello Bold");
    const beside = await renderPdf(template, { fonts: [{ family: "Brand", src: regular }, { family: "Brand", src: toWoff2(liberation("LiberationSans-Bold.ttf")), weight: 700 }] });
    expect(beside.diagnostics.find((d) => d.message.includes("WOFF2"))?.message).toBe("Brand's file is WOFF2: a PDF draws TTF, OTF and WOFF files. Its text is drawn in Brand's other files meanwhile");
    // Every letter embedded is drawn: the bold text in the regular file.
    expect(embedded(beside.pdf)).toEqual(["LiberationSans"]);
    expect(glyphs(beside.pdf).every((font) => font.outlined === font.glyphs)).toBe(true);
  });

  it("draws text in a weight or style a family isn't given in the nearest file it is, and says so (as an image does)", async () => {
    const regular = { family: "Brand", src: liberation("LiberationSans-Regular.ttf") };
    const template = (
      <Document style={{ fontFamily: "Brand, sans-serif" }}>
        <Text>Upright</Text>
        <Text style={{ fontStyle: "italic" }}>Slanted</Text>
        <Heading>Bold</Heading>
        <Table>
          <TableRow header>
            <TableCell>Plan</TableCell>
          </TableRow>
        </Table>
      </Document>
    );
    // Italic text where only the upright file is given: react-pdf threw ("Could not resolve font for elements-…").
    const { pdf, diagnostics } = await renderPdf(template, { fonts: [regular] });
    expect(diagnostics.map((d) => [d.code, d.severity, d.path, d.message])).toEqual([
      ["pdf/font-weight", "warning", "root.children[1]", "Text in Brand at 400 italic, which is given at 400 only: it's drawn in the nearest. Give that file in renderPdf's fonts option"],
      ["pdf/font-weight", "warning", "root.children[2]", "Text in Brand at 700, which is given at 400 only: it's drawn in the nearest. Give that file in renderPdf's fonts option"],
    ]);
    expect(embedded(pdf)).toEqual(["LiberationSans"]);
    expect((await read(pdf)).pages[0].words).toBe("Upright Slanted Bold Plan");
    // Given the italic and bold files, each is drawn in its own, and nothing is said.
    const all = await renderPdf(template, {
      fonts: [regular, { family: "Brand", src: liberation("LiberationSans-Italic.ttf"), style: "italic" }, { family: "Brand", src: liberation("LiberationSans-Bold.ttf"), weight: 700 }],
    });
    expect(all.diagnostics).toEqual([]);
    expect(embedded(all.pdf).sort()).toEqual(["LiberationSans", "LiberationSans-Bold", "LiberationSans-Italic"]);
  });

  it("says text a standard PDF font can't draw (it draws Western European characters only) where no font file is given for it", async () => {
    const template = (
      <Document>
        <Text>Hello, café — “Ÿ” €5</Text>
        <Text>Привет, мир</Text>
        <Text style={{ fontFamily: "Georgia, serif" }}>Ελληνικά</Text>
        <Text>Łódź</Text>
      </Document>
    );
    const { pdf, diagnostics } = await renderPdf(template);
    // Once for each standard font, where it's first met.
    expect(diagnostics.map((d) => [d.code, d.severity, d.path, d.message])).toEqual([
      [
        "pdf/font",
        "warning",
        "root.children[1]",
        `Text in Helvetica has characters a standard PDF font can't draw ("П"): it draws Western European characters only, and no font file is given for this text's fontFamily. Give one that has them in renderPdf's fonts option. They come out as other characters meanwhile`,
      ],
      [
        "pdf/font",
        "warning",
        "root.children[2]",
        `Text in Times-Roman has characters a standard PDF font can't draw ("Ε"): it draws Western European characters only, and no font file is given for this text's fontFamily. Give one that has them in renderPdf's fonts option. They come out as other characters meanwhile`,
      ],
    ]);
    const words = (await read(pdf)).pages[0].words;
    expect(words).toContain("Hello, café — “Ÿ” €5");
    expect(words).not.toContain("Привет");
    // In a font file that has them (Liberation Sans has Cyrillic, Greek and Polish), they're drawn, and nothing is said.
    const given = await renderPdf(<Document style={{ fontFamily: "Liberation Sans" }}>{template.props.children}</Document>, {
      fonts: [{ family: "Liberation Sans", src: liberation("LiberationSans-Regular.ttf") }],
    });
    expect(given.diagnostics.filter((d) => d.code === "pdf/font")).toEqual([
      expect.objectContaining({ path: "root.children[2]", message: expect.stringMatching(/^Text in Times-Roman has characters/) }),
    ]);
    expect((await read(given.pdf)).pages[0].words).toContain("Привет, мир");
  });

  it("says what a PDF can't show that its HTML can: a hover, a Video, markup (and validate() says it too)", async () => {
    const template = (
      <Document>
        <Button href="https://x.test" style={{ hover: { backgroundColor: "#333333" } }}>
          Go
        </Button>
        <Video src="https://vimeo.com/76979871" title="Our launch" />
        <Html html="<b>Sale</b>" text="Sale today" />
      </Document>
    );
    const said = (diagnostics: Array<{ code: string; message: string }>) => diagnostics.filter((d) => d.code.startsWith("pdf/")).map((d) => [d.code, d.message.split(":")[0]]);
    const expected = [
      ["pdf/unsupported", "A hover isn't possible in a PDF"],
      ["pdf/unsupported", "A Video isn't possible in a PDF"],
      ["pdf/unsupported", "Markup isn't possible in a PDF"],
    ];
    expect(said((await renderPdf(template)).diagnostics)).toEqual(expected);
    expect(said(validate(template).diagnostics)).toEqual(expected);
    // An email shows both: neither is said.
    expect(validate(<Email><Button href="https://x.test" style={{ hover: { backgroundColor: "#333333" } }}>Go</Button></Email>).diagnostics.filter((d) => d.code.startsWith("pdf/"))).toEqual([]);
  });

  it("says what can't go on to another page is cut off: a Row of Columns centered across it, taller than its page, measured, at the first text cut (validate() estimates)", async () => {
    const long = (
      <Document>
        <Row style={{ alignItems: "center" }}>
          <Column>
            {Array.from({ length: 60 }, (_, i) => (
              <Text key={i}>Text {i + 1} of a Column.</Text>
            ))}
          </Column>
          <Column>
            <Text>Beside it.</Text>
          </Column>
        </Row>
      </Document>
    );
    const { diagnostics } = await renderPdf(long);
    const overflow = diagnostics.filter((d) => d.code === "document/overflow");
    // A Row whose columns sit at its middle stays whole. A4 less its margins is 769.89 points; each text is a line of 18
    // (16px at 1.5), the Row 60 of them (1,080 points, 140% of the room): 42 fit, the 43rd is cut.
    expect(overflow).toEqual([
      {
        code: "document/overflow",
        severity: "warning",
        message:
          "Page 1's content is 140% as tall as its room, measured with its fonts, and what runs past it can't go on to the next page (an image, a block with a set height and a Row whose columns sit at its middle or end stay whole). What doesn't fit is cut off, from here on",
        path: "root.children[0].children[0].children[42]",
      },
    ]);
    expect(validate(long).diagnostics.find((d) => d.code === "document/overflow")?.message).toMatch(/\(an estimate: text isn't measured yet\)/);
    // A page that fits says nothing, nor does each page of the same content split into pages.
    expect((await renderPdf(<Document><Text>One paragraph.</Text></Document>)).diagnostics).toEqual([]);
    const split = (
      <Document>
        {Array.from({ length: 4 }, (_, page) => (
          <Document.Page key={page}>
            {Array.from({ length: 30 }, (_, i) => (
              <Text key={i}>Text {i + 1} of a page that holds a quarter of it.</Text>
            ))}
          </Document.Page>
        ))}
      </Document>
    );
    expect((await renderPdf(split)).diagnostics.map((d) => d.code)).not.toContain("document/overflow");
  });

  it("flows what the estimate thinks fits: capitals, wider than it reckons, go on to a second page", async () => {
    const capitals = (
      <Document>
        <Heading level={1}>Capitals</Heading>
        {Array.from({ length: 26 }, (_, i) => (
          <Text key={i}>WIDE CAPITAL LETTERS MAKE MUCH LONGER LINES THAN THE ESTIMATE EXPECTS, SO MORE LINES WRAP.</Text>
        ))}
      </Document>
    );
    expect(validate(capitals).diagnostics.map((d) => d.code)).not.toContain("document/overflow");
    const { pdf, diagnostics } = await renderPdf(capitals);
    expect(diagnostics.map((d) => d.code)).not.toContain("document/overflow");
    // The heading is a line of 30 points (32px at 1.25), each of them two lines of 18: in the room's 769.89 points the
    // heading and 20 of them fit, and the other 6 go on to page 2 (two lines don't split: two stay on each side).
    const { pages } = await read(pdf);
    expect(pages.map((page) => page.words.match(/WIDE/g)?.length)).toEqual([20, 6]);
  });

  it("draws text written right to left from its right, as its direction says: the period that ends it on its left", async () => {
    const design = (
      <Document dir="rtl" style={{ fontFamily: "Noto Arabic" }}>
        <Text>{arabicSentences(3)}</Text>
        {/* A paragraph takes its direction from its first run (react-pdf's): one that starts with a Span too. */}
        <Text>
          <Span style={{ color: "#b91c1c" }}>مرحبا</Span> {arabicSentences(3)}
        </Text>
        <Text dir="ltr">{arabicSentences(3)}</Text>
        {/* "auto": its first letter's. */}
        <Text dir="auto">{arabicSentences(3)}</Text>
        <Text dir="auto">An English sentence, then {arabicSentences(1)}</Text>
      </Document>
    );
    const { root } = prepare(design);
    const written = writeDocument(root!, { families: new Set(["noto arabic"]), fonts: arabicFonts, image: () => undefined, date: new Date(0) });
    const { placed } = await reactPdf(written);
    // Each paragraph's last line as drawn, from the left.
    const last = (i: number) => {
      const lines = placed![0].blocks.find((block) => block.path === `root.children[${i}]`)!.lines!;
      return lines[lines.length - 1].text.trim();
    };
    expect(last(0)).toMatch(/^\./);
    expect(last(1)).toMatch(/^\./);
    expect(last(2)).toMatch(/\.$/);
    expect(last(3)).toMatch(/^\./);
    expect(last(4)).toMatch(/\.$/);
    // Text left to right is written as before, with no direction of its own.
    const direction = (block: Block) => ("style" in block ? block.style.direction : undefined);
    expect(written.pages[0].content.map(direction)).toEqual(["rtl", "rtl", undefined, "rtl", undefined]);
  });

  it("draws a list item's text beside its marker, its lines inside the page's right margin as a paragraph's are", async () => {
    const words = "Elements writes the same design to email, the web, print and PDF, so this stands in for a section.";
    const { pdf } = await renderPdf(
      <Document>
        <Text>{words}</Text>
        <List type="number">
          <ListItem>{words}</ListItem>
        </List>
      </Document>
    );
    const document = await getDocument({ data: pdf.slice(), useSystemFonts: false, disableFontFace: true, verbosity: 0 }).promise;
    const page = await document.getPage(1);
    const items = (await page.getTextContent()).items.filter((item): item is { str: string; width: number; transform: number[] } & typeof item => "str" in item && item.str.trim() !== "");
    const ends = (from: string) => items.filter((item) => item.str.startsWith(from)).map((item) => item.transform[4] + item.width);
    // The page's right margin (48px, 36 points, in from its edge): the item's first line, set 18 points in beside its
    // marker, ends inside it as the paragraph's does.
    const margin = page.view[2] - 36;
    const [paragraph, item, ...more] = ends("Elements");
    expect(more).toEqual([]);
    expect(paragraph).toBeLessThanOrEqual(margin + 0.1);
    expect(item).toBeLessThanOrEqual(margin + 0.1);
    const marker = items.find((item) => item.str === "1.")!;
    const first = items.filter((item) => item.str.startsWith("Elements"))[1];
    expect(first.transform[4] - marker.transform[4]).toBeCloseTo(18, 1);
  });

  it("places a Button by its own alignSelf, over its stack's alignItems", () => {
    const { root } = prepare(
      <Document style={{ alignItems: "start" }}>
        <Button href="https://x.test">Start</Button>
        <Button href="https://x.test" style={{ alignSelf: "center" }}>
          Center
        </Button>
        <Button href="https://x.test" style={{ alignSelf: "end" }}>
          End
        </Button>
      </Document>
    );
    const { content } = writeDocument(root!, { families: new Set(), fonts: [], image: () => undefined, date: new Date(0) }).pages[0];
    expect(content.map((block) => block.style.alignSelf)).toEqual(["flex-start", "center", "flex-end"]);
  });

  it("draws each render's fonts from its own files: a family another render gave other files to isn't theirs", async () => {
    // Two different files given, in turn, as one family.
    const brand = (
      <Document style={{ fontFamily: "Brand" }}>
        <Text>Hello</Text>
      </Document>
    );
    const regular = await renderPdf(brand, { fonts: [{ family: "Brand", src: liberation("LiberationSans-Regular.ttf") }] });
    const bold = await renderPdf(brand, { fonts: [{ family: "Brand", src: liberation("LiberationSans-Bold.ttf") }] });
    const again = await renderPdf(brand, { fonts: [{ family: "Brand", src: liberation("LiberationSans-Regular.ttf") }] });
    expect(embedded(regular.pdf)).toEqual(["LiberationSans"]);
    expect(embedded(bold.pdf)).toEqual(["LiberationSans-Bold"]);
    expect(embedded(again.pdf)).toEqual(["LiberationSans"]);
    expect(Buffer.from(again.pdf).equals(Buffer.from(regular.pdf))).toBe(true);
  });

  it("draws an Svg's shapes as vectors, in the drawing's box", async () => {
    const { pdf } = await renderPdf(
      <Document>
        <Svg width={120} height={60} title="Logo">
          <Rect width={120} height={60} rx={8} style={{ fill: "#6366f1" }} />
          <Circle cx={30} cy={30} r={20} style={{ fill: "transparent", stroke: "#ffffff", strokeWidth: 4 }} />
        </Svg>
        <Text>Below the drawing</Text>
      </Document>
    );
    // The rectangle's fill, #6366f1, among the page's drawing operators.
    const document = await getDocument({ data: pdf.slice(), verbosity: 0 }).promise;
    const operators = await (await document.getPage(1)).getOperatorList();
    expect(JSON.stringify(operators.argsArray)).toMatch(/6366f1|99,102,241/i);
    const { pages } = await read(pdf);
    // 48px margin + 60px drawing = 81pt down, then the line of text below it.
    expect(pages[0].first?.str).toBe("Below the drawing");
    expect(pages[0].first!.y).toBeGreaterThan(36 + 45);
  });

  it("links to a link's URL, given as a string or as { href, target }", async () => {
    const { pdf } = await renderPdf(
      <Document>
        <Button href={{ href: "https://a.test/go", target: "_blank" }}>Go</Button>
        <Text>
          See <Link href={{ href: "https://b.test/more" }}>more</Link> or <Link href="https://c.test/x">this</Link>
        </Text>
      </Document>
    );
    const document = await getDocument({ data: pdf.slice(), verbosity: 0 }).promise;
    const urls = (await (await document.getPage(1)).getAnnotations()).map((annotation: { url?: string }) => annotation.url);
    expect(urls).toEqual(["https://a.test/go", "https://b.test/more", "https://c.test/x"]);
  });

  it("writes the words of a Link on its own and of a Menu's links, each linked", async () => {
    const { pdf } = await renderPdf(
      <Document>
        <Link href="https://acme.test/report">Read the report</Link>
        <Menu
          items={[
            { text: "Home", href: "https://acme.test/" },
            { text: "Blog", href: "https://acme.test/blog" },
          ]}
          separator="|"
        />
      </Document>
    );
    expect((await read(pdf)).pages[0].words).toBe("Read the report Home | Blog");
    const document = await getDocument({ data: pdf.slice(), verbosity: 0 }).promise;
    const urls = (await (await document.getPage(1)).getAnnotations()).map((annotation: { url?: string }) => annotation.url);
    expect(urls).toEqual(["https://acme.test/report", "https://acme.test/", "https://acme.test/blog"]);
  });

  it("flows a page's content onto the pages it needs, its lines as far apart as laid out on each (not drawn over each other)", async () => {
    const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`);
    const { pdf } = await renderPdf(
      <Document size="A4" margin={48}>
        {lines.map((line) => (
          <Text key={line} style={{ fontSize: 12, lineHeight: 1.5 }}>
            {line}
          </Text>
        ))}
      </Document>
    );
    const document = await getDocument({ data: pdf.slice(), useSystemFonts: false, disableFontFace: true, verbosity: 0 }).promise;
    const drawn: string[][] = [];
    for (let n = 1; n <= document.numPages; n++) {
      const items = (await (await document.getPage(n)).getTextContent()).items as Array<{ str?: string; transform: number[] }>;
      const page = items.filter((item) => item.str?.startsWith("Line"));
      const baselines = page.map((item) => item.transform[5]);
      // A 12px line at 1.5 is 18px: 13.5 points, from each line to the next.
      expect(baselines.slice(1).map((y, i) => baselines[i] - y).filter((gap) => Math.abs(gap - 13.5) > 0.05)).toEqual([]);
      drawn.push(page.map((item) => item.str!));
    }
    // 769.89 points of room hold 57 of them; each line once, in order.
    expect(drawn.map((page) => page.length)).toEqual([57, 43]);
    expect(drawn.flat()).toEqual(lines);
  });

  it("paints each page white unless it has a background of its own (a viewer may show a transparent page as black)", async () => {
    const fills = async (template: ReactElement) => {
      const { pdf } = await renderPdf(template);
      const document = await getDocument({ data: pdf.slice(), verbosity: 0 }).promise;
      return JSON.stringify((await (await document.getPage(1)).getOperatorList()).argsArray);
    };
    expect(
      await fills(
        <Document>
          <Text style={{ color: "#111827" }}>Plain paper</Text>
        </Document>
      )
    ).toMatch(/#ffffff|255,255,255/i);
    const tinted = await fills(
      <Document style={{ backgroundColor: "#fef3c7" }}>
        <Text style={{ color: "#111827" }}>Tinted paper</Text>
      </Document>
    );
    expect(tinted).toMatch(/fef3c7|254,243,199/i);
    expect(tinted).not.toMatch(/#ffffff|255,255,255/i);
  });

  it("reads the tree prepare() lays out at the layout version it's built for, and refuses another (Elements newer or older)", async () => {
    const template = (
      <Document>
        <Text>Hi</Text>
      </Document>
    );
    expect(prepare(template).layout).toBe(LAYOUT_VERSION);
    await expect(renderPdf(template)).resolves.toMatchObject({ diagnostics: [] });
    const refused = async (prepared: { layout?: number }, message: string) => {
      other.prepared = prepared;
      try {
        await expect(renderPdf(template)).rejects.toMatchObject({ diagnostics: [{ code: "pdf/version", severity: "error", path: "root", message }] });
      } finally {
        other.prepared = undefined;
      }
    };
    const reads = `@hyper-elements/react/pdf reads layout version ${LAYOUT_VERSION}; the main entry writes`;
    await refused({ layout: LAYOUT_VERSION + 1 }, `${reads} ${LAYOUT_VERSION + 1}: update @hyper-elements/react`);
    await refused({ layout: LAYOUT_VERSION - 1 }, `${reads} ${LAYOUT_VERSION - 1}: update @hyper-elements/react`);
    await refused({}, `${reads} none: update @hyper-elements/react`);
  });

  it("depends on its engine in its adapter's files: the writer builds pages as plain data, which react-pdf's adapter measures and draws", () => {
    const src = join(dirname(fileURLToPath(import.meta.url)), "../../../internal/core/src/pdf");
    const importing = readdirSync(src).filter((file) => /from "@react-pdf\//.test(readFileSync(join(src, file), "utf8")));
    expect(importing.sort()).toEqual(["react-pdf-measure.ts", "react-pdf.tsx"]);
    // What the writer builds is data: the same after a round trip through JSON (its date aside).
    const { root } = prepare(invoice);
    const pages = writeDocument(root!, { families: new Set(), fonts: [], image: (src) => src, date: new Date(0) });
    expect(JSON.parse(JSON.stringify({ ...pages, date: undefined }))).toEqual({ ...pages, date: undefined });
    // A4 in points, on each page.
    expect(new Set(pages.pages.map((page) => `${page.width}x${page.height}`))).toEqual(new Set(["595.275x841.89"]));
  });

  describe("every block a Document takes", () => {
    /** A sample of each, with the words it draws. */
    const SAMPLES: Record<string, [ReactElement, string]> = {
      Section: [<Section key="s"><Text>In a section</Text></Section>, "In a section"],
      Row: [<Row key="r"><Column><Text>In a row</Text></Column></Row>, "In a row"],
      Column: [<Column key="c"><Text>In a column</Text></Column>, "In a column"],
      Grid: [<Grid key="g" columns={2}><Text>Left</Text><Text>Right</Text></Grid>, "LeftRight"],
      Layer: [<Layer key="l"><Text>Under</Text><Text>Over</Text></Layer>, "UnderOver"],
      Text: [<Text key="p">A paragraph</Text>, "A paragraph"],
      Heading: [<Heading key="h">A heading</Heading>, "A heading"],
      Link: [<Link key="a" href="https://acme.test">A link</Link>, "A link"],
      Button: [<Button key="b" href="https://acme.test">A button</Button>, "A button"],
      Image: [<Image key="i" src={{ src: PNG_URI, width: 1, height: 1 }} alt="" />, ""],
      Divider: [<Divider key="d" />, ""],
      List: [
        <List key="ul" type="number">
          <ListItem>First</ListItem>
          <ListItem>
            Second
            <List>
              <ListItem>Inside</ListItem>
            </List>
            After
          </ListItem>
        </List>,
        "1.First2.Second•InsideAfter",
      ],
      Table: [
        <Table key="tb">
          <TableRow header style={{ backgroundColor: "#ff0000" }}>
            <TableCell>Plan</TableCell>
            <TableCell>Price</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Pro</TableCell>
            <TableCell>$20</TableCell>
          </TableRow>
        </Table>,
        "PlanPricePro$20",
      ],
      Video: [<Video key="v" src="https://vimeo.com/76979871" title="Our launch" />, "Our launch"],
      Svg: [<Svg key="svg" width={10} height={10}><Rect width={10} height={10} /></Svg>, ""],
      Social: [<Social key="so" icons={[{ name: "x", href: "https://x.com/acme" }]} />, ""],
      Menu: [<Menu key="m" items={[{ text: "Home", href: "/" }, { text: "Blog", href: "/blog" }]} separator="|" />, "Home|Blog"],
      // Markup it can't draw: its plain text, its own or its markup's words.
      Html: [<Html key="html" html="<p>Sale <b>today</b></p><style>p{color:red}</style>" />, "Sale today"],
    };
    /** The words in the pages the writer builds, in their order. */
    const words = (item: unknown): string => {
      if (typeof item === "string") return item;
      if (Array.isArray(item)) return item.map(words).join("");
      if (!item || typeof item !== "object") return "";
      const { pages, header, content, footer, runs, children } = item as Record<string, unknown>;
      return pages ? words(pages) : content ? words([header, content, footer]) : words(runs ?? children ?? []);
    };

    it("has a sample of each (a new block needs its case in the writer, and one here)", () => {
      const takes = new Set(COMPONENTS.Document.children.categories);
      const blocks = Object.values(COMPONENTS).filter((definition) => definition.categories.some((category) => takes.has(category)));
      expect(Object.keys(SAMPLES).sort()).toEqual(blocks.map((definition) => definition.type).sort());
    });

    it.each(Object.entries(SAMPLES))("draws a %s with its words", (_, [sample, drawn]) => {
      const { root, diagnostics } = prepare(<Document>{sample}</Document>);
      expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
      expect(words(writeDocument(root!, { families: new Set(), fonts: [], image: (src) => src, date: new Date(0) }))).toBe(drawn);
    });

    it("paints a Table row's background", async () => {
      // The fill colors the page sets, as pdf.js reads its drawing operators: the header row's red among them.
      const { pdf } = await renderPdf(<Document>{SAMPLES.Table[0]}</Document>);
      const page = await (await getDocument({ data: pdf.slice(), verbosity: 0 }).promise).getPage(1);
      const { fnArray, argsArray } = await page.getOperatorList();
      const fills = fnArray.flatMap((fn, i) => (fn === OPS.setFillRGBColor ? [String(argsArray[i])] : []));
      expect(fills).toContain("#ff0000");
    });
  });

  it("writes a Document only", async () => {
    await expect(
      renderPdf(
        <Email>
          <Text>Hi</Text>
        </Email>
      )
    ).rejects.toMatchObject({ diagnostics: [expect.objectContaining({ code: "pdf/root" })] });
  });
});

describe("layoutDocument", () => {
  const report = (
    <Document title="Report">
      <PageHeader>
        <Text>Acme report</Text>
      </PageHeader>
      <PageFooter>
        <Text>
          Page <PageNumber /> of <PageNumber total />
        </Text>
      </PageFooter>
      <Text id="intro">An introduction long enough to wrap onto a second line of an A4 page, written out so that it does, with some more words.</Text>
      <PageBreak />
      {Array.from({ length: 50 }, (_, i) => (
        <Text key={i}>Text {i + 1} of the second page, which holds more than fits.</Text>
      ))}
    </Document>
  );
  /** A page's own content: the blocks of the Document's children, not those of its header and footer. */
  const content = (nodes: DocumentNode[], page: number) => nodes.filter((node) => node.page === page && /^root\.children\[\d+\]$/.test(node.path) && node.type === "Text");

  it("gives each page's paper and room, and each block on each page, in px from the page's top left", async () => {
    const { pages, nodes } = await layoutDocument(report);
    expect(pages.length).toBeGreaterThan(2);
    expect(pages.map(({ page, width, height }) => [page, width, height])).toEqual(pages.map((_, i) => [i + 1, 793.7, 1122.52]));
    // The header's on every page at the top margin (48px), the footer on every page down to the bottom one.
    const header = nodes.filter((node) => node.type === "PageHeader");
    const footer = nodes.filter((node) => node.type === "PageFooter");
    expect(header.map((node) => [node.page, node.x, node.y])).toEqual(pages.map(({ page }) => [page, 48, 48]));
    expect(footer.map((node) => node.page)).toEqual(pages.map(({ page }) => page));
    for (const node of footer) expect(node.y + node.height).toBeCloseTo(1122.52 - 48, 0);
    // The room is between them.
    expect(pages[0].room.top).toBeCloseTo(header[0].y + header[0].height, 1);
    expect(pages[0].room.bottom).toBeCloseTo(footer[0].y, 1);
    expect(nodes.find((node) => node.id === "intro")).toMatchObject({ path: "root.children[2]", type: "Text", page: 1, x: 48, y: header[0].y + header[0].height, lines: 2 });
    expect(content(nodes, 1).every((node) => node.cut === undefined)).toBe(true);
  });

  it("gives each text that goes on to the pages after on the page it's on, each once, in order, none cut", async () => {
    const { pages, nodes, diagnostics } = await layoutDocument(report);
    // After the PageBreak (the Document's fourth child), its 50 texts.
    const texts = pages.flatMap(({ page }) => (page === 1 ? [] : content(nodes, page)));
    expect(texts.map((node) => node.path)).toEqual(Array.from({ length: 50 }, (_, i) => `root.children[${i + 4}]`));
    expect(texts.every((node) => node.cut === undefined)).toBe(true);
    for (const { page, room } of pages) for (const node of content(nodes, page)) expect(node.y + node.height).toBeLessThanOrEqual(room.bottom + 0.01);
    expect(diagnostics.map((d) => d.code)).not.toContain("document/overflow");
  });

  it("says what's past a page's room where it can't go on: the text the cut goes through cut in part, all after it, never the header or footer", async () => {
    const tall = (
      <Document>
        <PageFooter>
          <Text>Footer</Text>
        </PageFooter>
        <Row style={{ alignItems: "center" }}>
          <Column>
            <Text>{Array.from({ length: 200 }, (_, i) => `Sentence ${i + 1} of a long paragraph in a Row.`).join(" ")}</Text>
            <Text>After it, in the same Column.</Text>
          </Column>
          <Column>
            <Text>Beside it.</Text>
          </Column>
        </Row>
      </Document>
    );
    const { nodes, diagnostics } = await layoutDocument(tall);
    const cut = Object.fromEntries(nodes.map((node) => [node.path, node.cut]));
    expect(cut).toEqual({
      "root.children[0]": undefined,
      "root.children[0].children[0]": undefined,
      "root.children[1]": "some",
      "root.children[1].children[0]": "some",
      "root.children[1].children[0].children[0]": "some",
      "root.children[1].children[0].children[1]": "all",
      // Beside it, at the middle of the Row, which is far taller than the page.
      "root.children[1].children[1]": "all",
      "root.children[1].children[1].children[0]": "all",
    });
    expect(diagnostics.filter((d) => d.code === "document/overflow").map((d) => d.path)).toEqual(["root.children[1].children[0].children[0]"]);
  });

  it("rejects as renderPdf does", async () => {
    await expect(
      layoutDocument(
        <Email>
          <Text>Not a document</Text>
        </Email>
      )
    ).rejects.toThrow(/PDF output is a Document's/);
  });
});

describe("templateAssets", () => {
  // Each source the template names, as a tool would load it: a font's file, or an image's.
  const files: Record<string, Uint8Array> = {
    "https://fonts.acme.test/brand.ttf": liberation("LiberationSans-Regular.ttf"),
    "https://fonts.acme.test/brand-bold.ttf": liberation("LiberationSans-Bold.ttf"),
    "https://fonts.acme.test/variable.ttf": liberation("LiberationSans-Italic.ttf"),
    "https://cdn.acme.test/logo.png": PNG,
    "/hero.png": PNG,
    "https://cdn.acme.test/launch.png": PNG,
    "https://img.youtube.com/vi/dQw4w9WgXcQ/0.jpg": PNG,
  };
  const template = (
    <Document
      fonts={[
        { family: "Brand", src: "https://fonts.acme.test/brand.ttf", weight: 400 },
        { family: "Brand", src: "https://fonts.acme.test/brand-bold.ttf", weight: 700 },
        { family: "Variable", src: "https://fonts.acme.test/variable.ttf", weight: [100, 900] },
      ]}
      style={{ fontFamily: "Brand, sans-serif" }}
    >
      <Text>Regular</Text>
      <Text style={{ fontWeight: 700 }}>Bold</Text>
      <Text style={{ fontFamily: "Variable", fontWeight: 100 }}>Variable</Text>
      <Image src={{ src: "https://cdn.acme.test/logo.png", width: 40, height: 40 }} alt="Logo" />
      <Row>
        <Column>
          <Image src={{ src: "/hero.png", width: 40, height: 40 }} alt="Hero" />
          <Image src={{ src: "https://cdn.acme.test/logo.png", width: 40, height: 40 }} alt="Logo again" />
        </Column>
      </Row>
      <Image src={{ src: PNG_URI, width: 40, height: 40 }} alt="Inline" />
      <Video src="https://vimeo.com/76979871" title="Our launch" thumbnail={{ src: "https://cdn.acme.test/launch.png", width: 64, height: 36 }} />
      <Video src="https://www.youtube.com/watch?v=dQw4w9WgXcQ" title="Our launch on YouTube" />
      <Video src="https://vimeo.com/1" title="No thumbnail" />
    </Document>
  );

  it("lists the sources renderPdf() looks for: the Document's fonts, each image once (a Video's thumbnail among them)", () => {
    expect(templateAssets(template)).toEqual({
      fonts: [
        { family: "Brand", src: "https://fonts.acme.test/brand.ttf", weight: 400 },
        { family: "Brand", src: "https://fonts.acme.test/brand-bold.ttf", weight: 700 },
        { family: "Variable", src: "https://fonts.acme.test/variable.ttf", weight: [100, 900] },
      ],
      images: ["https://cdn.acme.test/logo.png", "/hero.png", PNG_URI, "https://cdn.acme.test/launch.png", "https://img.youtube.com/vi/dQw4w9WgXcQ/0.jpg"],
    });
    expect(
      templateAssets(
        <Document>
          <Text>Hi</Text>
        </Document>
      )
    ).toEqual({ fonts: [], images: [] });
  });

  it("is all renderPdf() needs: given exactly what it lists, it says nothing of a font or an image, and draws each image", async () => {
    const { fonts, images } = templateAssets(template);
    const { pdf, diagnostics } = await renderPdf(template, {
      // A range's lower bound, as a font given for it.
      fonts: fonts.map((face) => ({ family: face.family, src: files[face.src], weight: Array.isArray(face.weight) ? face.weight[0] : face.weight, style: face.style })),
      images: Object.fromEntries(images.filter((src) => !src.startsWith("data:")).map((src) => [src, files[src]])),
    });
    expect(diagnostics.filter((d) => ["pdf/font", "pdf/image", "pdf/font-weight"].includes(d.code))).toEqual([]);
    // The images written, read from the file's bytes (their dictionaries aren't compressed), apart from pdf.js: once
    // on CI pdf.js drew none of them, and this says whether the file held them. (Images with the same bytes share one.)
    const written = (Buffer.from(pdf).toString("latin1").match(/\/Subtype\s*\/Image\b/g) ?? []).length;
    expect(written, "image XObjects in the PDF").toBeGreaterThan(0);
    // Four Images (the logo twice) and both thumbnails, on the pages they go on (each thumbnail is as wide as the page).
    // pdf.js's warnings are printed (verbosity 1): an image it can't read is skipped with only a warning.
    const document = await getDocument({ data: pdf.slice(), verbosity: 1 }).promise;
    let painted = 0;
    for (let n = 1; n <= document.numPages; n++) painted += (await (await document.getPage(n)).getOperatorList()).fnArray.filter((fn) => fn === OPS.paintImageXObject).length;
    expect(painted, `pdf.js drew these of the ${written} images written`).toBe(6);
  });

  it("rejects a template as renderPdf() does", () => {
    const email = (
      <Email>
        <Text>Hi</Text>
      </Email>
    );
    expect(() => templateAssets(email)).toThrow(expect.objectContaining({ diagnostics: [expect.objectContaining({ code: "pdf/root" })] }));
  });
});
