---
title: "Automate Open Graph images for every page in Next.js"
description: "Give every Next.js page an on-brand Open Graph image made from its title, drawn at build time from one template, with a build that fails on a title that doesn't fit."
slug: "automate-open-graph-images-nextjs"
date: 2026-11-18
hero: "/img/blog/nextjs-open-graph-images-workflow.webp"
heroAlt: "A list of page paths feeds a next build panel that checks each title and draws it, producing a stack of colorful 1200 by 630 cards; a page with its own image bypasses the build and keeps it."
---

To give every page of a Next.js App Router site its own Open Graph image, make one card template with Hyper Elements, list your pages and their titles in one place, and serve the cards from a route handler that Next.js prerenders when it builds. Each page’s metadata points at its card, unless the page has an image of its own.

Nobody draws a card by hand, and no card is drawn when someone requests it: `next build` draws one PNG per page and fails if a title can’t fit. This tutorial builds that for a small fictional site, Northline, in a new Next.js app with Cache Components on, as `create-next-app` sets it up. For a single card from a standalone Node.js script, see [Open Graph images in Node.js with local fonts](/blog/node-open-graph-images-local-fonts). This post doesn’t repeat it.

## What does the finished setup do?

Five files do the work. The template holds the brand. A list of pages holds the titles. One route handler draws a card for each page without its own image, and one function writes each page’s metadata.

```text
fonts/
  Inter-Regular.ttf
  Inter-Bold.ttf
lib/
  og/card.tsx           the card template
  og/render.ts          checks a page's values and draws its card
  pages.ts              every page: path, title, section, own image
  metadata.ts           a page's title, description and og:image
app/
  og/[...path]/route.ts serves /og/<page>.png, prerendered
  layout.tsx            the site's base URL
next.config.ts
```

At build time, the route handler asks for one card per page. Each card’s values are checked against the template, then drawn with the fonts from `fonts/`. The PNGs are saved with the build, and each page’s `og:image` and `twitter:image` tags point at its own card.

## What do I need to install?

