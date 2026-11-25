// The Open Graph image generator's engine: each design (a template in examples/og-image/) checked with the values the
// visitor typed and drawn by @hyper-elements/react/image. The page runs it in a worker (worker.ts); the site's
// scripts run it in Node (scripts/og-image.mjs). Nothing here touches the network: whoever runs it loads the files.
import { renderImage, templateAssets } from "@hyper-elements/react/image";
import type { Template } from "@hyper-elements/react/template";
import clean from "../../examples/og-image/clean";
import cover from "../../examples/og-image/cover";
import docs from "../../examples/og-image/docs";
import journal from "../../examples/og-image/journal";
import midnight from "../../examples/og-image/midnight";
import split from "../../examples/og-image/split";

/** The designs, in the order the page offers them. */
export const DESIGNS: Record<string, Template<any, any>> = { clean, cover, split, midnight, journal, docs };

/** What a diagnostic says, as the page shows it. */
export interface Problem {
  code: string;
  severity: "error" | "warning" | "note";
  message: string;
  field?: string;
  fix?: string;
}

export type Drawn = { ok: true; image: Uint8Array; width: number; height: number; problems: Problem[] } | { ok: false; problems: Problem[] };

/** Reads a file a design names (a font, an image) by its URL. */
export type Load = (url: string) => Promise<Uint8Array>;

const problemsOf = (diagnostics: ReadonlyArray<{ code: string; severity: string; message: string; field?: string; fix?: string }>): Problem[] =>
  diagnostics
    .filter((d) => d.severity === "error" || d.severity === "warning")
    .map((d) => ({ code: d.code, severity: d.severity as Problem["severity"], message: d.message, ...(d.field ? { field: d.field } : {}), ...(d.fix ? { fix: d.fix } : {}) }));

/**
 * One design drawn with some values: SVG (which the page shows and turns into PNG and JPEG itself) or PNG. `files`
 * holds what the visitor gave (a photo, a logo) by the src the values name; `load` reads the rest.
 */
export async function draw(design: string, values: Record<string, unknown>, options: { files?: Record<string, Uint8Array>; load: Load; format?: "svg" | "png"; scale?: number }): Promise<Drawn> {
  const tpl = DESIGNS[design];
  if (!tpl) return { ok: false, problems: [{ code: "og/design", severity: "error", message: `There's no design named "${design}"` }] };
  const checked = tpl.check(values);
  const snapshot = checked.snapshots.default;
  if (!checked.valid || !snapshot) return { ok: false, problems: problemsOf(checked.diagnostics) };
  try {
    const assets = templateAssets(snapshot);
    const files = options.files ?? {};
    const [fonts, images] = await Promise.all([
      Promise.all(assets.fonts.map(async (face) => ({ family: face.family, src: await options.load(face.src), ...(typeof face.weight === "number" ? { weight: face.weight } : {}), ...(face.style ? { style: face.style } : {}) }))),
      Promise.all(assets.images.map(async (src) => [src, files[src] ?? (await options.load(src))] as const)),
    ]);
    const drawn = await renderImage(snapshot, { fonts, images: Object.fromEntries(images), format: options.format ?? "svg", scale: options.scale ?? 1 });
    return { ok: true, image: drawn.image, width: drawn.width, height: drawn.height, problems: problemsOf([...checked.diagnostics, ...drawn.diagnostics]) };
  } catch (error) {
    const diagnostics = (error as { diagnostics?: Problem[] }).diagnostics;
    if (Array.isArray(diagnostics)) return { ok: false, problems: problemsOf(diagnostics) };
    return { ok: false, problems: [{ code: "og/draw", severity: "error", message: error instanceof Error ? error.message : String(error) }] };
  }
}

/** Each design as the page needs it: its name, label, description and the fields it takes. */
export function catalog() {
  return Object.entries(DESIGNS).map(([name, tpl]) => {
    const described = tpl.describe();
    return {
      name,
      id: tpl.id,
      label: tpl.label,
      description: tpl.description ?? "",
      fields: described.fields.map((f) => ({ path: f.path, kind: f.kind, label: f.label, required: f.required, ...(f.default !== undefined ? { default: f.default } : {}) })),
    };
  });
}
