import { Button, Email, Heading, Section, Text } from "@hyper-elements/react";
import { brand, runtime } from "@/brand";

export default function Welcome({ name }: { name: string }) {
  return (
    <Email previewText={`Welcome to ${brand.name}, ${name}`} lang="en">
      <Section style={{ gap: 16, padding: 24 }}>
        <Heading level={1}>Welcome, {name}</Heading>
        <Text>Rendered on {runtime}.</Text>
        <Button href="https://example.com/start" style={{ backgroundColor: brand.accent }}>
          Get started
        </Button>
      </Section>
    </Email>
  );
}

Welcome.PreviewProps = { name: "Ada" };