In an App Router project, install the elements and the two image engines. They are optional peer dependencies of `@hyper-elements/react`, so you add them yourself. Keep Satori in the range the [image docs](/docs/outputs/image#install) give.

```bash
npm install @hyper-elements/react satori@^0.33.5 @resvg/resvg-js
```

Put the two Inter files in `fonts/` at the project root. Use TTF, OTF or WOFF files: the image renderer doesn’t draw WOFF2, which is what most web font downloads give you. Inter’s [releases](https://github.com/rsms/inter/releases) include TTF files. Any font works if you have the right to use it and it has every character your titles use.

Then tell Next.js not to bundle the engines. Without this line, `next build` fails on resvg’s native addon (`non-ecmascript placeable asset`).

`next.config.ts`

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Satori reads a WebAssembly file and resvg is a native addon:
  // load them from node_modules instead of bundling them.
  serverExternalPackages: ["@resvg/resvg-js", "satori"],
};

export default nextConfig;
```

The first two settings are the ones `create-next-app` writes. Only `serverExternalPackages` is new.

## How do I make the card template?

A [template](/docs/templates) is a design with a few named fields. The fields are the only things that change from one card to the next. The logo, colors, fonts and layout are written into the template, so no page can change them. This card has two fields: the page’s title and its section, one of five. The section picks the card’s colors from palettes the template owns, so a page chooses its section, never its colors.

`lib/og/card.tsx`

```tsx
import {
  Canvas, Circle, Column, Heading, Layer, Path, Rect, Row, Svg, Text, prop,
} from "@hyper-elements/react";
import { template } from "@hyper-elements/react/template";

// Each section's colors: a background, three accents and a soft tint.
const PALETTES = {
  Product: { bg: "#4338ca", a: "#f472b6", b: "#facc15", c: "#22d3ee", soft: "#c7d2fe" },
  Pricing: { bg: "#047857", a: "#a3e635", b: "#fde047", c: "#5eead4", soft: "#a7f3d0" },
  Docs: { bg: "#0f172a", a: "#38bdf8", b: "#a78bfa", c: "#f472b6", soft: "#94a3b8" },
  Blog: { bg: "#be123c", a: "#fb923c", b: "#fde047", c: "#f9a8d4", soft: "#fecdd3" },
  Company: { bg: "#7c3aed", a: "#fbbf24", b: "#34d399", c: "#f472b6", soft: "#ddd6fe" },
};
type Section = keyof typeof PALETTES;
const SECTIONS = Object.keys(PALETTES) as Section[];

// The logo: a white tile with a navy chevron pointing north.
const logo = (
  <Svg width={44} height={44} viewBox="0 0 44 44" title="Northline">
    <Rect x={0} y={0} width={44} height={44} rx={10} style={{ fill: "#ffffff" }} />
    <Path
      d="M12 27 L22 16 L32 27"
      style={{ fill: "transparent", stroke: "#0f1729", strokeWidth: 4.5 }}
    />
  </Svg>
);

// Shapes on the right of the card, in the section's accents.
const shapes = (p: (typeof PALETTES)[Section]) => (
  <Svg width={1200} height={630}>
    <Circle cx={1070} cy={140} r={200} style={{ fill: p.a }} />
    <Rect x={820} y={340} width={240} height={240} rx={56} style={{ fill: p.b }} />
    <Circle
      cx={1130}
      cy={520}
      r={100}
      style={{ fill: "transparent", stroke: p.c, strokeWidth: 28 }}
    />
    <Path
      d="M880 300 L990 190 L1100 300"
      style={{ fill: "transparent", stroke: "#ffffff", strokeWidth: 30 }}
    />
  </Svg>
);

export default template({
  id: "northline.PageCard",
  version: "1.0.0",
  label: "Page card",
  root: "Canvas",
  formats: { og: { width: 1200, height: 630 } },
  fields: {
    title: prop.text({ label: "Title", required: true, maxLength: 120 }),
    section: prop.choice(SECTIONS, { label: "Section", required: true }),
  },
  // Checked when the card is drawn: nothing past the edges,
  // a font for every character, and a title that fits.
  rules: {
    require: { core: ["image/fit", "image/overflow", "image/glyph"] },
  },
  example: {
    title: "Release notes your team will actually read",
    section: "Product",
  },
  render(v) {
    const p = PALETTES[v.section];
    return (
      <Canvas
        width={1200}
        height={630}
        title={v.title}
        lang="en"
        style={{ backgroundColor: p.bg, fontFamily: "Inter" }}
      >
        <Layer style={{ width: 1200, height: 630 }}>
          {shapes(p)}
          <Column
            style={{
              width: 800,
              height: 630,
              padding: [64, 0, 64, 80],
              justifyContent: "space-between",
            }}
          >
            <Row style={{ alignItems: "center", gap: 16 }}>
              {logo}
              <Text style={{ color: "#ffffff", fontSize: 30, fontWeight: 700 }}>
                Northline
              </Text>
            </Row>
            <Column style={{ gap: 24 }}>
              <Row style={{ alignItems: "center", gap: 12 }}>
                <Svg width={16} height={16} style={{ flex: "none" }}>
                  <Circle cx={8} cy={8} r={8} style={{ fill: p.a }} />
                </Svg>
                <Text
                  field="section"
                  style={{
                    color: "#ffffff",
                    fontSize: 22,
                    fontWeight: 700,
                    letterSpacing: 3,
                    textTransform: "uppercase",
                  }}
                >
                  {v.section}
                </Text>
              </Row>
              {/* The largest of these sizes that keeps the title to four lines. */}
              <Heading
                field="title"
                level={1}
                fit={{ sizes: [72, 64, 56, 48], maxLines: 4 }}
                style={{
                  color: "#ffffff",
                  fontWeight: 700,
                  lineHeight: 1.08,
                  letterSpacing: -1.5,
                }}
              >
                {v.title}
              </Heading>
            </Column>
            <Text style={{ color: p.soft, fontSize: 22 }}>northline.example</Text>
          </Column>
        </Layer>
      </Canvas>
    );
  },
});
```

Four parts of it do the checking:

- **`prop.choice(SECTIONS, …)`** takes only the five section names that have a palette. Any other section is refused before anything is drawn.
- **`maxLength: 120`** refuses a longer title the same way. It counts characters, not width, so it’s a limit on input, not a promise that the title fits.
- **`fit={{ sizes: [72, 64, 56, 48], maxLines: 4 }}`** measures the title with the real fonts and draws it at the largest size that keeps it to four lines. A short title is drawn at 72px; a long one steps down. See [fitted text](/docs/templates/fields#fitted-text).
- **`rules`** makes three measurements required: `image/fit` (the title fits at one of its sizes), `image/overflow` (nothing runs past the card’s edges) and `image/glyph` (the fonts have every character). A card that breaks one of them is an error, so it’s never drawn clipped or with empty boxes. The [rules page](/docs/templates/rules) lists the others.

The logo and the shapes are `Svg` elements in the template, stacked behind the words with a `Layer`, so there are no image files to load. The text column is 800px wide, so the words never run over the shapes. The `example` values are what the template is tested and described with.

## How do I draw a card from a page’s title?

This function takes a page’s title and section and returns PNG bytes. It checks the values with the template’s `check()`, then draws the snapshot it returns with `renderImage()` from `@hyper-elements/react/image`.

`lib/og/render.ts`

```ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { formatDiagnostics } from "@hyper-elements/react";
import { renderImage } from "@hyper-elements/react/image";
import Card from "./card";

const font = (file: string) => readFile(join(process.cwd(), "fonts", file));

export async function renderCard(values: { title: string; section: string }) {
  // Check the values first: a missing title or one past maxLength stops here.
  const checked = Card.check(values, { format: "og" });
  const snapshot = checked.snapshots.og;
  if (!checked.valid || !snapshot) {
    throw new Error(
      `Card for "${values.title}":\n${formatDiagnostics(checked.diagnostics)}`,
    );
  }

  // Draw what was checked. A title that fits at none of its sizes rejects here.
  const { image } = await renderImage(snapshot, {
    fonts: [
      { family: "Inter", src: await font("Inter-Regular.ttf"), weight: 400 },
      { family: "Inter", src: await font("Inter-Bold.ttf"), weight: 700 },
    ],
  });
  return image;
}
```

`check()` doesn’t throw. It returns `valid`, the diagnostics and one snapshot per format, so the function throws itself when the values are refused. The fit and the glyphs can only be measured with the fonts, so `renderImage()` measures them. A design made from a template is always drawn strictly, so a required rule that fails rejects with an `ElementsError` instead of returning a clipped image.

Nothing is fetched while drawing. The fonts are read from disk, and `fontFamily: "Inter"` in the template matches the `family` given here. Text in a weight with no file is an error in a strict design, so both weights the card uses are given.

## Where do the page titles come from?

The cards need each page’s title before any page is rendered, so the titles live in one list that both the pages and the card route read. In a real site, build this list from your CMS or Markdown files.

`lib/pages.ts`

```ts
export type SitePage = {
  path: string;
  title: string;
  description: string;
  section: string;
  /** The page's own social image. Without one, it gets a generated card. */
  image?: string;
};

// Every page on the site, in one list. Load blog posts from your CMS here.
export const pages: SitePage[] = [
  {
    path: "/",
    title: "Release notes your team will actually read",
    description: "Northline turns merged pull requests into release notes.",
    section: "Product",
  },
  {
    path: "/pricing",
    title: "Simple pricing for teams of every size",
    description: "Plans for one project or a hundred.",
    section: "Pricing",
  },
  {
    path: "/docs/quickstart",
    title: "Publish your first release notes in five minutes",
    description: "Connect a repository and publish your first notes.",
    section: "Docs",
  },
  {
    path: "/about",
    title: "About Northline",
    description: "Who builds Northline, and why.",
    section: "Company",
    image: "/images/team.jpg",
  },
  {
    path: "/blog/release-notes-checklist",
    title:
      "The release notes checklist: what customers, support and engineers " +
      "each need from every release",
    description: "What to put in release notes, and what to leave out.",
    section: "Blog",
  },
];

export function pageAt(path: string) {
  const page = pages.find((p) => p.path === path);
  if (!page) throw new Error(`No entry for ${path} in lib/pages.ts`);
  return page;
}

/** A page's card: /og/index.png, /og/pricing.png, /og/blog/<slug>.png */
export function cardPath(path: string) {
  return path === "/" ? "/og/index.png" : `/og${path}.png`;
}
```

The default is a generated card. A page gets one unless its entry has an `image`.

## How do I serve the cards from Next.js?

One catch-all route handler serves every card. `generateStaticParams` names a card for each page without its own image, so Next.js draws them all during `next build` and saves the PNGs with the build.

`app/og/[...path]/route.ts`

```ts
import { cacheLife } from "next/cache";
import { renderCard } from "@/lib/og/render";
import { cardPath, pages } from "@/lib/pages";

// A card for every page without its own image, drawn when the app builds.
export function generateStaticParams() {
  return pages
    .filter((page) => !page.image)
    .map((page) => ({ path: cardPath(page.path).split("/").slice(2) }));
}

async function card(path: string) {
  "use cache";
  cacheLife("max");
  const page = pages.find((p) => !p.image && cardPath(p.path) === path);
  return page ? renderCard({ title: page.title, section: page.section }) : null;
}

export async function GET(
  _request: Request,
  { params }: RouteContext<"/og/[...path]">,
) {
  const { path } = await params;
  const png = await card(`/og/${path.join("/")}`);
  if (!png) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png" },
  });
}
```

<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;margin:0 0 12px"><figure style="margin:0"><img src="/img/blog/nextjs-open-graph-card-home.png" width="1200" height="630" loading="lazy" style="display:block;width:100%;height:auto;border:1px solid var(--line);border-radius:10px" alt="An indigo Northline card with pink, yellow and cyan shapes, the section PRODUCT and the title Release notes your team will actually read."><figcaption style="margin-top:6px;color:var(--text-2);font-size:13px;line-height:1.5"><code>/</code> · Product · 42 characters, drawn at 72px</figcaption></figure><figure style="margin:0"><img src="/img/blog/nextjs-open-graph-card-pricing.png" width="1200" height="630" loading="lazy" style="display:block;width:100%;height:auto;border:1px solid var(--line);border-radius:10px" alt="A green Northline card with lime, yellow and teal shapes, the section PRICING and the title Simple pricing for teams of every size."><figcaption style="margin-top:6px;color:var(--text-2);font-size:13px;line-height:1.5"><code>/pricing</code> · Pricing · 38 characters, drawn at 72px</figcaption></figure><figure style="margin:0"><img src="/img/blog/nextjs-open-graph-card-docs.png" width="1200" height="630" loading="lazy" style="display:block;width:100%;height:auto;border:1px solid var(--line);border-radius:10px" alt="A navy Northline card with blue, violet and pink shapes, the section DOCS and the title Publish your first release notes in five minutes."><figcaption style="margin-top:6px;color:var(--text-2);font-size:13px;line-height:1.5"><code>/docs/quickstart</code> · Docs · 48 characters, drawn at 72px</figcaption></figure><figure style="margin:0"><img src="/img/blog/nextjs-open-graph-card-output.png" width="1200" height="630" loading="lazy" style="display:block;width:100%;height:auto;border:1px solid var(--line);border-radius:10px" alt="A rose Northline card with orange, yellow and pink shapes, the section BLOG and the title The release notes checklist: what customers, support and engineers each need from every release, in four lines."><figcaption style="margin-top:6px;color:var(--text-2);font-size:13px;line-height:1.5"><code>/blog/release-notes-checklist</code> · Blog · 95 characters, drawn at 48px in four lines</figcaption></figure></div>

<p style="margin:0 0 28px;color:var(--text-2);font-size:13px;line-height:1.6">The PNGs this route returned for four pages in the list: one template, four sections. The logo, type and layout are the same on every card; the section picks the colors, and the fit picks the title’s size.</p>

Here is what each part of the route does:

- **`"use cache"`** is what lets Cache Components prerender the response. Without it, `next build` lists the route as dynamic (`ƒ`) and draws each card on request.
- **`cacheLife("max")`** sets how long a cached card lasts. With no `cacheLife`, the default profile revalidates every 15 minutes. The cards only change when you deploy, so `max` is the better fit.
- **The 404** covers any path that isn’t a page’s card, including a page that has its own image. Nothing is drawn for those requests.
- **No `runtime` export.** Satori and resvg need the Node.js runtime, which is the default for route handlers. With Cache Components on, `export const runtime = "nodejs"` fails the build (`Route segment config "runtime" is not compatible with nextConfig.cacheComponents`). With `runtime = "edge"` the build fails too, because the route uses `node:fs`.

If your app doesn’t use Cache Components, delete the `"use cache"` and `cacheLife("max")` lines and their import. `generateStaticParams` alone prerenders the cards then.

`next build` lists each card it drew:

```text
├   /og/[...path]
│ ├ ● /og/index.png
│ ├ ● /og/pricing.png
│ └ ● /og/blog/release-notes-checklist.png
```

### Why not the `opengraph-image.tsx` file convention?

Next.js also generates images from an `opengraph-image.tsx` file in a route segment, and adds the tags for you. It’s a good fit for one dynamic route: `app/blog/[slug]/opengraph-image.tsx` with `generateStaticParams` works with the same `renderCard()`. But the image function receives only the route’s `params`, not the page’s title. Every static page, such as `/pricing`, would need its own file with its own title. A single route handler reading one list covers the whole site.

## How does each page point at its card?

Each page builds its metadata with one function. It uses the page’s own image if there is one, and its card otherwise. It also fills in the card’s size and alt text.

`lib/metadata.ts`

```ts
import type { Metadata } from "next";
import { cardPath, pageAt } from "./pages";

