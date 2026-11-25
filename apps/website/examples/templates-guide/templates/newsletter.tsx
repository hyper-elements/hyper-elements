// templates/newsletter.tsx
import { Button, Column, Email, Heading, Link, Section, Text, defineTheme, prop } from "@hyper-elements/react";
import { field, template } from "@hyper-elements/react/template";
import { lint } from "@hyper-elements/lint";

// The brand's look for what an issue is written with: the content sets no styles of its own.
const brand = defineTheme({
  elements: {
    Heading: { color: "#0b1020", by: { level: { 1: { fontSize: 30, lineHeight: 1.2 }, 2: { fontSize: 20, lineHeight: 1.3 } } } },
    Text: { color: "#3b4254", fontSize: 16, lineHeight: 1.6 },
    Button: { backgroundColor: "#4f46e5", color: "#ffffff", borderRadius: 8, padding: [12, 20], fontWeight: 700 },
    Column: { gap: 12 },
  },
});

export default template({
  id: "acme.Newsletter",
  version: "1.0.0",
  label: "Orbit newsletter",
  guidance: "Orbit's monthly newsletter. Friendly and plain: sentence case, no exclamation marks, no emoji.",
  root: "Email",
  fields: {
    subject: prop.text({ label: "Subject", required: true, maxLength: 70 }),
    preview: prop.text({ label: "Preview text", required: true, maxLength: 120 }),
    // What the issue's writer writes: these elements only, in the brand's look, with one or two buttons.
    body: field.slot({
      label: "Body",
      required: true,
      allow: [Column, Heading, Text, Button, Link],
      styles: "none",
      count: { Button: { min: 1, max: 2 } },
      guidance: "One to three short sections, each a Heading and a Text.",
    }),
  },
  rules: {
    plugins: { lint: lint({ kind: "marketing" }) },
    // An unsubscribe link, link text that says where it goes, a language, and nothing wider than the email.
    require: { lint: ["unsubscribe", "link-text", "lang"], core: ["layout/overflow"] },
    // Links go to Orbit's own domains.
    links: { domains: ["orbit.example", "*.orbit.example"] },
    root: { lang: true, previewText: true },
  },
  example: {
    subject: "What's new in Orbit this month",
    preview: "Faster exports, release notes in your voice, and an invitation to our open house",
    body: (
      <Column>
        <Heading level={2}>Faster exports</Heading>
        <Text>Exports now finish in half the time, with no settings to change.</Text>
        <Button href="https://orbit.example/changelog">Read the changelog</Button>
      </Column>
    ),
  },
  render(v) {
    return (
      <Email lang="en" previewText={v.preview} theme={brand} style={{ backgroundColor: "#eef0f6" }}>
        <Section style={{ backgroundColor: "#0b1020", padding: [20, 32] }}>
          <Text style={{ color: "#ffffff", fontSize: 20, fontWeight: 700 }}>Orbit</Text>
        </Section>
        <Section style={{ backgroundColor: "#ffffff", padding: [32, 32, 8] }}>
          <Heading field="subject" level={1}>{v.subject}</Heading>
        </Section>
        <Section field="body" style={{ backgroundColor: "#ffffff", padding: [16, 32, 32] }}>
          {v.body}
        </Section>
        <Section style={{ padding: [20, 32] }}>
          <Text style={{ fontSize: 14, color: "#5b6478" }}>
            Orbit, 1 Main Street. <Link href="https://orbit.example/unsubscribe">Unsubscribe from these emails</Link>
          </Text>
        </Section>
      </Email>
    );
  },
});
