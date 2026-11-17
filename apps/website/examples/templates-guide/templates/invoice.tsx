// templates/invoice.tsx
import { Circle, Column, Document, Heading, PageFooter, PageNumber, Row, Svg, Table, TableCell, TableRow, Text, prop } from "@hyper-elements/react";
import { formatDate, template } from "@hyper-elements/react/template";

const FONTS = [
  { family: "Inter", src: "../fonts/Inter-Regular.ttf", weight: 400 },
  { family: "Inter", src: "../fonts/Inter-Bold.ttf", weight: 700 },
];
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const quiet = { fontSize: 11, color: "#5b6478" } as const;
const cell = { padding: [10, 0], border: { bottom: "1px solid #e2e5ee" } } as const;
const right = { ...cell, textAlign: "right" } as const;

/** A label over one field's value. */
const fact = (name: string, field: string, value: string) => (
  <Column style={{ gap: 2 }}>
    <Text style={quiet}>{name}</Text>
    <Text field={field} style={{ fontWeight: 700 }}>{value}</Text>
  </Column>
);

export default template({
  id: "acme.Invoice",
  version: "1.0.0",
  label: "Orbit invoice",
  guidance: "One invoice per customer per month. Describe each line as the customer's plan names it.",
  root: "Document",
  formats: { a4: { size: "A4" }, letter: { size: "Letter" } },
  // Open: what changes from one invoice to the next. All of it is data.
  fields: {
    number: prop.text({ label: "Invoice number", required: true, pattern: "^INV-\\d{4}$" }),
    issued: prop.date({ label: "Issued", required: true }),
    due: prop.date({ label: "Due", required: true }),
    customer: prop.object(
      {
        name: prop.text({ label: "Name", required: true, maxLength: 60 }),
        address: prop.list(prop.text({ label: "Address line", maxLength: 60 }), { label: "Address", required: true, min: 1, max: 4 }),
      },
      { label: "Billed to", required: true },
    ),
    lines: prop.list(
      prop.object(
        {
          description: prop.text({ label: "Description", required: true, maxLength: 80 }),
          quantity: prop.number({ label: "Quantity", required: true, min: 1 }),
          price: prop.number({ label: "Unit price", required: true, min: 0 }),
        },
        { label: "Line" },
      ),
      { label: "Lines", required: true, min: 1, max: 40 },
    ),
    note: prop.text({ label: "Note", maxLength: 200 }),
  },
  example: {
    number: "INV-0412",
    issued: "2026-12-01",
    due: "2026-12-31",
    customer: { name: "Northwind Traders", address: ["48 Harbor Road", "Portland, OR 97209"] },
    lines: [
      { description: "Orbit Team plan, December", quantity: 12, price: 29 },
      { description: "Extra workspaces", quantity: 2, price: 15 },
    ],
  },
  render(v, { format }) {
    // Locked: the sums. The template adds them up, so a total is never typed.
    const total = v.lines.reduce((sum, line) => sum + line.quantity * line.price, 0);
    return (
      <Document size={format === "letter" ? "Letter" : "A4"} margin={[56, 64, 48, 64]} title={`Invoice ${v.number}, Orbit`} lang="en" fonts={FONTS} style={{ backgroundColor: "#ffffff", fontFamily: "Inter", fontSize: 13, color: "#0b1020" }}>
        <Document.Page style={{ gap: 32 }}>
          {/* Locked: the letterhead. */}
          <Row id="letterhead" style={{ alignItems: "center" }}>
            <Row style={{ alignItems: "center", gap: 10 }}>
              <Svg width={26} height={26} title="Orbit">
                <Circle cx={13} cy={13} r={9} style={{ fill: "transparent", stroke: "#4f46e5", strokeWidth: 8 }} />
              </Svg>
              <Text style={{ fontSize: 22, fontWeight: 700 }}>Orbit</Text>
            </Row>
            <Column>
              <Text style={{ ...quiet, textAlign: "right" }}>1 Main Street, Springfield · billing@orbit.example</Text>
            </Column>
          </Row>

          <Heading level={1} style={{ fontSize: 40, lineHeight: 1.1 }}>Invoice</Heading>

          <Row style={{ alignItems: "start", gap: 24 }}>
            <Column id="customer" field="customer" style={{ gap: 2 }}>
              <Text style={quiet}>Billed to</Text>
              <Text style={{ fontWeight: 700 }}>{v.customer.name}</Text>
              {v.customer.address.map((line, i) => (
                <Text key={i}>{line}</Text>
              ))}
            </Column>
            <Row id="details" style={{ gap: 24 }}>
              {fact("Number", "number", v.number)}
              {fact("Issued", "issued", formatDate(v.issued, "en-US", { month: "short", day: "numeric" }))}
              {fact("Due", "due", formatDate(v.due, "en-US", { month: "short", day: "numeric" }))}
            </Row>
          </Row>

          <Table id="lines" field="lines">
            <TableRow header>
              <TableCell style={{ ...cell, ...quiet }}>Description</TableCell>
              <TableCell style={{ ...right, ...quiet, width: 60 }}>Qty</TableCell>
              <TableCell style={{ ...right, ...quiet, width: 100 }}>Unit price</TableCell>
              <TableCell style={{ ...right, ...quiet, width: 110 }}>Amount</TableCell>
            </TableRow>
            {v.lines.map((line, i) => (
              <TableRow key={i}>
                <TableCell style={cell}>{line.description}</TableCell>
                <TableCell style={right}>{String(line.quantity)}</TableCell>
                <TableCell style={right}>{money.format(line.price)}</TableCell>
                <TableCell style={right}>{money.format(line.quantity * line.price)}</TableCell>
              </TableRow>
            ))}
          </Table>

          <Column style={{ alignItems: "end" }}>
            <Column id="total" style={{ width: 210, gap: 2 }}>
              <Text style={{ ...quiet, textAlign: "right" }}>Total due</Text>
              <Text style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, textAlign: "right", color: "#4f46e5" }}>{money.format(total)}</Text>
            </Column>
          </Column>

          {v.note ? <Text id="note" field="note" style={quiet}>{v.note}</Text> : null}
        </Document.Page>

        {/* Locked: the footer, on every page. */}
        <PageFooter id="footer">
          <Text style={{ ...quiet, padding: [12, 0, 0], border: { top: "1px solid #e2e5ee" } }}>
            Pay by bank transfer within 30 days, quoting the invoice number. Orbit Software, Inc., EIN 00-0000000. Page <PageNumber /> of <PageNumber total />
          </Text>
        </PageFooter>
      </Document>
    );
  },
});
