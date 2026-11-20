/**
 * The website's templates pages' data: every design in every sample brand (and a recreation's company's), as the site's
 * examples are (HTML, plain text, outline, diagnostics, and a Document's PDF or a Canvas's PNG), with its code, its
 * brand.ts and its copyable single file. A Canvas's PNG and a Document's PDF are files of their own; an HTML preview is
 * written as a file when the site is built (`src/pages/generated/gallery/[preview].html.ts`), from the HTML here. Writes `apps/website/src/generated/gallery.json` and `apps/website/public/generated/gallery/`, and deletes only those.
 * The folder's assets are served from `_assets/` by the site itself (`apps/website/scripts/gallery-assets-integration.mjs`). Fails if any design fails, so stale pictures can't ship.
 *
 *   pnpm --filter @hyper-elements/website generate:gallery
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { outline, render } from "@hyper-elements/react";
import { renderImage, templateAssets as imageAssets } from "@hyper-elements/react/image";
import { renderPdf, templateAssets as pdfAssets } from "@hyper-elements/react/pdf";
import { ASSETS, type Brand } from "../_brand";
import { brands, companies, designs, type RootFolder } from "../_test/discover";
import { ROOT, fontFiles, imageFiles } from "./assets";
import { brandBlock, singleFile, splitFiles } from "./single-file";

const SITE = join(ROOT, "..", "apps", "website");
const PUBLIC = join(SITE, "public", "generated", "gallery");
const DATA = join(SITE, "src", "generated", "gallery.json");
const URL_BASE = "/generated/gallery";
const lines = (ds: ReadonlyArray<{ severity: string; code: string; message: string; path?: string }>) => ds.map(({ severity, code, message, path }) => ({ severity, code, message, ...(path ? { path } : {}) }));

rmSync(PUBLIC, { recursive: true, force: true });
mkdirSync(PUBLIC, { recursive: true });

const [all, owned] = [await designs(), await companies()];
// Orbit, the docs' brand, first: what a page shows before a visitor picks one.
const sampleBrands = (await brands()).sort((a, b) => (a.id === "orbit" ? -1 : b.id === "orbit" ? 1 : 0));
const failures: string[] = [];

/** One render of a design, in the shape the site's examples have. */
async function example(t: (typeof all)[number], brandId: string, brand: Brand) {
  const design = <t.Design brand={brand} />;
  const name = `${t.folder}.${t.name}.${brandId}`;
  const base = { slug: t.key, title: `${t.meta.label}, ${brand.name}`, description: t.meta.description, root: t.root, source: "", html: "", text: "", outline: "", diagnostics: [] as ReturnType<typeof lines> };
  if (t.root === "Canvas") {
    const { image, diagnostics } = await renderImage(design, { fonts: fontFiles(brand), images: imageFiles(imageAssets(design).images) });
    writeFileSync(join(PUBLIC, `${name}.png`), image);
    return { ...base, outline: safeOutline(design), diagnostics: lines(diagnostics), file: `${URL_BASE}/${name}.png`, preview: `${URL_BASE}/${name}.png` };
  }
  const out = await render(design);
  const result = { ...base, html: out.html, text: out.text ?? "", outline: safeOutline(design), diagnostics: lines(out.diagnostics), preview: `${URL_BASE}/${name}.html` };
  if (t.root !== "Document") return result;
  const pdf = await renderPdf(design, { fonts: fontFiles(brand), images: imageFiles(pdfAssets(design).images) });
  writeFileSync(join(PUBLIC, `${name}.pdf`), pdf.pdf);
  return { ...result, diagnostics: lines([...out.diagnostics, ...pdf.diagnostics]), file: `${URL_BASE}/${name}.pdf` };
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

for (const t of all) {
  const own = owned.find((c) => c.id === t.meta.recreates?.company);
  const drawIn = [...(own ? [{ id: `${own.id}-original`, brand: own.brand, file: own.file }] : []), ...sampleBrands];
  const byBrand: Record<string, unknown> = {};
  for (const { id, brand, file } of drawIn) {
    try {
      byBrand[id] = { views: { default: await example(t, id, brand) }, single: singleFile(t.file, file), brandFile: splitFiles(t.file, file).brand };
    } catch (error) {
      failures.push(`${t.key} in ${id}: ${String((error as Error).message ?? error)}`);
    }
  }
  data.templates.push({
    key: t.key,
    id: t.key,
    folder: t.folder,
    name: t.name,
    output: OUTPUT[t.folder],
    root: t.root,
    label: t.meta.label,
    description: t.meta.description,
    author: t.meta.author ?? "Hyper Elements",
    // A recreation: the company's id and name, what it rebuilds, and where the original can be seen.
    ...(t.meta.recreates && own ? { recreates: { ...t.meta.recreates, companyId: own.id, company: own.brand.name } } : {}),
    formats: [],
    file: relative(join(ROOT, ".."), t.file),
    // The design as it's written: the same in every brand, taking its brand's type from ./brand.
    code: splitFiles(t.file, drawIn[0].file).code,
    byBrand,
  });
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
mkdirSync(join(DATA, ".."), { recursive: true });
writeFileSync(DATA, JSON.stringify(data) + "\n");

console.log(`${relative(process.cwd(), DATA)}: ${data.templates.length} designs in ${data.brands.length} brands`);
