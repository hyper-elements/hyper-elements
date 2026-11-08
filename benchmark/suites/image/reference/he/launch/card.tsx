import { Canvas, Column, Heading, Image, Layer, Text, Row } from "@hyper-elements/react";

export default function Card() {
  return (
    <Canvas width={1200} height={630} style={{ fontFamily: "Inter" }}>
      <Layer style={{ width: 1200, height: 630, alignItems: "center", justifyItems: "center" }}>
        <Image src={{ src: "assets/orbit-card-bg.png", width: 1200, height: 630 }} alt="" style={{ width: 1200 }} />
        <Column style={{ alignItems: "center", gap: 24, padding: [0, 72], textAlign: "center" }}>
          <Image src={{ src: "assets/orbit-logo-white.png", width: 252, height: 128 }} alt="Orbit" style={{ width: 126 }} />
          <Heading level={1} style={{ fontSize: 72, fontWeight: 700, color: "#ffffff" }}>Ship every surface from one codebase</Heading>
          <Text style={{ fontSize: 30, color: "#c7d2fe" }}>Live previews, typed templates and one-click deploys.</Text>
          {/* A pill: its own width, centered in a Row (a Text in a Column takes the Column's width). */}
          <Row style={{ justifyContent: "center" }}>
            <Text style={{ flex: "none", fontSize: 28, fontWeight: 700, color: "#ffffff", backgroundColor: "#6d5efc", borderRadius: 999, padding: [14, 28] }}>orbit.dev/2</Text>
          </Row>
        </Column>
      </Layer>
    </Canvas>
  );
}
