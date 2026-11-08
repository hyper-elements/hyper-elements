/**
 * validate()'s design checks (`design: true`): each fires where its problem is, and only there, with its fix. They're
 * off by default. The README's template passes them all, as every template an agent copies has to.
 */
import { Button, Column, Document, Email, Heading, Image, Link, MergeTag, Row, Table, TableCell, TableRow, Text } from "./index";
import { validate } from "./render";
import Receipt from "./readme-example";

const design = (element: React.ReactElement) => validate(element, { design: true }).diagnostics.filter((d) => d.code.startsWith("design/"));
const codes = (element: React.ReactElement) => design(element).map((d) => d.code);
const LONG = "Thanks for your order. We'll send tracking details as soon as it ships from our warehouse.";

describe("validate(element, { design: true })", () => {
  it("is off by default: a MergeTag is right in a template a sending service fills in", () => {
    const element = <Email><Heading level={1}>Hi <MergeTag name="first_name" /></Heading></Email>;
    expect(validate(element).diagnostics.filter((d) => d.code.startsWith("design/"))).toEqual([]);
    expect(codes(element)).toEqual(["design/merge-tag-visible"]);
  });

  it("gives each problem as a warning with what to write instead, at its place in the template", () => {
    const [found] = design(<Email><Text>Call +1 (503) 555-0142 any day.</Text></Email>);
    expect(found).toMatchObject({ code: "design/phone-number", severity: "warning", path: "root.children[0]" });
    expect(found.fix).toContain("+1&nbsp;(503)&nbsp;555&#8209;0142");
  });

  it("finds a MergeTag shown as text, and a typed {{tag}}, but not a tag in a link's href", () => {
    expect(codes(<Email><Heading level={1}>Hi <MergeTag name="first_name" /></Heading></Email>)).toEqual(["design/merge-tag-visible"]);
    expect(codes(<Email><Text>Dear {"{{first_name}}"},</Text></Email>)).toEqual(["design/merge-tag-visible"]);
    expect(codes(<Email><Text><Link href="{{unsubscribe_url}}">Unsubscribe</Link></Text></Email>)).toEqual([]);
  });

  it("finds a table that keeps four or more columns on a phone, and not one of two", () => {
    const table = (columns: number) => (
      <Email width={600}>
        <Table>
          <TableRow header>{Array.from({ length: columns }, (_, i) => <TableCell key={i}>Column {i}</TableCell>)}</TableRow>
          <TableRow>{Array.from({ length: columns }, (_, i) => <TableCell key={i}>Value {i}</TableCell>)}</TableRow>
        </Table>
      </Email>
    );
    expect(codes(table(5))).toEqual(["design/table-columns"]);
    expect(codes(table(2))).toEqual([]);
  });

  it("finds faint text against what's behind it, a Button's own background included", () => {
    expect(codes(<Email><Text style={{ color: "#cccccc" }}>Faint</Text></Email>)).toEqual(["design/contrast"]);
    expect(codes(<Email style={{ backgroundColor: "#111827" }}><Text style={{ color: "#374151" }}>Dark on dark</Text></Email>)).toEqual(["design/contrast"]);
    expect(codes(<Email><Text style={{ color: "#6b7280" }}>Grey</Text></Email>)).toEqual([]);
    expect(codes(<Email><Button href="https://example.com" style={{ backgroundColor: "#fde68a", color: "#ffffff" }}>Go</Button></Email>)).toEqual(["design/contrast"]);
    expect(codes(<Email><Button href="https://example.com" style={{ backgroundColor: "#111827", color: "#ffffff" }}>Go</Button></Email>)).toEqual([]);
  });

  it("finds an Image without alt text", () => {
    expect(codes(<Email><Image src={{ src: "https://example.com/a.png", width: 200, height: 100 }} /></Email>)).toEqual(["design/alt"]);
    expect(codes(<Email><Image src={{ src: "https://example.com/a.png", width: 200, height: 100 }} alt="" /></Email>)).toEqual(["design/alt"]);
    expect(codes(<Email><Image src={{ src: "https://example.com/a.png", width: 200, height: 100 }} alt="Acme" /></Email>)).toEqual([]);
  });

  it("finds a phone number that can split at a space or a hyphen, and not one joined with non-breaking ones", () => {
    const [found] = design(<Email><Text>Call +1 (503) 555-0142 any day.</Text></Email>);
    expect(found?.code).toBe("design/phone-number");
    expect(found?.fix).toContain("+1&nbsp;(503)&nbsp;555&#8209;0142");
    // A hyphen breaks a line too: non-breaking spaces alone aren't enough.
    expect(codes(<Email><Text>{"Call +1\u00a0(503)\u00a0555-0142 any day."}</Text></Email>)).toEqual(["design/phone-number"]);
    expect(codes(<Email><Text>{"Call +1\u00a0(503)\u00a0555\u20110142 any day."}</Text></Email>)).toEqual([]);
  });

  it("checks a Document's text but not a phone layout it doesn't have", () => {
    const doc = (color: string, columns: number) => (
      <Document size="A4">
        <Text style={{ color }}>Total due</Text>
        <Table>
          <TableRow>{Array.from({ length: columns }, (_, i) => <TableCell key={i}>Value {i}</TableCell>)}</TableRow>
        </Table>
      </Document>
    );
    expect(codes(doc("#cccccc", 5))).toEqual(["design/contrast"]);
    expect(codes(doc("#111827", 5))).toEqual([]);
  });

  it("leaves out what didn't match reviewers: small text and text in a narrow box", () => {
    expect(codes(<Email><Text style={{ fontSize: 10 }}>Fine print</Text></Email>)).toEqual([]);
    expect(codes(<Email><Row stackOnMobile={false}><Column><Text>{LONG}</Text></Column><Column><Text>{LONG}</Text></Column></Row></Email>)).toEqual([]);
  });

  it("checks nothing in a template with errors, which is invalid", () => {
    const { valid, diagnostics } = validate(<Email><Text style={{ marginBottom: 16 } as never}>{"{{name}}"}</Text></Email>, { design: true });
    expect(valid).toBe(false);
    expect(diagnostics.some((d) => d.code.startsWith("design/"))).toBe(false);
  });

  it("passes the README's template", () => {
    expect(design(<Receipt />)).toEqual([]);
  });
});
