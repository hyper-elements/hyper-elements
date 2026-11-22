/**
 * Every template's copyable files, in every sample brand (and a recreation's in its company's): the template as one
 * file with the brand written in, and the template beside its brand.ts with its designs beside it. Swapping the one
 * file's brand block for another brand's gives that brand's file (what the playground's Brand menu does); the copies
 * typecheck under `strict` against the packages on their own; and they render what the template made from that brand
 * does: its example, and each design in the brand it's written for.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import type { ReactElement } from "react";
import { render } from "@hyper-elements/react";
import type { Template } from "@hyper-elements/react/template";
import { ROOT } from "../_scripts/assets";
import { brandBlock, swapBrand, templateFiles } from "../_scripts/single-file";
import { brands, companies, templates } from "./discover";

const OUT = join(ROOT, ".single");
const [made, sampleBrands, owned] = [await templates(), await brands(), await companies()];
const copies: Array<{ key: string; brand: string; single: string; designs: Array<{ name: string; file: string }> }> = [];

beforeAll(() => {
  rmSync(OUT, { recursive: true, force: true });
  for (const t of made) {
    const own = owned.find((c) => c.id === t.meta.recreates?.company);
    for (const { id: brand, file: brandFile } of [...(own ? [own] : []), ...sampleBrands]) {
      const dir = join(OUT, brand, `${t.folder}.${t.name}`);
      mkdirSync(dir, { recursive: true });
      const files = templateFiles(t.file, brandFile, t.designs.map((d) => d.file));
      writeFileSync(join(dir, "single.tsx"), files.single);
      writeFileSync(join(dir, "template.tsx"), files.code);
      writeFileSync(join(dir, "brand.ts"), files.brand);
      for (const d of t.designs) writeFileSync(join(dir, `${d.name}.tsx`), files.designs[d.file]!);
      copies.push({ key: t.key, brand, single: join(dir, "single.tsx"), designs: t.designs.map((d) => ({ name: d.name, file: join(dir, `${d.name}.tsx`) })) });
    }
  }
});

it("gives a brand's file when another brand's block is swapped in, as the playground's Brand menu does", () => {
  for (const t of made) {
    const first = templateFiles(t.file, join(ROOT, "_brands", `${sampleBrands[0]!.id}.ts`), []).single;
    for (const { id, file } of sampleBrands) {
      expect(swapBrand(first, brandBlock(file)), `${t.key} as ${id}`).toBe(templateFiles(t.file, file, []).single);
    }
  }
});

it("typechecks every copy, under strict", () => {
  const program = ts.createProgram(
    copies.flatMap((c) => [c.single, ...c.designs.map((d) => d.file)]),
    {
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      target: ts.ScriptTarget.ES2022,
      lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
      types: [],
      isolatedModules: true,
    },
  );
  const problems = ts
    .getPreEmitDiagnostics(program)
    .map((d) => `${d.file ? relative(ROOT, d.file.fileName) : ""}: ${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`);
  expect(problems).toEqual([]);
});

it("renders each copy as the template made from that brand does", async () => {
  for (const { key, brand, single, designs: copied } of copies) {
    const t = made.find((m) => m.key === key)!;
    if (t.root === "Canvas") continue; // drawn with renderImage() by the render test; the HTML here would be empty
    const real = t.make([...sampleBrands, ...owned].find((b) => b.id === brand)!.brand);
    const Single = ((await import(single)) as { default: Template }).default;
    expect((await render(Single.design(Single.example as never))).html, relative(OUT, single)).toBe((await render(real.design(real.example as never))).html);
    // A design's links are on the brand it's written for (its template's default), and its template refuses another
    // brand's links: in another brand, a copied design takes that brand's links first.
    if (!new RegExp(`from "\\.\\./\\.\\./_(brands|companies)/${brand}"`).test(readFileSync(t.file, "utf8"))) continue;
    for (const { name, file } of copied) {
      const Design = ((await import(file)) as { default: () => ReactElement }).default;
      const values = t.designs.find((d) => d.name === name)!.values;
      expect((await render(<Design />)).html, relative(OUT, file)).toBe((await render(real.design(values as never))).html);
    }
  }
});
