/**
 * The built package, as an app installs it: both module formats import in plain Node and write previews (core left
 * external, never bundled), and its types resolve under every moduleResolution. Run after `pnpm build`.
 */
import { createRequire } from "node:module";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import ts from "typescript";

const dir = resolve(__dirname, "..");
const built = existsSync(join(dir, "dist/index.js")) && existsSync(join(dir, "dist/index.cjs"));

// Locally, after `pnpm build`; in CI always, so a build that's missing fails here rather than skipping these.
describe.runIf(built || !!process.env.CI)("the built package", () => {
  it("is built", () => {
    expect(built, "dist/index.js and dist/index.cjs: run pnpm build first").toBe(true);
  });

  it("imports in both module formats, without a browser, and writes previews", async () => {
    const esm = await import(join(dir, "dist/index.js"));
    const cjs = createRequire(join(dir, "package.json"))(join(dir, "dist/index.cjs"));
    const React = await import("react");
    const core = await import("@hyper-elements/react");
    const email = React.createElement(core.Email, { width: 600 }, React.createElement(core.Text, null, "Hi"));
    for (const entry of [esm, cjs]) {
      expect(entry.renderInEmailClients).toBeTypeOf("function");
      const { previews } = await entry.renderInEmailClients(email, { emailClients: ["gmail"], computers: ["windows"] });
      expect(previews.map((p: { filename: string }) => p.filename)).toEqual(["gmail.html"]);
      // Its font files, read from beside dist/ in either format.
      const inline = await entry.renderInEmailClients(email, { emailClients: ["outlook-com"], fonts: "inline" });
      expect(inline.previews[0].html).toContain("data:font/woff2;base64,");
    }
    expect(typeof document).toBe("undefined");
  });

  it("leaves core external: it imports @hyper-elements/react by name and bundles none of it", () => {
    for (const file of ["dist/index.js", "dist/index.cjs"]) {
      const text = readFileSync(join(dir, file), "utf8");
      expect(text, file).toMatch(/from '@hyper-elements\/react'|require\('@hyper-elements\/react'\)/);
      expect(text, file).not.toContain("elements-core");
      expect(text, file).not.toContain("function renderTemplate");
    }
  });

  it("imports /html in both module formats, without a browser, and previews an HTML email", async () => {
    const esm = await import(join(dir, "dist/html.js"));
    const cjs = createRequire(join(dir, "package.json"))(join(dir, "dist/html.cjs"));
    const html = "<!DOCTYPE html><html><body><p>Hi</p></body></html>";
    for (const entry of [esm, cjs]) {
      const { previews, diagnostics } = await entry.renderInEmailClients(html, { emailClients: ["gmail"], computers: ["windows"] });
      expect(previews.map((p: { filename: string }) => p.filename)).toEqual(["gmail.html"]);
      expect(diagnostics.filter((d: { code: string }) => d.code !== "email/captured-checks")).toEqual([]);
      const inline = await entry.renderInEmailClients(html, { emailClients: ["outlook-com"], computers: ["windows"], fonts: "inline" });
      expect(inline.previews[0].html).toContain("data:font/woff2;base64,");
    }
  });

  it("keeps /html free of React and core, in its code and in its declarations (and the chunks they import)", () => {
    const specifiers = (text: string) => [...text.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm)].map((m) => m[1]!);
    const seen = new Set<string>();
    const visit = (file: string): string[] => {
      if (seen.has(file)) return [];
      seen.add(file);
      const found = specifiers(readFileSync(join(dir, "dist", file), "utf8"));
      // A declaration's relative import is a chunk of declarations beside it: follow it.
      const chunks = found.filter((s) => s.startsWith("./")).map((s) => s.slice(2).replace(/\.c?js$/, file.endsWith(".d.cts") ? ".d.cts" : ".d.ts"));
      return [...found.filter((s) => !s.startsWith("./")), ...chunks.filter((c) => c.includes(".d.")).flatMap(visit)];
    };
    for (const file of ["html.js", "html.cjs", "html.d.ts", "html.d.cts"]) {
      const imported = visit(file);
      expect(imported.filter((s) => s === "react" || s === "react-dom" || s.startsWith("react/") || s.startsWith("@hyper-elements/react")), file).toEqual([]);
    }
    expect(seen.size).toBeGreaterThan(4);
  });

  it("resolves /html's types under node16 and bundler, for each module format", () => {
    const project = mkdtempSync(join(tmpdir(), "email-clients-html-types-"));
    const installed = join(project, "node_modules", "@hyper-elements", "email-clients");
    mkdirSync(join(project, "node_modules", "@hyper-elements"), { recursive: true });
    symlinkSync(dir, installed, "dir");
    const inPackage = (file: string) => (file.startsWith(installed) ? join(dir, file.slice(installed.length)) : file);
    const settings: Array<[string, ts.CompilerOptions, string]> = [
      ["node16 (CommonJS)", { moduleResolution: ts.ModuleResolutionKind.Node16, module: ts.ModuleKind.Node16 }, "dist/html.d.cts"],
      ["bundler", { moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext }, "dist/html.d.ts"],
    ];
    const found = Object.fromEntries(
      settings.map(([name, options]) => {
        const resolved = ts.resolveModuleName("@hyper-elements/email-clients/html", join(project, "index.ts"), options, ts.sys).resolvedModule?.resolvedFileName;
        return [name, resolved ? inPackage(resolved) : "(not found)"];
      })
    );
    expect(found).toEqual(Object.fromEntries(settings.map(([name, , file]) => [name, join(dir, file)])));
  });

  it("resolves its types under node10, node16 and bundler, for each module format", () => {
    const project = mkdtempSync(join(tmpdir(), "email-clients-types-"));
    const installed = join(project, "node_modules", "@hyper-elements", "email-clients");
    mkdirSync(join(project, "node_modules", "@hyper-elements"), { recursive: true });
    symlinkSync(dir, installed, "dir");
    const inPackage = (file: string) => (file.startsWith(installed) ? join(dir, file.slice(installed.length)) : file);
    const settings: Array<[string, ts.CompilerOptions, string]> = [
      ["node10", { moduleResolution: ts.ModuleResolutionKind.Node10, module: ts.ModuleKind.CommonJS }, "dist/index.d.ts"],
      ["node16 (CommonJS)", { moduleResolution: ts.ModuleResolutionKind.Node16, module: ts.ModuleKind.Node16 }, "dist/index.d.cts"],
      ["bundler", { moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext }, "dist/index.d.ts"],
    ];
    const found = Object.fromEntries(
      settings.map(([name, options]) => {
        const resolved = ts.resolveModuleName("@hyper-elements/email-clients", join(project, "index.ts"), options, ts.sys).resolvedModule?.resolvedFileName;
        return [name, resolved ? inPackage(resolved) : "(not found)"];
      })
    );
    expect(found).toEqual(Object.fromEntries(settings.map(([name, , file]) => [name, join(dir, file)])));
  });
});
