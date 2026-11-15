import { defineTheme } from "@hyper-elements/react";
import { Announcement } from "../brand/announcement";

export const meta = { title: "Bloom theme", root: "Email" };

const bloom = defineTheme({
  colors: { background: "#fbf3ea", foreground: "#3b2a20", muted: "#8a6f5c", primary: "#c2410c", primaryForeground: "#fff7ed", surface: "#fffaf4", line: "#e9d5c3" },
  fonts: { body: "Georgia, 'Times New Roman', serif", heading: "Georgia, 'Times New Roman', serif" },
  fontSizes: { body: 17, small: 13 },
  lineHeights: { body: 1.65 },
  spacing: { sm: 12, md: 22, lg: 40 },
  radii: { card: 24, button: 999 },
  components: {
    Heading: { by: { level: { 1: { fontSize: 36, fontWeight: 400, fontStyle: "italic", mobile: { fontSize: 30 } } } } },
    Button: { borderRadius: "{radii.button}", padding: [13, 26], variants: { secondary: { backgroundColor: "{colors.background}", color: "{colors.foreground}" } } },
  },
  styles: {
    band: { padding: [12, 16] },
    wordmark: { fontSize: 24, fontStyle: "italic", textAlign: "center", color: "{colors.primary}" },
    card: { backgroundColor: "{colors.surface}", borderRadius: "{radii.card}", padding: "{spacing.lg}", gap: "{spacing.md}", border: { width: 1, style: "solid", color: "{colors.line}" }, mobile: { padding: "{spacing.md}" } },
    eyebrow: { fontSize: "{fontSizes.small}", letterSpacing: 2, textTransform: "uppercase", color: "{colors.muted}" },
    footer: { fontSize: "{fontSizes.small}", fontStyle: "italic", color: "{colors.muted}", textAlign: "center" },
  },
});

export default function BloomAnnouncement() {
  return <Announcement brand="Bloom" name="The spring edit" theme={bloom} />;
}
