import {
  Button,
  Column,
  Email,
  Heading,
  Image,
  LineBreak,
  Link,
  List,
  ListItem,
  MergeTag,
  Row,
  Span,
  Table,
  TableCell,
  TableRow,
  Text,
} from "@hyper-elements/react";

const logo = {
  src: "https://hyperelements.dev/img/orbit-logo.png",
  width: 252,
  height: 128,
};

export default function Receipt() {
  return (
    <Email
      lang="en"
      previewText="Order #10482 has shipped. Here is your receipt."
      style={{ backgroundColor: "#f4f4f5", gap: 16 }}
    >
      <Image src={logo} alt="Orbit" style={{ width: 96 }} />
      <Column
        style={{
          backgroundColor: "#ffffff",
          padding: 32,
          gap: 16,
          borderRadius: 8,
        }}
      >
        <Heading
          level={1}
          style={{ fontSize: 24, mobile: { fontSize: 20 } }}
        >
          Thanks for your order, <MergeTag name="first_name" />
        </Heading>
        <Text>
          Order <Span style={{ fontWeight: 700 }}>#10482</Span> shipped.
          <LineBreak />
          <Link href="https://example.com/orders/10482">Track it</Link>
        </Text>
        <Table
          style={{ cellPadding: [8, 0], rowBorder: "1px solid #e4e4e7" }}
        >
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
        <Button
          href="https://example.com/orders/10482"
          style={{ backgroundColor: "#15132e", borderRadius: 6 }}
        >
          View your order
        </Button>
      </Column>
      <Text style={{ fontSize: 14, color: "#52525b", textAlign: "center" }}>
        Orbit Inc., 1 Market St, San Francisco
      </Text>
    </Email>
  );
}
