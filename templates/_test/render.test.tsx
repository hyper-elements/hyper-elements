/**
 * Every design draws in every sample brand, and a recreation in its company's brand too: an Email or a Page as HTML, a
 * Document as print HTML and a PDF, and a Canvas as an image. A design that can't is an error here.
 */
import { render } from "@hyper-elements/react";
import { renderImage, templateAssets as imageAssets } from "@hyper-elements/react/image";
import { renderPdf, templateAssets as pdfAssets } from "@hyper-elements/react/pdf";
import { fontFiles, imageFiles } from "../_scripts/assets";
import { brands, companies, designs } from "./discover";

const [all, sampleBrands, owned] = [await designs(), await brands(), await companies()];

for (const t of all) {
  const own = owned.find((c) => c.id === t.meta.recreates?.company);
  const drawIn = [...(own ? [{ id: `${own.id} (original)`, brand: own.brand }] : []), ...sampleBrands];
  describe(t.key, () => {
    for (const { id, brand } of drawIn) {
      it(`renders in ${id}`, async () => {
        const design = <t.Design brand={brand} />;
        if (t.root === "Canvas") {
          const { image } = await renderImage(design, { fonts: fontFiles(brand), images: imageFiles(imageAssets(design).images) });
          expect(image.length).toBeGreaterThan(0);
          return;
        }
        const { html } = await render(design);
        expect(html.length).toBeGreaterThan(0);
        if (t.root === "Document") {
          const { pdf } = await renderPdf(design, { fonts: fontFiles(brand), images: imageFiles(pdfAssets(design).images) });
          expect(pdf.length).toBeGreaterThan(0);
        }
      });
    }
  });
}
