/**
 * What a brand is, and the tokens a design may read. A design in this folder takes
 * its colors, fonts, spacing, logo and company details from a `Brand` it's given, and sets none of its own.
 */
import type { Theme } from "@hyper-elements/react";

/** One font file a brand's theme needs: a TTF or OTF file, at one weight and style. */
export type BrandFont = { family: string; src: string; weight: number; style: "normal" | "italic" };

export type Brand = {
  name: string;
  /** A `defineTheme()` result holding the contract's tokens (`CONTRACT`). */
  theme: Theme;
  /** A PNG or JPEG file. */
  logo: { src: string; width: number; height: number; alt: string };
  /** The postal address footers show. */
  address?: string;
  /** The brand's site, and the hosts its links may go to (`acme.example`, or `*.acme.example`). */
  links: { site: string; domains: readonly string[]; params?: Readonly<Record<string, string>> };
  /** The language, as a BCP 47 tag: "en" where it isn't set. */
  lang?: string;
  dir?: "ltr" | "rtl" | "auto";
  fonts: BrandFont[];
};

/**
 * A recreation's `meta.recreates`: the company whose work it rebuilds (its brand is `_companies/<company>.ts`), what it
 * rebuilds ("welcome email"), and where the original can be seen: a public archive of it, or a screenshot under
 * `_assets/companies/<company>/`.
 */
export type RecreationMeta = { company: string; what: string; original: string };

/** Where every image and font a brand or a design names lives once the website is built. */
export const ASSETS = "https://hyperelements.dev/generated/gallery/assets/";

/** The tokens a design may read, by group. A brand holds every one. */
export const CONTRACT = {
  colors: ["background", "foreground", "primary", "primaryForeground", "border", "muted", "surface", "accent"],
  fonts: ["body", "heading"],
  fontSizes: ["body", "small"],
  lineHeights: ["body", "heading"],
  spacing: ["xs", "sm", "md", "lg", "xl"],
  radii: ["sm", "md"],
} as const;

/** The first family a font stack names (`"Inter, Arial, sans-serif"` → `Inter`). */
export const firstFamily = (stack: string): string => stack.split(",")[0].trim().replace(/^["']|["']$/g, "");
