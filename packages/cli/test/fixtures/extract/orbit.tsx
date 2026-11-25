// A launch graphic a person approved: a Canvas whose headline, features, date and artwork have ids.
import { Canvas, Column, Heading, Image, Text } from "@hyper-elements/react";

const FONTS = [{ family: "Inter", src: "../fonts/Inter-Regular.ttf", weight: 400 }, { family: "Inter", src: "../fonts/Inter-Bold.ttf", weight: 700 }];

export default function Orbit() {
  return (
    <Canvas width={600} height={400} fonts={FONTS} style={{ fontFamily: "Inter", padding: 32, gap: 16, backgroundColor: "#0b1020", color: "#f7f7fb" }}>
      <Heading id="headline" level={1} style={{ fontSize: 40 }}>
        Meet Orbit: release notes
        that write themselves
      </Heading>
      <Column style={{ gap: 4 }}>
        <Text id="features-0">Drafts from merged PRs</Text>
        <Text id="features-1">Your voice, every release</Text>
        <Text id="features-2">{"Ships to Slack & email"}</Text>
      </Column>
      <Text id="launchDate" style={{ color: "#2dd4bf" }}>December 3, 2026</Text>
      <Image id="artwork" src={{ src: "../images/tide.png", width: 64, height: 64 }} alt="" style={{ width: 64 }} />
    </Canvas>
  );
}
