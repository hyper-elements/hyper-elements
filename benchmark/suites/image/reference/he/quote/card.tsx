import { Canvas, Column, Image, Text, Row } from "@hyper-elements/react";

export default function Card() {
  return (
    <Canvas width={1200} height={675} style={{ backgroundColor: "#ffffff", fontFamily: "Inter" }}>
      <Row style={{ height: 675, alignItems: "stretch" }}>
        <Column style={{ width: 12, flex: "none", backgroundColor: "#6d5efc" }} />
        <Column style={{ padding: 72, justifyContent: "space-between" }}>
          <Text style={{ fontFamily: "Lora", fontStyle: "italic", fontSize: 44, lineHeight: 1.4, color: "#111827" }}>
            We replaced four template systems with one. Our emails, invoices and social cards now ship from the same components.
          </Text>
          <Row style={{ alignItems: "center", gap: 20 }}>
            <Image src={{ src: "assets/avatar-daniel.png", width: 256, height: 256 }} alt="Daniel Okafor" style={{ width: 72, height: 72, borderRadius: 36, flex: "none" }} />
            <Column style={{ gap: 4 }}>
              <Text style={{ fontSize: 28, fontWeight: 700, color: "#111827" }}>Daniel Okafor</Text>
              <Text style={{ fontSize: 24, color: "#6b7280" }}>Head of Platform, Northwind</Text>
            </Column>
            <Image src={{ src: "assets/orbit-logo.png", width: 252, height: 128 }} alt="Orbit" style={{ width: 100, flex: "none" }} />
          </Row>
        </Column>
      </Row>
    </Canvas>
  );
}
