import { Button, Column, Divider, Heading, Image, Link, Row, Text, token } from "@hyper-elements/react";
import Newsletter from "../template";

export const meta = { label: "Product update" };

/** A story beside its thumbnail. */
const story = (title: string, summary: string, href: string, image?: { src: string; width: number; height: number }) => (
  <Row key={href} style={{ gap: token("spacing.md"), alignItems: "start" }}>
    {image && (
      <Column style={{ width: 140 }}>
        <Image src={image} alt="" style={{ width: 140, borderRadius: token("radii.sm") }} />
      </Column>
    )}
    <Column style={{ gap: token("spacing.xs") }}>
      <Heading level={3}>
        <Link href={href} style={{ textDecoration: "none" }}>{title}</Link>
      </Heading>
      <Text style={{ color: token("colors.muted") }}>{summary}</Text>
    </Column>
  </Row>
);

export default function ProductUpdate() {
  return (
    <Newsletter
      subject="What's new this month"
      preview="Faster exports, notes in your own voice, and a date for the open house"
      issue="No. 14 · March 5"
      body={
        <Column style={{ gap: token("spacing.lg") }}>
          <Column style={{ gap: token("spacing.md") }}>
            <Text style={{ fontSize: token("fontSizes.small"), fontWeight: 700, textTransform: "uppercase", color: token("colors.primary") }}>This month</Text>
            <Heading level={1}>Exports that finish before your coffee does</Heading>
            <Text>
              We rebuilt the export pipeline from the ground up. Big projects that took minutes now take seconds, and there's nothing to change in your settings to get it.
            </Text>
            <Button href="https://orbit.example/blog/faster-exports">Read about faster exports</Button>
          </Column>
          <Divider />
          <Heading level={2}>Also in this issue</Heading>
          {story(
            "Notes that sound like you",
            "Release notes now start from what you've written before, so a first draft already has your voice.",
            "https://orbit.example/blog/your-voice",
            { src: "https://hyperelements.dev/generated/gallery/assets/images/recorder.png", width: 1020, height: 900 },
          )}
          {story(
            "A new look for shared boards",
            "Boards you share outside your team get cleaner cards and a calmer layout.",
            "https://orbit.example/blog/shared-boards",
            { src: "https://hyperelements.dev/generated/gallery/assets/images/shapes.png", width: 1600, height: 1200 },
          )}
          {story("Office hours, every other Thursday", "Bring a question, or just listen in. We answer what you ask, live.", "https://orbit.example/events/office-hours")}
          <Column style={{ backgroundColor: token("colors.surface"), borderRadius: token("radii.sm"), padding: token("spacing.lg"), gap: token("spacing.sm") }}>
            <Heading level={3}>Come to the open house</Heading>
            <Text>We're opening the studio for an afternoon of demos and coffee. Bring a friend.</Text>
            <Button href="https://orbit.example/events/open-house">Save a seat at the open house</Button>
          </Column>
        </Column>
      }
    />
  );
}
