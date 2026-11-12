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

  it("leaves core external, loaded when a template needs it: by name, in each build's own format, and none of it bundled", () => {
    const esm = readFileSync(join(dir, "dist/index.js"), "utf8");
    const cjs = readFileSync(join(dir, "dist/index.cjs"), "utf8");
    // Nothing loads core when the module loads: only loadCore() does, when a template is rendered.
    expect(esm).not.toMatch(/^import [^;]*['"]@hyper-elements\/react['"]/m);
    expect(esm).toContain("await import('@hyper-elements/react')");
    expect(esm).not.toMatch(/require\(['"]@hyper-elements\/react['"]\)/);
    expect(cjs).not.toMatch(/^var \w+ = require\(['"]@hyper-elements\/react['"]\)/m);
    expect(cjs).toMatch(/if \(true\) return __require\("@hyper-elements\/react"\)/);
    for (const file of ["dist/index.js", "dist/index.cjs"]) {
      const text = readFileSync(join(dir, file), "utf8");
      expect(text, file).not.toContain("elements-core");
      expect(text, file).not.toContain("function renderTemplate");
    }
  });

  it("previews an HTML email in both module formats", async () => {
    const esm = await import(join(dir, "dist/index.js"));
    const cjs = createRequire(join(dir, "package.json"))(join(dir, "dist/index.cjs"));
    const html = "<!DOCTYPE html><html><body><p>Hi</p></body></html>";
    for (const entry of [esm, cjs]) {
      const { previews, diagnostics } = await entry.renderInEmailClients(html, { emailClients: ["gmail"], computers: ["windows"] });
      expect(previews.map((p: { filename: string }) => p.filename)).toEqual(["gmail.html"]);
      expect(diagnostics.filter((d: { code: string }) => d.code !== "email/captured-checks")).toEqual([]);
      const inline = await entry.renderInEmailClients(html, { emailClients: ["outlook-com"], computers: ["windows"], fonts: "inline" });
      expect(inline.previews[0].html).toContain("data:font/woff2;base64,");
    }
  });

  it("gives a caller its own core's ElementsError, in each module format", async () => {
    const esm = await import(join(dir, "dist/index.js"));
    const cjs = createRequire(join(dir, "package.json"))(join(dir, "dist/index.cjs"));
    const React = await import("react");
    const esmCore = await import("@hyper-elements/react");
    const cjsCore = createRequire(join(dir, "package.json"))("@hyper-elements/react");
    for (const [entry, core] of [[esm, esmCore], [cjs, cjsCore]] as const) {
      const page = React.createElement(core.Page, null, React.createElement(core.Text, null, "Hi"));
      const error = await entry.renderInEmailClients(page).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(core.ElementsError);
    }
  });

  it("doesn't keep a failed load of core in the CommonJS build: the next template call loads it", async () => {
    const load = createRequire(join(dir, "package.json"));
    const file = load.resolve(join(dir, "dist/index.cjs"));
    delete load.cache[file];
    const fresh = load(file);
    const React = await import("react");
    const core = load("@hyper-elements/react");
    const page = React.createElement(core.Page, null, React.createElement(core.Text, null, "Hi"));
    // require() of core throws synchronously, as it does when core isn't installed.
    const Module = load("node:module") as { _load: (request: string, ...rest: unknown[]) => unknown };
    const original = Module._load;
    Module._load = function (this: unknown, request: string, ...rest: unknown[]) {
      if (request === "@hyper-elements/react") throw Object.assign(new Error("Cannot find module '@hyper-elements/react'"), { code: "MODULE_NOT_FOUND" });
      return original.call(this, request, ...rest);
    };
    try {
      await expect(fresh.renderInEmailClients(page)).rejects.toMatchObject({ name: "email-clients/version-mismatch" });
    } finally {
      Module._load = original;
    }
    // Installed now: the Page is refused by core's own ElementsError, so core loaded.
    expect(await fresh.renderInEmailClients(page).catch((e: unknown) => e)).toBeInstanceOf(core.ElementsError);
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
