/**
 * What a recreation must hold to, as problems: a design that rebuilds what a real company made. Its `meta.recreates`
 * names the company (whose brand is `_companies/<company>.ts`), says what it rebuilds and where the original can be
 * seen, and every image it shows is under the company's own folder of the assets.
 */
import { existsSync } from "node:fs";
import { ASSETS, checkBrand, type Brand, type RecreationMeta } from "../_brand";
import { assetFile } from "../_scripts/assets";

export interface RecreationInput {
  /** The design's file, for the problems. */
  file: string;
  recreates: Partial<RecreationMeta>;
  /** The company's brand, `_companies/<company>.ts`, where there is one. */
  brand?: Brand;
  /** Every image the design shows in the company's brand, its logo included. */
  images: string[];
}

export function recreationProblems(input: RecreationInput): string[] {
  const problems: string[] = [];
  const { file, recreates } = input;
  const company = recreates.company?.trim();
  if (!company) problems.push(`${file}: meta.recreates.company names the company (_companies/<company>.ts)`);
  if (!input.brand) problems.push(`${file}: a recreation is drawn in its company's brand: _companies/${company ?? "<company>"}.ts`);
  else problems.push(...checkBrand(input.brand).map((p) => `_companies/${company}.ts: ${p}`));
  if (!recreates.what?.trim()) problems.push(`${file}: meta.recreates.what says what it rebuilds ("welcome email")`);
  const own = `${ASSETS}companies/${company}/`;
  const original = recreates.original?.trim();
  if (!original) problems.push(`${file}: meta.recreates.original says where the original can be seen`);
  else if (original.startsWith(ASSETS)) {
    if (!original.startsWith(own)) problems.push(`${file}: its original's screenshot is outside ${own}`);
    else if (!/\.(png|jpe?g)$/i.test(original)) problems.push(`${file}: its original's screenshot is a PNG or JPEG file`);
    else if (!existsSync(assetFile(original)!)) problems.push(`${file}: ${original} has no file`);
  } else if (!/^https:\/\//.test(original)) problems.push(`${file}: meta.recreates.original is an https address, or a screenshot under ${own}`);
  for (const image of input.images) {
    if (!image.startsWith(own) && !image.startsWith(`${ASSETS}fonts/`)) problems.push(`${file}: ${image} is outside ${own}: a recreation's images are the original's, in its company's folder`);
  }
  return problems;
}
