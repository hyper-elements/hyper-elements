/** Apple, as its App Store receipt draws it, with three changes: its 10px and 12px text is 14px (the smallest the checks
 * pass), its #888888 heading gray is darkened to #666666 to pass 4.5:1, and Inter leads its system font stack, since a
 * brand ships the font files it's drawn in. */
import { defineTheme } from "@hyper-elements/react";
import type { Brand } from "../_brand";

export const brand: Brand = {
  name: "Apple",
  theme: defineTheme({
    colors: {
      background: "#ffffff",
      foreground: "#333333",
      primary: "#0070c9",
      primaryForeground: "#ffffff",
      border: "#eeeeee",
      muted: "#666666",
      surface: "#fafafa",
      accent: "#0073ff",
    },
    fonts: {
      body: "Inter, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif",
      heading: "Inter, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif",
    },
    fontSizes: { body: 14, small: 14 },
    lineHeights: { body: 1.4, heading: 1.2 },
    spacing: { xs: 4, sm: 10, md: 20, lg: 30, xl: 48 },
    radii: { sm: 3, md: 14 },
    elements: {
      Heading: {
        fontWeight: 400,
        by: {
          level: {
            1: { fontSize: 32, lineHeight: 1.2 },
            2: { fontSize: 24, lineHeight: 1.2 },
            3: { fontSize: 18, lineHeight: 1.3 },
          },
        },
      },
    },
  }),
  logo: { src: "https://hyperelements.dev/generated/gallery/assets/companies/apple/logo.png", width: 84, height: 84, alt: "Apple" },
  address: "One Apple Park Way, Cupertino, CA 95014",
  links: {
    site: "https://www.apple.com",
    domains: ["apple.com", "*.apple.com"],
    unsubscribe: "https://www.apple.com/unsubscribe",
    preferences: "https://www.apple.com/account/emails",
    help: "https://www.apple.com/help",
  },
  currency: "USD",
  lang: "en",
  fonts: [
    { family: "Inter", src: "https://hyperelements.dev/generated/gallery/assets/fonts/Inter-400.ttf", weight: 400, style: "normal" },
    { family: "Inter", src: "https://hyperelements.dev/generated/gallery/assets/fonts/Inter-700.ttf", weight: 700, style: "normal" },
  ],
};
