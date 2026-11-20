/**
 * The contribution guide stays true: its design example typechecks where it says it lives, every category in the
 * folder is on its list of agreed names, and every folder it names exists.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { ROOT } from "../_scripts/assets";
import { categories } from "./discover";

const guide = readFileSync(join(ROOT, "CONTRIBUTING.md"), "utf8");
const blocks = [...guide.matchAll(/```(\w+)\n([\s\S]*?)```/g)].map(([, lang, code]) => ({ lang, code }));

it("has a design example that typechecks as ledger/documents/invoice.tsx", () => {
  const example = blocks.find((b) => b.lang === "tsx" && b.code.includes("export default function"));
  expect(example, "a tsx example").toBeDefined();
  const file = join(ROOT, "ledger", "documents", "guide-example.tsx");
  const options: ts.CompilerOptions = { strict: true, noEmit: true, skipLibCheck: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, target: ts.ScriptTarget.ES2022, types: [] };
  const host = ts.createCompilerHost(options);
  const read = host.getSourceFile.bind(host);
  host.getSourceFile = (name, version, onError) => (name === file ? ts.createSourceFile(name, example!.code, version, true, ts.ScriptKind.TSX) : read(name, version, onError));
  host.fileExists = ((exists) => (name: string) => name === file || exists(name))(host.fileExists.bind(host));
  const program = ts.createProgram([file], options, host);
  const problems = ts.getPreEmitDiagnostics(program).filter((d) => d.file?.fileName === file).map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
  expect(problems).toEqual([]);
});

it("lists every category in the folder among its agreed names", async () => {
  const list = guide.match(/These names are agreed[\s\S]*?: ([a-z,\s-]+)\. Any other name/)?.[1].split(/,\s*/).map((s) => s.trim());
  expect(list?.length).toBeGreaterThan(40);
  for (const { id } of await categories()) expect(list, `_categories/${id}.ts`).toContain(id);
});

it("names folders and files that exist", () => {
  for (const path of ["_brand.ts", "_brands", "_categories", "_assets", "_assets/fonts", "ledger/kit.ts", "ledger/documents/invoice.tsx", "_test/range.test.ts", "README.md"]) {
    expect(existsSync(join(ROOT, path)), relative(ROOT, join(ROOT, path))).toBe(true);
    expect(guide.includes(path.split("/").pop()!), `the guide mentions ${path}`).toBe(true);
  }
});
