/** Pith. A weekly essay newsletter: tomato and ink on cream, a serif voice. */
import { defineTheme } from "@hyper-elements/react";
import type { Brand } from "../_brand";

export const brand: Brand = {
  name: "Pith",
  theme: defineTheme({
    colors: {
      background: "#f5f0e6",
      foreground: "#1d1b18",
      primary: "#a8331f",
      primaryForeground: "#ffffff",
      border: "#d6cdbd",
      muted: "#625c52",
      surface: "#fffdf8",
      accent: "#e9b9a8",
    },
    fonts: { body: "Inter, 'Helvetica Neue', Arial, sans-serif", heading: "'Source Serif 4', Georgia, 'Times New Roman', serif" },
    fontSizes: { body: 17, small: 14 },
    lineHeights: { body: 1.6, heading: 1.2 },
    spacing: { xs: 6, sm: 12, md: 20, lg: 32, xl: 56 },
    radii: { sm: 0, md: 0 },
    elements: {
      Heading: {
        fontWeight: 600,
        by: {
          level: {
            1: { fontSize: 34, lineHeight: 1.15 },
            2: { fontSize: 25, lineHeight: 1.25 },
            3: { fontSize: 20, lineHeight: 1.25 },
          },
        },
      },
    },
  }),
  logo: { src: "https://hyperelements.dev/generated/gallery/assets/brands/pith/logo.png", width: 480, height: 120, alt: "Pith" },
  address: "9 Press Row, Portland",
  links: {
    site: "https://pith.example",
    domains: ["pith.example", "*.pith.example"],
    unsubscribe: "https://pith.example/unsubscribe",
    preferences: "https://pith.example/account/emails",
    help: "https://pith.example/help",
  },
  currency: "USD",
  legal: { entity: "Pith Press, LLC", taxId: "EIN 56-7890123" },
  lang: "en",
  fonts: [
    { family: "Inter", src: "https://hyperelements.dev/generated/gallery/assets/fonts/Inter-400.ttf", weight: 400, style: "normal" },
    { family: "Inter", src: "https://hyperelements.dev/generated/gallery/assets/fonts/Inter-700.ttf", weight: 700, style: "normal" },
    { family: "Source Serif 4", src: "https://hyperelements.dev/generated/gallery/assets/fonts/SourceSerif4-600.ttf", weight: 600, style: "normal" },
  ],
};
