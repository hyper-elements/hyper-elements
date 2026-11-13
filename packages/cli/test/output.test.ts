/**
 * What a run writes: `--json` lines as their types say, the worked example line for line, `--stdout`, and a
 * template's own output kept off stdout.
 */
import { describe, expect, it } from "vitest";
import { cli, email, lines, project, write } from "./helpers";

const INPUT_KEYS = ["version", "command", "file", "input", "root", "status", "outputs", "diagnostics"];

/** Checks a line against the input line's type. */
function isInputLine(line: any): void {
  expect(Object.keys(line).slice(0, INPUT_KEYS.length)).toEqual(INPUT_KEYS);
  expect(line.version).toBe(1);
  expect(["render", "check"]).toContain(line.command);
  expect(typeof line.file).toBe("string");
  expect(line.input).toBe("template");
  expect([null, "Email", "Page", "Document", "Canvas"]).toContain(line.root);
  expect(["ok", "error", "skipped"]).toContain(line.status);
  expect(Array.isArray(line.outputs)).toBe(true);
  for (const d of line.diagnostics) {
    expect(typeof d.code).toBe("string");
    expect(["error", "warning", "info"]).toContain(d.severity);
    expect(typeof d.message).toBe("string");
    expect(typeof d.path).toBe("string");
  }
  for (const key of Object.keys(line).slice(INPUT_KEYS.length)) expect(key).toBe("error");
  if ("error" in line) {
    expect(line.status).toBe("error");
    expect(typeof line.error).toBe("string");
  }
}

describe("--json", () => {
  it("gives exactly the worked example's four lines: two error diagnostics, a load failure, an element export", async () => {
    const dir = project({
      "emails/a.tsx": `import { Email, Section } from "@hyper-elements/react";
export default function A() {
  // @ts-expect-error: not a prop of Section, nor a style of Email
  return <Email style={{ margin: 0 }}><Section color="red" /></Email>;
}
`,
      "emails/b.tsx": `import { x } from "./missing";\nexport default function B() { return x; }\n`,
      "emails/c.tsx": `import { Email, Text } from "@hyper-elements/react";\nexport default <Email><Text>Hi</Text></Email>;\n`,
    });
    const ran = await cli(dir, ["check", "emails", "--json"]);
    const got = lines(ran);
    expect(got).toHaveLength(4);
    for (const line of got.slice(0, 3)) isInputLine(line);
    const messages = got[0].diagnostics.map((d: any) => d.message);
    expect(messages.every((m: string) => m.length > 0)).toBe(true);
    // Elements reports a node's own problems before its children's: the root's style, then the Section's prop (the
    // CLI passes diagnostics on in the order Elements gives them).
    const expected = [
      `{"version":1,"command":"check","file":"emails/a.tsx","input":"template","root":"Email","status":"error","outputs":[],"diagnostics":[{"code":"style/unknown","severity":"error","message":${JSON.stringify(messages[0])},"path":"root.style.margin"},{"code":"prop/unknown","severity":"error","message":${JSON.stringify(messages[1])},"path":"root.children[0].props.color"}]}`,
      `{"version":1,"command":"check","file":"emails/b.tsx","input":"template","root":null,"status":"error","outputs":[],"diagnostics":[],"error":"Cannot find module './missing'"}`,
      `{"version":1,"command":"check","file":"emails/c.tsx","input":"template","root":null,"status":"skipped","outputs":[],"diagnostics":[{"code":"cli/element-export","severity":"info","message":"Export the component, not an element","path":""}]}`,
      `{"version":1,"summary":{"templates":3,"errors":2,"warnings":0,"skipped":1,"late":[]},"exitCode":1}`,
    ];
    expect(ran.stdout).toBe(expected.map((line) => `${line}\n`).join(""));
    expect(ran.code).toBe(1);
    expect(got[3].exitCode).toBe(ran.code);
  });

  it("gives a line per input whose child crashed before its result: status error, the exit code in error", async () => {
    const dir = project({
      "emails/a.tsx": email("first"),
      "emails/b.tsx": `import { Email, Text } from "@hyper-elements/react";
export default function B() {
  // The child process itself ends: not something a template does by accident.
  (process as any).reallyExit(1);
  return <Email><Text>never</Text></Email>;
}
`,
    });
    const ran = await cli(dir, ["check", "emails", "--json"]);
    const got = lines(ran);
    expect(got[0]).toMatchObject({ file: "emails/a.tsx", status: "ok" });
    expect(got[1]).toEqual({ version: 1, command: "check", file: "emails/b.tsx", input: "template", root: null, status: "error", outputs: [], diagnostics: [], error: "child exited with 1" });
    expect(got[2].summary).toMatchObject({ templates: 2, errors: 1, late: [] });
    expect(ran.code).toBe(1);
  });

  it("keeps a template's console.log off stdout (on stderr)", async () => {
    const dir = project({ "emails/a.tsx": email("Hi", `console.log("from the template");`) });
    const ran = await cli(dir, ["render", "emails", "--json"]);
    expect(ran.code).toBe(0);
    expect(() => lines(ran)).not.toThrow();
    expect(ran.stdout).not.toContain("from the template");
    expect(ran.stderr).toContain("from the template");
    expect(lines(ran)[0]).toMatchObject({ command: "render", root: "Email", status: "ok", outputs: ["out/emails/a.html", "out/emails/a.txt"] });
  });

  it("counts a late throw in the summary, whose exitCode is the process's, with a slow stdout", async () => {
    // Far more --json than a pipe holds (a warning per image), so the CLI's writes wait on a pipe that isn't read for a while.
    const images = `{Array.from({ length: 3000 }, (_, i) => <Image key={i} src={{ src: "https://example.com/a.png", width: 600, height: 400 }} alt="" style={{ width: 900 }} />)}`;
    const dir = project({
      "emails/a.tsx": `import { Email, Image } from "@hyper-elements/react";
setTimeout(() => { throw new Error("thrown from a timer"); }, 0);
export default function A() { return <Email width={600}>${images}</Email>; }
`,
      // A timer set to throw while the parent writes: it runs before done and is counted, or never runs.
      "emails/b.tsx": email("Bye", `setTimeout(() => { throw new Error("late timer"); }, 1500);`),
    });
    const ran = await cli(dir, ["check", "emails", "--json"], { slowStdout: 2500 });
    expect(ran.stdout.length).toBeGreaterThan(256 * 1024);
    const got = lines(ran);
    const warningsOf = (line: any) => line.diagnostics.filter((d: any) => d.severity === "warning").length;
    expect(warningsOf(got[0])).toBeGreaterThan(1000);
    const warnings = got.slice(0, -1).reduce((sum: number, line: any) => sum + warningsOf(line), 0);
    const summary = got[got.length - 1];
    expect(summary.summary.late).toEqual([{ kind: "throw", group: { package: ".", tsconfig: null }, message: "thrown from a timer" }]);
    expect(summary.summary.warnings).toBe(warnings);
    expect(summary.exitCode).toBe(2);
    expect(ran.code).toBe(2);
  });
});

