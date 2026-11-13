/**
 * Images written from a Canvas: their size, the same bytes for the same template, and what's needed and not fetched
 * (a font always, an image's file).
 */
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { COMPONENTS, LAYOUT_VERSION } from "@hyper-elements/core";
import {
  Button,
  Canvas,
  Circle,
  Column,
  Divider,
  Email,
  Grid,
  Heading,
  Html,
  Image,
  Layer,
  LineBreak,
  Link,
  List,
  ListItem,
  Menu,
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
import type { ReactElement, ReactNode } from "react";
import { writeCanvas } from "@hyper-elements/core/image";
import { renderImage, templateAssets } from "../../src/image";

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

/** Liberation Sans (Arial's metrics, SIL OFL), as pdf.js ships it. */
const FONT = readFileSync(join(dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json")), "standard_fonts", "LiberationSans-Regular.ttf"));
const fonts = [{ family: "Liberation Sans", src: FONT }];

/** A 1×1 PNG. */
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));

/** A PNG's size, from its IHDR chunk. */
const size = (png: Uint8Array) => [Buffer.from(png).readUInt32BE(16), Buffer.from(png).readUInt32BE(20)];

const card = (
  <Canvas width={600} height={315} style={{ backgroundColor: "#0f172a", padding: 40, gap: 16, color: "#ffffff", fontFamily: "Liberation Sans, sans-serif" }}>
    <Heading level={1} style={{ fontSize: 40 }}>
      Launch week
    </Heading>
    <Text style={{ fontSize: 18, color: "#cbd5e1" }}>Five days of new things, one a day.</Text>
    <Svg width={120} height={60} title="Logo">
      <Rect width={120} height={60} rx={8} style={{ fill: "#6366f1" }} />
      <Circle cx={30} cy={30} r={20} style={{ fill: "transparent", stroke: "#ffffff", strokeWidth: 4 }} />
    </Svg>
  </Canvas>
);

describe("renderImage", () => {
  it("writes a PNG of the Canvas's size, sharper at a scale", async () => {
    const { image, width, height, diagnostics } = await renderImage(card, { fonts });
    expect(Buffer.from(image.subarray(1, 4)).toString()).toBe("PNG");
    expect([width, height]).toEqual([600, 315]);
    expect(size(image)).toEqual([600, 315]);
    // The Heading is bold (its default), and only the regular file is given.
    expect(diagnostics.map((d) => [d.code, d.path, d.message])).toEqual([
      ["image/font-weight", "root.children[0]", "Text in Liberation Sans at 700, which is given at 400 only: it's drawn in the nearest. Give that file in renderImage's fonts option"],
    ]);
    expect(size((await renderImage(card, { fonts, scale: 2 })).image)).toEqual([1200, 630]);
  });

  it("writes an SVG, its text as paths (no font needed to show it)", async () => {
    const svg = new TextDecoder().decode((await renderImage(card, { fonts, format: "svg" })).image);
    expect(svg).toMatch(/^<svg width="600" height="315" viewBox="0 0 600 315"/);
    expect(svg).not.toContain("<text");
    expect(svg).toContain("6366f1");
  });

  it("places a Button by its own alignSelf, over its stack's alignItems", async () => {
    const buttons = (
      <Canvas width={600} height={315} style={{ padding: 40, gap: 16, alignItems: "start", fontFamily: "Liberation Sans" }}>
        <Button href="https://x.test" style={{ backgroundColor: "#fde68a" }}>Start</Button>
        <Button href="https://x.test" style={{ alignSelf: "center", backgroundColor: "#e0e7ff" }}>Center</Button>
        <Button href="https://x.test" style={{ alignSelf: "end", backgroundColor: "#bbf7d0" }}>End</Button>
      </Canvas>
    );
    const svg = new TextDecoder().decode((await renderImage(buttons, { fonts, format: "svg" })).image);
    const box = (fill: string) => {
      const [, x, width] = new RegExp(`<path x="([\\d.]+)" y="[\\d.]+" width="([\\d.]+)" height="[\\d.]+" fill="${fill}"`).exec(svg)!;
      return [Number(x), Number(x) + Number(width)];
    };
    // The content is 40px to 560px.
    expect(box("#fde68a")[0]).toBe(40);
    const [center, centerEnd] = box("#e0e7ff");
    expect(Math.abs((center + centerEnd) / 2 - 300)).toBeLessThan(1);
    expect(box("#bbf7d0")[1]).toBe(560);
  });

  it("writes the same file for the same template", async () => {
    const [a, b] = await Promise.all([renderImage(card, { fonts }), renderImage(card, { fonts })]);
    expect(Buffer.from(a.image).equals(Buffer.from(b.image))).toBe(true);
  });

  it("takes the Canvas's own fonts given as data: URIs", async () => {
    const own = (
      <Canvas width={200} height={100} fonts={[{ family: "Liberation Sans", src: `data:font/ttf;base64,${FONT.toString("base64")}` }]} style={{ fontFamily: "Liberation Sans" }}>
        <Text>Hi</Text>
      </Canvas>
    );
    expect((await renderImage(own)).diagnostics).toEqual([]);
  });

  it("says a font file that's WOFF2 isn't drawn (an image draws TTF, OTF and WOFF), given or the Canvas's own", async () => {
    const woff2 = Uint8Array.from([0x77, 0x4f, 0x46, 0x32, 0, 1, 0, 0]);
    const own = (
      <Canvas width={200} height={100} fonts={[{ family: "Packed", src: `data:font/woff2;base64,${Buffer.from(woff2).toString("base64")}` }]} style={{ fontFamily: "Liberation Sans" }}>
        <Text>Hi</Text>
      </Canvas>
    );
    const { diagnostics } = await renderImage(own, { fonts: [...fonts, { family: "Other", src: woff2 }] });
    expect(diagnostics.filter((d) => d.message.includes("WOFF2")).map((d) => [d.code, d.message.split(":")[0]])).toEqual([
      ["image/font", "Other's file is WOFF2"],
      ["image/font", "Packed's file is WOFF2"],
    ]);
  });

  it("says what an image can't show that its HTML can (a hover, a Video, markup), and content that can't fit the Canvas (and validate() says both)", async () => {
    const template = (
      <Canvas width={300} height={120} style={{ fontFamily: "Liberation Sans", gap: 8 }}>
        <Button href="https://x.test" style={{ hover: { backgroundColor: "#333333" } }}>
          Go
        </Button>
        <Video src="https://vimeo.com/76979871" title="Our launch" />
        <Html html="<b>Sale</b>" />
        {Array.from({ length: 12 }, (_, i) => (
          <Text key={i}>Line {i + 1} of more than a 120px Canvas can hold</Text>
        ))}
      </Canvas>
    );
    const said = (diagnostics: Array<{ code: string; message: string }>) => diagnostics.filter((d) => /^(image|canvas)\//.test(d.code) && d.code !== "image/font").map((d) => [d.code, d.message.split(":")[0].split(" (")[0]]);
    const expected = [
      ["canvas/overflow", "The Canvas's content looks about"],
      ["image/unsupported", "A hover isn't possible in an image"],
      ["image/unsupported", "A Video isn't possible in an image"],
      ["image/unsupported", "Markup isn't possible in an image"],
    ];
    const tidy = (list: string[][]) => list.map(([code, message]) => [code, message.replace(/ \d+%.*/, "")]).sort();
    expect(tidy(said((await renderImage(template, { fonts })).diagnostics))).toEqual(tidy(expected));
    expect(tidy(said(validate(template).diagnostics))).toEqual(tidy(expected));
  });

  it("cuts off content far past the Canvas's edge as any other (resvg would end the process for it), drawing the same image", async () => {
    // Content more than the Canvas's height below it (an image at 600px, a box and a line further down, in a 250px
    // Canvas): a layer resvg can't place, so it panics, which no catch stops.
    const src = { src: `data:image/png;base64,${Buffer.from(PNG).toString("base64")}`, width: 600, height: 300 };
    const canvas = (children: ReactNode) => (
      <Canvas width={600} height={250} style={{ fontFamily: "Liberation Sans", backgroundColor: "#ffffff" }}>
        {children}
      </Canvas>
    );
    const far = canvas([
      <Image key={0} src={src} alt="" />,
      <Image key={1} src={src} alt="" />,
      <Image key={2} src={src} alt="" />,
      <Column key={3} style={{ height: 100, backgroundColor: "#cc0000", border: "2px solid #000000", borderRadius: 8 }} />,
      <Text key={4}>Far below</Text>,
    ]);
    const near = canvas([<Image key={0} src={src} alt="" />, <Image key={1} src={src} alt="" />]);
    const { image, diagnostics } = await renderImage(far, { fonts });
    expect(diagnostics.map((d) => d.code)).toContain("canvas/overflow");
    // Nothing past the edge shows, so the image is the one without it, byte for byte, at a scale too.
    expect(Buffer.from(image).equals(Buffer.from((await renderImage(near, { fonts })).image))).toBe(true);
    expect(Buffer.from((await renderImage(far, { fonts, scale: 2 })).image).equals(Buffer.from((await renderImage(near, { fonts, scale: 2 })).image))).toBe(true);
    // The SVG is Satori's as it is, all of it.
    expect(new TextDecoder().decode((await renderImage(far, { fonts, format: "svg" })).image).match(/<image /g)).toHaveLength(3);
  });

  it("needs a font, and fetches nothing: an image it isn't given is an error; given by its URL, it's drawn", async () => {
    await expect(renderImage(card)).rejects.toMatchObject({ diagnostics: [expect.objectContaining({ code: "image/font", path: "root" })] });
    const photo = (
      <Canvas width={200} height={100}>
        <Image src={{ src: "https://cdn.acme.test/photo.png", width: 100, height: 50 }} alt="Photo" />
      </Canvas>
    );
    await expect(renderImage(photo, { fonts })).rejects.toMatchObject({ diagnostics: [expect.objectContaining({ code: "image/image", path: "root.children[0].props.src" })] });
    expect(size((await renderImage(photo, { fonts, images: { "https://cdn.acme.test/photo.png": PNG } })).image)).toEqual([200, 100]);
  });

  it("reads the tree prepare() lays out at the layout version it's built for, and refuses another (Elements newer or older)", async () => {
    const template = (
      <Canvas width={200} height={100} style={{ fontFamily: "Liberation Sans" }}>
        <Text>Hi</Text>
      </Canvas>
    );
    expect(prepare(template).layout).toBe(LAYOUT_VERSION);
    await expect(renderImage(template, { fonts })).resolves.toMatchObject({ diagnostics: [] });
    const refused = async (prepared: { layout?: number }, message: string) => {
      other.prepared = prepared;
      try {
        await expect(renderImage(template, { fonts })).rejects.toMatchObject({ diagnostics: [{ code: "image/version", severity: "error", path: "root", message }] });
      } finally {
        other.prepared = undefined;
      }
    };
    const reads = `@hyper-elements/react/image reads layout version ${LAYOUT_VERSION}; the main entry writes`;
    await refused({ layout: LAYOUT_VERSION + 1 }, `${reads} ${LAYOUT_VERSION + 1}: update @hyper-elements/react`);
    await refused({ layout: LAYOUT_VERSION - 1 }, `${reads} ${LAYOUT_VERSION - 1}: update @hyper-elements/react`);
    await refused({}, `${reads} none: update @hyper-elements/react`);
  });

  it("depends on its engine in one file: the writer builds a canvas as plain data, which Satori's and resvg's adapter draws", () => {
    const src = join(dirname(fileURLToPath(import.meta.url)), "../../../internal/core/src/image");
    const importing = readdirSync(src).filter((file) => /from "(satori|@resvg\/)/.test(readFileSync(join(src, file), "utf8")));
    expect(importing).toEqual(["satori.ts"]);
    // What the writer builds is data: the same after a round trip through JSON.
    const { root } = prepare(card);
    const canvas = writeCanvas(root!, { families: new Set(["liberation sans"]), fallback: "Liberation Sans", fonts: [], image: (src) => src });
    expect(JSON.parse(JSON.stringify(canvas))).toEqual(canvas);
    expect([canvas.width, canvas.height, canvas.children.length]).toEqual([600, 315, 3]);
  });

  describe("every block a Canvas takes", () => {
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
      Image: [<Image key="i" src={{ src: `data:image/png;base64,${Buffer.from(PNG).toString("base64")}`, width: 1, height: 1 }} alt="" />, ""],
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
    const words = (item: unknown): string => {
      if (typeof item === "string") return item;
      if (Array.isArray(item)) return item.map(words).join("");
      if (!item || typeof item !== "object") return "";
      const { runs, children } = item as Record<string, unknown>;
      return words(runs ?? children ?? []);
    };
    const canvas = (children: ReactNode) => <Canvas width={600} height={600} style={{ fontFamily: "Liberation Sans" }}>{children}</Canvas>;

    it("has a sample of each (a new block needs its case in the writer, and one here)", () => {
      const takes = new Set(COMPONENTS.Canvas.children.categories);
      const blocks = Object.values(COMPONENTS).filter((definition) => definition.categories.some((category) => takes.has(category)));
      expect(Object.keys(SAMPLES).sort()).toEqual(blocks.map((definition) => definition.type).sort());
    });

    it.each(Object.entries(SAMPLES))("draws a %s with its words", (_, [sample, drawn]) => {
      const { root, diagnostics } = prepare(canvas(sample));
      expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
      expect(words(writeCanvas(root!, { families: new Set(["liberation sans"]), fallback: "Liberation Sans", fonts: [], image: (src) => src }))).toBe(drawn);
    });

    it("writes the text blocks as Satori draws them", async () => {
      const text = ["Link", "List", "Table", "Video", "Menu"].map((type) => SAMPLES[type][0]);
      const svg = new TextDecoder().decode((await renderImage(canvas(text), { fonts, format: "svg" })).image);
      // The Table's header row's background.
      expect(svg).toContain('fill="#ff0000"');
    });
  });

  it("aligns a line of text that doesn't wrap as one that does: centered, right or at the left, set on it or inherited", async () => {
    /** Where a Canvas's text is drawn across it: the leftmost and rightmost points of its letters' paths. */
    const across = async (template: ReactElement) => {
      const svg = new TextDecoder().decode((await renderImage(template, { fonts, format: "svg" })).image);
      const xs = [...svg.matchAll(/<path[^>]* d="([^"]+)"/g)].flatMap((path) => [...path[1].matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((point) => Number(point[1])));
      return [Math.min(...xs), Math.max(...xs)];
    };
    const canvas = (align: "left" | "center" | "right" | undefined, children: ReactNode) => (
      <Canvas width={1080} height={400} style={{ textAlign: align, fontFamily: "Liberation Sans" }}>
        {children}
      </Canvas>
    );
    const centered = ([left, right]: number[]) => expect(Math.abs((left + right) / 2 - 540)).toBeLessThan(3);

    // The Canvas's alignment, a Column's, the block's own.
    centered(await across(canvas("center", <Text>EPISODE 42</Text>)));
    centered(await across(canvas(undefined, <Column style={{ textAlign: "center" }}><Heading>EPISODE 42</Heading></Column>)));
    centered(await across(canvas(undefined, <Text style={{ textAlign: "center" }}>EPISODE <Span style={{ color: "#ff0000" }}>42</Span></Text>)));
    const [, right] = await across(canvas("right", <Text>EPISODE 42</Text>));
    expect(right).toBeGreaterThan(1075);
    const [left] = await across(canvas("left", <Text>EPISODE 42</Text>));
    expect(left).toBeLessThan(5);
    // Lines that wrap, centered as they were.
    centered(await across(canvas("center", <Text style={{ fontSize: 48 }}>{"Five days of new things, one a day, all week long. ".repeat(3)}</Text>)));
  });

  /** The lines of a Canvas's text, top to bottom: where each one's letters start and end across it, and its top. */
  const lines = async (children: ReactNode, width = 900) => {
    const template = (
      <Canvas width={width} height={200} style={{ padding: 20, fontFamily: "Liberation Sans", fontSize: 24 }}>
        {children}
      </Canvas>
    );
    const svg = new TextDecoder().decode((await renderImage(template, { fonts, format: "svg" })).image);
    const points = [...svg.matchAll(/<path[^>]* d="([^"]+)"/g)].flatMap((path) => [...path[1].matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((point) => [Number(point[1]), Number(point[2])] as const));
    // Lines are 36px apart and a line's letters under 24px tall, so 10px with no point in it is the space between two.
    const rows: Array<{ top: number; xs: number[] }> = [];
    let last = -Infinity;
    for (const [x, y] of points.sort((a, b) => a[1] - b[1])) {
      if (y - last > 10) rows.push({ top: y, xs: [] });
      rows[rows.length - 1]!.xs.push(x);
      last = y;
    }
    return rows.map(({ top, xs }) => ({ from: Math.min(...xs), to: Math.max(...xs), top }));
  };
  /** How wide its text is drawn. */
  const width = async (children: ReactNode) => {
    const drawn = await lines(children);
    return Math.max(...drawn.map((line) => line.to)) - Math.min(...drawn.map((line) => line.from));
  };
  type Run = string | { kind: string; runs?: Run[] };
  /** What the writer gives the engine to draw: each block's runs. */
  const drawn = (children: ReactNode) => {
    const { root } = prepare(
      <Canvas width={420} height={200} style={{ padding: 20, fontFamily: "Liberation Sans", fontSize: 24 }}>
        {children}
      </Canvas>
    );
    return writeCanvas(root!, { families: new Set(["liberation sans"]), fallback: "Liberation Sans", fonts: [], image: (src) => src }).children as Array<{ runs?: Run[] }>;
  };
  const said = (runs: Run[]): string => runs.map((run) => (typeof run === "string" ? run : (run.runs && said(run.runs)) ?? "")).join("");

  it("keeps the space before and after a Span or a Link, and starts a wrapped line at the margin", async () => {
    // Each run is a flex item, and a flex item's text is trimmed: the spaces around a Span would be lost, drawing
    // "Helloworldand more" (about two spaces narrower than the same words written plainly).
    const plain = await width(<Text>Hello world and more</Text>);
    expect(Math.abs((await width(<Text>Hello <Span style={{ color: "#ff0000" }}>world</Span> and more</Text>)) - plain)).toBeLessThan(2);
    expect(Math.abs((await width(<Text>Hello<Span style={{ color: "#ff0000" }}> world </Span>and more</Text>)) - plain)).toBeLessThan(2);
    const linked = await width(
      <Text>
        Hello <Link href="https://x.test">world</Link> and more
      </Text>
    );
    expect(Math.abs(linked - plain)).toBeLessThan(2);
    // The space a block of text starts or ends with goes, as white-space: normal drops it in the HTML outputs.
    expect(Math.abs((await width(<Text> Hello world and more </Text>)) - plain)).toBeLessThan(2);
    expect(Math.abs((await width(<Text>Hello world and more</Text>)) - plain)).toBeLessThan(2);

    // A space starting a run would be drawn as an indent where the words wrap before that run, so the writer hangs
    // it off the end of the run before it instead. Every one of a block's runs but the first begins with a letter.
    const begins = (run: Run): boolean => {
      if (typeof run === "string") return run.startsWith(" ");
      const first = run.runs?.[0];
      return run.kind === "span" && first !== undefined && begins(first);
    };
    for (const block of drawn(
      <>
        <Text>
          A line long enough that it wraps with a <Span style={{ color: "#ff0000" }}>run in it</Span> before the words that follow it here
        </Text>
        <Text>
          See <Link href="https://x.test">our site</Link> today
        </Text>
      </>
    )) {
      expect(block.runs?.slice(1).filter(begins)).toEqual([]);
    }
    expect(said(drawn(<Text>Hello <Span style={{ color: "#ff0000" }}>world</Span> and more</Text>)[0]!.runs!)).toBe("Hello world and more");
  });

  it("keeps a non-breaking space: each one drawn, and the words either side of it on one line", async () => {
    const NBSP = "\u00a0";
    // Spaces collapse into one; non-breaking spaces don't (`\s` takes both, and would make the four of them one).
    const one = await width(<Text>A B</Text>);
    expect(Math.abs((await width(<Text>{"A    B"}</Text>)) - one)).toBeLessThan(1);
    expect((await width(<Text>{`A${NBSP.repeat(4)}B`}</Text>)) - one).toBeGreaterThan(15);
    // Only the space that collapses is taken off a block's start: two non-breaking ones indent it.
    const [flush] = await lines(<Text>Hello</Text>);
    const [indented] = await lines(<Text>{`${NBSP}${NBSP}Hello`}</Text>);
    expect(indented!.from - flush!.from).toBeGreaterThan(10);
    // A price too wide to share a line with the word either side of it isn't split: "Buy", "100 USD", "today".
    const price = await lines(<Text>{`Buy 100${NBSP}USD today`}</Text>, 160);
    const [whole] = await lines(<Text>{`100${NBSP}USD`}</Text>);
    expect(price).toHaveLength(3);
    expect(Math.abs(price[1]!.to - price[1]!.from - (whole!.to - whole!.from))).toBeLessThan(2);
    // The narrow one (U+202F, in a French number as Intl writes it) reaches the engine as it was written too.
    const amount = `1\u202f234,50${NBSP}\u20ac`;
    expect(said(drawn(<Text>{amount}</Text>)[0]!.runs!)).toBe(amount);
  });

  it("draws nothing for a Span that holds nothing: the space after it is the block's edge, or the one space between two words", async () => {
    // A value that came empty, as a template's data gives one.
    const title = "";
    // At the block's start the space after it goes, as at any block's start: the words are drawn where they are
    // without it (left in, the space would be a run of its own, a line the words no longer fit beside, and they
    // would be drawn on the line under it).
    const fits = await lines(<Text>Hello world</Text>, 160);
    const after = await lines(<Text><Span>{title}</Span> Hello world</Text>, 160);
    expect(fits).toHaveLength(1);
    expect(after).toHaveLength(1);
    for (const edge of ["from", "to", "top"] as const) expect(Math.abs(after[0]![edge] - fits[0]![edge]), edge).toBeLessThan(1);
    // A Span that holds only a space is the same edge.
    expect(said(drawn(<Text><Span> </Span> Hello world</Text>)[0]!.runs!)).toBe("Hello world");
    expect(said(drawn(<Text>Hello world <Span> </Span></Text>)[0]!.runs!)).toBe("Hello world");

    // Between two words, the space before it and the space after it are one space, as white space collapses across
    // a Span's edge in the HTML outputs: so are a space ending one run and a space starting the next.
    const plain = await width(<Text>Hello world and more</Text>);
    for (const children of [
      <>Hello <Span>{title}</Span> world and more</>,
      <>Hello <Span style={{ color: "#ff0000" }}> world</Span> and more</>,
      <>Hello <Span style={{ color: "#ff0000" }}>world </Span> and more</>,
      <>Hello <Link href="https://x.test"> world</Link> and more</>,
    ]) {
      expect(said(drawn(<Text>{children}</Text>)[0]!.runs!)).toBe("Hello world and more");
      expect(Math.abs((await width(<Text>{children}</Text>)) - plain)).toBeLessThan(2);
    }
  });

  it("ends a right-aligned line at the margin where the words wrap beside a Span or a Link", async () => {
    // Each run is a flex item, and a space ending a run is part of the width of the line that run ends. At the left
    // that end is ragged; at the right it would hold the line a space short of the margin, so there the space
    // between two runs starts the second, where it's a line's start that is ragged.
    const right = { textAlign: "right" } as const;
    const margin = 280; // a 300px Canvas, 20px of padding
    // (A letter's own side bearing leaves a line a pixel or two inside the margin; a space here is 6.7px.)
    for (const line of await lines(<Text style={right}>A line that wraps with a red run and then more words</Text>, 300)) expect(margin - line.to).toBeLessThan(3.5);
    for (const run of [<Span style={{ color: "#ff0000" }}>red run</Span>, <Link href="https://x.test">red run</Link>]) {
      const wrapped = await lines(<Text style={right}>A line that wraps with a {run} and then more words</Text>, 300);
      expect(wrapped.length).toBeGreaterThan(1);
      for (const line of wrapped) expect(margin - line.to, JSON.stringify(wrapped)).toBeLessThan(3.5);
    }

    // What the writer gives the engine: no run but the last ends with a space, and the words are spaced the same.
    const ends = (run: Run): boolean => {
      if (typeof run === "string") return run.endsWith(" ");
      const last = run.runs?.[run.runs.length - 1];
      return run.kind === "span" && last !== undefined && ends(last);
    };
    for (const children of [
      <>Hello <Span style={{ color: "#ff0000" }}>world</Span> and more</>,
      <>Hello<Span style={{ color: "#ff0000" }}> world </Span>and more</>,
      <>Hello <Link href="https://x.test"> world</Link> and more</>,
    ]) {
      const runs = drawn(<Text style={right}>{children}</Text>)[0]!.runs!;
      expect(said(runs)).toBe("Hello world and more");
      expect(runs.slice(0, -1).filter(ends)).toEqual([]);
    }

    // Of two spaces that collapse the first is the one kept, as in the HTML outputs: before a Link that starts with
    // a space of its own, that's the space outside it. Whichever run holds it, the Link's underline is under its
    // word alone (the space is in a run of its own inside the Link, which the underline doesn't reach).
    for (const style of [{}, right]) {
      const link = drawn(<Text style={style}>Hello <Link href="https://x.test"> world</Link> and more</Text>)[0]!.runs![1] as { runs: Run[] };
      expect(link.runs.filter((run) => typeof run === "string"), JSON.stringify(link)).toEqual(["world"]);
    }
  });

  it("spaces the words inside a Span or a Link that holds another as it spaces a block's own", async () => {
    // The runs inside a Span are flex items too: a space on both sides of an edge inside one is one space, and the
    // space between two of them is held by one of the two, as between a block's own runs.
    const plain = await width(<Text>Hello world and more</Text>);
    for (const children of [
      <Span>Hello <Span style={{ color: "#ff0000" }}> world</Span> and more</Span>,
      <Span>Hello<Span style={{ color: "#ff0000" }}> world </Span>and more</Span>,
      <Link href="https://x.test">Hello <Span style={{ color: "#ff0000" }}>world </Span> and more</Link>,
    ]) {
      for (const style of [{}, { textAlign: "right" } as const]) {
        const what = JSON.stringify(drawn(<Text style={style}>{children}</Text>)[0]!.runs);
        expect(said(drawn(<Text style={style}>{children}</Text>)[0]!.runs!), what).toBe("Hello world and more");
        expect(Math.abs((await width(<Text style={style}>{children}</Text>)) - plain), what).toBeLessThan(2);
      }
    }
  });

  it("highlights a Span under its letters alone, not under the space held with it", async () => {
    // The space between a Span and the words after it is held with the Span (before it, in a block aligned at the
    // right), and a background fills a Span's whole box: the highlight would run under that space too, on that one
    // side. Each run the Span held is filled instead, and the space beside them isn't.
    const mark = { backgroundColor: "#ffff00" };
    /** Where the highlight is across the Canvas: the left of its first box and the right of its last. */
    const highlighted = async (children: ReactNode, width = 400) => {
      const template = (
        <Canvas width={width} height={240} style={{ padding: 20, fontFamily: "Liberation Sans", fontSize: 24 }}>
          {children}
        </Canvas>
      );
      const svg = new TextDecoder().decode((await renderImage(template, { fonts, format: "svg" })).image);
      const boxes = [...svg.matchAll(/<rect\b[^>]*>/g)]
        .map((rect) => rect[0])
        .filter((rect) => /fill="#ffff00"/i.test(rect))
        .map((rect) => {
          const left = Number(/\bx="([\d.]+)"/.exec(rect)?.[1]);
          return [left, left + Number(/\bwidth="([\d.]+)"/.exec(rect)?.[1])] as const;
        });
      expect(boxes.length).toBeGreaterThan(0);
      return { from: Math.min(...boxes.map((box) => box[0])), to: Math.max(...boxes.map((box) => box[1])) };
    };
    const alone = await highlighted(<Text><Span style={mark}>our site</Span></Text>);
    const letters = alone.to - alone.from;
    expect(letters).toBeGreaterThan(50);
    for (const style of [{}, { textAlign: "right" } as const]) {
      const box = await highlighted(<Text style={style}>See <Span style={mark}>our site</Span> today</Text>);
      // (A space here is 6.7px.)
      expect(Math.abs(box.to - box.from - letters), JSON.stringify([style, box])).toBeLessThan(1);
    }
    // The words are spaced as they are with no highlight.
    const plain = await width(<Text>See our site today</Text>);
    expect(Math.abs((await width(<Text>See <Span style={mark}>our site</Span> today</Text>)) - plain)).toBeLessThan(2);
    expect(said(drawn(<Text>See <Span style={{ ...mark, textDecoration: "underline" }}>our site</Span> today</Text>)[0]!.runs!)).toBe("See our site today");
    // A space the Span itself holds between its words is the Span's, and highlighted with them.
    const whole = await highlighted(<Text><Span style={mark}>See <Link href="https://x.test">our site</Link> today</Span> and more</Text>);
    expect(Math.abs(whole.to - whole.from - plain)).toBeLessThan(4);

    // A highlight moves no letter: a Span that holds several runs, on a line too narrow for them, is laid out as the
    // same Span is without one (given to one run holding the rest, the background had them sized another way, and
    // the last word pushed past the Canvas's edge), and a line break among its words still breaks the line (the
    // words either side of it boxed apart, it broke nothing).
    const shapes = [
      (style: Record<string, string>) => (
        <Text>
          See <Span style={style}>our <Span style={{ color: "#ff0000" }}>lovely site</Span> today</Span> again
        </Text>
      ),
      (style: Record<string, string>) => (
        <Text>
          See <Span style={style}>our<LineBreak />site</Span> today
        </Text>
      ),
    ];
    for (const [shape, text] of shapes.entries()) {
      for (const canvas of [200, 260, 400]) {
        const marked = await lines(text(mark), canvas);
        const unmarked = await lines(text({ color: "#000000" }), canvas);
        expect(marked, `shape ${shape}, ${canvas}px`).toHaveLength(unmarked.length);
        for (const [i, line] of marked.entries()) {
          for (const edge of ["from", "to", "top"] as const) expect(Math.abs(line[edge] - unmarked[i]![edge]), `shape ${shape}, ${canvas}px, line ${i}, ${edge}`).toBeLessThan(2);
          expect(line.to, `shape ${shape}, ${canvas}px, line ${i}`).toBeLessThanOrEqual(canvas - 20);
        }
      }
    }
    expect(await lines(shapes[1]!(mark), 400)).toHaveLength(2);
  });

  it("writes a Canvas only", async () => {
    await expect(
      renderImage(
        <Email>
          <Column>
            <Text>Hi</Text>
          </Column>
        </Email>,
        { fonts }
      )
    ).rejects.toMatchObject({ diagnostics: [expect.objectContaining({ code: "image/root" })] });
  });
});

describe("templateAssets", () => {
  const liberation = (name: string) => readFileSync(join(dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json")), "standard_fonts", name));
  const PNG_URI = `data:image/png;base64,${Buffer.from(PNG).toString("base64")}`;
  const ITALIC_URI = `data:font/ttf;base64,${liberation("LiberationSans-Italic.ttf").toString("base64")}`;
  // Each source the template names, as a tool would load it: a font's file, or an image's (a data: URI, decoded).
  const files: Record<string, Uint8Array> = {
    "https://fonts.acme.test/brand.ttf": FONT,
    "fonts/brand-bold.ttf": liberation("LiberationSans-Bold.ttf"),
    "https://cdn.acme.test/photo.png": PNG,
    "/hero.png": PNG,
  };
  const load = (src: string) => (src.startsWith("data:") ? Uint8Array.from(Buffer.from(src.slice(src.indexOf(",") + 1), "base64")) : files[src]);
  const template = (
    <Canvas
      width={400}
      height={300}
      fonts={[
        { family: "Brand", src: "https://fonts.acme.test/brand.ttf", weight: 400 },
        { family: "Brand", src: "fonts/brand-bold.ttf", weight: 700 },
        { family: "Variable", src: ITALIC_URI, weight: [100, 900] },
      ]}
      style={{ fontFamily: "Brand", gap: 8 }}
    >
      <Text>Regular</Text>
      <Text style={{ fontWeight: 700 }}>Bold</Text>
      <Text style={{ fontFamily: "Variable", fontWeight: 100 }}>Variable</Text>
      <Row>
        <Column>
          <Image src={{ src: "https://cdn.acme.test/photo.png", width: 20, height: 20 }} alt="Photo" />
        </Column>
        <Column>
          <Image src={{ src: "/hero.png", width: 20, height: 20 }} alt="Hero" />
          <Image src={{ src: "https://cdn.acme.test/photo.png", width: 20, height: 20 }} alt="Photo again" />
          <Image src={{ src: PNG_URI, width: 20, height: 20 }} alt="Inline" />
        </Column>
      </Row>
      <Video src="https://www.youtube.com/watch?v=dQw4w9WgXcQ" title="Our launch" />
    </Canvas>
  );

  it("lists the sources renderImage() looks for: the Canvas's fonts and each Image once (a Video is drawn as its title, with no thumbnail)", () => {
    expect(templateAssets(template)).toEqual({
      fonts: [
        { family: "Brand", src: "https://fonts.acme.test/brand.ttf", weight: 400 },
        { family: "Brand", src: "fonts/brand-bold.ttf", weight: 700 },
        { family: "Variable", src: ITALIC_URI, weight: [100, 900] },
      ],
      images: ["https://cdn.acme.test/photo.png", "/hero.png", PNG_URI],
    });
    expect(
      templateAssets(
        <Canvas width={200} height={100}>
          <Text>Hi</Text>
        </Canvas>
      )
    ).toEqual({ fonts: [], images: [] });
  });

  it("is all renderImage() needs: given exactly what it lists, it says nothing of a font or an image", async () => {
    const { fonts: faces, images } = templateAssets(template);
    const { image, diagnostics } = await renderImage(template, {
      // A range's lower bound, as a font given for it.
      fonts: faces.map((face) => ({ family: face.family, src: load(face.src), weight: Array.isArray(face.weight) ? face.weight[0] : face.weight, style: face.style })),
      images: Object.fromEntries(images.filter((src) => !src.startsWith("data:")).map((src) => [src, load(src)])),
    });
    expect(diagnostics.filter((d) => ["image/font", "image/image", "image/font-weight"].includes(d.code))).toEqual([]);
    expect(size(image)).toEqual([400, 300]);
  });

  it("rejects a template as renderImage() does", () => {
    const email = (
      <Email>
        <Column>
          <Text>Hi</Text>
        </Column>
      </Email>
    );
    expect(() => templateAssets(email)).toThrow(expect.objectContaining({ diagnostics: [expect.objectContaining({ code: "image/root" })] }));
  });
});
