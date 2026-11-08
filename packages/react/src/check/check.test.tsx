/**
 * The design checks: each fires where its problem is, and only there. The README's template passes them all, as
 * every template an agent copies has to.
 */
import { Button, Column, Document, Email, Heading, Image, Link, MergeTag, Row, Section, Table, TableCell, TableRow, Text } from "@hyper-elements/react";
import { check } from "./index";
import Receipt from "../primitives/readme-example";

const codes = (element: React.ReactElement) => check(element).diagnostics.map((d) => d.code);
const LONG = "Thanks for your order. We'll send tracking details as soon as it ships from our warehouse.";

describe("check()", () => {
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

  it("finds a phone number that can split at a space, and not one joined with non-breaking spaces", () => {
    const [found] = check(<Email><Text>Call +1 (503) 555-0142 any day.</Text></Email>).diagnostics;
    expect(found.code).toBe("design/phone-number");
    expect(found.message).toContain("+1&nbsp;(503)&nbsp;555-0142");
    expect(codes(<Email><Text>Call +1{" "}(503){" "}555-0142 any day.</Text></Email>)).toEqual([]);
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

  it("gives a template's errors instead of checking it", () => {
    const { diagnostics } = check(<Email><Text style={{ marginBottom: 16 } as never}>x</Text></Email>);
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics.every((d) => d.severity === "error")).toBe(true);
  });

  it("passes the README's template", () => {
    expect(check(<Receipt />).diagnostics).toEqual([]);
  });
});
