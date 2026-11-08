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

describe.runIf(built)("the built package", () => {
  it("imports in both module formats, without a browser, and writes previews", async () => {
    const esm = await import(join(dir, "dist/index.js"));
    const cjs = createRequire(join(dir, "package.json"))(join(dir, "dist/index.cjs"));
    const React = await import("react");
    const core = await import("@hyper-elements/react");
    const email = React.createElement(core.Email, { width: 600 }, React.createElement(core.Text, null, "Hi"));
    for (const entry of [esm, cjs]) {
      expect(entry.renderInEmailClients).toBeTypeOf("function");
      const { previews } = await entry.renderInEmailClients(email, { emailClients: ["gmail"] });
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
