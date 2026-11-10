import { Column, Email, Heading, Link, MergeTag, Row, Text } from "@hyper-elements/react";

const items = [
  { name: "Signups", value: "1,284" },
  { name: "Active teams", value: "312" },
  { name: "Emails sent", value: "48,902" },
];

function Item({ name, value }: { name: string; value: string }) {
  return (
    <Row style={{ padding: [8, 0], border: { bottom: "1px solid #e5e7eb" } }} stackOnMobile={false}>
      <Text>{name}</Text>
      <Text style={{ textAlign: "right", fontWeight: 700 }}>{value}</Text>
    </Row>
  );
}

export default function Report() {
  return (
    <Email previewText="Your Orbit numbers for the week." style={{ backgroundColor: "#ffffff", fontFamily: "Inter, Arial, sans-serif" }}>
      <Column style={{ padding: 32, gap: 16 }}>
        <Heading level={1} style={{ fontSize: 26 }}>Your week in Orbit</Heading>
        <Text>
          Hi <MergeTag name="first_name" />,
        </Text>
        <Column>
          {items.map((item) => (
            <Item key={item.name} {...item} />
          ))}
        </Column>
        <Text>
          <Link href="https://orbit.dev/reports/weekly">See the full report</Link>
        </Text>
        <Text style={{ fontSize: 12, color: "#6b7280" }}>
          You get this email as an admin of <MergeTag name="team_name" />.
        </Text>
      </Column>
    </Email>
  );
}
