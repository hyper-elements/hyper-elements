/**
 * Box and a Page's styles (Phase 3 of the themes and pages plan; Decisions 5–7 and 19): Boxes with the existing
 * layout components, sizes from the base sample, what the writers keep as today, and what goes to the builder.
 */
import type { ReactElement } from "react";
import { describeComponents } from "@unlayer-internal/elements-core";
import { toDesign } from "../../src/builder";
import { Box, Button, Canvas, Column, Email, Grid, List, ListItem, Heading, Image, Layer, outline, Page, prepare, render, Row, Section, Span, Table, TableCell, TableRow, Text, validate, type ResolvedNode } from "../../src/primitives";

const photo = { src: "https://example.com/p.png", width: 400, height: 300 };
const find = (node: ResolvedNode, id: string): ResolvedNode | undefined =>
  node.id === id ? node : node.children.flatMap((child) => (typeof child === "string" ? [] : [find(child, id)])).find(Boolean);
const widthOf = (element: ReactElement, id: string) => find(prepare(element).root!, id)!.width;
const errors = (element: ReactElement) => validate(element).diagnostics.filter((d) => d.severity === "error");
/** The `style` attribute of the element whose id is `id`. */
const styleOf = (html: string, id: string) => new RegExp(`id="${id}"[^>]*style="([^"]*)"`).exec(html)?.[1] ?? "";

describe("a Box with the layout components", () => {
  it("holds each, and goes in each, with no error", async () => {
    const inside = (
      <Page width={800}>
        <Box>
          <Section>
            <Text>a</Text>
          </Section>
        </Box>
      </Page>
    );
    // A Section is a band of the Page: not in a Box.
    expect(errors(inside).map((d) => d.code)).toEqual(["children/not-allowed"]);
    const all = (
      <Page width={800}>
        <Box>
          <Row>
            <Column>
              <Box id="in-column">
                <Text>a</Text>
              </Box>
            </Column>
          </Row>
          <Column>
            <Text>b</Text>
          </Column>
          <Grid columns={2}>
            <Box>
              <Text>c</Text>
            </Box>
            <Text>d</Text>
          </Grid>
          <Layer>
            <Image src={photo} alt="" />
            <Box>
              <Text>e</Text>
            </Box>
          </Layer>
        </Box>
        <Section>
          <Box id="in-section">
            <Text>f</Text>
          </Box>
        </Section>
      </Page>
    );
    expect(errors(all)).toEqual([]);
    const { html } = await render(all);
    expect(html).toContain('id="in-column"');
    expect(widthOf(all, "in-section")).toBe(800);
  });

  it("is a Page's only: an Email, a Document and a Canvas lay out with their own components", () => {
    expect(errors(<Email><Box><Text>a</Text></Box></Email>).map((d) => [d.code, d.message])).toEqual([
      ["target/unsupported", "A Box can't be rendered to email: it's a Page's element; an Email is laid out with Section, Row and Column"],
    ]);
  });
});

