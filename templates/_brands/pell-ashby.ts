/** Pell & Ashby. A law firm: deep green on white, a serif voice, square and dense. */
import { defineTheme } from "@hyper-elements/react";
import type { Brand } from "../_brand";

export const brand: Brand = {
  name: "Pell & Ashby",
  theme: defineTheme({
    colors: {
      background: "#ffffff",
      foreground: "#1c1b19",
      primary: "#24513d",
      primaryForeground: "#ffffff",
      border: "#dad6cd",
      muted: "#66625a",
      surface: "#f6f4ef",
      accent: "#b9c7bc",
    },
    fonts: { body: "Inter, 'Helvetica Neue', Arial, sans-serif", heading: "'Source Serif 4', Georgia, 'Times New Roman', serif" },
    fontSizes: { body: 15, small: 14 },
    lineHeights: { body: 1.6, heading: 1.2 },
    spacing: { xs: 4, sm: 8, md: 12, lg: 20, xl: 32 },
    radii: { sm: 0, md: 0 },
    elements: {
      Heading: {
        fontWeight: 600,
        by: {
          level: {
            1: { fontSize: 30, lineHeight: 1.15 },
            2: { fontSize: 22, lineHeight: 1.25 },
            3: { fontSize: 18, lineHeight: 1.25 },
          },
        },
      },
    },
  }),
  logo: { src: "https://hyperelements.dev/generated/gallery/assets/brands/pell-ashby/logo.png", width: 480, height: 120, alt: "Pell & Ashby" },
  address: "3 Lincoln's Court, Philadelphia",
  links: {
    site: "https://pellashby.example",
    domains: ["pellashby.example", "*.pellashby.example"],
    unsubscribe: "https://pellashby.example/unsubscribe",
    preferences: "https://pellashby.example/account/emails",
    help: "https://pellashby.example/help",
  },
  currency: "USD",
  legal: { entity: "Pell & Ashby LLP", taxId: "EIN 78-9012345" },
  lang: "en",
  fonts: [
    { family: "Inter", src: "https://hyperelements.dev/generated/gallery/assets/fonts/Inter-400.ttf", weight: 400, style: "normal" },
    { family: "Inter", src: "https://hyperelements.dev/generated/gallery/assets/fonts/Inter-700.ttf", weight: 700, style: "normal" },
    { family: "Source Serif 4", src: "https://hyperelements.dev/generated/gallery/assets/fonts/SourceSerif4-600.ttf", weight: 600, style: "normal" },
  ],
};
