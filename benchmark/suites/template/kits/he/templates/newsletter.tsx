// Orbit's newsletter template, written by Orbit's maintainers: the brand's header and footer are fixed, the issue's
// subject, preview and body are fields, and the body is written only with the components it allows, in the brand's
// own styles (the theme), with at least one button. Every link stays on Orbit's domains, with the newsletter's UTM tag.
import { Button, Column, defineTheme, Email, Heading, Image, Link, Section, Text, prop } from "@hyper-elements/react";
import { field, template } from "@hyper-elements/react/template";

export const brand = defineTheme({
  colors: { background: "#ffffff", foreground: "#1f2937", primary: "#4f46e5", primaryForeground: "#ffffff", muted: "#6b7280", page: "#f1f2f6" },
  fonts: { body: "Helvetica, Arial, sans-serif", heading: "Helvetica, Arial, sans-serif" },
  fontSizes: { body: 16, small: 13 },
  lineHeights: { body: 1.5 },
  components: {
    Heading: { color: "{colors.foreground}", by: { level: { 1: { fontSize: 28 }, 2: { fontSize: 20 } } } },
    Text: { color: "{colors.foreground}" },
    Button: { backgroundColor: "{colors.primary}", color: "{colors.primaryForeground}", borderRadius: 6, padding: { top: 12, right: 20, bottom: 12, left: 20 } },
    Link: { color: "{colors.primary}" },
    Column: { gap: 12 },
  },
});

export default template({
  id: "orbit.Newsletter",
  version: "1.0.0",
  label: "The Orbit Dispatch",
  guidance: "Orbit's monthly newsletter. Plain and friendly: sentence case, no exclamation marks.",
  root: "Email",
  fields: {
    preview: prop.text({ label: "Preview text", required: true, maxLength: 140 }),
    heading: prop.text({ label: "Heading", required: true, maxLength: 70 }),
    body: field.slot({
      label: "Body",
      required: true,
      allow: [Column, Heading, Text, Image, Button, Link],
      styles: "none",
      count: { Button: { min: 1 } },
      guidance: "The issue's intro and stories: each story an Image, a Heading (level 2), a Text and a Button, in a Column.",
    }),
  },
  rules: {
    links: { domains: ["orbit.dev", "*.orbit.dev"], params: { utm_source: "newsletter" } },
    root: { lang: true, previewText: true },
    require: { core: ["layout/overflow"] },
  },
  example: {
    preview: "What's new at Orbit this month, in two minutes.",
    heading: "The Orbit Dispatch",
    body: (
      <Column>
        <Text>Two things from the Orbit team this month.</Text>
        <Button href="https://orbit.dev/releases?utm_source=newsletter">See what's new</Button>
      </Column>
    ),
  },
  render(v) {
    return (
      <Email lang="en" previewText={v.preview} theme={brand} style={{ backgroundColor: "#f1f2f6", fontFamily: "Helvetica, Arial, sans-serif" }}>
        <Section id="brand-header" style={{ backgroundColor: "#ffffff", padding: { top: 24, right: 32, bottom: 8, left: 32 } }}>
          <Image src={{ src: "https://assets.orbit.dev/img/orbit-logo.png", width: 252, height: 128 }} alt="Orbit" style={{ width: 126 }} />
        </Section>
        <Section style={{ backgroundColor: "#ffffff", padding: { top: 8, right: 32, bottom: 8, left: 32 } }}>
          <Heading level={1}>{v.heading}</Heading>
        </Section>
        <Section field="body" style={{ backgroundColor: "#ffffff", padding: { top: 8, right: 32, bottom: 24, left: 32 } }}>
          {v.body}
        </Section>
        <Section id="brand-footer" style={{ padding: 24 }}>
          <Text style={{ color: "#6b7280", fontSize: 13 }}>
            Orbit Labs, 500 Market St, San Francisco. <Link href="https://orbit.dev/unsubscribe?utm_source=newsletter" style={{ color: "#6b7280" }}>Unsubscribe</Link>
          </Text>
        </Section>
      </Email>
    );
  },
});