describe("sizes at the base sample (Decision 19)", () => {
  it("gives a Box directly in a Page the window's width at V0, not the content's", () => {
    // A 600px Page whose phones go to 800px: V0 is 801px, where no phone rule applies.
    const page = (
      <Page width={600} breakpoints={{ mobile: 800 }}>
        <Box id="band" style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
          <Text id="one">a</Text>
          <Text id="two">b</Text>
        </Box>
        <Text id="content">c</Text>
      </Page>
    );
    expect(widthOf(page, "band")).toBe(801);
    // 400.5px each, rounded as Chromium's widths are in the layout gate.
    expect([widthOf(page, "one"), widthOf(page, "two")]).toEqual([401, 401]);
    expect(widthOf(page, "content")).toBe(600);
  });

  it("models grids: fr, px, rem, gaps, spans, repeat() and auto-fill", () => {
    const page = (
      <Page width={1000}>
        <Box style={{ maxWidth: 1000, padding: "0 2rem", display: "grid", gridTemplateColumns: "200px 1fr 2fr", columnGap: "1rem" }}>
          <Text id="fixed">a</Text>
          <Text id="one">b</Text>
          <Text id="two">c</Text>
          <Text id="span" style={{ gridColumn: "span 2" }}>d</Text>
        </Box>
        <Box style={{ maxWidth: 1000, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
          <Text id="cell">a</Text>
          <Text>b</Text>
        </Box>
      </Page>
    );
    // 1000 - 64 padding = 936; 936 - 200 - 32 = 704 for 3fr.
    expect([widthOf(page, "fixed"), widthOf(page, "one"), widthOf(page, "two"), widthOf(page, "span")]).toEqual([200, 235, 469, 451]);
    // Three tracks of at least 300px fit 1000px with 20px gaps: (1000 - 40) / 3.
    expect(widthOf(page, "cell")).toBe(320);
  });

  it("models flex rows: a basis, a share, grow from 0, and leaves what fits its content unknown", () => {
    const page = (
      <Page width={900}>
        <Box style={{ maxWidth: 900, flexDirection: "row", gap: 20 }}>
          <Box id="side" style={{ width: 200 }} />
          <Box id="main" style={{ flex: 1 }} />
        </Box>
        <Box style={{ maxWidth: 900, flexDirection: "row" }}>
          <Box id="fixed" style={{ width: 120, flexShrink: 0 }} />
          <Box id="shrinks" style={{ width: 120 }} />
          <Box id="grows" style={{ flexGrow: 1 }} />
          <Text id="content">its own size</Text>
        </Box>
      </Page>
    );
    expect([widthOf(page, "side"), widthOf(page, "main")]).toEqual([200, 680]);
    // flexGrow from its content's size (CSS's flex-basis auto) depends on it: unknown, as the text's own size is, and so
    // is a width that shrinks (whether the line grows or shrinks depends on the text); one that doesn't keeps it.
    expect([widthOf(page, "fixed"), widthOf(page, "shrinks"), widthOf(page, "grows"), widthOf(page, "content")]).toEqual([120, null, null, null]);
    expect(outline(page)).toContain("Box: fits its content");
  });

  it("doesn't widen a flex: 1 child for its longest word: it gets min-width: 0", async () => {
    const page = (
      <Page width={600}>
        <Box style={{ maxWidth: 600, flexDirection: "row" }}>
          <Text id="long" style={{ flex: 1 }}>
            Supercalifragilisticexpialidociouslylongwordthatdoesnotbreakanywhereatall
          </Text>
          <Text id="other" style={{ flex: 1 }}>
            short
          </Text>
        </Box>
      </Page>
    );
    expect([widthOf(page, "long"), widthOf(page, "other")]).toEqual([300, 300]);
    expect(styleOf((await render(page)).html, "long")).toContain("min-width:0");
  });

  it("keeps an Image in a Box grid at its file's size, up to its column, and writes that size", async () => {
    const page = (
      <Page width={1000}>
        <Box style={{ maxWidth: 1000, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
          <Image id="small" src={{ src: "https://example.com/s.png", width: 120, height: 60 }} alt="" />
          <Image id="big" src={photo} alt="" />
        </Box>
      </Page>
    );
    expect([widthOf(page, "small"), widthOf(page, "big")]).toEqual([120, 250]);
    const { html } = await render(page);
    expect(/id="big"[^>]*>/.exec(html)![0]).toMatch(/max-width:100%/);
  });

  it("evaluates text metrics in rem, em and % against CSS's references, and writes them as written", async () => {
    const page = (
      <Page width={600}>
        <Box id="box" style={{ fontSize: "1.25rem", lineHeight: "1.5em" }}>
          <Text id="em" style={{ fontSize: "2em" }}>
            a
          </Text>
          <Text id="pct" style={{ fontSize: "50%", letterSpacing: "0.1em" }}>
            b
          </Text>
        </Box>
      </Page>
    );
    const root = prepare(page).root!;
    expect(find(root, "box")!.text).toMatchObject({ fontSize: 20, lineHeightPx: 30, authored: { fontSize: "1.25rem", lineHeight: "1.5em" } });
    expect(find(root, "em")!.text).toMatchObject({ fontSize: 40, lineHeight: "30px" });
    expect(find(root, "pct")!.text).toMatchObject({ fontSize: 10, letterSpacing: 1 });
    const { html } = await render(page);
    expect(styleOf(html, "box")).toContain("font-size:1.25rem;line-height:1.5em");
    expect(styleOf(html, "em")).toContain("font-size:2em");
  });
});

describe("fixes from review", () => {
  it("keeps a grid area's name as written, and places the item in it", async () => {
    const page = (
      <Page width={800}>
        <Box style={{ maxWidth: 800, display: "grid", gridTemplateColumns: "200px 1fr", gridTemplateAreas: ["Nav Main"] }}>
          <Box id="main" style={{ gridArea: "Main" }}><Text>a</Text></Box>
          <Box id="nav" style={{ gridArea: "Nav" }}><Text>b</Text></Box>
        </Box>
      </Page>
    );
    expect([widthOf(page, "main"), widthOf(page, "nav")]).toEqual([600, 200]);
    expect(styleOf((await render(page)).html, "main")).toContain("grid-area:Main");
  });

  it("places auto items after one given a column, as CSS's auto-placement does", () => {
    const page = (
      <Page width={800}>
        <Box style={{ maxWidth: 800, display: "grid", gridTemplateColumns: "200px 1fr" }}>
          <Text id="first" style={{ gridColumn: "1" }}>a</Text>
          <Text id="auto">b</Text>
          <Text id="next">c</Text>
        </Box>
      </Page>
    );
    expect([widthOf(page, "first"), widthOf(page, "auto"), widthOf(page, "next")]).toEqual([200, 600, 200]);
  });

  it("lays out flex: 0 as its own size, as it's written", async () => {
    const page = (
      <Page width={600}>
        <Box style={{ maxWidth: 600, flexDirection: "row" }}>
          <Box id="own" style={{ flex: 0, width: 100 }} />
          <Box id="rest" style={{ flex: 1 }} />
        </Box>
      </Page>
    );
    expect([widthOf(page, "own"), widthOf(page, "rest")]).toEqual([100, 500]);
    expect(styleOf((await render(page)).html, "own")).toContain("flex:0 0 auto");
  });

  it("leaves a text block placed with alignSelf to fit its content", () => {
    const page = (
      <Page width={600}>
        <Column>
          <Text id="placed" style={{ alignSelf: "center" }}>short</Text>
          <Text id="fills">full</Text>
        </Column>
      </Page>
    );
    expect([widthOf(page, "placed"), widthOf(page, "fills")]).toEqual([null, 600]);
  });

  it("writes an Image in a Box at its file's size, no wider than its place", async () => {
    const { html } = await render(
      <Page width={1000}>
        <Box style={{ maxWidth: 1000, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
          <Image id="pic" src={photo} alt="" />
        </Box>
      </Page>
    );
    const tag = /<img id="pic"[^>]*>/.exec(html)![0];
    expect(tag).toContain('width="400"');
    expect(tag).toContain('height="300"');
    expect(tag).toMatch(/max-width:100%/);
  });

  it("keeps a Span's raise when it's written as another element", async () => {
    const { html } = await render(
      <Page width={600}>
        <Text>
          Acme<Span id="mark" as="small" style={{ verticalAlign: "super" }}>®</Span>
        </Text>
      </Page>
    );
    expect(/<small id="mark"[^>]*>/.exec(html)![0]).toContain("vertical-align:super");
  });

  it("writes one main: a Box as main anywhere makes the page's own wrapper a div", async () => {
    const { html } = await render(
      <Page width={600}>
        <Box>
          <Box as="main"><Text>a</Text></Box>
        </Box>
      </Page>
    );
    expect(html.match(/<main\b/g)?.length).toBe(1);
  });

  it("gives the builder a Page's rem padding as the px it comes to (said), a radius as CSS, and stretches a locked Box written as main", () => {
    const { design, report } = toDesign(
      <Page width={600}>
        <Section>
          <Row>
            <Column style={{ padding: "1rem 2rem", borderRadius: "0.5rem" }}>
              <Text>a</Text>
            </Column>
          </Row>
        </Section>
        <Box as="main"><Text>b</Text></Box>
      </Page>
    );
    const json = JSON.stringify(design);
    expect(json).not.toContain("NaN");
    expect(json).toContain('"padding":"16px 32px"');
    expect(json).toContain('"borderRadius":"0.5rem"');
    expect(report).toContain("root.children[0].children[0].children[0]: the builder's padding is in px: style.padding is the 16px 32px 16px 32px it comes to in the Page's widest window");
    // The locked Box's page: its wrapper a div (the Box is its main), filling its block.
    const htmls = [...json.matchAll(/"html":"((?:[^"\\]|\\.)*)"/g)].map((m) => JSON.parse(`"${m[1]}"`) as string);
    expect(htmls.find((html) => html.includes("<main"))).toMatch(/<div style="width:100%;/);
  });

  it("describes what a Page takes, narrowed to a Page", () => {
    const width = (root: string) => describeComponents({ root } as never).find((c) => c.type === "Column")!.properties.find((p) => p.path === "style.width")!;
    expect(width("Page").accepts).toContain("rem");
    expect(width("Email").accepts).not.toContain("rem");
    expect(width("Page")).not.toHaveProperty("onPage");
  });
});

describe("what the writers keep as today (Decision 7)", () => {
  it("keeps a Section's padding output when it has a page style too", async () => {
    const plain = await render(<Page width={600}><Section id="s" style={{ padding: 24 }}><Text>a</Text></Section></Page>);
    const styled = await render(<Page width={600}><Section id="s" style={{ padding: 24, boxShadow: "0 1px 2px #000000" }}><Text>a</Text></Section></Page>);
    expect(styleOf(styled.html, "s")).toBe(`${styleOf(plain.html, "s")};box-shadow:0 1px 2px #000000`);
  });

  it("writes a page style after the writer's own declarations: a Column's display wins", async () => {
    const { html } = await render(
      <Page width={600}>
        <Column id="c" style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
          <Text>a</Text>
          <Text>b</Text>
        </Column>
      </Page>
    );
    const style = styleOf(html, "c");
    expect(style.indexOf("display:grid")).toBeGreaterThan(style.indexOf("display:flex"));
  });

  it("lays out and writes a Column's font size and percentage line height, and a Text's own size, as today", async () => {
    const page = (
      <Page width={600}>
        <Column id="col" style={{ fontSize: 20, lineHeight: "150%" }}>
          <Text id="t" style={{ fontSize: 10 }}>
            a
          </Text>
        </Column>
      </Page>
    );
    const root = prepare(page).root!;
    expect(find(root, "col")!.text).toMatchObject({ fontSize: 20, lineHeight: 1.5, lineHeightPx: 30 });
    expect(find(root, "t")!.text).toMatchObject({ fontSize: 10, lineHeight: 1.5, lineHeightPx: 15 });
    expect(find(root, "t")!.text.authored).toBeUndefined();
    const { html } = await render(page);
    // Its line height is the root's multiple, 1.5, so it's inherited as today: not written again.
    expect(styleOf(html, "col")).toBe("display:flex;flex-direction:column;font-size:20px");
    expect(styleOf(html, "t")).toBe("margin:0;font-size:10px");
  });

  it("writes an Image in a content-sized Box, and a Table, with what the browser computes", async () => {
    const page = (
      <Page width={800}>
        <Box style={{ flexDirection: "row" }}>
          <Box id="sized" style={{ width: "fit-content" }}>
            <Image id="img" src={photo} alt="" />
            <Table>
              <TableRow>
                <TableCell>a</TableCell>
                <TableCell>b</TableCell>
              </TableRow>
            </Table>
          </Box>
        </Box>
      </Page>
    );
    expect(errors(page)).toEqual([]);
    expect(widthOf(page, "sized")).toBeNull();
    expect(widthOf(page, "img")).toBe(400);
    const { html } = await render(page);
    expect(/id="img"[^>]*>/.exec(html)![0]).toContain('width="400"');
  });
});

describe("the builder", () => {
  it("draws a Box as a locked HTML block, and reports page styles on its tools' components as left out", () => {
    const { report, design } = toDesign(
      <Page width={800}>
        <Box style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
          <Text>a</Text>
          <Text>b</Text>
        </Box>
        <Section>
          <Row>
            <Column>
              <Heading style={{ whiteSpace: "nowrap" }}>c</Heading>
            </Column>
          </Row>
        </Section>
      </Page>
    );
    expect(report).toContain("root.children[0]: a Box isn't a tool of the builder's: it's an HTML block of its own markup in the builder (it can be moved, not edited)");
    expect(report.some((line) => /has no place for style\.whiteSpace: left out/.test(line))).toBe(true);
    expect(JSON.stringify(design)).toContain("grid-template-columns:1fr 1fr");
  });
});

describe("fixes from the second review", () => {
  it("writes a Section's and a List's rem padding as CSS, not NaN", async () => {
    const page = (
      <Page width={600}>
        <Section id="s" style={{ padding: "1rem 2rem" }}>
          <Text id="t">words</Text>
        </Section>
      </Page>
    );
    const { html } = await render(page);
    expect(html).not.toContain("NaN");
    expect(styleOf(html, "s")).toContain("2rem");
    expect(widthOf(page, "t")).toBe(536);
  });

  it("writes a relative font size in a box of the same relative size: it's of the parent's", async () => {
    const page = (
      <Page width={600}>
        <Box style={{ fontSize: "2em" }}>
          <Text id="t" style={{ fontSize: "2em" }}>words</Text>
        </Box>
      </Page>
    );
    const { html } = await render(page);
    expect(styleOf(html, "t")).toContain("font-size:2em");
  });

  it("writes a numeric grid line without a unit", async () => {
    const page = (
      <Page width={600}>
        <Box style={{ display: "grid", gridTemplateColumns: "100px 500px" }}>
          <Text id="t" style={{ gridColumn: 2 }}>words</Text>
        </Box>
      </Page>
    );
    const { html } = await render(page);
    expect(styleOf(html, "t")).toMatch(/grid-column:2(;|$)/);
    expect(widthOf(page, "t")).toBe(500);
  });

  it("takes a semantic element's own margins and padding away", async () => {
    const { html } = await render(
      <Page width={600}>
        <Box id="f" as="figure"><Text>words</Text></Box>
        <Box id="l" as="ul"><Text>item</Text></Box>
      </Page>
    );
    expect(styleOf(html, "f")).toMatch(/margin:0;padding:0/);
    expect(styleOf(html, "l")).toMatch(/margin:0;padding:0;list-style:none/);
  });

  it("writes a Column's alignItems where its page styles make it a flex row", async () => {
    const { html } = await render(
      <Page width={600}>
        <Column id="c" style={{ height: 100, flexDirection: "row", alignItems: "center" }}>
          <Box style={{ width: 100, height: 20 }} />
        </Column>
      </Page>
    );
    expect(styleOf(html, "c")).toContain("align-items:center");
  });

  it("writes a Row's children as a grid's where its page styles make it one: each with its own width", async () => {
    const page = (
      <Page width={600}>
        <Row style={{ display: "grid", gridTemplateColumns: "100px 500px" }}>
          <Text id="a" style={{ width: 50 }}>a</Text>
          <Text id="b">b</Text>
        </Row>
      </Page>
    );
    expect(errors(page)).toEqual([]);
    expect([widthOf(page, "a"), widthOf(page, "b")]).toEqual([50, 500]);
    const { html } = await render(page);
    expect(styleOf(html, "a")).toContain("width:50px");
    expect(styleOf(html, "a")).not.toContain("flex:");
  });

  it("lays out a Row's child by its flexBasis, flexGrow and flexShrink", () => {
    const page = (
      <Page width={600}>
        <Row>
          <Column id="a" style={{ flexBasis: 100, flexGrow: 0 }} />
          <Column id="b" />
        </Row>
      </Page>
    );
    expect([widthOf(page, "a"), widthOf(page, "b")]).toEqual([100, 500]);
  });

  it("starts a flex: 1 child from its padding, as Chromium does (the layout gate measures it)", () => {
    const page = (
      <Page width={600}>
        <Box style={{ flexDirection: "row" }}>
          <Box id="a" style={{ flex: 1, padding: 20 }} />
          <Box id="b" style={{ flex: 1 }} />
        </Box>
      </Page>
    );
    expect([widthOf(page, "a"), widthOf(page, "b")]).toEqual([320, 280]);
  });

  it("leaves unknown what depends on content: a child that shrinks beside text, what's in an unknown box, a grid item placed by justifyItems", () => {
    const page = (
      <Page width={600}>
        <Box style={{ flexDirection: "row" }}>
          <Box id="wide" style={{ width: 600 }} />
          <Text>hello</Text>
        </Box>
        <Box style={{ flexDirection: "row" }}>
          <Box id="fits"><Text id="inner">hello</Text></Box>
          <Box style={{ width: 300, flexShrink: 0 }} />
        </Box>
        <Box style={{ display: "grid", justifyItems: "start" }}>
          <Text id="placed" style={{ justifySelf: "auto" }}>hello</Text>
        </Box>
      </Page>
    );
    expect(widthOf(page, "wide")).toBeNull();
    expect(widthOf(page, "fits")).toBeNull();
    expect(widthOf(page, "inner")).toBeNull();
    expect(widthOf(page, "placed")).toBeNull();
    expect(outline(page)).toContain("Text: fits its content");
  });

  it("counts borderWidth and borderStyle in a box's frame, in the order they're written", () => {
    const page = (
      <Page width={600}>
        <Box style={{ width: 300, paddingLeft: 20, borderWidth: 10, borderStyle: "solid" }}>
          <Text id="a">words</Text>
        </Box>
        <Box style={{ width: 300, border: "10px solid #000", borderStyle: "none" }}>
          <Text id="b">words</Text>
        </Box>
        <Box style={{ width: 300, borderStyle: "solid" }}>
          <Text id="c">words</Text>
        </Box>
      </Page>
    );
    expect([widthOf(page, "a"), widthOf(page, "b"), widthOf(page, "c")]).toEqual([260, 300, 294]);
  });

  it("takes a grid item's percentages of its cell, and leaves an out-of-flow box's unknown (its containing block isn't modelled)", () => {
    const page = (
      <Page width={600}>
        <Box style={{ display: "grid", gridTemplateColumns: "100px 500px" }}>
          <Box style={{ padding: "10%" }}>
            <Text id="t">words</Text>
          </Box>
        </Box>
        <Box style={{ width: 200 }}>
          <Box id="fixed" style={{ position: "fixed", width: "50%" }} />
          <Box id="absolute" style={{ position: "absolute", width: "50%" }} />
        </Box>
      </Page>
    );
    expect(widthOf(page, "t")).toBe(80);
    expect(widthOf(page, "fixed")).toBeNull();
    expect(widthOf(page, "absolute")).toBeNull();
  });

  it("places a span counted back from its end line, and leaves a column flow unknown", () => {
    const page = (
      <Page width={600}>
        <Box style={{ display: "grid", gridTemplateColumns: "100px 200px 300px" }}>
          <Text id="span" style={{ gridColumn: "span 2 / 4" }}>a</Text>
        </Box>
        <Box style={{ display: "grid", gridTemplateColumns: "100px 500px", gridAutoFlow: "column" }}>
          <Text id="c1">a</Text>
          <Text id="c2">b</Text>
        </Box>
      </Page>
    );
    expect(widthOf(page, "span")).toBe(500);
    expect(widthOf(page, "c1")).toBeNull();
    expect(widthOf(page, "c2")).toBeNull();
  });

  it("leaves unknown an item locked to a row it doesn't fit in (CSS makes an implicit track), and what dense packing places", () => {
    const page = (
      <Page width={400}>
        <Box style={{ display: "grid", gridTemplateColumns: "100px 100px" }}>
          <Box id="a" style={{ gridRow: 1, gridColumn: 1 }}><Text>a</Text></Box>
          <Box id="b" style={{ gridRow: 1, gridColumn: "span 2" }}><Text>b</Text></Box>
        </Box>
        <Box style={{ display: "grid", gridTemplateColumns: "100px 300px", gridAutoFlow: "row dense" }}>
          <Text id="d">a</Text>
        </Box>
      </Page>
    );
    expect(widthOf(page, "a")).toBe(100);
    expect(widthOf(page, "b")).toBeNull();
    expect(widthOf(page, "d")).toBeNull();
  });

  it("sizes grid tracks as CSS does: ranges grow equally, auto-fit collapses after placing, repeats count the other tracks, items' minimums hold", () => {
    const page = (
      <Page width={600}>
        <Box style={{ width: 300, display: "grid", gridTemplateColumns: "minmax(100px, 300px) minmax(100px, 300px)" }}>
          <Text id="r1">a</Text>
          <Text id="r2">b</Text>
        </Box>
        <Box style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))" }}>
          <Text id="f1" style={{ gridColumn: "span 2" }}>a</Text>
          <Text id="f2">b</Text>
        </Box>
        <Box style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr)) 200px" }}>
          <Text>1</Text>
          <Text>2</Text>
          <Text>3</Text>
          <Text>4</Text>
          <Text id="last">5</Text>
        </Box>
        <Box style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
          <Box id="m1" style={{ minWidth: 400 }}><Text>a</Text></Box>
          <Text id="m2">b</Text>
        </Box>
      </Page>
    );
    expect([widthOf(page, "r1"), widthOf(page, "r2")]).toEqual([150, 150]);
    expect([widthOf(page, "f1"), widthOf(page, "f2")]).toEqual([400, 200]);
    expect(widthOf(page, "last")).toBe(200);
    expect([widthOf(page, "m1"), widthOf(page, "m2")]).toEqual([400, 200]);
  });

  it("gives the builder a Grid's cells' percentage padding of their cells, and rem gaps as px (said)", () => {
    const { design, report } = toDesign(
      <Page width={600}>
        <Grid columns={2}>
          <Text style={{ padding: "10%" }}>a</Text>
          <Text style={{ padding: "10%" }}>b</Text>
        </Grid>
        <Section>
          <Column style={{ gap: "1rem" }}>
            <Text>a</Text>
            <Text>b</Text>
          </Column>
        </Section>
      </Page>
    );
    const json = JSON.stringify(design);
    expect(json).not.toMatch(/%0|NaN/);
    expect(report).toContain("root.children[0].children[0]: the builder's padding is in px: style.padding is the 30px 30px 30px 30px it comes to in the Page's widest window");
    expect(report).toContain("root.children[0].children[1]: the builder's padding is in px: style.padding is the 30px 30px 30px 30px it comes to in the Page's widest window");
    expect(report).toContain("root.children[1].children[0]: the builder's gaps are in px: style.gap is the 16px it comes to in the Page's widest window");
  });

  it("keeps what other roots write: unrounded padding sides, the flex warning's words", async () => {
    const email = (
      <Email width={600}>
        <Text id="t" style={{ padding: { top: 1.001, right: 1.002, bottom: 1.003, left: 1.004 }, flex: 1 }}>words</Text>
      </Email>
    );
    expect(validate(email).diagnostics.find((d) => d.code === "style/ignored")?.message).toBe("flex only applies to a child of a Row; this Text is in a Email");
    const { html } = await render(email);
    expect(html).toContain("padding:1px 1px 1px 1px");
  });

  it("round 2: a Row's flexBasis from its padding and auto as its content, a Row as a column stretching its text", async () => {
    const page = (
      <Page width={600}>
        <Row>
          <Column id="a" style={{ flexBasis: 0, padding: 20 }} />
          <Column id="b" />
        </Row>
        <Row>
          <Column id="auto" style={{ width: 200, flexBasis: "auto" }} />
          <Column id="rest" />
        </Row>
        <Row id="col" style={{ flexDirection: "column", alignItems: "start" }}>
          <Text id="t">words</Text>
        </Row>
      </Page>
    );
    expect([widthOf(page, "a"), widthOf(page, "b")]).toEqual([320, 280]);
    expect(widthOf(page, "auto")).toBeNull();
    expect(widthOf(page, "t")).toBe(600);
    const { html } = await render(page);
    expect(styleOf(html, "col")).not.toContain("align-items");
  });

  it("round 2: a border width with no style is no border; auto-fill counts a range by its most", () => {
    const page = (
      <Page width={600}>
        <Box style={{ width: 300, borderWidth: 10 }}>
          <Text id="t">words</Text>
        </Box>
        <Box style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 200px))" }}>
          <Text id="g">a</Text>
          <Text>b</Text>
        </Box>
      </Page>
    );
    expect(widthOf(page, "t")).toBe(300);
    expect(widthOf(page, "g")).toBe(200);
  });

  it("round 2: leaves unknown a grid minimum in %, an unplaced item beside auto-fit tracks, and widths in ch or fit-content with what's in them", () => {
    const page = (
      <Page width={600}>
        <Box style={{ display: "grid", gridTemplateColumns: "1fr 3fr" }}>
          <Box id="pct" style={{ minWidth: "50%" }} />
          <Text id="pct2">b</Text>
        </Box>
        <Box style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gridAutoFlow: "row dense" }}>
          <Text id="fit" style={{ gridColumn: 1 }}>a</Text>
          <Text>b</Text>
        </Box>
        <Box id="ch" style={{ width: "10ch" }}><Text id="chText">words</Text></Box>
        <Box id="fc" style={{ width: "fit-content" }}><Text id="fcText">words</Text></Box>
      </Page>
    );
    for (const id of ["pct", "pct2", "fit", "ch", "chText", "fc", "fcText"]) expect([id, widthOf(page, id)]).toEqual([id, null]);
  });

  it("round 2: takes a Section's percentage padding of the window it spans", () => {
    const page = (
      <Page width={600} breakpoints={{ mobile: 800 }}>
        <Section style={{ padding: "10%" }}>
          <Text id="t">words</Text>
        </Section>
      </Page>
    );
    // V0 is 801px: each side is (801 - 600) / 2 + 80.1px.
    expect(widthOf(page, "t")).toBe(440);
  });

  it("round 2: gives the builder a rem gap as the px it comes to, in a Column and in a Grid", () => {
    const { design } = toDesign(
      <Page width={600}>
        <Section>
          <Column style={{ gap: "1rem" }}>
            <Text>first</Text>
            <Text>second</Text>
          </Column>
        </Section>
        <Grid columns={2} style={{ gap: "1rem", rowGap: "2rem" }}>
          <Text>a</Text>
          <Text>b</Text>
          <Text>c</Text>
        </Grid>
      </Page>
    );
    const json = JSON.stringify(design);
    expect(json).toMatch(/"containerPadding":"16px 0px 0px"|"containerPadding":"16px 0px 0px 0px"/);
    expect(json).toContain("32px");
  });

  it("round 2: keeps the flex warning's words where a template uses no page styles, in a Page too", () => {
    const page = (
      <Page width={600}>
        <Text style={{ flex: 1 }}>words</Text>
      </Page>
    );
    expect(validate(page).diagnostics.find((d) => d.code === "style/ignored")?.message).toBe("flex only applies to a child of a Row; this Text is in a Page");
  });

  it("round 3: an unknown frame (a border in ch, padding in % of an unknown width) leaves what's inside unknown", () => {
    const page = (
      <Page width={600}>
        <Box id="ch" style={{ width: 300, borderWidth: "1ch", borderStyle: "solid" }}>
          <Text id="chText">words</Text>
        </Box>
        <Box id="fixed" style={{ position: "fixed", width: 300, padding: "10%" }}>
          <Text id="fixedText">words</Text>
        </Box>
        <Box id="min" style={{ position: "fixed", width: 100, minWidth: "50%" }} />
      </Page>
    );
    expect(widthOf(page, "ch")).toBe(300);
    expect(widthOf(page, "chText")).toBeNull();
    expect(widthOf(page, "fixed")).toBe(300);
    expect(widthOf(page, "fixedText")).toBeNull();
    expect(widthOf(page, "min")).toBeNull();
  });

  it("round 3: a grid item's width in ch is unknown, and a minmax(auto, 200px) repeat counts at 200px", () => {
    const page = (
      <Page width={600}>
        <Box style={{ display: "grid", gridTemplateColumns: "1fr" }}>
          <Box id="ch" style={{ width: "10ch" }}><Text id="chText">words</Text></Box>
        </Box>
        <Box style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(auto, 200px)) 50px" }}>
          <Text id="g1">a</Text>
          <Text id="g2">b</Text>
          <Text id="g3">c</Text>
        </Box>
      </Page>
    );
    expect([widthOf(page, "ch"), widthOf(page, "chText")]).toEqual([null, null]);
    // Two repetitions beside the 50px track: the third item is in it.
    expect([widthOf(page, "g1"), widthOf(page, "g2"), widthOf(page, "g3")]).toEqual([null, null, 50]);
  });

  it("round 3: a Row child's flexBasis of its content leaves what grows beside it unknown", () => {
    const page = (
      <Page width={600}>
        <Row>
          <Column id="a" style={{ width: 200, flexBasis: "auto" }}>
            <Image src={{ src: "https://example.com/p.png", width: 100, height: 50 }} alt="" />
          </Column>
          <Column id="b" />
        </Row>
      </Page>
    );
    expect([widthOf(page, "a"), widthOf(page, "b")]).toEqual([null, null]);
  });

  it("round 3: a Section's paddingLeft replaces that side's gutter", () => {
    const page = (
      <Page width={600} breakpoints={{ mobile: 800 }}>
        <Section style={{ paddingLeft: "10%" }}>
          <Text id="t">words</Text>
        </Section>
      </Page>
    );
    // 801 - 80.1 - (801 - 600) / 2
    expect(widthOf(page, "t")).toBe(620);
  });

  it("round 3: gives the builder a Grid's rem rowGap with no gap", () => {
    const { design, report } = toDesign(
      <Page width={600}>
        <Grid columns={2} style={{ rowGap: "2rem" }}>
          <Text>a</Text>
          <Text>b</Text>
          <Text>c</Text>
        </Grid>
      </Page>
    );
    expect(report).toContain("root.children[0]: the builder's gaps are in px: style.rowGap is the 32px it comes to in the Page's widest window");
    expect(JSON.stringify(design)).toMatch(/"padding":"32px 0px 0px"|"padding":"32px 0px 0px 0px"/);
  });

  it("round 4: a limit the model can't evaluate leaves a width unknown, whatever the width, in a stack, a grid and a Row", () => {
    const page = (
      <Page width={600}>
        <Box style={{ display: "grid", gridTemplateColumns: "1fr" }}>
          <Box id="grid" style={{ width: 400, maxWidth: "10ch" }}><Text id="gridText">x</Text></Box>
        </Box>
        <Box style={{ display: "grid", gridTemplateColumns: "400px" }}>
          <Box id="minContent" style={{ maxWidth: "min-content" }}><Text>x</Text></Box>
        </Box>
        <Box id="stack" style={{ maxWidth: "10ch" }}><Text id="stackText">x</Text></Box>
        <Row>
          <Column id="r1" style={{ maxWidth: "10ch" }} />
          <Column id="r2" />
        </Row>
      </Page>
    );
    for (const id of ["grid", "gridText", "minContent", "stack", "stackText", "r1", "r2"]) expect([id, widthOf(page, id)]).toEqual([id, null]);
  });

  it("round 4: a border's sides by how many widths are given, and an unknown frame in a flex row", () => {
    const page = (
      <Page width={600}>
        <Box style={{ width: 300, borderWidth: "1px 1ch", borderStyle: "solid" }}>
          <Text id="mixed">x</Text>
        </Box>
        <Box style={{ width: 300, borderWidth: "1ch 1px", borderStyle: "solid" }}>
          <Text id="sides">x</Text>
        </Box>
        <Box style={{ flexDirection: "row" }}>
          <Box id="f1" style={{ flex: 1, borderWidth: "1ch", borderStyle: "solid" }} />
          <Box id="f2" style={{ flex: 1 }} />
        </Box>
      </Page>
    );
    expect(widthOf(page, "mixed")).toBeNull();
    expect(widthOf(page, "sides")).toBe(298);
    expect([widthOf(page, "f1"), widthOf(page, "f2")]).toEqual([null, null]);
  });

  it("round 4: a wrapping Row with a child of its content's size leaves its lines unknown; a repeat beside a length in ch is unknown", () => {
    const page = (
      <Page width={600}>
        <Row style={{ flexWrap: "wrap" }}>
          <Column id="w1" style={{ width: 400 }} />
          <Column style={{ flexBasis: "auto", flexGrow: 0 }}>
            <Image src={{ src: "https://example.com/p.png", width: 300, height: 50 }} alt="" />
          </Column>
          <Column id="w3" style={{ width: 300 }} />
          <Column id="last" style={{ flex: 1 }} />
        </Row>
        <Box style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(calc(300px + 1ch), 400px)) 50px" }}>
          <Text id="g1">a</Text>
          <Text id="g2">b</Text>
        </Box>
      </Page>
    );
    for (const id of ["w1", "w3", "last", "g1", "g2"]) expect([id, widthOf(page, id)]).toEqual([id, null]);
  });

  it("round 5: a stretched child's limit in ch, a Row child's automatic minimum, a limit mixing % and ch: unknown", () => {
    const page = (
      <Page width={600}>
        <Column style={{ alignItems: "stretch" }}>
          <Image id="image" src={{ src: "https://example.com/p.png", width: 400, height: 100 }} alt="" style={{ maxWidth: "10ch" }} />
        </Column>
        <Row>
          <Column id="a" style={{ minWidth: "auto" }}>
            <Column style={{ width: 400 }} />
          </Column>
          <Column id="b" />
        </Row>
        <Box style={{ width: "100ch" }}>
          <Box id="inner" style={{ width: 400, maxWidth: "min(10ch, 100%)" }}>
            <Text id="text">x</Text>
          </Box>
        </Box>
      </Page>
    );
    for (const id of ["image", "a", "b", "inner", "text"]) expect([id, widthOf(page, id)]).toEqual([id, null]);
  });

  it("round 5: counts an auto repeat of zero-minimum tracks at 1px each, and leaves past the cap unknown", () => {
    const page = (
      <Page width={600}>
        <Box style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(0, 1fr))" }}>
          <Box id="a" />
          <Box id="b" />
        </Box>
      </Page>
    );
    expect([widthOf(page, "a"), widthOf(page, "b")]).toEqual([300, 300]);
    const wide = (
      <Page width={1280}>
        <Box style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(0, 1fr))" }}>
          <Box id="c" />
        </Box>
      </Page>
    );
    expect(widthOf(wide, "c")).toBeNull();
  });

  it("round 6: a stretched child's limits in em are of its own font size; an Image in a Box keeps its file's size, stretched or not", async () => {
    const page = (
      <Page width={600}>
        <Column style={{ alignItems: "stretch" }}>
          <Button id="button" href="https://example.com" style={{ fontSize: 32, maxWidth: "10em", padding: 0 }}>x</Button>
        </Column>
        <Box style={{ alignItems: "stretch" }}>
          <Image id="image" src={{ src: "https://example.com/image.png", width: 400, height: 100 }} alt="" />
        </Box>
      </Page>
    );
    expect(widthOf(page, "button")).toBe(320);
    expect(widthOf(page, "image")).toBe(400);
    const { html } = await render(page);
    expect(/id="image"[^>]*>/.exec(html)![0]).toContain('width="400"');
  });

  it("round 7: an Image in a Box at its file's size with its own maxWidth isn't kept inside the Box; a calc() below 0 is 0", () => {
    const page = (
      <Page width={600}>
        <Box style={{ width: 200, alignItems: "stretch" }}>
          <Image id="image" src={{ src: "https://example.com/a.png", width: 400, height: 100 }} alt="" style={{ maxWidth: 500 }} />
        </Box>
        <Box id="negative" style={{ width: "calc(100% - 700px)" }} />
        <Box style={{ width: 200, padding: "calc(1rem - 32px)" }}>
          <Text id="text">x</Text>
        </Box>
      </Page>
    );
    expect(widthOf(page, "image")).toBe(400);
    expect(widthOf(page, "negative")).toBe(0);
    expect(widthOf(page, "text")).toBe(200);
  });

  it("round 8: Images at their file's size start from it in a flex row, each limited by its own max-width", () => {
    const file = { src: "https://example.com/a.png", width: 400, height: 100 };
    const page = (
      <Page width={600}>
        <Box style={{ width: 300, flexDirection: "row" }}>
          <Image id="a" src={file} alt="" style={{ maxWidth: 500 }} />
          <Image id="b" src={file} alt="" />
        </Box>
      </Page>
    );
    expect([widthOf(page, "a"), widthOf(page, "b")]).toEqual([150, 150]);
  });

  it("round 8: range-checks a Section's and a List's padding as the writer writes it: the whole expression", () => {
    const section = (
      <Page width={600} breakpoints={{ mobile: 800 }}>
        <Section style={{ padding: "calc(1rem - 32px)" }}>
          <Text id="t">x</Text>
        </Section>
      </Page>
    );
    // V0 801: each side max(-16px, 100.5px - 16px) = 84.5px.
    expect(widthOf(section, "t")).toBe(632);
    const list = (
      <Page width={600}>
        <List style={{ padding: "calc(1rem - 32px)" }}>
          <ListItem id="item">x</ListItem>
        </List>
      </Page>
    );
    // Left: calc(-16px + 24px) = 8px; right: 0.
    expect(widthOf(list, "item")).toBe(592);
  });

  it("round 8: keeps a negative width another root gave before (no calc() to range-check)", () => {
    const canvas = (
      <Canvas width={200} height={200} style={{ padding: 150 }}>
        <Column id="c" style={{ width: "50%" }}>
          <Text>x</Text>
        </Column>
      </Canvas>
    );
    expect(widthOf(canvas, "c")).toBe(-50);
  });

  it("round 8: a gap in ch leaves what a flex row, a grid and a Row share unknown", () => {
    const page = (
      <Page width={600}>
        <Box style={{ flexDirection: "row", gap: "1ch" }}>
          <Box id="f1" style={{ flex: 1 }} />
          <Box id="f2" style={{ flex: 1 }} />
        </Box>
        <Box style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: "1ch" }}>
          <Box id="g1" />
          <Box id="g2" />
        </Box>
        <Row style={{ gap: "1ch" }}>
          <Column id="r1" />
          <Column id="r2" />
        </Row>
      </Page>
    );
    for (const id of ["f1", "f2", "g1", "g2", "r1", "r2"]) expect([id, widthOf(page, id)]).toEqual([id, null]);
  });

  it("round 9: a List right to left range-checks its right padding, where the writer adds its indent", () => {
    const list = (
      <Page width={600} dir="rtl">
        <List style={{ padding: { top: 0, right: "calc(1rem - 32px)", bottom: 0, left: 0 } }}>
          <ListItem id="item">x</ListItem>
        </List>
      </Page>
    );
    // Right: calc(-16px + 24px) = 8px; left: 0.
    expect(widthOf(list, "item")).toBe(592);
  });

  it("round 9: a Row's columnGap is the space between its children, and in ch leaves them unknown", () => {
    const page = (
      <Page width={600}>
        <Row style={{ columnGap: 40 }}>
          <Column id="a" />
          <Column id="b" />
        </Row>
        <Row style={{ gap: 0, columnGap: "1ch" }}>
          <Column id="c" />
          <Column id="d" />
        </Row>
      </Page>
    );
    expect([widthOf(page, "a"), widthOf(page, "b")]).toEqual([280, 280]);
    expect([widthOf(page, "c"), widthOf(page, "d")]).toEqual([null, null]);
  });

  it("round 10: an Image in a flex row is content-box: its border is outside its width and its max-width", () => {
    const page = (
      <Page width={600}>
        <Box style={{ width: 300, flexDirection: "row" }}>
          <Image id="img" src={{ src: "https://example.com/a.png", width: 400, height: 100 }} alt="" style={{ width: 400, flex: "none", border: "10px solid #000" }} />
        </Box>
      </Page>
    );
    expect(widthOf(page, "img")).toBe(320);
  });

  it("round 10: Images with width auto start a flex row from their files' sizes", () => {
    const page = (
      <Page width={600}>
        <Box style={{ width: 300, flexDirection: "row" }}>
          <Image id="a" src={{ src: "https://example.com/a.png", width: 400, height: 100 }} alt="" style={{ width: "auto" }} />
          <Image id="b" src={{ src: "https://example.com/b.png", width: 100, height: 100 }} alt="" style={{ width: "auto" }} />
        </Box>
      </Page>
    );
    expect([widthOf(page, "a"), widthOf(page, "b")]).toEqual([240, 60]);
  });

  it("round 10: an Image whose width the model can't evaluate is unknown in a flex row", () => {
    const page = (
      <Page width={600}>
        <Box style={{ width: 300, flexDirection: "row" }}>
          <Image id="img" src={{ src: "https://example.com/a.png", width: 400, height: 100 }} alt="" style={{ width: "min(10ch, 100px)", flex: "none" }} />
        </Box>
      </Page>
    );
    expect(widthOf(page, "img")).toBe(null);
  });

  it("round 9: an Image with its own width in a flex row is no wider than its place (max-width 100%)", () => {
    const page = (
      <Page width={600}>
        <Box style={{ width: 300, flexDirection: "row" }}>
          <Image id="img" src={{ src: "https://example.com/a.png", width: 400, height: 100 }} alt="" style={{ width: 400, flex: "none" }} />
        </Box>
      </Page>
    );
    expect(widthOf(page, "img")).toBe(300);
  });
});
