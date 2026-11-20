import { Button, Column, Divider, Email, Heading, Image, Link, Row, Text, token } from "@hyper-elements/react";
import type { Brand } from "../../_brand";

export const meta = {
  label: "Newsletter",
  description: "A regular issue: a masthead with the issue and date, a lead story, more stories with thumbnails, a closing note, and an unsubscribe footer",
};

export default function EditorialNewsletter({ brand }: { brand: Brand }) {
  return (
    <Email
      width={600}
      title="What's new this month"
      previewText="Faster exports, notes in your own voice, and a date for the open house"
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
      <Column style={{ padding: [token("spacing.lg"), token("spacing.md")], gap: token("spacing.lg") }}>
        <Row
          stackOnMobile={false}
          style={{ alignItems: "center", gap: token("spacing.md"), padding: [0, token("spacing.sm")] }}
        >
          <Column>
            <Image
              src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }}
              alt={brand.logo.alt}
              style={{ width: 140 }}
            />
          </Column>
          <Column>
            <Text
              style={{ fontSize: token("fontSizes.small"), color: token("colors.muted"), textAlign: "right" }}
            >
              No. 14 · March 5
            </Text>
          </Column>
        </Row>
        <Column
          style={{
            backgroundColor: token("colors.background"),
            borderRadius: token("radii.md"),
            border: { width: 1, style: "solid", color: token("colors.border") },
          }}
        >
          <Column style={{ padding: token("spacing.xl"), gap: token("spacing.md") }}>
            <Text
              style={{
                fontSize: token("fontSizes.small"),
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: token("colors.primary"),
              }}
            >
              This month
            </Text>
            <Heading level={1}>Exports that finish before your coffee does</Heading>
            <Text>
              We rebuilt the export pipeline from the ground up. Big projects that took minutes now take seconds, and there's nothing to change in your settings to get it.
            </Text>
            <Button
              href={`${brand.links.site}/blog/faster-exports`}
              style={{ borderRadius: token("radii.sm"), padding: [token("spacing.sm"), token("spacing.lg")] }}
            >
              Read about faster exports
            </Button>
          </Column>
          <Column style={{ padding: [0, token("spacing.xl"), token("spacing.xl")], gap: token("spacing.lg") }}>
            <Divider />
            <Heading level={2}>Also in this issue</Heading>
            <Row style={{ gap: token("spacing.md"), alignItems: "start" }}>
              <Column style={{ width: 140 }}>
                <Image
                  src={{
                    src: "https://hyperelements.dev/generated/kits/assets/kits/editorial/recorder.png",
                    width: 1020,
                    height: 900,
                  }}
                  alt=""
                  style={{ width: 140, borderRadius: token("radii.sm") }}
                />
              </Column>
              <Column style={{ gap: token("spacing.xs") }}>
                <Heading level={3}>
                  <Link href={`${brand.links.site}/blog/your-voice`} style={{ textDecoration: "none" }}>
                    Notes that sound like you
                  </Link>
                </Heading>
                <Text style={{ color: token("colors.muted") }}>
                  Release notes now start from what you've written before, so a first draft already has your voice.
                </Text>
              </Column>
            </Row>
            <Row style={{ gap: token("spacing.md"), alignItems: "start" }}>
              <Column style={{ width: 140 }}>
                <Image
                  src={{
                    src: "https://hyperelements.dev/generated/kits/assets/kits/editorial/shapes.png",
                    width: 1600,
                    height: 1200,
                  }}
                  alt=""
                  style={{ width: 140, borderRadius: token("radii.sm") }}
                />
              </Column>
              <Column style={{ gap: token("spacing.xs") }}>
                <Heading level={3}>
                  <Link href={`${brand.links.site}/blog/shared-boards`} style={{ textDecoration: "none" }}>
                    A new look for shared boards
                  </Link>
                </Heading>
                <Text style={{ color: token("colors.muted") }}>
                  Boards you share outside your team get cleaner cards and a calmer layout.
                </Text>
              </Column>
            </Row>
            <Row style={{ gap: token("spacing.md"), alignItems: "start" }}>
              <Column style={{ gap: token("spacing.xs") }}>
                <Heading level={3}>
                  <Link href={`${brand.links.site}/events/office-hours`} style={{ textDecoration: "none" }}>
                    Office hours, every other Thursday
                  </Link>
                </Heading>
                <Text style={{ color: token("colors.muted") }}>
                  Bring a question, or just listen in. We answer what you ask, live.
                </Text>
              </Column>
            </Row>
          </Column>
          <Column style={{ padding: [0, token("spacing.xl"), token("spacing.xl")] }}>
            <Column
              style={{
                backgroundColor: token("colors.surface"),
                borderRadius: token("radii.sm"),
                padding: token("spacing.lg"),
                gap: token("spacing.sm"),
              }}
            >
              <Heading level={3}>Come to the open house</Heading>
              <Text>We're opening the studio for an afternoon of demos and coffee. Bring a friend.</Text>
              <Button
                href={`${brand.links.site}/events/open-house`}
                style={{ borderRadius: token("radii.sm"), padding: [token("spacing.sm"), token("spacing.lg")] }}
              >
                Save a seat at the open house
              </Button>
            </Column>
          </Column>
        </Column>
        <Column style={{ padding: [0, token("spacing.sm")], gap: token("spacing.xs") }}>
          <Text
            style={{ fontSize: token("fontSizes.small"), color: token("colors.muted"), textAlign: "center" }}
          >
            You're getting {brand.name}'s newsletter because you signed up for it.
          </Text>
          <Text
            style={{ fontSize: token("fontSizes.small"), color: token("colors.muted"), textAlign: "center" }}
          >
            {brand.name}, {brand.address}
          </Text>
          <Text
            style={{ fontSize: token("fontSizes.small"), color: token("colors.muted"), textAlign: "center" }}
          >
            <Link href={`${brand.links.site}/unsubscribe`}>Unsubscribe from these emails</Link>
            {" · "}
            <Link href={`${brand.links.site}/account/emails`}>Choose which emails you get</Link>
          </Text>
        </Column>
      </Column>
    </Email>
  );
}
