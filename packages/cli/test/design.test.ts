/**
 * `design new` and `design set` (the values file they write, its module and assets), and what reading a values file
 * or a template module checks: assets follow their files (Decision 7), the module's hash, strict fonts, what isn't a
 * template, `describe`'s two paths, and an Elements from before templates.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, copyElements, email, LAUNCH_VALUES, launchTemplate, lines, makePng, noteTemplate, project, valuesFile, withFixtures } from "./helpers";

/** The errors' codes (a template loaded with no trusted list also has its warning, cli/template-untrusted). */
const codes = (line: { diagnostics: Array<{ code: string; severity: string }> }) => line.diagnostics.filter((d) => d.severity === "error").map((d) => d.code);
const json = (dir: string, file: string) => JSON.parse(readFileSync(join(dir, file), "utf8"));

/** An Email of stories, each with an optional image: images inside a list of objects. */
const DIGEST = `import { Email, Image, Text, prop } from "@hyper-elements/react";
import { field, template } from "@hyper-elements/react/template";

export default template({
  id: "acme.Digest",
  version: "1.0.0",
  label: "Digest",
  root: "Email",
  fields: {
    stories: prop.list(prop.object({ title: prop.text({ label: "Title", required: true }), image: field.image({ label: "Image" }) }, { label: "Story" }), { label: "Stories", required: true, min: 1, max: 4 }),
  },
  example: { stories: [{ title: "One" }] },
  render(v) {
    return (
      <Email lang="en" previewText="This week's stories, in a short list for you">
        {v.stories.flatMap((story, i) => [
          <Text key={"t" + i} field={"stories[" + i + "].title"}>{story.title}</Text>,
          ...(story.image ? [<Image key={"i" + i} field={"stories[" + i + "].image"} src={story.image} alt="" />] : []),
        ])}
      </Email>
    );
  },
});
`;

