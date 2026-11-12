/**
 * Exit codes: 0 when every template rendered or checked without errors, 1 when a template has errors or failed, 2
 * when the run couldn't do what it was asked. A run never prints an error and exits 0.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { BIN, cli, cliEnv, email, exists, lines, ON_BUN, project } from "./helpers";

const WIDE = `import { Email, Image } from "@hyper-elements/react";
export default function Wide() {
  return <Email width={600}><Image src={{ src: "https://example.com/a.png", width: 600, height: 400 }} alt="" style={{ width: 900 }} /></Email>;
}
`;

describe("exit 0", () => {
  it("when every template renders", async () => {
    const dir = project({ "emails/a.tsx": email("A"), "emails/b.tsx": email("B") });
    const ran = await cli(dir, ["render", "emails"]);
    expect(ran.code).toBe(0);
    expect(exists(join(dir, "out/a.html"))).toBe(true);
    expect(exists(join(dir, "out/b.txt"))).toBe(true);
  });

  it("with a template beside inputs that aren't: those are skipped", async () => {
    const dir = project({ "emails/a.tsx": email("A"), "emails/value.ts": `export default { not: "a component" };\n` });
    const ran = await cli(dir, ["check", "emails/a.tsx", "emails/value.ts", "--json"]);
    expect(ran.code).toBe(0);
    expect(lines(ran).map((l) => l.status ?? l.exitCode)).toEqual(["ok", "skipped", 0]);
    expect(ran.stderr).not.toContain("no templates");
  });

  it("for --help or -h after a command, wherever among its options: the help, on stdout", async () => {
    const dir = project({});
    for (const args of [["render", "--help"], ["check", "emails", "-h"], ["preview", "--json", "--help"], ["dev", "--help"], ["help"]]) {
      const ran = await cli(dir, args);
      expect(ran.code, args.join(" ")).toBe(0);
      expect(ran.stdout).toContain("Usage:\n  hyper-elements render");
      expect(ran.stderr).toBe("");
    }
    // After `--` it's a file's name.
    const named = await cli(dir, ["check", "--", "--help"]);
    expect(named.code).toBe(2);
    expect(named.stdout).toBe("");
  });

  it("with warnings, up to --max-warnings", async () => {
    const dir = project({ "emails/wide.tsx": WIDE });
    expect((await cli(dir, ["check", "emails"])).code).toBe(0);
    expect((await cli(dir, ["check", "emails", "--max-warnings", "1"])).code).toBe(0);
  });
});

describe("exit 1", () => {
  it("when a template has errors", async () => {
    const dir = project({ "emails/a.tsx": `import { Email, Text } from "@hyper-elements/react";\n// @ts-expect-error\nexport default () => <Email><Text color="red">x</Text></Email>;\n` });
    const ran = await cli(dir, ["render", "emails"]);
    expect(ran.code).toBe(1);
    expect(exists(join(dir, "out/a.html"))).toBe(false);
  });

  it("when a template throws while loading, or while rendering", async () => {
    const dir = project({
      "emails/a.tsx": `throw new Error("broken at load");\nexport default function A() { return null; }\n`,
      "emails/b.tsx": `export default function B(): never { throw new Error("broken in render"); }\n`,
    });
    const ran = await cli(dir, ["check", "emails", "--json"]);
    expect(ran.code).toBe(1);
    expect(lines(ran).slice(0, 2).map((l) => [l.status, l.error])).toEqual([
      ["error", "broken at load"],
      ["error", "broken in render"],
    ]);
  });

  it("past --max-warnings", async () => {
    const dir = project({ "emails/wide.tsx": WIDE });
    const ran = await cli(dir, ["check", "emails", "--max-warnings", "0", "--json"]);
    expect(ran.code).toBe(1);
    expect(lines(ran).at(-1)).toMatchObject({ summary: { warnings: 1, errors: 0 }, exitCode: 1 });
  });
});

describe("exit 2", () => {
  it("on a usage error", async () => {
    const dir = project({ "emails/a.tsx": email() });
    for (const args of [["render", "emails", "--nope"], ["paint", "emails"], ["render"], ["outline", "emails/a.tsx", "--json"], ["check", "emails", "--max-warnings", "x"]]) {
      const ran = await cli(dir, args);
      expect(ran.code, args.join(" ")).toBe(2);
      expect(ran.stderr).toContain("hyper-elements:");
      expect(ran.stdout).toBe("");
    }
  });

  it("for a folder that holds no template, or a path that doesn't exist", async () => {
    const dir = project({ "emails/notes.md": "# no templates", "emails/helper.ts": "export const x = 1;\n" });
    expect((await cli(dir, ["render", "emails"])).code).toBe(2);
    expect((await cli(dir, ["render", "missing"])).code).toBe(2);
  });

  it("when no input turns out to be a template, given by name or found in a folder, each still listed", async () => {
    const dir = project({
      "emails/named.tsx": `import { Email, Text } from "@hyper-elements/react";\nexport function Named() { return <Email><Text>Hi</Text></Email>; }\nexport default "not a component";\n`,
      "emails/element.tsx": `import { Email, Text } from "@hyper-elements/react";\nexport default <Email><Text>Hi</Text></Email>;\n`,
      "emails/value.ts": `export default { not: "a component" };\n`,
    });
    const one = await cli(dir, ["check", "emails/named.tsx", "--json"]);
    expect(one.code).toBe(2);
    expect(lines(one)).toEqual([
      expect.objectContaining({ file: "emails/named.tsx", status: "skipped", diagnostics: [expect.objectContaining({ code: "cli/not-a-template" })] }),
      expect.objectContaining({ summary: expect.objectContaining({ templates: 1, skipped: 1 }), exitCode: 2 }),
    ]);
    expect(one.stderr).toContain("hyper-elements: no templates");
    const folder = await cli(dir, ["render", "emails"]);
    expect(folder.code).toBe(2);
    for (const name of ["named.tsx", "element.tsx", "value.ts"]) expect(folder.stdout).toContain(`- emails/${name} skipped`);
    expect(folder.stdout).toContain("3 templates: 0 errors, 0 warnings, 3 skipped");
    expect(folder.stderr).toContain("none of the 3 inputs is one");
    expect(exists(join(dir, "out"))).toBe(false);
  });

  it("where the template's folder has no Elements", async () => {
    const dir = project({ "emails/a.tsx": email() }, { modules: ["react", "react-dom"] });
    const ran = await cli(dir, ["check", "emails", "--json"]);
    expect(ran.code).toBe(2);
    expect(lines(ran)[0]).toMatchObject({ status: "error", diagnostics: [{ code: "cli/elements-missing", severity: "error" }] });
  });

  it("where the template's Elements is outside the CLI's range", async () => {
    const dir = project({ "emails/a.tsx": `import { render } from "@hyper-elements/react";\nexport default function A() { return render; }\n` }, { modules: ["react", "react-dom"] });
    const fake = join(dir, "node_modules/@hyper-elements/react");
    mkdirSync(fake, { recursive: true });
    writeFileSync(join(fake, "package.json"), JSON.stringify({ name: "@hyper-elements/react", version: "0.3.1", type: "module", exports: { ".": "./index.js", "./inspect": "./index.js" } }));
    writeFileSync(join(fake, "index.js"), "export const render = () => {};\n");
    const ran = await cli(dir, ["check", "emails", "--json"]);
    expect(ran.code).toBe(2);
    expect(lines(ran)[0].diagnostics[0]).toMatchObject({ code: "cli/elements-version" });
    expect(lines(ran)[0].diagnostics[0].message).toContain("0.3.1");
    expect(lines(ran)[0].diagnostics[0].message).toContain(">=0.4.0 <0.5.0");
  });

  it("for outputs that collide", async () => {
    const dir = project({ "emails/Welcome.tsx": email("upper"), "emails/welcome.jsx": email("lower") });
    const ran = await cli(dir, ["render", "emails"]);
    expect(ran.code).toBe(2);
    expect(exists(join(dir, "out"))).toBe(false);
  });

  it("when a template calls process.exit (while loading or rendering)", async () => {
    const dir = project({
      "emails/a.tsx": `process.exit(0);\nexport default function A() { return null; }\n`,
      "emails/b.tsx": `import { Email, Text } from "@hyper-elements/react";\nexport default function B() { process.exit(0); return <Email><Text>x</Text></Email>; }\n`,
    });
    const ran = await cli(dir, ["check", "emails", "--json"]);
    expect(ran.code).toBe(2);
    expect(lines(ran).slice(0, 2).map((l) => l.error)).toEqual(["a template called process.exit(0)", "a template called process.exit(0)"]);
  });

  it("when template code throws outside a render (a timer)", async () => {
    const dir = project({ "emails/a.tsx": email("x", `setTimeout(() => { throw new Error("from a timer"); });`) });
    const ran = await cli(dir, ["render", "emails", "--json"]);
    expect(ran.code).toBe(2);
    expect(lines(ran)[0].status).toBe("ok");
    expect(lines(ran)[1].summary.late).toEqual([{ kind: "throw", group: { package: ".", tsconfig: null }, message: "from a timer" }]);
  });

  it("on a runtime it doesn't support, with the version found and the ones supported", async () => {
    const dir = project({});
    // The runtime's own version, faked before bin.js reads it.
    const fake = join(dir, "old-runtime.mjs");
    writeFileSync(
      fake,
      `const versions = { ...process.versions, ${ON_BUN ? `bun: "1.2.9"` : `node: "18.19.0"`} };
const real = process;
globalThis.process = new Proxy(real, {
  get: (t, k) => (k === "versions" ? versions : typeof t[k] === "function" ? t[k].bind(t) : t[k]),
  set: (t, k, v) => ((t[k] = v), true),
});
await import(${JSON.stringify(pathToFileURL(BIN).href)});
`,
    );
    const ran = await new Promise<{ code: number | null; stderr: string }>((resolve) => {
      const child = spawn(ON_BUN ? "bun" : process.execPath, [fake, "render", "."], { cwd: dir, env: cliEnv() });
      let stderr = "";
      child.stderr.on("data", (d) => (stderr += d));
      child.on("close", (code) => resolve({ code, stderr }));
    });
    expect(ran.code).toBe(2);
    expect(ran.stderr).toContain(ON_BUN ? "Bun 1.2.9" : "Node.js 18.19.0");
    expect(ran.stderr).toContain("Node.js 20.6 or later, or Bun 1.3 or later");
  });
});
