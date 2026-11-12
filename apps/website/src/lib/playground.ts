// The playground's starters: its own (playground/starters/), then the site's examples as they are (examples/, read
// from src/generated/examples.json, which scripts/generate.mjs writes).
import data from "../generated/examples.json";
import engine from "../../../../packages/react/package.json";

export type StarterRoot = "Email" | "Page" | "Document" | "Canvas";

export interface Starter {
  id: string;
  title: string;
  description: string;
  root: StarterRoot;
  group: string;
  source: string;
  /** The example's HTML as the site rendered it, for its thumbnail (the site's examples only). */
  html?: string;
}

const own = import.meta.glob<string>("../../playground/starters/*.tsx", { query: "?raw", import: "default", eager: true });
const ownSource = (id: string) => {
  const source = own[`../../playground/starters/${id}.tsx`];
  if (!source) throw new Error(`No playground starter playground/starters/${id}.tsx`);
  return source.trimEnd() + "\n";
};

type Example = { slug: string; title?: string; description?: string; root?: string; source: string; html: string };
const examples = data as unknown as { showcase: Record<string, Example>; templates: Record<string, Example> };

const fromExample = (example: Example, group: string, said: Partial<Starter> = {}): Starter => ({
  id: example.slug,
  title: example.title ?? example.slug,
  description: example.description ?? "",
  root: (example.root ?? "Email") as StarterRoot,
  group,
  source: example.source.trimEnd() + "\n",
  html: example.html,
  ...said,
});

const GROUPS: Record<StarterRoot, string> = { Email: "Emails", Page: "Pages", Document: "Documents", Canvas: "Images" };
// The gallery's order within each group.
const ORDER = ["oyen-launch", "tarn-shipped", "quarry-welcome", "pith-weekly", "saltworks-invitation", "keel-sign-in-code", "casa-albero-page", "pell-ashby-invoice", "shipwright-ticket", "slow-signals-card", "fernway-spring-sale", "gridline-workshop-banner", "crumb-club-thumbnail", "morning-pages-quote"];
const templates = Object.values(examples.templates).sort((a, b) => ORDER.indexOf(a.slug) - ORDER.indexOf(b.slug));
const byRoot = (root: StarterRoot) => templates.filter((t) => t.root === root).map((t) => fromExample(t, GROUPS[root]));

export const starters: Starter[] = [
  {
    id: "four-outputs",
    title: "One template, four outputs",
    description: "A themed invitation. Switch its root for the email, the page, the PDF and the image.",
    root: "Email",
    group: "Start here",
    source: ownSource("four-outputs"),
  },
  {
    id: "fix-the-diagnostics",
    title: "Fix what the diagnostics say",
    description: "A draft with five mistakes. Each is rejected with what to write instead.",
    root: "Email",
    group: "Start here",
    source: ownSource("fix-the-diagnostics"),
  },
  fromExample(examples.showcase.responsive, "Start here", { id: "phones-and-hover", title: "Phone and hover styles", description: "Columns that stack on phones, a heading that shrinks, a button that darkens under the pointer." }),
  fromExample(examples.showcase.email, "Emails", { id: "launch-email", title: "Product launch", description: "A launch email with a hero image, three features in a Grid, a Social row and a Menu.", root: "Email" }),
  ...byRoot("Email"),
  fromExample(examples.showcase.page, "Pages", { id: "launch-page", title: "Product launch page", description: "The launch as a web page: responsive, with no client JavaScript.", root: "Page" }),
  ...byRoot("Page"),
  fromExample(examples.showcase.document, "Documents", { id: "release-notes", title: "Release notes", description: "A printed document with a header, a footer and page numbers.", root: "Document" }),
  ...byRoot("Document"),
  ...byRoot("Canvas"),
];

export const defaultStarter = starters[0];

/** The engine the playground runs: this repository's, bundled from its sources. */
export const engineVersion: string = engine.version;

/** What the page lists before a starter is opened: everything but the sources. */
export const starterList = starters.map(({ id, title, description, root, group }) => ({ id, title, description, root, group }));
