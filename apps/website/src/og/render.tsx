// One social card as a PNG: the page's values checked by the card's template, then its snapshot drawn. A title the
// card can't hold fails with the template's own diagnostics, so no clipped card is published.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { formatDiagnostics } from "@hyper-elements/react";
import { renderImage, type ImageFont } from "@hyper-elements/react/image";
import Card, { FONT_FILES } from "./card";

export interface CardValues {
  title: string;
  kicker: string;
}

/** The card's fonts, from src/og/fonts. */
export async function loadFonts(dir: string): Promise<ImageFont[]> {
  return Promise.all(FONT_FILES.map(async ({ family, file, weight }) => ({ family, weight, src: await readFile(join(dir, file)) })));
}

export async function renderCard(values: CardValues, fonts: ImageFont[]): Promise<Uint8Array> {
  const checked = Card.check(values, { format: "og" });
  const snapshot = checked.snapshots.og;
  if (!checked.valid || !snapshot) throw new Error(`The social card for "${values.title}" doesn't check:\n${formatDiagnostics(checked.diagnostics)}`);
  try {
    const { image, diagnostics } = await renderImage(snapshot, { fonts });
    const warnings = diagnostics.filter((d) => d.severity === "warning");
    if (warnings.length) throw new Error(formatDiagnostics(warnings));
    return image;
  } catch (error) {
    const diagnostics = (error as { diagnostics?: Parameters<typeof formatDiagnostics>[0] }).diagnostics;
    const detail = diagnostics ? formatDiagnostics(diagnostics) : String((error as Error).message ?? error);
    throw new Error(`The social card for "${values.title}" can't be drawn:\n${detail}`);
  }
}
