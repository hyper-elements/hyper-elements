/**
 * The website's templates pages' data, `apps/website/src/generated/gallery.json`: every design in every sample brand
 * (and a recreation's company's), as the site's examples are (HTML, plain text, outline, diagnostics, and a Canvas's
 * size), with its code, its brand.ts and its copyable single file. The site writes each HTML preview as a file when
 * it's built (`src/pages/generated/gallery/[preview].html.ts`), draws an image in the visitor's browser
 * (`src/gallery/worker.ts`), and serves the assets from `_assets/` (`scripts/gallery-assets-integration.mjs`). Fails if
 * any design fails, so stale pictures can't ship.
 *
 *   pnpm --filter @hyper-elements/website generate:gallery
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { ReactElement } from "react";
import { outline, render } from "@hyper-elements/react";
import { layoutImage, renderImage, templateAssets as imageAssets } from "@hyper-elements/react/image";
import { inspect } from "@hyper-elements/react/inspect";
import { ASSETS, type Brand } from "../_brand";
import { brands, companies, templates, valuesIn, type RootFolder } from "../_test/discover";
import { ROOT, fontFiles, imageFiles } from "./assets";
import { areasOf, fieldGuide, markBlocks } from "./agent-view";
import { brandBlock, templateFiles } from "./single-file";

const SITE = join(ROOT, "..", "apps", "website");
const DATA = join(SITE, "src", "generated", "gallery.json");
const URL_BASE = "/generated/gallery";
const lines = (ds: ReadonlyArray<{ severity: string; code: string; message: string; path?: string }>) => ds.map(({ severity, code, message, path }) => ({ severity, code, message, ...(path ? { path } : {}) }));


const [owned, made] = [await companies(), await templates()];
// Orbit, the docs' brand, first: what a page shows before a visitor picks one.
const sampleBrands = (await brands()).sort((a, b) => (a.id === "orbit" ? -1 : b.id === "orbit" ? 1 : 0));
const failures: string[] = [];

/** One render of a design, in the shape the site's examples have. `name` is its preview file's, without `.html`. */
async function example(t: { key: string; root: string }, design: ReactElement, name: string, title: string, description: string, brand: Brand) {
  const base = { slug: t.key, title, description, root: t.root, source: "", html: "", text: "", outline: "", diagnostics: [] as ReturnType<typeof lines> };
  if (t.root === "Canvas") {
    const files = { fonts: fontFiles(brand), images: imageFiles(imageAssets(design).images) };
    const { width, height, diagnostics } = await renderImage(design, { ...files, format: "svg" });
    // The agent view: what's bound to a field, and every node's box, to paint over the picture.
    const layout = await layoutImage(design, files);
    const boxes = layout.nodes.map((n) => [n.path, Math.round(n.x), Math.round(n.y), Math.round(n.width), Math.round(n.height)]);
    return { ...base, outline: safeOutline(design), diagnostics: lines(diagnostics), size: [width, height], areas: areasOf(layout.nodes), boxes };
  }
  // An Email, a Page or a Document (its print HTML): the HTML marked with each block's path, and what's bound to a
  // field, for the agent view.
  const out = await render(design, { blockMap: true });
  const html = markBlocks(out.html, out.blocks as never);
  const areas = areasOf((inspect(design as never) as unknown as { nodes: Array<{ path: string; field?: string }> }).nodes);
  return { ...base, html, text: out.text ?? "", outline: safeOutline(design), diagnostics: lines(out.diagnostics), preview: `${URL_BASE}/${name}.html`, areas };
}

function safeOutline(design: unknown): string {
  try {
    return outline(design as never);
  } catch {
    return "";
  }
}

const OUTPUT: Record<RootFolder, string> = { emails: "Email", pages: "Web page", documents: "PDF", images: "Image" };
const data = {
  assets: ASSETS,
  brands: sampleBrands.map(({ id, brand }) => ({ id, name: brand.name, colors: brand.theme.colors, block: brandBlock(join(ROOT, "_brands", `${id}.ts`)) })),
  // The real companies' brands, each shown only with the recreations of its work.
  companies: owned.map(({ id, file, brand }) => ({ company: id, id: `${id}-original`, name: `Original (${brand.name})`, colors: brand.theme.colors, block: brandBlock(file) })),
  templates: [] as unknown[],
};

// A template: each of its designs drawn in each sample brand, through the template made from that brand.
const everyBrand = [...sampleBrands, ...owned].map((b) => b.brand);
for (const t of made) {
  const own = owned.find((c) => c.id === t.meta.recreates?.company);
  const drawIn = [...(own ? [{ id: `${own.id}-original`, brand: own.brand, file: own.file }] : []), ...sampleBrands];
  const byBrand: Record<string, unknown> = {};
  let shown: { label: string; description?: string } | undefined;
  let copies: ReturnType<typeof templateFiles> | undefined;
  for (const { id, brand, file } of drawIn) {
    try {
      const tpl = t.make(brand);
      shown ??= tpl;
      const files = templateFiles(t.file, file, t.designs.map((d) => d.file));
      copies ??= files;
      const views: Record<string, unknown> = {};
      for (const d of t.designs) views[d.name] = await example(t, tpl.design(valuesIn(d.values, brand, everyBrand) as never), `${t.folder}.${t.name}.${d.name}.${id}`, `${d.label}, ${brand.name}`, tpl.description ?? "", brand);
      byBrand[id] = { views, single: files.single, brandFile: files.brand };
    } catch (error) {
      failures.push(`${t.key} in ${id}: ${String((error as Error).message ?? error)}`);
    }
  }
  if (!shown || !copies) continue;
  data.templates.push({
    key: t.key,
    id: t.key,
    folder: t.folder,
    name: t.name,
    output: OUTPUT[t.folder],
    root: t.root,
    label: shown.label,
    description: shown.description ?? "",
    author: t.meta.author ?? "Hyper Elements",
    // A recreation: the company's id and name, what it rebuilds, and where the original can be seen.
    ...(t.meta.recreates && own ? { recreates: { ...t.meta.recreates, companyId: own.id, company: own.brand.name } } : {}),
    file: relative(join(ROOT, ".."), t.file),
    // Each field's label and limits, for the agent view.
    guide: fieldGuide(t.make(drawIn[0]!.brand)),
    // The template as it's written, made from the brand in ./brand; and each design made from it.
    code: copies.code,
    designs: t.designs.map((d) => ({ name: d.name, label: d.label, file: `designs/${d.name}.tsx`, code: copies!.designs[d.file] })),
    byBrand,
  });
}
// In each folder's order, by name.
const FOLDERS = ["emails", "pages", "documents", "images"];
(data.templates as Array<{ folder: string; name: string }>).sort((a, b) => FOLDERS.indexOf(a.folder) - FOLDERS.indexOf(b.folder) || a.name.localeCompare(b.name));

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
mkdirSync(join(DATA, ".."), { recursive: true });
writeFileSync(DATA, JSON.stringify(data) + "\n");

console.log(`${relative(process.cwd(), DATA)}: ${data.templates.length} templates in ${data.brands.length} brands`);
