// Orbit's newsletter kit for React Email, written by Orbit's maintainers: the brand's layout (its header with the
// logo, the issue's heading, and its footer with the address and the unsubscribe link), its palette and its styles.
// Write a newsletter as <Layout preview="…" heading="…">…</Layout>, styled only with what's here.
import { Body, Container, Head, Heading, Html, Img, Link, Preview, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";

export const palette = { page: "#f1f2f6", card: "#ffffff", ink: "#1f2937", muted: "#6b7280", accent: "#4f46e5", onAccent: "#ffffff" };
export const font = "Helvetica, Arial, sans-serif";

export const styles = {
  text: { color: palette.ink, fontFamily: font, fontSize: 16, lineHeight: "24px", margin: "0 0 12px" },
  title: { color: palette.ink, fontFamily: font, fontSize: 20, lineHeight: "28px", margin: "16px 0 8px" },
  button: { backgroundColor: palette.accent, color: palette.onAccent, fontFamily: font, fontSize: 16, lineHeight: "24px", padding: "12px 20px", borderRadius: 6, textDecoration: "none", display: "inline-block", margin: "0 0 16px" },
  image: { display: "block", width: "100%", maxWidth: 536, height: "auto", margin: "8px 0" },
};

export function Layout({ preview, heading, children }: { preview: string; heading: string; children: ReactNode }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: palette.page, fontFamily: font, margin: 0, padding: "24px 0" }}>
        <Container style={{ width: "100%", maxWidth: 600, backgroundColor: palette.card }}>
          <Section id="brand-header" style={{ padding: "24px 32px 8px" }}>
            <Img src="https://assets.orbit.dev/img/orbit-logo.png" width="126" height="64" alt="Orbit" />
          </Section>
          <Section style={{ padding: "8px 32px" }}>
            <Heading as="h1" style={{ color: palette.ink, fontFamily: font, fontSize: 28, lineHeight: "36px", margin: 0 }}>{heading}</Heading>
          </Section>
          <Section style={{ padding: "8px 32px 24px" }}>{children}</Section>
        </Container>
        <Container id="brand-footer" style={{ width: "100%", maxWidth: 600 }}>
          <Section style={{ padding: "24px 32px" }}>
            <Text style={{ color: palette.muted, fontFamily: font, fontSize: 13, lineHeight: "20px", margin: 0 }}>
              Orbit Labs, 500 Market St, San Francisco. <Link href="https://orbit.dev/unsubscribe?utm_source=newsletter" style={{ color: palette.muted }}>Unsubscribe</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
