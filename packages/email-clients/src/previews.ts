/**
 * The preview files for an email's HTML: one per variant, each drawing the email with the models and the runtime.
 * Shared by the main entry (render()'s HTML and block map) and the HTML entry (HTML the caller gave, with no blocks), so
 * both write the same file for the same HTML.
 */
import type { EmailClientPreview, PreviewVariant } from "./clients";
import { EMAIL_CLIENTS } from "./email-clients";
import { FONT_ORIGIN, fontSources, readPackageFont, unnamed, type ReadFont } from "./fonts";
import type { Models } from "./models";
import type { PreviewBlockMap } from "./preview-config";
import { RUNTIME } from "./runtime.generated";
import { previewFile, type PreviewSource } from "./shell";

/** A block map with no blocks: HTML the caller gave names none, so findings point at the email as a whole. */
export const NO_BLOCKS: PreviewBlockMap = { version: 2, unit: "utf8", entries: [] };

/** Each variant's preview file for `html`, in the variants' order. */
export async function previewsOf(
  html: string,
  blocks: PreviewBlockMap,
  variants: readonly PreviewVariant[],
  models: Models,
  { fonts, source }: { fonts: "url" | "inline" } & PreviewSource
): Promise<EmailClientPreview[]> {
  // The models' browser script, for the preview's CSP: its sha256 is the package's own.
  const script = { script: models.SCRIPT, sha256: models.SCRIPT_SHA256 };
  const fontOrigin = fonts === "url" ? FONT_ORIGIN : null;
  // Each font file read once, however many previews inline it.
  const cache = new Map<string, Promise<string>>();
  const read: ReadFont = (file) => cache.get(file) ?? (cache.set(file, readPackageFont(file)), cache.get(file)!);
  // A stand-in for a family the email chooses, only where it names it (NAMED_ONLY).
  const skip = unnamed(html);
  return Promise.all(
    variants.map(async (variant) => {
      const { filename: _, ...rest } = variant;
      const info = EMAIL_CLIENTS[variant.client];
      const config = {
        ...rest,
        name: info.name,
        blocks,
        fontOrigin,
        fontSources: await fontSources(variant.client, fonts, read, skip.files, variant.computer),
        faces: models.facesToLoad(variant.client, variant.computer).filter((face) => !skip.families.some((family) => face.endsWith(`"${family}"`))),
        leftOut: skip.families,
        standIns: models.standIns(variant.client, variant.computer),
        elements: info.measured?.elements ?? null,
        runtime: RUNTIME.sha256,
        models: { script: script.sha256, protocol: models.PROTOCOL },
      };
      return { ...variant, html: previewFile(html, config, { runtime: RUNTIME, models: script }, { source }) };
    })
  );
}
