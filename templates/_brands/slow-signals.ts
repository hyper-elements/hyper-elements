/** Slow Signals. A late-night radio show: amber on dark brown, a serif voice, roomy. */
import { defineTheme } from "@hyper-elements/react";
import type { Brand } from "../_brand";

export const brand: Brand = {
  name: "Slow Signals",
  theme: defineTheme({
    colors: {
      background: "#1b1712",
      foreground: "#f1e8d6",
      primary: "#f2b544",
      primaryForeground: "#1b1712",
      border: "#3a332a",
      muted: "#b3a891",
      surface: "#241f18",
      accent: "#f2b544",
    },
    fonts: { body: "Inter, 'Helvetica Neue', Arial, sans-serif", heading: "'Source Serif 4', Georgia, 'Times New Roman', serif" },
    fontSizes: { body: 17, small: 14 },
    lineHeights: { body: 1.6, heading: 1.2 },
    spacing: { xs: 6, sm: 12, md: 20, lg: 32, xl: 56 },
    radii: { sm: 8, md: 16 },
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
  logo: { src: "https://hyperelements.dev/generated/gallery/assets/brands/slow-signals/logo.png", width: 480, height: 120, alt: "Slow Signals" },
  address: "PO Box 1170, Taos",
  links: {
    site: "https://slowsignals.example",
    domains: ["slowsignals.example", "*.slowsignals.example"],
    unsubscribe: "https://slowsignals.example/unsubscribe",
    preferences: "https://slowsignals.example/account/emails",
    help: "https://slowsignals.example/help",
  },
  currency: "USD",
  legal: { entity: "Slow Signals Radio, Inc.", taxId: "EIN 67-8901234" },
  lang: "en",
  fonts: [
    { family: "Inter", src: "https://hyperelements.dev/generated/gallery/assets/fonts/Inter-400.ttf", weight: 400, style: "normal" },
    { family: "Inter", src: "https://hyperelements.dev/generated/gallery/assets/fonts/Inter-700.ttf", weight: 700, style: "normal" },
    { family: "Source Serif 4", src: "https://hyperelements.dev/generated/gallery/assets/fonts/SourceSerif4-600.ttf", weight: 600, style: "normal" },
  ],
};
