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
            <Table style={{ rowBorder: "1px solid #e5e7eb", mobile: { fontSize: 12 } }}>
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

  it("is the builder's table in an Email or a Page with a line between rows only, which is its rowBorder and no border around its cells", () => {
    for (const Root of [Email, Page]) {
      const { design, report } = toDesign(
        <Root>
          <Table style={{ rowBorder: "1px solid #e5e7eb" }}>
            <TableRow>
              <TableCell>A</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>B</TableCell>
            </TableRow>
          </Table>
        </Root>
      );
      expect(report).toEqual([]);
      const [lined] = tables(design);
      expect(lined.values.rowBorder).toEqual({ borderTopWidth: "1px", borderTopStyle: "solid", borderTopColor: "#e5e7eb" });
      expect(Object.entries(lined.values.border).filter(([key]) => key.endsWith("Width"))).toEqual([["borderTopWidth", "0px"], ["borderLeftWidth", "0px"], ["borderRightWidth", "0px"], ["borderBottomWidth", "0px"]]);
      // The line is the table's, not each cell's: no cell has a border of its own, and the lines are drawn the same shared or not.
      expect(lined.values.table.rows.flatMap((row: Values) => row.cells).some((cell: Values) => "border" in cell)).toBe(false);
      expect(lined.values).not.toHaveProperty("borderCollapse");
    }
  });

  it("is the builder's table with lines on some sides of some cells: each cell's own border, and not the line between rows it sits on", () => {
    const line = "2px solid #111827";
    const between = "1px solid #e5e7eb";
    for (const Root of [Email, Page]) {
      const { design, report } = toDesign(
        <Root>
          <Table style={{ rowBorder: between, borderCollapse: "collapse" }}>
            <TableRow>
              <TableCell style={{ border: { top: line } }}>A</TableCell>
              <TableCell style={{ border: { bottom: "none" } }}>B</TableCell>
              <TableCell>C</TableCell>
            </TableRow>
            <TableRow>
              <TableCell style={{ border: { left: line, bottom: line } }}>D</TableCell>
              <TableCell>E</TableCell>
              <TableCell>F</TableCell>
            </TableRow>
          </Table>
        </Root>
      );
      expect(report).toEqual([]);
      const [lined] = tables(design);
      const side = (name: string, width = "2px", color = "#111827") => ({ [`border${name}Width`]: width, [`border${name}Style`]: "solid", [`border${name}Color`]: color });
      expect(lined.values.table.rows.map((row: Values) => row.cells.map((cell: Values) => cell.border))).toEqual([
        // A's bottom is the line between rows, the table's: not its own. B has none, which it says, or the builder would
        // draw that line under it.
        [side("Top"), side("Bottom", "0px", "#000000"), undefined],
        [{ ...side("Left"), ...side("Bottom") }, undefined, undefined],
      ]);
      expect(lined.values.rowBorder).toEqual({ borderTopWidth: "1px", borderTopStyle: "solid", borderTopColor: "#e5e7eb" });
      expect(lined.values.borderCollapse).toBe("collapse");
    }
  });

  it("gives every cell its own border where they all have the same lines and the line between rows is another: the builder draws that line over its border, a Table under its cells'", () => {
    const { design, report } = toDesign(
      <Email>
        <Table style={{ rowBorder: "3px solid #ff0000", borderCollapse: "collapse" }}>
          <TableRow>
            <TableCell style={{ border: "1px solid #000000" }}>A</TableCell>
          </TableRow>
          <TableRow>
            <TableCell style={{ border: "1px solid #000000" }}>B</TableCell>
          </TableRow>
        </Table>
      </Email>
    );
    expect(report).toEqual([]);
    const [lined] = tables(design);
    expect(lined.values.border.borderBottomWidth).toBe("0px");
    expect(lined.values.table.rows.map((row: Values) => row.cells[0].border.borderBottomWidth)).toEqual(["1px", "1px"]);
  });

  it("is the builder's table where cells side by side draw a line each: its cell borders are separate", () => {
    for (const Root of [Email, Page]) {
      const { design, report } = toDesign(
        <Root>
          <Table>
            <TableRow>
              <TableCell style={{ border: "1px solid #9ca3af" }}>A</TableCell>
              <TableCell style={{ border: "1px solid #9ca3af" }}>B</TableCell>
            </TableRow>
          </Table>
        </Root>
      );
      expect(report).toEqual([]);
      const [grid] = tables(design);
      expect(grid.values.border).toMatchObject({ borderTopWidth: "1px", borderLeftWidth: "1px", borderRightWidth: "1px", borderBottomWidth: "1px" });
      expect(grid.values.borderCollapse).toBe("separate");
    }
  });

  it("is the builder's table with a cell across columns: one cell with its colSpan, as wide as its columns, and each column's share kept", () => {
    for (const Root of [Email, Page]) {
      const { design, report } = toDesign(
        <Root>
          <Table>
            <TableRow>
              <TableCell style={{ width: "50%" }}>Item</TableCell>
              <TableCell style={{ width: "20%" }}>Qty</TableCell>
              <TableCell style={{ width: "30%" }}>Price</TableCell>
            </TableRow>
            <TableRow>
              <TableCell colSpan={2}>Total</TableCell>
              <TableCell>$20</TableCell>
            </TableRow>
          </Table>
        </Root>
      );
      expect(report).toEqual([]);
      const [wide] = tables(design);
      expect(wide.values.columns).toBe(3);
      expect(wide.values.table.columnWidths).toEqual([50, 20, 30]);
      expect(wide.values.table.rows.map((row: Values) => row.cells.map((cell: Values) => [words(cell), cell.colSpan, cell.width]))).toEqual([
        [["Item", undefined, 50], ["Qty", undefined, 20], ["Price", undefined, 30]],
        [["Total", 2, 70], ["$20", undefined, 30]],
      ]);
    }
    // The builder's table has no cell across more than 1000 columns.
    const endless = (
      <Table>
        <TableRow>
          <TableCell colSpan={1001}>Wide</TableCell>
        </TableRow>
      </Table>
    );
    expect(toDesign(<Page>{endless}</Page>).report).toEqual([
      "root.children[0]: the builder's table doesn't draw it as it is (a cell across more than 1000 columns): it's an HTML block of its own markup in the builder (it can be moved, not edited)",
    ]);
    expect(toDesign(<Document>{endless}</Document>).report).toEqual(["root.children[0].children[0].children[0]: a cell across more than 1000 columns is across 1000 in the builder's table, which has no more"]);
    // Without one, the builder's table keeps no widths but its cells'.
    expect(tables(toDesign(<Email>{table}</Email>).design)[0].values.table).not.toHaveProperty("columnWidths");
  });

  it("is the builder's table with a border around it and a width, which the builder draws: its tableBorder, width and maxWidth", () => {
    for (const Root of [Email, Page]) {
      const { design, report } = toDesign(
        <Root>
          <Table style={{ border: "2px solid #111827", width: 300, maxWidth: "80%" }}>
            <TableRow>
              <TableCell style={{ border: "1px solid #9ca3af" }}>A</TableCell>
            </TableRow>
          </Table>
        </Root>
      );
      expect(report).toEqual([]);
      const [framed] = tables(design);
      expect(framed.values.tableBorder).toMatchObject({ borderTopWidth: "2px", borderTopColor: "#111827", borderLeftWidth: "2px", borderRightWidth: "2px", borderBottomWidth: "2px" });
      expect(framed.values.width).toBe("300px");
      expect(framed.values.maxWidth).toBe("80%");
    }
  });

  it("is the builder's table where its width or max width fills its place, wherever its place puts it", () => {
    const lined = (style: Record<string, unknown>) => (
      <Table style={style}>
        <TableRow>
          <TableCell>A</TableCell>
        </TableRow>
      </Table>
    );
    for (const style of [{ maxWidth: 600 }, { width: 600 }, { width: "100%", maxWidth: 800 }]) {
      const { design, report } = toDesign(
        <Email width={600}>
          <Section style={{ alignItems: "center" }}>{lined(style)}</Section>
        </Email>,
      );
      expect(report, JSON.stringify(style)).toEqual([]);
      expect(blocks(design)[0].type, JSON.stringify(style)).toBe("table");
    }
    // One that fills its column only while the columns are side by side: on a phone they stack, and it doesn't.
    const stacked = toDesign(
      <Email width={600}>
        <Row>
          <Column style={{ alignItems: "center" }}>{lined({ maxWidth: 300 })}</Column>
          <Column>
            <Text>Beside</Text>
          </Column>
        </Row>
      </Email>,
    );
    expect(stacked.report).toHaveLength(1);
    expect(stacked.report[0]).toContain("a width, away from the left of its place");
    // One narrower than its place is still at its left in the builder's.
    expect(
      toDesign(
        <Email width={600}>
          <Section style={{ alignItems: "center" }}>{lined({ maxWidth: 300 })}</Section>
        </Email>,
      ).report,
    ).toEqual(["root.children[0].children[0]: the builder's table doesn't draw it as it is (a width, away from the left of its place): it's an HTML block of its own markup in the builder (it can be moved, not edited)"]);
  });

  it("counts a border of none around a Table as no border, which draws no line", () => {
    const table = (
      <Table style={{ border: "none", borderCollapse: "collapse" }}>
        <TableRow>
          <TableCell style={{ border: "1px solid #000000" }}>A</TableCell>
        </TableRow>
      </Table>
    );
    const page = toDesign(<Page>{table}</Page>);
    expect(page.report).toEqual([]);
    expect(blocks(page.design)[0].type).toBe("table");
    expect(toDesign(<Document>{table}</Document>).report).toEqual([]);
    // And back, with nothing to say about a border that isn't there.
    for (const [Root, displayMode] of [[Email, "email"], [Page, "web"], [Document, "document"]] as const) {
      const { design } = toDesign(<Root>{table}</Root>);
      expect(fromDesign(JSON.parse(JSON.stringify(design)), { displayMode }).report, displayMode).toEqual([]);
    }
  });

  it("leaves out a Table's own width in a Row, which is its column's share there as Elements draws it", () => {
    for (const Root of [Email, Page]) {
      const template = (
        <Root width={600}>
          <Row>
            <Table style={{ width: "50%" }}>
              <TableRow>
                <TableCell>A</TableCell>
              </TableRow>
            </Table>
            <Text>Beside</Text>
          </Row>
        </Root>
      );
      const { design, report } = toDesign(template);
      expect(report, Root.name).toEqual([]);
      const [table] = tables(design);
      // The column is half the row, and the table fills it.
      expect(design.body.rows[0].cells, Root.name).toEqual([300, 300]);
      expect(table.values.width, Root.name).toBe("100%");
      expect(table.values.maxWidth, Root.name).toBe("100%");
    }
  });

  it("gives a Table in a Row with a max width in % its column, and says a phone draws it otherwise, but in a Document", () => {
    const inRow = (Root: typeof Email | typeof Page | typeof Document, row: Record<string, unknown> = {}, stackOnMobile = true) => (
      <Root>
        <Row style={row} stackOnMobile={stackOnMobile}>
          <Table style={{ width: "50%", maxWidth: "50%" }}>
            <TableRow>
              <TableCell>A</TableCell>
            </TableRow>
          </Table>
          <Text>Beside</Text>
        </Row>
      </Root>
    );
    for (const Root of [Email, Page]) {
      const { design, report } = toDesign(inRow(Root));
      // The column is half the row, and the table fills it.
      const [table] = tables(design);
      expect(table.values.width, Root.name).toBe("100%");
      expect(table.values.maxWidth, Root.name).toBe("100%");
      expect(report, Root.name).toEqual(["root.children[0].children[0]: a max width in % of a Table in a Row is its column's in the builder's table: on phones, where the columns stack, the table fills its column"]);
      // A Row that doesn't stack keeps the share on phones too: nothing to say.
      expect(toDesign(inRow(Root, {}, false)).report, Root.name).toEqual([]);
    }
    // A Document's row doesn't narrow: half of it, in px, of the row's own width.
    for (const [row, half] of [[{}, "349px"], [{ width: 1000 }, "500px"]] as const) {
      const { design, report } = toDesign(inRow(Document, row));
      expect(report, JSON.stringify(row)).toEqual([]);
      expect(tables(design)[0].values.maxWidth, JSON.stringify(row)).toBe(half);
    }
  });

  it("is the builder's table at its default width and max width of 100% where it has none, and comes back with none", () => {
    for (const Root of [Email, Page]) {
      const template = (
        <Root>
          <Table>
            <TableRow>
              <TableCell>A</TableCell>
            </TableRow>
          </Table>
        </Root>
      );
      const { design, report } = toDesign(template);
      expect(report).toEqual([]);
      // What the builder fills in itself when it opens a table: written here, so its save changes nothing.
      const [plain] = tables(design);
      expect(plain.values.width).toBe("100%");
      expect(plain.values.maxWidth).toBe("100%");
      const back = fromDesign(JSON.parse(JSON.stringify(design)), { displayMode: Root === Email ? "email" : "web" });
      expect(back.code).toContain("<Table>");
      expect(back.code).not.toContain("width");
      // One the builder narrowed keeps what it was given.
      plain.values.width = "60%";
      const narrowed = fromDesign(JSON.parse(JSON.stringify(design)), { displayMode: Root === Email ? "email" : "web" });
      expect(narrowed.code).toContain('<Table style={{ width: "60%" }}>');
    }
  });

  it("stays an HTML block in a Page where its border and its cells' lines at its edges collapse into one line: the builder draws the two, as an Email's Table does", () => {
    const framed = (
      <Table style={{ border: "3px solid #111827", borderCollapse: "collapse" }}>
        <TableRow>
          <TableCell style={{ border: "1px solid #9ca3af" }}>A</TableCell>
        </TableRow>
      </Table>
    );
    expect(toDesign(<Page>{framed}</Page>).report).toEqual([
      "root.children[0]: the builder's table doesn't draw it as it is (a border around it that collapses with its cells' lines): it's an HTML block of its own markup in the builder (it can be moved, not edited)",
    ]);
    const email = toDesign(<Email>{framed}</Email>);
    expect(email.report).toEqual([]);
    expect(blocks(email.design).map((content) => content.type)).toEqual(["table"]);
    // A Document's is the builder's table all the same, and says so.
    expect(toDesign(<Document>{framed}</Document>).report).toEqual([
      "root.children[0]: the border around it and the lines of its cells at its edges are one line where a Table's borders collapse, two in the builder's table, which draws its border outside its cells'",
    ]);
    // Cells with no line at the table's edge leave its border alone.
    const inner = (
      <Table style={{ border: "3px solid #111827", borderCollapse: "collapse", rowBorder: "1px solid #9ca3af" }}>
        <TableRow>
          <TableCell>A</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>B</TableCell>
        </TableRow>
      </Table>
    );
    expect(toDesign(<Page>{inner}</Page>).report).toEqual([]);
  });

  it("stays an HTML block where a table narrower than its place isn't at its left, where the builder's sits", () => {
    // (A max width of 100%, so a Page's Table shrinks in a narrow window as the builder's does.)
    const narrow = (
      <Table style={{ width: 300, maxWidth: "100%" }}>
        <TableRow>
          <TableCell>A</TableCell>
        </TableRow>
      </Table>
    );
    for (const [style, where] of [[{ alignItems: "center" }, "in its middle"], [{ textAlign: "right" }, "at its right"]] as const) {
      for (const Root of [Email, Page]) {
        expect(toDesign(<Root><Column style={style}>{narrow}</Column></Root>).report, where).toEqual([
          "root.children[0].children[0]: the builder's table doesn't draw it as it is (a width, away from the left of its place): it's an HTML block of its own markup in the builder (it can be moved, not edited)",
        ]);
      }
      expect(toDesign(<Document><Column style={style}>{narrow}</Column></Document>).report).toEqual([`root.children[0].children[0]: a table narrower than its place is at its left in the builder's, not ${where}`]);
    }
    // One wider than its place runs out of it, where the builder's stops at its place's edge.
    const wide = (width: number | string, more: Record<string, unknown> = {}) => (
      <Table style={{ width, ...more }}>
        <TableRow>
          <TableCell>A</TableCell>
        </TableRow>
      </Table>
    );
    for (const width of [800, "120%"]) {
      expect(toDesign(<Page width={600}>{wide(width)}</Page>).report, String(width)).toEqual([
        "root.children[0]: the builder's table doesn't draw it as it is (a width wider than its place): it's an HTML block of its own markup in the builder (it can be moved, not edited)",
      ]);
    }
    expect(toDesign(<Document>{wide("120%")}</Document>).report).toEqual(["root.children[0]: a table wider than its place is as wide as its place in the builder's, which doesn't let it run out of it"]);
    expect(toDesign(<Page width={600}>{wide(600, { maxWidth: "100%" })}</Page>).report).toEqual([]);
    // At its left, and one that fills its place wherever it is, are drawn as they are.
    expect(toDesign(<Email><Column style={{ alignItems: "start" }}>{narrow}</Column></Email>).report).toEqual([]);
    expect(toDesign(<Email><Column style={{ alignItems: "center" }}>{table}</Column></Email>).report).toEqual([]);
  });

  it("stays an HTML block in a Page where its px width has no max width, which the builder's table shrinks in a narrow window", () => {
    const sized = (style: Record<string, unknown>) => (
      <Table style={style}>
        <TableRow>
          <TableCell>A</TableCell>
        </TableRow>
      </Table>
    );
    for (const width of [500, "500px"]) {
      const { design, report } = toDesign(<Page width={600}>{sized({ width })}</Page>);
      expect(report, String(width)).toEqual(["root.children[0]: the builder's table doesn't draw it as it is (a px width with no max width): it's an HTML block of its own markup in the builder (it can be moved, not edited)"]);
      expect(blocks(design)[0].type).toBe("html");
    }
    // With a max width, or a percentage, it shrinks as the builder's does.
    for (const style of [{ width: 500, maxWidth: "100%" }, { width: 500, maxWidth: "90%" }, { width: 500, maxWidth: 400 }, { width: "80%" }]) {
      const { design, report } = toDesign(<Page width={600}>{sized(style)}</Page>);
      expect(report, JSON.stringify(style)).toEqual([]);
      expect(blocks(design)[0].type).toBe("table");
    }
    // An Email writes its width as a max width, and a Document's page doesn't narrow.
    expect(toDesign(<Email>{sized({ width: 500 })}</Email>).report).toEqual([]);
    expect(toDesign(<Document>{sized({ width: 500 })}</Document>).report).toEqual([]);
  });

  it("stays an HTML block in an Email or a Page where the builder's table doesn't draw it as it is, and says why", () => {
    const line = "1px solid #e5e7eb";
    const row = (a: string, b: string, props: Record<string, unknown> = {}) => (
      <TableRow {...props}>
        <TableCell>{a}</TableCell>
        <TableCell>{b}</TableCell>
      </TableRow>
    );
    const cases: Array<[string, React.ReactElement]> = [
      ["its mobile.width", <Table style={{ mobile: { width: 300 } }}>{row("A", "1")}</Table>],
      ["its mobile.maxWidth", <Table style={{ mobile: { maxWidth: 300 } }}>{row("A", "1")}</Table>],
      ["its mobile.border", <Table style={{ mobile: { border: line } }}>{row("A", "1")}</Table>],
      ["a column of a fixed width", <Table><TableRow><TableCell style={{ width: 100 }}>A</TableCell><TableCell>1</TableCell></TableRow></Table>],
      ["a row with fewer cells than its columns", <Table>{row("A", "1")}<TableRow><TableCell>One</TableCell></TableRow></Table>],
      ["a header row below its first rows", <Table>{row("A", "1")}{row("Sub", "head", { header: true })}</Table>],
      ["a cell's mobile.padding", <Table><TableRow><TableCell style={{ mobile: { padding: 4 } }}>A</TableCell></TableRow></Table>],
      ["its mobile.fontSize", <Table style={{ mobile: { fontSize: 12 } }}>{row("A", "1")}</Table>],
      ["a link's hover", <Table><TableRow><TableCell><Link href="https://example.com" style={{ hover: { color: "#ff0000" } }}>Link</Link></TableCell></TableRow></Table>],
      ["a row's id the builder doesn't write", <Table><TableRow id="u_first">{[<TableCell key="a">A</TableCell>]}</TableRow></Table>],
      ["a cell's id the builder doesn't write", <Table><TableRow><TableCell id="u_total">A</TableCell></TableRow></Table>],
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

  it("writes the line between rows as the builder's rowBorder, with no border around its cells", () => {
    const { design, report } = toDesign(lineItems);
    const [items] = tables(design);
    expect(items.values.rowBorder).toEqual({ borderTopWidth: "1px", borderTopStyle: "solid", borderTopColor: "#e5e7eb" });
    expect(items.values.border).toMatchObject({ borderTopWidth: "0px", borderBottomWidth: "0px", borderLeftWidth: "0px", borderRightWidth: "0px" });
    expect(report.filter((line) => line.includes("line between rows"))).toEqual([]);
  });

  it("writes cells with the same lines all round as the builder's border, their padding and background each cell's", () => {
    const [, due] = tables(toDesign(lineItems).design);
    expect(due.values.border).toEqual({ borderTopWidth: "1px", borderTopStyle: "solid", borderTopColor: "#9ca3af", borderRightWidth: "1px", borderRightStyle: "solid", borderRightColor: "#9ca3af", borderBottomWidth: "1px", borderBottomStyle: "solid", borderBottomColor: "#9ca3af", borderLeftWidth: "1px", borderLeftStyle: "solid", borderLeftColor: "#9ca3af" });
    expect(due.values.contentPadding).toBe("0px");
    expect(due.values.table.rows[0].cells).toMatchObject([{ padding: "4px" }, { padding: "4px", backgroundColor: "#fef3c7" }]);
  });

  it("keeps cells' lines side by side two in a Table that doesn't collapse them, as the builder's separate cell borders, and two read back", () => {
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
    expect(report).toEqual([]);
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

  it("says a row short of cells has empty cells in the builder's table; a cell across columns and lines on some cells only are held", () => {
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
      ["Wide", ""],
      ["A", "B", "C"],
    ]);
    const [across, made] = wide.values.table.rows[0].cells;
    expect(across).toMatchObject({ colSpan: 2, border: { borderTopWidth: "1px", borderRightWidth: "1px", borderBottomWidth: "1px", borderLeftWidth: "1px" } });
    expect(made).not.toHaveProperty("colSpan");
    expect(made).not.toHaveProperty("border");
    expect(report).toEqual(["root.children[0]: a row with fewer cells than the table's columns has empty cells in the builder's table, to make up its columns"]);
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

  it("writes a row's and a cell's id as the builder's row's and cell's, and reads them back", () => {
    const { design, report } = toDesign(
      <Document>
        <Table>
          <TableRow id="details">
            <TableCell id="first">Words</TableCell>
            <TableCell>More</TableCell>
          </TableRow>
        </Table>
      </Document>
    );
    expect(report).toEqual([]);
    const [row] = tables(design)[0].values.table.rows;
    expect(row.id).toBe("details");
    expect(row.cells.map((cell: Values) => cell.id)).toEqual(["first", undefined]);
    const { code } = fromDesign(JSON.parse(JSON.stringify(design)), { displayMode: "document" });
    expect(code).toContain('<TableRow id="details"');
    expect(code).toContain('<TableCell id="first"');
  });

  it("says an id the builder keeps and doesn't write in its HTML: one that starts with u_, as its own do", () => {
    const { design, report } = toDesign(
      <Document>
        <Table>
          <TableRow id="u_details">
            <TableCell id="u_first">Words</TableCell>
          </TableRow>
        </Table>
      </Document>
    );
    expect(report).toEqual([
      "root.children[0].children[0]: the builder's table writes no id that starts with u_, as its own ids do: a row's is kept in the design, and isn't in the builder's HTML",
      "root.children[0].children[0].children[0]: the builder's table writes no id that starts with u_, as its own ids do: a cell's is kept in the design, and isn't in the builder's HTML",
    ]);
    expect(tables(design)[0].values.table.rows[0]).toMatchObject({ id: "u_details", cells: [{ id: "u_first" }] });
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

  it("comes back with its line between rows, its cells' own lines, a cell across columns, its border and its width", () => {
    const template = (
      <Email>
        <Table style={{ rowBorder: "1px solid #e5e7eb", border: "2px solid #111827", width: 300, borderCollapse: "collapse" }}>
          <TableRow>
            <TableCell style={{ width: "50%" }}>Item</TableCell>
            <TableCell style={{ width: "20%" }}>Qty</TableCell>
            <TableCell style={{ width: "30%", border: { left: "1px dashed #9ca3af" } }}>Price</TableCell>
          </TableRow>
          <TableRow>
            <TableCell colSpan={2} style={{ border: { top: "2px solid #111827" } }}>
              Total
            </TableCell>
            <TableCell>$20</TableCell>
          </TableRow>
        </Table>
      </Email>
    );
    const first = toDesign(template);
    expect(first.report).toEqual([]);
    const back = fromDesign(JSON.parse(JSON.stringify(first.design)), { displayMode: "email" });
    expect(back.report).toEqual([]);
    expect(back.code).toContain('rowBorder: "1px solid #e5e7eb"');
    expect(back.code).toContain('border: "2px solid #111827"');
    expect(back.code).toContain("width: 300");
    expect(back.code).toContain('borderCollapse: "collapse"');
    expect(back.code).toContain("colSpan={2}");
    expect(back.code).toMatch(/<TableCell style=\{\{ border: \{ left: "1px dashed #9ca3af" \}, width: "30%" \}\}>Price/);
    expect(back.code).toMatch(/<TableCell colSpan=\{2\} style=\{\{ border: \{ top: "2px solid #111827" \} \}\}>\s*Total/);
    // The line between rows is the Table's again: no cell has it as a bottom line of its own.
    expect(back.code).not.toContain("bottom:");
  });

  it("reads the builder's own table: its border around every cell, its line between rows under all but the last, a cell's own border over both", () => {
    const design = JSON.parse(JSON.stringify(toDesign(<Email>{table}</Email>).design));
    const content = blocks(design)[0];
    const cellOf = (text: string, more: Values = {}) => ({ text: `<p>${text}</p>`, width: 50, ...more });
    const sides = (width: string, color: string) => Object.fromEntries(["Top", "Left", "Right", "Bottom"].flatMap((side) => [[`border${side}Width`, width], [`border${side}Style`, "solid"], [`border${side}Color`, color]]));
    content.values = {
      ...JSON.parse(JSON.stringify(TableDefaults)),
      _meta: content.values._meta,
      enableHeader: false,
      border: sides("1px", "#cccccc"),
      rowBorder: { borderTopWidth: "3px", borderTopStyle: "solid", borderTopColor: "#ff0000" },
      table: {
        headers: [],
        rows: [
          { id: "first", cells: [cellOf("A"), cellOf("B", { border: { borderBottomWidth: "0px", borderBottomStyle: "solid", borderBottomColor: "#000000" } })], height: 30 },
          { cells: [cellOf("Total", { colSpan: 2, width: 100, id: "total" })], height: 30 },
        ],
        footers: [],
        columnWidths: [70, 30],
      },
    };
    const { code, report } = fromDesign(design, { displayMode: "email" });
    expect(report).toEqual([]);
    expect(code).toContain('rowBorder: "3px solid #ff0000"');
    expect(code).toContain('borderCollapse: "collapse"');
    expect(code).toContain('<TableRow id="first"');
    // A: the table's border on three sides, the line between rows its bottom (the Table's own, so not said).
    expect(code).toMatch(/<TableCell style=\{\{[^}]*border: \{ top: "1px solid #cccccc", right: "1px solid #cccccc", left: "1px solid #cccccc" \}, width: "70%" \}\}>A/);
    // B: no bottom line of its own, which a Table has to say, or it would draw the line between rows there.
    expect(code).toMatch(/border: \{ top: "1px solid #cccccc", right: "1px solid #cccccc", left: "1px solid #cccccc", bottom: "0px none #000000" \}, width: "30%" \}\}>B/);
    // The last row: the table's border all round.
    expect(code).toMatch(/<TableCell id="total" colSpan=\{2\} style=\{\{[^}]*border: "1px solid #cccccc" \}\}>Total/);
  });

  /** The builder's own table with these rows, as a design. */
  const builders = (rowsOf: Values[], more: Values = {}) => {
    const design = JSON.parse(JSON.stringify(toDesign(<Email>{table}</Email>).design));
    const content = blocks(design)[0];
    content.values = { ...JSON.parse(JSON.stringify(TableDefaults)), _meta: content.values._meta, enableHeader: false, ...more, table: { headers: [], rows: rowsOf, footers: [], ...more.table } };
    return design;
  };
  const cellOf = (text: string, more: Values = {}) => ({ text: `<p>${text}</p>`, ...more });
  const widths = (code: string) => [...code.matchAll(/width: "([\d.]+)%"[^>]*>(\w+)/g)].map((match) => [match[2], Number(match[1])]);

  it("reads the columns of a table with a cell across columns as the builder draws them: a cell with no width takes what a cell across it leaves", () => {
    // The first row's middle cell has no width: the cell across the first two columns says they're 80 together.
    const design = builders([
      { cells: [cellOf("A", { width: 20 }), cellOf("B"), cellOf("C", { width: 20 })], height: 30 },
      { cells: [cellOf("Wide", { colSpan: 2, width: 80 }), cellOf("D", { width: 20 })], height: 30 },
    ]);
    // 20, an equal part of 80 (40), 20: shares of their total.
    expect(widths(fromDesign(design, { displayMode: "email" }).code)).toEqual([["A", 25], ["B", 50], ["C", 25]]);
  });

  it("reads the widths the builder keeps for a table with a cell across columns, and not ones it wouldn't use", () => {
    const rowsOf = [
      { cells: [cellOf("A", { width: 20 }), cellOf("B", { width: 30 }), cellOf("C", { width: 50 })], height: 30 },
      { cells: [cellOf("Wide", { colSpan: 3, width: 100 })], height: 30 },
    ];
    expect(widths(fromDesign(builders(rowsOf, { table: { columnWidths: [60, 30, 10] } }), { displayMode: "email" }).code)).toEqual([["A", 60], ["B", 30], ["C", 10]]);
    // Too few, not numbers, or past any width a table has: the cells' own, as the builder falls back to.
    for (const columnWidths of [[60, 40], [60, "30", 10], [1e308, 1e308, 20], [0, 0, 0]]) {
      expect(widths(fromDesign(builders(rowsOf, { table: { columnWidths } }), { displayMode: "email" }).code), JSON.stringify(columnWidths)).toEqual([["A", 20], ["B", 30], ["C", 50]]);
    }
  });

  it("reads the columns of a table with a cell across columns from every row the builder keeps, a header's that's off too", () => {
    const design = builders(
      [
        { cells: [cellOf("A", { width: 50 }), cellOf("B", { width: 50 })], height: 30 },
        { cells: [cellOf("Wide", { colSpan: 2, width: 100 })], height: 30 },
      ],
      // Its header is off, and still where the builder takes its columns from: rows that reach every column, in order.
      { enableHeader: false, table: { headers: [{ cells: [cellOf("H1", { width: 80 }), cellOf("H2", { width: 20 })], height: 30 }] } }
    );
    const { code } = fromDesign(design, { displayMode: "email" });
    expect(code).not.toContain("H1");
    expect(widths(code)).toEqual([["A", 80], ["B", 20]]);
  });

  it("reads a cell's own border as the builder draws it: a side with no color is the color of its words, a width it doesn't read leaves the line there, and 0 takes it away", () => {
    const sides = (width: string, color: string) => Object.fromEntries(["Top", "Left", "Right", "Bottom"].flatMap((side) => [[`border${side}Width`, width], [`border${side}Style`, "solid"], [`border${side}Color`, color]]));
    const line = { borderBottomWidth: "4px", borderBottomStyle: "solid", borderBottomColor: "#ff0000" };
    const design = builders(
      [
        {
          cells: [
            cellOf("Green", { width: 25, color: "#00aa00", border: { borderTopWidth: "2px", borderTopStyle: "solid" } }),
            cellOf("Taken", { width: 25, border: { borderTopWidth: "2px", borderTopStyle: "solid" } }),
            cellOf("Junk", { width: 25, border: { borderBottomWidth: "junk" } }),
            cellOf("Zero", { width: 25, border: { borderBottomWidth: "0px" } }),
          ],
          height: 30,
        },
      ],
      { border: { ...sides("0px", "#000000"), ...line }, contentColor: "#0000ff" }
    );
    const { code, report } = fromDesign(design, { displayMode: "email" });
    expect(report).toEqual([]);
    const border = (text: string) => new RegExp(`border: (\\{[^}]*\\}|"[^"]*")[^>]*>${text}<`).exec(code)?.[1];
    // Its own color, then the content's.
    expect(border("Green")).toBe('{ bottom: "4px solid #ff0000", top: "2px solid #00aa00" }');
    expect(border("Taken")).toBe('{ bottom: "4px solid #ff0000", top: "2px solid #0000ff" }');
    // A width that isn't one leaves the table's line; 0 takes it away.
    expect(border("Junk")).toBe('{ bottom: "4px solid #ff0000" }');
    expect(code).toMatch(/<TableCell style=\{\{[^}]*\}\}>Zero</);
    expect(border("Zero")).toBeUndefined();
  });

  it("reads the line between rows as the builder draws it: none at a width of 0 or one it doesn't read, and the color of the content's words where it has none", () => {
    const two = [{ cells: [cellOf("A", { width: 100 })], height: 30 }, { cells: [cellOf("B", { width: 100 })], height: 30 }];
    const noBorder = Object.fromEntries(["Top", "Left", "Right", "Bottom"].flatMap((side) => [[`border${side}Width`, "0px"], [`border${side}Style`, "solid"], [`border${side}Color`, "#000000"]]));
    const read = (rowBorder: unknown, more: Values = {}) => fromDesign(builders(two, { border: noBorder, rowBorder, ...more }), { displayMode: "email" });
    expect(read({ borderTopWidth: "3px", borderTopStyle: "solid", borderTopColor: "#ff0000" }).code).toContain('rowBorder: "3px solid #ff0000"');
    // No color: the content's words'.
    expect(read({ borderTopWidth: "3px", borderTopStyle: "solid" }, { contentColor: "#00aa00" }).code).toContain('rowBorder: "3px solid #00aa00"');
    for (const none of [{ borderTopWidth: "0px", borderTopStyle: "solid", borderTopColor: "#ff0000" }, { borderTopWidth: 3, borderTopStyle: "solid", borderTopColor: "#ff0000" }, { borderTopWidth: "thick" }]) {
      const { code, report } = read(none);
      expect(report, JSON.stringify(none)).toEqual([]);
      expect(code, JSON.stringify(none)).not.toContain("rowBorder");
    }
    // A Table with no line between its rows, said so ("none"), goes to the builder and back without a word.
    const first = toDesign(<Email><Table style={{ rowBorder: "none" }}><TableRow><TableCell>A</TableCell></TableRow><TableRow><TableCell>B</TableCell></TableRow></Table></Email>);
    expect(first.report).toEqual([]);
    expect(fromDesign(JSON.parse(JSON.stringify(first.design)), { displayMode: "email" }).report).toEqual([]);
  });

  it("reads a border above and below each row that is the line between rows as the builder draws it: above the first row and below the last too", () => {
    const sides = (top: string, side: string) => ({ ...Object.fromEntries(["Top", "Bottom"].flatMap((at) => [[`border${at}Width`, top], [`border${at}Style`, "solid"], [`border${at}Color`, "#cccccc"]])), ...Object.fromEntries(["Left", "Right"].flatMap((at) => [[`border${at}Width`, side], [`border${at}Style`, "solid"], [`border${at}Color`, "#cccccc"]])) });
    const rowBorder = { borderTopWidth: "1px", borderTopStyle: "solid", borderTopColor: "#cccccc" };
    const border = (code: string, text: string) => new RegExp(`border: (\\{[^}]*\\}|"[^"]*")[^>]*>${text}<`).exec(code)?.[1];
    const three = ["A", "B", "C"].map((text) => ({ cells: [cellOf(text, { width: 100 })], height: 30 }));
    const { code, report } = fromDesign(builders(three, { border: sides("1px", "0px"), rowBorder }), { displayMode: "email" });
    expect(report).toEqual([]);
    expect(code).toContain('rowBorder: "1px solid #cccccc"');
    // The line between rows is the Table's; the first row's line above and the last's below are the cells'.
    expect(border(code, "A")).toBe('{ top: "1px solid #cccccc" }');
    expect(border(code, "B")).toBe('{ top: "1px solid #cccccc" }');
    expect(border(code, "C")).toBe('{ top: "1px solid #cccccc", bottom: "1px solid #cccccc" }');
    // One row: both lines.
    const one = fromDesign(builders(three.slice(0, 1), { border: sides("1px", "0px"), rowBorder }), { displayMode: "email" }).code;
    expect(border(one, "A")).toBe('{ top: "1px solid #cccccc", bottom: "1px solid #cccccc" }');
    // A line between rows with no color takes the content's words' color, and still leaves the cells their lines.
    const dark = { ...sides("1px", "0px"), borderTopColor: "#333333", borderBottomColor: "#333333" };
    const colored = fromDesign(builders(three, { border: dark, rowBorder: { borderTopWidth: "1px", borderTopStyle: "solid" }, contentColor: "#333333" }), { displayMode: "email" }).code;
    expect(border(colored, "A")).toBe('{ top: "1px solid #333333" }');
  });

  it("reads a px width with the builder's max width of 100% as both, which shrink in a narrower place, and drops what fills its place", () => {
    const one = [{ cells: [cellOf("A", { width: 100 })], height: 30 }];
    const tableStyle = (more: Values) => /<Table style=\{\{([^}]*)\}\}>/.exec(fromDesign(builders(one, more), { displayMode: "web" }).code)?.[1] ?? "";
    expect(tableStyle({ width: "500px", maxWidth: "100%" })).toContain('width: 500, maxWidth: "100%"');
    expect(tableStyle({ width: "80%", maxWidth: "100%" })).toContain('width: "80%"');
    expect(tableStyle({ width: "80%", maxWidth: "100%" })).not.toContain("maxWidth");
    expect(tableStyle({ width: "100%", maxWidth: "100%" })).not.toMatch(/width/i);
    // A Page's, so read, goes back to the builder as its table.
    const page = toDesign(<Page width={600}><Table style={{ width: 500, maxWidth: "100%" }}><TableRow><TableCell>A</TableCell></TableRow></Table></Page>);
    const back = fromDesign(JSON.parse(JSON.stringify(page.design)), { displayMode: "web" });
    expect(blocks(toDesign(back.element).design)[0].type).toBe("table");
  });

  it("reads a row's or a cell's id that starts with u_, as the builder's own do, as no id: the builder doesn't write it", () => {
    const { code, report } = fromDesign(builders([{ id: "u_row_9", cells: [cellOf("A", { width: 50, id: "u_content_x" }), cellOf("B", { width: 50, id: "total" })], height: 30 }]), { displayMode: "email" });
    expect(report).toEqual([]);
    expect(code).not.toContain("u_");
    expect(code).toContain('id="total"');
    const again = toDesign(fromDesign(builders([{ id: "u_row_9", cells: [cellOf("A", { width: 100, id: "u_content_x" })], height: 30 }]), { displayMode: "email" }).element);
    expect(again.report).toEqual([]);
    expect(blocks(again.design)[0].type).toBe("table");
  });

  it("says a Page's or a Document's Table draws the builder's border around the table and its edge cells' lines as one line, where its borders collapse", () => {
    const sides = (width: string, color: string) => Object.fromEntries(["Top", "Left", "Right", "Bottom"].flatMap((side) => [[`border${side}Width`, width], [`border${side}Style`, "solid"], [`border${side}Color`, color]]));
    const none = sides("0px", "#000000");
    const framed = (more: Values = {}) => builders([{ cells: [cellOf("A", { width: 100, border: { borderTopWidth: "2px", borderTopStyle: "solid", borderTopColor: "#ff0000" } })], height: 30 }], { border: none, tableBorder: sides("3px", "#000000"), ...more });
    const said = "rows[0].columns[0].contents[0]: the border around it and the lines of its cells at its edges are two lines in the builder's table, one in a Table whose borders collapse";
    expect(fromDesign(framed(), { displayMode: "web" }).report).toEqual([said]);
    expect(fromDesign(framed(), { displayMode: "document" }).report).toEqual([said]);
    // An Email's Table draws both, and so does one whose cells keep a line each.
    expect(fromDesign(framed(), { displayMode: "email" }).report).toEqual([]);
    expect(fromDesign(framed({ borderCollapse: "separate" }), { displayMode: "web" }).report).toEqual([]);
    // No line of a cell's at the table's edge: nothing to merge.
    expect(fromDesign(builders([{ cells: [cellOf("A", { width: 100 })], height: 30 }], { border: none, tableBorder: sides("3px", "#000000") }), { displayMode: "web" }).report).toEqual([]);
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
