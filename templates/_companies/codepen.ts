/** CodePen, as its Challenges newsletter draws it: a dark band of header art over a gray page, a yellow heading, white
 * panels and blue links. The changes: its link blue (#15c) is darkened to #1153c8, which passes 4.5:1 on the yellow
 * (#15c is 4.44:1); its two yellows (#f0d361, #f5d247) are one, and its near-black (#191919) is the text color too
 * (the original's body text is #000); the gray page is `muted`, and the PRO panel's blue border is `accent`. Inter
 * leads its font stack in place of Google Sans, since a brand ships the font files it's drawn in. The logo is the
 * header art ("CodePen Challenges"), which the design shows across its top, so another brand shows its own logo there. */
import { defineTheme } from "@hyper-elements/react";
import type { Brand } from "../_brand";

export const brand: Brand = {
  name: "CodePen",
  theme: defineTheme({
    colors: {
      background: "#ffffff",
      foreground: "#191919",
      primary: "#1153c8",
      primaryForeground: "#ffffff",
      border: "#ebd473",
      muted: "#505050",
      surface: "#f5d247",
      accent: "#2138c6",
    },
    fonts: {
      body: "Inter, 'Google Sans', Roboto, RobotoDraft, Helvetica, Arial, sans-serif",
      heading: "Inter, 'Google Sans', Roboto, RobotoDraft, Helvetica, Arial, sans-serif",
    },
    fontSizes: { body: 16, small: 14 },
    lineHeights: { body: 1.5, heading: 1.2 },
    spacing: { xs: 4, sm: 10, md: 16, lg: 20, xl: 30 },
    radii: { sm: 4, md: 10 },
    elements: {
      Heading: {
        fontWeight: 700,
        by: {
          level: {
            1: { fontSize: 32, lineHeight: 1.2 },
            2: { fontSize: 24, lineHeight: 1.25 },
            3: { fontSize: 18, lineHeight: 1.1 },
          },
        },
      },
    },
  }),
  logo: { src: "https://hyperelements.dev/generated/gallery/assets/companies/codepen/challengers.png", width: 1400, height: 400, alt: "CodePen Challenges" },
  links: {
    site: "https://codepen.io",
    domains: ["codepen.io", "*.codepen.io"],
    unsubscribe: "https://codepen.io/unsubscribe",
    preferences: "https://codepen.io/account/emails",
    help: "https://codepen.io/help",
  },
  currency: "USD",
  lang: "en",
  fonts: [
    { family: "Inter", src: "https://hyperelements.dev/generated/gallery/assets/fonts/Inter-400.ttf", weight: 400, style: "normal" },
    { family: "Inter", src: "https://hyperelements.dev/generated/gallery/assets/fonts/Inter-700.ttf", weight: 700, style: "normal" },
  ],
};
