/** Ember. A music festival: yellow and pink on deep violet, loud and high-contrast. */
import { defineTheme } from "@hyper-elements/react";
import type { Brand } from "../_brand";

export const brand: Brand = {
  name: "Ember",
  theme: defineTheme({
    colors: {
      background: "#1a0b3d",
      foreground: "#ffffff",
      primary: "#ffe14d",
      primaryForeground: "#1a0b3d",
      border: "#3b2a75",
      muted: "#cdc4ff",
      surface: "#28145a",
      accent: "#ff4fa3",
    },
    fonts: { body: "Inter, 'Helvetica Neue', Arial, sans-serif", heading: "Inter, 'Helvetica Neue', Arial, sans-serif" },
    fontSizes: { body: 17, small: 14 },
    lineHeights: { body: 1.6, heading: 1.2 },
    spacing: { xs: 6, sm: 12, md: 20, lg: 32, xl: 56 },
    radii: { sm: 8, md: 20 },
    elements: {
      Heading: {
        fontWeight: 800,
        by: {
          level: {
            1: { fontSize: 40, lineHeight: 1.15 },
            2: { fontSize: 28, lineHeight: 1.25 },
            3: { fontSize: 21, lineHeight: 1.25 },
          },
        },
      },
    },
  }),
  logo: { src: "https://hyperelements.dev/generated/gallery/assets/brands/ember/logo.png", width: 480, height: 120, alt: "Ember" },
  address: "1 Riverside Yard, Detroit",
  links: {
    site: "https://ember.example",
    domains: ["ember.example", "*.ember.example"],
    unsubscribe: "https://ember.example/unsubscribe",
    preferences: "https://ember.example/account/emails",
    help: "https://ember.example/help",
  },
  currency: "USD",
  legal: { entity: "Ember Studio, Inc.", taxId: "EIN 45-6789012" },
  lang: "en",
  fonts: [
    { family: "Inter", src: "https://hyperelements.dev/generated/gallery/assets/fonts/Inter-400.ttf", weight: 400, style: "normal" },
    { family: "Inter", src: "https://hyperelements.dev/generated/gallery/assets/fonts/Inter-700.ttf", weight: 700, style: "normal" },
    { family: "Inter", src: "https://hyperelements.dev/generated/gallery/assets/fonts/Inter-800.ttf", weight: 800, style: "normal" },
  ],
};
