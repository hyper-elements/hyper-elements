import { defineTheme } from "@hyper-elements/react";

export const brand = defineTheme({
  // Tokens: the brand's values, by name.
  colors: {
    background: "#f4f4f5",
    foreground: "#15132e",
    primary: "#4f46e5",
    primaryForeground: "#ffffff",
    muted: "#e0e7ff",
    border: "#e4e4e7",
  },
  fonts: { body: "Helvetica, Arial, sans-serif", heading: "Georgia, serif" },
  fontSizes: { body: 16, small: 13 },
  lineHeights: { body: 1.6 },
  spacing: { md: 16, lg: 32 },
  // Each element's defaults, and its named versions.
  elements: {
    Heading: {
      by: {
        level: {
          1: { fontSize: 32, mobile: { fontSize: 26 } },
          2: { fontSize: 22 },
        },
      },
    },
    Button: {
      borderRadius: 8,
      variants: {
        secondary: {
          backgroundColor: "{colors.muted}",
          color: "{colors.foreground}",
        },
      },
    },
  },
  // Named styles, for any element to apply.
  styles: {
    card: {
      backgroundColor: "#ffffff",
      padding: "{spacing.lg}",
      gap: "{spacing.md}",
      mobile: { padding: "{spacing.md}" },
    },
  },
});