export function metadataFor(path: string): Metadata {
  const page = pageAt(path);
  // The page's own image if it has one; otherwise its generated card.
  const image = page.image
    ? { url: page.image }
    : { url: cardPath(path), width: 1200, height: 630, alt: page.title };
  return {
    title: page.title,
    description: page.description,
    openGraph: {
      type: "website",
      siteName: "Northline",
      title: page.title,
      description: page.description,
      url: path,
      images: [image],
    },
    twitter: { card: "summary_large_image", images: [image] },
  };
}
```

Social sites need absolute image URLs, so set your site’s address as `metadataBase` in the root layout. Next.js resolves the relative `/og/…` paths against it.

`app/layout.tsx`

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://northline.example"),
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

A static page passes its own path:

`app/pricing/page.tsx`

```tsx
import { metadataFor } from "@/lib/metadata";

export const metadata = metadataFor("/pricing");

export default function Pricing() {
  return <h1>Simple pricing for teams of every size</h1>;
}
```

A dynamic route builds the path from its params:

`app/blog/[slug]/page.tsx`

```tsx
import { metadataFor } from "@/lib/metadata";
import { pageAt, pages } from "@/lib/pages";

export function generateStaticParams() {
  return pages
    .filter((page) => page.path.startsWith("/blog/"))
    .map((page) => ({ slug: page.path.slice("/blog/".length) }));
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  return metadataFor(`/blog/${slug}`);
}

