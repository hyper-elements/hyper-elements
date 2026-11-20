/**
 * What a brand is, the tokens a design may read, and the checks every brand passes. A design in this folder takes
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

/** The pairs text may be drawn in: [text, background], each at least 4.5:1 (WCAG AA). */
export const PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["foreground", "background"],
  ["foreground", "surface"],
  ["muted", "background"],
  ["muted", "surface"],
  ["primary", "background"],
  ["primary", "surface"],
  ["primaryForeground", "primary"],
];

/** The heading levels a brand sizes (`elements.Heading.by.level`). */
export const HEADING_LEVELS = ["1", "2", "3"] as const;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** A `#rgb` or `#rrggbb` color's channels, 0 to 255; undefined for anything else. */
export function rgbOf(color: string): [number, number, number] | undefined {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!hex) return undefined;
  const digits = hex[1].length === 3 ? [...hex[1]].map((d) => d + d).join("") : hex[1];
  return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16)) as [number, number, number];
}

/** WCAG 2's relative luminance of a color. */
export function luminance(color: string): number {
  const rgb = rgbOf(color);
  if (!rgb) return NaN;
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2's contrast ratio between two colors, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** The first family a font stack names (`"Inter, Arial, sans-serif"` → `Inter`). */
export const firstFamily = (stack: string): string => stack.split(",")[0].trim().replace(/^["']|["']$/g, "");

const COLOR_KEYS = /color|^fill$|^stroke$|^background$/i;

/** Every color-valued style set anywhere in a theme's element defaults, named styles or formats, by its path. */
function colorStyles(value: unknown, path: string, out: string[]): void {
  if (!isObject(value)) return;
  for (const [key, inner] of Object.entries(value)) {
    const at = `${path}.${key}`;
    if (typeof inner === "string" && COLOR_KEYS.test(key)) out.push(at);
    else if (typeof inner === "string" && /^border/i.test(key) && /#|rgb|hsl/i.test(inner)) out.push(at);
    else colorStyles(inner, at, out);
  }
}

/**
 * A brand's problems, by path; none for a brand every design can take. It holds every contract token, sizes its
 * headings, draws text only in pairs that pass 4.5:1, names TTF or OTF faces at one weight each (its body at 400 and
 * 700, and its headings at the weight it sets), uses PNG or JPEG images from the assets folder, and changes no color
 * outside its tokens.
 */
export function checkBrand(brand: Brand): string[] {
  const problems: string[] = [];
  const theme = brand.theme as unknown as Record<string, Record<string, unknown> | undefined>;
  for (const [group, names] of Object.entries(CONTRACT)) {
    for (const name of names) {
      const value = theme[group]?.[name];
      if (value === undefined) problems.push(`brand.theme.${group}.${name} is missing`);
      else if (group === "colors" && !rgbOf(String(value))) problems.push(`brand.theme.colors.${name} is ${JSON.stringify(value)}: a token color is #rgb or #rrggbb`);
    }
  }
  const elements = theme.elements as Record<string, { fontWeight?: unknown; by?: { level?: Record<string, { fontSize?: unknown }> } }> | undefined;
  for (const level of HEADING_LEVELS) {
    if (typeof elements?.Heading?.by?.level?.[level]?.fontSize !== "number") problems.push(`brand.theme.elements.Heading.by.level.${level}.fontSize is missing`);
  }
  const colors = (theme.colors ?? {}) as Record<string, string>;
  for (const [text, background] of PAIRS) {
    if (!colors[text] || !colors[background]) continue;
    const ratio = contrast(colors[text], colors[background]);
    if (!(ratio >= 4.5)) problems.push(`colors.${text} on colors.${background} is ${ratio.toFixed(2)}:1; text needs 4.5:1`);
  }
  // Colors come only from the tokens: element defaults, named styles and formats set none, and formats change no token.
  const loose: string[] = [];
  colorStyles(theme.elements, "brand.theme.elements", loose);
  colorStyles(theme.styles, "brand.theme.styles", loose);
  colorStyles(theme.formats, "brand.theme.formats", loose);
  for (const path of loose) problems.push(`${path} sets a color: a brand's colors are its color tokens only`);
  for (const [format, override] of Object.entries((theme.formats ?? {}) as Record<string, Record<string, unknown>>)) {
    if (isObject(override) && override.colors !== undefined) problems.push(`brand.theme.formats.${format}.colors overrides color tokens: a brand's colors are the same for every root`);
  }
  // Fonts: TTF or OTF files at one weight and style, under the assets folder, for what the theme draws.
  for (const [i, face] of brand.fonts.entries()) {
    if (!/\.(ttf|otf)$/i.test(face.src)) problems.push(`brand.fonts[${i}].src is ${face.src}: a brand's fonts are TTF or OTF files`);
    if (!face.src.startsWith(ASSETS)) problems.push(`brand.fonts[${i}].src is outside ${ASSETS}`);
    if (!Number.isInteger(face.weight) || face.weight < 100 || face.weight > 900) problems.push(`brand.fonts[${i}].weight is ${JSON.stringify(face.weight)}: one weight, 100 to 900`);
    if (face.style !== "normal" && face.style !== "italic") problems.push(`brand.fonts[${i}].style is ${JSON.stringify(face.style)}`);
  }
  const has = (family: string, weight: number) => brand.fonts.some((f) => f.family === family && f.weight === weight && f.style === "normal");
  const fonts = (theme.fonts ?? {}) as Record<string, string>;
  if (fonts.body) {
    for (const weight of [400, 700]) if (!has(firstFamily(fonts.body), weight)) problems.push(`brand.fonts has no ${firstFamily(fonts.body)} at ${weight}, which body text is drawn in`);
  }
  if (fonts.heading) {
    const weight = Number(elements?.Heading?.fontWeight ?? 700);
    if (!has(firstFamily(fonts.heading), weight)) problems.push(`brand.fonts has no ${firstFamily(fonts.heading)} at ${weight}, which headings are drawn in`);
  }
  if (!/\.(png|jpe?g)$/i.test(brand.logo.src)) problems.push(`brand.logo.src is ${brand.logo.src}: a logo is a PNG or JPEG file`);
  if (!brand.logo.src.startsWith(ASSETS)) problems.push(`brand.logo.src is outside ${ASSETS}`);
  if (!brand.logo.alt.trim()) problems.push("brand.logo.alt is empty");
  if (!brand.links.domains.length) problems.push("brand.links.domains is empty");
  return problems;
}

/** A link's address under a brand: a path on its site, with the brand's required parameters. */
export function linkOf(brand: Brand, path: string): string {
  const url = new URL(path, brand.links.site);
  for (const [key, value] of Object.entries(brand.links.params ?? {})) url.searchParams.set(key, value);
  return url.toString();
}
