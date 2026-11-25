// An OpenGraph image drawn from a template (see og.mjs): two pages prerendered when the app builds, any other drawn
// when it's asked for. The image engines are server external packages (next.config.ts).
import { ogImage, PAGES } from "../../../../og.mjs";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return Object.keys(PAGES)
    .slice(0, 2)
    .map((slug) => ({ slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return new Response(new Uint8Array(await ogImage(slug)), { headers: { "content-type": "image/png" } });
}
