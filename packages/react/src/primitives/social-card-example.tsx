import { Canvas, Column, Heading, Image, Layer, Text } from "./index";

export default function LaunchCard() {
  return (
    <Canvas width={1200} height={630} style={{ color: "#ffffff", fontFamily: "Inter" }}>
      <Column style={{ border: { left: "16px solid #f97316" } }}>
        <Layer style={{ height: 630, alignItems: "end" }}>
          <Image src={{ src: "https://example.com/hero.jpg", width: 1600, height: 900 }} alt="" />
          <Column style={{ padding: 64, gap: 16 }}>
            <Heading style={{ fontSize: 64 }}>Launch week</Heading>
            <Text style={{ fontSize: 28, color: "#e2e8f0" }}>Five days of new things, one a day.</Text>
          </Column>
        </Layer>
      </Column>
    </Canvas>
  );
}
