/**
 * The command run as an agent runs it, on template files written to a folder of this package's own (where its
 * node_modules has the workspace's @hyper-elements/react and React): what it writes, what it says and its exit code.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { main } from "../src/cli";

const WORK = join(fileURLToPath(new URL(".", import.meta.url)), ".work");
afterAll(() => rmSync(WORK, { recursive: true, force: true }));

async function run(files: Record<string, string>, ...args: string[]) {
  const dir = join(WORK, Math.random().toString(36).slice(2));
  mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
  let out = "", err = "";
  const code = await main(args, { cwd: dir, out: { write: (t: string) => (out += t) }, err: { write: (t: string) => (err += t) } });
  return { code, out, err, dir };
}

const WELCOME = `import { Button, Column, Email, Heading, Text } from "@hyper-elements/react";
export default function Welcome({ name = "Ada" }: { name?: string }) {
  return (
    <Email width={600}>
      <Column style={{ padding: 24, gap: 16 }}>
        <Heading level={1}>Welcome, {name}</Heading>
        <Text>Thanks for signing up.</Text>
        <Button href="https://example.com/start" style={{ backgroundColor: "#111827" }}>Get started</Button>
      </Column>
    </Email>
  );
}
`;

describe("hyper-elements preview", () => {
  it("renders a .tsx template with no tsconfig, and writes its HTML, text and report", async () => {
    const { code, out, dir } = await run({ "welcome.tsx": WELCOME }, "preview", "welcome.tsx", "--no-screenshots");
    expect(code).toBe(0);
    expect(out).toContain("Rendered welcome.tsx: Email, 600px wide");
    expect(out).toContain("Nothing to fix.");
    expect(readFileSync(join(dir, "preview/welcome/welcome.html"), "utf8")).toContain("Welcome, Ada");
    // The plain-text version writes a heading in capitals.
    expect(readFileSync(join(dir, "preview/welcome/welcome.txt"), "utf8")).toContain("WELCOME, ADA");
    expect(readFileSync(join(dir, "preview/welcome/report.txt"), "utf8")).toContain("To fix (0)");
  });

  it("reports the design checks' warnings as what to fix, and still exits 0", async () => {
    const tagged = WELCOME.replace("Welcome, {name}", 'Welcome, <MergeTag name="first_name" />').replace("Heading, Text }", "Heading, MergeTag, Text }");
    const { code, out } = await run({ "welcome.tsx": tagged }, "preview", "welcome.tsx", "--no-screenshots");
    expect(code).toBe(0);
    expect(out).toContain("To fix (1):");
    expect(out).toContain("design/merge-tag-visible");
  });

  it("passes props from --props, and from previewProps in the file", async () => {
    const fromFile = await run({ "welcome.tsx": WELCOME, "props.json": '{"name":"Grace"}' }, "preview", "welcome.tsx", "--props", "props.json", "--no-screenshots");
    expect(readFileSync(join(fromFile.dir, "preview/welcome/welcome.html"), "utf8")).toContain("Welcome, Grace");
    const inFile = await run({ "welcome.tsx": WELCOME + 'export const previewProps = { name: "Linus" };\n' }, "preview", "welcome.tsx", "--no-screenshots");
    expect(readFileSync(join(inFile.dir, "preview/welcome/welcome.html"), "utf8")).toContain("Welcome, Linus");
  });

  it("exits 1 and lists a template's errors", async () => {
    const broken = WELCOME.replace("<Text>", "<Text style={{ marginBottom: 16 } as never}>");
    const { code, err } = await run({ "welcome.tsx": broken }, "preview", "welcome.tsx", "--no-screenshots");
    expect(code).toBe(1);
    expect(err).toMatch(/error \S+ at root/);
  });

  it("says how to export a template from a file that exports none", async () => {
    const { code, err } = await run({ "none.tsx": 'import { Email } from "@hyper-elements/react";\nconst x = <Email />;\n' }, "preview", "none.tsx", "--no-screenshots");
    expect(code).toBe(1);
    expect(err).toContain("export default function");
  });

  it("says what doesn't compile, with its line", async () => {
    const { code, err } = await run({ "bad.tsx": "export default function () { return <Email>; }\n" }, "preview", "bad.tsx", "--no-screenshots");
    expect(code).toBe(1);
    expect(err).toMatch(/doesn't compile:\n\s+.*bad\.tsx:1/);
  });

  it("takes desktop and phone screenshots where a browser can start", async () => {
    const { code, out, dir } = await run({ "welcome.tsx": WELCOME }, "preview", "welcome.tsx");
    expect(code).toBe(0);
    if (out.includes("no screenshots")) return; // no Chrome or Chromium on this machine: said so, and nothing else to check
    for (const png of ["desktop.png", "phone.png"]) expect(existsSync(join(dir, "preview/welcome", png))).toBe(true);
    expect(out).toContain("phone.png (375px wide)");
  }, 60000);
});

describe("hyper-elements new", () => {
  it("lists the starter templates @hyper-elements/react ships", async () => {
    const { code, out } = await run({}, "new");
    expect(code).toBe(0);
    expect(out).toMatch(/larder-receipt\s+Email\s+An order confirmation/);
  });

  it("copies one, which then previews with nothing to fix, and won't overwrite a file", async () => {
    const copied = await run({}, "new", "larder-receipt", "order.tsx");
    expect(copied.code).toBe(0);
    expect(readFileSync(join(copied.dir, "order.tsx"), "utf8")).toContain("export default function LarderReceipt");
    const shown = await main(["preview", "order.tsx", "--no-screenshots"], { cwd: copied.dir, out: { write: () => 0 }, err: { write: () => 0 } });
    expect(shown).toBe(0);
    expect(readFileSync(join(copied.dir, "preview/order/report.txt"), "utf8")).toContain("To fix (0)");
    const again = await main(["new", "larder-receipt", "order.tsx"], { cwd: copied.dir, out: { write: () => 0 }, err: { write: () => 0 } });
    expect(again).toBe(1);
  });

  it("says which starters there are when given one that isn't", async () => {
    const { code, err } = await run({}, "new", "no-such-starter");
    expect(code).toBe(1);
    expect(err).toContain("larder-receipt");
  });
});
