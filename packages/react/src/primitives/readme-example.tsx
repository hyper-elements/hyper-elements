import { Button, Column, defineTheme, Email, Heading, Image, Link, List, ListItem, MergeTag, Text, Row, Span, Table, TableCell, TableRow, token } from "./index";

// The brand, once: every Email, Page, Document and Canvas that takes it is on brand.
const acme = defineTheme({
  colors: { background: "#f4f4f5", foreground: "#18181b", primary: "#111827", primaryForeground: "#ffffff", muted: "#71717a", border: "#e4e4e7" },
  fonts: { body: "Inter, Arial, sans-serif" },
  components: {
    Heading: { by: { level: { 1: { fontSize: 24, mobile: { fontSize: 20 } } } } },
    Button: { borderRadius: 6, hover: { backgroundColor: "#374151" } },
  },
  styles: { card: { backgroundColor: "#ffffff", padding: 32, gap: 16, borderRadius: 8 } },
});

export default function Receipt() {
  return (
    <Email theme={acme} previewText="Your Acme receipt" style={{ gap: 16 }}>
      <Image src={{ src: "https://example.com/logo.png", width: 240, height: 80 }} alt="Acme" style={{ width: 120 }} />
      <Column style={{ apply: ["card"] }}>
        <Heading level={1}>
          Thanks for your order, <MergeTag name="first_name" />
        </Heading>
        <Text>
          Order <Span style={{ fontWeight: 700 }}>#10482</Span> ships tomorrow. <Link href="https://example.com/orders/10482">Track it</Link>.
        </Text>
        <Table style={{ cellPadding: [8, 0], rowBorder: { width: 1, style: "solid", color: token("colors.border") } }}>
          <TableRow header>
            <TableCell>Item</TableCell>
            <TableCell style={{ textAlign: "right" }}>Price</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Linen shirt</TableCell>
            <TableCell style={{ textAlign: "right" }}>$48.00</TableCell>
          </TableRow>
        </Table>
        <Row style={{ gap: 16 }}>
          <Column>
            <Text style={{ fontWeight: 700 }}>Shipping to</Text>
            <Text>Ada Lovelace, London</Text>
          </Column>
          <Column>
            <Text style={{ fontWeight: 700 }}>Next steps</Text>
            <List type="number">
              <ListItem>We pack it</ListItem>
              <ListItem>You track it</ListItem>
            </List>
          </Column>
        </Row>
        <Button href="https://example.com/orders/10482">View your order</Button>
      </Column>
      <Text style={{ fontSize: 12, color: token("colors.muted"), textAlign: "center" }}>Acme Inc., 1 Market St, San Francisco</Text>
    </Email>
  );
}