export default async function Post({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  return <h1>{pageAt(`/blog/${slug}`).title}</h1>;
}
```

The blog post’s `<head>` then has these image tags, among the title and description ones:

```html
<meta property="og:image" content="https://northline.example/og/blog/release-notes-checklist.png"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:image:alt" content="The release notes checklist: what customers, support and engineers each need from every release"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:image" content="https://northline.example/og/blog/release-notes-checklist.png"/>
```

Next.js merges metadata shallowly: a page that sets `openGraph` replaces its layout’s `openGraph` whole. That’s why `metadataFor()` returns the complete `openGraph` object, not only the image.

A page missing from the list fails the build when its metadata is read (`No entry for /changelog in lib/pages.ts`), so no page ends up without a card by accident.

## How does a page opt out of its card?

Give its entry an `image`. The `/about` page above has one, so `generateStaticParams` skips it, `/og/about.png` returns 404, and its tags point at its own file:

```html
<meta property="og:image" content="https://northline.example/images/team.jpg"/>
<meta name="twitter:image" content="https://northline.example/images/team.jpg"/>
```

Next.js doesn’t know that file’s size, so it writes no width or height tags. Add `width` and `height` to the image object in `metadataFor()` if you want them.

## What happens when a title is too long?

The build stops. A title the card can’t take fails while Next.js prerenders its card, and `next build` exits with status 1. Each case below is the real output of `next build` with that title in `lib/pages.ts`.

A 115-character title is within `maxLength`, but at 48px it takes five lines:

```text
Error occurred prerendering page "/og/blog/release-notes-checklist.png". Read more: https://nextjs.org/docs/messages/prerender-error
Error [ElementsError]: [Elements] The template has 1 error:
error image/fit at root.children[0].children[1].children[1].children[1]: This Heading doesn't fit: it takes 5 lines at 48px, its smallest size, and fits 4: cut about 23 characters (required by northline.PageCard) Fix: Shorten the text, or give the template a smaller size
…
Export encountered an error on /og/[...path]/route: /og/blog/release-notes-checklist.png, exiting the build.
```

A 133-character title is refused by `check()` before it’s measured:

```text
Error: Card for "The complete checklist for writing release notes that customers, support teams, account managers and engineers will all actually read":
error template/value at values.title: Title: is longer than 120 characters
```

An emoji in a title is a character Inter doesn’t have:

```text
error image/glyph at root.children[0].children[1].children[1].children[1]: No font given draws "✨" (emoji): it's drawn as an empty box. Give a font that covers it (required by northline.PageCard)
```

A section the template has no palette for:

```text
Error: Card for "Release notes that people read":
error template/value at values.section: Section: expected one of "Product", "Pricing", "Docs", "Blog", "Company", not "Careers"
```

You can fix it in three places. Shorten the title. Add a shorter `cardTitle` to that page’s entry and pass it to `renderCard()`. Or, if the brand allows it, add a smaller size to the template’s `sizes`. For a character the font lacks, add a font that has it. For a new section, add its palette to `PALETTES`. The “cut about 23 characters” is an estimate: rebuild to confirm the new title fits.

## How do I check the cards?

Look at them before you trust them. In `next dev`, open a card’s URL, such as `http://localhost:3000/og/pricing.png`. The dev server draws it on request, from the same code: the PNG `next dev` served was byte for byte the one `next build` saved.

Check your shortest and longest titles, and titles with accents, names and punctuation you actually publish. Look at one card from each section too, since each has its own colors.

After that, the build guards the rest. Every card is drawn and measured on every build, so a new page whose title can’t fit stops the deploy. It doesn’t publish a clipped image.

Once deployed, open a page’s HTML and confirm its `og:image` URL loads without signing in. Then paste the page’s link into the sharing preview of the site you care about.

## Frequently asked questions

### Do I need an image API or a screenshot service?

No. The cards are drawn inside your build by Satori and resvg, from fonts on disk. No browser is launched, nothing is fetched, and there’s no API key.

### Can this run on the edge runtime?

No. `@hyper-elements/react/image` runs in Node.js only, and the route reads fonts with `node:fs`. Leave the route on the default Node.js runtime.

### When does a card change?

When you change a title in `lib/pages.ts` and build again. Cards are drawn from the list at build time. Under `cacheLife("max")`, Next.js may also redraw a cached card on the server after 30 days, from the same code and fonts. The fonts are traced into the server build, and the engines stay installed as ordinary dependencies.

### Can a card show more than the title?

Yes. Add a field to the template, such as an author or a date, and pass it from the page’s entry. Each new field is something that can vary between pages, so give it its own limits, and keep anything that should look the same everywhere in the template.

Start with `lib/og/card.tsx`: change the colors, logo and fonts to your brand, list your pages, and run `next build` to see every card. The [Next.js guide](/docs/guides/nextjs) covers emails and other outputs in the App Router, and [templates](/docs/templates) covers fields, formats and rules in full.
