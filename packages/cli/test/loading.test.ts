/**
 * Loading templates as a project's own code loads: path aliases, workspace packages, CommonJS and ES module projects;
 * their props from PreviewProps (through memo and forwardRef) or --props.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, email, lines, link, MODULES, ON_BUN, project } from "./helpers";

const textOf = (dir: string, name: string) => readFileSync(join(dir, "out", "emails", `${name}.txt`), "utf8");

describe("loading", () => {
  it("a template with a tsconfig path alias", async () => {
    const dir = project({
      "tsconfig.json": JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] }, jsx: "react-jsx" } }),
      "src/greeting.ts": `export const greeting = "Hello from an alias";\n`,
      "emails/a.tsx": `import { Email, Text } from "@hyper-elements/react";
import { greeting } from "@/greeting";
export default function A() { return <Email><Text>{greeting}</Text></Email>; }
`,
    });
    const ran = await cli(dir, ["render", "emails"]);
    expect(ran.code, ran.stderr + ran.stdout).toBe(0);
    expect(textOf(dir, "a")).toContain("Hello from an alias");
  });

  it("a template in a pnpm workspace package, importing another package's TSX", async () => {
    const dir = project(
      {
        "package.json": JSON.stringify({ name: "root", private: true }),
        "pnpm-workspace.yaml": "packages:\n  - 'apps/*'\n  - 'packages/*'\n",
        "packages/ui/package.json": JSON.stringify({ name: "@acme/ui", type: "module", main: "./src/index.tsx" }),
        "packages/ui/src/index.tsx": `import { Text } from "@hyper-elements/react";
export function Signature({ name }: { name: string }) { return <Text>From {name}, in a workspace package</Text>; }
`,
        "apps/web/package.json": JSON.stringify({ name: "web", type: "module" }),
        "apps/web/tsconfig.json": JSON.stringify({ compilerOptions: { jsx: "react-jsx", module: "esnext", moduleResolution: "bundler" } }),
        "apps/web/emails/a.tsx": `import { Email } from "@hyper-elements/react";
import { Signature } from "@acme/ui";
export default function A() { return <Email><Signature name="Ada" /></Email>; }
`,
      },
      { packageJson: null, modules: [] },
    );
    for (const app of ["apps/web", "packages/ui"]) {
      link(join(dir, app), "react", MODULES.react);
      link(join(dir, app), "@hyper-elements/react", MODULES["@hyper-elements/react"]);
    }
    link(join(dir, "apps/web"), "react-dom", MODULES["react-dom"]);
    link(join(dir, "apps/web"), "@acme/ui", join(dir, "packages/ui"));
    const ran = await cli(join(dir, "apps/web"), ["render", "emails"]);
    expect(ran.code, ran.stderr + ran.stdout).toBe(0);
    expect(readFileSync(join(dir, "apps/web/out/emails/a.txt"), "utf8")).toContain("From Ada, in a workspace package");
  });

  it("a template in a CommonJS project, and one in an ES module project", async () => {
    for (const type of ["commonjs", "module"]) {
      const dir = project({ "emails/a.tsx": email(`A ${type} template`) }, { packageJson: { name: "fixture", type } });
      const ran = await cli(dir, ["render", "emails"]);
      expect(ran.code, ran.stderr + ran.stdout).toBe(0);
      expect(textOf(dir, "a")).toContain(`A ${type} template`);
    }
  });

  // A dependency with no CommonJS build ("type": "module", its "exports" one ES module), imported by a template in
  // a project without "type": "module". Node loads one by `require` from 20.19 and 22.12 on; before those, tsx
  // compiling it is the only way in, so a dependency's JavaScript is left to Node only where Node can load it.
  it("a CommonJS project's template imports a dependency written as an ES module, on a Node that can't require one too", async () => {
    const dir = project(
      {
        "emails/a.tsx": email("{greeting} / {word}", `import word, { greeting } from "esm-only";`),
        "node_modules/esm-only/package.json": JSON.stringify({ name: "esm-only", version: "1.0.0", type: "module", exports: { ".": "./index.js" } }),
        "node_modules/esm-only/index.js": `export const greeting = "Hello from an ES module";\nexport default "its default export";\n`,
      },
      { packageJson: { name: "fixture", private: true } }
    );
    const ran = await cli(dir, ["render", "emails"]);
    expect(ran.code, ran.stderr + ran.stdout).toBe(0);
    expect(textOf(dir, "a")).toContain("Hello from an ES module / its default export");
    // As Node before 20.19 and 22.12 is: its `require` of an ES module turned off (a flag only a Node with one takes).
    if (ON_BUN || !process.features.require_module) return;
    const before = await cli(dir, ["render", "emails", "--out", "before"], { env: { NODE_OPTIONS: "--no-experimental-require-module" } });
    expect(before.code, before.stderr + before.stdout).toBe(0);
    expect(readFileSync(join(dir, "before", "emails", "a.txt"), "utf8")).toContain("Hello from an ES module / its default export");
  });

  // A template can be in an installed package itself (templates a team ships compiled, rendered by their path), or
  // its project under a folder named node_modules. That package's files are the template's own wherever it is: tsx
  // compiles them as it did, the loader module the CLI writes beside the template among them (ES syntax that calls
  // `require`, which Node reads as neither kind of module). Left to Node with the dependencies, the first of these
  // said @hyper-elements/react wasn't installed, and the second "Cannot use import statement outside a module".
  // (On Bun nothing is left to Node: Bun compiles every file itself.)
  it.skipIf(ON_BUN)("a template in a CommonJS package under node_modules: its package's own files are compiled as they were", async () => {
    const compiled = `const React = require("react");\nconst { Email, Text } = require("@hyper-elements/react");\nmodule.exports = function Welcome() {\n  return React.createElement(Email, null, React.createElement(Text, null, "A compiled template"));\n};\n`;
    const written = `import { createElement } from "react";\nimport { Email, Text } from "@hyper-elements/react";\nimport { word } from "./words.js";\nexport default function Welcome() {\n  return createElement(Email, null, createElement(Text, null, word));\n}\n`;
    const dir = project(
      {
        "node_modules/acme-emails/package.json": JSON.stringify({ name: "acme-emails", version: "1.0.0" }),
        "node_modules/acme-emails/dist/welcome.js": compiled,
        // ES syntax in a package that says it's CommonJS: tsx's to compile, and not a module Node loads as written.
        "node_modules/acme-typed/package.json": JSON.stringify({ name: "acme-typed", version: "1.0.0", type: "commonjs" }),
        "node_modules/acme-typed/emails/welcome.js": written,
        "node_modules/acme-typed/emails/words.js": `export const word = "Its own ES syntax";\n`,
      },
      { packageJson: { name: "fixture", private: true } }
    );
    for (const [file, text] of [
      ["node_modules/acme-emails/dist/welcome", "A compiled template"],
      ["node_modules/acme-typed/emails/welcome", "Its own ES syntax"],
    ]) {
      const ran = await cli(dir, ["render", `${file}.js`]);
      expect(ran.code, ran.stderr + ran.stdout).toBe(0);
      expect(readFileSync(join(dir, "out", `${file}.txt`), "utf8")).toContain(text);
    }
  });

  // A dependency whose entry is an `.mjs` file, importing a package whose "exports" names an `import` condition
  // alone: what react-pdf's text engine does from a `.js` file. tsx hooks `.mjs` under a key of its own, which Node
  // has no loader for, so leaving Node's own loaders to Node left this one with tsx: it compiled the file, turned
  // its import into a `require`, and the package couldn't be found (ERR_PACKAGE_PATH_NOT_EXPORTED). It's read
  // through Node's `.js` loader, as Node reads an `.mjs` where nothing else is registered for it.
  it.skipIf(ON_BUN || !process.features.require_module)("a CommonJS project's template imports a dependency whose entry is an .mjs file", async () => {
    const dir = project(
      {
        "emails/a.tsx": email("{word}", `import { word } from "mjs-entry";`),
        "node_modules/mjs-entry/package.json": JSON.stringify({ name: "mjs-entry", version: "1.0.0", exports: { ".": "./index.mjs" } }),
        "node_modules/mjs-entry/index.mjs": `import { word } from "import-only";\nexport { word };\n`,
        "node_modules/import-only/package.json": JSON.stringify({ name: "import-only", version: "1.0.0", type: "module", exports: { ".": { import: "./index.js" } } }),
        "node_modules/import-only/index.js": `export const word = "From a package only an import finds";\n`,
      },
      { packageJson: { name: "fixture", private: true } }
    );
    const ran = await cli(dir, ["render", "emails"]);
    expect(ran.code, ran.stderr + ran.stdout).toBe(0);
    expect(textOf(dir, "a")).toContain("From a package only an import finds");
  });

  // A dependency that ships its source: an ES module entry (a `.js` file, or an `.mjs` one) re-exporting a
  // component from a `.tsx` file of its own. Left to Node, Node 22 on reads the `.tsx` through tsx's ES module
  // hooks, and Node 20.19 doesn't (`Unknown file extension ".tsx"`): there the dependency is compiled by tsx, as it
  // was before a dependency's JavaScript was left to Node. (Only a run on Node 20.19 can fail this.)
  it.skipIf(ON_BUN)("a CommonJS project's template imports a dependency whose ES module entry re-exports its own TSX", async () => {
    // (A dependency's TSX is compiled without the project's tsconfig: its JSX is React.createElement.)
    const signature = `import React from "react";\nimport { Span } from "@hyper-elements/react";\nexport function Signature({ from }: { from: string }) {\n  return <Span>From {from}</Span>;\n}\n`;
    const dir = project(
      {
        "emails/a.tsx": email("<Mjs from=\"an .mjs entry\" />, <Js from=\"a .js entry\" />", `import { Signature as Mjs } from "source-mjs";\nimport { Signature as Js } from "source-js";`),
        "node_modules/source-mjs/package.json": JSON.stringify({ name: "source-mjs", version: "1.0.0", type: "module", exports: "./index.mjs" }),
        "node_modules/source-mjs/index.mjs": `export { Signature } from "./signature.tsx";\n`,
        "node_modules/source-mjs/signature.tsx": signature,
        "node_modules/source-js/package.json": JSON.stringify({ name: "source-js", version: "1.0.0", type: "module", exports: "./index.js" }),
        "node_modules/source-js/index.js": `export { Signature } from "./signature.tsx";\n`,
        "node_modules/source-js/signature.tsx": signature,
      },
      { packageJson: { name: "fixture", private: true } }
    );
    const ran = await cli(dir, ["render", "emails"]);
    expect(ran.code, ran.stderr + ran.stdout).toBe(0);
    expect(textOf(dir, "a")).toContain("From an .mjs entry, From a .js entry");
  });

  it("reads PreviewProps through memo and forwardRef, and --props over them", async () => {
    const dir = project({
      "emails/memo.tsx": `import { memo } from "react";
import { Email, Text } from "@hyper-elements/react";
function Inner({ name }: { name: string }) { return <Email><Text>Hi {name}</Text></Email>; }
const Memo = memo(Inner);
(Memo as any).PreviewProps = { name: "Memo" };
export default Memo;
`,
      "emails/ref.tsx": `import { forwardRef } from "react";
import { Email, Text } from "@hyper-elements/react";
const Ref = forwardRef<unknown, { name: string }>(function Ref({ name }) { return <Email><Text>Hi {name}</Text></Email>; });
(Ref as any).PreviewProps = { name: "Ref" };
export default Ref;
`,
      "emails/plain.tsx": `import { Email, Text } from "@hyper-elements/react";
export default function Plain({ name = "nobody" }: { name?: string }) { return <Email><Text>Hi {name}</Text></Email>; }
`,
      "props.json": JSON.stringify({ name: "Props" }),
    });
    let ran = await cli(dir, ["render", "emails"]);
    expect(ran.code, ran.stderr + ran.stdout).toBe(0);
    expect(textOf(dir, "memo")).toContain("Hi Memo");
    expect(textOf(dir, "ref")).toContain("Hi Ref");
    expect(textOf(dir, "plain")).toContain("Hi nobody");
    ran = await cli(dir, ["render", "emails", "--props", "props.json"]);
    expect(ran.code).toBe(0);
    for (const name of ["memo", "ref", "plain"]) expect(textOf(dir, name)).toContain("Hi Props");
  });

  it("refuses --props that isn't a JSON object", async () => {
    const dir = project({ "emails/a.tsx": email(), "bad.json": "[1, 2]", "broken.json": "{" });
    expect((await cli(dir, ["render", "emails", "--props", "bad.json"])).code).toBe(2);
    expect((await cli(dir, ["render", "emails", "--props", "broken.json"])).code).toBe(2);
    expect((await cli(dir, ["render", "emails", "--props", "missing.json"])).code).toBe(2);
  });

  it("skips a default-exported element with its note, and a module whose default export isn't a component", async () => {
    const dir = project({
      "emails/element.tsx": `import { Email, Text } from "@hyper-elements/react";\nexport default <Email><Text>Hi</Text></Email>;\n`,
      "emails/value.ts": `export default { not: "a component" };\n`,
      "emails/noroot.tsx": `export default function NoRoot() { return null; }\n`,
    });
    const ran = await cli(dir, ["render", "emails", "--json"]);
    const got = lines(ran);
    expect(got.slice(0, 3).map((l) => [l.file, l.status, l.diagnostics.map((d: any) => d.code)])).toEqual([
      ["emails/element.tsx", "skipped", ["cli/element-export"]],
      ["emails/noroot.tsx", expect.any(String), expect.any(Array)],
      ["emails/value.ts", "skipped", ["cli/not-a-template"]],
    ]);
    expect(got[3].summary.skipped).toBeGreaterThanOrEqual(2);
  });
});

describe("a syntax error", () => {
  /** A mismatched closing tag on line 3, at column 34 (counted from 1). */
  const MISMATCHED = `import { Email, Text } from "@hyper-elements/react";\nexport default function Bad() {\n  return <Email><Text>Hi</Text></Emal>;\n}\n`;
  // tsx (esbuild) and Bun's transpiler say it in their own words.
  const REASON = ON_BUN ? /Expected closing JSX tag to match opening tag "<Email>"/ : /Unexpected closing "Emal" tag does not match opening "Email" tag/;

  it("is the file, its line and column, and the reason, in the JSON error and the text", async () => {
    const dir = project({ "emails/bad.tsx": MISMATCHED });
    const json = await cli(dir, ["check", "emails/bad.tsx", "--json"]);
    expect(json.code).toBe(1);
    const [line] = lines(json);
    expect(line.status).toBe("error");
    expect(line.error).toMatch(/^emails\/bad\.tsx:3:34: /);
    expect(line.error).toMatch(REASON);
    expect(line.error).not.toMatch(/Transform failed|\n/);
    const text = await cli(dir, ["render", "emails"]);
    expect(text.code).toBe(1);
    expect(text.stdout).toMatch(/^✗ emails\/bad\.tsx: emails\/bad\.tsx:3:34: /m);
    expect(text.stdout).toMatch(REASON);
  });

  it("in a module the template imports names that module, in a CommonJS project too", async () => {
    const files = {
      "emails/welcome.tsx": `import { Email } from "@hyper-elements/react";\nimport { Footer } from "./_parts/footer";\nexport default function Welcome() {\n  return <Email><Footer /></Email>;\n}\n`,
      "emails/_parts/footer.tsx": `import { Text } from "@hyper-elements/react";\nexport function Footer() {\n  return <Text>Bye</Txt>;\n}\n`,
    };
    for (const packageJson of [undefined, { name: "fixture", private: true }]) {
      const dir = project(files, { packageJson });
      const [line] = lines(await cli(dir, ["check", "emails", "--json"]));
      expect(line.error, JSON.stringify(packageJson)).toMatch(/^emails\/_parts\/footer\.tsx:3:\d+: \S/);
    }
  });
});
