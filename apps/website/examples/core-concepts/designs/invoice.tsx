import {
  Circle,
  Column,
  Document,
  Heading,
  PageFooter,
  PageNumber,
  Row,
  Svg,
  Table,
  TableCell,
  TableRow,
  Text,
} from "@hyper-elements/react";

const fonts = [
  { family: "Inter", src: "../fonts/Inter-Regular.ttf", weight: 400 },
  { family: "Inter", src: "../fonts/Inter-Bold.ttf", weight: 700 },
];
const lines = [
  { item: "Orbit Team plan, 12 seats", quantity: 12, price: 29 },
  { item: "Extra workspaces", quantity: 2, price: 15 },
  { item: "Priority support", quantity: 1, price: 120 },
];
const money = (amount: number) => `$${amount.toFixed(2)}`;
const total = lines.reduce((sum, line) => sum + line.quantity * line.price, 0);

const quiet = { color: "#5b6478", fontSize: 12 } as const;
const cell = { padding: [10, 0], border: { bottom: "1px solid #e2e5ee" } } as const;
const right = { ...cell, textAlign: "right" } as const;

export default function Invoice() {
  return (
    <Document
      size="A4"
      margin={[56, 64, 48, 64]}
      lang="en"
      title="Invoice INV-0417, Orbit"
      fonts={fonts}
      style={{ backgroundColor: "#ffffff", fontFamily: "Inter", fontSize: 13 }}
    >
      <Document.Page style={{ gap: 32 }}>
        <Row style={{ alignItems: "center" }}>
          <Row style={{ alignItems: "center", gap: 10 }}>
            <Svg width={26} height={26} title="Orbit">
              <Circle
                cx={13}
                cy={13}
                r={9}
                style={{ fill: "transparent", stroke: "#4f46e5", strokeWidth: 8 }}
              />
            </Svg>
            <Text style={{ fontSize: 22, fontWeight: 700 }}>Orbit</Text>
          </Row>
          <Text style={{ ...quiet, textAlign: "right" }}>
            1 Market St, San Francisco · billing@orbit.example
          </Text>
        </Row>
        <Heading level={1} style={{ fontSize: 40, lineHeight: 1.1 }}>
          Invoice
        </Heading>
        <Row style={{ alignItems: "start", gap: 24 }}>
          <Column style={{ gap: 2 }}>
            <Text style={quiet}>Billed to</Text>
            <Text style={{ fontWeight: 700 }}>Northwind Traders</Text>
            <Text>42 Harbor Road</Text>
            <Text>Portland, OR 97201</Text>
          </Column>
          <Column style={{ gap: 2 }}>
            <Text style={quiet}>Number</Text>
            <Text style={{ fontWeight: 700 }}>INV-0417</Text>
          </Column>
          <Column style={{ gap: 2 }}>
            <Text style={quiet}>Due</Text>
            <Text style={{ fontWeight: 700 }}>In 30 days</Text>
          </Column>
        </Row>
        <Table>
          <TableRow header>
            <TableCell style={{ ...cell, ...quiet }}>Description</TableCell>
            <TableCell style={{ ...right, ...quiet, width: 60 }}>Qty</TableCell>
            <TableCell style={{ ...right, ...quiet, width: 100 }}>Price</TableCell>
            <TableCell style={{ ...right, ...quiet, width: 110 }}>Amount</TableCell>
          </TableRow>
          {lines.map((line) => (
            <TableRow key={line.item}>
              <TableCell style={cell}>{line.item}</TableCell>
              <TableCell style={right}>{String(line.quantity)}</TableCell>
              <TableCell style={right}>{money(line.price)}</TableCell>
              <TableCell style={right}>{money(line.quantity * line.price)}</TableCell>
            </TableRow>
          ))}
        </Table>
        <Column style={{ alignItems: "end" }}>
          <Column style={{ width: 210, gap: 2 }}>
            <Text style={{ ...quiet, textAlign: "right" }}>Total due</Text>
            <Text
              style={{
                fontSize: 28,
                fontWeight: 700,
                lineHeight: 1.2,
                textAlign: "right",
                color: "#4f46e5",
              }}
            >
              {money(total)}
            </Text>
          </Column>
        </Column>
      </Document.Page>
      <PageFooter>
        <Text style={{ ...quiet, padding: [12, 0, 0], border: { top: "1px solid #e2e5ee" } }}>
          Pay by bank transfer within 30 days, quoting the invoice number. Page{" "}
          <PageNumber /> of <PageNumber total />
        </Text>
      </PageFooter>
    </Document>
  );
}
