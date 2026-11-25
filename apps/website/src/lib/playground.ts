// The playground's designs: the site's examples as they are (examples/, read from src/generated/examples.json, which
// scripts/generate.mjs writes). The Design menu lists the ones of the root that's picked. (The API and links call
// them starters: hyperElementsPlayground.starters(), loadStarter(), #starter=.)
import data from "../generated/examples.json";
// The templates (templates/), each as its copyable single file in a sample brand (templates/_scripts/website.tsx).
import gallery from "../generated/gallery.json";
import engine from "../../../../packages/react/package.json";

export type StarterRoot = "Email" | "Page" | "Document" | "Canvas";

export interface Starter {
  id: string;
  title: string;
  description: string;
  root: StarterRoot;
  source: string;
  /** Its HTML as the site rendered it, for its thumbnail in the Design menu. */
  html: string;
  /** A recreation's company (templates/_companies/<company>.ts), whose brand the Brand menu offers for it. */
  company?: string;
}

/** A brand the Brand menu offers: its name, and the block a template's single file holds between its markers. */
export interface PlaygroundBrand {
  id: string;
  name: string;
  block: string;
}

type GalleryTemplate = {
  key: string;
  folder: string;
  root: StarterRoot;
  label: string;
  description: string;
  recreates?: { companyId: string };
  byBrand: Record<string, { views: Record<string, { html?: string }>; single: string }>;
};
const galleryData = gallery as unknown as {
  brands: Array<PlaygroundBrand & { colors: unknown }>;
  companies: Array<PlaygroundBrand & { company: string }>;
  templates: GalleryTemplate[];
};
/** The brand a template opens in: the first sample brand. */
const FIRST_BRAND = galleryData.brands[0]?.id;

/** The sample brands, as the Brand menu offers them. */
export const brands: PlaygroundBrand[] = galleryData.brands.map(({ id, name, block }) => ({ id, name, block }));
/** A real company's brand ("Original (…)"), by company: offered only for its recreations. */
export const companyBrands: Record<string, PlaygroundBrand> = Object.fromEntries(galleryData.companies.map(({ company, id, name, block }) => [company, { id, name, block }]));

/** A template as a starter: its single file in the first sample brand (its company's brand for a recreation). */
function fromGallery(t: GalleryTemplate): Starter {
  const company = t.recreates?.companyId;
  const brand = company ? `${company}-original` : FIRST_BRAND;
  const drawn = t.byBrand[brand] ?? Object.values(t.byBrand)[0];
  const first = drawn?.views ? Object.values(drawn.views)[0] : undefined;
  return {
    id: `template-${t.key.replaceAll("/", "-")}`,
    title: `${t.label} · template`,
    description: t.description,
    root: t.root,
    source: (drawn?.single ?? "").trimEnd() + "\n",
    html: first?.html ?? "",
    ...(company ? { company } : {}),
  };
}

type Example = { slug: string; title?: string; description?: string; root?: string; source: string; html: string };
const examples = data as unknown as { showcase: Record<string, Example>; templates: Record<string, Example> };

const fromExample = (example: Example, said: Partial<Starter> = {}): Starter => ({
  id: example.slug,
  title: example.title ?? example.slug,
  description: example.description ?? "",
  root: (example.root ?? "Email") as StarterRoot,
  source: example.source.trimEnd() + "\n",
  html: example.html,
  ...said,
});

// The order within each root.
const ORDER = ["oyen-launch", "tarn-shipped", "quarry-welcome", "pith-weekly", "saltworks-invitation", "keel-sign-in-code", "casa-albero-page", "pell-ashby-invoice", "shipwright-ticket", "slow-signals-card", "fernway-spring-sale", "gridline-workshop-banner", "crumb-club-thumbnail", "morning-pages-quote"];
const templates = Object.values(examples.templates).sort((a, b) => ORDER.indexOf(a.slug) - ORDER.indexOf(b.slug));
const byRoot = (root: StarterRoot) => templates.filter((t) => t.root === root).map((t) => fromExample(t));

export const starters: Starter[] = [
  fromExample(examples.showcase.email, { id: "launch-email", title: "Product launch", description: "A launch email with a hero image, three features in a Grid, a Social row and a Menu.", root: "Email" }),
  ...byRoot("Email"),
  fromExample(examples.showcase.page, { id: "launch-page", title: "Product launch page", description: "The launch as a web page: responsive, with no client JavaScript.", root: "Page" }),
  ...byRoot("Page"),
  // Pell & Ashby's invoice first: what a Document opens with.
  ...byRoot("Document").filter((starter) => starter.id === "pell-ashby-invoice"),
  fromExample(examples.showcase.document, { id: "growth-report", title: "Growth report", description: "A quarterly board report: three figures, monthly revenue drawn in Svg, a table by region, and a header and page numbers on every page.", root: "Document" }),
  ...byRoot("Document").filter((starter) => starter.id !== "pell-ashby-invoice"),
  ...byRoot("Canvas"),
  // Then the templates, each in a sample brand the Brand menu changes.
  ...galleryData.templates.map(fromGallery),
];

/** What the page opens with: the first design, an Email. Each root starts with its first. */
export const defaultStarter = starters[0];

/** The engine the playground runs: this repository's, bundled from its sources. */
export const engineVersion: string = engine.version;

/** What the page lists before a design is opened: everything but the sources. */
export const starterList = starters.map(({ id, title, description, root, company }) => ({ id, title, description, root, ...(company ? { company } : {}) }));
