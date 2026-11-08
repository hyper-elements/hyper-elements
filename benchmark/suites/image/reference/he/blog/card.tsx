import { Canvas, Column, Heading, Image, Text, Row } from "@hyper-elements/react";

export default function Card() {
  return (
    <Canvas width={1200} height={630} style={{ backgroundColor: "#0f172a", padding: 72, justifyContent: "space-between", fontFamily: "Inter" }}>
      <Column style={{ gap: 40 }}>
        <Row style={{ alignItems: "center", justifyContent: "space-between" }}>
          <Image src={{ src: "assets/orbit-logo-white.png", width: 252, height: 128 }} alt="Orbit" style={{ width: 126 }} />
          <Text style={{ flex: "none", fontSize: 20, fontWeight: 700, letterSpacing: 2, color: "#ffffff", backgroundColor: "#2563eb", borderRadius: 999, padding: [8, 16] }}>
            ENGINEERING
          </Text>
        </Row>
        <Heading level={1} style={{ fontSize: 60, fontWeight: 700, lineHeight: 1.15, color: "#ffffff" }}>
          How we cut our build times in half with incremental bundling
        </Heading>
      </Column>
      <Row style={{ gap: 16, alignItems: "center" }}>
        <Image src={{ src: "assets/avatar-maya.png", width: 256, height: 256 }} alt="Maya Chen" style={{ width: 64, height: 64, borderRadius: 32, flex: "none" }} />
        <Column style={{ gap: 4 }}>
          <Text style={{ fontSize: 28, fontWeight: 700, color: "#ffffff" }}>Maya Chen</Text>
          <Text style={{ fontSize: 24, color: "#94a3b8" }}>June 12, 2027 · 8 min read</Text>
        </Column>
      </Row>
    </Canvas>
  );
}
