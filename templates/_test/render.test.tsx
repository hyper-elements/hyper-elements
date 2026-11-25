/**
 * Every template's example and each of its designs pass its check (its fields and its rules) in every sample brand,
 * and a recreation's in its company's brand too, each design's links moved to that brand's site; and they render: an
 * Email or a Page as HTML, a Document as a PDF with every font and image drawn, a Canvas as an image with its measured
 * rules passed.
 */
import { render } from "@hyper-elements/react";
import { renderImage, templateAssets as imageAssets } from "@hyper-elements/react/image";
import { renderPdf, templateAssets as pdfAssets } from "@hyper-elements/react/pdf";
import { fontFiles, imageFiles } from "../_scripts/assets";
import { brands, companies, templates, valuesIn } from "./discover";

const [sampleBrands, owned, made] = [await brands(), await companies(), await templates()];

const problems = (diagnostics: ReadonlyArray<{ severity: string; code: string; message: string }>) => diagnostics.filter((d) => d.severity === "error").map((d) => `${d.code}: ${d.message}`);

for (const t of made) {
  const own = owned.find((c) => c.id === t.meta.recreates?.company);
  const drawIn = [...(own ? [{ id: `${own.id} (original)`, brand: own.brand }] : []), ...sampleBrands];
  const everyBrand = [...sampleBrands, ...owned].map((b) => b.brand);
  describe(t.key, () => {
    it("has designs", () => expect(t.designs.length).toBeGreaterThan(0));
    it("names its company's brand, for a recreation", () => expect(!t.meta.recreates || !!own, `_companies/${t.meta.recreates?.company}.ts`).toBe(true));
    for (const { id, brand } of drawIn) {
      it(`passes its check in ${id}, with its example and each design`, async () => {
        const tpl = t.make(brand);
        for (const [name, values] of [["example", tpl.example], ...t.designs.map((d) => [d.name, valuesIn(d.values, brand, everyBrand)] as const)] as const) {
          const checked = tpl.check(values);
          expect(problems(checked.diagnostics), `${name} in ${id}`).toEqual([]);
          // A Canvas's measured rules (image/…) are decided when it's drawn, below.
          expect(checked.rules.filter((r) => r.status === "failed" || (r.status === "not-run" && !r.rule.startsWith("image/"))).map((r) => r.rule), `${name}'s rules in ${id}`).toEqual([]);
          const design = tpl.design(values as never);
          if (t.root === "Canvas") {
            const drawn = await renderImage(checked.snapshots.default ?? design, { fonts: fontFiles(brand), images: imageFiles(imageAssets(design).images) });
            expect(problems(drawn.diagnostics), `${name} drawn in ${id}`).toEqual([]);
            continue;
          }
          expect((await render(design)).html.length).toBeGreaterThan(0);
          if (t.root === "Document") {
            const { pdf, diagnostics } = await renderPdf(design, { fonts: fontFiles(brand), images: imageFiles(pdfAssets(design).images) });
            expect(pdf.length).toBeGreaterThan(0);
            expect(diagnostics.filter((d) => d.code === "pdf/font" || d.code === "pdf/image").map((d) => d.message), `what ${name}'s PDF couldn't draw in ${id}`).toEqual([]);
          }
        }
      });
    }
  });
}
