/**
 * Fitting text in a Canvas (Decision 10), measured where the fonts are: the largest of a node's sizes at which its
 * lines, its widest word and its fixed-height ancestors fit; layoutImage()'s nodes and fits (Decision 18); strict
 * (Decision 19); and a template's checkLayout() over a measured layout.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Canvas, Column, defineTheme, Email, Heading, Image, Layer, LineBreak, Link, List, ListItem, MergeTag, Span, Table, TableCell, TableRow, Text, prop, validate } from "@hyper-elements/react";
import type { ReactElement } from "react";
import { layoutImage, renderImage } from "../../src/image";
import { checkLayout, field, template } from "../../src/template";

const STANDARD = join(dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json")), "standard_fonts");
const fonts = [
  { family: "Liberation Sans", src: readFileSync(join(STANDARD, "LiberationSans-Regular.ttf")) },
  { family: "Liberation Sans", src: readFileSync(join(STANDARD, "LiberationSans-Bold.ttf")), weight: 700 },
];
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
const codes = (diagnostics: Array<{ code: string; severity: string }>, severity = "error") => diagnostics.filter((d) => d.severity === severity).map((d) => d.code);

const HEADLINE = "Meet Orbit: release notes that write themselves, from every pull request you merge";
const canvas = (children: ReactElement | ReactElement[], width = 1080, height = 1080) => (
  <Canvas width={width} height={height} style={{ fontFamily: "Liberation Sans", padding: 64 }}>
    <Column style={{ width: 952 }}>{children}</Column>
  </Canvas>
);
const headline = (fit: object, extra: object = {}) => canvas(<Heading level={1} fit={fit as never} style={{ lineHeight: 1.1, ...extra }}>{HEADLINE}</Heading>);
const HEADING = "root.children[0].children[0]";

describe("fit", () => {
  it("draws the largest size that fits, and a range is the same as its list", async () => {
    const listed = await layoutImage(headline({ sizes: [88, 76, 64, 56], maxLines: 3 }), { fonts });
    const [fit] = listed.fits;
    expect(fit.path).toBe(HEADING);
    expect(fit.chosen).toBe(fit.sizes[0]);
    expect(fit.sizes.length).toBeGreaterThan(0);
    expect(listed.nodes.find((n) => n.path === HEADING)?.fontSize).toBe(fit.chosen);
    const ranged = await layoutImage(headline({ sizes: { min: 56, max: 88, step: 4 }, maxLines: 3 }), { fonts });
    const all = await layoutImage(headline({ sizes: [88, 84, 80, 76, 72, 68, 64, 60, 56], maxLines: 3 }), { fonts });
    expect(ranged.fits).toEqual(all.fits);
  });

  it("isn't said to be degraded where it's measured: the image's diagnostics don't repeat the HTML preview's", async () => {
    const design = headline({ sizes: [88, 76, 64], maxLines: 3 });
    const preview = (d: { code: string; path: string }) => d.code === "web/degraded" && d.path.endsWith(".props.fit");
    expect(validate(design).diagnostics.some(preview)).toBe(true);
    expect((await layoutImage(design, { fonts })).diagnostics.some(preview)).toBe(false);
    expect((await renderImage(design, { fonts })).diagnostics.some(preview)).toBe(false);
  });

  it("reports the range that fits as drawing shows it: each size in it fits, and the next one doesn't", async () => {
    const sizes = [96, 88, 80, 72, 64, 56, 48];
    const { fits } = await layoutImage(headline({ sizes, maxLines: 3 }), { fonts });
    const [fit] = fits;
    const linesAt = async (size: number) => (await layoutImage(canvas(<Heading level={1} style={{ fontSize: size, lineHeight: 1.1 }}>{HEADLINE}</Heading>), { fonts })).nodes.find((n) => n.path === HEADING)!.lines!;
    for (const size of fit.sizes) expect(await linesAt(size), `${size}px`).toBeLessThanOrEqual(3);
    expect(fit.next).toBeDefined();
    expect(await linesAt(fit.next!.size)).toBeGreaterThan(3);
    expect(fit.next!.lines).toBe(await linesAt(fit.next!.size));
  });

  it("with only maxLines, checks the node's own size", async () => {
    const fits = (await layoutImage(headline({ maxLines: 2 }, { fontSize: 88 }), { fonts })).fits;
    expect(fits[0].chosen).toBeNull();
    expect(codes((await layoutImage(headline({ maxLines: 9 }, { fontSize: 40 }), { fonts })).diagnostics)).toEqual([]);
  });

  it("counts a padded, bordered Text's lines from its content height", async () => {
    const padded = canvas(<Text fit={{ maxLines: 2 }} style={{ fontSize: 30, lineHeight: 1.3, padding: [20, 24], border: { width: 3, style: "solid", color: "#000000" } }}>Two lines of words, at most, in this box</Text>);
    const { nodes, diagnostics } = await layoutImage(padded, { fonts });
    expect(nodes.find((n) => n.path === HEADING)?.lines).toBe(1);
    expect(codes(diagnostics)).toEqual([]);
  });

  it("fails a size where one word is wider than the content width, though the node's box doesn't show it", async () => {
    const word = "Donaudampfschifffahrtsgesellschaftskapitän";
    const at = (width: number) => (
      <Canvas width={1200} height={400} style={{ fontFamily: "Liberation Sans" }}>
        <Column style={{ width }}>
          <Text fit={{ sizes: [40, 30, 20] }} style={{ padding: 10, border: { width: 2, style: "solid", color: "#000000" } }}>{word}</Text>
        </Column>
      </Canvas>
    );
    const wide = (await layoutImage(at(1200), { fonts })).fits[0];
    expect(wide.chosen).toBe(40);
    const narrow = (await layoutImage(at(500), { fonts })).fits[0];
    expect(narrow.chosen).toBeLessThan(40);
    expect(narrow.next?.widestWord).toBe(word);
  });

  it("allows runs in the node's own style; a Span at another size is fit/inline", async () => {
    const same = canvas(
      <Heading level={1} fit={{ sizes: [72, 48], maxLines: 3 }}>
        Meet <Span style={{ color: "#7c5cff" }}>Orbit</Span>, <Link href="https://acme.com">release notes</Link>
        <LineBreak />
        for <MergeTag name="first_name" />
      </Heading>
    );
    expect(codes((await layoutImage(same, { fonts })).diagnostics)).toEqual([]);
    const mixed = canvas(<Heading level={1} fit={{ sizes: [72, 48], maxLines: 3 }}>Meet <Span style={{ fontSize: 20 }}>Orbit</Span></Heading>);
    expect(codes((await layoutImage(mixed, { fonts })).diagnostics)).toEqual(["fit/inline"]);
  });

  it("takes maxLines beside an authored fontSize, and refuses sizes beside one (style/fit)", async () => {
    expect(validate(headline({ maxLines: 2 }, { fontSize: 40 })).valid).toBe(true);
    expect(codes(validate(headline({ sizes: [40, 30] }, { fontSize: 40 })).diagnostics)).toEqual(["style/fit"]);
    // A size the theme gives the element isn't one written beside fit: the sizes replace it, in every entry point.
    const themed = (style: object = {}) => (
      <Canvas width={600} height={300} theme={defineTheme({ elements: { Heading: { fontSize: 44, by: { level: { 1: { fontSize: 40 } } } } } })} style={{ fontFamily: "Liberation Sans", padding: 20 }}>
        <Heading level={1} fit={{ sizes: [48, 32, 24], maxLines: 2 }} style={style}>A headline that takes two lines at its largest size</Heading>
      </Canvas>
    );
    expect(codes(validate(themed()).diagnostics)).toEqual([]);
    const laid = await layoutImage(themed(), { fonts });
    expect([codes(laid.diagnostics), [48, 32, 24].includes(laid.fits[0].chosen as number)]).toEqual([[], true]);
    expect(codes(validate(themed({ fontSize: 40 })).diagnostics)).toEqual(["style/fit"]);
  });

  it("is image/fit where no size fits, naming the lines and roughly what to cut", async () => {
    const tight = headline({ sizes: [88, 76], maxLines: 1 });
    const { diagnostics } = await layoutImage(tight, { fonts });
    const found = diagnostics.find((d) => d.code === "image/fit")!;
    expect(found.message).toMatch(/takes \d+ lines at 76px, its smallest size, and fits 1: cut about \d+ characters/);
    await expect(renderImage(tight, { fonts })).rejects.toThrow(/image\/fit/);
  });

  it("keeps the content of a fixed-height parent inside it", async () => {
    const boxed = (
      <Canvas width={1080} height={1080} style={{ fontFamily: "Liberation Sans", padding: 64 }}>
        <Column style={{ width: 952, height: 200 }}>
          <Heading level={1} fit={{ sizes: [88, 64, 48, 32] }} style={{ lineHeight: 1.1 }}>{HEADLINE}</Heading>
        </Column>
      </Canvas>
    );
    const [fit] = (await layoutImage(boxed, { fonts })).fits;
    const free = (await layoutImage(headline({ sizes: [88, 64, 48, 32] }), { fonts })).fits[0];
    expect(free.chosen).toBe(88);
    expect(fit.chosen).toBeLessThan(88);
  });

  it("fits two nodes in document order, and draws the same bytes for the same input", async () => {
    const two = canvas([
      <Heading key="a" level={1} fit={{ sizes: [88, 64, 48, 32], maxLines: 2 }} style={{ lineHeight: 1.1 }}>{HEADLINE}</Heading>,
      <Text key="b" fit={{ sizes: [40, 32, 24], maxLines: 2 }}>{HEADLINE}</Text>,
    ]);
    const { fits } = await layoutImage(two, { fonts });
    expect(fits.map((f) => f.path)).toEqual(["root.children[0].children[0]", "root.children[0].children[1]"]);
    const a = await renderImage(two, { fonts });
    const b = await renderImage(two, { fonts });
    expect(Buffer.from(a.image).equals(Buffer.from(b.image))).toBe(true);
  });

  it("tries a node with the fitted nodes after it at their smallest: one that can still shrink isn't why it doesn't fit", async () => {
    const PARAGRAPH = "Orbit reads every pull request you merge and drafts the release notes for you, in your voice, with the changes that matter to the people who use what you ship, grouped by what they do and not by who wrote them.";
    const card = (
      <Canvas width={1000} height={400} style={{ fontFamily: "Liberation Sans", padding: 20 }}>
        <Column style={{ height: 300, width: 900 }}>
          <Heading fit={{ sizes: [60, 40] }}>Short title</Heading>
          <Text fit={{ sizes: [40, 16] }}>{PARAGRAPH}</Text>
        </Column>
      </Canvas>
    );
    const { fits, diagnostics } = await layoutImage(card, { fonts, strict: true });
    expect(codes(diagnostics)).toEqual([]);
    // The Heading takes its largest size, which the Text at 16px leaves room for; the Text then takes what's left.
    expect(fits.map((f) => f.chosen)).toEqual([60, 16]);
  });

  it("measures the pieces a line can't break, as the engine breaks lines: not at a no-break space, between Chinese or Japanese characters", async () => {
    const column = (heading: ReactElement, width: number) => (
      <Canvas width={800} height={600} style={{ fontFamily: "Liberation Sans", padding: 20 }}>
        <Column style={{ width }}>{heading}</Column>
      </Canvas>
    );
    // "10 000 000 EUR" held together by no-break spaces is one piece, 296px wide at 40px: too wide for 300px at 60px.
    const held = await layoutImage(column(<Heading fit={{ sizes: [60, 40, 20] }}>{"Save 10\u00a0000\u00a0000\u00a0EUR today"}</Heading>, 300), { fonts, strict: true });
    expect([codes(held.diagnostics), held.fits[0].chosen]).toEqual([[], 40]);
    // With spaces a line breaks at, each number is a piece, and the largest size fits.
    const spaced = await layoutImage(column(<Heading fit={{ sizes: [60, 40, 20] }}>Save 10 000 000 EUR today</Heading>, 300), { fonts, strict: true });
    expect(spaced.fits[0].chosen).toBe(60);
    // A sentence with no spaces wraps between its characters: it fits on lines, and isn't one word too wide for its box.
    const sentence = await layoutImage(column(<Heading fit={{ sizes: [48, 36, 24], maxLines: 3 }}>我们很高兴地宣布全新的发布说明功能现已上线每次发布都保持你的语气</Heading>, 560), { fonts });
    expect([codes(sentence.diagnostics).filter((code) => code === "image/fit"), sentence.fits[0].chosen !== null]).toEqual([[], true]);
    // One piece too wide at every size is still said, by name.
    const long = await layoutImage(column(<Heading fit={{ sizes: [60, 40] }}>{"Save 10\u00a0000\u00a0000\u00a0EUR today"}</Heading>, 200), { fonts });
    expect(long.diagnostics.find((d) => d.code === "image/fit")?.message).toContain('"10\u00a0000\u00a0000\u00a0EUR" is wider than its 200px even at 40px');
  });
});

describe("strict", () => {
  const overflowing = (
    <Canvas width={300} height={80} fonts={[{ family: "Missing", src: "https://fonts.test/missing.woff2" }]} style={{ fontFamily: "Liberation Sans" }}>
      <Text style={{ fontWeight: 700 as never }}>Bold, in a weight given</Text>
      {Array.from({ length: 6 }, (_, i) => <Text key={i}>Line {i}</Text>)}
    </Canvas>
  );

  it("turns image/font, image/font-weight and image/overflow into errors; without it they're warnings", async () => {
    const lenient = await renderImage(overflowing, { fonts: [fonts[0]] });
    expect(codes(lenient.diagnostics, "warning")).toEqual(expect.arrayContaining(["image/font", "image/font-weight", "image/overflow"]));
    await expect(renderImage(overflowing, { fonts: [fonts[0]], strict: true })).rejects.toMatchObject({
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: "image/font", severity: "error" }), expect.objectContaining({ code: "image/font-weight", severity: "error" }), expect.objectContaining({ code: "image/overflow", severity: "error" })]),
    });
  });

  it("refuses text whose family isn't given, naming the node; without it, draws it in the first font as before", async () => {
    const other = (
      <Canvas width={400} height={100} style={{ fontFamily: "Liberation Sans" }}>
        <Text style={{ fontFamily: "Georgia, serif" }}>Not given</Text>
      </Canvas>
    );
    expect(codes((await renderImage(other, { fonts })).diagnostics, "warning")).toEqual([]);
    await expect(renderImage(other, { fonts, strict: true })).rejects.toMatchObject({ diagnostics: [expect.objectContaining({ code: "image/font", path: "root.children[0]" })] });
  });
});

describe("layoutImage()'s nodes", () => {
  it("has one entry per node, from its own block, for a List, a Table and a Layer, whose writer adds blocks", async () => {
    const design = (
      <Canvas width={600} height={600} style={{ fontFamily: "Liberation Sans" }}>
        <List><ListItem>One</ListItem><ListItem>Two</ListItem></List>
        <Table><TableRow><TableCell>a</TableCell><TableCell>b</TableCell></TableRow></Table>
        <Layer style={{ width: 200, height: 100 }}><Image src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" alt="" /><Text>Over</Text></Layer>
      </Canvas>
    );
    const { nodes } = await layoutImage(design, { fonts });
    const paths = nodes.map((n) => `${n.type}:${n.path}`);
    expect(paths).toEqual(expect.arrayContaining(["List:root.children[0]", "ListItem:root.children[0].children[0]", "Table:root.children[1]", "TableRow:root.children[1].children[0]", "TableCell:root.children[1].children[0].children[0]", "Layer:root.children[2]", "Image:root.children[2].children[0]", "Text:root.children[2].children[1]"]));
    expect(new Set(nodes.map((n) => n.path)).size).toBe(nodes.length);
  });

  it("gives a Text with runs and an inline Image entries for the Text and the Image only, with a Span's field on the Text", async () => {
    const design = (
      <Canvas width={600} height={300} style={{ fontFamily: "Liberation Sans" }}>
        <Text>
          A <Span field="name">run</Span>, <Link href="https://acme.com">a link</Link>
          <LineBreak />
          <MergeTag name="x" /> <Image src={{ src: "https://img.test/i.png", width: 20, height: 20 }} alt="" style={{ width: 20 }} />
        </Text>
      </Canvas>
    );
    const { nodes } = await layoutImage(design, { fonts, images: { "https://img.test/i.png": PNG } });
    expect(nodes.map((n) => n.type)).toEqual(["Canvas", "Text", "Image"]);
    expect(nodes[1].fields).toEqual(["name"]);
  });
});

describe("a template's checkLayout()", () => {
  const Card = template({
    id: "acme.Card",
    version: "1.0.0",
    label: "Card",
    root: "Canvas",
    formats: { square: { width: 600, height: 600, scale: 2 } },
    fields: {
      title: prop.text({ label: "Title", required: true }),
      size: prop.number({ label: "Size", min: 24, max: 72, default: 72 }),
      photo: field.image({ label: "Photo", required: true, fit: "contain" }),
    },
    rules: { require: { core: ["image/overflow"] } },
    example: { title: "Hi", photo: { src: "https://img.test/p.png", width: 400, height: 400 } },
    render: (v) => (
      <Canvas width={600} height={600} style={{ fontFamily: "Liberation Sans", padding: 20, gap: 10 }}>
        <Heading field="title" fit={{ sizes: { min: 24, max: v.size, step: 8 }, maxLines: 2 }}>{v.title}</Heading>
        <Image field="photo" src={v.photo} alt="" style={{ width: 200 }} />
      </Canvas>
    ),
  });
  const images = { "https://img.test/p.png": PNG };

  it("steps down from the size a number field gives", async () => {
    const checked = Card.check({ ...Card.example, size: 40 });
    const { fits } = await layoutImage(checked.snapshots.square!, { fonts, images });
    expect(fits[0]).toMatchObject({ field: "title", chosen: 40 });
  });

  it("makes a 400px asset in a 200px region template/asset-pixels at scale 4, and passes at the format's 2", async () => {
    const checked = Card.check(Card.example);
    const layout = await layoutImage(checked.snapshots.square!, { fonts, images, scale: 2 });
    expect(checkLayout(Card, checked.values, { format: "square", layout }).diagnostics).toEqual([]);
    expect(checkLayout(Card, checked.values, { format: "square", scale: 4, layout }).diagnostics.map((d) => d.code)).toEqual(["template/asset-pixels"]);
    expect(checkLayout(Card, checked.values, { format: "square", layout }).regions.photo.square).toEqual({ box: [200, 200], pixels: [400, 400] });
  });

  it("decides a required image/overflow by format, and leaves the read-stage entries as they were", async () => {
    const checked = Card.check(Card.example);
    expect(checked.rules.map((r) => [r.rule, r.status])).toEqual([["image/overflow", "not-run"]]);
    const layout = await layoutImage(checked.snapshots.square!, { fonts, images });
    const decided = checkLayout(Card, checked.values, { format: "square", layout, checked });
    expect(decided.rules.map((r) => [r.rule, r.status])).toEqual([["image/overflow", "passed"]]);
  });

  it("checks a file's sniffed facts against the declared size and the rules", async () => {
    const checked = Card.check(Card.example);
    const layout = await layoutImage(checked.snapshots.square!, { fonts, images });
    const found = checkLayout(Card, checked.values, { format: "square", layout, files: { photo: { width: 300, height: 300, type: "png", alpha: false } } });
    // The file is 300px, not the 400px declared, and its region needs 400px at the format's scale.
    expect(found.diagnostics.map((d) => d.code)).toEqual(["template/asset-size", "template/asset-pixels"]);
  });

  it("reads an image's region from the template's own node, never from a slot's content that names its field", async () => {
    const Slotted = template({
      id: "acme.Slotted",
      version: "1.0.0",
      label: "Slotted",
      root: "Canvas",
      fields: {
        note: field.slot({ label: "Note", allow: [Column, Text, Image], styles: "free" }),
        photo: field.image({ label: "Photo", required: true, fit: "contain" }),
      },
      example: { photo: { src: "https://img.test/p.png", width: 100, height: 100 } },
      render: (v) => (
        <Canvas width={600} height={600} style={{ fontFamily: "Liberation Sans", padding: 20, gap: 10 }}>
          <Column field="note">{v.note}</Column>
          <Image field="photo" src={v.photo} alt="" style={{ width: 400 }} />
        </Canvas>
      ),
    });
    const measured = async (note?: ReactElement) => {
      const checked = Slotted.check({ ...Slotted.example, ...(note ? { note } : {}) });
      expect(codes(checked.diagnostics)).toEqual([]);
      return checkLayout(Slotted, checked.values, { layout: await layoutImage(checked.snapshots.default!, { fonts, images }) });
    };
    // A 100px file in a 400px region is upscaled, whatever the slot holds.
    expect((await measured()).diagnostics.map((d) => d.code)).toEqual(["template/asset-pixels"]);
    const claimed = await measured(<Image field="photo" src={{ src: "https://img.test/p.png", width: 100, height: 100 }} alt="" style={{ width: 10 }} />);
    expect(claimed.diagnostics.map((d) => d.code)).toEqual(["template/asset-pixels"]);
    expect(claimed.regions.photo.default).toEqual({ box: [400, 400], pixels: [400, 400] });
    expect(Slotted.describe().fields.find((f) => f.path === "photo")).toMatchObject({ path: "photo" });
  });

  it("says what only an image's file decides until the file is given, and then decides it", async () => {
    const Logo = template({
      id: "acme.Logo",
      version: "1.0.0",
      label: "Logo",
      root: "Email",
      fields: { logo: field.image({ label: "Logo", required: true, transparent: "required", accepts: ["png"] }) },
      example: { logo: { src: "https://img.test/logo.png", width: 600, height: 200 } },
      render: (v) => (
        <Email lang="en" previewText="A logo, shown whole on a white ground, for a test">
          <Image field="logo" src={v.logo} alt="Acme" />
        </Email>
      ),
    });
    const unread = (values: object) => Logo.check(values).diagnostics.filter((d) => d.code === "template/asset-unread").map((d) => [d.severity, d.path, d.message.replace(/ (is|are) told.*/, "")]);
    // Its type is in its name; whether it's transparent isn't.
    expect(unread(Logo.example)).toEqual([["info", "values.logo", "Logo: whether it's transparent"]]);
    expect(unread({ logo: { src: "https://img.test/9f3a", width: 600, height: 200 } })).toEqual([["info", "values.logo", "Logo: whether it's transparent and its type"]]);
    expect(Logo.check(Logo.example).valid).toBe(true);
    const empty = { nodes: [], fits: [], diagnostics: [] };
    const opaque = checkLayout(Logo, Logo.example, { layout: empty, files: { logo: { width: 600, height: 200, type: "jpeg", alpha: false } } });
    expect(opaque.diagnostics.map((d) => d.code)).toEqual(["template/asset-type", "template/asset-alpha"]);
    expect(checkLayout(Logo, Logo.example, { layout: empty, files: { logo: { width: 600, height: 200, type: "png", alpha: true } } }).diagnostics).toEqual([]);
  });
});
