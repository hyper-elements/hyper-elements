/** Spotify, as its emails draw it: white and gray on near-black, its green for buttons and links. Inter stands in for
 * its own typeface, which isn't free to ship, since a brand ships the font files it's drawn in. */
import { defineTheme } from "@hyper-elements/react";
import type { Brand } from "../_brand";

export const brand: Brand = {
  name: "Spotify",
  theme: defineTheme({
    colors: {
      background: "#121212",
      foreground: "#ffffff",
      primary: "#1ed760",
      primaryForeground: "#000000",
      border: "#2a2a2a",
      muted: "#b3b3b3",
      surface: "#000000",
      accent: "#1ed760",
    },
    fonts: {
      body: "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif",
      heading: "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif",
    },
    fontSizes: { body: 16, small: 14 },
    lineHeights: { body: 1.5, heading: 1.1 },
    spacing: { xs: 4, sm: 8, md: 16, lg: 32, xl: 48 },
    radii: { sm: 500, md: 8 },
    elements: {
      Heading: {
        fontWeight: 700,
        by: {
          level: {
            1: { fontSize: 44, lineHeight: 1.05, letterSpacing: -1.5 },
            2: { fontSize: 24, lineHeight: 1.2, letterSpacing: -0.5 },
            3: { fontSize: 18, lineHeight: 1.3 },
          },
        },
      },
    },
  }),
  logo: { src: "https://hyperelements.dev/generated/gallery/assets/companies/spotify/logo.png", width: 438, height: 140, alt: "Spotify" },
  address: "Regeringsgatan 19, 111 53 Stockholm, Sweden",
  links: {
    site: "https://www.spotify.com",
    domains: ["spotify.com", "*.spotify.com"],
    unsubscribe: "https://www.spotify.com/unsubscribe",
    preferences: "https://www.spotify.com/account/emails",
    help: "https://www.spotify.com/help",
  },
  currency: "USD",
  lang: "en",
  fonts: [
    { family: "Inter", src: "https://hyperelements.dev/generated/gallery/assets/fonts/Inter-400.ttf", weight: 400, style: "normal" },
    { family: "Inter", src: "https://hyperelements.dev/generated/gallery/assets/fonts/Inter-700.ttf", weight: 700, style: "normal" },
  ],
};
