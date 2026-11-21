import { Button, Column, Email, Heading, Image, Link, Row, Section, Text, token } from "@hyper-elements/react";
import type { Brand } from "../_brand";

export const meta = {
  label: "Event invitation",
  description: "An invitation: the event's name on a band of the brand's color, when and where, a button to register, and the day's schedule",
};

export default function Event({ brand }: { brand: Brand }) {
  return (
    <Email
      width={600}
      title="You're invited to Build Day"
      previewText="May 14, The Foundry. A day of talks and workshops for the people who build and ship software."
      lang={brand.lang ?? "en"}
      dir={brand.dir}
      theme={brand.theme}
      fonts={brand.fonts}
      style={{ fontSize: token("fontSizes.body"), lineHeight: token("lineHeights.body") }}
    >
      <Section style={{ padding: [token("spacing.lg"), token("spacing.xl")] }}>
        <Image
          src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }}
          alt={brand.logo.alt}
          style={{ width: 140 }}
        />
      </Section>
      <Section
        style={{
          backgroundColor: token("colors.primary"),
          color: token("colors.primaryForeground"),
          padding: [token("spacing.xl"), token("spacing.xl")],
        }}
      >
        <Column style={{ gap: token("spacing.sm") }}>
          <Text
            style={{
              fontSize: token("fontSizes.small"),
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: "uppercase",
            }}
          >
            You're invited
          </Text>
          <Heading level={1} style={{ color: token("colors.primaryForeground") }}>Build Day</Heading>
          <Text>A day of talks and workshops for the people who build and ship software.</Text>
        </Column>
      </Section>
      <Section style={{ padding: [token("spacing.xl"), token("spacing.xl"), token("spacing.lg")] }}>
        <Column style={{ gap: token("spacing.lg") }}>
          <Row stackOnMobile={false} style={{ gap: token("spacing.md"), alignItems: "center" }}>
            <Column style={{ width: 76 }}>
              <Column
                style={{
                  width: 76,
                  backgroundColor: token("colors.surface"),
                  borderRadius: token("radii.md"),
                  padding: [10, 0],
                }}
              >
                <Text
                  style={{
                    fontSize: token("fontSizes.small"),
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    color: token("colors.primary"),
                    textAlign: "center",
                  }}
                >
                  May
                </Text>
                <Text style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.1, textAlign: "center" }}>14</Text>
              </Column>
            </Column>
            <Column style={{ gap: 2 }}>
              <Text style={{ fontWeight: 700 }}>May 14</Text>
              <Text style={{ color: token("colors.muted") }}>9:30 AM to 6:00 PM</Text>
              <Text style={{ color: token("colors.muted") }}>The Foundry, 120 Mill Street, Pittsburgh</Text>
            </Column>
          </Row>
          <Button
            href={`${brand.links.site}/events/build-day`}
            style={{ borderRadius: token("radii.sm"), padding: [token("spacing.sm"), token("spacing.lg")] }}
          >
            Register for Build Day
          </Button>
        </Column>
      </Section>
      <Section style={{ padding: [0, token("spacing.xl"), token("spacing.xl")] }}>
        <Column
          style={{
            gap: token("spacing.sm"),
            border: { top: { width: 1, style: "solid", color: token("colors.border") } },
            padding: [token("spacing.lg"), 0, 0],
          }}
        >
          <Heading level={2}>The day</Heading>
          <Row stackOnMobile={false} style={{ gap: token("spacing.md") }}>
            <Column style={{ width: 96 }}>
              <Text style={{ fontWeight: 700, color: token("colors.primary") }}>9:30 AM</Text>
            </Column>
            <Column>
              <Text>Doors open, coffee and breakfast</Text>
            </Column>
          </Row>
          <Row stackOnMobile={false} style={{ gap: token("spacing.md") }}>
            <Column style={{ width: 96 }}>
              <Text style={{ fontWeight: 700, color: token("colors.primary") }}>10:00 AM</Text>
            </Column>
            <Column>
              <Text>Opening talk: shipping weekly without breaking anything</Text>
            </Column>
          </Row>
          <Row stackOnMobile={false} style={{ gap: token("spacing.md") }}>
            <Column style={{ width: 96 }}>
              <Text style={{ fontWeight: 700, color: token("colors.primary") }}>1:00 PM</Text>
            </Column>
            <Column>
              <Text>Workshops, in four rooms</Text>
            </Column>
          </Row>
          <Row stackOnMobile={false} style={{ gap: token("spacing.md") }}>
            <Column style={{ width: 96 }}>
              <Text style={{ fontWeight: 700, color: token("colors.primary") }}>5:00 PM</Text>
            </Column>
            <Column>
              <Text>Closing panel, then drinks on the roof</Text>
            </Column>
          </Row>
        </Column>
      </Section>
      <Section
        style={{
          backgroundColor: token("colors.surface"),
          padding: [token("spacing.lg"), token("spacing.xl")],
        }}
      >
        <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>
          {brand.name} · {brand.address}{" · "}
          <Link href={`${brand.links.site}/unsubscribe`}>Stop event invitations</Link>
        </Text>
      </Section>
    </Email>
  );
}
