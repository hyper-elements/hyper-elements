/**
 * renderPdf() and paginate() where the installed react-pdf doesn't say where it laid the PDF out (its private layout data
 * gone in an update): nothing can flow, and they say so. A file of its own, since react-pdf's engine is replaced in it.
 */
import { Document, Text } from "@hyper-elements/react";
import { paginate, renderPdf } from "../../src/pdf";

vi.mock("@hyper-elements/core/pdf", async (original) => {
  const core = await original<typeof import("@hyper-elements/core/pdf")>();
  return {
    ...core,
    // Drawn, and nothing said of where; and nothing measured without drawing.
    reactPdf: async (document: Parameters<typeof core.reactPdf>[0]) => ({ ...(await core.reactPdf(document)), placed: undefined }),
    reactPdfLayout: async () => undefined,
    createLayout: async () => undefined,
  };
});

const long = (
  <Document>
    {Array.from({ length: 60 }, (_, i) => (
      <Text key={i}>{`Paragraph ${i}: Elements writes the same design to email, the web, print and PDF, so this stands in for a section.`}</Text>
    ))}
  </Document>
);

it("says content can't flow where react-pdf doesn't say where it laid the PDF out", async () => {
  for (const result of [await renderPdf(long), await paginate(long)]) {
    expect(result.diagnostics.map((d) => [d.code, d.severity])).toContainEqual(["pdf/layout", "warning"]);
    // Its pages as written: one, its content cut off.
    expect(result.plan.pages).toHaveLength(1);
  }
});
