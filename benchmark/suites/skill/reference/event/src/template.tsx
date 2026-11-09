import { Button, Column, Email, Heading, Image, Row, Text } from "@hyper-elements/react";

const details = [
  ["Date", "December 4, 2026"],
  ["Time", "9:00 AM PT"],
  ["Place", "Fort Mason, San Francisco"],
];

export default function Event() {
  return (
    <Email previewText="Join us December 4 in San Francisco." style={{ backgroundColor: "#f1f2f6", fontFamily: "Inter, Arial, sans-serif" }}>
      <Column style={{ backgroundColor: "#ffffff", gap: 24, padding: [0, 0, 32, 0] }}>
        <Image src={{ src: "https://assets.orbit.dev/img/event-hero.png", width: 1200, height: 600 }} alt="Orbit Summit" />
        <Column style={{ gap: 16, padding: [0, 32] }}>
          <Heading level={1} style={{ fontSize: 28 }}>Orbit Summit 2026</Heading>
          <Text>A day of talks and workshops on building for every surface.</Text>
          <Row style={{ gap: 16 }}>
            {details.map(([label, value]) => (
              <Column key={label} style={{ gap: 4 }}>
                <Text style={{ fontSize: 12, color: "#6b7280" }}>{label}</Text>
                <Text style={{ fontWeight: 700 }}>{value}</Text>
              </Column>
            ))}
          </Row>
          <Button href="https://orbit.dev/summit" style={{ backgroundColor: "#6d5efc", color: "#ffffff", borderRadius: 6, hover: { backgroundColor: "#4c3df0" } }}>
            Save your seat
          </Button>
        </Column>
      </Column>
      <Text style={{ fontSize: 12, color: "#6b7280", textAlign: "center", padding: 16 }}>Orbit Labs, 500 Market St, San Francisco</Text>
    </Email>
  );
}
