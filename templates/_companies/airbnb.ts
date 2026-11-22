/** Airbnb, as its review email draws it, with three changes: its button and link coral (#ff5a5f, 3.05:1 under white
 * text) is darkened to #bf4347 and its footer gray (#9ca299) to #6a6e68, so each passes 4.5:1 on white and on the
 * review's gray box (#f2f3f3), the original coral kept as the accent; and Inter leads its system font stack, since a
 * brand ships the font files it's drawn in. Its text gray (#484848) passes as it is. */
import { defineTheme } from "@hyper-elements/react";
import type { Brand } from "../_brand";

export const brand: Brand = {
  name: "Airbnb",
  theme: defineTheme({
    colors: {
      background: "#ffffff",
      foreground: "#484848",
      primary: "#bf4347",
      primaryForeground: "#ffffff",
      border: "#cccccc",
      muted: "#6a6e68",
      surface: "#f2f3f3",
      accent: "#ff5a5f",
    },
    fonts: {
      body: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif",
      heading: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif",
    },
    fontSizes: { body: 18, small: 14 },
    lineHeights: { body: 1.4, heading: 1.3 },
    spacing: { xs: 4, sm: 10, md: 16, lg: 20, xl: 48 },
    radii: { sm: 2, md: 4 },
    elements: {
      Heading: {
        fontWeight: 700,
        by: {
          level: {
            1: { fontSize: 32, lineHeight: 1.3 },
            2: { fontSize: 24, lineHeight: 1.3 },
            3: { fontSize: 18, lineHeight: 1.4 },
          },
        },
      },
    },
  }),
  logo: { src: "https://hyperelements.dev/generated/gallery/assets/companies/airbnb/logo.png", width: 190, height: 60, alt: "Airbnb" },
  address: "888 Brannan St, San Francisco, CA 94103",
  links: {
    site: "https://www.airbnb.com",
    domains: ["airbnb.com", "*.airbnb.com"],
    unsubscribe: "https://www.airbnb.com/unsubscribe",
    preferences: "https://www.airbnb.com/account/emails",
    help: "https://www.airbnb.com/help",
  },
  currency: "USD",
  lang: "en",
  fonts: [
    { family: "Inter", src: "https://hyperelements.dev/generated/gallery/assets/fonts/Inter-400.ttf", weight: 400, style: "normal" },
    { family: "Inter", src: "https://hyperelements.dev/generated/gallery/assets/fonts/Inter-700.ttf", weight: 700, style: "normal" },
  ],
};
