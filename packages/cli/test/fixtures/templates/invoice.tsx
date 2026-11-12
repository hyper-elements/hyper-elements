import { Column, Document, Heading, Image, Row, Text } from "@hyper-elements/react";

const FONTS = [
  { family: "Inter", src: "../fonts/Inter-Regular.ttf", weight: 400 },
  { family: "Inter", src: "../fonts/Inter-Bold.ttf", weight: 700 },
] as const;

const lines = [
  ["Tide tables, summer edition", "2", "£24.00"],
  ["Chart of the outer harbour", "1", "£18.50"],
  ["Signal flags, a set of 40", "1", "£62.00"],
];

export default function Invoice() {
  return (
    <Document size="A5" margin={[40, 36]} title="Invoice 1042" fonts={FONTS} style={{ fontFamily: "Inter, sans-serif", fontSize: 12, lineHeight: 1.5, color: "#12242E", gap: 16 }}>
      <Row style={{ gap: 12 }}>
        <Column style={{ flex: "none" }}>
          <Image src={{ src: "../images/flag.png", width: 32, height: 32 }} alt="Signal flag U" style={{ width: 32 }} />
        </Column>
        <Column>
          <Heading level={1} style={{ fontSize: 22, fontWeight: 700 }}>Invoice 1042</Heading>
          <Text style={{ color: "#55636B" }}>Merrow Line chandlery · 12 Quay Street</Text>
        </Column>
      </Row>
      <Image src={{ src: "../images/tide.png", width: 64, height: 64 }} alt="The tide, in two blues" style={{ width: 120 }} />
      {lines.map(([item, quantity, price]) => (
        <Row key={item} style={{ gap: 8 }}>
          <Column>
            <Text>{item}</Text>
          </Column>
          <Column style={{ flex: "none" }}>
            <Text>{quantity}</Text>
          </Column>
          <Column style={{ flex: "none" }}>
            <Text>{price}</Text>
          </Column>
        </Row>
      ))}
      <Text style={{ fontWeight: 700 }}>Total £128.50 — thank you.</Text>
    </Document>
  );
}
