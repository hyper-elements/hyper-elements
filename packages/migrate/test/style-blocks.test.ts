import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { afterEach, describe, expect, it } from "vitest";
import { main, type Io } from "../src/cli";
import { styleBlocks } from "../src/style-blocks/transform";

const head = `import { Button, Column, Document, Email, Heading, Link, Text as Words } from "@hyper-elements/react";\n`;
const run = (body: string) => styleBlocks(head + body);

describe("style-blocks", () => {
  it("moves a block into the style that's there", () => {
    const { code, moved, report } = run(`export const a = <Heading style={{ fontSize: 32 }} mobile={{ fontSize: 24 }}>Title</Heading>;\n`);
    expect(code).toBe(head + `export const a = <Heading style={{ fontSize: 32, mobile: { fontSize: 24 } }}>Title</Heading>;\n`);
    expect([moved, report]).toEqual([1, []]);
  });

  it("makes a style where there's none, with both blocks", () => {
    const { code } = run(`export const a = <Button href="#" mobile={{ width: "100%" }} hover={{ backgroundColor: "#000" }}>Go</Button>;\n`);
    expect(code).toBe(head + `export const a = <Button href="#" style={{ mobile: { width: "100%" }, hover: { backgroundColor: "#000" } }}>Go</Button>;\n`);
  });

  it("keeps a multi-line element's other lines as they were", () => {
    const { code } = run(`export const a = (\n  <Button\n    href="#"\n    style={{\n      backgroundColor: "#111",\n    }}\n    hover={{ backgroundColor: "#000" }}\n  >\n    Go\n  </Button>\n);\n`);
    expect(code).toBe(head + `export const a = (\n  <Button\n    href="#"\n    style={{\n      backgroundColor: "#111", hover: { backgroundColor: "#000" },\n    }}\n  >\n    Go\n  </Button>\n);\n`);
  });

  it("drops what never did anything: keys set to undefined, and blocks left empty", () => {
    const { code, moved } = run(`export const a = <Heading hover={{}}>Title</Heading>;\nexport const b = <Words mobile={{ backgroundColor: undefined }}>Hi</Words>;\nexport const c = <Words mobile={{ fontSize: 12, color: undefined }}>Hi</Words>;\n`);
    expect(code).toBe(head + `export const a = <Heading>Title</Heading>;\nexport const b = <Words>Hi</Words>;\nexport const c = <Words style={{ mobile: { fontSize: 12 } }}>Hi</Words>;\n`);
    expect(moved).toBe(3);
  });

  it("leaves what it can't check, and says why", () => {
    const body = [
      `export const a = (s: object) => <Button href="#" style={s} hover={{ color: "#fff" }}>Go</Button>;`,
      `export const b = (m: object) => <Button href="#" style={{ padding: 8 }} mobile={m}>Go</Button>;`,
      `export const c = <Words mobile={{ backgroundColor: "#000" }}>Hi</Words>;`,
      `export const d = (s: object) => <Words style={{ ...s }} mobile={{ fontSize: 12 }}>Hi</Words>;`,
      `export const e = <Words style={{ mobile: { fontSize: 12 } }} mobile={{ lineHeight: 1.2 }}>Hi</Words>;`,
      `export const f = (k: string) => <Words mobile={{ [k]: 12 }}>Hi</Words>;`,
      "",
    ].join("\n");
    const { code, moved, report } = run(body);
    expect(code).toBe(head + body);
    expect(moved).toBe(0);
    expect(report).toEqual([
      "line 2: <Button>: style={…} isn't an object literal, so hover can't be added to it: left as it is",
      "line 3: <Button>: mobile={…} isn't an object literal, so its styles can't be checked: left as it is",
      "line 4: <Text>: backgroundColor can't be set for phones on a Text (it fails when rendered today): left as it is",
      "line 5: <Text>: style spreads an object that isn't a const of this file, or may hold mobile already: left as it is",
      "line 6: <Text>: style already has mobile: left as it is",
      "line 7: <Text>: mobile has a computed key, so its styles can't be checked: left as it is",
    ]);
  });

  it("follows a const object of the file: spread into style, given as style, or given as the block", () => {
    const body = [
      `const LABEL = { fontSize: 12, letterSpacing: 1 } as const;`,
      `const CARD = { padding: 20, ...LABEL };`,
      `const PHONE = { padding: 8 };`,
      `export const a = <Words style={{ ...LABEL, color: "#333" }} mobile={{ fontSize: 11 }}>a</Words>;`,
      `export const b = <Column style={CARD} mobile={PHONE}><Words>b</Words></Column>;`,
      ``,
    ].join("\n");
    const { code, report } = run(body);
    expect(report).toEqual([]);
    expect(code).toContain(`<Words style={{ ...LABEL, color: "#333", mobile: { fontSize: 11 } }}>a</Words>`);
    expect(code).toContain(`<Column style={{ ...CARD, mobile: PHONE }}>`);
  });

  it("doesn't follow a const that holds a block, a parameter of the same name, or one declared twice", () => {
    const body = [
      `const WITH = { fontSize: 12, mobile: { fontSize: 10 } };`,
      `export const a = <Words style={{ ...WITH }} mobile={{ lineHeight: 1.2 }}>a</Words>;`,
      `export const b = (LABEL: object) => <Words style={{ ...LABEL }} mobile={{ fontSize: 11 }}>b</Words>;`,
      ``,
    ].join("\n");
    const { code, report } = run(body);
    expect(code).toBe(head + body);
    expect(report).toHaveLength(2);
  });

  it("says where props spread from an object of the file give a block, which it doesn't rewrite", () => {
    const body = `const cell = { style: { padding: 8 }, mobile: { padding: 4 } };\nexport const a = <Column {...cell}><Words>a</Words></Column>;\n`;
    const { code, report } = run(body);
    expect(code).toBe(head + body);
    expect(report).toEqual(["line 3: <Column>: {...cell} gives mobile: move it into the style it gives (left as it is)"]);
  });

  it("reads Document.Page and renamed imports, and leaves other packages' components alone", () => {
    const { code } = styleBlocks(
      `import { Document as Doc } from "@hyper-elements/react";\nimport { Text } from "./mine";\nexport const a = <Doc><Doc.Page mobile={{ gap: 8 }}><Text mobile={{ x: 1 }} /></Doc.Page></Doc>;\n`
    );
    expect(code).toContain(`<Doc.Page style={{ mobile: { gap: 8 } }}>`);
    expect(code).toContain(`<Text mobile={{ x: 1 }} />`);
  });

  it("says a file without Hyper Elements' components isn't a template", () => {
    expect(styleBlocks(`import { Text } from "./mine";\nexport const a = <Text mobile={{ fontSize: 1 }} />;\n`).template).toBe(false);
  });

  it("writes templates that type-check: the originals' only errors are the props it moves", () => {
    const original = [
      head.trim(),
      `export const a = <Email><Heading style={{ fontSize: 32 }} mobile={{ fontSize: 24 }} hover={{}}>T</Heading></Email>;`,
      `export const b = <Email><Button href="https://example.com" mobile={{ width: "100%", padding: undefined }} hover={{ backgroundColor: "#000000" }}>Go</Button></Email>;`,
      `export const c = <Email><Words mobile={{ backgroundColor: undefined }}>Hi</Words><Link href="https://example.com" hover={{ textDecoration: "underline" }}>x</Link></Email>;`,
      `export const d = <Email><Column style={{ padding: 20 }} mobile={{ padding: 8 }}><Words>x</Words></Column></Email>;`,
      `export const e = <Document><Document.Page mobile={{ gap: 8 }}><Words>x</Words></Document.Page></Document>;`,
      `const CARD = { padding: 20, fontSize: 14 };`,
      `const PHONE = { padding: 8 };`,
      `export const f = <Email><Column style={CARD} mobile={PHONE}><Words style={{ ...CARD, color: "#333333" }} mobile={{ fontSize: 12 }}>x</Words></Column></Email>;`,
      "",
    ].join("\n");
    const rewritten = styleBlocks(original).code;
    expect(rewritten).not.toContain("mobile={");
    expect(rewritten).not.toContain("hover={");
    // The props are gone from the package's types: each of the original's errors is one of them.
    const before = typeErrors(original);
    expect(before.length).toBeGreaterThan(0);
    for (const error of before) expect(error).toMatch(/'(mobile|hover)'/);
    expect(typeErrors(rewritten)).toEqual([]);
    // The check catches what doesn't type-check: an empty hover block on a Heading, moved as it is.
    expect(typeErrors(`${head}export const x = <Email><Heading style={{ hover: {} }}>T</Heading></Email>;\n`)).not.toEqual([]);
  });
});

