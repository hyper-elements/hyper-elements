/**
 * Templates the builder adapter's tests take to the builder and back: every component the builder takes, in every
 * root, with what its tools have no field for. `sample`, `everyTool` and `invoice` are the templates the real
 * builder saved designs of (__fixtures__/designs/*.saved-in-builder.json).
 */
import React from "react";
import {
  Button,
  Column,
  Divider,
  Document,
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
  MergeTag,
  Page,
  PageBreak,
  PageFooter,
  PageHeader,
  PageNumber,
  Text,
  Row,
  Section,
  Social,
  Span,
  Table,
  TableCell,
  TableRow,
  Video,
} from "../../primitives";

export const sample = (
  <Email previewText="Hi" style={{ backgroundColor: "#f5f5f5" }}>
    <Section style={{ backgroundColor: "#eeeeee", padding: 20, gap: 10 }}>
      <Heading id="title" style={{ backgroundColor: "#fde68a", borderRadius: 8 }}>
        Title
      </Heading>
      <Text>
        Hello{" "}
        <Link href="https://x.test" style={{ hover: { color: "#0000ff" } }}>
          link
        </Link>
        <Span style={{ fontWeight: 700 }}> bold</Span>
      </Text>
      <Row style={{ gap: 20 }}>
        <Column style={{ backgroundColor: "#ffffff", padding: 8 }}>
          <Text>A</Text>
        </Column>
        <Column>
          <Button href="https://b.test" style={{ hover: { backgroundColor: "#333333" } }}>
            Go
          </Button>
        </Column>
      </Row>
    </Section>
    <Image src={{ src: "https://example.com/a.png", width: 600, height: 300 }} alt="x" style={{ borderRadius: 16 }} />
    <Layer style={{ height: 200 }}>
      <Image src={{ src: "https://example.com/b.png", width: 600, height: 300 }} alt="" />
      <Heading>Over</Heading>
    </Layer>
  </Email>
);

/** Each of the builder's tools, with what it has no field for. */
export const everyTool = (
  <Email previewText="Every tool" style={{ backgroundColor: "#fafafa", color: "#222222" }}>
    <Section style={{ backgroundColor: "#ffffff", padding: [24, 16, 24, 16], gap: 12 }}>
      <Heading level={2} style={{ letterSpacing: 1, textTransform: "uppercase", backgroundColor: "#fde68a" }}>
        Heading
      </Heading>
      <Text style={{ fontSize: 15, lineHeight: 1.6 }}>
        Text with a{" "}
        <Link href={{ href: "https://x.test", target: "_self" }} style={{ hover: { color: "#0000ff" } }}>
          link
        </Link>{" "}
        and <MergeTag name="first_name" />
      </Text>
      <Button href="https://x.test/go" style={{ backgroundColor: "#111111", color: "#ffffff", borderRadius: 6, padding: [12, 24, 12, 24], hover: { backgroundColor: "#333333" } }}>
        Button
      </Button>
      <Link href="https://x.test/image">
        <Image src={{ src: "https://picsum.photos/id/10/600/300", width: 600, height: 300 }} alt="Linked image" style={{ width: "80%" }} />
      </Link>
      <Divider style={{ borderTop: { width: 2, style: "dashed", color: "#cccccc" } }} />
      <Menu items={[{ text: "Docs", href: "https://x.test/docs" }, { text: "Blog", href: { href: "https://x.test/blog", target: "_self" } }]} separator="|" />
      <Social icons={[{ name: "Facebook", href: "https://facebook.com/x" }, { name: "X", href: "https://x.com/x" }]} />
      <Video src="https://www.youtube.com/watch?v=dQw4w9WgXcQ" />
    </Section>
    <Row style={{ gap: 16, border: { bottom: { width: 1, style: "solid", color: "#eeeeee" } } }}>
      <Column style={{ padding: 8, backgroundColor: "#f0f0f0" }} hidden={{ mobile: true }}>
        <Text>Desktop only</Text>
      </Column>
      <Column>
        <Image src="https://picsum.photos/id/11/300/200" alt="" style={{ width: "50%" }} hidden={{ mobile: true }} />
      </Column>
    </Row>
    <Grid columns={2} style={{ gap: 8 }}>
      <Text>a</Text>
      <Text>b</Text>
      <Text>c</Text>
    </Grid>
    <Layer style={{ height: 120 }}>
      <Image src={{ src: "https://picsum.photos/id/12/600/240", width: 600, height: 240 }} alt="" />
      <Heading>Over</Heading>
    </Layer>
  </Email>
);

