/** Casa Albero. A countryside hotel: terracotta on plaster, a serif voice, soft and rounded. */
import { defineTheme } from "@hyper-elements/react";
import type { Brand } from "../_brand";

export const brand: Brand = {
  name: "Casa Albero",
  theme: defineTheme({
    colors: {
      background: "#fbf7f0",
      foreground: "#2b2420",
      primary: "#9c3f24",
      primaryForeground: "#ffffff",
      border: "#e4dacb",
      muted: "#665c54",
      surface: "#f2eadd",
      accent: "#d9b48a",
    },
    fonts: { body: "Inter, 'Helvetica Neue', Arial, sans-serif", heading: "'Source Serif 4', Georgia, 'Times New Roman', serif" },
    fontSizes: { body: 16, small: 14 },
    lineHeights: { body: 1.6, heading: 1.2 },
    spacing: { xs: 6, sm: 12, md: 20, lg: 32, xl: 56 },
    radii: { sm: 12, md: 24 },
    elements: {
      Heading: {
        fontWeight: 600,
        by: {
          level: {
            1: { fontSize: 36, lineHeight: 1.15 },
            2: { fontSize: 26, lineHeight: 1.25 },
            3: { fontSize: 20, lineHeight: 1.25 },
          },
        },
      },
    },
  }),
  logo: { src: "https://hyperelements.dev/generated/kits/assets/brands/casa-albero/logo.png", width: 480, height: 120, alt: "Casa Albero" },
  address: "Strada dei Colli 12, Montalcino",
  links: { site: "https://casaalbero.example", domains: ["casaalbero.example", "*.casaalbero.example"] },
  lang: "en",
  fonts: [
    { family: "Inter", src: "https://hyperelements.dev/generated/kits/assets/fonts/Inter-400.ttf", weight: 400, style: "normal" },
    { family: "Inter", src: "https://hyperelements.dev/generated/kits/assets/fonts/Inter-700.ttf", weight: 700, style: "normal" },
    { family: "Source Serif 4", src: "https://hyperelements.dev/generated/kits/assets/fonts/SourceSerif4-600.ttf", weight: 600, style: "normal" },
  ],
};
