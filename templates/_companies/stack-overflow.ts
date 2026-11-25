/** Stack Overflow, as its search tips newsletter draws it, with these changes: its footer gray (#9199a1) is darkened
 * to #646c74 to pass 4.5:1 on the pale page; the button takes the banner's navy (#2b2d6e), since its blue (#0095ff)
 * with white text is 3.1:1 and a brand has one color for filled text; headings take the body's gray (#3c3f44) rather
 * than #0c0d0e, as a brand has one text color; the footer's 12px and 11px text is 14px; and Inter leads its font
 * stack, since a brand ships the font files it's drawn in. */
import { defineTheme } from "@hyper-elements/react";
import type { Brand } from "../_brand";

export const brand: Brand = {
  name: "Stack Overflow",
  theme: defineTheme({
    colors: {
      background: "#ffffff",
      foreground: "#3c3f44",
      primary: "#2b2d6e",
      primaryForeground: "#ffffff",
      border: "#d6d9dc",
      muted: "#646c74",
      surface: "#f3f3f5",
      accent: "#0095ff",
    },
    fonts: {
      body: "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif",
      heading: "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif",
    },
    fontSizes: { body: 15, small: 14 },
    lineHeights: { body: 1.4, heading: 1.1 },
    spacing: { xs: 4, sm: 8, md: 15, lg: 20, xl: 30 },
    radii: { sm: 4, md: 6 },
    elements: {
      Heading: {
        fontWeight: 700,
        by: {
          level: {
            1: { fontSize: 27, lineHeight: 1.1 },
            2: { fontSize: 21, lineHeight: 1.15 },
            3: { fontSize: 17, lineHeight: 1.3 },
          },
        },
      },
    },
  }),
  logo: { src: "https://hyperelements.dev/generated/gallery/assets/companies/stack-overflow/logo.png", width: 292, height: 72, alt: "Stack Overflow" },
  address: "110 William Street, 28th Floor, New York, NY 10038",
  links: {
    site: "https://stackoverflow.com",
    domains: ["stackoverflow.com", "*.stackoverflow.com", "stackoverflow.blog"],
    unsubscribe: "https://stackoverflow.com/unsubscribe",
    preferences: "https://stackoverflow.com/account/emails",
    help: "https://stackoverflow.com/help",
  },
  currency: "USD",
  lang: "en",
  fonts: [
    { family: "Inter", src: "https://hyperelements.dev/generated/gallery/assets/fonts/Inter-400.ttf", weight: 400, style: "normal" },
    { family: "Inter", src: "https://hyperelements.dev/generated/gallery/assets/fonts/Inter-700.ttf", weight: 700, style: "normal" },
  ],
};
