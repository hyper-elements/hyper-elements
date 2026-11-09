import { Button, Column, Email, Heading, Image, Text } from "@hyper-elements/react";

export default function Update() {
  return (
    <Email previewText="What's new in Orbit this month." style={{ backgroundColor: "#f1f2f6", fontFamily: "Inter, Arial, sans-serif" }}>
      <Column style={{ backgroundColor: "#ffffff", padding: 32, gap: 16 }}>
        <Image src={{ src: "https://assets.orbit.dev/img/orbit-logo.png", width: 252, height: 128 }} alt="Orbit" style={{ width: 126 }} />
        <Heading level={1} style={{ fontSize: 28, color: "#111827" }}>
          What's new in Orbit
        </Heading>
        <Column style={{ gap: 8 }}>
          <Text style={{ color: "#374151" }}>Templates now render twice as fast, and previews update as you type.</Text>
          <Text style={{ color: "#374151" }}>Dark mode is here for every email, page and document you build.</Text>
        </Column>
        <Button href="https://orbit.dev/changelog" style={{ backgroundColor: "#6d5efc", color: "#ffffff", borderRadius: 6 }}>
          Read the update
        </Button>
      </Column>
      <Text style={{ fontSize: 12, color: "#6b7280", textAlign: "center", padding: 16 }}>Orbit Labs, 500 Market St, San Francisco</Text>
    </Email>
  );
}
