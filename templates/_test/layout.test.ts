/** The folder's rules: where a design lives, what it imports, and what its assets are. */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import ts from "typescript";
import { ASSETS } from "../_brand";
import { ASSET_DIR, ROOT } from "../_scripts/assets";
import { ROOT_FOLDERS, SHARED, categories, companies, designs } from "./discover";

const PACKAGE = /^(react|@hyper-elements\/react)$/;
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const imports = (file: string) => {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  return source.statements.filter(ts.isImportDeclaration).map((s) => ({ from: (s.moduleSpecifier as ts.StringLiteral).text, statement: s, source }));
};
const topNames = (file: string) => {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names: string[] = [];
  for (const s of source.statements) {
    if (ts.isFunctionDeclaration(s) && s.name) {
      names.push(s.name.text);
    } else if (ts.isVariableStatement(s)) {
      for (const d of s.declarationList.declarations) if (ts.isIdentifier(d.name)) names.push(d.name.text);
    } else if (ts.isTypeAliasDeclaration(s) || ts.isInterfaceDeclaration(s)) {
      names.push(s.name.text);
    }
  }
  return names;
};
const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : [join(dir, name)]));

it("has only the root folders and the shared folders at the top", () => {
  for (const name of readdirSync(ROOT)) {
    if (!statSync(join(ROOT, name)).isDirectory() || SHARED(name)) continue;
    expect(Object.keys(ROOT_FOLDERS), `${name}: a design goes in ${Object.keys(ROOT_FOLDERS).join(", ")}`).toContain(name);
  }
});

it("keeps designs as .tsx files named in kebab case, each in a category that takes its folder's root", async () => {
  const cats = await categories();
  for (const folder of Object.keys(ROOT_FOLDERS) as Array<keyof typeof ROOT_FOLDERS>) {
    for (const file of readdirSync(join(ROOT, folder))) {
      expect(extname(file), `${folder}/${file}`).toBe(".tsx");
      expect(file.replace(/\.tsx$/, ""), `${folder}/${file}: a name in kebab case`).toMatch(NAME);
    }
  }
  for (const t of await designs()) {
    const category = cats.find((c) => c.id === t.category);
    expect(category, `${t.key}: meta.category "${t.category}" has no _categories/${t.category}.ts`).toBeDefined();
    expect(category!.category.roots as string[], `${t.key}: ${t.category} doesn't take a ${t.root}`).toContain(t.root);
  }
});

it("gives each design in a folder a label of its own, so the gallery can tell them apart", async () => {
  const seen = new Map<string, string>();
  for (const t of await designs()) {
    const key = `${t.folder}: ${t.meta.label}`;
    expect(seen.get(key), `${t.key} and ${seen.get(key)} are both "${t.meta.label}"`).toBeUndefined();
    seen.set(key, t.key);
  }
});

it("has a company brand only for a company a design recreates", async () => {
  const recreated = new Set((await designs()).map((t) => t.meta.recreates?.company).filter(Boolean));
  for (const { id } of await companies()) expect(recreated.has(id), `_companies/${id}.ts: no design recreates ${id}`).toBe(true);
  for (const id of recreated) expect((await companies()).map((c) => c.id), `a recreation of ${id} needs _companies/${id}.ts`).toContain(id);
});

it("imports only React, Elements and _brand.ts's types, so each design is one file to copy", async () => {
  for (const t of await designs()) {
    for (const { from, statement } of imports(t.file)) {
      if (PACKAGE.test(from)) {
        const bindings = statement.importClause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings)) for (const e of bindings.elements) expect(e.propertyName, `${t.file}: no renamed imports`).toBeUndefined();
        continue;
      }
      expect(relative(ROOT, join(t.file, "..", from)), `${relative(ROOT, t.file)} imports ${from}`).toBe("_brand");
      expect(statement.importClause?.isTypeOnly, `${t.file} imports _brand.ts for its types only`).toBe(true);
    }
    const names = topNames(t.file);
    expect(names, `${relative(ROOT, t.file)} exports meta`).toContain("meta");
  }
});

it("has brand files of one declaration of literals", () => {
  for (const path of ["_brands", "_companies"].flatMap((dir) => readdirSync(join(ROOT, dir)).map((file) => join(ROOT, dir, file)))) {
    const file = relative(ROOT, path);
    const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
    const statements = source.statements.filter((s) => !ts.isImportDeclaration(s));
    expect(statements.length, file).toBe(1);
    expect(source.statements.filter(ts.isImportDeclaration).map((s) => (s.moduleSpecifier as ts.StringLiteral).text).sort(), file).toEqual(["../_brand", "@hyper-elements/react"]);
    // Every name it refers to is defineTheme, or a property name.
    const refs: string[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isIdentifier(node) && !ts.isPropertyAssignment(node.parent) && !ts.isPropertyAccessExpression(node.parent) && !ts.isVariableDeclaration(node.parent) && !ts.isTypeReferenceNode(node.parent)) refs.push(node.text);
      ts.forEachChild(node, visit);
    };
    visit(statements[0]);
    expect(refs.filter((r) => r !== "defineTheme"), `${file} refers to nothing but defineTheme`).toEqual([]);
  }
});

it("holds only PNG or JPEG images, TTF or OTF fonts with their licenses, under _assets", () => {
  for (const file of walk(ASSET_DIR)) {
    const rel = relative(ASSET_DIR, file);
    if (rel.startsWith("fonts/")) expect(rel, rel).toMatch(/\.(ttf|otf)$|^fonts\/OFL-[A-Za-z0-9]+\.txt$/);
    else expect(rel, rel).toMatch(/\.(png|jpe?g)$/);
  }
  const families = new Set(walk(join(ASSET_DIR, "fonts")).filter((f) => /\.(ttf|otf)$/.test(f)).map((f) => relative(ASSET_DIR, f).replace(/^fonts\/|-\d+\.(ttf|otf)$/g, "")));
  for (const family of families) expect(walk(join(ASSET_DIR, "fonts")).map((f) => relative(ASSET_DIR, f)), `a license for ${family}`).toContain(`fonts/OFL-${family}.txt`);
  expect(ASSETS.endsWith("/")).toBe(true);
});