export const invoice = (
  <Document size="A5" orientation="landscape" margin={40}>
    <PageHeader>
      <Text>Acme Inc.</Text>
    </PageHeader>
    <Document.Page>
      <Heading>Invoice</Heading>
      <Text>
        Page <PageNumber /> of <PageNumber total />
      </Text>
    </Document.Page>
    <Document.Page>
      <Text>Terms</Text>
    </Document.Page>
    <Text>Notes</Text>
    <PageBreak />
    <Text>Appendix</Text>
    <PageFooter>
      <Text>Thank you</Text>
    </PageFooter>
  </Document>
);

/** What text tools hold: runs of every kind, a list, a heading of each level, boxes, directions. */
export const text = (
  <Email width={640} style={{ color: "#333333", fontFamily: "Georgia, serif" }}>
    <Heading level={3} dir="rtl" style={{ textAlign: "right", fontStyle: "italic" }}>
      Level three
    </Heading>
    <Heading level={6}>Level six</Heading>
    <Text style={{ textDecoration: "underline", fontSize: 18, letterSpacing: 0.5 }}>
      E = mc<Span style={{ verticalAlign: "super" }}>2</Span>, H<Span style={{ verticalAlign: "sub", color: "#ff0000" }}>2</Span>O,{" "}
      <Span style={{ fontFamily: '"Courier New", monospace', fontSize: 14 }}>code</Span>,{" "}
      <Link href="https://x.test/about" title="About us" aria-label="Read about us">
        about
      </Link>
      ,<LineBreak />
      <Span style={{ backgroundColor: "#ffff00", fontStyle: "italic", textTransform: "uppercase" }}>marked</Span>
    </Text>
    <List style={{ gap: 6, indent: 30, padding: [8, 0, 8, 0] }}>
      <ListItem>One</ListItem>
      <ListItem>
        Two
        <List type="number" start={3}>
          <ListItem>Three</ListItem>
          <ListItem>Four</ListItem>
        </List>
      </ListItem>
    </List>
    <Text style={{ backgroundColor: "#eef2ff", border: { left: "4px solid #6366f1" }, padding: 12, borderRadius: 4, maxWidth: 400 }}>A boxed note</Text>
    <Text style={{ textAlign: "center", lineHeight: "24px", mobile: { fontSize: 13, textAlign: "left" } }}>
      Centered
    </Text>
    <Html html='<table role="presentation"><tr><td>Raw cell</td></tr></table>' text="Raw cell" />
  </Email>
);

