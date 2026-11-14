import { Button, Column, Email, Heading, Section, Text } from "@hyper-elements/react";

export default function Welcome({ name }: { name: string }) {
  return (
    <Email
      width={520}
      previewText="Welcome to Orbit"
      style={{ backgroundColor: "#f3f4f6", fontFamily: "Helvetica, Arial, sans-serif" }}
    >
      <Section style={{ padding: [40, 0] }}>
        <Column style={{ backgroundColor: "#ffffff", borderRadius: 8, padding: 32, gap: 16 }}>
          <Heading style={{ fontSize: 24, color: "#101828" }}>
            Welcome, {name}
          </Heading>
          <Text style={{ fontSize: 16, color: "#4a5565" }}>
            Your workspace is ready.
          </Text>
          <Button
            href="https://example.com/start"
            style={{ backgroundColor: "#4f39f6", borderRadius: 6 }}
          >
            Open your workspace
          </Button>
        </Column>
      </Section>
    </Email>
  );
}
