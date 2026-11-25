/**
 * A template as a design's root, drawn by the PDF entry: renderPdf() goes through prepare(), so the template's check
 * runs first, and what's drawn is the Document the template built.
 */
import { Document, Heading, Text, prop } from "@hyper-elements/react";
import type React from "react";
import { renderPdf } from "../../src/pdf";
import { template } from "../../src/template";

const Certificate = template({
  id: "acme.Certificate",
  version: "1.0.0",
  label: "Certificate",
  root: "Document",
  formats: { a4: { size: "A4" }, letter: { size: "Letter" } },
  fields: { name: prop.text({ label: "Name", required: true, maxLength: 60 }), date: prop.date({ label: "Date", required: true }) },
  example: { name: "Ada Lovelace", date: "2026-12-03" },
  render: (v, { format }) => (
    <Document size={format === "letter" ? "Letter" : "A4"} title="Certificate" lang="en">
      <Heading field="name">{v.name}</Heading>
      <Text field="date">{v.date}</Text>
    </Document>
  ),
});
const C = Certificate as unknown as React.FC<Record<string, unknown>>;

it("draws the Document the template built, and refuses what it refuses", async () => {
  const { pdf } = await renderPdf(<C format="letter" {...Certificate.example} />);
  expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-");
  await expect(renderPdf(<C format="letter" name="" date="2026-02-30" />)).rejects.toMatchObject({
    diagnostics: expect.arrayContaining([expect.objectContaining({ code: "template/value", path: "values.date" })]),
  });
});

it("checks a Document's page against its format", () => {
  const Wrong = template({ ...Certificate, render: () => <Document size="A5"><Text>x</Text></Document> } as never) as typeof Certificate;
  expect(Wrong.check(Wrong.example).diagnostics.map((d) => [d.code, d.path])).toEqual(expect.arrayContaining([["template/format", "root.props.size"]]));
});
