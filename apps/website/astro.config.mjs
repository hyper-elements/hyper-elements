import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { hyperTheme } from "./src/lib/shiki-theme.mjs";
import playground from "./scripts/playground-integration.mjs";

export default defineConfig({
  site: "https://www.hyperelements.dev",
  trailingSlash: "never",
  build: { format: "directory" },
  // The guide's old address, already on the live site.
  redirects: { "/docs/migrate/elements": "/docs/migrate/unlayer-elements" },
  // The playground's sandbox runtime, served beside its page (scripts/playground-integration.mjs).
  integrations: [sitemap(), playground()],
  markdown: {
    shikiConfig: { theme: hyperTheme, wrap: false },
  },
});
