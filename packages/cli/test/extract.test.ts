/**
 * `template extract` (Phase 4): a design a person approved, turned into a template by a codemod on its source. Each
 * fixture extracts, and the template rendered with its `example` gives the same bytes as the design: its HTML (ids
 * kept, a link to one of them), its plain text, a Canvas's image, and an Email's builder design. A computed value is
 * reported where it is, and nothing is written.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { CLI_ROOT, cli, cliEnv, FIXTURES, lines, project, withFixtures } from "./helpers";

const fixture = (name: string) => readFileSync(join(FIXTURES, "extract", name), "utf8");
const TSX = join(CLI_ROOT, "node_modules", "tsx", "dist", "esm", "api", "index.mjs");

/**
 * Both modules loaded in a process of the project's (with tsx), and what Elements writes for each: the design's
 * element, and the template's check of its example (its snapshot, as the CLI renders it).
 */
function compare(dir: string, design: string, template: string): { design: Record<string, unknown>; template: Record<string, unknown> } {
  writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({ compilerOptions: { jsx: "react-jsx", module: "esnext", moduleResolution: "bundler", target: "es2022" } }));
  writeFileSync(
    join(dir, "compare.mjs"),
    `import { tsImport } from ${JSON.stringify(pathToFileURL(TSX).href)};
import { createElement } from "react";
import { render } from "@hyper-elements/react";
import { toDesign } from "@hyper-elements/react/builder";
const unwrap = (mod) => (mod.default && typeof mod.default === "object" && "default" in mod.default ? mod.default.default : mod.default);
const Design = unwrap(await tsImport(${JSON.stringify(`./${design}`)}, import.meta.url));
const Template = unwrap(await tsImport(${JSON.stringify(`./${template}`)}, import.meta.url));
const checked = Template.check(Template.example);
if (!checked.valid) throw new Error(JSON.stringify(checked.diagnostics));
const element = createElement(Design);
const out = async (what, builder) => {
  const rendered = await render(what);
  let design = null;
  try { design = builder ? JSON.stringify(toDesign(builder).design) : null; } catch (error) { design = String(error.message); }
  return { html: rendered.html, text: rendered.text ?? null, builder: design };
};
const root = Template.root;
process.stdout.write(JSON.stringify({
  design: await out(element, root === "Email" ? element : null),
  template: await out(checked.snapshots.default, root === "Email" ? Template.design(Template.example) : null),
}));
`,
  );
  const ran = spawnSync(process.execPath, ["compare.mjs"], { cwd: dir, env: cliEnv(), encoding: "utf8" });
  if (ran.status !== 0) throw new Error(ran.stderr);
  return JSON.parse(ran.stdout);
}

