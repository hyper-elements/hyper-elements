/**
 * renderInEmailClients(): which files a call writes (identity, order, skipped), what it rejects, the version check
 * against core, the checks it passes render(), and the shell around the email: the email as escaped data, never
 * markup, and a CSP that lets no script run but the models and the runtime.
 */
import React from "react";
import { Button, Email, Html, Page, render, Text, type ElementsPlugin } from "@hyper-elements/react";
import { SCRIPT_SHA256 } from "@hyper-elements/email-client-models";
import { checkCore, checkProtocol, CORE_RANGE, MODEL_PROTOCOLS } from "../src/core";
import { forgetModelsPackage, loadModelsPackage } from "../src/models";
import { contentSecurityPolicy, inlineSafe, scriptJson } from "../src/shell";
import { DEFAULT_PREVIEW_CLIENTS, EMAIL_CLIENTS, emailClients, PREVIEW_CLIENTS, renderInEmailClients } from "../src/index";
import { RUNTIME } from "../src/runtime.generated";

const welcome = (
  <Email width={600}>
    <Text>Welcome</Text>
    <Button href="https://example.test">Start</Button>
  </Email>
);

/** The JSON a file embeds under `id`. */
const embedded = (html: string, id: string) => JSON.parse(new RegExp(`<script type="application/json" id="${id}">([^<]*)</script>`).exec(html)![1]!);

