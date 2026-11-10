import { Document, Heading, Table, TableCell, TableRow, Text } from "@hyper-elements/react";

const items = [
  ["Design review", "1", "$1,200.00"],
  ["Template build", "3", "$2,400.00"],
  ["Support hours", "10", "$950.00"],
];
const totals = [
  ["Subtotal", "$4,550.00"],
  ["Tax", "$364.00"],
];
const right = { textAlign: "right" } as const;

export default function Invoice() {
  return (
    <Document size="A4" margin={48} style={{ fontFamily: "Inter", fontSize: 11, gap: 16 }}>
      <Heading level={1} style={{ fontSize: 24 }}>Invoice INV-2026-014</Heading>
      <Text>Issued November 8, 2026. Due December 8, 2026.</Text>
      <Text>Bill to: Northwind Traders, 12 Harbor Rd, Portland, OR 97209</Text>
      <Table style={{ cellPadding: [6, 0], rowBorder: "1px solid #e5e7eb" }}>
        <TableRow header>
          <TableCell>Item</TableCell>
          <TableCell style={right}>Qty</TableCell>
          <TableCell style={right}>Price</TableCell>
        </TableRow>
        {items.map(([item, qty, price]) => (
          <TableRow key={item}>
            <TableCell>{item}</TableCell>
            <TableCell style={right}>{qty}</TableCell>
            <TableCell style={right}>{price}</TableCell>
          </TableRow>
        ))}
        {totals.map(([label, amount]) => (
          <TableRow key={label}>
            <TableCell colSpan={2} style={right}>{label}</TableCell>
            <TableCell style={right}>{amount}</TableCell>
          </TableRow>
        ))}
        <TableRow>
          <TableCell colSpan={2} style={{ ...right, fontWeight: 700 }}>Total</TableCell>
          <TableCell style={{ ...right, fontWeight: 700 }}>$4,914.00</TableCell>
        </TableRow>
      </Table>
      <Text style={{ fontSize: 9, color: "#6b7280" }}>Orbit Labs, 500 Market St, San Francisco. Questions: billing@orbit.dev</Text>
    </Document>
  );
}