/** The type errors of a template, against the installed @hyper-elements/react. */
function typeErrors(source: string): string[] {
  const dir = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-types-"));
  dirs.push(dir);
  const file = path.join(dir, "template.tsx");
  fs.writeFileSync(file, source);
  const program = ts.createProgram([file], { jsx: ts.JsxEmit.ReactJSX, strict: true, noEmit: true, skipLibCheck: true, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, target: ts.ScriptTarget.ES2022, types: [] });
  return ts.getPreEmitDiagnostics(program).filter((d) => d.file?.fileName === file).map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
}

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function project(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-"));
  dirs.push(dir);
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), text);
  }
  return dir;
}
function io(cwd: string): Io & { out: string; err: string } {
  const sink = { cwd, out: "", err: "", stdout: (t: string) => void (sink.out += t), stderr: (t: string) => void (sink.err += t) };
  return sink;
}
const TEMPLATE = `import { Email, Text } from "@hyper-elements/react";\nexport default function T() { return <Email><Text mobile={{ fontSize: 12 }}>Hi</Text></Email>; }\n`;

describe("npx @hyper-elements/migrate style-blocks", () => {
  it("prints one template rewritten, writing nothing", async () => {
    const dir = project({ "emails/welcome.tsx": TEMPLATE });
    const sink = io(dir);
    expect(await main(["style-blocks", "emails/welcome.tsx"], sink)).toBe(0);
    expect(sink.out).toContain("<Text style={{ mobile: { fontSize: 12 } }}>Hi</Text>");
    expect(fs.readFileSync(path.join(dir, "emails/welcome.tsx"), "utf8")).toBe(TEMPLATE);
  });

  it("replaces templates with --write only where git can restore them, and leaves other files alone", async () => {
    const dir = project({ "emails/welcome.tsx": TEMPLATE, "emails/welcome.stories.tsx": TEMPLATE, "emails/other.ts": "export const x = 1;\n" });
    const refused = io(dir);
    expect(await main(["style-blocks", "emails", "--write"], refused)).toBe(1);
    expect(refused.err).toMatch(/git couldn't restore these:\n {2}emails\/welcome\.stories\.tsx \(not committed\)\n {2}emails\/welcome\.tsx \(not committed\)/);
    expect(fs.readFileSync(path.join(dir, "emails/welcome.tsx"), "utf8")).toBe(TEMPLATE);

    const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "-c", "commit.gpgsign=false", ...args], { cwd: dir, stdio: "ignore" });
    git("init", "-q");
    git("add", "-A");
    git("commit", "-q", "-m", "templates");
    const sink = io(dir);
    expect(await main(["style-blocks", "emails", "--write"], sink)).toBe(0);
    expect(sink.out).toContain("emails/welcome.tsx: 1 prop moved into style");
    expect(fs.readFileSync(path.join(dir, "emails/welcome.tsx"), "utf8")).toContain("style={{ mobile: { fontSize: 12 } }}");
    expect(fs.readFileSync(path.join(dir, "emails/welcome.stories.tsx"), "utf8")).toContain("style={{ mobile: { fontSize: 12 } }}");
    expect(fs.readFileSync(path.join(dir, "emails/other.ts"), "utf8")).toBe("export const x = 1;\n");

    // Run again: nothing left to move.
    const again = io(dir);
    expect(await main(["style-blocks", "emails", "--write"], again)).toBe(0);
    expect(again.out).toContain("nothing to rewrite");
  });

  it("lists what it left, and writes the rest with --allow-dirty", async () => {
    const dir = project({ "emails/a.tsx": `import { Email, Text } from "@hyper-elements/react";\nexport const a = (m: object) => <Email><Text mobile={m}>Hi</Text><Text mobile={{ fontSize: 12 }}>Ho</Text></Email>;\n` });
    const sink = io(dir);
    expect(await main(["style-blocks", "emails", "--write", "--allow-dirty"], sink)).toBe(0);
    expect(sink.out).toContain("emails/a.tsx: 1 prop moved into style, 1 left as it is");
    expect(sink.out).toContain("mobile={…} isn't an object literal");
  });

  it("refuses options that aren't its own, and runs without templates as a usage error", async () => {
    const dir = project({ "emails/a.tsx": TEMPLATE });
    expect(await main(["style-blocks", "emails", "--out", "x"], io(dir))).toBe(1);
    expect(await main(["style-blocks"], io(dir))).toBe(1);
  });
});
