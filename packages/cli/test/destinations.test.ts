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

describe("--out's refusal", () => {
  it("doesn't offer out/ when out/ is what it refused", async () => {
    const dir = project({ "out/a.tsx": email() });
    const ran = await cli(dir, ["render", "out/a.tsx"]);
    expect(ran.code).toBe(2);
    expect(ran.stderr).toContain("--out out is a folder holding an input (out/a.tsx)");
    expect(ran.stderr).not.toContain("such as out/");
    const other = await cli(dir, ["render", "out/a.tsx", "--out", "out/.."]);
    expect(other.stderr).toContain("such as out/");
  });

  it.skipIf(WINDOWS)("a folder under --out that leads, through a symbolic link, to the inputs' folder: exit 2, nothing written", async () => {
    const dir = project({ "emails/a.tsx": email(), "more/b.tsx": email() });
    mkdirSync(join(dir, "out"), { recursive: true });
    symlinkSync(join(dir, "emails"), join(dir, "out/emails"), "dir");
    const ran = await cli(dir, ["render", "emails", "more"]);
    expect(ran.code).toBe(2);
    expect(ran.stderr).toContain("would go in emails/a.tsx's folder");
    expect(readdirSync(join(dir, "emails"))).toEqual(["a.tsx"]);
    expect(existsSync(join(dir, "out/more"))).toBe(false);
  });
});

describe("destinations", () => {
  it("two inputs with one destination: exit 2, nothing written", async () => {
    const dir = project({ "emails/a.tsx": email("tsx"), "emails/a.jsx": email("jsx") });
    const ran = await cli(dir, ["render", "emails"]);
    expect(ran.code).toBe(2);
    expect(ran.stderr).toMatch(/emails\/a\.(jsx|tsx) and emails\/a\.(jsx|tsx) would both write out\/emails\/a\.html/);
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

  it("two folders that each hold a welcome.tsx write each at its path from the current folder, without colliding", async () => {
    const dir = project({ "packages/emails/welcome.tsx": email("package"), "apps/web/emails/welcome.tsx": email("app") });
    const ran = await cli(dir, ["render", "packages/emails", "apps/web/emails", "--json"]);
    expect(ran.code, ran.stderr).toBe(0);
    expect(lines(ran).slice(0, -1).map((l) => l.outputs)).toEqual([
      ["out/packages/emails/welcome.html", "out/packages/emails/welcome.txt"],
      ["out/apps/web/emails/welcome.html", "out/apps/web/emails/welcome.txt"],
    ]);
    expect(readFileSync(join(dir, "out/apps/web/emails/welcome.txt"), "utf8")).toContain("app");
  });

  it("an output keeps its path from the current folder whatever else is given; --base picks another folder; a Page writes its HTML only", async () => {
    const dir = project({
      "emails/welcome.tsx": email("Hi"),
      "emails/deep/page.tsx": `import { Page, Text } from "@hyper-elements/react";\nexport default function P() { return <Page><Text>A page</Text></Page>; }\n`,
      "more/other.tsx": email("Other"),
    });
    const outputs = (ran: Awaited<ReturnType<typeof cli>>) => lines(ran).slice(0, -1).map((l) => [l.root, l.outputs]);
    const ran = await cli(dir, ["render", "emails", "--out", "build/html", "--json"]);
    expect(ran.code, ran.stderr).toBe(0);
    expect(outputs(ran)).toEqual([
      ["Page", ["build/html/emails/deep/page.html"]],
      ["Email", ["build/html/emails/welcome.html", "build/html/emails/welcome.txt"]],
    ]);
    // Another folder given too, or the one file alone: the same paths.
    expect(outputs(await cli(dir, ["render", "emails", "more", "--out", "build/html", "--json"])).slice(0, 2)).toEqual(outputs(ran));
    expect(outputs(await cli(dir, ["render", "emails/welcome.tsx", "--out", "build/html", "--json"]))).toEqual([outputs(ran)[1]]);
    // --base: paths from that folder.
    const based = await cli(dir, ["render", "emails", "--base", "emails", "--json"]);
    expect(based.code, based.stderr).toBe(0);
    expect(outputs(based)).toEqual([
      ["Page", ["out/deep/page.html"]],
      ["Email", ["out/welcome.html", "out/welcome.txt"]],
    ]);
  });

  it("an input outside the base, or a --base that isn't a folder: exit 2, nothing written", async () => {
    const dir = project({ "emails/a.tsx": email(), "more/b.tsx": email() });
    const outside = await cli(dir, ["render", "emails", "more", "--base", "emails"]);
    expect(outside.code).toBe(2);
    expect(outside.stderr).toContain("more/b.tsx is outside --base emails, which outputs keep their path relative to");
    const missing = await cli(dir, ["render", "emails", "--base", "nowhere"]);
    expect(missing.code).toBe(2);
    expect(missing.stderr).toContain("--base nowhere isn't a folder");
    expect(existsSync(join(dir, "out"))).toBe(false);
  });

  it("an interrupted run leaves whole files or none: outputs are renamed into place", async () => {
    const dir = project({ "emails/a.tsx": email("A".repeat(2000)), "emails/b.tsx": email("B"), "emails/c.tsx": email("C") });
    const out = join(dir, "out", "emails");
    mkdirSync(out, { recursive: true });
    // Killed as soon as it starts writing.
    const done = new Promise<void>((resolve) => {
      const child = spawn(ON_BUN ? "bun" : process.execPath, [BIN, "render", "emails"], { cwd: dir, env: cliEnv(), stdio: "ignore" });
      until(() => readdirSync(out).length > 0, 20_000).then(() => {
        child.kill("SIGKILL");
        resolve();
      });
    });
    await done;
    await new Promise((resolve) => setTimeout(resolve, 200));
    for (const name of readdirSync(out)) {
      // A temporary file may be left by a kill (it's never an output's name); an output is whole.
      if (name.endsWith(".tmp")) continue;
      const text = readFileSync(join(out, name), "utf8");
      if (name.endsWith(".html")) expect(text.trimEnd().endsWith("</html>")).toBe(true);
    }
  });
});
