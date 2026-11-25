import { Column, Email, Heading, Section, Text } from "@hyper-elements/react";

export default function Example() {
  return (
    <Email width={600} style={{ backgroundColor: "#f4f4f5" }}>
      <Section
        id="band"
        style={{ backgroundColor: "#15132e", padding: [24, 40], color: "#ffffff" }}
      >
        <Heading id="title" level={2}>Acme weekly</Heading>
      </Section>
      <Section style={{ padding: [32, 40] }}>
        <Column id="card" style={{ backgroundColor: "#ffffff", padding: 24, gap: 8 }}>
          <Heading level={3}>This week</Heading>
          <Text>A Section is a band. A Column with a background is a card.</Text>
        </Column>
      </Section>
    </Email>
  );
}
