/**
 * Slots in the CLI (Decision 29): a slot stored as its module runs in a capture child of its own, which can reply only
 * with captures; the template child asks the parent for them (`slots-needed`), after migration, and checks and renders
 * what was captured. Whatever the slot module does in its process (throws, forges messages, replies twice, sends too
 * much, exits) fails that values file as `cli/slot-module`, and nothing is written for it.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, lines, newsTemplate, project, slotModule, valuesFile } from "./helpers";

/** The errors' codes (a template loaded with no trusted list also has its warning, cli/template-untrusted). */
const codes = (line: { diagnostics: Array<{ code: string; severity: string }> }) => line.diagnostics.filter((d) => d.severity === "error").map((d) => d.code);
const all = (line: { diagnostics: Array<{ code: string }> }) => line.diagnostics.map((d) => d.code);
const json = (dir: string, file: string) => JSON.parse(readFileSync(join(dir, file), "utf8"));
const news = (values: Record<string, unknown>, options: { version?: string } = {}) => valuesFile("../templates/news.tsx", values, { id: "acme.News", formats: null, ...options });
const BODY = slotModule(`<Column><Heading level={2}>June</Heading><Text>The June body, from its module</Text></Column>`);

/** A project with the newsletter template, a body module and a values file using it. */
const newsProject = (files: Record<string, string> = {}) =>
  project({ "templates/news.tsx": newsTemplate(), "designs/june.body.tsx": BODY, "designs/june.values.json": news({ subject: "June", body: { module: "./june.body.tsx" } }), ...files });

