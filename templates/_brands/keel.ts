/** Keel. A precise fintech: green on white, a monospaced voice, tight spacing. */
import { defineTheme } from "@hyper-elements/react";
import type { Brand } from "../_brand";

export const brand: Brand = {
  name: "Keel",
  theme: defineTheme({
    colors: {
      background: "#ffffff",
      foreground: "#0b0d0c",
      primary: "#0f5c45",
      primaryForeground: "#ffffff",
      border: "#e2e4e2",
      muted: "#5a5f5c",
      surface: "#f3f4f2",
      accent: "#9fd8c2",
    },
    fonts: { body: "Inter, 'Helvetica Neue', Arial, sans-serif", heading: "'JetBrains Mono', Menlo, Consolas, monospace" },
    fontSizes: { body: 15, small: 14 },
    lineHeights: { body: 1.6, heading: 1.2 },
    spacing: { xs: 4, sm: 8, md: 12, lg: 20, xl: 32 },
    radii: { sm: 4, md: 10 },
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
  logo: { src: "https://hyperelements.dev/generated/kits/assets/brands/keel/logo.png", width: 480, height: 120, alt: "Keel" },
  address: "200 Harbor Street, Boston",
  links: { site: "https://keel.example", domains: ["keel.example", "*.keel.example"] },
  lang: "en",
  fonts: [
    { family: "Inter", src: "https://hyperelements.dev/generated/kits/assets/fonts/Inter-400.ttf", weight: 400, style: "normal" },
    { family: "Inter", src: "https://hyperelements.dev/generated/kits/assets/fonts/Inter-700.ttf", weight: 700, style: "normal" },
    { family: "JetBrains Mono", src: "https://hyperelements.dev/generated/kits/assets/fonts/JetBrainsMono-500.ttf", weight: 500, style: "normal" },
  ],
};
