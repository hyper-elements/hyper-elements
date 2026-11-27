/**
 * The builder loads a web font from the URL of a stylesheet, given on each font a design names; a template has font
 * files. So each family's @font-face rules are written as a stylesheet, in a data URI. The builder offers a web font's
 * own weights only from a `weights` list on it (400 and 700 without one), and puts a selected block at a weight it
 * doesn't offer back to 400, so each font also lists the weights its faces have and its blocks are at, with 400 and
 * 700. Reading a design, a root's fonts come back from its hidden property, not from these.
 */
import type { Design } from "./design";

/** A face of a root's `fonts`, as the body's hidden property holds it. */
export type Face = { family: string; src: string; format?: string; weight?: number | string | number[]; style?: string };

/** The keys of the fonts a design names: a text tool's, and a table's header, content and footer fonts. */
const FONT_KEY = /^(fontFamily|(header|content|footer)FontFamily)$/;

/** Whether a design's key holds a font: `fontFamily`, `headerFontFamily`, `contentFontFamily` or `footerFontFamily`. */
export const isFontKey = (key: string | undefined): key is string => key !== undefined && FONT_KEY.test(key);

/** The key of the weight that goes with a font: `fontWeight` with `fontFamily`, `headerFontWeight` with `headerFontFamily`. */
const weightKey = (fontKey: string) => fontKey.replace(/Family$/, "Weight");

/** The weights the builder offers for a font with no `weights`: a list keeps them, so it never offers fewer. */
const BUILDER_WEIGHTS = [400, 700];

/** A stylesheet of a family's faces, as a data URI. */
export const fontStylesheet = (family: string, faces: Face[]): string => {
  const rules = faces.map(
    (face) => `@font-face{font-family:'${family.replace(/'/g, "\\'")}';src:url(${face.src})${face.format ? ` format('${face.format}')` : ""};font-weight:${[face.weight ?? 400].flat().join(" ")};font-style:${face.style ?? "normal"}}`
  );
  return `data:text/css;charset=utf-8,${encodeURIComponent(rules.join(""))}`;
};

/**
 * The weights a face covers that a block can be at (100 to 900, in hundreds): its one weight, or each hundred in its
 * range (`[100, 900]` or `"100 900"`). A face with no weight is 400; one at a weight between hundreds (450) covers none.
 */
export const faceWeights = (weight: Face["weight"]): number[] => {
  const named: Record<string, number> = { normal: 400, bold: 700 };
  const [from, to = from] = [weight ?? 400].flat().flatMap((one) => String(one).trim().split(/\s+/)).map((one) => named[one] ?? Number(one));
  const weights: number[] = [];
  for (let each = Math.max(100, Math.ceil(from / 100) * 100); each <= Math.min(900, to); each += 100) weights.push(each);
  return weights;
};

/** A family's `weights`, as the builder takes them: 400, 700, those its faces cover and those its blocks are at, in order. */
export const fontWeights = (faces: Face[], used: number[] = []): number[] =>
  [...new Set([...BUILDER_WEIGHTS, ...faces.flatMap((face) => faceWeights(face.weight)), ...used])].sort((a, b) => a - b);

/** The weights the blocks in each family are at, the body's among them, by the family's label. One with none is at 400. */
function weightsUsed(design: Design, families: Set<string>): Map<string, number[]> {
  const used = new Map<string, number[]>();
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (!value || typeof value !== "object") return;
    const values = value as Record<string, unknown>;
    for (const [key, held] of Object.entries(values)) {
      const label = isFontKey(key) ? (held as { label?: unknown } | null)?.label : undefined;
      const weight = values[weightKey(key)];
      if (typeof label === "string" && families.has(label) && typeof weight === "number") used.set(label, [...(used.get(label) ?? []), weight]);
      walk(held);
    }
  };
  walk(design);
  return used;
}

/**
 * A design with each font the root's `fonts` has carrying its stylesheet (`url`) and its `weights`. A design with no
 * fonts comes back as it was.
 */
export function withWebFonts(design: Design): Design {
  const faces = (design.body.values as { fonts?: Face[] }).fonts;
  if (!faces?.length) return design;
  const families = new Set(faces.map(({ family }) => family));
  const used = weightsUsed(design, families);
  const fonts = new Map(
    [...families].map((family) => {
      const own = faces.filter((face) => face.family === family);
      return [family, { url: fontStylesheet(family, own), weights: fontWeights(own, used.get(family)) }];
    })
  );
  const walk = (value: unknown, key?: string): unknown => {
    if (Array.isArray(value)) return value.map((item) => walk(item));
    if (!value || typeof value !== "object") return value;
    const copy = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v, k)]));
    const font = isFontKey(key) ? fonts.get(String((value as { label?: unknown }).label)) : undefined;
    return font ? { ...copy, ...font } : copy;
  };
  return walk(design) as Design;
}
