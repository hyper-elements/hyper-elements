/**
 * Node and Bun give the same output: every Email and Page of the compatibility baseline (packages/react's gallery, its
 * stress set with the screen ones as an Email and as a Page, and the template with a component of its own) rendered
 * by the CLI on Node and on Bun gives the same bytes: the HTML, the plain text and the --json lines. (Its Documents
 * and Canvases name web fonts: drawn.test.ts renders them, from a local server.)
 *
 * The CLI's fixtures (test/fixtures: Documents and Canvases with Inter's TTF files and PNG images) say where Bun
 * gives Node's bytes for a PDF or an image: a Canvas's PNG and SVG are the same, so Bun writes them; a Document's PDF
 * isn't (Bun's zlib compresses its streams differently), so `render` exits 2 for a Document on Bun.
 */
import { execFileSync } from "node:child_process";
import { cpSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, FIXTURES, lines, project, REPO, withFixtures } from "./helpers";

const EXAMPLES = join(REPO, "packages/react/src/primitives/examples");
const COMPAT = join(REPO, "packages/react/src/regression/cross-format-compatibility.test.tsx");
const toPackage = (source: string) => source.replace(/from "\.\.\/\.\.\/index"/g, 'from "@hyper-elements/react"');

/** Every file under `dir`, by its path relative to it. */
function files(dir: string): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  const visit = (folder: string) => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name);
      if (entry.isDirectory()) visit(path);
      else out.set(relative(dir, path), readFileSync(path));
    }
  };
  visit(dir);
  return out;
}

const hasBun = (() => {
  try {
    return !!execFileSync("bun", ["--version"]);
  } catch {
    return false;
  }
})();