describe("renderInEmailClients()", () => {
  it("writes one file per client asked for, the four captured by default, each with its id, width and file name", async () => {
    const { previews, skipped, diagnostics } = await renderInEmailClients(welcome);
    expect(previews.map(({ id, client, variant, dark, width, filename, approximate }) => ({ id, client, variant, dark, width, filename, approximate }))).toEqual([
      { id: "outlook", client: "outlook", variant: "desktop", dark: false, width: 820, filename: "outlook.html", approximate: true },
      { id: "outlook-com", client: "outlook-com", variant: "desktop", dark: false, width: 820, filename: "outlook-com.html", approximate: false },
      { id: "gmail", client: "gmail", variant: "desktop", dark: false, width: 820, filename: "gmail.html", approximate: false },
      { id: "apple-mail", client: "apple-mail", variant: "desktop", dark: false, width: 820, filename: "apple-mail.html", approximate: false },
    ]);
    expect(DEFAULT_PREVIEW_CLIENTS).toEqual(["outlook", "outlook-com", "gmail", "apple-mail"]);
    expect(skipped).toEqual([]);
    expect(diagnostics).toEqual((await render(welcome, { plugins: [await emailClients({ clients: DEFAULT_PREVIEW_CLIENTS })] })).diagnostics);
  });

  it("passes render() the caller's plugins and its own checks for the clients previewed, unless the caller passed them", async () => {
    const seen: string[] = [];
    const other: ElementsPlugin = { name: "other", api: 1, check: () => (seen.push("other"), []) };
    const unsized = (
      <Email width={600}>
        <Text>Hi</Text>
        <Html html='<div style="box-shadow: 0 0 2px red">x</div>' />
      </Email>
    );
    const own = await renderInEmailClients(unsized, { emailClients: ["gmail"], plugins: [other] });
    expect(seen).toEqual(["other"]);
    expect(own.diagnostics.filter((d) => d.code === "email/html-css").map((d) => d.clients)).toEqual([["gmail"]]);
    expect(own.diagnostics.map((d) => d.code)).not.toContain("email/more-checks");
    // The caller's own email-clients plugin is used as it is: its clients, not the previews'.
    const theirs = await renderInEmailClients(unsized, { emailClients: ["gmail"], plugins: [await emailClients({ clients: ["outlook", "gmail"] })] });
    expect(theirs.diagnostics.filter((d) => d.code === "email/html-css").map((d) => d.clients)).toEqual([["outlook", "gmail"]]);
  });

  it("keeps the order asked for, each client once, light before dark; skips what can't be previewed, saying why", async () => {
    const { previews, skipped } = await renderInEmailClients(welcome, { emailClients: ["gmail-app", "apple-mail", "yahoo", "outlook", "apple-mail"], dark: true });
    expect(previews.map((p) => [p.id, p.filename, p.variant, p.width])).toEqual([
      ["gmail-app", "gmail-app.html", "phone", 375],
      ["apple-mail", "apple-mail.html", "desktop", 820],
      ["apple-mail.dark", "apple-mail.dark.html", "desktop", 820],
      ["outlook", "outlook.html", "desktop", 820],
    ]);
    expect(skipped).toEqual([
      { client: "gmail-app", dark: true, reason: "Gmail app's dark mode isn't measured" },
      { client: "yahoo", dark: false, reason: "Yahoo Mail has no model to draw with: what's known of it is caniemail's tables" },
      { client: "outlook", dark: true, reason: "Classic Outlook's dark mode isn't measured" },
    ]);
    // Every client with a model is one the plugin knows.
    for (const client of PREVIEW_CLIENTS) expect(EMAIL_CLIENTS[client]).toBeDefined();
  });

  it("rejects a root that isn't an Email, a template with errors, and a client it doesn't know", async () => {
    const page = await renderInEmailClients(<Page width={600}><Text>Hi</Text></Page>).catch((e: unknown) => e);
    expect((page as { diagnostics: unknown }).diagnostics).toEqual([{ code: "email-clients/not-an-email", severity: "error", message: "renderInEmailClients() previews an Email; this template's root is another (a Page, a Document or a Canvas)", path: "root" }]);
    const broken = await renderInEmailClients(<Email width={600}><Text style={{ marginBottom: 4 } as never}>Hi</Text></Email>).catch((e: unknown) => e);
    expect((broken as { diagnostics: Array<{ code: string }> }).diagnostics.map((d) => d.code)).toContain("style/unknown");
    await expect(renderInEmailClients(welcome, { emailClients: ["hotmail" as never] })).rejects.toThrow(TypeError);
  });

  it("embeds the email as data, so markup in it can't end its script or run", async () => {
    const evil = '</script><script>alert(1)</script><img src=x onerror="alert(2)">\u2028\u2029&amp;';
    const element = (
      <Email width={600}>
        <Html html={evil} />
      </Email>
    );
    const { previews } = await renderInEmailClients(element, { emailClients: ["gmail"] });
    const file = previews[0]!.html;
    // The only script tags: the two data blocks, the models and the runtime, which the CSP names by their hashes.
    expect(file.match(/<script\b[^>]*>/g)).toEqual(['<script type="application/json" id="email">', '<script type="application/json" id="email-client-config">', "<script>", "<script>"]);
    expect(file).toContain(`script-src 'sha256-${SCRIPT_SHA256}' 'sha256-${RUNTIME.sha256}' 'wasm-unsafe-eval'`);
    expect(file).not.toContain("</script><script>alert");
    expect(embedded(file, "email")).toBe((await render(element, { plugins: [await emailClients({ clients: ["gmail"] })] })).html);
    const config = embedded(file, "email-client-config");
    expect(config).toMatchObject({ id: "gmail", client: "gmail", name: "Gmail", variant: "desktop", width: 820, dark: false, blocks: { version: 2, unit: "utf8" } });
    expect(config.blocks.entries.every((entry: { type?: unknown }) => typeof entry.type === "string")).toBe(true);
    expect(scriptJson("</script>\u2028")).toBe('"\\u003c/script\\u003e\\u2028"');
  });

  it("writes each file, with its fonts inline, the models and the runtime, in under 2 MB; about half that for classic Outlook where the email doesn't name Inter", async () => {
    const { previews } = await renderInEmailClients(welcome, { emailClients: [...PREVIEW_CLIENTS], dark: true, fonts: "inline" });
    for (const preview of previews) expect([preview.id, Buffer.byteLength(preview.html) < 2_000_000]).toEqual([preview.id, true]);
    const outlook = previews.find((p) => p.id === "outlook")!;
    expect(Buffer.byteLength(outlook.html)).toBeLessThan(1_100_000);
    const config = embedded(outlook.html, "email-client-config");
    expect(Object.keys(config.fontSources).some((file: string) => file.startsWith("InterVariable"))).toBe(false);
    expect(config.faces.some((face: string) => face.endsWith('"Inter"'))).toBe(false);
  });

  it("loads Inter's stand-in where the email names Inter, in any of its stacks", async () => {
    const named = (
      <Email width={600}>
        <Text style={{ fontFamily: "Inter, Arial, sans-serif" }}>Welcome</Text>
      </Email>
    );
    const { previews } = await renderInEmailClients(named, { emailClients: ["outlook"] });
    const config = embedded(previews[0]!.html, "email-client-config");
    expect(Object.keys(config.fontSources).filter((file: string) => file.startsWith("InterVariable")).sort()).toEqual(["InterVariable-Italic.woff2", "InterVariable.woff2"]);
    expect(config.faces.filter((face: string) => face.endsWith('"Inter"'))).toHaveLength(2);
  });

  it("refuses a list of clients that isn't one, as emailClients({ clients }) does", async () => {
    await expect(renderInEmailClients(welcome, { emailClients: "gmail" as never })).rejects.toThrow(/renderInEmailClients\(\{ emailClients \}\) takes a list of outlook, /);
  });

  it("writes in no script that would end its <script> element", () => {
    expect(inlineSafe("console.log(1)", "x")).toBe("console.log(1)");
    expect(() => inlineSafe("a = '</script>'", "The email client models' script")).toThrow(/The email client models' script can't be written into a preview/);
    expect(() => inlineSafe("a = '<!--'; b = '<script>'", "x")).toThrow(expect.objectContaining({ name: "email-clients/version-mismatch" }));
  });

  it("lets only the models and the runtime run, the models compile WebAssembly, and fetches nothing but fonts and images", () => {
    expect(contentSecurityPolicy({ runtime: { script: "", sha256: "abc=" }, models: { script: "", sha256: "def=" } }, "https://cdn.jsdelivr.net")).toBe(
      "default-src 'none'; script-src 'sha256-def=' 'sha256-abc=' 'wasm-unsafe-eval'; style-src 'unsafe-inline'; font-src https://cdn.jsdelivr.net data: https:; img-src * data:"
    );
    expect(contentSecurityPolicy(null, null)).toBe("default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; font-src data: https:; img-src * data:");
  });
});

