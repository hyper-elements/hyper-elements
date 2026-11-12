// Draws a few of the site's emails in the email client emulator, for the Email client emulator page and the home page's
// emulator tile: each one's
// preview in each client, opened in Chromium, as a PNG of the email alone.
//
//   pnpm --filter @hyper-elements/website generate:email-clients
//
// Writes public/generated/email-clients/<email>-<preview id>.png. Needs `pnpm build` (packages/react and
// packages/email-clients) and Playwright's Chromium (`npx playwright install chromium`).
//
// To draw with another build of the emulator (a release not yet published, say), point EMAIL_CLIENTS_PACKAGE at its
// packages/email-clients directory (built), and EMAIL_CLIENT_MODELS at the models package it needs. The previews'
// fonts are served from that package's own fonts/ folder, so an unpublished version draws in its fonts too.
import { build } from "esbuild";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cacheDir = join(root, ".cache");
const outDir = join(root, "public/generated/email-clients");

/** The emails shown, and the previews of each: the page's own example, then two templates, then the home page's launch email (its emulator tile). */
const EMAILS = [
  { slug: "welcome", file: "examples/email-clients/welcome.tsx" },
  { slug: "tarn-shipped", file: "examples/templates/tarn-shipped.tsx" },
  { slug: "keel-sign-in-code", file: "examples/templates/keel-sign-in-code.tsx" },
  { slug: "launch", file: "examples/showcase/email.tsx" },
];
const PREVIEWS = ["outlook", "gmail", "apple-mail", "gmail-app"];

const siteRequire = createRequire(join(root, "package.json"));
const packageDir = dirname(siteRequire.resolve("@hyper-elements/react/package.json"));
const elementsRequire = createRequire(join(packageDir, "package.json"));
const clientsDir = process.env.EMAIL_CLIENTS_PACKAGE ? resolve(process.env.EMAIL_CLIENTS_PACKAGE) : dirname(siteRequire.resolve("@hyper-elements/email-clients/package.json"));
const clientsRequire = createRequire(join(clientsDir, "package.json"));
const models = pathToFileURL(process.env.EMAIL_CLIENT_MODELS ? createRequire(join(resolve(process.env.EMAIL_CLIENT_MODELS), "package.json")).resolve("@hyper-elements/email-client-models") : clientsRequire.resolve("@hyper-elements/email-client-models")).href;
const { chromium } = clientsRequire("playwright");

const resolvePlugin = {
  name: "hyper-elements",
  setup(b) {
    b.onResolve({ filter: /^@hyper-elements\/react$/ }, () => ({ path: join(packageDir, "dist/primitives.cjs") }));
    b.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, ({ path }) => ({ path: elementsRequire.resolve(path) }));
    b.onResolve({ filter: /^@hyper-elements\/email-clients$/ }, () => ({ path: join(clientsDir, "dist/index.js") }));
    b.onResolve({ filter: /^@hyper-elements\/email-client-models$/ }, () => ({ path: models, external: true }));
  },
};

/** The email's previews, from renderInEmailClients(), in the clients PREVIEWS names. */
async function previewsOf({ slug, file }) {
  const entry = join(cacheDir, `email-clients-${slug}.entry.tsx`);
  await writeFile(
    entry,
    [
      `import Example from ${JSON.stringify(join(root, file))};`,
      `import { renderInEmailClients } from "@hyper-elements/email-clients";`,
      `export const run = () => renderInEmailClients(<Example />, {`,
      `  emailClients: ["outlook", "gmail", "apple-mail", "gmail-app"], computers: ["windows"],`,
      `});`,
    ].join("\n"),
  );
  const bundle = join(cacheDir, `email-clients-${slug}.cjs`);
  await build({ entryPoints: [entry], outfile: bundle, bundle: true, platform: "node", format: "cjs", jsx: "automatic", logLevel: "warning", plugins: [resolvePlugin] });
  const { previews } = await createRequire(import.meta.url)(bundle).run();
  return PREVIEWS.map((id) => {
    const preview = previews.find((p) => p.id === id);
    if (!preview) throw new Error(`${file} has no ${id} preview`);
    return preview;
  });
}

await mkdir(cacheDir, { recursive: true });
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
// The package's fonts, from its own folder: what fonts: "url" would load from the CDN once it's published.
await page.route(/^https:\/\/cdn\.jsdelivr\.net\/npm\/@hyper-elements\/email-clients@[^/]+\/fonts\/([^/?#]+)/, async (route) => {
  const file = new URL(route.request().url()).pathname.split("/").pop();
  await route.fulfill({ path: join(clientsDir, "fonts", file), contentType: "font/woff2" });
});
for (const email of EMAILS) {
  for (const preview of await previewsOf(email)) {
    await page.setContent(preview.html);
    await page.waitForSelector("html[data-email-client-ready]");
    const state = await page.getAttribute("html", "data-email-client-ready");
    if (state !== "ok") {
      const findings = JSON.parse(await page.textContent("#email-client-findings"));
      throw new Error(`${email.slug} in ${preview.id}: the preview is ${state}: ${JSON.stringify(findings.missing ?? findings.error)}`);
    }
    // The preview's frame for the email, as tall as the email.
    const frame = await page.evaluateHandle(`(() => {
      const frame = [...document.querySelectorAll("main iframe")].find((f) => f.getBoundingClientRect().width > 0);
      const doc = frame.contentDocument;
      frame.style.height = "1px";
      frame.style.height = Math.ceil(Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight)) + "px";
      return frame;
    })()`);
    const name = `${email.slug}-${preview.id}.png`;
    await frame.asElement().screenshot({ path: join(outDir, name) });
    console.log(`public/generated/email-clients/${name}`);
  }
}
await browser.close();
