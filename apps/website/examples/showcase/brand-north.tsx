import { defineTheme } from "@hyper-elements/react";
import { Announcement } from "../brand/announcement";

export const meta = { title: "North theme", root: "Email" };

const north = defineTheme({
  colors: { background: "#eef2f6", foreground: "#0f172a", muted: "#64748b", primary: "#1d4ed8", primaryForeground: "#ffffff", surface: "#ffffff", line: "#cbd5e1" },
  fonts: { body: "Helvetica, Arial, sans-serif", heading: "Helvetica, Arial, sans-serif" },
  fontSizes: { body: 16, small: 12 },
  lineHeights: { body: 1.6 },
  spacing: { sm: 12, md: 20, lg: 36 },
  radii: { card: 6, button: 6 },
  components: {
    Heading: { by: { level: { 1: { fontSize: 32, fontWeight: 700, letterSpacing: -0.5, mobile: { fontSize: 26 } } } } },
    Button: { borderRadius: "{radii.button}", padding: [13, 22], fontWeight: 700, variants: { secondary: { backgroundColor: "{colors.surface}", color: "{colors.primary}", border: { width: 1, style: "solid", color: "{colors.line}" } } } },
  },
  styles: {
    band: { padding: [12, 16] },
    wordmark: { fontSize: 20, fontWeight: 700, letterSpacing: -0.5 },
    card: { backgroundColor: "{colors.surface}", borderRadius: "{radii.card}", padding: "{spacing.lg}", gap: "{spacing.md}", mobile: { padding: "{spacing.md}" } },
    eyebrow: { fontSize: "{fontSizes.small}", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "{colors.primary}" },
    footer: { fontSize: "{fontSizes.small}", color: "{colors.muted}", textAlign: "center" },
  },
});

export default function NorthAnnouncement() {
  return <Announcement brand="North" name="The winter collection" theme={north} />;
}
