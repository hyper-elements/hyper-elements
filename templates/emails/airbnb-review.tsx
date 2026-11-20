import { Button, Column, Divider, Email, Heading, Image, Link, Section, Text, token } from "@hyper-elements/react";
import type { Brand } from "../_brand";

export const meta = {
  label: "Review received",
  category: "feedback-request",
  author: "joaom00",
  description: "A guest's review, shown to the host once the review period ends: the logo, the reviewer's photo, their words in a shaded box, a button to reply, and common questions",
  recreates: { company: "airbnb", what: "review email", original: "https://reallygoodemails.com/search/emails/Airbnb" },
};

const REVIEWER = "https://hyperelements.dev/generated/gallery/assets/companies/airbnb/reviewer.jpg";

export default function AirbnbReview({ brand }: { brand: Brand }) {
  const site = brand.links.site;
  const rule = { borderTop: { width: 1, style: "solid", color: token("colors.border") }, padding: [token("spacing.lg"), 0] } as const;
  const question = { color: token("colors.primary"), textDecoration: "none" } as const;
  return (
    <Email
      width={580}
      title="Here's what Alex wrote"
      previewText="Read Alex's review"
      lang={brand.lang ?? "en"}
      dir={brand.dir}
      theme={brand.theme}
      fonts={brand.fonts}
      style={{ backgroundColor: token("colors.background"), color: token("colors.foreground"), fontSize: token("fontSizes.body"), lineHeight: token("lineHeights.body") }}
    >
      <Section style={{ padding: [token("spacing.lg"), 0, token("spacing.xl")], mobile: { padding: [token("spacing.lg"), token("spacing.md"), token("spacing.xl")] } }}>
        <Column style={{ gap: token("spacing.md") }}>
          <Image src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }} alt={brand.logo.alt} style={{ width: 96 }} />
          <Image src={{ src: REVIEWER, width: 225, height: 225 }} alt="Alex" style={{ width: 96, borderRadius: 48, alignSelf: "center" }} />
          <Heading level={1}>Here's what Alex wrote</Heading>
          <Column style={{ padding: 24, backgroundColor: token("colors.surface"), borderRadius: token("radii.md") }}>
            <Text>
              “Alan was a great guest! Easy communication, the apartment was left in great condition, very polite, and respectful of all house rules.
              He’s welcome back anytime and would easily recommend him to any host!”
            </Text>
          </Column>
          <Text>Now that the review period is over, we've posted Alex's review to your {brand.name} profile.</Text>
          <Text style={{ padding: [0, 0, token("spacing.md")] }}>
            While it's too late to write a review of your own, you can send your feedback to Alex using your {brand.name} message thread.
          </Text>
          <Button
            href={`${site}/messages`}
            style={{
              width: "100%",
              backgroundColor: token("colors.primary"),
              color: token("colors.primaryForeground"),
              fontSize: token("fontSizes.body"),
              padding: [19, 30],
              borderRadius: token("radii.sm"),
              textAlign: "center",
            }}
          >
            Send My Feedback
          </Button>
          <Divider style={rule} />
          <Text style={{ fontWeight: 700 }}>Common questions</Text>
          <Text>
            <Link href={`${site}/help/reviews`} style={question}>How do reviews work?</Link>
          </Text>
          <Text>
            <Link href={`${site}/help/star-ratings`} style={question}>How do star ratings work?</Link>
          </Text>
          <Text>
            <Link href={`${site}/help/review-period`} style={question}>Can I leave a review after 14 days?</Link>
          </Text>
          <Divider style={rule} />
          <Column style={{ gap: token("spacing.sm") }}>
            {brand.address ? (
              <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted"), lineHeight: 1.7 }}>
                {brand.name}, {brand.address}
              </Text>
            ) : null}
            <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted"), lineHeight: 1.7 }}>
              <Link href={`${site}/help/report`} style={{ color: token("colors.muted"), textDecoration: "underline" }}>Report unsafe behavior</Link>
            </Text>
          </Column>
        </Column>
      </Section>
    </Email>
  );
}
