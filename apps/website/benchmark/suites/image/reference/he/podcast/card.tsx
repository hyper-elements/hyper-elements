import { Canvas, Column, Heading, Image, Text } from "@hyper-elements/react";

export default function Card() {
  return (
    <Canvas width={1080} height={1080} style={{ backgroundColor: "#fef3c7", padding: 80, justifyContent: "space-between", alignItems: "center", textAlign: "center", fontFamily: "Inter" }}>
      <Column style={{ alignItems: "center", gap: 24 }}>
        <Image src={{ src: "assets/podcast-cover.png", width: 600, height: 600 }} alt="The Build Log" style={{ width: 360, borderRadius: 24 }} />
        <Text style={{ fontSize: 28, fontWeight: 700, letterSpacing: 3, color: "#b45309" }}>EPISODE 42</Text>
        <Heading level={1} style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.15, color: "#1c1917" }}>Designing APIs that agents can read</Heading>
        <Text style={{ fontSize: 32, color: "#44403c" }}>with Priya Natarajan</Text>
      </Column>
      <Column style={{ alignItems: "center", gap: 6 }}>
        <Text style={{ fontSize: 28, fontWeight: 700, color: "#1c1917" }}>The Build Log</Text>
        <Text style={{ fontSize: 24, color: "#78716c" }}>Listen wherever you get podcasts</Text>
      </Column>
    </Canvas>
  );
}
