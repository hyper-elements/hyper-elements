/** Orbit. A calm, friendly software brand: indigo on white, rounded, roomy. */
import { defineTheme } from "@hyper-elements/react";
import type { Brand } from "../_brand";

export const brand: Brand = {
  name: "Orbit",
  theme: defineTheme({
    colors: {
      background: "#ffffff",
      foreground: "#0b1020",
      primary: "#4f46e5",
      primaryForeground: "#ffffff",
      border: "#e2e5ee",
      muted: "#5b6478",
      surface: "#f4f5fa",
      accent: "#2dd4bf",
    },
    fonts: { body: "Inter, 'Helvetica Neue', Arial, sans-serif", heading: "Inter, 'Helvetica Neue', Arial, sans-serif" },
    fontSizes: { body: 16, small: 14 },
    lineHeights: { body: 1.6, heading: 1.2 },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 },
    radii: { sm: 6, md: 12 },
    elements: {
      Heading: {
        fontWeight: 700,
        by: {
          level: {
            1: { fontSize: 32, lineHeight: 1.15 },
            2: { fontSize: 24, lineHeight: 1.25 },
            3: { fontSize: 19, lineHeight: 1.25 },
          },
        },
      },
    },
  }),
  logo: { src: "https://hyperelements.dev/generated/gallery/assets/brands/orbit/logo.png", width: 480, height: 120, alt: "Orbit" },
  address: "1 Main Street, Springfield",
  links: {
    site: "https://orbit.example",
    domains: ["orbit.example", "*.orbit.example"],
    unsubscribe: "https://orbit.example/unsubscribe",
    preferences: "https://orbit.example/account/emails",
    help: "https://orbit.example/help",
  },
  currency: "USD",
  legal: { entity: "Orbit Software, Inc.", taxId: "EIN 12-3456789" },
  lang: "en",
  fonts: [
    { family: "Inter", src: "https://hyperelements.dev/generated/gallery/assets/fonts/Inter-400.ttf", weight: 400, style: "normal" },
    { family: "Inter", src: "https://hyperelements.dev/generated/gallery/assets/fonts/Inter-700.ttf", weight: 700, style: "normal" },
  ],
};
