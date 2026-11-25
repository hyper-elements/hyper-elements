---
title: "Next.js"
description: "Render emails in Next.js App Router route handlers and Server Components, with output that stays the same from one render to the next."
---

Hyper Elements runs on the server, so it fits the App Router as it is. No client bundle, no extra build step, and for emails, pages and PDFs no entry in `next.config.ts`: Next.js bundles it into your server code like any other package. Images (`@hyper-elements/react/image`) need one, as their engines can't be bundled: `serverExternalPackages: ["@resvg/resvg-js", "satori"]` (see [Image output](/docs/outputs/image#install)). Only the HTML and text strings ever reach the browser.

## A design

A design is a plain component. Nothing in it is specific to Next.js, so the same tree renders from a route handler, a Server Component, a background job or a test.

```tsx
// src/emails/welcome-email.tsx
import { Button, Column, Email, Heading, Text, Span } from "@hyper-elements/react";

export interface WelcomeEmailProps {
  name: string;
  plan: string;
  dashboardUrl: string;
}

export default function WelcomeEmail({ name, plan, dashboardUrl }: WelcomeEmailProps) {
  return (
    <Email width={560} title={`Welcome, ${name}`} previewText={`Your ${plan} workspace is ready, ${name}.`} style={{ backgroundColor: "#f4f4f5", gap: 20 }}>
      <Column style={{ backgroundColor: "#ffffff", padding: [32, 40], gap: 24 }}>
        <Heading level={1} style={{ fontSize: 26 }}>Welcome, {name}</Heading>
        <Text>
          Your <Span style={{ fontWeight: 700 }}>{plan}</Span> workspace is ready.
        </Text>
        <Button href={dashboardUrl} style={{ backgroundColor: "#18181b", borderRadius: 8 }}>
          Open your dashboard
        </Button>
      </Column>
    </Email>
  );
}
```

Props like `name` come from outside: a database row, a webhook, a form. Text passed as children is escaped when Elements writes the HTML. Elements refuses links that run scripts (`javascript:`), but a URL from outside deserves a stricter check of your own, such as allowing absolute `http:` and `https:` URLs only.

## A route handler

Return the rendered HTML from a GET handler. `render()` is async, so the handler is too.

```tsx
// src/app/email-preview/raw/route.ts
import React from "react";
import { render } from "@hyper-elements/react";
import WelcomeEmail from "@/emails/welcome-email";

export async function GET() {
  const { html } = await render(
    React.createElement(WelcomeEmail, {
      name: "Ada",
      plan: "Pro",
      dashboardUrl: "https://example.com/dashboard",
    })
  );

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
```

This is the shape production code usually takes. Swap the `Response` for a call to your provider and you have a send endpoint: see [Sending email](/docs/guides/sending).

## A Server Component

An async Server Component awaits `render()` and passes the strings on. The design never ships to the browser.

```tsx
// src/app/email-preview/page.tsx
import { render } from "@hyper-elements/react";
import WelcomeEmail from "@/emails/welcome-email";
import PreviewDashboard from "./PreviewDashboard";

export default async function EmailPreviewPage() {
  const { html, text } = await render(
    <WelcomeEmail name="Ada" plan="Pro" dashboardUrl="https://example.com/dashboard" />
  );

  return <PreviewDashboard initialHtml={html} initialText={text} />;
}
```

`PreviewDashboard` here is your own Client Component. It receives strings, not React elements.

## A builder design from a route

`toDesign()` from `@hyper-elements/react/builder` works in the same places. It's synchronous:

```ts
// src/app/design/route.ts
import React from "react";
import { toDesign } from "@hyper-elements/react/builder";
import WelcomeEmail from "@/emails/welcome-email";

export function GET() {
  const { design } = toDesign(
    React.createElement(WelcomeEmail, { name: "Ada", plan: "Pro", dashboardUrl: "https://example.com/dashboard" })
  );
  return Response.json(design);
}
```

See [Visual editing](/docs/guides/visual-editor) for what to do with it.

## An edge route

On the edge runtime, a render either works or rejects with an error that tells you to render emails in the Node.js runtime. The cause is React's: react-dom can't render with the React that React Server Components use there. Catch the error and you'll see it:

```ts
// src/app/edge/route.ts
import React from "react";
import { render } from "@hyper-elements/react";
import WelcomeEmail from "@/emails/welcome-email";

export const runtime = "edge";

export async function GET() {
  try {
    const { html } = await render(
      React.createElement(WelcomeEmail, { name: "Ada", plan: "Pro", dashboardUrl: "https://example.com/dashboard" })
    );
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (error) {
    return Response.json({ error: (error as Error).message });
  }
}
```

> **Note:** Next.js 14 can't bundle Elements for the edge runtime. For emails, the Node.js runtime is the safe default on every version.

## An OpenGraph image from a template

A page's social card can be a [template](/docs/templates) drawn by `@hyper-elements/react/image` in an `opengraph-image.tsx` route: the pages `generateStaticParams` names are drawn when the app builds, any other when it's asked for. The template's check runs before anything is drawn. A title past the template's `maxLength` fails the request with the template's diagnostics instead of drawing a broken card.

```tsx
// app/blog/[slug]/opengraph-image.tsx
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { renderImage } from "@hyper-elements/react/image";
import { Card } from "@/lib/card"; // a template: template({ id: "acme.Card", root: "Canvas", fields: { title: … }, … })
import { posts } from "@/lib/posts";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return posts.map((post) => ({ slug: post.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = posts.find((p) => p.slug === slug);
  const font = await readFile(join(process.cwd(), "assets/Inter-Regular.ttf"));
  const { image } = await renderImage(<Card title={post?.title ?? "Not found"} />, { fonts: [{ family: "Inter", src: font }] });
  return new Response(new Uint8Array(image), { headers: { "content-type": "image/png" } });
}
```

The image engines load a native module at run time, so they go in `serverExternalPackages: ["@resvg/resvg-js", "satori"]` in `next.config.ts`. With Cache Components (Next.js 16), a route segment can't export `runtime` (the Node.js runtime is the default), and the drawing goes in a function with `"use cache"` that returns the PNG's bytes, so the pages `generateStaticParams` names are prerendered.

## Prerendering and Cache Components

Since Next.js 16, `create-next-app` turns on Cache Components. Pages and GET route handlers that read no request data are then prerendered when the app builds, and the build fails if one reads a random number or the current date.

Hyper Elements reads neither. A render never leaks into the next one, and the same input always gives the same output. So a route handler or Server Component like the ones above prerenders at build time with no `dynamic` flag and no workaround.

A handler or page that reads request data (a search param, a header) isn't prerendered, and renders per request as usual.

## Tested versions

CI builds a real Next.js app on each version and checks that the route handler and the Server Component each come out as a real email (email tables, not a web layout, with the words in the HTML and the plain text) and as a builder design with its rows:

| Next.js | React | What's checked |
|---|---|---|
| 14 | 18 | Route handler, Server Component |
| 15 (Turbopack) | 19 | Route handler, Server Component, edge route |
| 16, Cache Components on | 19 | Route handler and Server Component, prerendered at build |
