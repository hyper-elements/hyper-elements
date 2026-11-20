/**
 * The website's templates pages' data: every design in every sample brand (and a recreation kit's own), as the site's
 * examples are (HTML, plain text, outline, diagnostics, and a Document's PDF or a Canvas's PNG), with its code, its
 * brand.ts and its copyable single file. Each preview is also a file of its own (HTML, or a Canvas's PNG), which the gallery
 * loads when a visitor picks another brand. Writes `apps/website/src/generated/kits.json` and `apps/website/public/generated/kits/`, the
 * folder's assets copied under it, and deletes only those. Fails if any design fails, so stale pictures can't ship.
 *
 *   pnpm --filter @hyper-elements/website generate:kits
 */
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { outline, render } from "@hyper-elements/react";
import { renderImage, templateAssets as imageAssets } from "@hyper-elements/react/image";
import { renderPdf, templateAssets as pdfAssets } from "@hyper-elements/react/pdf";
import { ASSETS, type Brand } from "../_brand";
import { brands, categories, designs, kits, type RootFolder } from "../_test/discover";
import { ASSET_DIR, ROOT, fontFiles, imageFiles } from "./assets";
import { brandBlock, singleFile, splitFiles } from "./single-file";

const SITE = join(ROOT, "..", "apps", "website");
const PUBLIC = join(SITE, "public", "generated", "kits");
const DATA = join(SITE, "src", "generated", "kits.json");
const URL_BASE = "/generated/kits";
const lines = (ds: ReadonlyArray<{ severity: string; code: string; message: string; path?: string }>) => ds.map(({ severity, code, message, path }) => ({ severity, code, message, ...(path ? { path } : {}) }));

rmSync(PUBLIC, { recursive: true, force: true });
mkdirSync(PUBLIC, { recursive: true });
cpSync(ASSET_DIR, join(PUBLIC, "assets"), { recursive: true });

const [all, cats, kitList] = [await designs(), await categories(), await kits()];
// Orbit, the docs' brand, first: what a page shows before a visitor picks one.
const sampleBrands = (await brands()).sort((a, b) => (a.id === "orbit" ? -1 : b.id === "orbit" ? 1 : 0));
const failures: string[] = [];

/** One render of a design, in the shape the site's examples have. */
async function example(t: (typeof all)[number], brandId: string, brand: Brand) {
  const design = <t.Design brand={brand} />;
  const name = `${t.kit}.${t.folder}.${t.category}.${brandId}`;
  const base = { slug: t.key, title: `${t.meta.label}, ${brand.name}`, description: t.meta.description, root: t.root, source: "", html: "", text: "", outline: "", diagnostics: [] as ReturnType<typeof lines> };
  if (t.root === "Canvas") {
    const { image, diagnostics } = await renderImage(design, { fonts: fontFiles(brand), images: imageFiles(imageAssets(design).images) });
    writeFileSync(join(PUBLIC, `${name}.png`), image);
    return { ...base, outline: safeOutline(design), diagnostics: lines(diagnostics), file: `${URL_BASE}/${name}.png`, preview: `${URL_BASE}/${name}.png` };
  }
  const out = await render(design);
  writeFileSync(join(PUBLIC, `${name}.html`), previewHtml(out.html));
  const result = { ...base, html: out.html, text: out.text ?? "", outline: safeOutline(design), diagnostics: lines(out.diagnostics), preview: `${URL_BASE}/${name}.html` };
  if (t.root !== "Document") return result;
  const pdf = await renderPdf(design, { fonts: fontFiles(brand), images: imageFiles(pdfAssets(design).images) });
  writeFileSync(join(PUBLIC, `${name}.pdf`), pdf.pdf);
  return { ...result, diagnostics: lines([...out.diagnostics, ...pdf.diagnostics]), file: `${URL_BASE}/${name}.pdf` };
}

/** As the site's previewHtml() (apps/website/src/lib/examples.ts): images and assets load from the site that shows them. */
const previewHtml = (html: string) =>
  html.replaceAll("https://hyperelements.dev/img/", "/img/").replaceAll("https://hyperelements.dev/generated/kits/assets/", "/generated/kits/assets/");

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
  categories: Object.fromEntries(cats.map(({ id, category }) => [id, { label: category.label, group: category.group, useWhen: category.useWhen, avoidWhen: category.avoidWhen, roots: category.roots }])),
  kits: kitList.map(({ id, kit, brand }) => ({ id, ...kit, ...(brand ? { brand: { id: `${id}-original`, name: `Original (${kit.recreates?.company ?? brand.name})`, colors: brand.theme.colors, block: brandBlock(join(ROOT, id, "brand.ts")) } } : {}) })),
  templates: [] as unknown[],
};

for (const t of all) {
  const own = kitList.find((k) => k.id === t.kit)?.brand;
  const drawIn = own ? [{ id: `${t.kit}-original`, brand: own, file: join(ROOT, t.kit, "brand.ts") }, ...sampleBrands.map((b) => ({ ...b, file: join(ROOT, "_brands", `${b.id}.ts`) }))] : sampleBrands.map((b) => ({ ...b, file: join(ROOT, "_brands", `${b.id}.ts`) }));
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
    kit: t.kit,
    folder: t.folder,
    output: OUTPUT[t.folder],
    root: t.root,
    category: t.category,
    label: t.meta.label,
    description: t.meta.description,
    author: t.meta.author ?? kitList.find((k) => k.id === t.kit)!.kit.author,
    ...(t.meta.recreates ? { recreates: { company: kitList.find((k) => k.id === t.kit)!.kit.recreates?.company ?? "", ...t.meta.recreates } } : {}),
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