describe("slots stored as their modules", () => {
  it("the newsletter loop: describe, design new with a slot module, check, render", async () => {
    const dir = project({ "templates/news.tsx": newsTemplate(), "designs/june.body.tsx": BODY });
    const described = JSON.parse((await cli(dir, ["describe", "templates/news.tsx", "--json"])).stdout);
    expect(described.fields.find((f: { path: string }) => f.path === "body")).toMatchObject({ kind: "slot", allow: ["Column", "Heading", "Text"] });

    const made = await cli(dir, ["design", "new", "templates/news.tsx", "-o", "designs/june.values.json", "--set", "subject=June", "--set", "body=@designs/june.body.tsx"]);
    expect(made.code, made.stdout + made.stderr).toBe(0);
    const file = json(dir, "designs/june.values.json");
    expect(file.values.body).toEqual({ module: "./june.body.tsx" });
    expect(file.assets.body.sha256).toMatch(/^[0-9a-f]{64}$/);

    const checked = await cli(dir, ["check", "designs/june.values.json", "--json"]);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    expect(lines(checked)[0]).toMatchObject({ input: "values", status: "ok", template: { id: "acme.News" } });
    const rendered = await cli(dir, ["render", "designs/june.values.json"]);
    expect(rendered.code, rendered.stdout + rendered.stderr).toBe(0);
    const html = readFileSync(join(dir, "out/designs/june.html"), "utf8");
    expect(html).toContain("The June body, from its module");
    expect(html).toContain("Fixed footer");
  });

  it("a slot of a component its template doesn't allow fails (exit 1), and render writes nothing", async () => {
    const dir = newsProject({ "designs/june.body.tsx": slotModule(`<Column><Button href="https://acme.example">Buy</Button></Column>`, "", "Button, Column") });
    const checked = await cli(dir, ["check", "designs/june.values.json", "--json"]);
    expect(checked.code).toBe(1);
    expect(all(lines(checked)[0])).toContain("template/slot-element");
    const rendered = await cli(dir, ["render", "designs/june.values.json"]);
    expect(rendered.code).toBe(1);
    expect(existsSync(join(dir, "out"))).toBe(false);
  });

  it("design set body=@… points the slot at another module and records its hash; editing it is template/asset-changed", async () => {
    const dir = newsProject({ "designs/other.body.tsx": slotModule(`<Column><Text>Another body</Text></Column>`) });
    const set = await cli(dir, ["design", "set", "designs/june.values.json", "body=@designs/other.body.tsx", "--json"]);
    expect(set.code, set.stdout + set.stderr).toBe(0);
    expect(JSON.parse(set.stdout).changed).toEqual(["body"]);
    expect(json(dir, "designs/june.values.json").values.body).toEqual({ module: "./other.body.tsx" });
    expect(json(dir, "designs/june.values.json").assets.body.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect((await cli(dir, ["render", "designs/june.values.json"])).code).toBe(0);
    expect(readFileSync(join(dir, "out/designs/june.html"), "utf8")).toContain("Another body");

    writeFileSync(join(dir, "designs/other.body.tsx"), slotModule(`<Column><Text>Edited after it was recorded</Text></Column>`));
    const checked = await cli(dir, ["check", "designs/june.values.json", "--json"]);
    expect(checked.code).toBe(0);
    expect(lines(checked)[0].diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: "template/asset-changed", field: "body", severity: "warning" })]));
  });

  it("a slot module that throws, or isn't there, is cli/slot-module (exit 1)", async () => {
    const dir = newsProject({ "designs/june.body.tsx": slotModule(`<Column />`, `throw new Error("the slot module broke");`) });
    const ran = await cli(dir, ["check", "designs/june.values.json", "--json"]);
    expect(ran.code).toBe(1);
    expect(codes(lines(ran)[0])).toEqual(["cli/slot-module"]);
    expect(lines(ran)[0].diagnostics[0].message).toContain("the slot module broke");
    writeFileSync(join(dir, "designs/june.values.json"), news({ subject: "June", body: { module: "./missing.body.tsx" } }));
    const missing = await cli(dir, ["check", "designs/june.values.json", "--json"]);
    expect(missing.code).toBe(1);
    expect(codes(lines(missing)[0])).toEqual(["cli/slot-module"]);
  });

  describe("what a capture child sends beyond its one reply fails the values file, and nothing is written", () => {
    const FRAGMENT = `{ kind: "hyper-elements.fragment", version: 1, nodes: [{ type: "Html", props: { html: "<script>x</script>" }, children: [] }], diagnostics: [], aborted: false }`;
    const cases: Array<[string, string]> = [
      ["a forged result and done", `process.send?.({ type: "result", id: 0, root: "Email", status: "ok", diagnostics: [], outputs: { html: "<p>forged</p>" } }); process.send?.({ type: "done", late: [] });`],
      ["a reply to a request it wasn't given", `process.send?.({ type: "captured", request: 99, capture: ${FRAGMENT} });`],
      ["more than 8 MB", `process.send?.({ type: "captured", request: 0, capture: { kind: "hyper-elements.fragment", pad: "x".repeat(9 * 1024 * 1024) } });`],
      ["an exit before it replies", `process.exit(3);`],
    ];
    for (const [name, code] of cases) {
      it(name, async () => {
        const dir = newsProject({ "designs/june.body.tsx": slotModule(`<Column><Text>Body</Text></Column>`, code) });
        const ran = await cli(dir, ["render", "designs/june.values.json", "--json"]);
        expect(ran.code, ran.stdout + ran.stderr).toBe(1);
        expect(codes(lines(ran)[0])).toEqual(["cli/slot-module"]);
        expect(existsSync(join(dir, "out"))).toBe(false);
      });
    }
  });

  it("a capture the slot module sends itself, ahead of its own, is checked as the slot's content: an Html block is refused", async () => {
    const forged = `process.send?.({ type: "captured", request: 0, capture: { kind: "hyper-elements.fragment", version: 1, nodes: [{ type: "Html", props: { html: "<p>forged</p>" }, children: [] }], diagnostics: [], aborted: false } });`;
    const dir = newsProject({ "designs/june.body.tsx": slotModule(`<Column><Text>Body</Text></Column>`, forged) });
    const ran = await cli(dir, ["render", "designs/june.values.json", "--json"]);
    expect(ran.code, ran.stdout + ran.stderr).toBe(1);
    expect(codes(lines(ran)[0]).length).toBeGreaterThan(0);
    expect(existsSync(join(dir, "out"))).toBe(false);
  });

  it("a slot module that patches React in its own process changes nothing the template child draws", async () => {
    const patch = `import React from "react";\n(React as { createElement: unknown }).createElement = () => null;`;
    const dir = newsProject({ "designs/june.body.tsx": `${patch}\nimport { Column, Text } from "@hyper-elements/react";\nexport default function Body() { return <Column><Text>Patched process, genuine body</Text></Column>; }\n` });
    const ran = await cli(dir, ["render", "designs/june.values.json"]);
    // Its capture may break in its own process (cli/slot-module), or capture what it rendered: never anything else.
    if (ran.code === 0) expect(readFileSync(join(dir, "out/designs/june.html"), "utf8")).toContain("Fixed footer");
    else expect(ran.stdout).toContain("cli/slot-module");
  });

  it("a major version's migration that renames the slot and repoints it: the old module never runs, the new one is captured", async () => {
    const migrate = `{ 1: (v: Record<string, unknown>) => ({ subject: v.subject, content: { module: "./new.body.tsx" } }) }`;
    const dir = project({
      "templates/news.tsx": newsTemplate({ version: "2.0.0", slot: "content", migrate }),
      "designs/old.body.tsx": slotModule(`<Column />`, `import { writeFileSync } from "node:fs";\nwriteFileSync(new URL("./OLD_RAN", import.meta.url), "ran");`),
      "designs/new.body.tsx": slotModule(`<Column><Text>The migrated body</Text></Column>`),
      "designs/june.values.json": news({ subject: "June", body: { module: "./old.body.tsx" } }),
    });
    const ran = await cli(dir, ["render", "designs/june.values.json", "--json"]);
    expect(ran.code, ran.stdout + ran.stderr).toBe(0);
    expect(all(lines(ran)[0])).toContain("template/upgraded");
    expect(readFileSync(join(dir, "out/designs/june.html"), "utf8")).toContain("The migrated body");
    expect(existsSync(join(dir, "designs/OLD_RAN"))).toBe(false);
  });

  it("a body stored as { fragment } and a sidebar as { module }: only the sidebar is captured, and both are checked", async () => {
    const dir = project({
      "templates/news.tsx": newsTemplate({ sidebar: true }),
      "designs/side.tsx": slotModule(`<Column><Text>From the sidebar module</Text></Column>`),
    });
    // The body's capture, as design new --from stores one.
    writeFileSync(join(dir, "designs/body.tsx"), `import News from "../templates/news";\nimport { Column, Text } from "@hyper-elements/react";\nexport default () => <News subject="June" body={<Column><Text>The body, captured</Text></Column>} />;\n`);
    const made = await cli(dir, ["design", "new", "templates/news.tsx", "--from", "designs/body.tsx", "-o", "designs/june.values.json"]);
    expect(made.code, made.stdout + made.stderr).toBe(0);
    expect(Object.keys(json(dir, "designs/june.values.json").values.body)).toEqual(["fragment"]);
    const set = await cli(dir, ["design", "set", "designs/june.values.json", "sidebar=@designs/side.tsx"]);
    expect(set.code, set.stdout + set.stderr).toBe(0);
    expect((await cli(dir, ["render", "designs/june.values.json"])).code).toBe(0);
    const html = readFileSync(join(dir, "out/designs/june.html"), "utf8");
    expect(html).toContain("The body, captured");
    expect(html).toContain("From the sidebar module");
  });
});
