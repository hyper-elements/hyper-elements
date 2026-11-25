// An OpenGraph card as a template (@hyper-elements/react/template), drawn with @hyper-elements/react/image: what
// app/og/[slug]/opengraph-image.jsx serves, and what ../nextjs-integration/verify.mjs --og draws again in Node.
// The same file as tests/nextjs-integration/og.mjs: each app imports its own, and resolves the package from its own
// node_modules.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import React from "react";
import { Canvas, Heading, Image, Text, prop } from "@hyper-elements/react";
import { layoutImage, renderImage } from "@hyper-elements/react/image";
import { checkLayout, field, sniffImage, template } from "@hyper-elements/react/template";

const h = React.createElement;

export const OgCard = template({
  id: "acme.OgCard",
  version: "1.0.0",
  label: "OpenGraph card",
  root: "Canvas",
  fields: {
    title: prop.text({ label: "Title", required: true, maxLength: 80 }),
    kicker: prop.text({ label: "Kicker", maxLength: 40 }),
    badge: field.image({ label: "Badge", fit: "contain" }),
  },
  example: { title: "Hyper Elements", kicker: "Docs" },
  render: (v) =>
    h(
      Canvas,
      { width: 1200, height: 630, style: { backgroundColor: "#0B1020", color: "#F7F7FB", fontFamily: "Inter", padding: 72, gap: 24, justifyContent: "end" } },
      v.badge ? h(Image, { field: "badge", src: v.badge, alt: "", style: { width: 160 } }) : null,
      v.kicker ? h(Text, { field: "kicker", style: { fontSize: 28, color: "#2DD4BF" } }, v.kicker) : null,
      // A long title steps down a size, to fit two lines. In the one weight the app has a font file for: a template's
      // design is drawn strict, so a weight with no file is an error.
      h(Heading, { field: "title", level: 1, fit: { sizes: [72, 64, 56, 48], maxLines: 2 }, style: { lineHeight: 1.1, fontWeight: 400 } }, v.title)
    ),
});

/** The pages that have a card: the first two prerendered when the app builds, the last drawn on request. */
export const PAGES = {
  orbit: { title: "Orbit is live", kicker: "Launch" },
  pricing: { title: "Simple pricing, for every team, from a single seat to the whole company", kicker: "Pricing" },
  "on-request": { title: "Drawn on request" },
};

/** A page's card as a PNG: the template as the design's root, so its check runs before it's drawn. */
export async function ogImage(slug) {
  const values = PAGES[slug] ?? { title: "Not found" };
  // The app's folder is the working directory for `next build`, `next start` and the verifier alike.
  const font = await readFile(join(process.cwd(), "../fonts/Inter-Regular.ttf"));
  const { image } = await renderImage(h(OgCard, values), { fonts: [{ family: "Inter", src: font }] });
  return image;
}

/** A 1×1 PNG: a badge far too small for its 160px region. */
const TINY = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));

/**
 * A card measured and checked by its template, as a tool would before rendering: layoutImage() of the checked snapshot,
 * then checkLayout() with the badge's file sniffed. Its badge is deliberately too small, so it reports one.
 */
export async function ogReport() {
  const font = await readFile(join(process.cwd(), "../fonts/Inter-Regular.ttf"));
  const values = { title: "Measured before it's drawn", badge: { src: "https://cdn.test/badge.png", width: 1, height: 1 } };
  const checked = OgCard.check(values);
  const layout = await layoutImage(checked.snapshots.default, { fonts: [{ family: "Inter", src: font }], images: { "https://cdn.test/badge.png": TINY } });
  const report = checkLayout(OgCard, checked.values, { layout, files: { badge: sniffImage(TINY) } });
  return { fits: layout.fits.map((fit) => ({ field: fit.field, chosen: fit.chosen })), diagnostics: report.diagnostics.map((d) => d.code) };
}
