import { Button, Column, Email, Heading, Image, LineBreak, Link, Row, Section, Span, Text, token } from "@hyper-elements/react";
import type { Brand } from "../_brand";

export const meta = {
  label: "CodePen Challenges",
  description: "A weekly challenge: header art on a dark band, a yellow heading, the brief and a boxed challenge, a picture, a PRO panel, how to take part, ideas and resources side by side, and a button to the challenge",
  recreates: {
    company: "codepen",
    what: "Challenges newsletter",
    original: "https://reallygoodemails.com/search/emails/CodePen",
  },
};

export default function CodepenChallenges({ brand }: { brand: Brand }) {
  const site = brand.links.site;
  const challenge = `${site}/challenges/cubes`;
  const tag = brand.name.replace(/[^A-Za-z0-9]/g, "");
  const hashtag = `#${tag}Challenge`;
  const bold = { fontWeight: 700 } as const;
  const card = (color: "border" | "accent") =>
    ({
      backgroundColor: token("colors.background"),
      border: { width: 1, style: "solid", color: token(`colors.${color}`) },
      borderRadius: token("radii.md"),
      padding: token("spacing.lg"),
      gap: token("spacing.md"),
    }) as const;
  const icon = { fontSize: 36, lineHeight: 1, textAlign: "center" } as const;
  const small = { fontSize: token("fontSizes.small") } as const;
  const label = { fontSize: 18, lineHeight: 1.1 } as const;
  const footerLink = { color: token("colors.muted"), textDecoration: "underline" } as const;
  return (
    <Email
      width={648}
      title={`${hashtag}: Cubes`}
      previewText={`${hashtag}: Cubes. The Shape challenge continues!`}
      lang={brand.lang ?? "en"}
      dir={brand.dir}
      theme={brand.theme}
      fonts={brand.fonts}
      style={{ backgroundColor: token("colors.muted"), color: token("colors.foreground"), fontSize: token("fontSizes.body"), lineHeight: token("lineHeights.body") }}
    >
      {/* The brand's logo as the header: in CodePen's brand, its Challenges art. */}
      <Section style={{ backgroundColor: token("colors.background"), alignItems: "center" }}>
        <Image src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }} alt={brand.logo.alt} style={{ width: 600 }} />
      </Section>
      <Column style={{ padding: [token("spacing.md"), 0, 48] }}>
        <Column style={{ backgroundColor: token("colors.surface"), padding: token("spacing.xl"), gap: token("spacing.md") }}>
          <Text style={{ ...small, textAlign: "center" }}>
            <Link href={challenge}>View this Challenge on {brand.name}</Link>
          </Text>
          <Heading level={1} style={{ fontWeight: 400 }}>
            <Span style={bold}>This week:</Span> {hashtag}:<LineBreak />
            Cubes
          </Heading>
        </Column>

        <Column style={{ backgroundColor: token("colors.background"), padding: [token("spacing.md"), 24, 24], gap: 40 }}>
          <Column style={{ gap: token("spacing.md") }}>
            <Text>The Shape challenge continues!</Text>
            <Text>
              Last week, we kicked things off with round shapes. We "rounded" up the Pens from week one in our{" "}
              <Link href={`${site}/collection/challenge-round`}>{hashtag}: Round</Link> collection.
            </Text>
            <Text>This week, we move on to cubes 🧊</Text>
            <Text>
              Creating cubes in the browser is all about mastery of illusion. Take control of perspective and shadows and you can make the magic of 3D on a flat
              screen 🧙
            </Text>
            <Text>This week is a fun chance to work on your CSS shape-building skills, or dig into a 3D JavaScript library like Three.js.</Text>
            <Text>
              This week's starter template features an ice cube emoji to help inspire a "cool" idea for your Pen. As always, the template is just a jumping off
              point. Feel free to incorporate the 🧊 in your creation, add more elements, or freeze it out completely and start over from scratch!
            </Text>
            <Text style={{ border: { width: 6, style: "solid", color: token("colors.border") }, padding: token("spacing.lg") }}>
              💪 <Span style={bold}>Your Challenge:</Span> <Link href={`${challenge}/starter`}>create a Pen that includes cube shapes.</Link>
            </Text>
          </Column>
          <Image src={{ src: "https://hyperelements.dev/generated/gallery/assets/companies/codepen/cube.png", width: 1200, height: 800 }} alt="A cube puzzle on a yellow background" style={{ width: 600 }} />
          <Column
            style={{
              backgroundColor: token("colors.primary"),
              color: token("colors.primaryForeground"),
              border: { width: 6, style: "solid", color: token("colors.accent") },
              padding: [35, token("spacing.lg"), token("spacing.xl")],
              alignItems: "center",
              gap: token("spacing.md"),
            }}
          >
            <Heading level={2} style={{ color: token("colors.primaryForeground"), fontSize: 32, letterSpacing: 2, textAlign: "center", textTransform: "uppercase" }}>
              {brand.name} PRO
            </Heading>
            <Text style={{ ...small, textAlign: "center", padding: [14, 0, 0] }}>
              {brand.name} PRO combines a bunch of features that can help any front-end designer or developer at any experience level.
            </Text>
            <Button
              href={`${site}/features/pro`}
              aria-label={`Learn more about ${brand.name} PRO`}
              style={{
                backgroundColor: token("colors.background"),
                color: token("colors.primary"),
                fontSize: 15,
                lineHeight: "18px",
                fontWeight: 700,
                padding: 12,
                borderRadius: token("radii.sm"),
              }}
            >
              Learn More
            </Button>
          </Column>
        </Column>

        <Column style={{ padding: [token("spacing.md"), 0] }}>
          <Text style={{ backgroundColor: token("colors.surface"), padding: token("spacing.xl"), fontSize: 18, lineHeight: 1.5 }}>
            <Span style={bold}>To participate:</Span> <Link href={`${site}/pen/new`}>Create a Pen →</Link> and tag it{" "}
            <Link href={`${site}/tag/${tag.toLowerCase()}challenge`}>
              <Span style={bold}>{tag.toLowerCase()}challenge</Span>
            </Link>{" "}
            and{" "}
            <Link href={`${site}/tag/cpc-cubes`}>
              <Span style={bold}>cpc-cubes</Span>
            </Link>
            . We'll be watching and gathering the Pens into a Collection, and sharing on <Link href={`${site}/twitter`}>Twitter</Link> and{" "}
            <Link href={`${site}/instagram`}>Instagram</Link> (Use the {hashtag} tag on Twitter and Instagram as well).
          </Text>
        </Column>

        <Column style={{ backgroundColor: token("colors.background"), padding: [token("spacing.md"), 24, token("spacing.lg")] }}>
          <Row style={{ gap: token("spacing.lg"), alignItems: "start" }}>
            <Column style={{ gap: token("spacing.lg") }}>
              <Heading level={2} style={label}>IDEAS!</Heading>
              <Column style={card("border")}>
                <Text style={icon}>🌟</Text>
                <Text style={small}>
                  This week we move from 2 dimensions to three! Maybe you could exercise your <Link href={`${challenge}/perspective`}>perspective</Link> in CSS to
                  create a 3D cube. Or, you can try out creating 3D shapes in JavaScript, using <Link href={`${challenge}/webgl`}>WebGL</Link> or building a{" "}
                  <Link href={`${challenge}/three-js`}>Three.js scene</Link>.
                </Text>
              </Column>
              <Column style={card("border")}>
                <Text style={icon}>🌟</Text>
                <Text style={small}>
                  There's more to cubes than just six square sides. There are variations on the cube that could be fun to play with this week:{" "}
                  <Link href={`${challenge}/cuboids`}>cuboid shapes</Link> are hexahedrons with faces that aren't always squares. And if you want to really push
                  the boundaries of shape, consider the 4 dimensional <Link href={`${challenge}/tesseract`}>tesseract!</Link>
                </Text>
              </Column>
              <Column style={card("border")}>
                <Text style={icon}>🌟</Text>
                <Text style={small}>
                  Here's a mind-bending idea that can combine the round shapes from week one with this week's cube theme:{" "}
                  <Link href={`${challenge}/spherical-cubes`}>Spherical Cubes</Link> 😳 Solving longstanding mathematical mysteries is probably outside the scope
                  of {/^[aeiou]/i.test(brand.name) ? "an" : "a"} {brand.name} challenge, but you could use front-end tools to explore fitting spheres into cubes, or vice-versa.
                </Text>
              </Column>
            </Column>
            <Column style={{ gap: token("spacing.lg") }}>
              <Heading level={2} style={label}>RESOURCES!</Heading>
              <Column style={card("accent")}>
                <Text style={icon}>📖</Text>
                <Text style={small}>
                  Learn all about <Link href={`${challenge}/css-perspective`}>How CSS Perspective Works</Link> and how to build a 3D CSS cube from scratch in an
                  in-depth tutorial for CSS-Tricks. Or, check out stunning examples of WebGL cubes: <Link href={`${challenge}/just-ice`}>Just Ice</Link> and{" "}
                  <Link href={`${challenge}/posing`}>Posing</Link>.
                </Text>
              </Column>
              <Column style={card("accent")}>
                <Text style={icon}>📖</Text>
                <Text style={small}>
                  Want to go beyond the square cube? Draw inspiration from Pens like <Link href={`${challenge}/pulsating-tesseract`}>Pulsating Tesseract</Link>,{" "}
                  <Link href={`${challenge}/rainbow-cuboid-loader`}>Rainbow Cuboid Loader</Link>, or{" "}
                  <Link href={`${challenge}/cuboid-jellyfish`}>Pure CSS cuboid jellyfish</Link>.
                </Text>
              </Column>
              <Column style={card("accent")}>
                <Text style={icon}>📖</Text>
                <Text style={small}>
                  Did that spherical cubes concept pique your interest? Explore <Link href={`${challenge}/cube-sphere`}>Cube Sphere</Link>,{" "}
                  <Link href={`${challenge}/sphere-to-cube`}>3D Sphere to Cube Animation With Virtual Trackball</Link> and{" "}
                  <Link href={`${challenge}/unpack-prism`}>Infinitely unpack prism</Link> for more mindbending cube concepts that test the boundaries of how
                  shapes interact with each other.
                </Text>
              </Column>
            </Column>
          </Row>
        </Column>

        <Column style={{ padding: [40, 0, 120], alignItems: "center" }}>
          <Button
            href={`${site}/challenges`}
            style={{ fontSize: 26, fontWeight: 700, padding: [15, token("spacing.xl")], borderRadius: token("radii.sm") }}
          >
            Go to Challenge Page
          </Button>
        </Column>

        <Column style={{ backgroundColor: token("colors.background"), padding: [token("spacing.md"), 24] }}>
          <Text style={{ ...small, color: token("colors.muted") }}>
            You can adjust your <Link href={`${site}/settings/notifications`} style={footerLink}>email preferences</Link> any time, or{" "}
            <Link href={`${site}/unsubscribe`} style={footerLink}>instantly opt out</Link> of emails of this kind. Need help with anything? Hit up{" "}
            <Link href={`${site}/support`} style={footerLink}>support</Link>.
          </Text>
        </Column>
      </Column>
    </Email>
  );
}
