/** toDesign(): a template as the builder's design JSON, every block a tool where one shows it, and what it can't hold said. */
import { describe, expect, it } from "vitest";
import { Button, Canvas, Column, component, Document, Email, Grid, Heading, Html, Image, Layer, LineBreak, Link, List, ListItem, Page, PageBreak, PageFooter, PageHeader, PageNumber, Text, prop, Rect, Row, Span, Section, Svg, Table, TableCell, TableRow } from "../primitives";
import { airbnb, stripe } from "../primitives/testing/codemod-examples";
import { collectTemplate } from "../primitives/collect";
import { withParagraphMargin } from "./text";
import { fromDesign, toDesign } from "./index";
import { textJsonHtml } from "./text-json";
import { invoice, lineItems } from "./testing/templates";
import { TableDefaults } from "./tool-defaults";

type Values = Record<string, any>;
const blocks = (design: any): Array<{ type: string; values: Values }> => design.body.rows.flatMap((row: any) => row.columns.flatMap((column: any) => column.contents));

describe("toDesign", () => {
  for (const [name, template] of [["StripeReceipt", <stripe.StripeReceipt key="s" />], ["AirbnbConfirmation", <airbnb.AirbnbConfirmation key="a" />]] as const) {
    it(`writes ${name} as the builder's design, every block a tool`, () => {
      const types = blocks(toDesign(template).design).map((content) => content.type);
      expect(types.length).toBeGreaterThan(3);
      expect(types).not.toContain("html");
    });
  }

  it("writes what no tool shows as an HTML block of the new engine's markup, and says so", () => {
    const Card = component({ type: "acme.Card", label: "Card", props: { title: prop.text({ label: "Title", required: true }) }, render: ({ title }) => <Text>{title}</Text> });
    const { design, report } = toDesign(
      <Page width={600}>
        <Heading>Summer sale</Heading>
        <Layer style={{ height: 200, alignItems: "center" }}>
          <Image src={{ src: "https://example.com/hero.png", width: 1200, height: 400 }} alt="Sea" style={{ width: "100%" }} />
          <Text>Up to 40% off</Text>
        </Layer>
        <Svg width={20} height={20}>
          <Rect width={20} height={20} />
        </Svg>
        <Row>
          <Column>
            <Column style={{ backgroundColor: "#eeeeee" }}>
              <Text>A box in a column</Text>
            </Column>
          </Column>
        </Row>
        <Card title="Mine" />
      </Page>
    );
    const contents = blocks(design);
    expect(contents.map((content) => content.type)).toEqual(["heading", "html", "html", "html", "html"]);
    expect(String(contents[1].values.html)).toContain("https://example.com/hero.png");
    expect(String(contents[2].values.html)).toContain("<svg");
    expect(String(contents[4].values.html)).toContain("Mine");
    expect(report.filter((line) => line.includes("it's an HTML block")).map((line) => line.split(":")[0])).toEqual(["root.children[1]", "root.children[2]", "root.children[3].children[0].children[0]", "root.children[4]"]);
  });

  it("writes an HTML block of the new engine's markup without the root's background, which the builder draws behind it", () => {
    for (const Root of [Email, Page]) {
      const { design } = toDesign(
        <Root style={{ backgroundColor: "#f3f4f6" }}>
          <Section style={{ backgroundColor: "#ffffff" }}>
            <Table style={{ rowBorder: "1px solid #e5e7eb" }}>
              <TableRow>
                <TableCell>Ships</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Carrier</TableCell>
              </TableRow>
            </Table>
          </Section>
        </Root>
      );
      const [html] = blocks(design).filter((content) => content.type === "html");
      expect(String(html.values.html)).toContain("Carrier");
      // The block's own markup paints none of it: the builder draws the body's and the Section's color behind it.
      expect(String(html.values.html)).not.toMatch(/f3f4f6/i);
      expect(design.body.values.backgroundColor).toBe("#f3f4f6");
    }
  });

  it("writes an Html block as the builder's own HTML block, its plain text hidden", () => {
    const [html] = blocks(toDesign(<Email><Html html="<b>Sale</b>" text="Sale now" /></Email>).design);
    expect(html).toMatchObject({ type: "html", values: { html: '<div style="line-height:1.5"><b>Sale</b></div>', text: "Sale now", containerPadding: "0px" } });
  });

  it("writes a Grid's rows as the builder's rows, its cells as their columns", () => {
    const { design } = toDesign(
      <Page width={600}>
        <Grid columns={3} style={{ gap: 20 }}>
          {["a", "b", "c", "d"].map((word) => (
            <Text key={word}>{word}</Text>
          ))}
        </Grid>
      </Page>
    );
    // Each cell its width and its share of the gap: 600px less two 20px gaps, in three.
    expect(design.body.rows.map((row) => row.cells)).toEqual([
      [197, 207, 196],
      [197, 207, 196],
    ]);
    expect(design.body.rows[1].columns.map((column) => column.contents.length)).toEqual([1, 0, 0]);
  });

  it("writes a Document's page settings, its header and footer, and a page break where each page ends", () => {
    const { design, report } = toDesign(invoice);
    const body = design.body as any;
    expect([body.values.documentSize, body.values.documentOrientation, body.values.documentMargin]).toEqual(["A5", "landscape", "40px"]);
    expect(design.schemaVersion).toBeGreaterThanOrEqual(28);
    expect([body.headers.length, body.footers.length]).toEqual([1, 1]);
    expect(body.headers[0].values._meta).toEqual({ htmlID: "u_header_1", htmlClassNames: "u_header" });
    expect(blocks(design).map((content) => content.type)).toEqual(["heading", "paragraph", "page_break", "paragraph", "page_break", "paragraph", "page_break", "paragraph"]);
    expect(textJsonHtml(blocks(design)[1].values.textJson).html).toContain(">Page {{page_number}} of {{page_count}}<");
    expect(report).toEqual([expect.stringContaining("the builder has no page numbers yet")]);
    // A margin that differs from side to side: the widest, the sides hidden.
    const sides = toDesign(<Document margin={[10, 20, 30, 40]}><Text>A</Text><PageBreak /><Text>B</Text></Document>).design.body.values;
    expect([sides.documentMargin, sides.margin]).toEqual(["40px", "10px 20px 30px 40px"]);
  });

  it("writes a link's target only where the template gives one: a Button's, a link in text, an image's", () => {
    const { design } = toDesign(
      <Email>
        <Text>
          <Link href={{ href: "https://x.test/a", target: "_blank" }}>a</Link> <Link href="https://x.test/b">b</Link>
        </Text>
        <Link href={{ href: "https://x.test/image", target: "_blank" }}>
          <Image src={{ src: "https://example.com/a.png", width: 600, height: 300 }} alt="" />
        </Link>
      </Email>
    );
    const [text, image] = blocks(design).map((content) => content.values);
    expect(textJsonHtml(text.textJson).html).toMatch(/<a href="https:\/\/x\.test\/a" target="_blank">a<\/a> <a href="https:\/\/x\.test\/b">b<\/a>/);
    expect(image.action).toEqual({ name: "web", values: { href: "https://x.test/image", target: "_blank" } });
    expect(JSON.stringify(design)).not.toContain("[object Object]");
  });

  it("writes a template's ids as the builder's, and no background where the template has none", () => {
    const { design } = toDesign(
      <Email>
        <Section id="band" style={{ backgroundColor: "#eeeeee" }}>
          <Text id="intro">Hi</Text>
        </Section>
      </Email>
    );
    expect(blocks(design)[0].values._meta).toEqual({ htmlID: "intro", htmlClassNames: "u_content_paragraph" });
    expect(design.body.values.backgroundColor).toBe("");
  });

  it("says what has no place in the builder's design", () => {
    expect(
      toDesign(
        <Email>
          <Text>
            <Link href="https://x.test" style={{ hover: { color: "#ff0000" } }}>
              a
            </Link>
          </Text>
          <Image src="https://example.com/no-size.png" alt="" />
        </Email>
      ).report
    ).toEqual(["root.children[0]: the builder's text holds no a link's hover: left out", "root.children[1]: an image without its size (its src's width and height) takes its own size, and in the builder its column's width"]);
  });

  it("keeps a painted box in a Section in from its sides with columns of space, and moves the space into an unpainted box's column", () => {
    const template = (style: Record<string, string | number>) => (
      <Email width={480}>
        <Section style={{ padding: [0, 24] }}>
          <Text>above</Text>
          <Column style={style}>
            <Text>x</Text>
          </Column>
        </Section>
      </Email>
    );
    const painted = toDesign(template({ backgroundColor: "#eeeeee", padding: 20 }));
    expect(painted.report).toEqual([]);
    const row = painted.design.body.rows[1];
    expect(row.cells).toEqual([24, 432, 24]);
    expect(row.values._override.mobile.noStackMobile).toBe(true);
    expect(row.columns[1].values).toMatchObject({ padding: "20px", backgroundColor: "#eeeeee" });
    for (const side of [row.columns[0], row.columns[2]]) expect(side.contents.map((content: any) => [content.type, content.values.border.borderTopColor])).toEqual([["divider", "transparent"]]);
    const plain = toDesign(template({ height: 80, padding: 20 }));
    expect(plain.report).toEqual([]);
    expect(plain.design.body.rows[1].columns[0].values.padding).toBe("20px 44px");
  });

  it("gives each font the root has its stylesheet, as the builder loads one, and reads it back as that font", () => {
    const face = { family: "Geist", src: "https://fonts.example/geist.woff2", format: "woff2", weight: "100 900" } as const;
    const { design } = toDesign(
      <Email fonts={[face]} style={{ fontFamily: "Geist, Arial, sans-serif" }}>
        <Text>Words</Text>
        <Text style={{ fontFamily: "Georgia, serif" }}>More</Text>
      </Email>
    );
    const body = design.body.values.fontFamily as { label: string; url?: string };
    expect(body.label).toBe("Geist");
    expect(decodeURIComponent(body.url ?? "")).toBe("data:text/css;charset=utf-8,@font-face{font-family:'Geist';src:url(https://fonts.example/geist.woff2) format('woff2');font-weight:100 900;font-style:normal}");
    expect(JSON.stringify(blocks(design)[1].values.fontFamily)).not.toContain("url");
    const back = fromDesign(design);
    expect(back.report.join("\n")).not.toContain("web fonts");
    expect(back.code).toContain("geist.woff2");
    // One the template doesn't have is still said to be left out.
    const other = JSON.parse(JSON.stringify(design));
    other.body.values.fontFamily = { label: "Lora", value: "Lora, serif", url: "https://fonts.example/lora.css" };
    expect(fromDesign(other).report.join("\n")).toContain("Lora: web fonts the builder loads from a stylesheet");
  });

  it("says what a Document's HTML blocks lose, which the builder's document mode doesn't draw", () => {
    const missing = "the builder's document mode keeps it but doesn't draw or export it, so what's in it isn't in the builder's PDF";
    const layer = (
      <Layer>
        <Image src={{ src: "https://x.test/a.png", width: 600, height: 200 }} alt="" />
        <Text>Over</Text>
      </Layer>
    );
    expect(toDesign(<Document>{layer}</Document>).report.join("\n")).toContain(missing);
    expect(toDesign(<Document><Html html="<p>Words</p>" /></Document>).report.join("\n")).toContain(missing);
    expect(toDesign(<Email>{layer}</Email>).report.join("\n")).toContain("it can be moved, not edited");
    expect(toDesign(<Email><Html html="<p>Words</p>" /></Email>).report).toEqual([]);
  });

  it("writes a Text as the builder's paragraph, its rich text holding its runs: their styles, a link's target, title and label", () => {
    const { design, report } = toDesign(
      <Email>
        <Text>
          Plain <Span style={{ color: "#ff0000", fontSize: 20 }}>red</Span>
          <LineBreak />
          <Link href={{ href: "https://x.test/", target: "_blank" }} title="A title" aria-label="A label" style={{ color: "#00aa00" }}>
            there
          </Link>
        </Text>
      </Email>
    );
    expect(report).toEqual([]);
    const [block] = blocks(design);
    expect(block.type).toBe("paragraph");
    expect(block.values.text).toBeUndefined();
    const [{ children }] = JSON.parse(block.values.textJson).root.children;
    expect(children.map((child: any) => [child.type, child.text ?? child.url, child.style])).toEqual([
      ["extended-text", "Plain ", ""],
      ["extended-text", "red", "color:#ff0000;font-size:20px"],
      ["linebreak", undefined, undefined],
      ["extended-link", "https://x.test/", "color:#00aa00"],
    ]);
    const back = collectTemplate(fromDesign(JSON.parse(JSON.stringify(design))).element).document!.root.children![0] as any;
    expect(back.children[3]).toMatchObject({ type: "Link", props: { href: { href: "https://x.test/", target: "_blank" }, title: "A title", "aria-label": "A label" } });
  });
  it("keeps a link's own color over the Span around it", () => {
    const { design } = toDesign(
      <Email>
        <Text>
          <Span style={{ color: "#ffffff", fontWeight: 700 }}>
            <Link href="https://x.test/" style={{ color: "#000000" }}>
              Reset
            </Link>
          </Span>
        </Text>
      </Email>
    );
    const [{ children: [link] }] = JSON.parse(blocks(design)[0].values.textJson).root.children;
    expect(link.style).toBe("color:#000000");
    expect(link.children[0].style).toBe("color:#000000;font-weight:700");
    const back = collectTemplate(fromDesign(JSON.parse(JSON.stringify(design))).element).document!.root.children![0];
    expect(JSON.stringify(back)).not.toContain("#ffffff");
  });
  it("writes lines above and below a Row as Dividers in rows of their own, in from the space around it, level whatever its alignItems", () => {
    const row = (style: Record<string, unknown>) => (
      <Row style={{ border: { top: "1px solid #000000", bottom: "2px dashed #ff0000" }, padding: [14, 0], ...style }}>
        <Column><Text>a</Text></Column>
        <Column><Text>b</Text></Column>
      </Row>
    );
    const { design, report } = toDesign(<Email><Section style={{ backgroundColor: "#eeeeee", padding: [10, 48, 20] }}>{row({ alignItems: "end" })}</Section></Email>);
    expect(report).toEqual([]);
    const [above, middle, below] = design.body.rows;
    expect(design.body.rows).toHaveLength(3);
    expect(above.columns[0].contents[0]).toMatchObject({ type: "divider", values: { containerPadding: "10px 48px 0px", width: "100%", border: { borderTopWidth: "1px", borderTopStyle: "solid", borderTopColor: "#000000" } } });
    expect(below.columns[0].contents[0]).toMatchObject({ type: "divider", values: { containerPadding: "0px 48px 20px", border: { borderTopWidth: "2px", borderTopStyle: "dashed", borderTopColor: "#ff0000" } } });
    expect(middle.values.padding).toBe("14px 0px 14px 0px");
    for (const column of middle.columns) expect(column.values.border).toEqual({});
    // Each row of it is in the Section's band.
    expect([above, middle, below].map((part) => part.values.backgroundColor)).toEqual(["#eeeeee", "#eeeeee", "#eeeeee"]);
    // Back and written again, it's the same rows, not more.
    expect(toDesign(fromDesign(JSON.parse(JSON.stringify(design))).element).design.body.rows).toHaveLength(3);
  });
  it("says where the builder can't draw a Row's border as it's written: sides of it on its columns, which fill the row and move with alignItems", () => {
    const row = (style: Record<string, unknown>) => (
      <Row style={{ border: { left: "1px solid #000000" }, ...style }}>
        <Column><Text>a</Text></Column>
        <Column><Text>b</Text></Column>
      </Row>
    );
    expect(toDesign(<Email>{row({})}</Email>).report).toEqual([]);
    expect(toDesign(<Email><Section style={{ padding: [0, 48] }}>{row({})}</Section></Email>).report).toEqual(["root.children[0].children[0]: the builder draws a Row's border on its columns, which fill the row: the 48px around the Row goes inside the line, so the line is as wide as the row"]);
    expect(toDesign(<Email>{row({ alignItems: "end" })}</Email>).report).toEqual(["root.children[0]: the builder draws a Row's border on its columns, which alignItems moves: each part of the line is at its column's height"]);
    expect(toDesign(<Email>{row({ alignItems: "stretch" })}</Email>).report).toEqual([]);
  });

  it("takes an Email, a Page or a Document, which the builder edits", () => {
    expect(() =>
      toDesign(
        <Canvas width={600} height={315}>
          <Text>Hi</Text>
        </Canvas>
      )
    ).toThrow("the builder edits an Email, a Page or a Document, not a Canvas");
    expect(() => toDesign(<Email><Row>{"text in a row" as never}</Row></Email>)).toThrow("This template can't go to the builder");
  });

  it("writes a Section of several Rows as rows in its band, its border the part around each", () => {
    const { design } = toDesign(
      <Email>
        <Section style={{ backgroundColor: "#eeeeee", border: "2px solid #000000", padding: 10 }} hidden={{ mobile: true }}>
          <Text>One</Text>
          <Row>
            <Column>
              <Text>Two</Text>
            </Column>
          </Row>
          <PageFooterless />
        </Section>
      </Email>
    );
    const rows = design.body.rows.map((row) => row.values);
    expect(rows.map((row) => row.backgroundColor)).toEqual(["#eeeeee", "#eeeeee", "#eeeeee"]);
    expect(rows.map((row) => Object.keys(row.sectionBorder ?? {}).filter((key) => key.endsWith("Width")).map((key) => key.slice(6, -5)).sort())).toEqual([["Left", "Right", "Top"], ["Left", "Right"], ["Bottom", "Left", "Right"]]);
    expect(rows.map((row) => row._override?.mobile?.hideMobile)).toEqual([true, true, true]);
  });
});

