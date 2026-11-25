// The social cards: the Open Graph image of every page that gives none of its own (src/layouts/Base.astro links such
// a page to /og/cards/<its path>.png). Each is the card template's (src/og/card.tsx), checked with the page's title
// and section, and drawn with renderImage(), from this repository's sources, as the playground's engine is: the site
// builds without `pnpm build`.
//
// `astro build` draws a card for each built page that links to one, into dist/og/cards/, and fails if a page's title
// doesn't fit its card. `astro dev` draws one when it's asked for, from the page's title as the dev server writes it.
import { build } from "esbuild";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { CARDS, cardPage, cardValues } from "../src/og/cards.mjs";
import { SOURCES } from "./playground-runtime.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fonts = join(root, "src/og/fonts");
/** The bundle's place: under the website's node_modules, so React and the image engines it leaves out are the website's. */
const outDir = join(root, "node_modules/.cache/og-cards");

/** A page's title on its card: its og:title without the brand Base.astro adds after it. */
const SUFFIX = " · Hyper Elements";

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (text) =>
  text.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (whole, name) =>
    name[0] === "#" ? String.fromCodePoint(name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1))) : (ENTITIES[name.toLowerCase()] ?? whole),
  );
const meta = (html, property) => {
  const found = html.match(new RegExp(`<meta property="${property}" content="([^"]*)"`));
  return found ? decode(found[1]) : undefined;
};

/** The card a built page links to, with what it says; none for a page that gives its own image. */
function cardOf(html, site) {
  const image = meta(html, "og:image");
  if (!image?.startsWith(new URL(CARDS, site).href)) return undefined;
  const path = new URL(image).pathname;
  const full = meta(html, "og:title") ?? "";
  const { title, kicker } = cardValues(cardPage(path), full.endsWith(SUFFIX) ? full.slice(0, -SUFFIX.length) : full);
  return { path, values: { title, kicker } };
}

/** src/og/render.tsx, bundled from the packages' sources and loaded. Bundled again for each dev request when `fresh`. */
async function renderer({ fresh = false } = {}) {
  const outfile = join(outDir, fresh ? `render-${Date.now()}.mjs` : "render.mjs");
  await build({
    entryPoints: [join(root, "src/og/render.tsx")],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    jsx: "automatic",
    logLevel: "warning",
    // One React, the website's; Satori and resvg load their own WebAssembly and native module from their packages.
    external: ["react", "react/*", "react-dom", "react-dom/*", "satori", "@resvg/resvg-js"],
    define: { __HYPER_ELEMENTS_CJS__: "false" },
    plugins: [
      {
        name: "hyper-elements-sources",
        setup(b) {
          b.onResolve({ filter: /^@hyper-elements\/(react|core)(\/.*)?$/ }, ({ path }) => (SOURCES[path] ? { path: SOURCES[path] } : undefined));
        },
      },
    ],
  });
  const module = await import(pathToFileURL(outfile).href);
  // A dev request's bundle is loaded once: it isn't kept.
  if (fresh) await rm(outfile, { force: true });
  return { renderCard: module.renderCard, fonts: await module.loadFonts(fonts) };
}

async function* htmlFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(path);
    else if (entry.name.endsWith(".html")) yield path;
  }
}

export default function ogCards() {
  let site;
  return {
    name: "hyper-elements-og-cards",
    hooks: {
      "astro:config:done": ({ config }) => {
        site = config.site;
      },
      "astro:server:setup": ({ server }) => {
        server.middlewares.use(async (request, response, next) => {
          const path = (request.url ?? "").split("?")[0];
          if (!path.startsWith(CARDS) || !path.endsWith(".png") || path.includes("..")) return next();
          try {
            const page = await fetch(new URL(cardPage(path), `http://${request.headers.host}`));
            if (!page.ok) return next();
            const card = cardOf(await page.text(), site);
            if (!card || card.path !== path) return next();
            const { renderCard, fonts: faces } = await renderer({ fresh: true });
            response.setHeader("content-type", "image/png");
            response.setHeader("cache-control", "no-store");
            response.end(await renderCard(card.values, faces));
          } catch (error) {
            response.statusCode = 500;
            response.end(String(error?.message ?? error));
          }
        });
      },
      "astro:build:done": async ({ dir, logger }) => {
        const dist = fileURLToPath(dir);
        const cards = new Map();
        for await (const file of htmlFiles(dist)) {
          const card = cardOf(await readFile(file, "utf8"), site);
          if (card && !cards.has(card.path)) cards.set(card.path, { ...card, page: relative(dist, file) });
        }
        const { renderCard, fonts: faces } = await renderer();
        const failed = [];
        for (const { path, values, page } of cards.values()) {
          try {
            const out = join(dist, path);
            await mkdir(dirname(out), { recursive: true });
            await writeFile(out, await renderCard(values, faces));
          } catch (error) {
            failed.push(`${page}: ${error.message}`);
          }
        }
        if (failed.length) throw new Error(`${failed.length} social card${failed.length === 1 ? "" : "s"} can't be drawn:\n\n${failed.join("\n\n")}`);
        logger.info(`${cards.size} social cards drawn in ${CARDS}`);
      },
    },
  };
}
