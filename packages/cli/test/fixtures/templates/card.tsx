import { Canvas, Heading, Image, Row, Text } from "@hyper-elements/react";

const FONTS = [
  { family: "Inter", src: "../fonts/Inter-Regular.ttf", weight: 400 },
  { family: "Inter", src: "../fonts/Inter-Bold.ttf", weight: 700 },
] as const;

export default function Card({ title = "Summer timetable" }: { title?: string }) {
  return (
    <Canvas width={600} height={315} title={title} fonts={FONTS} style={{ backgroundColor: "#12242E", color: "#F3F1EA", fontFamily: "Inter", padding: 36, justifyContent: "space-between" }}>
      <Row style={{ gap: 12, alignItems: "center" }}>
        <Image src={{ src: "../images/flag.png", width: 32, height: 32 }} alt="Signal flag U" style={{ width: 32 }} />
        <Text style={{ fontSize: 14 }}>Merrow Line</Text>
      </Row>
      <Heading level={1} style={{ fontSize: 44, fontWeight: 700, lineHeight: 1.1 }}>{title}</Heading>
      <Image src={{ src: "../images/tide.png", width: 64, height: 64 }} alt="The tide, in two blues" style={{ width: 64 }} />
    </Canvas>
  );
}
Card.PreviewProps = { title: "Summer timetable" };
