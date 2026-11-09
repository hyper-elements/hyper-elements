import { Button, Column, Email, Heading, Row, Table, TableCell, TableRow, Text } from "@hyper-elements/react";

const items = [
  ["Linen shirt × 1", "$68.00"],
  ["Canvas tote × 2", "$48.00"],
  ["Wool socks × 3", "$36.00"],
];
const totals = [
  ["Subtotal", "$152.00"],
  ["Shipping", "$8.00"],
];

export default function Receipt() {
  return (
    <Email previewText="Order #10482 is confirmed." style={{ backgroundColor: "#ffffff", fontFamily: "Inter, Arial, sans-serif" }}>
      <Column style={{ padding: 32, gap: 24 }}>
        <Heading level={1} style={{ fontSize: 28 }}>Thanks for your order</Heading>
        <Text>Order #10482</Text>
        <Table style={{ cellPadding: [8, 0], rowBorder: "1px solid #e5e7eb" }}>
          {items.map(([item, price]) => (
            <TableRow key={item}>
              <TableCell>{item}</TableCell>
              <TableCell style={{ textAlign: "right" }}>{price}</TableCell>
            </TableRow>
          ))}
          {totals.map(([label, amount]) => (
            <TableRow key={label}>
              <TableCell>{label}</TableCell>
              <TableCell style={{ textAlign: "right" }}>{amount}</TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell style={{ fontWeight: 700 }}>Total</TableCell>
            <TableCell style={{ fontWeight: 700, textAlign: "right" }}>$160.00</TableCell>
          </TableRow>
        </Table>
        <Row style={{ gap: 16 }}>
          <Column style={{ gap: 4 }}>
            <Text style={{ fontWeight: 700 }}>Ship to</Text>
            <Text>Sam Rivera, 18 Valencia St, San Francisco, CA 94103</Text>
          </Column>
          <Column style={{ gap: 4 }}>
            <Text style={{ fontWeight: 700 }}>Billing</Text>
            <Text>Sam Rivera, PO Box 221, Oakland, CA 94604</Text>
          </Column>
        </Row>
        <Button href="https://shop.orbit.dev/orders/10482" style={{ backgroundColor: "#111111", color: "#ffffff", borderRadius: 6 }}>
          Track your order
        </Button>
        <Text style={{ fontSize: 12, color: "#6b7280" }}>Questions? Reply to this email.</Text>
      </Column>
    </Email>
  );
}
