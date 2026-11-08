import { Canvas, Column, Heading, Text, Row } from "@hyper-elements/react";

export default function Card() {
  return (
    <Canvas width={1500} height={500} style={{ backgroundColor: "#111827", padding: 64, justifyContent: "center", fontFamily: "Inter" }}>
      <Row style={{ alignItems: "center", justifyContent: "space-between" }}>
        <Column style={{ gap: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: 700, letterSpacing: 4, color: "#f87171" }}>LUMEN CONF 2027</Text>
          <Heading level={1} style={{ fontSize: 80, fontWeight: 700, color: "#ffffff" }}>Build what's next.</Heading>
          <Text style={{ fontSize: 32, color: "#d1d5db" }}>March 18–19, 2027 · Lisbon</Text>
        </Column>
        <Column style={{ width: 420, flex: "none", padding: 32, gap: 12, borderRadius: 16, backgroundColor: "#1f2937", alignItems: "start" }}>
          <Text style={{ fontSize: 32, fontWeight: 700, color: "#ffffff" }}>Early-bird tickets</Text>
          <Text style={{ fontSize: 24, color: "#9ca3af" }}>Until January 31</Text>
          <Text style={{ fontSize: 24, fontWeight: 700, color: "#ffffff", backgroundColor: "#ef4444", borderRadius: 999, padding: [12, 24] }}>Get tickets</Text>
        </Column>
      </Row>
    </Canvas>
  );
}
