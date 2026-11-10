/**
 * React's side of plugins (plan email-client-models, D5, D7, D8): validate() and render() pass `plugins` to core, and
 * add their notes last: where an Email's client checks are (`email/more-checks`, not when email-clients' plugin is
 * passed, nor with `plugins: []`), and that `emailClients` moved (`email/clients-moved`). Core's own functions never
 * add either, so its support test can't be fooled by one at `root`.
 */
import React from "react";
import { prepareTemplate, renderTemplate, validateTemplate } from "@unlayer-internal/elements-core";
import { collectTemplate } from "./collect";
import { Canvas, Document, Email, Page, PLUGIN_API, prepare, render, Text, validate, type ElementsPlugin } from "./index";

const email = (
  <Email width={600}>
    <Text>Hi</Text>
  </Email>
);
const codes = (diagnostics: Array<{ code: string }>) => diagnostics.map((d) => d.code);
const emailClients: ElementsPlugin = { name: "email-clients", api: PLUGIN_API, check: () => [{ code: "email/example", severity: "info", message: "from the plugin", path: "root" }] };
const other: ElementsPlugin = { name: "other", api: PLUGIN_API };

describe("plugins in validate() and render()", () => {
  it("note where an Email's client checks are, last, once", async () => {
    const validated = validate(email);
    expect(validated.valid).toBe(true);
    expect(codes(validated.diagnostics)).toEqual(["email/more-checks"]);
    expect(validated.diagnostics[0]).toMatchObject({
      severity: "info",
      path: "root",
      fix: "npm i @hyper-elements/email-clients, then validate(email, { plugins: [await emailClients()] })",
    });
    expect(codes((await render(email)).diagnostics)).toEqual(["email/more-checks"]);
  });

  it("leave the note out when email-clients' plugin is passed, or plugins: []; keep it beside other plugins", async () => {
    expect(codes(validate(email, { plugins: [emailClients] }).diagnostics)).toEqual(["email/example"]);
    expect(codes((await render(email, { plugins: [emailClients] })).diagnostics)).toEqual(["email/example"]);
    expect(validate(email, { plugins: [] }).diagnostics).toEqual([]);
    expect(codes(validate(email, { plugins: [other] }).diagnostics)).toEqual(["email/more-checks"]);
  });

  it("say nothing of email clients for a Page, a Document or a Canvas", () => {
    for (const root of [
      <Page key="p" width={600}>
        <Text>Hi</Text>
      </Page>,
      <Document key="d">
        <Text>Hi</Text>
      </Document>,
      <Canvas key="c" width={200} height={100}>
        <Text>Hi</Text>
      </Canvas>,
    ]) {
      expect(codes(validate(root).diagnostics)).not.toContain("email/more-checks");
    }
  });

  it("don't add the note to a template with errors", () => {
    const broken = (
      <Email width={600}>
        <Text style={{ nope: 1 } as never}>Hi</Text>
      </Email>
    );
    const result = validate(broken);
    expect(result.valid).toBe(false);
    expect(codes(result.diagnostics)).not.toContain("email/more-checks");
  });

  it("say that emailClients moved, on any root, for one minor", () => {
    const moved = validate(email, { emailClients: ["gmail"] } as never);
    expect(codes(moved.diagnostics)).toEqual(["email/clients-moved", "email/more-checks"]);
    expect(moved.diagnostics[0]!.fix).toContain("emailClients({ clients: [...] })");
    const page = (
      <Page width={600}>
        <Text>Hi</Text>
      </Page>
    );
    expect(codes(validate(page, { emailClients: [] } as never).diagnostics)).toEqual(["email/clients-moved"]);
  });

  it("leave prepare() without plugins or notes, except that emailClients moved", () => {
    expect(prepare(email).diagnostics).toEqual([]);
    expect(codes(prepare(email, { emailClients: ["gmail"] } as never).diagnostics)).toEqual(["email/clients-moved"]);
  });

  it("throw on plugins that isn't a list, whether or not the template has errors", async () => {
    const broken = (
      <Email width={600}>
        <Text style={{ nope: 1 } as never}>Hi</Text>
      </Email>
    );
    for (const template of [email, broken]) {
      expect(() => validate(template, { plugins: "x" as never })).toThrow(/plugins takes a list of plugins/);
      await expect(render(template, { plugins: "x" as never })).rejects.toThrow(/plugins takes a list of plugins/);
    }
  });

  it("keep the note where email-clients' plugin was passed but core refused it (another plugin api)", () => {
    const future = { name: "email-clients", api: 2 } as never;
    expect(codes(validate(email, { plugins: [future] }).diagnostics)).toEqual(["plugin/unsupported", "email/more-checks"]);
  });

  it("are React's only: core's validateTemplate, prepareTemplate and renderTemplate add neither note", () => {
    const { document } = collectTemplate(email);
    for (const diagnostics of [validateTemplate(document).diagnostics, prepareTemplate(document).diagnostics, renderTemplate(document).diagnostics]) {
      expect(codes(diagnostics)).not.toContain("email/more-checks");
      expect(codes(diagnostics)).not.toContain("email/clients-moved");
    }
  });
});

void React;
