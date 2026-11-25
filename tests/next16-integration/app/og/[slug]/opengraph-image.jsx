// An OpenGraph image drawn from a template (see og.mjs): two pages prerendered when the app builds, any other drawn
// when it's asked for. The image engines are server external packages (next.config.mjs).
import { ogImage, PAGES } from "../../../og.mjs";

// (No `runtime` export: Cache Components refuses one, and the Node.js runtime, which the image engines need, is the
// default.)
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return Object.keys(PAGES)
    .slice(0, 2)
    .map((slug) => ({ slug }));
}

/** A page's card, cached: with Cache Components, what generateStaticParams names is drawn when the app builds. */
async function card(slug) {
  "use cache";
  return ogImage(slug);
}

export default async function Image({ params }) {
  const { slug } = await params;
  return new Response(await card(slug), { headers: { "content-type": "image/png" } });
}
