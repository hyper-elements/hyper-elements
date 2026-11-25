import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { hyperTheme } from "./src/lib/shiki-theme.mjs";
import playground from "./scripts/playground-integration.mjs";
import ogCards from "./scripts/og-cards.mjs";
import ogImage from "./scripts/og-image-integration.mjs";
import galleryAssets from "./scripts/gallery-assets-integration.mjs";

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
    // The designs gallery was /templates/<slug>: each design opens in the playground, with its code.
    "/templates/oyen-launch": "/playground#starter=oyen-launch",
    "/templates/tarn-shipped": "/playground#starter=tarn-shipped",
    "/templates/quarry-welcome": "/playground#starter=quarry-welcome",
    "/templates/pith-weekly": "/playground#starter=pith-weekly",
    "/templates/saltworks-invitation": "/playground#starter=saltworks-invitation",
    "/templates/keel-sign-in-code": "/playground#starter=keel-sign-in-code",
    "/templates/casa-albero-page": "/playground#starter=casa-albero-page",
    "/templates/pell-ashby-invoice": "/playground#starter=pell-ashby-invoice",
    "/templates/shipwright-ticket": "/playground#starter=shipwright-ticket",
    "/templates/slow-signals-card": "/playground#starter=slow-signals-card",
    "/templates/fernway-spring-sale": "/playground#starter=fernway-spring-sale",
    "/templates/gridline-workshop-banner": "/playground#starter=gridline-workshop-banner",
    "/templates/crumb-club-thumbnail": "/playground#starter=crumb-club-thumbnail",
    "/templates/morning-pages-quote": "/playground#starter=morning-pages-quote",
  },
  // The playground's sandbox runtime, served beside its page (scripts/playground-integration.mjs), the social card of
  // each page with no image of its own (scripts/og-cards.mjs), and the Open Graph image generator's worker
  // (scripts/og-image-integration.mjs).
  integrations: [sitemap(), playground(), ogCards(), ogImage(), galleryAssets()],
  markdown: {
    shikiConfig: { theme: hyperTheme, wrap: false },
  },
});
