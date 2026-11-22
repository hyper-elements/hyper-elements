import type { APIRoute, GetStaticPaths } from "astro";
import gallery from "../../../generated/gallery.json";
import { previewHtml } from "../../../lib/examples";

type View = { html: string; preview?: string };
type Entry = { views: Record<string, View> };

/**
 * Each template's HTML preview in each brand, `/generated/gallery/<folder>.<name>.<brand>.html`, which a gallery card or a
 * template's page loads when a visitor picks a brand. Written from `gallery.json` when the site is built, so they
 * aren't committed. An image template has none: it's drawn in the visitor's browser (src/gallery/worker.ts).
 */
export const getStaticPaths: GetStaticPaths = () =>
  (gallery.templates as Array<{ byBrand: Record<string, Entry> }>).flatMap((t) =>
    Object.values(t.byBrand)
      .flatMap((entry) => Object.values(entry.views))
      .filter((view): view is Required<View> => !!view.preview?.endsWith(".html"))
      .map((view) => ({ params: { preview: view.preview.replace(/^.*\//, "").replace(/\.html$/, "") }, props: { html: view.html } })),
  );

export const GET: APIRoute = ({ props }) => new Response(previewHtml(props.html as string), { headers: { "Content-Type": "text/html; charset=utf-8" } });
