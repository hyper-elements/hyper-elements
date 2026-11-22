/**
 * A card announcing one speaker, for social posts, 1080 by 1080. The logo, the "Speaker" label and the shapes are
 * locked; a design gives the speaker's photo, name and role, their talk, and the event and its date. It's made from a
 * brand (`speaker(brand)`), which sets its colors, fonts and logo.
 */
import { Canvas, Circle, Column, Heading, Image, Layer, Path, Row, Svg, Text, prop, token } from "@hyper-elements/react";
import { field, template } from "@hyper-elements/react/template";
import type { Brand } from "../../_brand";
import { brand } from "../../_brands/orbit";

/** What fits at each one's smallest size in the narrowest sample brand. */
const ROLE_MAX = 80;
const TALK_MAX = 120;
const EVENT_MAX = 48;

const fields = {
  photo: field.image({
    label: "Speaker's photo",
    required: true,
    fit: "cover",
    maxCrop: 0.25,
    aspect: { min: 0.75, max: 1.34 },
    minWidth: 460,
    minHeight: 460,
    accepts: ["png", "jpeg"],
    guidance: "A portrait with the face in the middle: it's cut to a circle",
  }),
  name: prop.text({ label: "Name", required: true, maxLength: 60, guidance: "The speaker's name as they give it: up to 60 characters, fitted to two lines" }),
  role: prop.text({ label: "Role", required: true, maxLength: ROLE_MAX, guidance: `Their role and company, fitted to one line: Staff engineer, Northwind. Up to ${ROLE_MAX} characters` }),
  talk: prop.text({ label: "Talk", required: true, maxLength: TALK_MAX, guidance: `The talk's title, without quotes: up to ${TALK_MAX} characters, fitted to two lines` }),
  date: prop.text({
    label: "Date",
    required: true,
    maxLength: 12,
    // Fitted beside the photo on one line, with no year, so it reads the same any time.
    pattern: "^(?![\\s\\S]*\\b(19|20)\\d{2}\\b)[\\s\\S]*$",
    guidance: "The month, short where it's long, and the day or days, with no year or weekday: May 14, Sept 30, May 14–15",
  }),
  event: prop.text({ label: "Event", required: true, maxLength: EVENT_MAX, guidance: `The event's name: up to ${EVENT_MAX} characters, fitted to two lines` }),
};

/** The shapes behind the photo, in the brand's colors: two circles, a grid of dots, a dot and a wave. */
const DOTS = [0, 1, 2, 3, 4].flatMap((row) => [18, 42, 66, 90, 114].map((x) => ({ x, y: 460 + row * 24 })));
const shapes = (
  <Svg width={580} height={580} viewBox="0 0 580 580">
    <Circle cx={326.8} cy={326.8} r={236} style={{ fill: token("colors.primary") }} />
    <Circle cx={276.2} cy={271.6} r={256} style={{ fill: "transparent", stroke: token("colors.accent"), strokeWidth: 5 }} />
    {DOTS.map(({ x, y }) => (
      <Circle key={`${x},${y}`} cx={x} cy={y} r={5} style={{ fill: token("colors.accent") }} />
    ))}
    <Circle cx={546} cy={46} r={22} style={{ fill: token("colors.accent") }} />
    <Path d="M430,554 q18,-22 36,0 t36,0 t36,0 t36,0" style={{ fill: "transparent", stroke: token("colors.primary"), strokeWidth: 6 }} />
  </Svg>
);

export function speaker(brand: Brand) {
  return template({
    id: "images.Speaker",
    version: "1.0.0",
    label: "Speaker card",
    description: "A card announcing one speaker, for social posts: their photo in a circle over shapes in the brand's colors, their name and role, their talk in a block of color, and the event and date",
    root: "Canvas",
    fields,
    rules: {
      require: { core: ["canvas/overflow", "image/overflow", "image/glyph", "image/fit"] },
      links: { domains: [...brand.links.domains] },
    },
    example: {
      photo: { src: "https://hyperelements.dev/generated/gallery/assets/images/speaker.jpg", width: 800, height: 800 },
      name: "Ada Brightwell",
      role: "Head of design, Fernway",
      talk: "Design systems that people actually use",
      date: "June 9",
      event: "Open House",
    },
    render: (v) => (
      <Canvas width={1080} height={1080} fonts={brand.fonts} lang={brand.lang ?? "en"} dir={brand.dir} theme={brand.theme}>
        <Column style={{ height: 1080, padding: 72, justifyContent: "space-between" }}>
          <Row style={{ alignItems: "start", justifyContent: "space-between" }}>
            <Column style={{ width: 356, height: 580, padding: [12, 0, 8], justifyContent: "space-between" }}>
              <Column style={{ gap: 28 }}>
                <Image src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }} alt={brand.logo.alt} style={{ width: 170 }} />
                <Column style={{ width: 176, backgroundColor: token("colors.primary"), borderRadius: 999, padding: [10, 0] }}>
                  <Text
                    style={{
                      color: token("colors.primaryForeground"),
                      fontSize: 22,
                      fontWeight: 700,
                      letterSpacing: 2,
                      lineHeight: 1.2,
                      textTransform: "uppercase",
                      textAlign: "center",
                    }}
                  >
                    Speaker
                  </Text>
                </Column>
              </Column>
              <Column style={{ gap: 6 }}>
                <Text field="date" fit={{ sizes: { min: 40, max: 76, step: 4 }, maxLines: 1 }} style={{ fontWeight: 700, lineHeight: 1, letterSpacing: -1, color: token("colors.primary") }}>
                  {v.date}
                </Text>
                <Text field="event" fit={{ sizes: { min: 20, max: 28, step: 2 }, maxLines: 2 }} style={{ fontWeight: 700, lineHeight: 1.2, letterSpacing: 1.5, textTransform: "uppercase" }}>
                  {v.event}
                </Text>
              </Column>
            </Column>
            <Layer style={{ width: 580, height: 580, alignItems: "center", justifyItems: "center" }}>
              {shapes}
              <Layer style={{ width: 460, height: 460, borderRadius: 230, border: { width: 10, style: "solid", color: token("colors.background") } }}>
                <Image field="photo" src={v.photo} alt={v.name} />
              </Layer>
            </Layer>
          </Row>
          <Column style={{ gap: 22 }}>
            <Column style={{ gap: 10 }}>
              <Heading field="name" level={1} fit={{ sizes: { min: 48, max: 84, step: 4 }, maxLines: 2 }} style={{ lineHeight: 1.02, letterSpacing: -1 }}>
                {v.name}
              </Heading>
              <Text field="role" fit={{ sizes: { min: 20, max: 28, step: 2 }, maxLines: 1 }} style={{ lineHeight: 1.3, color: token("colors.muted") }}>
                {v.role}
              </Text>
            </Column>
            <Column style={{ width: 936, backgroundColor: token("colors.primary"), borderRadius: token("radii.md"), padding: [26, 32] }}>
              <Text field="talk" fit={{ sizes: { min: 24, max: 36, step: 2 }, maxLines: 2 }} style={{ color: token("colors.primaryForeground"), fontWeight: 700, lineHeight: 1.22 }}>
                {`\u201c${v.talk}\u201d`}
              </Text>
            </Column>
          </Column>
        </Column>
      </Canvas>
    ),
  });
}

export default speaker(brand);
