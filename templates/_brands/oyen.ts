/** Oyen. A hardware maker: signal orange on warm gray, heavy headlines, sharp corners. */
import { defineTheme } from "@hyper-elements/react";
import type { Brand } from "../_brand";

export const brand: Brand = {
  name: "Oyen",
  theme: defineTheme({
    colors: {
      background: "#f3f1ec",
      foreground: "#1a1917",
      primary: "#b33a0b",
      primaryForeground: "#ffffff",
      border: "#d3cec4",
      muted: "#5f5b53",
      surface: "#ffffff",
      accent: "#ff5b1f",
    },
    fonts: { body: "Inter, 'Helvetica Neue', Arial, sans-serif", heading: "Inter, 'Helvetica Neue', Arial, sans-serif" },
    fontSizes: { body: 16, small: 14 },
    lineHeights: { body: 1.6, heading: 1.2 },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 },
    radii: { sm: 0, md: 2 },
    elements: {
      Heading: {
        fontWeight: 800,
        by: {
          level: {
            1: { fontSize: 36, lineHeight: 1.15 },
            2: { fontSize: 26, lineHeight: 1.25 },
            3: { fontSize: 19, lineHeight: 1.25 },
          },
        },
      },
    },
  }),
  logo: { src: "https://hyperelements.dev/generated/gallery/assets/brands/oyen/logo.png", width: 480, height: 120, alt: "Oyen" },
  address: "14 Foundry Lane, Pittsburgh",
  links: {
    site: "https://oyen.example",
    domains: ["oyen.example", "*.oyen.example"],
    unsubscribe: "https://oyen.example/unsubscribe",
    preferences: "https://oyen.example/account/emails",
    help: "https://oyen.example/help",
  },
  currency: "USD",
  legal: { entity: "Oyen Works, Inc.", taxId: "EIN 23-4567890" },
  lang: "en",
  fonts: [
    { family: "Inter", src: "https://hyperelements.dev/generated/gallery/assets/fonts/Inter-400.ttf", weight: 400, style: "normal" },
    { family: "Inter", src: "https://hyperelements.dev/generated/gallery/assets/fonts/Inter-700.ttf", weight: 700, style: "normal" },
    { family: "Inter", src: "https://hyperelements.dev/generated/gallery/assets/fonts/Inter-800.ttf", weight: 800, style: "normal" },
  ],
};
