/**
 * Every design, in every sample brand (and a recreation kit's own), by its root's path:
 *
 * - Email, Page: render(). An Email renders with the email client checks, and both with the lint rules.
 * - Document: render() for print HTML, then renderPdf() with the brand's fonts and the images it names.
 * - Canvas: renderImage() with the fonts and images, and layoutImage(), strict, for what doesn't fit.
 *
 * And for each: the neutral and pair checks with the probe brands, the contrast check with the real brand, a brand of the
 * contract's tokens only, no other brand's name or site in it, and a baseline of what was written.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { render, validate, type Diagnostic } from "@hyper-elements/react";
import { layoutImage, renderImage, templateAssets as imageAssets } from "@hyper-elements/react/image";
import { renderPdf, templateAssets as pdfAssets } from "@hyper-elements/react/pdf";
import { emailClients } from "@hyper-elements/email-clients";
import { lint } from "@hyper-elements/lint";
import type { Brand } from "../_brand";
import { ROOT, fontFiles, imageFiles } from "../_scripts/assets";
import { checker, type Finding } from "./checks";
import { brands, categories, designs, kits } from "./discover";
import { PROBES, contractOnly, tokenNames } from "./probes";
import { treeFacts } from "./tree";

const UPDATE = process.env.UPDATE_TEMPLATES === "1";
const BASELINE = join(ROOT, "_test", "__baseline__");
/** The email client warnings that mean content is lost: an image some clients don't show, a message Gmail clips. */
const EMAIL_LOSS = ["email/image-format", "email/size", "email/style-size"];
/** A PDF that couldn't draw a font or an image falls back, and says so: here, that fails. */
const PDF_LOSS = ["pdf/font", "pdf/image"];
/** What the layout can't hold: content past its box, past the canvas, a character no font has, text that doesn't fit. */
const DOESNT_FIT = ["layout/overflow", "document/overflow", "canvas/overflow", "image/overflow", "image/glyph", "image/fit"];
/** The lint rules every design holds to. */
const READABLE = ["contrast", "text-size", "link-text", "alt-text"].flatMap((rule) => [`email/lint-${rule}`, `page/lint-${rule}`]);

const [all, sampleBrands, cats, kitList] = [await designs(), await brands(), await categories(), await kits()];
const clients = await emailClients();
const sha = (text: string | Uint8Array) => createHash("sha256").update(text).digest("hex").slice(0, 16);
const codes = (ds: readonly Diagnostic[]) => ds.map((d) => `${d.severity} ${d.code} ${d.path}`).sort();
const failing = (ds: readonly Diagnostic[], list: string[]) => codes(ds.filter((d) => list.includes(d.code)));

/** The brands a design is drawn in: the samples, and its kit's company brand where it's a recreation. */
function brandsFor(kit: string): Array<{ id: string; brand: Brand }> {
  const own = kitList.find((k) => k.id === kit)?.brand;
  return own ? [{ id: `${kit} (original)`, brand: own }, ...sampleBrands] : sampleBrands;
}

const baseline: Record<string, Record<string, unknown>> = {};

