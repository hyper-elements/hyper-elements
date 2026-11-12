/**
 * The loader module beside each template: Elements and React come to the CLI as they come to the template (the same
 * objects), and the module is never left behind, never written over a file, and never written where it can't be.
 */
import { spawn } from "node:child_process";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { BIN, cli, cliEnv, email, leftovers, lines, MODULES, ON_BUN, project, REPO, tsconfigsOf, WINDOWS } from "./helpers";

const REEXPORTS = `import * as React from "react";
import { Email, Text, render } from "@hyper-elements/react";
export { render, React };
export default function Template() { return <Email><Text>Same objects</Text></Email>; }
`;

/** The `[probe]` lines a run printed (HYPER_ELEMENTS_CLI_PROBE). */
function probes(stderr: string): any[] {
  return stderr
    .split("\n")
    .filter((line) => line.startsWith("[probe] "))
    .map((line) => JSON.parse(line.slice(8)));
}

describe("what the CLI loads is what the template loads", () => {
  for (const type of ["module", "commonjs"]) {
    it(`in ${type === "module" ? "an ES module" : "a CommonJS"} project: the template's render and React are the CLI's`, async () => {
      const dir = project({ "emails/a.tsx": REEXPORTS }, { packageJson: { name: "fixture", type } });
      const ran = await cli(dir, ["render", "emails"], { env: { HYPER_ELEMENTS_CLI_PROBE: "1" } });
      expect(ran.code, ran.stderr).toBe(0);
      expect(probes(ran.stderr)).toEqual([{ file: join(dir, "emails/a.tsx"), sameRender: true, sameReact: true }]);
    });
  }

  it("in a package whose tsconfig aliases @hyper-elements/react to its source", async () => {
    const source = join(REPO, "packages/react/src/primitives/index.ts");
    const dir = project({
      "tsconfig.json": JSON.stringify({ compilerOptions: { jsx: "react-jsx", paths: { "@hyper-elements/react": [source] } } }),
      "emails/a.tsx": REEXPORTS,
    });
    const ran = await cli(dir, ["render", "emails"], { env: { HYPER_ELEMENTS_CLI_PROBE: "1" } });
    expect(ran.code, ran.stderr + ran.stdout).toBe(0);
    expect(probes(ran.stderr)).toEqual([{ file: join(dir, "emails/a.tsx"), sameRender: true, sameReact: true }]);
    expect(readFileSync(join(dir, "out/a.txt"), "utf8")).toContain("Same objects");
  });

  it("renders a template with a component(), a theme, a hook and a context as render() does in-process", async () => {
    const template = `import { createContext, useContext, useState } from "react";
import { Button, component, defineTheme, Email, prop, Section, Text } from "@hyper-elements/react";
const Brand = createContext("nobody");
const Card = component({
  type: "acme.Card",
  label: "Card",
  props: { title: prop.text({ label: "Title", required: true }) },
  render: ({ title }) => <Section style={{ padding: 16 }}><Text>{title}</Text></Section>,
});
const theme = defineTheme({ colors: { primary: "#7c3aed", primaryForeground: "#ffffff" } });
function Signed() {
  const name = useContext(Brand);
  const [count] = useState(3);
  return <Text>{name} sent {count}</Text>;
}
export default function Template({ title }: { title: string }) {
  return (
    <Brand.Provider value="Acme">
      <Email theme={theme}>
        <Card title={title} />
        <Signed />
        <Button href="https://example.com">Go</Button>
      </Email>
    </Brand.Provider>
  );
}
Template.PreviewProps = { title: "Hello" };
`;
    const dir = project({ "emails/a.tsx": template });
    const ran = await cli(dir, ["render", "emails"]);
    expect(ran.code, ran.stderr + ran.stdout).toBe(0);
    // The same JSX, rendered here with this repository's Elements and React.
    const { default: Template } = await import(pathToFileURL(join(dir, "emails/a.tsx")).href);
    const { render } = await import(pathToFileURL(join(MODULES["@hyper-elements/react"], "dist/primitives.js")).href);
    const React = await import("react");
    const expected = await render(React.createElement(Template, Template.PreviewProps));
    expect(readFileSync(join(dir, "out/a.html"), "utf8")).toBe(expected.html);
    expect(readFileSync(join(dir, "out/a.txt"), "utf8")).toBe(expected.text);
    expect(expected.text).toContain("Acme sent 3");
  });
});

describe("the loader module", () => {
  it("is gone after the run, with the run's tsconfig, and after a run whose child was killed", async () => {
    const dir = project({ "emails/a.tsx": email("A"), "emails/b.tsx": email("B") });
    let ran = await cli(dir, ["render", "emails"]);
    expect(ran.code).toBe(0);
    expect(leftovers(dir)).toEqual([]);
    expect(tsconfigsOf(ran.pid)).toEqual([]);
    // A child killed while it loads a template (its loader module still there).
    writeFileSync(join(dir, "emails/b.tsx"), `process.kill(process.pid, "SIGKILL");\n${email("B")}`);
    ran = await cli(dir, ["render", "emails"]);
    expect(ran.code).toBe(1);
    expect(leftovers(dir)).toEqual([]);
    expect(tsconfigsOf(ran.pid)).toEqual([]);
  });

  it("is never written over an existing file of its name", async () => {
    const dir = project({ "emails/a.tsx": email("Written beside") });
    // The first name the run's first child would take: written as the run starts, before its child does.
    const ran = await new Promise<{ code: number | null; kept: string }>((resolve) => {
      const child = spawn(ON_BUN ? "bun" : process.execPath, [BIN, "render", "emails"], { cwd: dir, env: cliEnv(), stdio: "ignore" });
      const taken = join(dir, "emails", `.hyper-elements-${child.pid}-0.tsx`);
      writeFileSync(taken, "keep me\n");
      child.on("close", (code) => resolve({ code, kept: readFileSync(taken, "utf8") }));
    });
    expect(ran.code).toBe(0);
    expect(ran.kept).toBe("keep me\n");
    expect(readFileSync(join(dir, "out/a.txt"), "utf8")).toContain("Written beside");
  });

  it.skipIf(WINDOWS || process.getuid?.() === 0)("fails a template whose folder the CLI can't write to with cli/read-only", async () => {
    const dir = project({ "emails/a.tsx": email(), "other/b.tsx": email() });
    chmodSync(join(dir, "emails"), 0o555);
    try {
      const ran = await cli(dir, ["check", "emails", "other", "--json"]);
      expect(ran.code).toBe(1);
      const [a, b] = lines(ran);
      expect(a).toMatchObject({ file: "emails/a.tsx", status: "error", diagnostics: [{ code: "cli/read-only", severity: "error", path: "" }] });
      expect(a.diagnostics[0].message).toContain("emails");
      expect(b).toMatchObject({ file: "other/b.tsx", status: "ok" });
    } finally {
      chmodSync(join(dir, "emails"), 0o755);
    }
  });
});
