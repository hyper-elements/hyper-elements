import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const docs = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/docs" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    /** The browser tab's and search results' title, where it differs from the page's heading. */
    metaTitle: z.string().optional(),
  }),
});

/** One page per element, split from the package's own REFERENCE.md by scripts/generate.mjs. */
const reference = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/generated/reference" }),
  schema: z.object({
    title: z.string(),
    group: z.string(),
    order: z.number(),
    summary: z.string(),
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    date: z.coerce.date(),
    /** The post's picture, shown in it and on the blog's index, and its social image. Without one, its social image is its generated card. */
    hero: z.string().optional(),
    heroAlt: z.string().optional(),
  }).refine((post) => !post.hero || post.heroAlt, { message: "A post with a hero needs its heroAlt", path: ["heroAlt"] }),
});

export const collections = { docs, reference, blog };
