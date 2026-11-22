/**
 * A guest's review, shown to the host once the review period ends: the logo, the reviewer's photo, "Here's what they
 * wrote", their words in a shaded box, what happens now, a button to reply, common questions and the footer. Everything
 * but the reviewer, their words and the link to reply is the brand's.
 */
import { Button, Column, Divider, Email, Heading, Image, Link, Section, Text, prop, token } from "@hyper-elements/react";
import { field, template } from "@hyper-elements/react/template";
import { lint } from "@hyper-elements/lint";
import type { Brand } from "../../_brand";
import { brand } from "../../_companies/airbnb";

const fields = {
  reviewer: prop.object(
    {
      name: prop.text({ label: "First name", required: true, maxLength: 60, guidance: "The reviewer's first name, as the profile shows it" }),
      photo: field.image({ label: "Photo", guidance: "Leave it out where the reviewer has none: their first initial is shown in a circle", aspect: { min: 1, max: 1 }, minWidth: 192, accepts: ["png", "jpeg"] }),
    },
    { label: "Reviewer", required: true },
  ),
  review: prop.text({
    label: "Review",
    required: true,
    pattern: "^[\\s\\S]{20,1000}$",
    guidance: "The review's words as written, with no quotation marks around them: a blank line starts a new paragraph",
  }),
  reply: prop.link({ label: "Message thread link", required: true, guidance: "The message thread with the reviewer" }),
};

export const meta = {
  author: "joaom00",
  recreates: { company: "airbnb", what: "review email", original: "https://reallygoodemails.com/search/emails/Airbnb" },
};

export function airbnbReview(brand: Brand) {
  const site = brand.links.site;
  const rule = { borderTop: { width: 1, style: "solid", color: token("colors.border") }, padding: [token("spacing.lg"), 0] } as const;
  const question = { color: token("colors.primary"), textDecoration: "none" } as const;
  // The review's paragraphs, split where it has a blank line.
  const paragraphs = (review: string) => review.trim().split(/\n[ \t]*\n\s*/);
  const initial = (name: string) => (Array.from(name.trim())[0] ?? "").toUpperCase();
  return template({
    id: "emails.AirbnbReview",
    version: "1.0.0",
    label: "Review received",
    description: "A guest's review, shown to the host once the review period ends: the logo, the reviewer's photo, their words in a shaded box, a button to reply, and common questions",
    root: "Email",
    fields,
    rules: {
      plugins: { lint: lint({ kind: "transactional" }) },
      require: { lint: ["preview-text", "link-text", "alt-text", "contrast", "text-size", "lang"], core: ["layout/overflow"] },
      links: { domains: [...brand.links.domains] },
    },
    example: {
      reviewer: { name: "Alex", photo: { src: "https://hyperelements.dev/generated/gallery/assets/companies/airbnb/reviewer.jpg", width: 225, height: 225 } },
      review: "A great host and a spotless place. Easy to find, quiet at night, and everything we needed was there.",
      reply: `${site}/messages`,
    },
    render: (v) => (
      <Email
        width={580}
        title={`Here's what ${v.reviewer.name} wrote`}
        previewText={`Read ${v.reviewer.name}'s review, now posted to your ${brand.name} profile`}
        lang={brand.lang ?? "en"}
        dir={brand.dir}
        theme={brand.theme}
        fonts={brand.fonts}
        style={{ backgroundColor: token("colors.background"), color: token("colors.foreground"), fontSize: token("fontSizes.body"), lineHeight: token("lineHeights.body") }}
      >
        <Section style={{ padding: [token("spacing.lg"), 0, token("spacing.xl")], mobile: { padding: [token("spacing.lg"), token("spacing.md"), token("spacing.xl")] } }}>
          <Column style={{ gap: token("spacing.md") }}>
            <Image src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }} alt={brand.logo.alt} style={{ width: 96 }} />
            {v.reviewer.photo ? (
              <Image field="reviewer.photo" src={v.reviewer.photo} alt={v.reviewer.name} style={{ width: 96, borderRadius: 48, alignSelf: "center" }} />
            ) : (
              <Column style={{ width: 96, padding: [28, 0], borderRadius: 48, backgroundColor: token("colors.primary") }}>
                <Text style={{ color: token("colors.primaryForeground"), fontSize: 40, lineHeight: "40px", fontWeight: 700, textAlign: "center" }}>
                  {initial(v.reviewer.name)}
                </Text>
              </Column>
            )}
            <Heading field="reviewer.name" level={1}>Here's what {v.reviewer.name} wrote</Heading>
            <Column style={{ padding: 24, gap: token("spacing.md"), backgroundColor: token("colors.surface"), borderRadius: token("radii.md") }}>
              {paragraphs(v.review).map((words, i, all) => (
                <Text key={i} field="review">
                  {i === 0 ? "“" : ""}
                  {words}
                  {i === all.length - 1 ? "”" : ""}
                </Text>
              ))}
            </Column>
            <Text>Now that the review period is over, we've posted {v.reviewer.name}'s review to your {brand.name} profile.</Text>
            <Text style={{ padding: [0, 0, token("spacing.md")] }}>
              While it's too late to write a review of your own, you can send your feedback to {v.reviewer.name} using your {brand.name} message thread.
            </Text>
            <Button
              href={v.reply}
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
    ),
  });
}

export default airbnbReview(brand);
