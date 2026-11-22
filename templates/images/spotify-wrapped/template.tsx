/**
 * A year in listening as a story to share, 1080 by 1920. The shapes, the headings, the logo and the site are locked; a
 * design gives the minutes listened, the top artists and songs (one to five of each), and the top genre. It's made
 * from a brand (`spotifyWrapped(brand)`), which sets its colors, fonts, logo and site.
 */
import { Canvas, Circle, Column, Heading, Image, Row, Svg, Text, prop, token } from "@hyper-elements/react";
import { template } from "@hyper-elements/react/template";
import type { Brand } from "../../_brand";
import { brand } from "../../_companies/spotify";

export const meta = {
  recreates: { company: "spotify", what: "Wrapped share card", original: "https://newsroom.spotify.com/wrapped/" },
};

/**
 * An artist or a song is fitted to two lines, down to 24px. That holds about 52 characters in the narrowest brand, not
 * the 80 a field takes: a longer one is cut at a word, with an ellipsis, where it's drawn.
 */
const ITEM_SHOWN = 52;
const shown = (item: string) => {
  if (item.length <= ITEM_SHOWN) return item;
  const cut = item.slice(0, ITEM_SHOWN - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > ITEM_SHOWN / 2 ? cut.slice(0, space) : cut).replace(/[\s,.;:–—-]+$/u, "")}\u2026`;
};

const fields = {
  minutes: prop.number({
    label: "Minutes listened",
    required: true,
    min: 0,
    max: 527040,
    integer: true,
    guidance: "The number of minutes, written as the brand's language writes it: 48213 is 48,213",
  }),
  artists: prop.list(prop.text({ label: "Artist", required: true, maxLength: 80 }), {
    label: "Top artists",
    required: true,
    min: 1,
    max: 5,
    guidance: `One to five artists listened to most, most first: up to 80 characters each, fitted to two lines (past about ${ITEM_SHOWN}, cut with an ellipsis)`,
  }),
  songs: prop.list(prop.text({ label: "Song", required: true, maxLength: 80 }), {
    label: "Top songs",
    required: true,
    min: 1,
    max: 5,
    guidance: `One to five songs listened to most, most first: up to 80 characters each, fitted to two lines (past about ${ITEM_SHOWN}, cut with an ellipsis)`,
  }),
  genre: prop.text({ label: "Top genre", required: true, maxLength: 24, guidance: "The genre listened to most: up to 24 characters" }),
};

export function spotifyWrapped(brand: Brand) {
  const host = new URL(brand.links.site).host.replace(/^www\./, "");
  const list = (title: string, path: "artists" | "songs", items: readonly string[]) => (
    <Column style={{ flex: 1, gap: 14 }}>
      <Text style={{ fontSize: 30, fontWeight: 700, color: token("colors.muted") }}>{title}</Text>
      {items.map((item, i) => (
        <Row key={i} style={{ gap: 18, alignItems: "start" }}>
          <Text style={{ width: 34, fontSize: 34, fontWeight: 700, lineHeight: 1.2, color: token("colors.primary") }}>{i + 1}</Text>
          <Text field={`${path}[${i}]`} fit={{ sizes: { min: 24, max: 34, step: 2 }, maxLines: 2 }} style={{ flex: 1, fontWeight: 700, lineHeight: 1.2 }}>
            {shown(item)}
          </Text>
        </Row>
      ))}
    </Column>
  );
  return template({
    id: "images.SpotifyWrapped",
    version: "1.0.0",
    label: "Wrapped share card",
    description: "A year in listening as a story to share, 1080 by 1920: bold shapes, the minutes listened, the top artists and songs, and the top genre",
    root: "Canvas",
    fields,
    rules: {
      require: { core: ["canvas/overflow", "image/overflow", "image/glyph", "image/fit"] },
      links: { domains: [...brand.links.domains] },
    },
    example: {
      minutes: 12940,
      artists: ["Harbor Lights", "Ivy Calloway", "Paper Lantern Club", "Dune Choir", "Fennel"],
      songs: ["Golden Hour Drive", "Small Rooms", "Wildflower Season", "Low Tide", "Afterglow"],
      genre: "Folk",
    },
    render: (v) => (
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
              <Heading field="minutes" level={1} style={{ fontSize: 150, lineHeight: 1 }}>
                {new Intl.NumberFormat(brand.lang ?? "en").format(v.minutes)}
              </Heading>
            </Column>
            <Row style={{ gap: 48, alignItems: "start" }}>
              {list("Top artists", "artists", v.artists)}
              {list("Top songs", "songs", v.songs)}
            </Row>
            <Row style={{ gap: 48, alignItems: "end" }}>
              <Column style={{ flex: 1, gap: 8 }}>
                <Text style={{ fontSize: 30, fontWeight: 700, color: token("colors.muted") }}>Top genre</Text>
                <Text field="genre" fit={{ sizes: { min: 32, max: 56, step: 4 }, maxLines: 1 }} style={{ fontWeight: 700, lineHeight: 1.1 }}>
                  {v.genre}
                </Text>
              </Column>
              <Column style={{ gap: 14, alignItems: "end" }}>
                <Image
                  src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }}
                  alt={brand.logo.alt}
                  style={{ width: Math.min(260, Math.round((64 * brand.logo.width) / brand.logo.height)) }}
                />
                <Text style={{ fontSize: 26, color: token("colors.muted"), textAlign: "right" }}>{host}/wrapped</Text>
              </Column>
            </Row>
          </Column>
        </Column>
      </Canvas>
    ),
  });
}

export default spotifyWrapped(brand);
