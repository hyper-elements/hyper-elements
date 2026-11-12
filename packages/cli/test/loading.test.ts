/**
 * Loading templates as a project's own code loads: path aliases, workspace packages, CommonJS and ES module projects;
 * their props from PreviewProps (through memo and forwardRef) or --props.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, email, lines, link, MODULES, ON_BUN, project } from "./helpers";

const textOf = (dir: string, name: string) => readFileSync(join(dir, "out", `${name}.txt`), "utf8");

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
    expect(readFileSync(join(dir, "apps/web/out/a.txt"), "utf8")).toContain("From Ada, in a workspace package");
  });

  it("a template in a CommonJS project, and one in an ES module project", async () => {
    for (const type of ["commonjs", "module"]) {
      const dir = project({ "emails/a.tsx": email(`A ${type} template`) }, { packageJson: { name: "fixture", type } });
      const ran = await cli(dir, ["render", "emails"]);
      expect(ran.code, ran.stderr + ran.stdout).toBe(0);
      expect(textOf(dir, "a")).toContain(`A ${type} template`);
    }
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