describe("--stdout", () => {
  it("writes the one template's HTML to stdout, and what the run says to stderr", async () => {
    const dir = project({ "emails/a.tsx": email("On stdout") });
    const ran = await cli(dir, ["render", "emails/a.tsx", "--stdout"]);
    expect(ran.code).toBe(0);
    expect(ran.stdout.startsWith("<!DOCTYPE")).toBe(true);
    expect(ran.stdout).toContain("On stdout");
    expect(ran.stderr).toContain("emails/a.tsx");
  });

  it("is a usage error with --json, or with more than one template", async () => {
    const dir = project({ "emails/a.tsx": email(), "emails/b.tsx": email() });
    expect((await cli(dir, ["render", "emails/a.tsx", "--stdout", "--json"])).code).toBe(2);
    const many = await cli(dir, ["render", "emails", "--stdout"]);
    expect(many.code).toBe(2);
    expect(many.stdout).toBe("");
  });
});

describe("text output", () => {
  it("prints each template, its diagnostics as formatDiagnostics() writes them, and a summary", async () => {
    const dir = project({
      "emails/a.tsx": `import { Email, Section } from "@hyper-elements/react";
// @ts-expect-error
export default function A() { return <Email><Section color="red" /></Email>; }
`,
    });
    write(dir, { "emails/b.tsx": email("fine") });
    const ran = await cli(dir, ["check", "emails"]);
    expect(ran.code).toBe(1);
    expect(ran.stdout).toMatch(/^✗ emails\/a\.tsx \(Email\)\n {4}error prop\/unknown at root\.children\[0\]\.props\.color: /m);
    expect(ran.stdout).toMatch(/^✓ emails\/b\.tsx \(Email\)$/m);
    expect(ran.stdout).toMatch(/^2 templates: 1 error, \d+ warnings?, 0 skipped$/m);
  });

  it("says no place for a diagnostic at no path in the template, rather than `at :`", async () => {
    const dir = project({ "emails/a.tsx": email(), "emails/value.ts": `export default { not: "a component" };\n` });
    const ran = await cli(dir, ["check", "emails"]);
    expect(ran.stdout).toMatch(/^ {4}info cli\/not-a-template: Its default export isn't a component/m);
    expect(ran.stdout).not.toContain(" at :");
  });
});
