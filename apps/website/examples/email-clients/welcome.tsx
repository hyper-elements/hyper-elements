/**
 * The welcome email from the Email client emulator page's first example, drawn in each client below it.
 */
import { Button, Column, Email, Heading, Text } from "@hyper-elements/react";

export default function Welcome() {
  return (
    <Email previewText="Your account is ready" style={{ backgroundColor: "#f4f4f5" }}>
      <Column style={{ backgroundColor: "#ffffff", padding: 32, gap: 16, borderRadius: 12 }}>
        <Heading level={1} style={{ fontSize: 24 }}>Welcome aboard</Heading>
        <Text>Your account is ready.</Text>
        <Button href="https://example.com/start" style={{ borderRadius: 999 }}>Get started</Button>
      </Column>
    </Email>
  );
}