describe("design new and design set", () => {
  it("assets follow their files: a swap keeps each hash and source, a removed item its entry, a new file has none", async () => {
    const dir = project({ "templates/digest.tsx": DIGEST, "a.json": JSON.stringify({ kind: "supplied", by: "a" }), "b.json": JSON.stringify({ kind: "generated", by: "b" }) });
    writeFileSync(join(dir, "a.png"), makePng(20, 10, [255, 0, 0]));
    writeFileSync(join(dir, "b.png"), makePng(30, 10, [0, 0, 255]));
    writeFileSync(join(dir, "c.png"), makePng(40, 10, [0, 255, 0]));
    const made = await cli(dir, ["design", "new", "templates/digest.tsx", "-o", "designs/d.values.json", "--set", "stories[0].title=A", "--set", "stories[0].image=@a.png", "--set", "stories[1].title=B", "--set", "stories[1].image=@b.png", "--source", "stories[0].image=a.json", "--source", "stories[1].image=b.json"]);
    expect(made.code, made.stdout + made.stderr).toBe(0);
    const first = json(dir, "designs/d.values.json");
    expect(first.values.stories).toEqual([{ title: "A", image: { src: "../a.png", width: 20, height: 10 } }, { title: "B", image: { src: "../b.png", width: 30, height: 10 } }]);
    const [a, b] = [first.assets["stories[0].image"], first.assets["stories[1].image"]];
    expect(a.source).toEqual({ kind: "supplied", by: "a" });
    expect(b.source).toEqual({ kind: "generated", by: "b" });
    expect(a.sha256).not.toBe(b.sha256);

    const swapped = await cli(dir, ["design", "set", "designs/d.values.json", `stories=${JSON.stringify([...first.values.stories].reverse())}`]);
    expect(swapped.code, swapped.stdout + swapped.stderr).toBe(0);
    expect(json(dir, "designs/d.values.json").assets).toEqual({ "stories[0].image": b, "stories[1].image": a });

    const removed = await cli(dir, ["design", "set", "designs/d.values.json", `stories=${JSON.stringify([first.values.stories[0]])}`]);
    expect(removed.code).toBe(0);
    expect(json(dir, "designs/d.values.json").assets).toEqual({ "stories[0].image": a });

    const replaced = await cli(dir, ["design", "set", "designs/d.values.json", "stories[0].image=@c.png"]);
    expect(replaced.code, replaced.stdout + replaced.stderr).toBe(0);
    const entry = json(dir, "designs/d.values.json").assets["stories[0].image"];
    expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(entry.sha256).not.toBe(a.sha256);
    expect(entry.source).toBeUndefined();
    // Of unknown origin: a reviewer looks at it, and the run still passes.
    const checked = await cli(dir, ["check", "designs/d.values.json", "--json"]);
    expect(checked.code, checked.stdout).toBe(0);
    expect(lines(checked)[0].review).toEqual(expect.arrayContaining([expect.objectContaining({ field: "stories[0].image", guidance: expect.stringContaining("unknown origin") })]));

    // A file changed under the same name is a new file: its source dropped, with a warning.
    const sourced = await cli(dir, ["design", "set", "designs/d.values.json", "--source", "stories[0].image=a.json"]);
    expect(sourced.code, sourced.stdout + sourced.stderr).toBe(0);
    expect(json(dir, "designs/d.values.json").assets["stories[0].image"].source).toEqual({ kind: "supplied", by: "a" });
    writeFileSync(join(dir, "c.png"), makePng(40, 10, [9, 9, 9]));
    const changed = await cli(dir, ["design", "set", "designs/d.values.json", "stories[0].title=Changed", "--json"]);
    expect(changed.code, changed.stdout).toBe(0);
    expect(JSON.parse(changed.stdout).diagnostics.map((d: { code: string }) => d.code)).toContain("template/asset-changed");
    expect(json(dir, "designs/d.values.json").assets["stories[0].image"].source).toBeUndefined();
  });

  it("writes the module relative to the values file, and reopening it loads that module; a package's is kept as given", async () => {
    const dir = project({
      "templates/note.tsx": noteTemplate(),
      "node_modules/@acme/templates/package.json": JSON.stringify({ name: "@acme/templates", type: "module", exports: { "./note": "./note.tsx" } }),
      "node_modules/@acme/templates/note.tsx": noteTemplate(),
      "designs/p.values.json": valuesFile("@acme/templates/note", { title: "Hi", body: "Body" }, { id: "acme.Note", formats: null }),
    });
    const made = await cli(dir, ["design", "new", "templates/note.tsx", "-o", "designs/n.values.json", "--set", "title=Hi", "--set", "body=Welcome"]);
    expect(made.code, made.stdout + made.stderr).toBe(0);
    const file = json(dir, "designs/n.values.json");
    expect(file.template).toMatchObject({ module: "../templates/note.tsx", id: "acme.Note", version: "1.0.0" });
    expect(file.formats).toBeUndefined();
    const rendered = await cli(dir, ["render", "designs/n.values.json", "--json"]);
    expect(rendered.code, rendered.stdout + rendered.stderr).toBe(0);
    expect(lines(rendered)[0].outputs).toEqual(["out/designs/n.html", "out/designs/n.txt"]);
    expect(readFileSync(join(dir, "out/designs/n.html"), "utf8")).toContain("Welcome");

    const set = await cli(dir, ["design", "set", "designs/p.values.json", "body=Changed"]);
    expect(set.code, set.stdout + set.stderr).toBe(0);
    expect(json(dir, "designs/p.values.json").template.module).toBe("@acme/templates/note");
  });

  it("writes defaults out and image paths relative to the file", async () => {
    const dir = withFixtures(project({ "templates/launch.tsx": launchTemplate() }));
    const made = await cli(dir, ["design", "new", "templates/launch.tsx", "-o", "work/deep/a.values.json", "--set", "headline=Hi", "--set", "launchDate=2026-12-03", "--set", "art=@images/tide.png"]);
    expect(made.code, made.stdout + made.stderr).toBe(0);
    const file = json(dir, "work/deep/a.values.json");
    expect(file.template.module).toBe("../../templates/launch.tsx");
    expect(file.values.locale).toBe("en-US");
    expect(file.values.art).toEqual({ src: "../../images/tide.png", width: 64, height: 64 });
  });

  it("a values file's design is checked strict: Text in a family that isn't given fails", async () => {
    const dir = withFixtures(project({ "templates/launch.tsx": launchTemplate().replace('<Text field="launchDate">', '<Text field="launchDate" style={{ fontFamily: "Missing" }}>'), "designs/a.values.json": valuesFile("../templates/launch.tsx", LAUNCH_VALUES) }));
    const ran = await cli(dir, ["check", "designs/a.values.json", "--json"]);
    expect(ran.code).toBe(1);
    expect(lines(ran)[0].diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ severity: "error", code: expect.stringMatching(/^image\//) })]));
    const rendered = await cli(dir, ["render", "designs/a.values.json"]);
    expect(rendered.code).toBe(1);
  });

  it("a module changed under the same version is template/changed, and check doesn't touch the file", async () => {
    const dir = project({ "templates/note.tsx": noteTemplate() });
    expect((await cli(dir, ["design", "new", "templates/note.tsx", "-o", "designs/n.values.json", "--set", "title=Hi", "--set", "body=B"])).code).toBe(0);
    writeFileSync(join(dir, "templates/note.tsx"), `${noteTemplate()}\n// changed\n`);
    const before = readFileSync(join(dir, "designs/n.values.json"));
    const ran = await cli(dir, ["check", "designs/n.values.json", "--json"]);
    expect(ran.code, ran.stdout).toBe(0);
    expect(lines(ran)[0].diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: "template/changed", severity: "warning" })]));
    expect(readFileSync(join(dir, "designs/n.values.json")).equals(before)).toBe(true);
  });

  it("a values file whose module isn't a template is cli/not-a-template-module, while ordinary designs in the run still run", async () => {
    const dir = project({ "emails/plain.tsx": email(), "lib/helper.ts": "export default 3;\n", "designs/x.values.json": valuesFile("../emails/plain.tsx", {}, { id: "acme.Plain", formats: null }) });
    const ran = await cli(dir, ["check", "designs/x.values.json", "emails", "lib", "--json"]);
    expect(ran.code).toBe(1);
    const byFile = Object.fromEntries(lines(ran).filter((line) => line.file).map((line) => [line.file, line]));
    expect(byFile["designs/x.values.json"]).toMatchObject({ status: "error" });
    expect(codes(byFile["designs/x.values.json"])).toEqual(["cli/not-a-template-module"]);
    expect(byFile["emails/plain.tsx"]).toMatchObject({ status: "ok" });
    expect(byFile["lib/helper.ts"]).toMatchObject({ status: "skipped" });
  });

  it("recognizes a template exported as memo(template(…))", async () => {
    const dir = project({ "templates/note.tsx": noteTemplate().replace("export default template({", 'import { memo } from "react";\nexport default memo(template({').replace(/\}\);\n$/, "}));\n") });
    const ran = await cli(dir, ["check", "templates/note.tsx", "--json"]);
    expect(ran.code, ran.stdout + ran.stderr).toBe(0);
    expect(lines(ran)[0]).toMatchObject({ input: "template", template: { id: "acme.Note" } });
  });

  it("describe takes a component's name or a template module", async () => {
    const dir = project({ "templates/note.tsx": noteTemplate() });
    const component = await cli(dir, ["describe", "Button", "--json"]);
    expect(component.code).toBe(0);
    expect(JSON.parse(component.stdout)).toMatchObject({ type: "Button" });
    const template = await cli(dir, ["describe", "templates/note.tsx", "--json"]);
    expect(template.code, template.stderr).toBe(0);
    expect(JSON.parse(template.stdout)).toMatchObject({ id: "acme.Note", root: "Email" });
    const notTemplate = project({ "emails/plain.tsx": email() });
    const plain = await cli(notTemplate, ["describe", "emails/plain.tsx"]);
    expect(plain.code).toBe(2);
    expect(plain.stderr).toContain("cli/not-a-template-module");
  });

  it("an absolute template.module is cli/values-file", async () => {
    const dir = project({ "designs/a.values.json": valuesFile("/templates/note.tsx", { title: "Hi", body: "B" }, { id: "acme.Note", formats: null }) });
    const ran = await cli(dir, ["check", "designs/a.values.json", "--json"]);
    expect(ran.code).toBe(1);
    expect(codes(lines(ran)[0])).toEqual(["cli/values-file"]);
  });

  it("with an Elements from before templates, a template module and a values file are each cli/elements-version (exit 2)", async () => {
    const dir = project({ "templates/note.tsx": noteTemplate(), "designs/n.values.json": valuesFile("../templates/note.tsx", { title: "Hi", body: "B" }, { id: "acme.Note", formats: null }) }, { modules: ["react", "react-dom"] });
    copyElements(dir, { templates: false });
    for (const file of ["templates/note.tsx", "designs/n.values.json"]) {
      const ran = await cli(dir, ["check", file, "--json"]);
      expect(ran.code, file).toBe(2);
      expect(codes(lines(ran)[0]), file).toEqual(["cli/elements-version"]);
      expect(lines(ran)[0].diagnostics[0].message).toContain("0.5.0");
    }
  });

  it("check --offline of a values file with a URL image not in the cache is cli/offline", async () => {
    const dir = withFixtures(project({ "templates/launch.tsx": launchTemplate(), "designs/a.values.json": valuesFile("../templates/launch.tsx", { ...LAUNCH_VALUES, art: { src: "https://images.invalid/art.png", width: 64, height: 64 } }) }));
    const ran = await cli(dir, ["check", "designs/a.values.json", "--offline", "--json"]);
    expect(ran.code).toBe(1);
    expect(codes(lines(ran)[0])).toContain("cli/offline");
  });

  it("design's usage errors exit 2", async () => {
    const dir = project({ "templates/note.tsx": noteTemplate() });
    for (const args of [["design"], ["design", "new", "templates/note.tsx"], ["design", "new", "templates/note.tsx", "-o", "a.json"], ["design", "set", "designs/missing.values.json", "a=1"], ["design", "new", "templates/missing.tsx", "-o", "a.values.json"], ["design", "set", "x.values.json", "-o", "y.values.json", "a=1"]]) {
      const ran = await cli(dir, args);
      expect(ran.code, args.join(" ")).toBe(2);
    }
  });
});
