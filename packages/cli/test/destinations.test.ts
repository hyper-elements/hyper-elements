/**
 * Where render writes: every refusal of --out, collisions (case-folded), an input given twice or through a link,
 * two folders with the same file names under their common base, and whole files only.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, symlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join, parse } from "node:path";
import { describe, expect, it } from "vitest";
import { BIN, cli, cliEnv, email, lines, ON_BUN, project, until, WINDOWS } from "./helpers";

describe("--out is refused", () => {
  const cases: Array<[string, (dir: string) => string]> = [
    ["the filesystem root", (dir) => parse(dir).root],
    ["the home folder", () => homedir()],
    ["the project's root", () => "."],
    ["a folder holding an input", () => "emails"],
    ["a folder above an input", () => "emails/.."],
  ];
  for (const [what, out] of cases) {
    it(`when it's ${what}, with nothing written`, async () => {
      const dir = project({ "emails/a.tsx": email() });
      const ran = await cli(dir, ["render", "emails", "--out", out(dir)]);
      expect(ran.code).toBe(2);
      expect(ran.stderr).toContain("--out");
      expect(readdirSync(join(dir, "emails"))).toEqual(["a.tsx"]);
      expect(existsSync(join(dir, "a.html"))).toBe(false);
    });
  }
});

describe("destinations", () => {
  it("two inputs with one destination: exit 2, nothing written", async () => {
    const dir = project({ "emails/a.tsx": email("tsx"), "emails/a.jsx": email("jsx") });
    const ran = await cli(dir, ["render", "emails"]);
    expect(ran.code).toBe(2);
    expect(ran.stderr).toMatch(/emails\/a\.(jsx|tsx) and emails\/a\.(jsx|tsx) would both write out\/a\.html/);
    expect(existsSync(join(dir, "out"))).toBe(false);
  });

  it("Welcome.tsx and welcome.jsx collide, whatever the disk does", async () => {
    const dir = project({ "emails/Welcome.tsx": email("upper"), "emails/welcome.jsx": email("lower") });
    const ran = await cli(dir, ["render", "emails"]);
    expect(ran.code).toBe(2);
    expect(existsSync(join(dir, "out"))).toBe(false);
  });

  it("an input given twice, or through a link, is one input", async () => {
    const dir = project({ "emails/a.tsx": email("A") });
    if (!WINDOWS) symlinkSync(join(dir, "emails/a.tsx"), join(dir, "linked.tsx"));
    const ran = await cli(dir, ["render", "emails/a.tsx", "emails/a.tsx", "emails", ...(WINDOWS ? [] : ["linked.tsx"]), "--json"]);
    expect(ran.code, ran.stderr).toBe(0);
    expect(lines(ran).slice(0, -1).map((l) => l.file)).toEqual(["emails/a.tsx"]);
  });

  it("two folders that each hold a welcome.tsx write under their common base, without colliding", async () => {
    const dir = project({ "packages/emails/welcome.tsx": email("package"), "apps/web/emails/welcome.tsx": email("app") });
    const ran = await cli(dir, ["render", "packages/emails", "apps/web/emails", "--json"]);
    expect(ran.code, ran.stderr).toBe(0);
    expect(lines(ran).slice(0, -1).map((l) => l.outputs)).toEqual([
      ["out/packages/emails/welcome.html", "out/packages/emails/welcome.txt"],
      ["out/apps/web/emails/welcome.html", "out/apps/web/emails/welcome.txt"],
    ]);
    expect(readFileSync(join(dir, "out/apps/web/emails/welcome.txt"), "utf8")).toContain("app");
  });

  it("a single folder is its own base; a Page writes its HTML only", async () => {
    const dir = project({
      "emails/welcome.tsx": email("Hi"),
      "emails/deep/page.tsx": `import { Page, Text } from "@hyper-elements/react";\nexport default function P() { return <Page><Text>A page</Text></Page>; }\n`,
    });
    const ran = await cli(dir, ["render", "emails", "--out", "build/html", "--json"]);
    expect(ran.code, ran.stderr).toBe(0);
    expect(lines(ran).slice(0, -1).map((l) => [l.root, l.outputs])).toEqual([
      ["Page", ["build/html/deep/page.html"]],
      ["Email", ["build/html/welcome.html", "build/html/welcome.txt"]],
    ]);
  });

  it("a Document and a Canvas write their HTML, with a note that their PDF and image come later", async () => {
    const dir = project({
      "docs/invoice.tsx": `import { Document, Text } from "@hyper-elements/react";\nexport default function I() { return <Document><Text>Invoice</Text></Document>; }\n`,
      "docs/card.tsx": `import { Canvas, Text } from "@hyper-elements/react";\nexport default function C() { return <Canvas width={400} height={200}><Text>Card</Text></Canvas>; }\n`,
    });
    const ran = await cli(dir, ["render", "docs", "--json"]);
    expect(ran.code, ran.stdout + ran.stderr).toBe(0);
    const got = lines(ran);
    expect(got[0]).toMatchObject({ file: "docs/card.tsx", root: "Canvas", outputs: ["out/card.html"] });
    expect(got[1]).toMatchObject({ file: "docs/invoice.tsx", root: "Document", outputs: ["out/invoice.html"] });
    for (const line of got.slice(0, 2)) expect(line.diagnostics.map((d: any) => d.code)).toContain("cli/html-only");
  });

  it("an interrupted run leaves whole files or none: outputs are renamed into place", async () => {
    const dir = project({ "emails/a.tsx": email("A".repeat(2000)), "emails/b.tsx": email("B"), "emails/c.tsx": email("C") });
    mkdirSync(join(dir, "out"));
    // Killed as soon as it starts writing.
    const done = new Promise<void>((resolve) => {
      const child = spawn(ON_BUN ? "bun" : process.execPath, [BIN, "render", "emails"], { cwd: dir, env: cliEnv(), stdio: "ignore" });
      until(() => readdirSync(join(dir, "out")).length > 0, 20_000).then(() => {
        child.kill("SIGKILL");
        resolve();
      });
    });
    await done;
    await new Promise((resolve) => setTimeout(resolve, 200));
    for (const name of readdirSync(join(dir, "out"))) {
      // A temporary file may be left by a kill (it's never an output's name); an output is whole.
      if (name.endsWith(".tmp")) continue;
      const text = readFileSync(join(dir, "out", name), "utf8");
      if (name.endsWith(".html")) expect(text.trimEnd().endsWith("</html>")).toBe(true);
    }
  });
});
