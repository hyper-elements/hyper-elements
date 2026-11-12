/**
 * React copies: a template whose process loads two Reacts fails with cli/two-reacts (hooks and context break across
 * them); one React reached through several links, or two packages each with a React of its own, pass.
 */
import { copyFileSync, cpSync, mkdirSync, readdirSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, email, lines, link, MODULES, project } from "./helpers";

/** Elements' built package copied into `folder`'s node_modules (not linked), so it resolves React from there. */
function copyElements(folder: string): void {
  const from = MODULES["@hyper-elements/react"];
  const to = join(folder, "node_modules/@hyper-elements/react");
  mkdirSync(join(to, "dist"), { recursive: true });
  copyFileSync(join(from, "package.json"), join(to, "package.json"));
  for (const file of readdirSync(join(from, "dist"))) {
    if (/^(primitives|inspect)\.(js|cjs)$/.test(file)) copyFileSync(join(from, "dist", file), join(to, "dist", file));
  }
}

/** React DOM 19 copied into `folder`'s node_modules, with React 19 beside it (in its own node_modules). */
function copyReactDom19(folder: string): void {
  const to = join(folder, "node_modules/react-dom");
  cpSync(realpathSync(MODULES["react-dom19"]), to, { recursive: true, dereference: true });
  link(to, "react", MODULES.react19);
}

const HOOK = `import { useState } from "react";
import { Email, Text } from "@hyper-elements/react";
export default function Template() {
  const [n] = useState(1);
  return <Email><Text>Hook {n}</Text></Email>;
}
`;

function twoReacts(line: any): void {
  expect(line.status).toBe("error");
  expect(line.diagnostics).toHaveLength(1);
  expect(line.diagnostics[0]).toMatchObject({ code: "cli/two-reacts", severity: "error", path: "" });
  expect(line.diagnostics[0].message).toMatch(/loads 2 copies of React/);
}

describe("cli/two-reacts", () => {
  it("fails a template whose own react differs from Elements'", async () => {
    const dir = project({ "emails/a.tsx": HOOK }, { modules: { react: "react19", "react-dom": "react-dom19", "@hyper-elements/react": "@hyper-elements/react" } });
    const ran = await cli(dir, ["check", "emails", "--json"]);
    expect(ran.code).toBe(1);
    twoReacts(lines(ran)[0]);
    expect(lines(ran)[0].diagnostics[0].message).toContain("19.1.0");
    expect(lines(ran)[0].diagnostics[0].message).toContain("18.3.1");
  });

  it("fails an app template importing a shared package that brings its own React and uses a hook", async () => {
    const dir = project({
      "emails/a.tsx": `import { Email } from "@hyper-elements/react";
import { Counter } from "shared";
export default function Template() { return <Email><Counter /></Email>; }
`,
      "shared/package.json": JSON.stringify({ name: "shared", type: "module", main: "./index.tsx" }),
      "shared/index.tsx": `import { useState } from "react";
import { Text } from "@hyper-elements/react";
export function Counter() { const [n] = useState(2); return <Text>Count {n}</Text>; }
`,
    });
    link(join(dir, "shared"), "react", MODULES.react19);
    link(join(dir, "shared"), "@hyper-elements/react", MODULES["@hyper-elements/react"]);
    link(dir, "shared", join(dir, "shared"));
    const ran = await cli(dir, ["check", "emails", "--json"]);
    expect(ran.code).toBe(1);
    twoReacts(lines(ran)[0]);
  });

  it("fails where a hoisted react-dom resolves another React", async () => {
    // Elements and the template on the project's React 18; the project's react-dom on a React 19 of its own.
    const dir = project({ "emails/a.tsx": HOOK }, { modules: { react: "react" } });
    copyElements(dir);
    copyReactDom19(dir);
    const ran = await cli(dir, ["check", "emails", "--json"]);
    expect(ran.code).toBe(1);
    twoReacts(lines(ran)[0]);
  });

  it("passes a pnpm project with one React reached through several links", async () => {
    const dir = project({
      "emails/a.tsx": `import { Email } from "@hyper-elements/react";
import { Counter } from "shared";
export default function Template() { return <Email><Counter /></Email>; }
`,
      "shared/package.json": JSON.stringify({ name: "shared", type: "module", main: "./index.tsx" }),
      "shared/index.tsx": `import { useState } from "react";
import { Text } from "@hyper-elements/react";
export function Counter() { const [n] = useState(2); return <Text>Count {n}</Text>; }
`,
    });
    // Another link to the same React, from the shared package.
    link(join(dir, "shared"), "react", MODULES.react);
    link(join(dir, "shared"), "@hyper-elements/react", MODULES["@hyper-elements/react"]);
    link(dir, "shared", join(dir, "shared"));
    const ran = await cli(dir, ["render", "emails", "--json"]);
    expect(ran.code, ran.stderr).toBe(0);
    expect(lines(ran)[0]).toMatchObject({ status: "ok", root: "Email" });
  });
});

describe("React copies across a run", () => {
  it("two packages sharing a root tsconfig, each with its own valid React, both render", async () => {
    const dir = project(
      {
        "tsconfig.json": JSON.stringify({ compilerOptions: { jsx: "react-jsx" } }),
        "a/package.json": JSON.stringify({ name: "a", type: "module" }),
        "a/emails/a.tsx": HOOK,
        "b/package.json": JSON.stringify({ name: "b", type: "module" }),
        "b/emails/b.tsx": HOOK,
      },
      { packageJson: null, modules: [] },
    );
    link(join(dir, "a"), "react", MODULES.react);
    link(join(dir, "a"), "react-dom", MODULES["react-dom"]);
    link(join(dir, "a"), "@hyper-elements/react", MODULES["@hyper-elements/react"]);
    link(join(dir, "b"), "react", MODULES.react19);
    copyReactDom19(join(dir, "b"));
    copyElements(join(dir, "b"));
    const ran = await cli(dir, ["render", "a/emails", "b/emails", "--json"]);
    expect(ran.code, ran.stderr).toBe(0);
    expect(lines(ran).slice(0, 2).map((l) => [l.file, l.status])).toEqual([
      ["a/emails/a.tsx", "ok"],
      ["b/emails/b.tsx", "ok"],
    ]);
  });

  it("in one package, a template importing a package with its own React fails, and its neighbour, rerun alone, passes", async () => {
    const dir = project({
      "emails/a.tsx": email("Neighbour"),
      "emails/b.tsx": `import { Email } from "@hyper-elements/react";
import { Counter } from "shared";
export default function Template() { return <Email><Counter /></Email>; }
`,
      "emails/c.tsx": email("After"),
      "shared/package.json": JSON.stringify({ name: "shared", type: "module", main: "./index.tsx" }),
      "shared/index.tsx": `import { useState } from "react";
import { Text } from "@hyper-elements/react";
export function Counter() { const [n] = useState(2); return <Text>Count {n}</Text>; }
`,
    });
    link(join(dir, "shared"), "react", MODULES.react19);
    link(join(dir, "shared"), "@hyper-elements/react", MODULES["@hyper-elements/react"]);
    link(dir, "shared", join(dir, "shared"));
    const ran = await cli(dir, ["render", "emails", "--json"]);
    expect(ran.code).toBe(1);
    const got = lines(ran);
    expect(got[0]).toMatchObject({ file: "emails/a.tsx", status: "ok", outputs: ["out/a.html", "out/a.txt"] });
    twoReacts(got[1]);
    expect(got[2]).toMatchObject({ file: "emails/c.tsx", status: "ok" });
  });
});
