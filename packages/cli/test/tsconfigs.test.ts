/**
 * Templates compile with their own tsconfig: a run with two, in the order A, B, A, in ES module and CommonJS
 * projects, gives each template its own settings (tsx's registers share one config, so each runs in a process of its
 * own).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, lines, project } from "./helpers";

const ALIASED = (name: string) => `import { Email, Text } from "@hyper-elements/react";
import { word } from "@lib/word";
export default function T() { return <Email><Text>${name} says {word}</Text></Email>; }
`;
const PLAIN = (name: string) => `import { Email, Text } from "@hyper-elements/react";
export default function T() { return <Email><Text>${name} has no alias</Text></Email>; }
`;

describe("two tsconfigs in one run", () => {
  for (const type of ["module", "commonjs"]) {
    it(`A, B, A in ${type === "module" ? "ES module" : "CommonJS"} projects: each template compiles with its own config`, async () => {
      const dir = project(
        {
          // A: a path alias B lacks.
          "a/tsconfig.json": JSON.stringify({ compilerOptions: { jsx: "react-jsx", baseUrl: ".", paths: { "@lib/*": ["./lib/*"] } } }),
          "a/lib/word.ts": `export const word = "from A's alias";\n`,
          "a/emails/one.tsx": ALIASED("A one"),
          "a/emails/three.tsx": ALIASED("A three"),
          // B: JSX preserved, which the CLI compiles anyway.
          "b/tsconfig.json": JSON.stringify({ compilerOptions: { jsx: "preserve" } }),
          "b/emails/two.tsx": PLAIN("B two"),
        },
        { packageJson: { name: "fixture", type } },
      );
      const ran = await cli(dir, ["render", "a/emails/one.tsx", "b/emails/two.tsx", "a/emails/three.tsx", "--json"]);
      expect(ran.code, ran.stderr).toBe(0);
      expect(lines(ran).slice(0, 3).map((l) => l.status)).toEqual(["ok", "ok", "ok"]);
      const text = (path: string) => readFileSync(join(dir, "out", path), "utf8");
      expect(text("a/emails/one.txt")).toContain("A one says from A's alias");
      expect(text("b/emails/two.txt")).toContain("B two has no alias");
      expect(text("a/emails/three.txt")).toContain("A three says from A's alias");
    });
  }

  it("a CommonJS template with a path alias and jsx: preserve renders", async () => {
    const dir = project(
      {
        "tsconfig.json": JSON.stringify({ compilerOptions: { jsx: "preserve", baseUrl: ".", paths: { "@lib/*": ["./lib/*"] } } }),
        "lib/word.ts": `export const word = "an alias, in CommonJS";\n`,
        "emails/a.tsx": ALIASED("It"),
      },
      { packageJson: { name: "fixture" } },
    );
    const ran = await cli(dir, ["render", "emails"]);
    expect(ran.code, ran.stderr + ran.stdout).toBe(0);
    expect(readFileSync(join(dir, "out/emails/a.txt"), "utf8")).toContain("It says an alias, in CommonJS");
  });
});
