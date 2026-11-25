// What the Open Graph image generator's page shows besides the tool: each design's code and how to use it, and the
// questions it answers. The designs are examples/og-image/; their pictures and fields are written by
// scripts/og-image.mjs into src/generated/og-image.json and public/generated/og-image/.
import designs from "../generated/og-image.json";
import clean from "../../examples/og-image/clean.tsx?raw";
import cover from "../../examples/og-image/cover.tsx?raw";
import docs from "../../examples/og-image/docs.tsx?raw";
import journal from "../../examples/og-image/journal.tsx?raw";
import midnight from "../../examples/og-image/midnight.tsx?raw";
import split from "../../examples/og-image/split.tsx?raw";

export const ogPath = "/tools/open-graph-image-generator";
export const ogTitle = "Free Open Graph image generator";
export const ogDescription =
  "Make a 1200 × 630 Open Graph image for any page, with X, Facebook and LinkedIn previews. Free, no sign-up, no watermark, and nothing leaves your browser. Every design is open-source code you can use to make one for every post.";

const sources: Record<string, string> = { clean, cover, split, midnight, journal, docs };

/** A design's component name in the snippets: "Clean", "Cover", … */
const nameOf = (name: string) => name[0].toUpperCase() + name.slice(1);

export type OgDesign = (typeof designs)[number] & { source: string; component: string; takesPhoto: boolean; nextRoute: string; cli: string; values: string };

export const ogDesigns: OgDesign[] = designs.map((design) => {
  const component = nameOf(design.name);
  const takesPhoto = design.fields.some((f) => f.path === "photo");
  const props = [`headline={post.title}`, `site="Fieldnotes"`, `author={post.author}`, `date={post.date}`, ...(takesPhoto ? ["photo={{ src: post.cover, width: 1800, height: 1200 }}"] : [])];
  return {
    ...design,
    source: sources[design.name].trim(),
    component,
    takesPhoto,
    nextRoute: `// app/blog/[slug]/opengraph-image.tsx: each post's Open Graph image, drawn when it's asked for.
// npm install @hyper-elements/react satori@^0.33.5 @resvg/resvg-js react react-dom
// next.config: serverExternalPackages: ["@resvg/resvg-js", "satori"]
import { renderImage, templateAssets } from "@hyper-elements/react/image";
import ${component} from "@/og/${design.name}"; // the template above
import { getPost } from "@/lib/posts";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const load = async (url: string) => new Uint8Array(await (await fetch(url)).arrayBuffer());

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const post = await getPost((await params).slug);
  const design = <${component} ${props.join(" ")} />;
  // The fonts and pictures the design names, as files: an image loads none itself.
  const assets = templateAssets(design);
  const fonts = await Promise.all(assets.fonts.map(async (f) => ({ family: f.family, weight: f.weight as number, src: await load(f.src) })));
  const images = Object.fromEntries(await Promise.all(assets.images.map(async (src) => [src, await load(src)])));
  const { image } = await renderImage(design, { fonts, images });
  return new Response(new Uint8Array(image), { headers: { "content-type": "image/png" } });
}`,
    values: `// og/launch.tsx: one post's image, a design made from the template.
import ${component} from "./${design.name}";

export default () => (
  <${component}
    headline="How we cut our image pipeline from forty seconds to four hundred milliseconds"
    site="Fieldnotes"
    author="Maya Okafor"
    date="Nov 18, 2026"${takesPhoto ? `\n    photo={{ src: "./photos/pipeline.jpg", width: 1800, height: 1200 }}` : ""}
  />
);`,
    cli: `npm install -D @hyper-elements/cli @hyper-elements/react satori@^0.33.5 @resvg/resvg-js react react-dom

# package.json: "hyperElements": { "templates": ["og/${design.name}.tsx"] }
npx hyper-elements check og/launch.tsx     # the headline fits, every character has a font
npx hyper-elements render og/launch.tsx    # out/og/launch.png, 1200 × 630`,
  };
});

export const ogFaq = [
  {
    q: "Is this Open Graph image generator free?",
    a: "Yes. There's no account, no watermark and no limit on how many images you make. The designs are open source under the MIT license, so you can also use them in your own code.",
  },
  {
    q: "Do you upload my photo or logo?",
    a: "No. The image is drawn in your browser by Hyper Elements, the same engine you can run on a server. Your headline, photo and logo stay on your device, and the PNG and JPG files are made there too. Nothing you type or pick is sent anywhere.",
  },
  {
    q: "What size should an Open Graph image be?",
    a: "1200 × 630 pixels, a ratio of 1.91 to 1. X, Facebook, LinkedIn, Slack and most other apps show an image that size as a large preview. Every design here is exactly that size.",
  },
  {
    q: "Which meta tags does a page need?",
    a: "og:image with the image's full URL (starting with https://), og:image:width and og:image:height (1200 and 630), og:image:alt with a short description, og:title, and twitter:card set to summary_large_image so X shows the large card. X reads og:image when there's no twitter:image.",
  },
  {
    q: "PNG or JPG?",
    a: "JPG for a design with a photo: the file is much smaller. PNG for flat colors and text, where it stays sharp and small. Both work everywhere.",
  },
  {
    q: "What happens when my headline is long?",
    a: "Each design draws the headline at the largest size that fits its lines, and steps down as it gets longer. If it can't fit even at the smallest size, the tool says how many characters to cut, instead of cutting it off.",
  },
  {
    q: "Why does my link still show the old image?",
    a: "Networks keep a copy of each link's preview. Publish the new image under a new file name and update og:image, then ask the network to read the page again: Facebook's Sharing Debugger, LinkedIn's Post Inspector, or post the link again on X.",
  },
  {
    q: "Can I make an image for every post automatically?",
    a: "Yes. Each design is a Hyper Elements template: a React component with typed fields. Copy it into your project, then draw one image per post in a Next.js opengraph-image route, a build script, or with the hyper-elements command. It's free and runs on your own server.",
  },
  {
    q: "Can I change a design or use my own fonts?",
    a: "Yes, in the code. A design is plain JSX: change its layout, colors or fonts, and the template still checks that the headline fits and that every character has a font before it draws.",
  },
];