/** Another run of blocks after a Row. */
function PageFooterless() {
  return <Text>Three</Text>;
}

describe("a Table", () => {
  const tables = (design: any) => blocks(design).filter((content) => content.type === "table");
  /** A cell's words, as the builder's editor writes its rich text out. */
  const words = (cell: Values) => textJsonHtml(cell.textJson).html.replace(/<[^>]+>/g, "");
  const table = (
    <Table>
      <TableRow>
        <TableCell>Words</TableCell>
      </TableRow>
    </Table>
  );

  it("is the builder's table in an Email, a Page and a Document", () => {
    for (const root of [<Email key="e">{table}</Email>, <Page key="p">{table}</Page>, <Document key="d">{table}</Document>]) {
      const { design, report } = toDesign(root);
      const [only] = tables(design);
      expect(blocks(design).map((content) => content.type)).toEqual(["table"]);
      expect(only.values.table.rows[0].cells.map(words)).toEqual(["Words"]);
      expect(report).toEqual([]);
    }
  });

  it("is the builder's table in an Email or a Page where it draws it as it is: lines all round collapsed, a full width, a column's share, cells' own styles", () => {
    const line = "1px solid #d1d5db";
    const exact = (
      <Table style={{ width: "100%", borderCollapse: "collapse", backgroundColor: "#ffffff", cellPadding: 6 }}>
        <TableRow header>
          <TableCell style={{ border: line, width: "60%" }}>Item</TableCell>
          <TableCell style={{ border: line, textAlign: "right" }}>Amount</TableCell>
        </TableRow>
        <TableRow>
          <TableCell style={{ border: line, color: "#6b7280" }}>Hosting</TableCell>
          <TableCell style={{ border: line, textAlign: "right", backgroundColor: "#fef3c7", padding: 8 }}>$49.00</TableCell>
        </TableRow>
        <TableRow footer>
          <TableCell style={{ border: line }}>Total</TableCell>
          <TableCell style={{ border: line, textAlign: "right" }}>$49.00</TableCell>
        </TableRow>
      </Table>
    );
    for (const root of [<Email key="e">{exact}</Email>, <Page key="p">{exact}</Page>]) {
      const { design, report } = toDesign(root);
      const [only] = tables(design);
      expect(report).toEqual([]);
      expect(blocks(design).map((content) => content.type)).toEqual(["table"]);
      expect(only.values.table.rows[0].cells).toMatchObject([{ color: "#6b7280", width: 60 }, { textAlign: "right", backgroundColor: "#fef3c7", padding: "8px", width: 40 }]);
    }
  });

  it("is the builder's table where every column has a width, which Elements draws as shares of the table", () => {
    const sized = (
      <Table>
        <TableRow>
          <TableCell style={{ width: 100 }}>A</TableCell>
          <TableCell style={{ width: 300 }}>B</TableCell>
        </TableRow>
      </Table>
    );
    for (const root of [<Email key="e" width={600}>{sized}</Email>, <Page key="p" width={600}>{sized}</Page>]) {
      const { design, report } = toDesign(root);
      expect(report).toEqual([]);
      expect(tables(design)[0].values.table.rows[0].cells.map((cell: Values) => cell.width)).toEqual([25, 75]);
    }
  });

  it("writes columns' percentages as their shares, as they're given, not as the whole pixels Elements lays them out in", () => {
    const shares = (template: React.ReactElement) => tables(toDesign(template).design)[0].values.table.rows[0].cells.map((cell: Values) => cell.width);
    const given = (...widths: Array<string | undefined>) => (
      <Table>
        <TableRow>
          {widths.map((width, i) => (
            <TableCell key={i} style={width ? { width } : {}}>
              {i}
            </TableCell>
          ))}
        </TableRow>
      </Table>
    );
    for (const [Root, mode] of [[Email, "email"], [Page, "web"], [Document, "document"]] as const) {
      for (const [widths, expected] of [[["60%", "20%", "20%"], [60, 20, 20]], [["30%", undefined, undefined], [30, 35, 35]], [["49.8%", undefined], [49.8, 50.2]], [["30%", "30%"], [50, 50]]] as const) {
        const template = <Root>{given(...widths)}</Root>;
        expect(shares(template)).toEqual(expected);
        // And again after a trip: a share comes back as its percentage, which is written as it is.
        expect(shares(fromDesign(toDesign(template).design, { displayMode: mode }).element)).toEqual(expected);
      }
    }
  });

  it("writes a column with no width beside wider ones as the least share the builder keeps, which takes a share of 0 for its default", () => {
    const narrow = (
      <Table>
        <TableRow>
          <TableCell style={{ width: "0%" }}>A</TableCell>
          <TableCell style={{ width: "100%" }}>B</TableCell>
        </TableRow>
      </Table>
    );
    for (const root of [<Email key="e">{narrow}</Email>, <Page key="p">{narrow}</Page>, <Document key="d">{narrow}</Document>]) {
      const { design, report } = toDesign(root);
      expect(report).toEqual([]);
      expect(tables(design)[0].values.table.rows[0].cells.map((cell: Values) => cell.width)).toEqual([0.01, 100]);
    }
  });

  it("writes a row's height of 0, which the builder takes for its default, as the least its words need", () => {
    const zero = (
      <Table>
        <TableRow>
          <TableCell>A</TableCell>
        </TableRow>
        <TableRow style={{ height: 0 }}>
          <TableCell>B</TableCell>
        </TableRow>
      </Table>
    );
    for (const root of [<Email key="e">{zero}</Email>, <Page key="p">{zero}</Page>, <Document key="d">{zero}</Document>]) {
      const { design, report } = toDesign(root);
      const [first, second] = tables(design)[0].values.table.rows;
      expect(report).toEqual([]);
      expect(second.height).toBeGreaterThan(0);
      expect(second.height).toBe(first.height);
    }
  });

  it("says a Document's empty cell is a line tall in the builder's table where that's taller than its row; one as tall as a line of its own isn't", () => {
    const blank = (
      <Table>
        <TableRow>
          <TableCell>A</TableCell>
        </TableRow>
        <TableRow>
          <TableCell />
        </TableRow>
        <TableRow style={{ height: 40 }}>
          <TableCell />
        </TableRow>
      </Table>
    );
    const { design, report } = toDesign(<Document>{blank}</Document>);
    expect(tables(design)).toHaveLength(1);
    // The empty row's height is the Table's (none, 1px: the builder takes 0 for its default), its own the other's.
    expect(tables(design)[0].values.table.rows.map((row: Values) => row.height)).toEqual([24, 1, 40]);
    // Read back, the row's own height comes back and the 1px given to the empty row doesn't.
    const { code } = fromDesign(JSON.parse(JSON.stringify(design)), { displayMode: "document" });
    expect(code).toContain("height: 40");
    expect(code).not.toMatch(/height: 1\b/);
    expect(report).toEqual(["root.children[0].children[1]: an empty cell is a line tall in the builder's table and as tall as its padding in the Table, so the row is taller in the builder's"]);
    // In an Email, the row as tall as a line of its own is drawn as it is: the one with no height is the HTML block's reason.
    expect(toDesign(<Email>{blank}</Email>).report).toEqual(["root.children[0]: the builder's table doesn't draw it as it is (an empty cell, a line tall in the builder's): it's an HTML block of its own markup in the builder (it can be moved, not edited)"]);
    // An empty cell of a larger size beside words is taller than they are in the builder.
    const beside = (
      <Table>
        <TableRow>
          <TableCell style={{ fontSize: 80, padding: 10 }} />
          <TableCell>A</TableCell>
        </TableRow>
      </Table>
    );
    expect(toDesign(<Document>{beside}</Document>).report).toEqual(["root.children[0].children[0]: an empty cell is a line tall in the builder's table and as tall as its padding in the Table, so the row is taller in the builder's"]);
    const tall = (
      <Table>
        <TableRow>
          <TableCell>A</TableCell>
        </TableRow>
        <TableRow style={{ height: 40 }}>
          <TableCell />
        </TableRow>
      </Table>
    );
    expect(toDesign(<Email>{tall}</Email>).report).toEqual([]);
    // A non-breaking space is a word: it doesn't collapse, so its cell is a line tall in the Table too, as in the
    // builder's (a space alone collapses to none).
    const nbsp = (
      <Table>
        <TableRow>
          <TableCell>{" "}</TableCell>
        </TableRow>
      </Table>
    );
    const spaced = toDesign(<Document>{nbsp}</Document>);
    expect(spaced.report).toEqual([]);
    expect(tables(spaced.design)[0].values.table.rows.map((row: Values) => row.height)).toEqual([24]);
    expect(toDesign(<Email>{nbsp}</Email>).report).toEqual([]);
    // Read back, a row a line tall is no taller than its words: it has no height of its own.
    expect(fromDesign(JSON.parse(JSON.stringify(spaced.design)), { displayMode: "document" }).code).not.toContain("height:");
  });

  it("stays an HTML block in an Email or a Page where the builder's table doesn't draw it as it is, and says why", () => {
    const line = "1px solid #e5e7eb";
    const row = (a: string, b: string, props: Record<string, unknown> = {}) => (
      <TableRow {...props}>
        <TableCell>{a}</TableCell>
        <TableCell>{b}</TableCell>
      </TableRow>
    );
    const lined = (border: Record<string, unknown> | string) => (
      <TableRow>
        <TableCell style={{ border }}>A</TableCell>
        <TableCell style={{ border }}>1</TableCell>
      </TableRow>
    );
    const cases: Array<[string, React.ReactElement]> = [
      ["a line between rows only", <Table style={{ rowBorder: line }}>{row("A", "1")}{row("B", "2")}</Table>],
      ["lines on some sides of its cells only", <Table>{lined({ bottom: line })}{row("B", "2")}</Table>],
      ["two lines between cells side by side", <Table>{lined(line)}</Table>],
      ["a border around it", <Table style={{ border: line }}>{row("A", "1")}</Table>],
      ["its width", <Table style={{ width: 300 }}>{row("A", "1")}</Table>],
      ["its maxWidth", <Table style={{ maxWidth: 300 }}>{row("A", "1")}</Table>],
      ["its mobile.width", <Table style={{ mobile: { width: 300 } }}>{row("A", "1")}</Table>],
      ["its mobile.maxWidth", <Table style={{ mobile: { maxWidth: 300 } }}>{row("A", "1")}</Table>],
      ["its mobile.border", <Table style={{ mobile: { border: line } }}>{row("A", "1")}</Table>],
      ["a column of a fixed width", <Table><TableRow><TableCell style={{ width: 100 }}>A</TableCell><TableCell>1</TableCell></TableRow></Table>],
      ["a cell spanning columns", <Table>{row("A", "1")}<TableRow><TableCell colSpan={2}>Both</TableCell></TableRow></Table>],
      ["a row with fewer cells than its columns", <Table>{row("A", "1")}<TableRow><TableCell>One</TableCell></TableRow></Table>],
      ["a header row below its first rows", <Table>{row("A", "1")}{row("Sub", "head", { header: true })}</Table>],
      ["a cell's mobile.padding", <Table><TableRow><TableCell style={{ mobile: { padding: 4 } }}>A</TableCell></TableRow></Table>],
      ["its mobile.fontSize", <Table style={{ mobile: { fontSize: 12 } }}>{row("A", "1")}</Table>],
      ["a link's hover", <Table><TableRow><TableCell><Link href="https://example.com" style={{ hover: { color: "#ff0000" } }}>Link</Link></TableCell></TableRow></Table>],
      ["a row's id", <Table><TableRow id="first">{[<TableCell key="a">A</TableCell>]}</TableRow></Table>],
      ["an empty cell, a line tall in the builder's", <Table>{row("A", "1")}<TableRow><TableCell /><TableCell> </TableCell></TableRow></Table>],
      ["an empty cell, a line tall in the builder's", <Table><TableRow><TableCell style={{ fontSize: 80, padding: 10 }} /><TableCell>A</TableCell></TableRow></Table>],
      ["a half-transparent background", <Table style={{ backgroundColor: "#ffffff" }}>{row("A", "1", { style: { backgroundColor: "rgba(0, 0, 0, 0.05)" } })}</Table>],
      ["a half-transparent background", <Table style={{ backgroundColor: "#00000080" }}>{row("A", "1")}</Table>],
      ["a half-transparent background", <Table><TableRow><TableCell style={{ backgroundColor: "rgba(255, 0, 0, 0.5)" }}>A</TableCell></TableRow></Table>],
    ];
    for (const [why, table] of cases) {
      for (const root of [<Email key="e">{table}</Email>, <Page key="p">{table}</Page>]) {
        const { design, report } = toDesign(root);
        expect(blocks(design).map((content) => content.type), why).toEqual(["html"]);
        expect(report, why).toEqual([`root.children[0]: the builder's table doesn't draw it as it is (${why}): it's an HTML block of its own markup in the builder (it can be moved, not edited)`]);
      }
    }
  });

  it("stays an HTML block where a row, a cell or words in a cell are hidden on phones or on desktops, which the builder's table can't do", () => {
    const hiding = [
      <Table key="row">
        <TableRow>
          <TableCell>Shown</TableCell>
        </TableRow>
        <TableRow hidden={{ mobile: true }}>
          <TableCell>Desktops only</TableCell>
        </TableRow>
      </Table>,
      <Table key="cell">
        <TableRow>
          <TableCell>Shown</TableCell>
          <TableCell hidden={{ desktop: true }}>Phones only</TableCell>
        </TableRow>
      </Table>,
      <Table key="words">
        <TableRow>
          <TableCell>
            Shown <Span hidden={{ mobile: true }}>on desktops only</Span>
          </TableCell>
        </TableRow>
      </Table>,
    ];
    for (const hidden of hiding) {
      for (const root of [<Email key="e">{hidden}</Email>, <Page key="p">{hidden}</Page>]) {
        const { design, report } = toDesign(root);
        expect(blocks(design).map((content) => content.type)).toEqual(["html"]);
        expect(report).toEqual(["root.children[0]: a table row, cell or words in a cell hidden on phones or on desktops isn't something the builder's table holds: it's an HTML block of its own markup in the builder (it can be moved, not edited)"]);
      }
    }
  });

  it("writes its header, rows and footer, each cell's words, and each column's share of its width", () => {
    const [items] = tables(toDesign(lineItems).design);
    const { headers, rows, footers } = items.values.table;
    expect([headers.length, rows.length, footers.length]).toEqual([1, 2, 1]);
    expect(items.values).toMatchObject({ enableHeader: true, enableFooter: true, repeatHeaderOnEachPage: true, repeatFooterOnEachPage: true, columns: 3, rows: 2 });
    expect([...headers, ...rows, ...footers].map((row: Values) => row.cells.map(words))).toEqual([
      ["Item", "Qty", "Amount"],
      ["Design review", "2", "$200.00"],
      ["HostingMonthly", "1", "$49.00"],
      ["Total", "", "$249.00"],
    ]);
    // The first column is 60% of the table; the others share the rest.
    expect(headers[0].cells.map((cell: Values) => cell.width)).toEqual([60, 20, 20]);
  });

  it("writes what a part's rows share as the table's fields, and a cell's own styles where they differ", () => {
    const [items] = tables(toDesign(lineItems).design);
    const values = items.values;
    expect(values).toMatchObject({
      headerBackgroundColor: "#f3f4f6",
      headerColor: "#374151",
      headerFontWeight: 700,
      contentBackgroundColor: "#ffffff",
      contentColor: "#111827",
      contentFontSize: "13px",
      contentLineHeight: "150%",
      contentPadding: "6px 8px",
      contentVerticalAlign: "top",
      footerFontWeight: 700,
    });
    const [, hosting] = values.table.rows;
    expect(hosting.cells[1]).toMatchObject({ verticalAlign: "middle" });
    expect(hosting.cells[2]).toMatchObject({ textAlign: "right", color: "#b91c1c" });
    // A size its footer's field doesn't say is its paragraph's own (so its lines are its size's); a header's or footer's
    // line height is its own, a multiple as it's given, which each run's size multiplies.
    const total = values.table.footers[0].cells[2];
    expect(JSON.parse(total.textJson).root.children[0].style).toBe("font-size:15px;line-height:1.5");
    // Each row at least as tall as its words' line and padding: 19.5px and 12px.
    expect(values.table.rows.map((row: Values) => row.height)).toEqual([32, 32]);
  });

  it("shares a header's or a footer's background only where all its rows have it: a painted row's is its cells' own, and a clear one shows the table's", () => {
    const painted = (behind?: string) => (
      <Table style={behind ? { backgroundColor: behind } : {}}>
        <TableRow header style={{ backgroundColor: "#111111", color: "#ffffff" }}>
          <TableCell>Title</TableCell>
        </TableRow>
        <TableRow header style={{ color: "#111111" }}>
          <TableCell>Labels</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Body</TableCell>
        </TableRow>
        <TableRow footer style={{ backgroundColor: "#111111", color: "#ffffff" }}>
          <TableCell>Total</TableCell>
        </TableRow>
        <TableRow footer style={{ color: "#111111" }}>
          <TableCell>Note</TableCell>
        </TableRow>
      </Table>
    );
    for (const behind of [undefined, "#eeeeee"]) {
      for (const [root, mode] of [[<Email key="e">{painted(behind)}</Email>, "email"], [<Page key="p">{painted(behind)}</Page>, "web"], [<Document key="d">{painted(behind)}</Document>, "document"]] as const) {
        const { design, report } = toDesign(root);
        expect(report).toEqual([]);
        const { values } = tables(design)[0];
        // The builder paints a part's field behind all its rows (its canvas on the <thead>, its HTML on each cell): the
        // table's, so the clear row shows it, the painted row its own on its cells.
        expect([values.headerBackgroundColor, values.footerBackgroundColor]).toEqual([behind ?? "", behind ?? ""]);
        for (const part of [values.table.headers, values.table.footers]) expect(part.map((row: Values) => row.cells[0].backgroundColor)).toEqual(["#111111", undefined]);
        // Read back, the clear rows are clear again: their words are on the table's background, not the dark one.
        const back = fromDesign(JSON.parse(JSON.stringify(design)), { displayMode: mode }).code;
        expect(back.match(/#111111/g)).toHaveLength(4);
        expect(back).not.toMatch(/<TableRow header style=\{\{ color: "#111111"[^}]*backgroundColor/);
      }
    }
  });

  it("gives a cell with a run of its own size its line height as a multiple, which the builder multiplies by each run's size as Elements does", () => {
    const { design } = toDesign(
      <Document>
        <Table>
          <TableRow>
            <TableCell>
              <Span style={{ fontSize: 24 }}>Large</Span> amount
            </TableCell>
            <TableCell>Plain</TableCell>
          </TableRow>
        </Table>
      </Document>
    );
    const [large, plain] = tables(design)[0].values.table.rows[0].cells;
    // The content's 150% is a length its words inherit in the builder: 24px lines for 24px words, 36px in Elements.
    expect(JSON.parse(large.textJson).root.children[0].style).toBe("line-height:1.5");
    expect(JSON.parse(plain.textJson).root.children[0].style).toBeUndefined();
  });

  it("writes the line between rows as the builder's border, which it says the builder draws above and below the table too", () => {
    const { design, report } = toDesign(lineItems);
    const [items] = tables(design);
    expect(items.values.border).toMatchObject({ borderTopWidth: "1px", borderTopColor: "#e5e7eb", borderBottomWidth: "1px", borderLeftWidth: "0px", borderRightWidth: "0px" });
    expect(report).toContain("root.children[1]: the line between rows is drawn above the first row and below the last one too in the builder's table, which draws its lines around each row");
  });

  it("writes cells with the same lines all round as the builder's border, their padding and background each cell's", () => {
    const [, due] = tables(toDesign(lineItems).design);
    expect(due.values.border).toEqual({ borderTopWidth: "1px", borderTopStyle: "solid", borderTopColor: "#9ca3af", borderRightWidth: "1px", borderRightStyle: "solid", borderRightColor: "#9ca3af", borderBottomWidth: "1px", borderBottomStyle: "solid", borderBottomColor: "#9ca3af", borderLeftWidth: "1px", borderLeftStyle: "solid", borderLeftColor: "#9ca3af" });
    expect(due.values.contentPadding).toBe("0px");
    expect(due.values.table.rows[0].cells).toMatchObject([{ padding: "4px" }, { padding: "4px", backgroundColor: "#fef3c7" }]);
  });

  it("says cells' lines side by side are one line in the builder's table, two in a Table that doesn't collapse them, and keeps them two read back", () => {
    const line = "1px solid #9ca3af";
    const { design, report } = toDesign(
      <Document>
        <Table>
          <TableRow>
            <TableCell style={{ border: line }}>A</TableCell>
            <TableCell style={{ border: line }}>B</TableCell>
          </TableRow>
        </Table>
      </Document>
    );
    const [grid] = tables(design);
    expect(grid.values.border).toMatchObject({ borderTopWidth: "1px", borderLeftWidth: "1px", borderRightWidth: "1px", borderBottomWidth: "1px" });
    expect(grid.values.borderCollapse).toBe("separate");
    expect(report).toEqual(["root.children[0]: the lines of cells side by side are one line in the builder's table, two in the Table (its borderCollapse isn't collapse)"]);
    expect(fromDesign(JSON.parse(JSON.stringify(design)), { displayMode: "document" }).code).toContain('borderCollapse: "separate"');
  });

  it("keeps a table of header rows only as the builder's header, with no rows of its own", () => {
    const { design, report } = toDesign(
      <Document>
        <Table>
          <TableRow header>
            <TableCell>Words</TableCell>
          </TableRow>
        </Table>
      </Document>
    );
    const [only] = tables(design);
    expect(only.values).toMatchObject({ enableHeader: true, rows: 0, headerFontWeight: 700 });
    expect(only.values.table.headers[0].cells.map(words)).toEqual(["Words"]);
    expect(only.values.table.rows).toEqual([]);
    expect(report).toEqual([]);
  });

  it("says what the builder's table can't hold: a cell across columns, a row short of cells, lines on some cells only", () => {
    const { design, report } = toDesign(
      <Document>
        <Table>
          <TableRow>
            <TableCell colSpan={2} style={{ border: "1px solid #000000" }}>
              Wide
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>A</TableCell>
            <TableCell>B</TableCell>
            <TableCell>C</TableCell>
          </TableRow>
        </Table>
      </Document>
    );
    const [wide] = tables(design);
    expect(wide.values.table.rows.map((row: Values) => row.cells.map(words))).toEqual([
      ["Wide", "", ""],
      ["A", "B", "C"],
    ]);
    expect(report).toEqual([
      "root.children[0]: its cells' borders aren't one border around every cell, the only one the builder's table draws: left out",
      "root.children[0]: a cell spanning columns is a cell for each column in the builder's table, its words in the first: the builder's table has no cells across columns",
      "root.children[0]: a row with fewer cells than the table's columns has empty cells in the builder's table, to make up its columns",
    ]);
  });

  it("keeps a table with an image in a cell, linked or not, as an HTML block, and says why", () => {
    const image = <Image src={{ src: "https://x.test/a.png", width: 20, height: 20 }} alt="A" />;
    for (const inCell of [image, <Link key="l" href="https://x.test">{image}</Link>]) {
      const { design, report } = toDesign(
        <Document>
          <Table>
            <TableRow>
              <TableCell>{inCell}</TableCell>
            </TableRow>
          </Table>
        </Document>
      );
      expect(blocks(design).map((content) => content.type)).toEqual(["html"]);
      expect(report[0]).toMatch(/^root\.children\[0\]: an Image in a table cell isn't something the builder's table holds: it's an HTML block/);
    }
  });

  it("says a header row below the table's first rows, in its rows or its footer, is a row of the builder's table, which has its header at its top", () => {
    const { design, report } = toDesign(
      <Document>
        <Table>
          <TableRow>
            <TableCell>Body</TableCell>
          </TableRow>
          <TableRow header>
            <TableCell>Subheading</TableCell>
          </TableRow>
          <TableRow header footer>
            <TableCell>Closing heading</TableCell>
          </TableRow>
        </Table>
      </Document>
    );
    const [grouped] = tables(design);
    expect(grouped.values.table.rows.map((row: Values) => row.cells.map(words))).toEqual([["Body"], ["Subheading"]]);
    expect(report).toEqual([1, 2].map((row) => `root.children[0].children[${row}]: a header row below the table's first rows is a row of the builder's table, its words in bold: the builder's table has its header at its top only`));
  });

  it("says a row below a footer row is in the builder's footer, as it's in Elements', and comes back a footer row", () => {
    const ending = (
      <Table>
        <TableRow>
          <TableCell>Body</TableCell>
        </TableRow>
        <TableRow footer>
          <TableCell>Total</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Note</TableCell>
        </TableRow>
      </Table>
    );
    for (const [root, mode] of [[<Email key="e">{ending}</Email>, "email"], [<Page key="p">{ending}</Page>, "web"], [<Document key="d">{ending}</Document>, "document"]] as const) {
      const { design, report } = toDesign(root);
      // Drawn as it is (Elements' footer runs from its first footer row on too), so it's the builder's table everywhere.
      const [ended] = tables(design);
      expect(ended.values.table.footers.map((row: Values) => row.cells.map(words))).toEqual([["Total"], ["Note"]]);
      expect(report).toEqual(["root.children[0].children[2]: a row below a footer row is a row of the builder's footer, which runs from the first footer row on as Elements' does: it comes back a footer row"]);
      expect(fromDesign(JSON.parse(JSON.stringify(design)), { displayMode: mode }).code.match(/<TableRow footer/g)).toHaveLength(2);
    }
  });

  it("says a row's and a cell's id, which the builder's table has no place for, are left out", () => {
    const { report } = toDesign(
      <Document>
        <Table>
          <TableRow id="details">
            <TableCell id="first">Words</TableCell>
          </TableRow>
        </Table>
      </Document>
    );
    expect(report).toEqual([
      "root.children[0].children[0]: the builder's table has no place for a row's id: left out",
      "root.children[0].children[0].children[0]: the builder's table has no place for a cell's id: left out",
    ]);
  });

  it("gives a table's fonts the root has their stylesheet, as the builder loads one, and says one it hasn't", () => {
    const face = { family: "Geist", src: "https://fonts.example/geist.woff2", format: "woff2", weight: "100 900" } as const;
    const { design } = toDesign(<Document fonts={[face]}>{<Table style={{ fontFamily: "Geist, Arial, sans-serif" }}><TableRow><TableCell>Words</TableCell></TableRow></Table>}</Document>);
    const [held] = tables(design);
    expect(decodeURIComponent(held.values.contentFontFamily.url)).toContain("src:url(https://fonts.example/geist.woff2)");
    expect(fromDesign(design, { displayMode: "document" }).report.join("\n")).not.toContain("web fonts");
    const other = JSON.parse(JSON.stringify(design));
    tables(other)[0].values.headerFontFamily = { label: "Lora", value: "Lora, serif", url: "https://fonts.example/lora.css" };
    expect(fromDesign(other, { displayMode: "document" }).report.join("\n")).toContain("Lora: web fonts the builder loads from a stylesheet");
  });

  it("comes back from the builder as the Table it was", () => {
    const { design } = toDesign(lineItems);
    const { code, report } = fromDesign(JSON.parse(JSON.stringify(design)), { displayMode: "document" });
    expect(report).toEqual([]);
    expect(code).toContain("<TableRow header");
    expect(code).toContain("<TableRow footer");
    expect(code).toContain("cellPadding: [6, 8, 6, 8]");
    expect(code).toContain('width: "60%"');
    // Its background is the table's again, under the header's own.
    expect(code).toMatch(/<Table style=\{\{[^}]*backgroundColor: "#ffffff"/);
    expect(code).not.toContain("height:");
  });

  it("reads a header's or a footer's words with no line height of their own at the page's, as the builder draws them, not the content's", () => {
    // The builder's own table, from its palette: its header's and footer's cells have none (only its content has a field).
    const palette = (edit: (values: Values) => void = () => {}) => {
      const design = JSON.parse(JSON.stringify(toDesign(<Email>{table}</Email>).design));
      const content = blocks(design)[0];
      content.values = { ...JSON.parse(JSON.stringify(TableDefaults)), _meta: content.values._meta, enableFooter: true };
      content.values.table.footers[0].cells[0] = { ...content.values.table.rows[0].cells[0] };
      edit(content.values);
      return design;
    };
    // The builder's HTML draws them at its body's: 1.5 on a page, the browser's normal in an email and a document.
    for (const [mode, page] of [["email", '"normal"'], ["web", "1.5"], ["document", '"normal"']] as const) {
      const { code, report } = fromDesign(palette(), { displayMode: mode });
      expect(report).toEqual([]);
      expect(code.match(/<TableRow (header|footer) style=\{\{[^}]*lineHeight: ([^,}]+)/g)?.map((row) => row.replace(/.*lineHeight: /, ""))).toEqual([page, page]);
      expect(code).toContain("lineHeight: 1.4");
      expect(code.match(/lineHeight/g)).toHaveLength(3);
    }
    // A cell with one of its own beside one with none: each its own.
    const mixed = palette((values) => {
      const [first] = values.table.headers[0].cells;
      values.table.headers[0].cells[1] = { ...first, textJson: first.textJson.replace('"type":"extended-paragraph"', '"type":"extended-paragraph","style":"line-height:1.4"') };
    });
    expect(JSON.stringify(mixed)).toContain("line-height:1.4");
    const read = fromDesign(mixed, { displayMode: "email" }).code;
    expect(read).toMatch(/<TableRow header style=\{\{ backgroundColor: "#dddddd", height: 50 \}\}>\s*<TableCell style=\{\{[^}]*lineHeight: "normal" \}\}>Add header text<\/TableCell>\s*<TableCell style=\{\{ verticalAlign: "middle", border: "1px solid #cccccc" \}\}>Add header text/);
  });
});

describe("a link's window", () => {
  it("stays where a template gives no target, where the builder's default is a new one, and comes back with none", () => {
    const { design } = toDesign(<Email><Button href="https://example.com">Go</Button></Email>);
    expect(JSON.stringify(design)).toContain('"href":{"name":"web","values":{"href":"https://example.com","target":"_self"}}');
    expect(fromDesign(design, { displayMode: "email" }).code).toMatch(/href="https:\/\/example\.com"/);
  });
});

describe("a custom component that's a band of its own", () => {
  it("goes to the builder as an HTML block, where it's placed as it was", () => {
    const Hero = component({ type: "acme.Hero", label: "Hero", placement: "section", props: { title: prop.text({ label: "Title", required: true }) }, render: ({ title }) => <Section><Heading>{title}</Heading></Section> });
    const { design, report } = toDesign(<Email><Hero title="Launch" /></Email>);
    expect(JSON.stringify(design)).toContain("Launch");
    expect(report.join("\n")).toContain("HTML block");
  });
});

describe("what the builder can't hold", () => {
  const said = (element: React.ReactElement) => toDesign(element).report.join("\n");

  it("keeps an Image in a run of text, as an HTML block of its own", () => {
    const { design, report } = toDesign(<Email><Text>Rated <Image src={{ src: "https://x.test/s.png", width: 80, height: 16 }} alt="five stars" /> by customers</Text></Email>);
    expect(report.join("\n")).toContain("an Image in a run of text");
    expect(JSON.stringify(design)).toContain("five stars");
  });

  it("says what it leaves out of text", () => {
    expect(said(<Email><List><ListItem style={{ color: "#654321" }}>a</ListItem></List></Email>)).toContain("list item");
    expect(said(<Email><Text>a <Span style={{ mobile: { fontSize: 20 } }}>b</Span></Text></Email>)).toContain("phone styles");
    expect(said(<Email><Text><Link href="#" attrs={{ "data-x": "1" }}>b</Link></Text></Email>)).toContain("other attributes");
    expect(said(<Email><Text><Link id="x" href="#">b</Link></Text></Email>)).toContain("id on part of its text");
  });

  it("says a Row's and a Section's border on phones, and a plain Column's phone values, are left out", () => {
    expect(said(<Email><Row style={{ mobile: { border: "1px solid #000" } }}><Column><Text>a</Text></Column></Row></Email>)).toContain("no border on phones");
    expect(said(<Email><Section style={{ mobile: { border: "1px solid #000" } }}><Text>a</Text></Section></Email>)).toContain("no border on phones");
    expect(said(<Email><Column><Column style={{ mobile: { padding: 4 } }}><Text>a</Text></Column></Column></Email>)).toContain("no phone values");
  });

  it("takes what it can: a header's background, a Column's corners and the ids of rows and columns", () => {
    const back = (element: React.ReactElement, displayMode: "email" | "document" = "email") => JSON.stringify(collectTemplate(fromDesign(JSON.parse(JSON.stringify(toDesign(element).design)), { displayMode }).element).document!.root);
    expect(back(<Document><PageHeader style={{ backgroundColor: "#123456" }}><Text>H</Text></PageHeader><Text>x</Text></Document>, "document")).toContain("#123456");
    expect(back(<Email><Column style={{ backgroundColor: "#eeeeee", borderRadius: { topLeft: 1, topRight: 2, bottomRight: 3, bottomLeft: 4 } }}><Text>a</Text></Column></Email>)).toContain('"topLeft":1');
    expect(back(<Email><Row id="plans"><Column id="left"><Text>a</Text></Column><Column><Text>b</Text></Column></Row></Email>)).toContain('"id":"left"');
    expect(back(<Email><Section id="pricing"><Text>a</Text></Section></Email>)).toContain('"id":"pricing"');
  });
});

describe("a design read back", () => {
  const read = (type: string, values: Record<string, unknown>, columnValues: Record<string, unknown> = {}) => {
    const { element, report } = fromDesign({ body: { values: {}, rows: [{ cells: [1], values: {}, columns: [{ values: columnValues, contents: [{ type, values }] }] }] } }, { displayMode: "email" });
    return { tree: JSON.stringify(collectTemplate(element).document!.root), report };
  };

  it("keeps a video's own picture", () => {
    expect(read("video", { video: { type: "vimeo", videoId: "12345", thumbnail: "https://i.vimeocdn.com/custom.jpg" } }).tree).toContain("custom.jpg");
  });

  it("keeps a social icon with no link, as Elements 0.2's components do", () => {
    expect(read("social", { icons: { iconType: "circle", icons: [{ name: "X", url: "" }, { name: "GitHub", url: "https://x.test" }] } }).tree).toContain('"name":"X"');
  });

  it("reads a button's corners, and says where it can't", () => {
    expect(read("button", { text: "Go", borderRadius: "21px 22px 23px 24px" }).tree).toContain('"topLeft":21');
    const percent = read("button", { text: "Go", borderRadius: "50%" });
    expect(percent.report.join("\n")).toContain("isn't one Elements draws");
  });

  it("reads a column's corners, its height, and what's hidden on phones", () => {
    expect(read("text", { text: "a" }, { backgroundColor: "#eeeeee", borderRadius: "1px 2px 3px 4px" }).tree).toContain('"bottomLeft":4');
    expect(read("text", { text: "a" }, { height: "120px" }).tree).toContain('"height":120');
    expect(read("text", { text: "a" }, { minWidth: "120px" }).tree).toContain('"minWidth":120');
    expect(read("text", { text: "a" }, { maxWidth: "200px", _override: { mobile: { maxWidth: "120px" } } }).tree).toContain('"mobile":{"maxWidth":120');
  });
});

describe("a page number", () => {
  it("says the editor's PDF prints its token, as the builder has no page numbers yet", () => {
    const { report } = toDesign(<Document><PageFooter><Text>Page <PageNumber /></Text></PageFooter><Text>x</Text></Document>);
    expect(report.join("\n")).toContain("the builder has no page numbers yet");
    expect(toDesign(<Document><Text>x</Text></Document>).report.join("\n")).not.toContain("page numbers");
  });
});

describe("a line height", () => {
  const field = (element: React.ReactElement) => blocks(toDesign(<Email>{element}</Email>).design)[0].values as { lineHeight: string; _override?: { mobile?: { lineHeight?: string } } };

  it("is a whole percentage in the builder's field, rounded up, as Chromium draws only a percentage's whole part", () => {
    expect(field(<Text style={{ fontSize: 13, lineHeight: "24px" }}>x</Text>).lineHeight).toBe("185%");
    expect(field(<Text style={{ fontSize: 14, lineHeight: 1.625 }}>x</Text>).lineHeight).toBe("163%");
    expect(field(<Text style={{ fontSize: 16, lineHeight: "24px" }}>x</Text>).lineHeight).toBe("150%");
  });

  it("is one on phones too", () => {
    expect(field(<Text style={{ mobile: { lineHeight: 1.625 } }}>x</Text>)._override?.mobile?.lineHeight).toBe("163%");
  });
});

describe("an Html block", () => {
  it("takes the text styles around it to the builder, whose HTML block has none", () => {
    const { design } = toDesign(<Email><Column style={{ textAlign: "center", color: "#123456", fontSize: 18 }}><Html html="<b>x</b>" /></Column></Email>);
    const html = blocks(design).find((block) => block.type === "html")!.values.html;
    expect(html).toContain("text-align:center");
    expect(html).toContain("color:#123456");
    expect(html).toContain("font-size:18px");
    expect(html).toContain("<b>x</b>");
  });

  it("says the default line height, which the builder's body doesn't give, and comes back without it", () => {
    const { design } = toDesign(<Email><Html html="<b>x</b>" /></Email>);
    expect(blocks(design).find((block) => block.type === "html")!.values.html).toBe('<div style="line-height:1.5"><b>x</b></div>');
    const back = collectTemplate(fromDesign(design, { displayMode: "email" }).element).document!.root;
    expect(JSON.stringify(back)).toContain('"html":"<b>x</b>"');
  });

  it("says a paragraph's margins going to the builder, whose stylesheet takes them away, and none coming from it", () => {
    const written = (html: string) => blocks(toDesign(<Email><Html html={html} /></Email>).design).find((block) => block.type === "html")!.values.html;
    expect(written('<p>a</p><p class="x">b</p>')).toContain('<p style=margin-top:1em;margin-bottom:1em>a</p><p style=margin-top:1em;margin-bottom:1em class="x">b</p>');
    expect(written('<p style="color:red">a</p>')).toContain('<p style="margin-top:1em;margin-bottom:1em;color:red">a</p>');
    expect(written('<p style="margin:5px">a</p><pre>b</pre><picture></picture>')).toContain('<p style="margin:5px">a</p><pre>b</pre><picture></picture>');
    const read = (html: string) => JSON.stringify(collectTemplate(fromDesign({ body: { rows: [{ cells: [1], columns: [{ contents: [{ type: "html", values: { html } }], values: {} }], values: {} }], values: {} } }, { displayMode: "email" }).element).document!.root);
    expect(read("<p>a</p><p/>")).toContain("<p style=margin:0>a</p><p style=margin:0 />");
    expect(read("<p style=\"margin-top:4px\">a</p>")).toContain('<p style=\\"margin:0;margin-top:4px\\">a</p>');
    expect(read("<p style=color:red>a</p>")).toContain("<p style=color:red>a</p>");
  });

  it("changes only a tag that is a paragraph, and adds nothing that ends a value", () => {
    // Text in an attribute, a comment, a script, or after a tag that never closes stays as it is.
    for (const html of [
      '<img src="x" title="<p onerror=alert(1)>">',
      "<img src='x' title='<p onerror=alert(1)>'>",
      "<img alt=<p/onerror=alert(1)>",
      '<img title="<p onerror=alert(1)>',
      "<!-- <p onerror=alert(1)> --><script>var p = '<p>';</script><style>p{}</style><textarea><p></textarea>",
    ]) {
      expect(withParagraphMargin(html, "margin:0")).toBe(html);
    }
    // A paragraph after them is still one.
    expect(withParagraphMargin('<img title="<p>"><!-- <p> --><p>x</p>', "margin:0")).toBe('<img title="<p>"><!-- <p> --><p style=margin:0>x</p>');
  });

  it("gives its margins before a design's markup is sanitized, so what's sanitized is what's drawn", () => {
    const markup = '<img src="x" title="<p onerror=alert(1)>"><p>a</p>';
    // An HTML block, and text kept as its markup (a paragraph with a class of its own).
    for (const block of [{ type: "html", values: { html: markup } }, { type: "text", values: { text: `<p class="c">b</p>${markup}` } }]) {
      const given: string[] = [];
      const toSafeHtml = (html: string) => (given.push(html), html.replace(/onerror=[^\s>]*/g, ""));
      const design = { body: { rows: [{ cells: [1], columns: [{ contents: [block], values: {} }], values: {} }], values: {} } };
      const root = JSON.stringify(collectTemplate(fromDesign(design, { displayMode: "email", toSafeHtml }).element).document!.root);
      expect(given.some((html) => html.includes("<p style=margin:0>a</p>"))).toBe(true);
      expect(root).toContain("<p style=margin:0>a</p>");
      expect(root).not.toContain("onerror");
    }
  });

  it("keeps markup that only starts and ends like that wrapper", () => {
    const markup = '<div style="line-height:1.5">a</div><div>b</div>';
    const design = { body: { rows: [{ cells: [1], columns: [{ contents: [{ type: "html", values: { html: markup } }], values: {} }], values: {} }], values: {} } };
    const back = collectTemplate(fromDesign(design, { displayMode: "email" }).element).document!.root;
    expect(JSON.stringify(back)).toContain(JSON.stringify(markup).slice(1, -1));
  });
});