for (const t of all) {
  const { Design } = t;
  describe(t.key, () => {
    const file = join(BASELINE, `${t.kit}.${t.folder}.${t.category}.json`);
    const recorded: Record<string, unknown> = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
    baseline[file] = {};

    it("says what it is, has its folder's root, and is in a category that takes it", () => {
      expect(typeof t.meta?.label, "meta.label").toBe("string");
      expect(typeof t.meta?.description, "meta.description").toBe("string");
      expect(treeFacts(<Design brand={sampleBrands[0].brand} />).root).toBe(t.root);
      const category = cats.find((c) => c.id === t.category);
      expect(category, `templates/_categories/${t.category}.ts`).toBeDefined();
      expect(category!.category.roots as string[]).toContain(t.root);
    });

    for (const { id: name, brand } of brandsFor(t.kit)) {
      it(`renders in ${name}`, async () => {
        const design = <Design brand={brand} />;
        let entry: Record<string, unknown>;
        if (t.root === "Email" || t.root === "Page") {
          const out = await render(design, { plugins: t.root === "Email" ? [clients, lint()] : [lint()] });
          expect(failing(out.diagnostics, EMAIL_LOSS), "content email clients lose").toEqual([]);
          expect(failing(out.diagnostics, [...DOESNT_FIT, ...READABLE]), "what doesn't fit or read").toEqual([]);
          entry = { html: sha(out.html), text: sha(out.text ?? ""), diagnostics: codes(out.diagnostics) };
        } else if (t.root === "Document") {
          const out = await render(design);
          const pdf = await renderPdf(design, { fonts: fontFiles(brand), images: imageFiles(pdfAssets(design).images) });
          expect(failing(pdf.diagnostics, PDF_LOSS), "what the PDF couldn't draw").toEqual([]);
          expect(failing([...out.diagnostics, ...pdf.diagnostics], DOESNT_FIT), "what doesn't fit").toEqual([]);
          entry = { html: sha(out.html), text: sha(out.text ?? ""), diagnostics: codes([...out.diagnostics, ...pdf.diagnostics]) };
        } else {
          const fonts = fontFiles(brand);
          const images = imageFiles(imageAssets(design).images);
          const image = await renderImage(design, { fonts, images });
          const layout = await layoutImage(design, { fonts, images, strict: true });
          expect(codes(layout.diagnostics.filter((d) => d.severity === "error")), "layoutImage()").toEqual([]);
          expect(failing([...image.diagnostics, ...layout.diagnostics], DOESNT_FIT), "what doesn't fit").toEqual([]);
          entry = { size: [image.width, image.height], image: sha(image.image), diagnostics: codes([...image.diagnostics, ...layout.diagnostics]) };
        }
        baseline[file][name] = entry;
        if (!UPDATE) expect(entry, `the baseline in ${file} (UPDATE_TEMPLATES=1 rewrites it)`).toEqual(recorded[name]);
      });

      it(`has readable text in ${name}`, () => {
        const { plugin, findings } = checker({ contrast: true });
        validate(<Design brand={brand} />, { plugins: [plugin] });
        expect(findings.map((f: Finding) => `${f.check} ${f.path}: ${f.message}`)).toEqual([]);
      });

      it(`shows no other brand's name or site in ${name}`, () => {
        const { text, images } = treeFacts(<Design brand={brand} />);
        for (const { brand: other } of sampleBrands) {
          if (other.name === brand.name) continue;
          expect(text, `${other.name}'s name`).not.toContain(other.name);
          expect(text, `${other.name}'s site`).not.toContain(new URL(other.links.site).host);
          expect(images, `${other.name}'s logo`).not.toContain(other.logo.src);
        }
      });
    }

    for (const [i, probe] of PROBES.entries()) {
      it(`takes every color and font from the brand, and draws text in its pairs (probe ${i + 1})`, () => {
        const fonts = probe.theme.fonts as Record<string, string>;
        const { plugin, findings } = checker({ probe: { names: tokenNames(probe), fonts: new Set([fonts.body, fonts.heading]) } });
        validate(<Design brand={probe} />, { plugins: [plugin] });
        expect(findings.map((f: Finding) => `${f.check} ${f.path}: ${f.message}`)).toEqual([]);
      });
    }

    // Evergreen: a template reads the same in any year, so it names no year, and no weekday with a date (a weekday is
    // right for a date only in some years).
    it("names no year, and no weekday with a date", () => {
      const { text, said } = treeFacts(<Design brand={brandsFor(t.kit)[0]!.brand} />);
      for (const words of [text, ...said]) {
        expect(words.match(/\b(?:19|20)\d{2}\b/g), `a year in "${words.slice(0, 120)}"`).toBeNull();
        expect(words.match(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,? (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d/g), `a weekday with a date in "${words.slice(0, 120)}"`).toBeNull();
      }
    });

    it("needs only the contract's tokens", () => {
      const { diagnostics } = treeFacts(<Design brand={contractOnly(sampleBrands[0].brand)} />);
      expect(diagnostics.filter((d) => d.code === "theme/missing-token").map((d) => d.message)).toEqual([]);
    });
  });
}

afterAll(() => {
  if (!UPDATE) return;
  mkdirSync(BASELINE, { recursive: true });
  for (const [file, entries] of Object.entries(baseline)) {
    const sorted = Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(file, JSON.stringify(sorted, null, 2) + "\n");
  }
});
