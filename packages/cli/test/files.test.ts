/**
 * The exact file: a JavaScript template beside its TypeScript twin fails with cli/ts-twin (tsx would load the twin
 * for it), every other template loads itself (welcome.ts beside welcome.tsx), whatever its extension or name.
 */
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, lines, project, WINDOWS } from "./helpers";

/** A template in a module syntax any of its extensions takes (no JSX, ES module syntax). */
const module = (label: string) => `import { createElement } from "react";
import { Email, Heading } from "@hyper-elements/react";
export default function Template() { return createElement(Email, null, createElement(Heading, null, ${JSON.stringify(label)})); }
`;

const PAIRS: Array<[string, string]> = [
  ["js", "ts"],
  ["js", "tsx"],
  ["jsx", "ts"],
  ["jsx", "tsx"],
  ["mjs", "mts"],
  ["cjs", "cts"],
];

describe("TypeScript twins", () => {
  for (const type of ["module", "commonjs"]) {
    for (const [js, ts] of PAIRS) {
      it(`x.${js} beside x.${ts} (${type}): the JavaScript one fails with cli/ts-twin, the twin loads`, async () => {
        const dir = project({ [`emails/x.${js}`]: "throw new Error('the JavaScript file was loaded');\n", [`emails/x.${ts}`]: module(`the ${ts} twin`) }, { packageJson: { name: "fixture", type } });
        const ran = await cli(dir, ["check", `emails/x.${js}`, `emails/x.${ts}`, "--json"]);
        const [jsLine, tsLine] = lines(ran);
        expect(jsLine).toMatchObject({ file: `emails/x.${js}`, root: null, status: "error", outputs: [], diagnostics: [{ code: "cli/ts-twin", severity: "error", path: "" }] });
        expect(jsLine.diagnostics[0].message).toContain(`emails/x.${ts}`);
        expect(tsLine, ran.stderr).toMatchObject({ file: `emails/x.${ts}`, root: "Email", status: "ok" });
        expect(ran.code).toBe(1);
      });
    }
  }
});

describe("the exact file", () => {
  it("welcome.ts beside welcome.tsx: each loads itself", async () => {
    const label = { ts: "[the .ts file]", tsx: "[the .tsx file]" };
    const dir = project({ "emails/welcome.ts": module(label.ts), "emails/welcome.tsx": module(label.tsx) });
    for (const ext of ["ts", "tsx"] as const) {
      const ran = await cli(dir, ["render", `emails/welcome.${ext}`, "--stdout"]);
      expect(ran.code, ran.stderr).toBe(0);
      expect(ran.stdout).toContain(label[ext]);
      expect(ran.stdout).not.toContain(label[ext === "ts" ? "tsx" : "ts"]);
    }
  });

  it(".mts and .mjs templates load", async () => {
    const dir = project({ "emails/a.mts": module("an mts template"), "emails/b.mjs": module("an mjs template") }, { packageJson: { name: "fixture" } });
    const ran = await cli(dir, ["render", "emails", "--json"]);
    expect(ran.code, ran.stderr).toBe(0);
    expect(lines(ran).slice(0, 2).map((l) => [l.file, l.status, l.root])).toEqual([
      ["emails/a.mts", "ok", "Email"],
      ["emails/b.mjs", "ok", "Email"],
    ]);
  });

  it("a .cjs and a .cts template load", async () => {
    const dir = project({
      "emails/a.cjs": `const { createElement } = require("react");
const { Email, Heading } = require("@hyper-elements/react");
module.exports = function Template() { return createElement(Email, null, createElement(Heading, null, "a cjs template")); };
`,
      "emails/b.cts": module("a cts template"),
    });
    const ran = await cli(dir, ["render", "emails/a.cjs", "emails/b.cts", "--json"]);
    expect(ran.code, ran.stdout + ran.stderr).toBe(0);
    expect(lines(ran).slice(0, 2).map((l) => [l.status, l.root])).toEqual([
      ["ok", "Email"],
      ["ok", "Email"],
    ]);
  });

  it("names with a space, # and %", async () => {
    const dir = project({ "my emails/a #1 100%.tsx": module("odd but fine") });
    const ran = await cli(dir, ["render", "my emails", "--json"]);
    expect(ran.code, ran.stderr).toBe(0);
    expect(lines(ran)[0]).toMatchObject({ file: "my emails/a #1 100%.tsx", status: "ok", outputs: ["out/a #1 100%.html", "out/a #1 100%.txt"] });
  });

  it.runIf(WINDOWS)("a Windows path, with backslashes and a drive letter", async () => {
    const dir = project({ "my emails\\a.tsx": module("on Windows") });
    const ran = await cli(dir, ["render", join(dir, "my emails", "a.tsx"), "--json"]);
    expect(ran.code, ran.stderr).toBe(0);
    expect(lines(ran)[0]).toMatchObject({ file: "my emails/a.tsx", status: "ok", outputs: ["out/a.html", "out/a.txt"] });
  });
});
