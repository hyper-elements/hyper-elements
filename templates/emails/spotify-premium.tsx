import { Button, Column, Divider, Email, Heading, Image, Link, Row, Section, Text, token } from "@hyper-elements/react";
import type { Brand } from "../_brand";

export const meta = {
  label: "Welcome to Premium",
  category: "welcome",
  description: "A paid plan that has just started: a big headline, what it gives you, one pill button, the plan and its price, and the apps",
  recreates: { company: "spotify", what: "Premium welcome email", original: "https://reallygoodemails.com/search/emails/Spotify" },
};

const PERKS = [
  { title: "Ad-free music listening", text: "Enjoy uninterrupted music." },
  { title: "Download to listen offline", text: "Save your data by listening offline." },
  { title: "Play songs in any order", text: "No more shuffle-only." },
  { title: "High audio quality", text: "Hear the full detail of your music." },
];

export default function SpotifyPremium({ brand }: { brand: Brand }) {
  const site = brand.links.site;
  const muted = { color: token("colors.muted") } as const;
  const small = { fontSize: token("fontSizes.small"), color: token("colors.muted") } as const;
  const link = { color: token("colors.primary"), textDecoration: "none", fontWeight: 700 } as const;
  return (
    <Email
      width={600}
      title={`Welcome to ${brand.name} Premium`}
      previewText="Ad-free music, offline listening and more. Here's what you get now."
      lang={brand.lang ?? "en"}
      dir={brand.dir}
      theme={brand.theme}
      fonts={brand.fonts}
      style={{ backgroundColor: token("colors.surface"), color: token("colors.foreground"), fontSize: token("fontSizes.body"), lineHeight: token("lineHeights.body") }}
    >
      <Section style={{ padding: [token("spacing.lg"), 0], mobile: { padding: 0 } }}>
        <Column style={{ padding: token("spacing.xl"), gap: token("spacing.lg"), backgroundColor: token("colors.background"), borderRadius: token("radii.md"), mobile: { padding: [token("spacing.lg"), token("spacing.md")] } }}>
          <Image
            src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }}
            alt={brand.logo.alt}
            style={{ width: Math.min(180, Math.round((36 * brand.logo.width) / brand.logo.height)) }}
          />
          <Column style={{ gap: token("spacing.md") }}>
            <Heading level={1}>Welcome to Premium.</Heading>
            <Text style={muted}>Thanks for joining {brand.name} Premium. Here's what you get now:</Text>
          </Column>
          <Column style={{ gap: token("spacing.md") }}>
            {PERKS.map((perk, i) => (
              <Row key={perk.title} stackOnMobile={false} style={{ gap: token("spacing.md"), alignItems: "start" }}>
                <Text style={{ width: 32, fontWeight: 700, color: token("colors.primary") }}>0{i + 1}</Text>
                <Column>
                  <Text style={{ fontWeight: 700 }}>{perk.title}</Text>
                  <Text style={muted}>{perk.text}</Text>
                </Column>
              </Row>
            ))}
          </Column>
          <Column style={{ alignItems: "start" }}>
            <Button
              href={`${site}/open`}
              style={{
                padding: [14, 32],
                backgroundColor: token("colors.primary"),
                color: token("colors.primaryForeground"),
                fontWeight: 700,
                borderRadius: token("radii.sm"),
                mobile: { width: "100%", textAlign: "center" },
              }}
            >
              Open {brand.name}
            </Button>
          </Column>
          <Column style={{ padding: token("spacing.md"), gap: token("spacing.xs"), backgroundColor: token("colors.surface"), borderRadius: token("radii.md") }}>
            <Text style={{ fontWeight: 700 }}>Premium Individual</Text>
            <Text style={muted}>$11.99 a month after your free month ends on 20 December.</Text>
            <Text style={muted}>
              Cancel anytime on your <Link href={`${site}/account`} style={link}>account page</Link>.
            </Text>
          </Column>
          <Divider style={{ borderTop: { width: 1, style: "solid", color: token("colors.border") } }} />
          <Column style={{ gap: token("spacing.sm") }}>
            <Text style={small}>
              Get {brand.name} for: <Link href={`${site}/download/ios`} style={link}>iPhone</Link> · <Link href={`${site}/download/android`} style={link}>Android</Link> ·{" "}
              <Link href={`${site}/download`} style={link}>Desktop</Link>
            </Text>
            <Text style={small}>
              <Link href={`${site}/legal/terms`} style={{ ...link, color: token("colors.muted") }}>Terms of Use</Link> ·{" "}
              <Link href={`${site}/legal/privacy`} style={{ ...link, color: token("colors.muted") }}>Privacy Policy</Link> ·{" "}
              <Link href={`${site}/contact`} style={{ ...link, color: token("colors.muted") }}>Contact Us</Link>
            </Text>
            <Text style={small}>This message was sent to alan.turing@example.com because you started a {brand.name} Premium plan.</Text>
            {brand.address ? <Text style={small}>{brand.name}, {brand.address}</Text> : null}
          </Column>
        </Column>
      </Section>
    </Email>
  );
}
