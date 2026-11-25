/**
 * A brand template, as the brand-templates skill writes one: a newsletter with a fixed header and footer, typed fields
 * for the subject and preview, and a body slot the filler writes with the components it allows. Its rules require
 * what the brief does: an unsubscribe link, link text that says where it goes, the language, links to Acme's domains
 * only, and nothing wider than the email.
 */
import { Button, Column, Email, Heading, Link, Section, Text, prop } from "@hyper-elements/react";
import { field, template } from "@hyper-elements/react/template";
import { lint } from "@hyper-elements/lint";

export default template({
  id: "acme.Newsletter",
  version: "1.0.0",
  label: "Acme newsletter",
  guidance: "Acme's monthly newsletter. Friendly and plain: sentence case, no exclamation marks, no emoji.",
  root: "Email",
  fields: {
    subject: prop.text({ label: "Subject", required: true, maxLength: 70 }),
    preview: prop.text({ label: "Preview text", required: true, maxLength: 120, guidance: "What the inbox shows after the subject: 30 to 120 characters." }),
    body: field.slot({
      label: "Body",
      required: true,
      allow: [Column, Heading, Text, Button, Link],
      styles: "none",
      guidance: "One to three short sections, each a Heading and a Text; at most one Button.",
    }),
  },
  rules: {
    plugins: { lint: lint({ kind: "marketing" }) },
    require: { lint: ["unsubscribe", "link-text", "lang"], core: ["layout/overflow"] },
    links: { domains: ["acme.example", "*.acme.example"] },
    root: { lang: true, previewText: true },
  },
  example: {
    subject: "What's new at Acme this month",
    preview: "Three updates from the team, and an invitation to our next open house",
    body: (
      <Column>
        <Heading level={2}>Faster exports</Heading>
        <Text>Exports now finish in half the time, with no settings to change.</Text>
        <Button href="https://acme.example/changelog">Read the changelog</Button>
      </Column>
    ),
  },
  render(v) {
    return (
      <Email lang="en" previewText={v.preview} style={{ backgroundColor: "#f4f4f5" }}>
        <Section style={{ backgroundColor: "#111827", padding: 24 }}>
          <Text style={{ color: "#ffffff", fontSize: 20, fontWeight: 700 }}>Acme</Text>
        </Section>
        <Section field="body" style={{ backgroundColor: "#ffffff", padding: 32 }}>
          {v.body}
        </Section>
        <Section style={{ padding: 24 }}>
          <Text style={{ fontSize: 14, color: "#374151" }}>
            Acme, 1 Main Street. <Link href="https://acme.example/unsubscribe">Unsubscribe from these emails</Link>
          </Text>
        </Section>
      </Email>
    );
  },
});
