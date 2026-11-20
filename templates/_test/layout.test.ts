/** The folder's rules: what a kit is, where a design lives, what it imports, and what its assets are. */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import ts from "typescript";
import { ASSETS } from "../_brand";
import { ASSET_DIR, ROOT } from "../_scripts/assets";
import { NOT_KITS, ROOT_FOLDERS, categories, designs, kitNames } from "./discover";

const PACKAGE = /^(react|@hyper-elements\/react)$/;
const KIT_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// The website's old gallery pages redirect from these, so no kit may take one.
const GALLERY_SLUGS = ["oyen-launch", "tarn-shipped", "quarry-welcome", "pith-weekly", "saltworks-invitation", "keel-sign-in-code", "casa-albero-page", "pell-ashby-invoice", "shipwright-ticket", "slow-signals-card", "fernway-spring-sale", "gridline-workshop-banner", "crumb-club-thumbnail", "morning-pages-quote"];

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

it("has only kits and the shared folders at the top", () => {
  for (const name of readdirSync(ROOT)) {
    if (!statSync(join(ROOT, name)).isDirectory() || NOT_KITS(name)) continue;
    expect(name, "a kit's name").toMatch(KIT_NAME);
    expect(GALLERY_SLUGS, `${name} is an old gallery page's address`).not.toContain(name);
    expect(readdirSync(join(ROOT, name)), `${name}/kit.ts`).toContain("kit.ts");
  }
});

it("keeps every kit's designs under a root folder, named for a category that takes that root", async () => {
  const cats = await categories();
  for (const kit of kitNames()) {
    for (const name of readdirSync(join(ROOT, kit))) {
      const path = join(ROOT, kit, name);
      if (statSync(path).isDirectory()) {
        expect(Object.keys(ROOT_FOLDERS), `${kit}/${name}`).toContain(name);
        for (const file of readdirSync(path)) {
          expect(extname(file), `${kit}/${name}/${file}`).toBe(".tsx");
          const category = cats.find((c) => `${c.id}.tsx` === file);
          expect(category, `${kit}/${name}/${file}: no _categories/${file.replace(".tsx", ".ts")}`).toBeDefined();
          expect(category!.category.roots as string[], `${file} as ${ROOT_FOLDERS[name as keyof typeof ROOT_FOLDERS]}`).toContain(ROOT_FOLDERS[name as keyof typeof ROOT_FOLDERS]);
        }
      } else expect(["kit.ts", "brand.ts"], `${kit}/${name}`).toContain(name);
    }
  }
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
  for (const file of readdirSync(join(ROOT, "_brands"))) {
    const path = join(ROOT, "_brands", file);
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
