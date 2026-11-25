import { Button, Email, Heading, Section, Text, token } from "@hyper-elements/react";
import { brand } from "./brand";

export default function Welcome() {
  return (
    <Email theme={brand} lang="en" previewText="Your Acme account is ready.">
      <Section id="card" style={{ apply: ["card"] }}>
        <Heading id="heading" level={1}>Welcome to Acme</Heading>
        <Text id="text">Your account is ready.</Text>
        <Button id="primary" href="https://example.com/start">Get started</Button>
        <Button id="secondary" href="https://example.com/docs" variant="secondary">
          Read the docs
        </Button>
      </Section>
      <Section
        id="band"
        tokens={{ colors: { background: "#15132e", foreground: "#ffffff" } }}
        style={{ padding: [24, 32] }}
      >
        <Text id="small" style={{ fontSize: token("fontSizes.small") }}>
          Acme Inc., 1 Market St, San Francisco
        </Text>
      </Section>
    </Email>
  );
}
