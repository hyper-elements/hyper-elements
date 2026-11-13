// A first draft with the mistakes an agent tends to make. Hyper Elements rejects each one and says what to
// write instead: open Diagnostics under the code, click one to jump to its line, and fix them until it renders.
import { Button, Column, Email, Heading, Image, Text } from "@hyper-elements/react";

export default function Welcome() {
  return (
    <Email backgroundColor="#f1f2f6">
      <Column style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: 36, gap: 16 }}>
        <Image src="https://hyperelements.dev/img/orbit-logo.png" altText="Orbit" style={{ width: 92 }} />
        <Heading level={1} style={{ fontSize: 30, marginBottom: 8 }}>
          Welcome to Orbit
        </Heading>
        <Text style={{ color: "#475569" }}>
          Your workspace is ready. <b>Invite your team</b> and ship your first template today.
        </Text>
        <Button href="https://example.com/start" hover={{ backgroundColor: "#5a4bf0" }} style={{ backgroundColor: "#6d5efc", borderRadius: 10 }}>
          Open your workspace
        </Button>
      </Column>
    </Email>
  );
}
