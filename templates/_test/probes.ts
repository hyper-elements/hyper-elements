/**
 * Two probe brands whose every color and font is a sentinel used nowhere else. With a probe, every color in a
 * design's laid-out tree names the token it came from, so a literal (even one equal to a real brand's color) has no
 * name and fails. Two probes, because a literal that happens to equal one probe's sentinel isn't the other's.
 */
import { defineTheme } from "@hyper-elements/react";
import type { Brand } from "../_brand";
import { CONTRACT } from "../_brand";
import { brand as orbit } from "../_brands/orbit";

function probe(n: 1 | 2): Brand {
  // #0n0101, #0n0102, … : one sentinel per color token, different in each probe.
  const colors = Object.fromEntries(CONTRACT.colors.map((name, i) => [name, `#0${n}${(i + 1).toString(16).padStart(2, "0")}${n}${n}`.slice(0, 7)]));
  const theme = orbit.theme as unknown as Record<string, unknown>;
  return {
    ...orbit,
    name: `Probe ${n}`,
    theme: defineTheme({
      colors,
      fonts: { body: `Probe Body ${n}`, heading: `Probe Heading ${n}` },
      fontSizes: theme.fontSizes as Record<string, number>,
      lineHeights: theme.lineHeights as Record<string, number>,
      spacing: theme.spacing as Record<string, number>,
      radii: theme.radii as Record<string, number>,
      elements: theme.elements as never,
    }),
  };
}

export const PROBES = [probe(1), probe(2)];

/** A probe's color tokens by value, lowercased: "#010111" → "background". */
export function tokenNames(brand: Brand): Map<string, string> {
  return new Map(Object.entries(brand.theme.colors as Record<string, string>).map(([name, value]) => [value.toLowerCase(), name]));
}

/** A brand holding only the contract's tokens, and the heading sizes: no extra token a design could lean on. */
export function contractOnly(brand: Brand): Brand {
  const theme = brand.theme as unknown as Record<string, Record<string, unknown>>;
  const pick = (group: keyof typeof CONTRACT) => Object.fromEntries(CONTRACT[group].map((name) => [name, theme[group][name]]));
  return {
    ...brand,
    theme: defineTheme({
      colors: pick("colors") as Record<string, string>,
      fonts: pick("fonts") as Record<string, string>,
      fontSizes: pick("fontSizes") as Record<string, number>,
      lineHeights: pick("lineHeights") as Record<string, number>,
      spacing: pick("spacing") as Record<string, number>,
      radii: pick("radii") as Record<string, number>,
      elements: theme.elements as never,
    }),
  };
}
