import { Canvas, Circle, Column, Heading, Image, Row, Svg, Text, token } from "@hyper-elements/react";
import type { Brand } from "../_brand";

export const meta = {
  label: "Wrapped share card",
  category: "stat-card",
  description: "A year in listening as a story to share, 1080 by 1920: bold shapes, the minutes listened, the top artists and songs, and the top genre",
  recreates: { company: "spotify", what: "Wrapped share card", original: "https://newsroom.spotify.com/wrapped/" },
};

// Invented artists and songs: no real musician's name on a card.
const ARTISTS = ["Juniper Vale", "The Low Hours", "Mara Okafor", "Neon Orchard", "Sol & Static"];
const SONGS = ["Paper Moons", "Slow Burn Summer", "Glasshouse", "Night Bus Home", "Everything, Again"];

export default function SpotifyWrapped({ brand }: { brand: Brand }) {
  const list = (title: string, items: string[]) => (
    <Column style={{ flex: 1, gap: 14 }}>
      <Text style={{ fontSize: 30, fontWeight: 700, color: token("colors.muted") }}>{title}</Text>
      {items.map((item, i) => (
        <Row key={item} style={{ gap: 18, alignItems: "start" }}>
          <Text style={{ width: 34, fontSize: 34, fontWeight: 700, lineHeight: 1.2, color: token("colors.primary") }}>{i + 1}</Text>
          <Text style={{ flex: 1, fontSize: 34, fontWeight: 700, lineHeight: 1.2 }}>{item}</Text>
        </Row>
      ))}
    </Column>
  );
  return (
    <Canvas width={1080} height={1920} fonts={brand.fonts} lang={brand.lang ?? "en"} dir={brand.dir} theme={brand.theme}>
      <Column style={{ height: 1920 }}>
        <Svg width={1080} height={660} viewBox="0 0 1080 660">
          <Circle cx={250} cy={300} r={300} style={{ fill: token("colors.primary") }} />
          <Circle cx={860} cy={180} r={220} style={{ fill: token("colors.accent") }} />
          <Circle cx={760} cy={560} r={150} style={{ fill: token("colors.surface") }} />
          <Circle cx={120} cy={600} r={70} style={{ fill: token("colors.border") }} />
        </Svg>
        <Column style={{ height: 1260, padding: [56, 80, 80], gap: 56, justifyContent: "space-between" }}>
          <Column style={{ gap: 20 }}>
            <Text style={{ fontSize: 30, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: token("colors.primary") }}>Your Wrapped</Text>
            <Text style={{ fontSize: 30, fontWeight: 700, color: token("colors.muted") }}>Minutes listened</Text>
            <Heading level={1} style={{ fontSize: 150, lineHeight: 1 }}>48,213</Heading>
          </Column>
          <Row style={{ gap: 48, alignItems: "start" }}>
            {list("Top artists", ARTISTS)}
            {list("Top songs", SONGS)}
          </Row>
          <Row style={{ gap: 48, alignItems: "end" }}>
            <Column style={{ flex: 1, gap: 8 }}>
              <Text style={{ fontSize: 30, fontWeight: 700, color: token("colors.muted") }}>Top genre</Text>
              <Text style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.1 }}>Indie Pop</Text>
            </Column>
            <Column style={{ gap: 14, alignItems: "end" }}>
              <Image
                src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }}
                alt={brand.logo.alt}
                style={{ width: Math.min(260, Math.round((64 * brand.logo.width) / brand.logo.height)) }}
              />
              <Text style={{ fontSize: 26, color: token("colors.muted"), textAlign: "right" }}>{new URL(brand.links.site).host.replace(/^www\./, "")}/wrapped</Text>
            </Column>
          </Row>
        </Column>
      </Column>
    </Canvas>
  );
}
