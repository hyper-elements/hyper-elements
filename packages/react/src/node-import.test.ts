// @vitest-environment node

/**
 * Verifies the package's entries work in a plain Node.js environment (no
 * jsdom, no browser APIs). Catches module-level calls to client-only APIs
 * that would break Next.js Server Components or SSR runtimes.
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import ts from "typescript";

describe("Node environment (no jsdom)", () => {
  it("imports the main entry, /builder and /inspect without a browser", async () => {
    const main = await import("./primitives/index");
    const builder = await import("./builder/index");
    const inspect = await import("./inspect/index");
    expect(inspect.inspect).toBeTypeOf("function");
    expect(inspect.describeComponents({ root: "Page" }).components.length).toBeGreaterThan(0);
    for (const name of ["Email", "Page", "Document", "Row", "Column", "Text", "Button", "render", "validate", "outline", "prepare", "component"] as const) expect(main[name], name).toBeTypeOf("function");
    expect(builder.toDesign).toBeTypeOf("function");
    expect(builder.fromDesign).toBeTypeOf("function");
    expect(typeof document).toBe("undefined");
  });

  it("render() produces HTML and plain text", async () => {
    const { render, Email, Text } = await import("./primitives/index");
    const { html, text } = await render(React.createElement(Email, null, React.createElement(Text, null, "Hello from Node")));
    expect(html).toMatch(/^<!DOCTYPE html/i);
    expect(html).toContain("Hello from Node");
    expect(text).toBe("Hello from Node");
  });

  it("toDesign() produces the builder's design, and fromDesign() reads it back", async () => {
    const { Email, Button } = await import("./primitives/index");
    const { toDesign, fromDesign } = await import("./builder/index");
    const { design } = toDesign(React.createElement(Email, null, React.createElement(Button, { href: "https://example.com" }, "Click")));
    expect(design.body.rows).toHaveLength(1);
    expect(design.body.rows[0].columns[0].contents).toHaveLength(1);
    expect(fromDesign(design).code).toContain("Click");
  });
});

describe("each entry's types, for every moduleResolution", () => {
  it("resolves the main entry, /builder, /inspect, /pdf and /image to their declarations, under node (node10) too", () => {
    // A project's node_modules with this package in it, as an install has it.
    const dir = resolve(__dirname, "..");
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    const project = mkdtempSync(join(tmpdir(), "elements-types-"));
    const installed = join(project, "node_modules", "@hyper-elements", "react");
    mkdirSync(join(project, "node_modules", "@hyper-elements"), { recursive: true });
    symlinkSync(dir, installed, "dir");
    // The declarations each entry names, which a build writes: there for the resolver whether built or not. An import
    // gets the ES module's (`.d.ts`, the package being "type": "module"), a require the CommonJS one's (`.d.cts`):
    // TypeScript reads a `.d.ts` here as an ES module, which a CommonJS file can't require (TS1479).
    type Entry = { import: { types: string }; require: { types: string } };
    const entries = Object.entries(pkg.exports as Record<string, Entry | string>).filter((pair): pair is [string, Entry] => typeof pair[1] === "object");
    expect(entries.map(([subpath]) => subpath)).toEqual([".", "./builder", "./inspect", "./pdf", "./image"]);
    for (const [, entry] of entries) expect(entry.require.types).toBe(entry.import.types.replace(/\.d\.ts$/, ".d.cts"));
    const declared = new Set(entries.flatMap(([, entry]) => [join(dir, entry.import.types), join(dir, entry.require.types)]));
    const inPackage = (file: string) => (file.startsWith(installed) ? join(dir, file.slice(installed.length)) : file);
    const host: ts.ModuleResolutionHost = { ...ts.sys, fileExists: (file) => declared.has(inPackage(file)) || ts.sys.fileExists(file) };
    // Each setting, the file importing (its extension makes it an ES module or CommonJS under node16) and the
    // declarations it must get.
    const settings: Array<[string, ts.CompilerOptions, string, "import" | "require"]> = [
      ["node10", { moduleResolution: ts.ModuleResolutionKind.Node10, module: ts.ModuleKind.CommonJS }, "index.ts", "import"],
      ["node16 ES module", { moduleResolution: ts.ModuleResolutionKind.Node16, module: ts.ModuleKind.Node16 }, "index.mts", "import"],
      ["node16 CommonJS", { moduleResolution: ts.ModuleResolutionKind.Node16, module: ts.ModuleKind.Node16 }, "index.cts", "require"],
      ["bundler", { moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext }, "index.ts", "import"],
    ];
    const found: Record<string, string> = {};
    const want: Record<string, string> = {};
    for (const [subpath, entry] of entries) {
      const name = `@hyper-elements/react${subpath.slice(1)}`;
      for (const [setting, options, file, condition] of settings) {
        // How a file of that extension imports, which a program tells the resolver from the file.
        const mode = file.endsWith(".mts") ? ts.ModuleKind.ESNext : file.endsWith(".cts") ? ts.ModuleKind.CommonJS : undefined;
        const resolved = ts.resolveModuleName(name, join(project, file), options, host, undefined, undefined, mode).resolvedModule?.resolvedFileName;
        found[`${setting} ${name}`] = resolved ? inPackage(resolved) : "(not found)";
        want[`${setting} ${name}`] = join(dir, entry[condition].types);
      }
    }
    expect(found).toEqual(want);
  });
});
