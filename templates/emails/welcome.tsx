import { Button, Column, Email, Heading, Image, Link, Row, Text, token } from "@hyper-elements/react";
import type { Brand } from "../_brand";

export const meta = {
  label: "Welcome",
  description: "A greeting on a band of the brand's color, three numbered next steps, and one button",
};

export default function Welcome({ brand }: { brand: Brand }) {
  return (
    <Email
      width={560}
      title={`Welcome to ${brand.name}`}
      previewText="Three ways to get started, Ada"
      lang={brand.lang ?? "en"}
      dir={brand.dir}
      theme={brand.theme}
      fonts={brand.fonts}
      style={{
        backgroundColor: token("colors.surface"),
        fontSize: token("fontSizes.body"),
        lineHeight: token("lineHeights.body"),
      }}
    >
      <Column
        style={{
          padding: [token("spacing.xl"), token("spacing.md"), token("spacing.lg")],
          gap: token("spacing.lg"),
        }}
      >
        <Column style={{ alignItems: "center" }}>
          <Image
            src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }}
            alt={brand.logo.alt}
            style={{ width: 150 }}
          />
        </Column>
        <Column
          style={{
            backgroundColor: token("colors.background"),
            borderRadius: token("radii.md"),
            border: { width: 1, style: "solid", color: token("colors.border") },
          }}
        >
          <Column
            style={{
              backgroundColor: token("colors.primary"),
              color: token("colors.primaryForeground"),
              padding: [token("spacing.xl"), token("spacing.xl"), token("spacing.lg")],
              gap: token("spacing.sm"),
              borderRadius: { topLeft: token("radii.md"), topRight: token("radii.md") },
            }}
          >
            <Text
              style={{
                fontSize: token("fontSizes.small"),
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: token("colors.primaryForeground"),
              }}
            >
              Welcome to {brand.name}
            </Text>
            <Heading level={1} style={{ color: token("colors.primaryForeground") }}>Glad you're here, Ada</Heading>
          </Column>
          <Column style={{ padding: token("spacing.xl"), gap: token("spacing.md") }}>
            <Text>Here's how to get the most from your first week. It takes about ten minutes.</Text>
            <Column style={{ gap: token("spacing.md"), padding: [token("spacing.sm"), 0] }}>
              <Row stackOnMobile={false} style={{ gap: token("spacing.md"), alignItems: "start" }}>
                <Column style={{ width: 36 }}>
                  <Column
                    style={{ backgroundColor: token("colors.surface"), borderRadius: 18, padding: [6, 0] }}
                  >
                    <Text style={{ fontWeight: 700, textAlign: "center", lineHeight: 1.5 }}>1</Text>
                  </Column>
                </Column>
                <Column style={{ gap: 2 }}>
                  <Text style={{ fontWeight: 700 }}>Invite your team</Text>
                  <Text style={{ color: token("colors.muted") }}>
                    Everyone sees the same work, and nothing gets lost in email.
                  </Text>
                </Column>
              </Row>
              <Row stackOnMobile={false} style={{ gap: token("spacing.md"), alignItems: "start" }}>
                <Column style={{ width: 36 }}>
                  <Column
                    style={{ backgroundColor: token("colors.surface"), borderRadius: 18, padding: [6, 0] }}
                  >
                    <Text style={{ fontWeight: 700, textAlign: "center", lineHeight: 1.5 }}>2</Text>
                  </Column>
                </Column>
                <Column style={{ gap: 2 }}>
                  <Text style={{ fontWeight: 700 }}>Connect your calendar</Text>
                  <Text style={{ color: token("colors.muted") }}>Plan the week around the time you actually have.</Text>
                </Column>
              </Row>
              <Row stackOnMobile={false} style={{ gap: token("spacing.md"), alignItems: "start" }}>
                <Column style={{ width: 36 }}>
                  <Column
                    style={{ backgroundColor: token("colors.surface"), borderRadius: 18, padding: [6, 0] }}
                  >
                    <Text style={{ fontWeight: 700, textAlign: "center", lineHeight: 1.5 }}>3</Text>
                  </Column>
                </Column>
                <Column style={{ gap: 2 }}>
                  <Text style={{ fontWeight: 700 }}>Start your first project</Text>
                  <Text style={{ color: token("colors.muted") }}>Pick a template, or begin with a blank page.</Text>
                </Column>
              </Row>
            </Column>
            <Button
              href={`${brand.links.site}/start`}
              style={{ borderRadius: token("radii.sm"), padding: [token("spacing.sm"), token("spacing.lg")] }}
            >
              Start your first week
            </Button>
            <Text style={{ color: token("colors.muted") }}>The {brand.name} team</Text>
          </Column>
        </Column>
        <Column style={{ gap: token("spacing.xs") }}>
          <Text
            style={{ fontSize: token("fontSizes.small"), color: token("colors.muted"), textAlign: "center" }}
          >
            {brand.name} · {brand.address}
          </Text>
          <Text
            style={{ fontSize: token("fontSizes.small"), color: token("colors.muted"), textAlign: "center" }}
          >
            <Link href={`${brand.links.site}/`}>Visit {brand.name}</Link>
            {" · "}
            <Link href={`${brand.links.site}/help`}>Get help from {brand.name}</Link>
          </Text>
        </Column>
      </Column>
    </Email>
  );
}
