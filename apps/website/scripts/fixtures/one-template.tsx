// check-playground.mjs's template: one themed template that renders under every root, so an agent's setRoot() and a
// link's root= can rewrite it to each, with props only an Email takes (previewText) to move out and come back, and
// web fonts for a Document's PDF to embed. Not a starter.
import { Button, Column, defineTheme, Email, Heading, Row, Section, Text, token } from "@hyper-elements/react";

// The brand, written once: every root that takes it is on brand.
const kiln = defineTheme({
  colors: { background: "#f4efe6", foreground: "#2a2622", primary: "#b4532a", primaryForeground: "#fff8ef", muted: "#7a7168", border: "#e0d7c8", card: "#fffaf2" },
  fonts: { body: "'DM Sans', Helvetica, Arial, sans-serif", heading: "Fraunces, Georgia, serif" },
  fontSizes: { body: 16, lead: 18, small: 13 },
  lineHeights: { body: 1.55 },
  components: {
    // A type scale: a Heading's style by its level.
    Heading: { by: { level: { 1: { fontSize: 44, lineHeight: 1.05, letterSpacing: -1, mobile: { fontSize: 34 } }, 3: { fontSize: 17, lineHeight: 1.3 } } } },
    Button: {
      borderRadius: 999,
      padding: [14, 26],
      fontWeight: 600,
      // A width of its own, so two sit side by side in every email client.
      width: 176,
      hover: { backgroundColor: "#963f1c" },
      // A variant: <Button variant="quiet">
      variants: { quiet: { backgroundColor: "{colors.card}", color: "{colors.foreground}", border: { width: 1, style: "solid", color: "{colors.border}" }, hover: { backgroundColor: "#ffffff" } } },
    },
    Text: { variants: { label: { fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", color: "{colors.primary}" } } },
  },
  // Named styles: style={{ apply: ["card"] }}. Their phone styles apply where a root has a phone width.
  styles: {
    band: { padding: [48, 32, 40, 32], gap: 20, mobile: { padding: [36, 20, 32, 20] } },
    card: { backgroundColor: "{colors.card}", border: { width: 1, style: "solid", color: "{colors.border}" }, borderRadius: 14, padding: 20, gap: 6 },
  },
  // Overrides for one kind of root: a poster's type on the image, a letter's on paper.
  formats: {
    canvas: {
      fontSizes: { body: 20, lead: 24, small: 17 },
      components: { Heading: { by: { level: { 1: { fontSize: 64 }, 3: { fontSize: 23 } } } }, Button: { width: 232 }, Text: { variants: { label: { fontSize: 15 } } } },
      styles: { band: { padding: [52, 56, 46, 56], gap: 18 } },
    },
    document: { fontSizes: { body: 12, lead: 14, small: 10.5 }, components: { Heading: { by: { level: { 1: { fontSize: 40 }, 3: { fontSize: 14 } } } }, Button: { width: 150 } } },
  },
});

const details = [
  ["When", "Saturday 14 March", "Noon to five. Come and go as you like."],
  ["Where", "8 Tanner's Yard, Leeds", "Through the blue gate, up the iron stairs."],
  ["Bring", "Nothing at all", "Aprons, clay and tea are on us."],
];

export default function OpenStudio() {
  return (
    <Email
      theme={kiln}
      title="Open studio at Kiln & Co"
      previewText="Throwing at noon, glazing at two, seconds at half price"
      fonts={[
        { family: "Fraunces", src: "https://cdn.jsdelivr.net/fontsource/fonts/fraunces@latest/latin-600-normal.woff2", format: "woff2", weight: 600 },
        { family: "DM Sans", src: "https://cdn.jsdelivr.net/fontsource/fonts/dm-sans@latest/latin-400-normal.woff2", format: "woff2", weight: 400 },
        { family: "DM Sans", src: "https://cdn.jsdelivr.net/fontsource/fonts/dm-sans@latest/latin-600-normal.woff2", format: "woff2", weight: 600 },
      ]}
    >
      <Section style={{ apply: ["band"] }}>
        <Text variant="label">Kiln &amp; Co · Open studio</Text>
        <Heading level={1}>Come and see how a pot is made.</Heading>
        <Text style={{ fontSize: token("fontSizes.lead"), color: token("colors.muted") }}>
          For one afternoon the workshop is yours: throwing at noon, glazing at two, and seconds at half price until they're gone.
        </Text>
        <Row style={{ gap: 12 }}>
          {details.map(([label, title, note]) => (
            <Column key={label} style={{ apply: ["card"] }}>
              <Text variant="label">{label}</Text>
              <Heading level={3}>{title}</Heading>
              <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>{note}</Text>
            </Column>
          ))}
        </Row>
        <Row style={{ gap: 12, justifyContent: "start" }}>
          <Button href="https://example.com/open-studio">Save a place</Button>
          <Button href="https://example.com/find-us" variant="quiet">Get directions</Button>
        </Row>
      </Section>
      {/* A scope: the same tokens with other values, for this band and what it holds. */}
      <Section tokens={{ colors: { background: "#2a2622", foreground: "#f4efe6", muted: "#b8ad9d" } }} style={{ padding: [22, 32] }}>
        <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>
          Can't make it? The kiln opens again in June. Kiln &amp; Co, 8 Tanner's Yard, Leeds LS2 7EW.
        </Text>
      </Section>
    </Email>
  );
}
