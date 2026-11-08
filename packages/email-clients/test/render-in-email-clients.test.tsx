/**
 * renderInEmailClients(): which files a call writes (identity, order, skipped), what it rejects, the version check
 * against core, and the shell around the email: the email as escaped data, never markup, and a CSP that lets no
 * script run but the runtime.
 */
import React from "react";
import { Button, EMAIL_CLIENTS, Email, Html, Page, render, Text } from "@hyper-elements/react";
import { checkCore, CORE_RANGE } from "../src/core";
import { contentSecurityPolicy, scriptJson } from "../src/shell";
import { DEFAULT_PREVIEW_CLIENTS, PREVIEW_CLIENTS, renderInEmailClients } from "../src/index";

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
    expect(diagnostics).toEqual((await render(welcome, { emailClients: DEFAULT_PREVIEW_CLIENTS })).diagnostics);
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
    // Every client with a model is one core knows.
    for (const client of PREVIEW_CLIENTS) expect(EMAIL_CLIENTS[client]).toBeDefined();
  });

  it("rejects a root that isn't an Email, a template with errors, and a client it doesn't know", async () => {
    const page = await renderInEmailClients(<Page width={600}><Text>Hi</Text></Page>).catch((e: unknown) => e);
    expect((page as { diagnostics: unknown }).diagnostics).toEqual([{ code: "email-clients/not-an-email", severity: "error", message: "renderInEmailClients() previews an Email; this template's root is a Page", path: "root" }]);
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
    // The only script tags: the two data blocks (no runtime in it yet).
    expect(file.match(/<script\b[^>]*>/g)).toEqual(['<script type="application/json" id="email">', '<script type="application/json" id="email-client-config">']);
    expect(file).not.toContain("</script><script>alert");
    expect(embedded(file, "email")).toBe((await render(element, { emailClients: ["gmail"] })).html);
    const config = embedded(file, "email-client-config");
    expect(config).toMatchObject({ id: "gmail", client: "gmail", name: "Gmail", variant: "desktop", width: 820, dark: false, blocks: { version: 1, unit: "utf8" } });
    expect(scriptJson("</script>\u2028")).toBe('"\\u003c/script\\u003e\\u2028"');
  });

  it("lets only the runtime run, and fetches nothing but fonts and images", () => {
    expect(contentSecurityPolicy({ script: "", sha256: "abc=" }, "https://cdn.jsdelivr.net")).toBe(
      "default-src 'none'; script-src 'sha256-abc='; style-src 'unsafe-inline'; font-src https://cdn.jsdelivr.net data: https:; img-src * data:"
    );
    expect(contentSecurityPolicy(null, null)).toBe("default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; font-src data: https:; img-src * data:");
  });
});

describe("the version check", () => {
  const core = { render() {}, prepare() {}, ElementsError: class {}, EMAIL_CLIENTS: {}, BLOCK_MAP_VERSION: 1 };
  const mismatch = (lib: Record<string, unknown>) => {
    try {
      checkCore(lib);
    } catch (error) {
      return { name: (error as Error).name, message: (error as Error).message };
    }
    return null;
  };

  it("passes a core with render()'s blockMap in a format it reads, as the installed one is", () => {
    expect(mismatch(core)).toBeNull();
    expect(() => checkCore()).not.toThrow();
  });

  it("names what's missing and how to install a matching pair, for an older core or a format it doesn't read", () => {
    const { BLOCK_MAP_VERSION: _, ...older } = core;
    expect(mismatch(older)).toEqual({
      name: "email-clients/version-mismatch",
      message: `@hyper-elements/email-clients needs @hyper-elements/react ${CORE_RANGE}; the one installed has no BLOCK_MAP_VERSION (render()'s blockMap). Install a matching pair: npm i @hyper-elements/react@${CORE_RANGE} @hyper-elements/email-clients@^0.3`,
    });
    expect(mismatch({ ...core, BLOCK_MAP_VERSION: 2 })!.message).toContain("a blockMap format it reads (this core's is 2, it reads 1)");
    expect(mismatch({ BLOCK_MAP_VERSION: 1 })!.message).toContain("has no render, prepare, ElementsError, EMAIL_CLIENTS");
  });
});