/** Buttons, images, dividers and the rest, placed and spaced every way a column places them. */
export const blocks = (
  <Page width={800} style={{ backgroundColor: "#ffffff" }}>
    <Column style={{ alignItems: "center", gap: 16, padding: 24 }}>
      <Button href={{ href: "https://x.test/buy", target: "_blank" }} title="Buy it" style={{ width: 240, textAlign: "left", border: { top: "2px solid #000000", bottom: "2px solid #000000" }, fontStyle: "italic", mobile: { padding: 8 } }}>
        Buy <Span style={{ fontWeight: 700 }}>now</Span>
      </Button>
      <Image src={{ src: "https://example.com/wide.png", width: 1200, height: 400 }} alt="Wide" style={{ width: 300, border: { top: "1px solid #dddddd" }, mobile: { width: "100%" } }} />
      <Image src="https://example.com/no-size.png" alt="No size" style={{ width: "100%" }} />
      <Divider style={{ width: 200, borderTop: "3px dotted #ff0000", padding: [4, 0, 4, 0] }} />
      <Video src="https://vimeo.com/76979871" title="Launch" style={{ maxWidth: 400 }} />
      <Menu items={[{ text: "A", href: "https://a.test" }, { text: "B", href: "https://b.test" }]} layout="vertical" style={{ justifyContent: "start", lineHeight: 1.5, fontWeight: 700 }} />
      <Social icons={[{ name: "Instagram", href: "https://instagram.com/acme" }]} iconType="squared" size={24} style={{ gap: 10, justifyContent: "end" }} />
    </Column>
    <Row stackOnMobile={false} style={{ gap: 10, padding: [12, 0, 12, 0], backgroundColor: "#f3f4f6", alignItems: "center" }}>
      <Column style={{ width: 200, borderRadius: 6, backgroundColor: "#ffffff", padding: 10 }}>
        <Text>Fixed</Text>
      </Column>
      <Column style={{ flex: 2 }}>
        <Text>Two shares</Text>
      </Column>
      <Column>
        <Text>One share</Text>
      </Column>
    </Row>
    <Section style={{ backgroundColor: "#111827", color: "#ffffff", padding: [32, 24, 32, 24], gap: 8, border: { top: "4px solid #f59e0b" } }} hidden={{ mobile: true }}>
      <Heading level={2}>Dark band</Heading>
      <Text style={{ color: "#d1d5db" }}>On every desktop</Text>
      <Row style={{ gap: 12 }}>
        <Column>
          <Text>Left</Text>
        </Column>
        <Column>
          <Text>Right</Text>
        </Column>
      </Row>
    </Section>
    <Section style={{ padding: 40 }} />
    <Column style={{ padding: [16, 0, 16, 0] }} />
  </Page>
);

/**
 * A Document's tables, which its builder holds as its table: a header, rows and a footer; the line between rows, cell
 * padding and backgrounds; a cell's own width, alignment, color, size and vertical alignment; links, breaks and runs in
 * cells; a table whose cells all have the same lines around them, collapsed; and a table's letter spacing, which its
 * header row doesn't take.
 */
export const lineItems = (
  <Document size="Letter" style={{ fontFamily: "Helvetica, Arial, sans-serif", fontSize: 13, color: "#111827" }}>
    <Heading>
      Invoice <MergeTag name="number" />
    </Heading>
    <Table style={{ cellPadding: [6, 8], rowBorder: { width: 1, style: "solid", color: "#e5e7eb" }, backgroundColor: "#ffffff" }}>
      <TableRow header style={{ backgroundColor: "#f3f4f6", color: "#374151" }}>
        <TableCell style={{ width: "60%" }}>Item</TableCell>
        <TableCell>Qty</TableCell>
        <TableCell style={{ textAlign: "right" }}>Amount</TableCell>
      </TableRow>
      <TableRow>
        <TableCell>
          Design <Span style={{ fontStyle: "italic" }}>review</Span>
        </TableCell>
        <TableCell>2</TableCell>
        <TableCell style={{ textAlign: "right" }}>$200.00</TableCell>
      </TableRow>
      <TableRow>
        <TableCell>
          <Link href="https://x.test/hosting">Hosting</Link>
          <LineBreak />
          Monthly
        </TableCell>
        <TableCell style={{ verticalAlign: "middle" }}>1</TableCell>
        <TableCell style={{ textAlign: "right", color: "#b91c1c" }}>$49.00</TableCell>
      </TableRow>
      <TableRow footer style={{ fontWeight: 700 }}>
        <TableCell>Total</TableCell>
        <TableCell />
        <TableCell style={{ textAlign: "right", fontSize: 15 }}>$249.00</TableCell>
      </TableRow>
    </Table>
    <Table style={{ borderCollapse: "collapse", fontSize: 11 }}>
      <TableRow>
        <TableCell style={{ border: "1px solid #9ca3af", padding: 4 }}>Due</TableCell>
        <TableCell style={{ border: "1px solid #9ca3af", padding: 4, backgroundColor: "#fef3c7" }}>Dec 1</TableCell>
      </TableRow>
    </Table>
    <Table style={{ letterSpacing: 1 }}>
      <TableRow header style={{ letterSpacing: 0 }}>
        <TableCell>Note</TableCell>
      </TableRow>
      <TableRow>
        <TableCell>Spaced out</TableCell>
      </TableRow>
    </Table>
  </Document>
);