describe("template extract", () => {
  it("a Canvas: text, a list of siblings and an image become fields, and the template writes the design's bytes", async () => {
    const dir = withFixtures(project({ "designs/orbit.tsx": fixture("orbit.tsx") }));
    const ran = await cli(dir, ["template", "extract", "designs/orbit.tsx", "--id", "acme.LaunchGraphic", "--field", "headline", "--field", "features", "--field", "launchDate", "--field", "artwork", "-o", "templates/launch-graphic.tsx", "--json"]);
    expect(ran.code, ran.stdout + ran.stderr).toBe(0);
    expect(JSON.parse(ran.stdout)).toMatchObject({ status: "ok", output: "templates/launch-graphic.tsx", fields: [{ name: "headline", kind: "text" }, { name: "features", kind: "text", items: 3 }, { name: "launchDate", kind: "text" }, { name: "artwork", kind: "image" }] });
    const text = readFileSync(join(dir, "templates/launch-graphic.tsx"), "utf8");
    // Bound where it is, its id kept; the literals as its example (JSX text as React reads it).
    expect(text).toContain(`<Heading field="headline" id="headline" level={1} style={{ fontSize: 40 }}>{v.headline}</Heading>`);
    expect(text).toContain(`<Text field="features[1]" id="features-1">{v.features[1]}</Text>`);
    expect(text).toContain(`<Image field="artwork" id="artwork" src={v.artwork}`);
    expect(text).toContain(`headline: "Meet Orbit: release notes that write themselves",`);
    expect(text).toContain(`features: ["Drafts from merged PRs", "Your voice, every release", "Ships to Slack & email"],`);
    expect(text).toContain(`artwork: { src: "../images/tide.png", width: 64, height: 64 },`);
    expect(text).toContain(`features: prop.list(prop.text({ label: "Features" }), { label: "Features", required: true, min: 3, max: 3 }),`);

    // Its CI: check renders its example, and it describes its fields.
    const checked = await cli(dir, ["check", "templates/launch-graphic.tsx", "--json"]);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    expect(lines(checked)[0]).toMatchObject({ input: "template", template: { id: "acme.LaunchGraphic", version: "0.1.0" } });

    const same = compare(dir, "designs/orbit.tsx", "templates/launch-graphic.tsx");
    expect(same.template.html).toBe(same.design.html);
    expect(same.design.html).toContain('id="headline"');
    // The image, as the CLI draws it from each.
    writeFileSync(join(dir, "designs/from-template.tsx"), `import T from "../templates/launch-graphic";\nexport default () => <T {...(T as any).example} />;\n`);
    const drawn = await cli(dir, ["render", "designs/orbit.tsx", "designs/from-template.tsx"]);
    expect(drawn.code, drawn.stdout + drawn.stderr).toBe(0);
    expect(readFileSync(join(dir, "out/designs/from-template.png")).equals(readFileSync(join(dir, "out/designs/orbit.png")))).toBe(true);
  });

  it("written in a folder at another depth: its imports, its src paths and its example's images are the template's folder's", async () => {
    const dir = withFixtures(project({ "designs/orbit.tsx": fixture("orbit.tsx") }));
    const ran = await cli(dir, ["template", "extract", "designs/orbit.tsx", "--id", "acme.LaunchGraphic", "--field", "headline", "--field", "artwork", "-o", "brand/templates/launch.tsx"]);
    expect(ran.code, ran.stdout + ran.stderr).toBe(0);
    const text = readFileSync(join(dir, "brand/templates/launch.tsx"), "utf8");
    expect(text).toContain(`src: "../../fonts/Inter-Regular.ttf"`);
    expect(text).toContain(`artwork: { src: "../../images/tide.png", width: 64, height: 64 },`);
    const checked = await cli(dir, ["check", "brand/templates/launch.tsx", "--json"]);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
  });

  it("an Email: its HTML (ids kept, and the link to one), plain text and builder design are the design's", async () => {
    const dir = project({ "designs/welcome.tsx": fixture("welcome.tsx") });
    const ran = await cli(dir, ["template", "extract", "designs/welcome.tsx", "--id", "acme.Welcome", "--field", "title", "--field", "cta", "--label", "Welcome email", "-o", "templates/welcome.tsx"]);
    expect(ran.code, ran.stdout + ran.stderr).toBe(0);
    expect(ran.stdout).toContain("templates/welcome.tsx: acme.Welcome, its fields title, cta");
    const text = readFileSync(join(dir, "templates/welcome.tsx"), "utf8");
    expect(text).toContain(`label: "Welcome email",`);
    // Its other parts stay as written: the footer's constant, the design's own declaration gone.
    expect(text).toContain(`const footer = "Acme, 1 Main Street";`);
    expect(text).not.toContain("const Welcome =");
    expect(text).toContain(`import { Button, Email, Heading, Link, Section, Text, prop } from "@hyper-elements/react";`);

    const same = compare(dir, "designs/welcome.tsx", "templates/welcome.tsx");
    expect(same.template.html).toBe(same.design.html);
    expect(same.template.text).toBe(same.design.text);
    expect(same.design.html).toContain('id="cta"');
    expect(same.design.html).toContain('href="#cta"');
    expect(same.template.builder).toBe(same.design.builder);
    expect(typeof same.design.builder === "string" && same.design.builder.startsWith("{")).toBe(true);
  });

  it("a computed value is extract/not-literal, where it is, and nothing is written (exit 1)", async () => {
    const dir = project({ "designs/computed.tsx": fixture("computed.tsx") });
    const ran = await cli(dir, ["template", "extract", "designs/computed.tsx", "--id", "acme.Hello", "--field", "title", "--field", "body", "-o", "templates/hello.tsx", "--json"]);
    expect(ran.code).toBe(1);
    const line = JSON.parse(ran.stdout);
    expect(line).toMatchObject({ status: "error", diagnostics: [{ code: "extract/not-literal", severity: "error" }] });
    expect(line.diagnostics[0].at).toMatch(/computed\.tsx:8:5$/);
    expect(existsSync(join(dir, "templates/hello.tsx"))).toBe(false);
    const text = await cli(dir, ["template", "extract", "designs/computed.tsx", "--id", "acme.Hello", "--field", "title", "-o", "templates/hello.tsx"]);
    expect(text.stderr).toContain("extract/not-literal: title's text isn't literal");
  });

  it("an id that isn't there, or a file already written, is said; usage errors exit 2", async () => {
    const dir = project({ "designs/welcome.tsx": fixture("welcome.tsx"), "templates/welcome.tsx": "taken\n" });
    const missing = await cli(dir, ["template", "extract", "designs/welcome.tsx", "--id", "acme.Welcome", "--field", "subtitle", "-o", "templates/other.tsx", "--json"]);
    expect(missing.code).toBe(1);
    expect(JSON.parse(missing.stdout).diagnostics.map((d: { code: string }) => d.code)).toEqual(["extract/no-id"]);
    const taken = await cli(dir, ["template", "extract", "designs/welcome.tsx", "--id", "acme.Welcome", "--field", "title", "-o", "templates/welcome.tsx"]);
    expect(taken.code).toBe(2);
    expect(readFileSync(join(dir, "templates/welcome.tsx"), "utf8")).toBe("taken\n");
    const forced = await cli(dir, ["template", "extract", "designs/welcome.tsx", "--id", "acme.Welcome", "--field", "title", "-o", "templates/welcome.tsx", "--force"]);
    expect(forced.code, forced.stderr).toBe(0);
    for (const argv of [["template"], ["template", "extract", "designs/welcome.tsx", "--field", "title", "-o", "t.tsx"], ["template", "extract", "designs/welcome.tsx", "--id", "acme.W", "-o", "t.tsx"], ["template", "extract", "designs/welcome.tsx", "--id", "acme.W", "--field", "title", "-o", "t.json"]]) {
      expect((await cli(dir, argv)).code, argv.join(" ")).toBe(2);
    }
  });
});
