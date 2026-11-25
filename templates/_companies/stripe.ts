/** Stripe, as its welcome email draws it, with two changes: its footer gray (#8898aa) and button blue (#656ee8) are
 * darkened to pass 4.5:1, and Inter leads its system font stack, since a brand ships the font files it's drawn in. */
import { defineTheme } from "@hyper-elements/react";
import type { Brand } from "../_brand";

export const brand: Brand = {
  name: "Stripe",
  theme: defineTheme({
    colors: {
      background: "#ffffff",
      foreground: "#525f7f",
      primary: "#5469d4",
      primaryForeground: "#ffffff",
      border: "#e6ebf1",
      muted: "#5f6b85",
      surface: "#f6f9fc",
      accent: "#656ee8",
    },
    fonts: {
      body: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, sans-serif",
      heading: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, sans-serif",
    },
    fontSizes: { body: 16, small: 14 },
    lineHeights: { body: 1.5, heading: 1.2 },
    spacing: { xs: 4, sm: 8, md: 16, lg: 20, xl: 48 },
    radii: { sm: 3, md: 4 },
    elements: {
      Heading: {
        fontWeight: 700,
        by: {
          level: {
            1: { fontSize: 28, lineHeight: 1.2 },
            2: { fontSize: 22, lineHeight: 1.25 },
            3: { fontSize: 18, lineHeight: 1.3 },
          },
        },
      },
    },
  }),
  logo: { src: "https://hyperelements.dev/generated/gallery/assets/companies/stripe/logo.png", width: 101, height: 42, alt: "Stripe" },
  address: "354 Oyster Point Blvd, South San Francisco, CA 94080",
  links: {
    site: "https://stripe.com",
    domains: ["stripe.com", "*.stripe.com"],
    unsubscribe: "https://stripe.com/unsubscribe",
    preferences: "https://stripe.com/account/emails",
    help: "https://stripe.com/help",
  },
  currency: "USD",
  lang: "en",
  fonts: [
    { family: "Inter", src: "https://hyperelements.dev/generated/gallery/assets/fonts/Inter-400.ttf", weight: 400, style: "normal" },
    { family: "Inter", src: "https://hyperelements.dev/generated/gallery/assets/fonts/Inter-700.ttf", weight: 700, style: "normal" },
  ],
};
