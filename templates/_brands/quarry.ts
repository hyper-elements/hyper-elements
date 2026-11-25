/** Quarry. A developer tool at night: lime on near-black, monospaced headings. */
import { defineTheme } from "@hyper-elements/react";
import type { Brand } from "../_brand";

export const brand: Brand = {
  name: "Quarry",
  theme: defineTheme({
    colors: {
      background: "#0e0f10",
      foreground: "#eceae4",
      primary: "#d4f25a",
      primaryForeground: "#0e0f10",
      border: "#2b2d30",
      muted: "#a3a199",
      surface: "#17191b",
      accent: "#c2e040",
    },
    fonts: { body: "Inter, 'Helvetica Neue', Arial, sans-serif", heading: "'JetBrains Mono', Menlo, Consolas, monospace" },
    fontSizes: { body: 15, small: 14 },
    lineHeights: { body: 1.6, heading: 1.2 },
    spacing: { xs: 4, sm: 8, md: 12, lg: 20, xl: 32 },
    radii: { sm: 4, md: 8 },
    elements: {
      Heading: {
        fontWeight: 500,
        by: {
          level: {
            1: { fontSize: 28, lineHeight: 1.15 },
            2: { fontSize: 21, lineHeight: 1.25 },
            3: { fontSize: 17, lineHeight: 1.25 },
          },
        },
      },
    },
  }),
  logo: { src: "https://hyperelements.dev/generated/gallery/assets/brands/quarry/logo.png", width: 480, height: 120, alt: "Quarry" },
  address: "88 Kiln Road, Austin",
  links: {
    site: "https://quarry.example",
    domains: ["quarry.example", "*.quarry.example"],
    unsubscribe: "https://quarry.example/unsubscribe",
    preferences: "https://quarry.example/account/emails",
    help: "https://quarry.example/help",
  },
  currency: "USD",
  legal: { entity: "Quarry Goods, LLC", taxId: "EIN 34-5678901" },
  lang: "en",
  fonts: [
    { family: "Inter", src: "https://hyperelements.dev/generated/gallery/assets/fonts/Inter-400.ttf", weight: 400, style: "normal" },
    { family: "Inter", src: "https://hyperelements.dev/generated/gallery/assets/fonts/Inter-700.ttf", weight: 700, style: "normal" },
    { family: "JetBrains Mono", src: "https://hyperelements.dev/generated/gallery/assets/fonts/JetBrainsMono-500.ttf", weight: 500, style: "normal" },
  ],
};
