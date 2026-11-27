/**
 * Documents paginated in Node and in Chromium (paginator.test.tsx), and the edits made to one, keystroke by keystroke.
 * Plain templates: nothing here reads a file, so a browser runs them as Node does.
 */
import type { ReactElement } from "react";
import { Column, Document, Heading, PageFooter, PageNumber, Row, Section, Span, Table, TableCell, TableRow, Text } from "@hyper-elements/react";

const sentences = (count: number, what: string) => Array.from({ length: count }, (_, i) => `Sentence ${i + 1} of ${what}.`).join(" ");
const arabic = (count: number, from = 1) => Array.from({ length: count }, (_, i) => `هذه جملة طويلة باللغة العربية، رقم ${from + i} في الفقرة (مثال).`).join(" ");

/** A report of `paragraphs` paragraphs, a Heading every tenth, its sixth paragraph ending in `typed`. */
export const report = (paragraphs: number, typed = ""): ReactElement => (
  <Document>
    <PageFooter>
      <Text style={{ textAlign: "right" }}>
        Page <PageNumber /> of <PageNumber total />
      </Text>
    </PageFooter>
    <Section>
      {Array.from({ length: paragraphs }, (_, i) =>
        i % 10 === 0 ? (
          <Heading key={i} level={2}>{`Part ${i / 10 + 1}`}</Heading>
        ) : (
          <Text key={i} style={{ textAlign: i % 3 === 0 ? "justify" : "left" }}>
            {sentences(12, `paragraph ${i}`)}
            {i === 5 ? typed : ""}
          </Text>
        )
      )}
    </Section>
  </Document>
);

/** What's typed into the report, a keystroke at a time. */
export const typing = Array.from({ length: 12 }, (_, i) => " and more words".slice(0, i + 4));

export const designs: Record<string, ReactElement> = {
  report: report(80),
  table: (
    <Document>
      <Table>
        <TableRow header>
          <TableCell>Item</TableCell>
          <TableCell>Amount</TableCell>
        </TableRow>
        {Array.from({ length: 70 }, (_, i) => (
          <TableRow key={i}>
            <TableCell>{`Row ${i + 1}`}</TableCell>
            <TableCell>$1.00</TableCell>
          </TableRow>
        ))}
      </Table>
    </Document>
  ),
  columns: (
    <Document>
      <Row style={{ gap: 12 }}>
        <Column style={{ width: "30%" }}>
          <Text>{sentences(10, "the sidebar")}</Text>
        </Column>
        <Column>
          {Array.from({ length: 30 }, (_, i) => (
            <Text key={i}>{sentences(6, `column paragraph ${i}`)}</Text>
          ))}
        </Column>
      </Row>
    </Document>
  ),
  arabic: (
    <Document dir="rtl" style={{ fontFamily: "Noto Arabic" }}>
      <Heading level={2}>عنوان التقرير</Heading>
      {(["right", "justify"] as const).map((textAlign) => (
        <Text key={textAlign} style={{ textAlign }}>
          {arabic(40)} <Span style={{ color: "#b91c1c" }}>Elements</Span> {arabic(30, 41)}
        </Text>
      ))}
    </Document>
  ),
};