// Bun is installed in CI wherever the suite runs on Linux and macOS (the Windows job runs Node only).
describe.runIf(hasBun || (process.env.CI && process.platform !== "win32"))("parity between Node and Bun", () => {
  it("renders the compatibility baseline's templates to the same bytes", async () => {
    const sources: Record<string, string> = {};
    for (const file of readdirSync(join(EXAMPLES, "gallery"))) {
      if (/^[a-z-]+\.tsx$/.test(file)) sources[`lib/gallery/${file}`] = toPackage(readFileSync(join(EXAMPLES, "gallery", file), "utf8"));
    }
    sources["lib/stress.tsx"] = toPackage(readFileSync(join(EXAMPLES, "stress/index.tsx"), "utf8"));
    // The template with a component of its own, as the baseline writes it.
    const compat = readFileSync(COMPAT, "utf8");
    const start = compat.indexOf("/** A component of a template's own");
    const end = compat.indexOf("\n);\n", compat.indexOf("const products = ")) + 4;
    sources["lib/products.tsx"] = `import { Button, Column, component, Email, Heading, Image, Page, prop, Row, Section, Text } from "@hyper-elements/react";\n${compat.slice(start, end)}export { products };\n`;

    const { gallery } = await import(join(EXAMPLES, "gallery/index.ts"));
    const { stress } = await import(join(EXAMPLES, "stress/index.tsx"));
    const { Document, Canvas } = await import(join(REPO, "packages/react/src/primitives/index.ts"));
    const drawn = (element: { type?: unknown }) => element.type === Document || element.type === Canvas;
    const templates: Record<string, string> = {};
    for (const [name, element] of Object.entries(gallery) as Array<[string, { type?: unknown }]>) {
      if (drawn(element)) continue;
      const file = Object.keys(sources).find((path) => path.startsWith("lib/gallery/") && sources[path].includes(`export const ${name} =`))!.slice("lib/gallery/".length);
      templates[`emails/gallery-${name}.tsx`] = `import { ${name} } from "../lib/gallery/${file.replace(/\.tsx$/, "")}";\nexport default function Template() { return ${name}; }\n`;
    }
    for (const [name, entry] of Object.entries(stress) as Array<[string, { roots: string; template: { type?: unknown } }]>) {
      if (entry.roots === "own" && drawn(entry.template)) continue;
      const roots = entry.roots === "screen" ? ["Email", "Page"] : [null];
      for (const root of roots) {
        templates[`emails/stress-${name}${root ? `-${root.toLowerCase()}` : ""}.tsx`] = root
          ? `import { ${root} } from "@hyper-elements/react";\nimport { stress } from "../lib/stress";\nexport default function Template() { return (stress.${name} as any).template(${root}); }\n`
          : `import { stress } from "../lib/stress";\nexport default function Template() { return (stress.${name} as any).template; }\n`;
      }
    }
    for (const root of ["Email", "Page"]) {
      templates[`emails/custom-products-${root.toLowerCase()}.tsx`] = `import { ${root} } from "@hyper-elements/react";\nimport { products } from "../lib/products";\nexport default function Template() { return products(${root}); }\n`;
    }
    const dir = project({ ...sources, ...templates });

    const node = await cli(dir, ["render", "emails", "--json"], { runtime: "node" });
    expect(node.code, node.stdout + node.stderr).toBe(0);
    const fromNode = files(join(dir, "out"));
    rmSync(join(dir, "out"), { recursive: true });
    const bun = await cli(dir, ["render", "emails", "--json"], { runtime: "bun" });
    expect(bun.code, bun.stderr).toBe(0);
    const fromBun = files(join(dir, "out"));

    const roots = node.stdout.split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((l) => l.root).map((l) => l.root);
    expect(roots.filter((r: string) => r === "Email").length).toBeGreaterThan(10);
    expect(roots.filter((r: string) => r === "Page").length).toBeGreaterThan(10);
    expect(bun.stdout).toBe(node.stdout);
    expect([...fromBun.keys()].sort()).toEqual([...fromNode.keys()].sort());
    for (const [file, bytes] of fromNode) expect(fromBun.get(file)!.equals(bytes), file).toBe(true);
  });

  /** A project with the fixtures: templates/ (the Documents and Canvases), fonts/ and images/. */
  function fixtures(): string {
    const dir = withFixtures(project({}));
    cpSync(join(FIXTURES, "templates"), join(dir, "templates"), { recursive: true });
    return dir;
  }

  it("renders the fixtures' Canvases to the same PNG and SVG bytes", async () => {
    const dir = fixtures();
    for (const format of ["png", "svg"]) {
      const options = format === "svg" ? ["--format", "svg"] : ["--scale", "2"];
      const node = await cli(dir, ["render", "templates/card.tsx", "--json", "--out", `node-${format}`, ...options], { runtime: "node" });
      expect(node.code, node.stdout + node.stderr).toBe(0);
      const bun = await cli(dir, ["render", "templates/card.tsx", "--json", "--out", `bun-${format}`, ...options], { runtime: "bun" });
      expect(bun.code, bun.stdout + bun.stderr).toBe(0);
      expect(lines(node)[0]).toMatchObject({ root: "Canvas", status: "ok", diagnostics: [] });
      expect(bun.stdout.replaceAll(`bun-${format}/`, "")).toBe(node.stdout.replaceAll(`node-${format}/`, ""));
      expect(readFileSync(join(dir, `bun-${format}/card.${format}`)).equals(readFileSync(join(dir, `node-${format}/card.${format}`)))).toBe(true);
    }
  });

  it("refuses a Document's PDF on Bun (exit 2), whose bytes differ from Node's", async () => {
    const dir = fixtures();
    const node = await cli(dir, ["render", "templates/invoice.tsx", "--json", "--out", "node"], { runtime: "node" });
    expect(node.code, node.stdout + node.stderr).toBe(0);
    expect(lines(node)[0]).toMatchObject({ root: "Document", status: "ok", outputs: ["node/invoice.pdf"], diagnostics: [] });

    const bun = await cli(dir, ["render", "templates/invoice.tsx", "--json", "--out", "bun"], { runtime: "bun" });
    expect(bun.code).toBe(2);
    expect(lines(bun)[0]).toMatchObject({ root: "Document", status: "error", outputs: [], diagnostics: [{ code: "cli/bun", severity: "error" }] });

    // Why: written on Bun anyway, the PDF isn't Node's. If this fails, Bun now writes Node's bytes: lift the refusal
    // (NOT_ON_BUN in src/commands/render.ts) and the README's note.
    const forced = await cli(dir, ["render", "templates/invoice.tsx", "--json", "--out", "forced"], { runtime: "bun", env: { HYPER_ELEMENTS_CLI_BUN_PDF: "1" } });
    expect(forced.code, forced.stdout + forced.stderr).toBe(0);
    const ours = readFileSync(join(dir, "node/invoice.pdf"));
    const theirs = readFileSync(join(dir, "forced/invoice.pdf"));
    expect(theirs.subarray(0, 5).toString()).toBe("%PDF-");
    expect(theirs.equals(ours)).toBe(false);
  });
});
