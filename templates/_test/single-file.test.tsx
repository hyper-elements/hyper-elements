/**
 * Every design's copyable files, in every brand: swapping the single file's brand block for another brand's gives that
 * brand's file; each single file, and each design with its brand.ts beside it, typechecks under `strict` against the
 * packages on its own; and both render exactly what the design does in that brand.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import type { ReactElement } from "react";
import { render } from "@hyper-elements/react";
import type { Brand } from "../_brand";
import { ROOT } from "../_scripts/assets";
import { brandBlock, singleFile, splitFiles, swapBrand } from "../_scripts/single-file";
import { brands, designs } from "./discover";

const OUT = join(ROOT, ".single");
const [all, sampleBrands] = [await designs(), await brands()];
const files: Array<{ key: string; brand: string; single: string; code: string; name: string }> = [];

beforeAll(() => {
  rmSync(OUT, { recursive: true, force: true });
  for (const t of all) {
    for (const { id: brand } of sampleBrands) {
      const dir = join(OUT, brand, `${t.folder}.${t.name}`);
      mkdirSync(dir, { recursive: true });
      const brandFile = join(ROOT, "_brands", `${brand}.ts`);
      writeFileSync(join(dir, "single.tsx"), singleFile(t.file, brandFile));
      const split = splitFiles(t.file, brandFile);
      writeFileSync(join(dir, `${t.name}.tsx`), split.code);
      writeFileSync(join(dir, "brand.ts"), split.brand);
      writeFileSync(join(dir, "use.tsx"), `import ${t.Design.name} from "./${t.name}";\n\nexport default ${t.Design.name};\n`);
      files.push({ key: t.key, brand, single: join(dir, "single.tsx"), code: join(dir, "use.tsx"), name: t.Design.name });
    }
  }
});

it("gives a brand's file when another brand's block is swapped in, as the playground's Brand menu does", () => {
  for (const t of all) {
    const first = singleFile(t.file, join(ROOT, "_brands", `${sampleBrands[0].id}.ts`));
    for (const { id } of sampleBrands) {
      const brandFile = join(ROOT, "_brands", `${id}.ts`);
      expect(swapBrand(first, brandBlock(brandFile)), `${t.key} as ${id}`).toBe(singleFile(t.file, brandFile));
    }
  }
});

it("typechecks every single file, and every design with its brand.ts, under strict", () => {
  const program = ts.createProgram(
    files.flatMap((f) => [f.single, f.code]),
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

it("renders each single file, and each design with its brand.ts, as the design does", async () => {
  for (const { key, brand, single, code } of files) {
    const t = all.find((d) => d.key === key)!;
    if (t.root === "Canvas") continue;
    const real = sampleBrands.find((b) => b.id === brand)!.brand as Brand;
    const html = (await render(<t.Design brand={real} />)).html;
    for (const file of [single, code]) {
      const Default = ((await import(file)) as { default: () => ReactElement }).default;
      expect((await render(<Default />)).html, `${relative(OUT, file)}`).toBe(html);
    }
  }
});
