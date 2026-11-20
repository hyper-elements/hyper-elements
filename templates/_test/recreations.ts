/**
 * What a recreation kit must hold to, as problems by path: a kit that rebuilds what a real company sent. Its `kit.ts`
 * names the company (`recreates`), its `brand.ts` is the company's brand, each of its designs says what it rebuilds
 * and where the original can be seen, and every image it names is under its own folder of the assets. A kit that
 * isn't a recreation has neither a brand nor a `recreates`.
 */
import { existsSync } from "node:fs";
import { ASSETS, checkBrand, type Brand, type RecreationMeta } from "../_brand";
import { assetFile } from "../_scripts/assets";

export interface RecreationInput {
  kit: string;
  recreates?: { company?: string };
  brand?: Brand;
  /** Each template's file and its `meta`. */
  designs: Array<{ file: string; meta?: { recreates?: Partial<RecreationMeta> } }>;
  /** Every image the kit's designs show, and its brand's logo. */
  images: string[];
}

export function recreationProblems(input: RecreationInput): string[] {
  const problems: string[] = [];
  const recreation = input.recreates !== undefined;
  if (!recreation) {
    if (input.brand) problems.push(`${input.kit}/brand.ts: only a recreation kit has a brand of its own (add recreates to kit.ts, or remove it)`);
    for (const t of input.designs) if (t.meta?.recreates) problems.push(`${t.file}: meta.recreates in a kit that isn't a recreation`);
    return problems;
  }
  if (!input.recreates?.company?.trim()) problems.push(`${input.kit}/kit.ts: recreates.company is empty`);
  if (!input.brand) problems.push(`${input.kit}/brand.ts: a recreation kit has its company's brand`);
  else problems.push(...checkBrand(input.brand).map((p) => `${input.kit}/brand.ts: ${p}`));
  const own = `${ASSETS}recreations/${input.kit}/`;
  for (const t of input.designs) {
    const meta = t.meta?.recreates;
    if (!meta?.what?.trim()) problems.push(`${t.file}: meta.recreates.what says what it rebuilds ("Login code email")`);
    if (!meta?.original?.trim()) problems.push(`${t.file}: meta.recreates.original says where the original can be seen`);
    else if (meta.original.startsWith(ASSETS)) {
      if (!meta.original.startsWith(own)) problems.push(`${t.file}: its original's screenshot is outside ${own}`);
      else if (!/\.(png|jpe?g)$/i.test(meta.original)) problems.push(`${t.file}: its original's screenshot is a PNG or JPEG file`);
      else if (!existsSync(assetFile(meta.original)!)) problems.push(`${t.file}: ${meta.original} has no file`);
    } else if (!/^https:\/\//.test(meta.original)) problems.push(`${t.file}: meta.recreates.original is an https address, or a screenshot under ${own}`);
  }
  for (const image of input.images) {
    if (!image.startsWith(own) && !image.startsWith(`${ASSETS}fonts/`)) problems.push(`${input.kit}: ${image} is outside ${own}: a recreation's images are the original's, in its own folder`);
  }
  return problems;
}
