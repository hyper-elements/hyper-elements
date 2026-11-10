import { Button, Column, Heading, Page, Text } from "@hyper-elements/react";

export default function Update() {
  return (
    <Page width={720} style={{ backgroundColor: "#ffffff", fontFamily: "Inter, Arial, sans-serif" }}>
      <Column style={{ padding: 48, gap: 32 }}>
        <Column style={{ gap: 24 }}>
          <Column style={{ gap: 16 }}>
            <Heading level={1} style={{ fontSize: 36, fontWeight: 700 }}>Orbit 3.0 is here</Heading>
            <Text style={{ fontSize: 18, mobile: { fontSize: 16 } }}>Faster renders, a new editor and dark mode.</Text>
          </Column>
          <Button href="https://orbit.dev/upgrade" style={{ backgroundColor: "#4f46e5", color: "#ffffff", borderRadius: 6, hover: { backgroundColor: "#4338ca" } }}>
            Upgrade now
          </Button>
        </Column>
        <Text style={{ color: "#6b7280" }}>Orbit Labs, 500 Market St, San Francisco</Text>
      </Column>
    </Page>
  );
}
