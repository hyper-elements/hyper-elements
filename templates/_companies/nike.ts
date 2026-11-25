/** Nike, as its shipping email draws it, with two changes: its footer gray (#afafaf) is its body gray (#6f6f6f), to
 * pass 4.5:1, and Inter leads its font stack (its own Helvetica Now isn't free to ship), since a brand ships the font
 * files it's drawn in. */
import { defineTheme } from "@hyper-elements/react";
import type { Brand } from "../_brand";

export const brand: Brand = {
  name: "Nike",
  theme: defineTheme({
    colors: {
      background: "#ffffff",
      foreground: "#111111",
      primary: "#111111",
      primaryForeground: "#ffffff",
      border: "#e5e5e5",
      muted: "#6f6f6f",
      surface: "#f7f7f7",
      accent: "#fa5400",
    },
    fonts: {
      body: "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif",
      heading: "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif",
    },
    fontSizes: { body: 14, small: 14 },
    lineHeights: { body: 1.7, heading: 1.3 },
    spacing: { xs: 4, sm: 12, md: 22, lg: 40, xl: 74 },
    radii: { sm: 0, md: 0 },
    elements: {
      Heading: {
        fontWeight: 700,
        by: {
          level: {
            1: { fontSize: 32, lineHeight: 1.3, letterSpacing: -1 },
            2: { fontSize: 32, lineHeight: 1.3, letterSpacing: -1 },
            3: { fontSize: 18, lineHeight: 1.3 },
          },
        },
      },
    },
  }),
  logo: { src: "https://hyperelements.dev/generated/gallery/assets/companies/nike/logo.png", width: 264, height: 104, alt: "Nike" },
  address: "One Bowerman Drive, Beaverton, Oregon 97005, USA",
  links: {
    site: "https://www.nike.com",
    domains: ["nike.com", "*.nike.com"],
    unsubscribe: "https://www.nike.com/unsubscribe",
    preferences: "https://www.nike.com/account/emails",
    help: "https://www.nike.com/help",
  },
  currency: "USD",
  support: { phone: "1-800-806-6453", hours: "4 am - 11 pm PT" },
  lang: "en",
  fonts: [
    { family: "Inter", src: "https://hyperelements.dev/generated/gallery/assets/fonts/Inter-400.ttf", weight: 400, style: "normal" },
    { family: "Inter", src: "https://hyperelements.dev/generated/gallery/assets/fonts/Inter-700.ttf", weight: 700, style: "normal" },
  ],
};
