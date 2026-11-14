import { Button, Column, Email, Heading, Row, Section, Text, type Theme } from "@hyper-elements/react";

// One announcement email with no colors, fonts or sizes of its own: the theme it's given brands it.
// examples/showcase/brand-*.tsx render it with two themes, for the React Email comparison page.
export function Announcement({ brand, name, theme }: { brand: string; name: string; theme: Theme }) {
  return (
    <Email theme={theme} previewText={`${name} is here`}>
      <Section style={{ apply: ["band"] }}>
        <Text style={{ apply: ["wordmark"] }}>{brand}</Text>
      </Section>
      <Section style={{ apply: ["band"] }}>
        <Column style={{ apply: ["card"] }}>
          <Text style={{ apply: ["eyebrow"] }}>New this week</Text>
          <Heading level={1}>{name} is here</Heading>
          <Text>Everything you asked for this season, in one place. Take a look before it sells out.</Text>
          <Row style={{ gap: 12 }}>
            <Button href="https://example.com/new">Shop the drop</Button>
            <Button href="https://example.com/lookbook" variant="secondary">See the lookbook</Button>
          </Row>
        </Column>
      </Section>
      <Section style={{ apply: ["band"] }}>
        <Text style={{ apply: ["footer"] }}>You're getting this because you joined {brand}. Unsubscribe any time.</Text>
      </Section>
    </Email>
  );
}
