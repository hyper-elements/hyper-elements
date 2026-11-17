import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { hyperTheme } from "./src/lib/shiki-theme.mjs";
import playground from "./scripts/playground-integration.mjs";

export default defineConfig({
  site: "https://www.hyperelements.dev",
  trailingSlash: "never",
  build: { format: "directory" },
  // Old addresses: those already on the live site, and the templates pages' first ones.
  redirects: {
    "/docs/migrate/elements": "/docs/migrate/unlayer-elements",
    // The Custom elements page was /docs/custom-components, then /docs/defining-elements.
    "/docs/custom-components": "/docs/custom-elements",
    "/docs/defining-elements": "/docs/custom-elements",
    // The elements gallery was /components, and the element pages were under /docs/components.
    "/components": "/elements",
    "/docs/components": "/docs/elements",
    "/docs/components/[name]": "/docs/elements/[name]",
    // The templates pages were under /docs/guides. (/docs/templates itself was the Designs page, now /docs/designs:
    // it's the Templates page now, so it can't redirect.)
    "/docs/guides/templates": "/docs/templates",
    "/docs/guides/templates-examples": "/docs/templates/examples",
    "/docs/guides/templates-fields": "/docs/templates/fields",
    "/docs/guides/templates-slots": "/docs/templates/slots",
    "/docs/guides/templates-checks": "/docs/templates/rules",
    "/docs/guides/templates-cli": "/docs/templates/cli",
  },
  // The playground's sandbox runtime, served beside its page (scripts/playground-integration.mjs).
  integrations: [sitemap(), playground()],
  markdown: {
    shikiConfig: { theme: hyperTheme, wrap: false },
  },
});
