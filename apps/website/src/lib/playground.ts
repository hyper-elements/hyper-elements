// The playground's templates: the site's examples as they are (examples/, read from src/generated/examples.json, which
// scripts/generate.mjs writes). The Template menu lists the ones of the root that's picked. (The API and links call
// them starters: hyperElementsPlayground.starters(), loadStarter(), #starter=.)
import data from "../generated/examples.json";
import engine from "../../../../packages/react/package.json";

export type StarterRoot = "Email" | "Page" | "Document" | "Canvas";

export interface Starter {
  id: string;
  title: string;
  description: string;
  root: StarterRoot;
  source: string;
  /** Its HTML as the site rendered it, for its thumbnail in the Template menu. */
  html: string;
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
  fromExample(examples.showcase.document, { id: "release-notes", title: "Release notes", description: "A printed document with a header, a footer and page numbers.", root: "Document" }),
  ...byRoot("Document").filter((starter) => starter.id !== "pell-ashby-invoice"),
  ...byRoot("Canvas"),
];

/** What the page opens with: the first template, an Email. Each root starts with its first. */
export const defaultStarter = starters[0];

/** The engine the playground runs: this repository's, bundled from its sources. */
export const engineVersion: string = engine.version;

/** What the page lists before a template is opened: everything but the sources. */
export const starterList = starters.map(({ id, title, description, root }) => ({ id, title, description, root }));
