import { Button, Column, Grid, Heading, Image, Link, Page, Row, Section, Text, token } from "@hyper-elements/react";
import type { Brand } from "../_brand";

export const meta = {
  label: "Event page",
  category: "event",
  description: "An event's web page: its name and tagline on a band of the brand's color, when and where, the schedule, and the speakers",
};

export default function Event({ brand }: { brand: Brand }) {
  return (
    <Page
      width={1040}
      title={`Build Day · ${brand.name}`}
      description="A day of talks and workshops for the people who build and ship software. May 14, The Foundry."
      lang={brand.lang ?? "en"}
      dir={brand.dir}
      theme={brand.theme}
      fonts={brand.fonts}
      style={{ fontSize: token("fontSizes.body"), lineHeight: token("lineHeights.body") }}
    >
      <Section style={{ padding: [token("spacing.lg"), token("spacing.xl")] }}>
        <Row stackOnMobile={false} style={{ alignItems: "center", gap: token("spacing.md") }}>
          <Column>
            <Image
              src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }}
              alt={brand.logo.alt}
              style={{ width: 150 }}
            />
          </Column>
          <Column style={{ alignItems: "end" }}>
            <Link href={`${brand.links.site}/events/build-day`}>Register for Build Day</Link>
          </Column>
        </Row>
      </Section>
      <Section
        style={{
          backgroundColor: token("colors.primary"),
          color: token("colors.primaryForeground"),
          padding: [56, token("spacing.xl"), 64],
        }}
      >
        <Column style={{ gap: token("spacing.md"), maxWidth: 720 }}>
          <Text
            style={{
              fontSize: token("fontSizes.small"),
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: "uppercase",
            }}
          >
            May 14 · The Foundry
          </Text>
          <Heading level={1} style={{ color: token("colors.primaryForeground") }}>Build Day</Heading>
          <Text style={{ fontSize: 20 }}>A day of talks and workshops for the people who build and ship software.</Text>
          <Button
            href={`${brand.links.site}/events/build-day`}
            style={{
              backgroundColor: token("colors.background"),
              color: token("colors.foreground"),
              borderRadius: token("radii.sm"),
              padding: [token("spacing.sm"), token("spacing.lg")],
            }}
          >
            Register for Build Day
          </Button>
        </Column>
      </Section>
      <Section style={{ padding: [token("spacing.xl"), token("spacing.xl")] }}>
        <Grid columns={3} style={{ gap: token("spacing.md") }}>
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
              <Text
                style={{
                  fontSize: token("fontSizes.small"),
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  color: token("colors.muted"),
                }}
              >
                When
              </Text>
              <Text>9:30 AM to 6:00 PM</Text>
            </Column>
          </Row>
          <Column style={{ gap: 2 }}>
            <Text
              style={{
                fontSize: token("fontSizes.small"),
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: token("colors.muted"),
              }}
            >
              Where
            </Text>
            <Text style={{ fontWeight: 700 }}>The Foundry</Text>
            <Text style={{ color: token("colors.muted") }}>120 Mill Street, Pittsburgh</Text>
          </Column>
          <Column style={{ gap: 2 }}>
            <Text
              style={{
                fontSize: token("fontSizes.small"),
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: token("colors.muted"),
              }}
            >
              Tickets
            </Text>
            <Text style={{ fontWeight: 700 }}>Free, with lunch</Text>
            <Link href={`${brand.links.site}/events/build-day`}>Save your seat</Link>
          </Column>
        </Grid>
      </Section>
      <Section style={{ padding: [token("spacing.lg"), token("spacing.xl"), token("spacing.xl")] }}>
        <Row style={{ gap: token("spacing.xl"), alignItems: "start" }}>
          <Column style={{ gap: token("spacing.md") }}>
            <Heading level={2}>Schedule</Heading>
            <Row
              stackOnMobile={false}
              style={{
                gap: token("spacing.md"),
                padding: [token("spacing.sm"), 0],
                border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
              }}
            >
              <Column style={{ width: 96 }}>
                <Text style={{ fontWeight: 700, color: token("colors.primary") }}>9:30 AM</Text>
              </Column>
              <Column>
                <Text>Doors open, coffee and breakfast</Text>
              </Column>
            </Row>
            <Row
              stackOnMobile={false}
              style={{
                gap: token("spacing.md"),
                padding: [token("spacing.sm"), 0],
                border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
              }}
            >
              <Column style={{ width: 96 }}>
                <Text style={{ fontWeight: 700, color: token("colors.primary") }}>10:00 AM</Text>
              </Column>
              <Column>
                <Text>Opening talk: shipping weekly without breaking anything</Text>
              </Column>
            </Row>
            <Row
              stackOnMobile={false}
              style={{
                gap: token("spacing.md"),
                padding: [token("spacing.sm"), 0],
                border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
              }}
            >
              <Column style={{ width: 96 }}>
                <Text style={{ fontWeight: 700, color: token("colors.primary") }}>11:30 AM</Text>
              </Column>
              <Column>
                <Text>Lightning talks</Text>
              </Column>
            </Row>
            <Row
              stackOnMobile={false}
              style={{
                gap: token("spacing.md"),
                padding: [token("spacing.sm"), 0],
                border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
              }}
            >
              <Column style={{ width: 96 }}>
                <Text style={{ fontWeight: 700, color: token("colors.primary") }}>1:00 PM</Text>
              </Column>
              <Column>
                <Text>Workshops, in four rooms</Text>
              </Column>
            </Row>
            <Row
              stackOnMobile={false}
              style={{
                gap: token("spacing.md"),
                padding: [token("spacing.sm"), 0],
                border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
              }}
            >
              <Column style={{ width: 96 }}>
                <Text style={{ fontWeight: 700, color: token("colors.primary") }}>5:00 PM</Text>
              </Column>
              <Column>
                <Text>Closing panel, then drinks on the roof</Text>
              </Column>
            </Row>
          </Column>
          <Column style={{ gap: token("spacing.md") }}>
            <Heading level={2}>Speakers</Heading>
            <Row
              stackOnMobile={false}
              style={{
                gap: token("spacing.md"),
                alignItems: "center",
                backgroundColor: token("colors.surface"),
                borderRadius: token("radii.md"),
                padding: token("spacing.md"),
              }}
            >
              <Column style={{ width: 56 }}>
                <Column
                  style={{ backgroundColor: token("colors.primary"), borderRadius: 28, padding: [14, 0] }}
                >
                  <Text
                    style={{
                      color: token("colors.primaryForeground"),
                      fontWeight: 700,
                      textAlign: "center",
                      lineHeight: 1.75,
                    }}
                  >
                    RL
                  </Text>
                </Column>
              </Column>
              <Column style={{ gap: 2 }}>
                <Text style={{ fontWeight: 700 }}>Rosa Lindqvist</Text>
                <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>
                  Staff engineer, Northwind
                </Text>
                <Text>Shipping weekly without breaking anything</Text>
              </Column>
            </Row>
            <Row
              stackOnMobile={false}
              style={{
                gap: token("spacing.md"),
                alignItems: "center",
                backgroundColor: token("colors.surface"),
                borderRadius: token("radii.md"),
                padding: token("spacing.md"),
              }}
            >
              <Column style={{ width: 56 }}>
                <Column
                  style={{ backgroundColor: token("colors.primary"), borderRadius: 28, padding: [14, 0] }}
                >
                  <Text
                    style={{
                      color: token("colors.primaryForeground"),
                      fontWeight: 700,
                      textAlign: "center",
                      lineHeight: 1.75,
                    }}
                  >
                    DO
                  </Text>
                </Column>
              </Column>
              <Column style={{ gap: 2 }}>
                <Text style={{ fontWeight: 700 }}>Dev Okafor</Text>
                <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>
                  Design lead, Fieldnote
                </Text>
                <Text>Design systems people actually use</Text>
              </Column>
            </Row>
            <Row
              stackOnMobile={false}
              style={{
                gap: token("spacing.md"),
                alignItems: "center",
                backgroundColor: token("colors.surface"),
                borderRadius: token("radii.md"),
                padding: token("spacing.md"),
              }}
            >
              <Column style={{ width: 56 }}>
                <Column
                  style={{ backgroundColor: token("colors.primary"), borderRadius: 28, padding: [14, 0] }}
                >
                  <Text
                    style={{
                      color: token("colors.primaryForeground"),
                      fontWeight: 700,
                      textAlign: "center",
                      lineHeight: 1.75,
                    }}
                  >
                    MT
                  </Text>
                </Column>
              </Column>
              <Column style={{ gap: 2 }}>
                <Text style={{ fontWeight: 700 }}>Mei Tanaka</Text>
                <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>
                  Founder, Lattice
                </Text>
                <Text>What we learned from a year of open source</Text>
              </Column>
            </Row>
          </Column>
        </Row>
      </Section>
      <Section
        style={{
          backgroundColor: token("colors.surface"),
          padding: [token("spacing.lg"), token("spacing.xl")],
        }}
      >
        <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>
          Build Day is run by {brand.name}, {brand.address}{". "}
          <Link href={`${brand.links.site}/contact`}>Ask {brand.name} about the event</Link>
        </Text>
      </Section>
    </Page>
  );
}