describe("the version check", () => {
  const core = { render() {}, prepare() {}, ElementsError: class {}, PLUGIN_API: 1, BLOCK_MAP_VERSION: 2 };
  const mismatch = (lib: Record<string, unknown>) => {
    try {
      checkCore(lib);
    } catch (error) {
      return { name: (error as Error).name, message: (error as Error).message };
    }
    return null;
  };

  it("names the core range package.json declares, and this package's own line, in what to install", async () => {
    const pkg = (await import("../package.json")).default as { version: string; peerDependencies: Record<string, string> };
    expect(CORE_RANGE).toBe(pkg.peerDependencies["@hyper-elements/react"]);
    expect(mismatch({})!.message).toContain(`npm i @hyper-elements/react@${CORE_RANGE} @hyper-elements/email-clients@^${pkg.version.split(".").slice(0, 2).join(".")}`);
  });

  it("passes a core with render()'s blockMap in a format it reads, as the installed one is", () => {
    expect(mismatch(core)).toBeNull();
    expect(() => checkCore()).not.toThrow();
  });

  it("refuses a models package that speaks another protocol, as a mismatched install", () => {
    expect(() => checkProtocol(MODEL_PROTOCOLS[0])).not.toThrow();
    expect(() => checkProtocol(2)).toThrow(expect.objectContaining({ name: "email-clients/version-mismatch", message: expect.stringContaining("reads @hyper-elements/email-client-models' protocol 1; the one installed speaks 2") }));
    expect(() => checkProtocol(undefined)).toThrow(/the one installed speaks undefined/);
  });

  it("imports the models package once, and again after it's forgotten (a failed import)", async () => {
    const first = loadModelsPackage();
    expect(loadModelsPackage()).toBe(first);
    forgetModelsPackage();
    const again = loadModelsPackage();
    expect(again).not.toBe(first);
    expect(await again).toBe(await first);
  });

  it("names what's missing and how to install a matching pair, for an older core or a format it doesn't read", () => {
    const { BLOCK_MAP_VERSION: _, ...older } = core;
    expect(mismatch(older)).toEqual({
      name: "email-clients/version-mismatch",
      message: `@hyper-elements/email-clients needs @hyper-elements/react ${CORE_RANGE}; the one installed has no BLOCK_MAP_VERSION (render()'s blockMap). Install a matching pair: npm i @hyper-elements/react@${CORE_RANGE} @hyper-elements/email-clients@^0.4`,
    });
    // 0.3.1's format: no block types, which the findings need.
    expect(mismatch({ ...core, BLOCK_MAP_VERSION: 1 })!.message).toContain("a blockMap format it reads (this core's is 1, it reads 2)");
    expect(mismatch({ BLOCK_MAP_VERSION: 2 })!.message).toContain("has no render, prepare, ElementsError, PLUGIN_API (plugins)");
    // 0.3's core: no plugins.
    const { PLUGIN_API: __, ...noPlugins } = core;
    expect(mismatch(noPlugins)!.message).toContain("has no PLUGIN_API (plugins)");
    expect(mismatch({ ...core, PLUGIN_API: 2 })!.message).toContain("a plugin api it's written for (this core's is 2, it's written for 1)");
  });
});
