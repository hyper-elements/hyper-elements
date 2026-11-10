/**
 * Box and a Page's styles (Phase 3 of the themes and pages plan; Decisions 5–7 and 19): Boxes with the existing
 * layout components, sizes from the base sample, what the writers keep as today, and what goes to the builder.
 */
import type { ReactElement } from "react";
import { describeComponents } from "@unlayer-internal/elements-core";
import { toDesign } from "../../src/builder";
import { Box, Column, Email, Grid, Heading, Image, Layer, outline, Page, prepare, render, Row, Section, Span, Table, TableCell, TableRow, Text, validate, type ResolvedNode } from "../../src/primitives";

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
          <Box id="fixed" style={{ width: 120 }} />
          <Box id="grows" style={{ flexGrow: 1 }} />
          <Text id="content">its own size</Text>
        </Box>
      </Page>
    );
    expect([widthOf(page, "side"), widthOf(page, "main")]).toEqual([200, 680]);
    // flexGrow from its content's size (CSS's flex-basis auto) depends on it: unknown, as the text's own size is.
    expect([widthOf(page, "fixed"), widthOf(page, "grows"), widthOf(page, "content")]).toEqual([120, null, null]);
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
