/**
 * A kit in every sample brand, to look at before a pull request: each design's HTML (or PNG, for an image) in
 * `templates/.preview/<kit>/`, with an `index.html` that shows them side by side. Asset addresses point at this checkout's
 * files, so nothing is fetched from the live site.
 *
 *   pnpm --filter ./templates preview <kit>
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { render } from "@hyper-elements/react";
import { renderImage, templateAssets } from "@hyper-elements/react/image";
import { ASSETS } from "../_brand";
import { brands, designs } from "../_test/discover";
import { ASSET_DIR, ROOT, fontFiles, imageFiles } from "./assets";

const kit = process.argv[2];
if (!kit) throw new Error("usage: preview <kit>");
const out = join(ROOT, ".preview", kit);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const local = (html: string) => html.replaceAll(ASSETS, `${pathToFileURL(ASSET_DIR).href}/`);
const cells: string[] = [];

for (const t of (await designs()).filter((x) => x.kit === kit)) {
  cells.push(`<h2>${t.folder}/${t.category}</h2><div class="row">`);
  for (const { id, brand } of await brands()) {
    const design = <t.Design brand={brand} />;
    const name = `${t.folder}.${t.category}.${id}`;
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

writeFileSync(
  join(out, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>${kit}</title><style>body{font:14px system-ui;margin:24px;background:#f4f4f5}.row{display:flex;flex-wrap:wrap;gap:16px}figure{margin:0}iframe,img{border:1px solid #d4d4d8;background:#fff}</style><h1>${kit}</h1>${cells.join("\n")}`,
);
console.log(relative(process.cwd(), join(out, "index.html")));
