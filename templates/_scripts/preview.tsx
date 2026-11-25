/**
 * Templates' designs in every sample brand, to look at before a pull request: each design's HTML (or PNG, for an
 * image) in `templates/.preview/`, with an `index.html` that shows them side by side. Name root folders or templates to
 * draw only those; with none, it draws every one. Asset addresses point at this checkout's files, so nothing is fetched
 * from the live site.
 *
 *   pnpm --filter ./templates preview [emails | emails/sign-in-code …]
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { render } from "@hyper-elements/react";
import { renderImage, templateAssets } from "@hyper-elements/react/image";
import { ASSETS } from "../_brand";
import { brands, companies, templates, valuesIn } from "../_test/discover";
import { ASSET_DIR, ROOT, fontFiles, imageFiles } from "./assets";

const asked = process.argv.slice(2);
const out = join(ROOT, ".preview");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const local = (html: string) => html.replaceAll(ASSETS, `${pathToFileURL(ASSET_DIR).href}/`);
const cells: string[] = [];
const [sampleBrands, owned] = [await brands(), await companies()];
const everyBrand = [...sampleBrands, ...owned].map((b) => b.brand);

const chosen = (await templates()).filter((t) => !asked.length || asked.some((a) => a === t.folder || a === t.key));
if (!chosen.length) throw new Error(`no template is ${asked.join(" or ")}: name a root folder (emails) or a template (emails/sign-in-code)`);
for (const t of chosen) {
  const own = owned.find((c) => c.id === t.meta.recreates?.company);
  for (const d of t.designs) {
    cells.push(`<h2>${t.key}: ${d.label}</h2><div class="row">`);
    for (const { id, brand } of [...(own ? [own] : []), ...sampleBrands]) {
      const design = t.make(brand).design(valuesIn(d.values, brand, everyBrand) as never);
      const name = `${t.folder}.${t.name}.${d.name}.${id}`;
      if (t.root === "Canvas") {
        const { image } = await renderImage(design, { fonts: fontFiles(brand), images: imageFiles(templateAssets(design).images) });
        writeFileSync(join(out, `${name}.png`), image);
        cells.push(`<figure><img src="${name}.png" width="360"><figcaption>${brand.name}</figcaption></figure>`);
      } else {
        const { html } = await render(design);
        writeFileSync(join(out, `${name}.html`), local(html));
        cells.push(`<figure><iframe src="${name}.html" width="420" height="640"></iframe><figcaption>${brand.name}</figcaption></figure>`);
      }
    }
    cells.push("</div>");
  }
}

writeFileSync(
  join(out, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Templates</title><style>body{font:14px system-ui;margin:24px;background:#f4f4f5}.row{display:flex;flex-wrap:wrap;gap:16px}figure{margin:0}iframe,img{border:1px solid #d4d4d8;background:#fff}</style><h1>Templates</h1>${cells.join("\n")}`,
);
console.log(relative(process.cwd(), join(out, "index.html")));