/**
 * Tables at the edges: words drawn transparent, rows with tight lines (an empty cell right to left in one), a cell right
 * to left, a cell's own size at its row's line, a smaller one over two lines, runs larger than their cell's (in a header too), a footer only with its
 * own widths, a header see-through over its table's color, a row of a clear rgba() over it, a column of no width,
 * columns all of none, columns nearly half each, an underlined cell and a table's own border.
 */
export const tableEdges = (
  <Document size="A3">
    <Table>
      <TableRow style={{ lineHeight: 1 }}>
        <TableCell style={{ color: "transparent" }}>Hidden</TableCell>
        <TableCell dir="rtl">שלום 123</TableCell>
      </TableRow>
      <TableRow style={{ lineHeight: 1 }}>
        <TableCell>Label</TableCell>
        <TableCell dir="rtl" />
      </TableRow>
      <TableRow>
        <TableCell style={{ fontSize: 24, lineHeight: 1 }}>Hello</TableCell>
        <TableCell style={{ textDecoration: "underline" }}>Linked look</TableCell>
      </TableRow>
      <TableRow>
        <TableCell>
          <Span style={{ fontSize: 24 }}>Large</Span> amount
        </TableCell>
        <TableCell style={{ fontSize: 12 }}>
          First
          <LineBreak />
          Second
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell />
        <TableCell> </TableCell>
      </TableRow>
      <TableRow style={{ height: 10 }}>
        <TableCell />
        <TableCell> </TableCell>
      </TableRow>
    </Table>
    <Table>
      <TableRow header>
        <TableCell>
          Head <Span style={{ fontSize: 20 }}>big</Span>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell>Body</TableCell>
      </TableRow>
    </Table>
    <Table>
      <TableRow footer>
        <TableCell style={{ width: "80%" }}>Footer</TableCell>
        <TableCell>Only</TableCell>
      </TableRow>
    </Table>
    <Table style={{ backgroundColor: "#dbeafe", border: "2px solid #ff0000" }}>
      <TableRow header style={{ backgroundColor: "transparent" }}>
        <TableCell style={{ width: 0 }}>Narrow</TableCell>
        <TableCell>Wide</TableCell>
      </TableRow>
      <TableRow>
        <TableCell>A</TableCell>
        <TableCell>B</TableCell>
      </TableRow>
      <TableRow style={{ backgroundColor: "rgba(0, 0, 0, 0)" }}>
        <TableCell>C</TableCell>
        <TableCell>D</TableCell>
      </TableRow>
    </Table>
    <Table style={{ backgroundColor: "#fee2e2" }}>
      <TableRow style={{ backgroundColor: "rgba(0, 0, 0, 0)" }}>
        <TableCell>Clear over pink</TableCell>
      </TableRow>
    </Table>
    <Table>
      <TableRow>
        <TableCell style={{ width: 0 }}>None</TableCell>
        <TableCell style={{ width: 0 }}>Wide</TableCell>
      </TableRow>
    </Table>
    <Table>
      <TableRow>
        <TableCell style={{ width: "49.8%" }}>Nearly</TableCell>
        <TableCell>Half</TableCell>
      </TableRow>
    </Table>
    <Table>
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
  </Document>
);

/** Every template the round-trip tests take, by name. */
export const TEMPLATES: Record<string, React.ReactElement> = { sample, everyTool, invoice, text, blocks, lineItems, tableEdges };
