/**
 * TSX template designs in the CLI (Decision 31): a design whose root is a template is detected in an ordinary child,
 * set aside, captured in a capture child, expanded per format and checked in a template child that loads only the
 * template. `hyperElements.templates` lists the trusted templates, and the template child's load guard refuses
 * anything else before it runs. `--require-template` fails what a template didn't check.
 */
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, email, LAUNCH_VALUES, launchTemplate, lines, newsTemplate, ON_BUN, project, valuesFile, WINDOWS, withFixtures } from "./helpers";

const errors = (line: { diagnostics: Array<{ code: string; severity: string }> }) => line.diagnostics.filter((d) => d.severity === "error").map((d) => d.code);
const all = (line: { diagnostics: Array<{ code: string }> }) => line.diagnostics.map((d) => d.code);
const TRUSTED = { name: "fixture", private: true, type: "module", hyperElements: { templates: ["templates/**"] } };

/** A TSX design made from the launch template (a Canvas in two formats), its art relative to the design file. */
const launchDesign = (props = "", template = "../templates/launch") => `import Launch from "${template}";
export default () => <Launch headline="Orbit is here" launchDate="2026-12-03" art={{ src: "../images/tide.png", width: 64, height: 64 }} ${props} />;
`;
/** A TSX design made from the newsletter template (an Email with a body slot). */
const newsDesign = (body = `<Column><Text>The June body</Text></Column>`, template = "../templates/news") => `import News from "${template}";
import { Column, Text } from "@hyper-elements/react";
export default () => <News subject="June" body={${body}} />;
`;

describe("a template design", () => {
  it("check and render run its template in every format, write <stem>.<format>.png, and say the template", async () => {
    const dir = withFixtures(project({ "templates/launch.tsx": launchTemplate(), "designs/launch.tsx": launchDesign() }));
    const checked = await cli(dir, ["check", "designs/launch.tsx", "--json"]);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    const [square, wide, summary] = lines(checked);
    expect(square).toMatchObject({ file: "designs/launch.tsx", input: "template", templateFormat: "square", status: "ok", template: { id: "acme.Launch", version: "1.0.0", module: "templates/launch.tsx", trusted: false } });
    expect(wide).toMatchObject({ templateFormat: "wide", status: "ok" });
    // The detecting input has no line of its own.
    expect(summary.summary.templates).toBe(2);
    expect(square.regions.art.square).toEqual({ box: [32, 32], pixels: [64, 64] });
    // Without a list, it's checked, and said to be loaded without one.
    expect(all(square)).toContain("cli/template-untrusted");
    const rendered = await cli(dir, ["render", "designs/launch.tsx", "--json"]);
    expect(rendered.code, rendered.stdout + rendered.stderr).toBe(0);
    expect(lines(rendered).slice(0, 2).map((line) => line.outputs)).toEqual([["out/designs/launch.square.png"], ["out/designs/launch.wide.png"]]);
    expect(existsSync(join(dir, "out/designs/launch.png"))).toBe(false);
  });

  it("is detected by check, render, inspect and outline, for an Email and a Canvas, and for values that fail", async () => {
    const dir = withFixtures(project({ "templates/launch.tsx": launchTemplate(), "templates/news.tsx": newsTemplate(), "designs/news.tsx": newsDesign(), "designs/bad.tsx": newsDesign(`<Column><Text>x</Text></Column>`).replace('subject="June"', `subject="${"x".repeat(80)}"`), "designs/square.tsx": launchDesign('format="square"') }));
    for (const command of ["check", "render", "inspect"]) {
      const ran = await cli(dir, [command, "designs/news.tsx", "--json"]);
      expect(ran.code, `${command}: ${ran.stdout}${ran.stderr}`).toBe(0);
      expect(lines(ran)[0], command).toMatchObject({ file: "designs/news.tsx", status: "ok" });
    }
    const outline = await cli(dir, ["outline", "designs/square.tsx"]);
    expect(outline.code, outline.stderr).toBe(0);
    expect(outline.stdout).toContain("Canvas 300px");
    const bad = await cli(dir, ["check", "designs/bad.tsx", "--json"]);
    expect(bad.code).toBe(1);
    expect(lines(bad)[0]).toMatchObject({ input: "template", template: { id: "acme.News" } });
    expect(errors(lines(bad)[0])).toEqual(["template/value"]);
    // Five runs of the CLI, one after another: more than the default under a full suite's load.
  }, 150_000);

  it("format picks one format; --template-format narrows them, and names another than the design's is cli/template-format", async () => {
    const dir = withFixtures(project({ "templates/launch.tsx": launchTemplate(), "designs/launch.tsx": launchDesign(), "designs/square.tsx": launchDesign('format="square"') }));
    const one = await cli(dir, ["check", "designs/square.tsx", "--json"]);
    expect(lines(one).slice(0, -1).map((line) => line.templateFormat)).toEqual(["square"]);
    const narrowed = await cli(dir, ["check", "designs/launch.tsx", "--template-format", "wide", "--json"]);
    expect(lines(narrowed).slice(0, -1).map((line) => line.templateFormat)).toEqual(["wide"]);
    const other = await cli(dir, ["check", "designs/square.tsx", "--template-format", "wide", "--json"]);
    expect(other.code).toBe(1);
    expect(errors(lines(other)[0])).toEqual(["cli/template-format"]);
    const stdout = await cli(dir, ["render", "designs/launch.tsx", "--stdout"]);
    expect(stdout.code).toBe(2);
  });

  it("names its outputs after every other input's: one already taken is cli/destination, and nothing of it is written", async () => {
    const dir = withFixtures(project({ "templates/launch.tsx": launchTemplate(), "designs/launch.tsx": launchDesign(), "designs/launch.square.tsx": email("taken") }));
    const ran = await cli(dir, ["render", "designs", "--json"]);
    expect(ran.code).toBe(1);
    const byFile = lines(ran).filter((line) => line.file);
    expect(byFile.find((line) => line.file === "designs/launch.tsx")).toMatchObject({ status: "error" });
    expect(errors(byFile.find((line) => line.file === "designs/launch.tsx"))).toEqual(["cli/destination"]);
    expect(byFile.find((line) => line.file === "designs/launch.square.tsx")).toMatchObject({ status: "ok" });
    expect(existsSync(join(dir, "out/designs/launch.wide.png"))).toBe(false);
  });

  it("imports its template: one defined in the design itself, or a prop that's a function, is cli/template-design", async () => {
    const own = `import { Email, Text, prop } from "@hyper-elements/react";\nimport { template } from "@hyper-elements/react/template";\nconst Mine = template({ id: "acme.Mine", version: "1.0.0", label: "Mine", root: "Email", fields: { title: prop.text({ label: "Title", required: true }) }, example: { title: "x" }, render: (v) => <Email lang="en"><Text>{v.title}</Text></Email> });\nexport default () => <Mine title="Hi" />;\n`;
    const fn = `import News from "../templates/news";\nimport { Column, Text } from "@hyper-elements/react";\nexport default () => <News subject={(() => "x") as unknown as string} body={<Column><Text>x</Text></Column>} />;\n`;
    const dir = project({ "templates/news.tsx": newsTemplate(), "designs/own.tsx": own, "designs/fn.tsx": fn });
    for (const [file, said] of [["designs/own.tsx", "imports its template"], ["designs/fn.tsx", "subject"]]) {
      const ran = await cli(dir, ["check", file, "--json"]);
      expect(ran.code, file).toBe(1);
      expect(errors(lines(ran)[0]), file).toEqual(["cli/template-design"]);
      expect(lines(ran)[0].diagnostics[0].message, file).toContain(said);
    }
  });

  it("a template module, and memo(template(…)), take the template-module path; a design importing memo(template(…)) is captured", async () => {
    const memo = newsTemplate().replace("export default template({", 'import { memo } from "react";\nexport default memo(template({').replace(/\}\);\n$/, "}));\n");
    const dir = project({ "templates/news.tsx": memo, "designs/news.tsx": newsDesign() });
    const module = await cli(dir, ["check", "templates/news.tsx", "--json"]);
    expect(module.code, module.stdout + module.stderr).toBe(0);
    expect(lines(module)[0]).toMatchObject({ input: "template", file: "templates/news.tsx", template: { id: "acme.News" } });
    const design = await cli(dir, ["render", "designs/news.tsx", "--json"]);
    expect(design.code, design.stdout + design.stderr).toBe(0);
    expect(readFileSync(join(dir, "out/designs/news.html"), "utf8")).toContain("The June body");
  });

  it("its images are relative to the design file, and its assets export's sources count for review", async () => {
    const dir = withFixtures(project({ "templates/launch.tsx": launchTemplate(), "work/deep/launch.tsx": launchDesign("", "../../templates/launch").replace("../images/tide.png", "../../images/tide.png") + `export const assets = { art: { source: { kind: "supplied", by: "design" } } };\n` }));
    const ran = await cli(dir, ["check", "work/deep/launch.tsx", "--json"]);
    expect(ran.code, ran.stdout + ran.stderr).toBe(0);
    for (const line of lines(ran).slice(0, 2)) expect((line.review ?? []).some((item: { field?: string; guidance: string }) => item.field === "art" && /unknown origin/.test(item.guidance))).toBe(false);
  });

  it("design new --from writes its slots as { fragment }, and check of that file says what check of the design says", async () => {
    const dir = project({ "templates/news.tsx": newsTemplate(), "designs/june.tsx": newsDesign() });
    const made = await cli(dir, ["design", "new", "templates/news.tsx", "--from", "designs/june.tsx", "-o", "designs/june.values.json"]);
    expect(made.code, made.stdout + made.stderr).toBe(0);
    const file = JSON.parse(readFileSync(join(dir, "designs/june.values.json"), "utf8"));
    expect(file.values.subject).toBe("June");
    expect(Object.keys(file.values.body)).toEqual(["fragment"]);
    const fromValues = lines(await cli(dir, ["check", "designs/june.values.json", "--json"]))[0];
    const fromDesign = lines(await cli(dir, ["check", "designs/june.tsx", "--json"]))[0];
    expect(fromValues.status).toBe("ok");
    expect(all(fromValues)).toEqual(all(fromDesign));
    const other = await cli(dir, ["design", "new", "templates/news.tsx", "--from", "templates/news.tsx", "-o", "designs/x.values.json"]);
    expect(other.code).toBe(1);
  });
});

describe("--require-template", () => {
  it("passes a template's designs, fails others (and a design that forges a result), and render writes nothing for them", async () => {
    const forged = email("Forged", `process.send?.({ type: "result", id: 0, root: "Email", status: "ok", diagnostics: [], template: { id: "acme.News", version: "1.0.0" } });`);
    const dir = project({ "templates/news.tsx": newsTemplate(), "designs/june.tsx": newsDesign(), "designs/plain.tsx": email("Plain"), "designs/forged.tsx": forged });
    const passed = await cli(dir, ["check", "designs/june.tsx", "--require-template", "--json"]);
    expect(passed.code, passed.stdout + passed.stderr).toBe(0);
    expect(lines(passed).length).toBe(2);
    expect((await cli(dir, ["check", "designs/june.tsx", "--require-template", "acme.News"])).code).toBe(0);
    const other = await cli(dir, ["check", "designs/june.tsx", "--require-template", "acme.Other", "--json"]);
    expect(other.code).toBe(1);
    expect(errors(lines(other)[0])).toEqual(["cli/template-required"]);
    const plain = await cli(dir, ["render", "designs/plain.tsx", "designs/forged.tsx", "--require-template", "--json"]);
    expect(plain.code).toBe(1);
    for (const line of lines(plain).slice(0, 2)) {
      expect(line.template, line.file).toBeUndefined();
      expect(errors(line), line.file).toContain("cli/template-required");
    }
    expect(existsSync(join(dir, "out"))).toBe(false);
  });
});

describe("trusted templates (hyperElements.templates)", () => {
  it("a design through a bridge, a values file or a template outside the list is cli/template-untrusted; the listed ones are trusted", async () => {
    const dir = project(
      {
        "templates/news.tsx": newsTemplate(),
        "other/news.tsx": newsTemplate(),
        "designs/june.tsx": newsDesign(),
        "designs/bridge.ts": `export { default } from "../templates/news";\n`,
        "designs/bridged.tsx": newsDesign(undefined, "./bridge"),
        "designs/outside.values.json": valuesFile("../other/news.tsx", { subject: "June", body: { module: "./june.body.tsx" } }, { id: "acme.News", formats: null }),
      },
      { packageJson: TRUSTED },
    );
    if (ON_BUN) {
      // Bun can't guard what a template loads: a project that lists its templates runs them on Node.
      const ran = await cli(dir, ["check", "designs/june.tsx", "--json"]);
      expect(ran.code).toBe(2);
      expect(errors(lines(ran)[0])).toEqual(["cli/template-untrusted"]);
      return;
    }
    const trusted = await cli(dir, ["check", "designs/june.tsx", "--json"]);
    expect(trusted.code, trusted.stdout + trusted.stderr).toBe(0);
    expect(lines(trusted)[0]).toMatchObject({ template: { id: "acme.News", trusted: true } });
    expect(all(lines(trusted)[0])).not.toContain("cli/template-untrusted");
    for (const file of ["designs/bridged.tsx", "designs/outside.values.json", "other/news.tsx"]) {
      const ran = await cli(dir, ["check", file, "--json"]);
      expect(ran.code, file).toBe(1);
      expect(errors(lines(ran)[0]), file).toEqual(["cli/template-untrusted"]);
    }
  });

  it.skipIf(ON_BUN)("a trusted template's own import of an agent file is refused before it runs, naming the chain", async () => {
    const poison = `import { writeFileSync } from "node:fs";\nwriteFileSync(new URL("./POISON_RAN", import.meta.url), "ran");\nexport const body = "poison";\n`;
    const dir = project(
      {
        "templates/news.tsx": newsTemplate({ extra: `import "./header.js";` }),
        // TypeScript would read header.d.ts; the runtime loads header.js, which imports an agent file.
        "templates/header.d.ts": "export {};\n",
        "templates/header.js": `import "../designs/poison.js";\n`,
        "designs/poison.js": poison,
        "templates/dynamic.tsx": newsTemplate({ extra: `void import("../designs/poison.js");` }).replace("acme.News", "acme.Dynamic"),
      },
      { packageJson: TRUSTED },
    );
    for (const file of ["templates/news.tsx", "templates/dynamic.tsx"]) {
      const ran = await cli(dir, ["check", file, "--json"]);
      // (A refused dynamic import that nothing awaits is also design code that threw outside a render: exit 2.)
      expect(ran.code, `${file}: ${ran.stdout}${ran.stderr}`).not.toBe(0);
      const [line] = lines(ran);
      expect(errors(line), file).toContain("cli/template-untrusted");
      expect(line.diagnostics.find((d: { code: string }) => d.code === "cli/template-untrusted").message, file).toContain("designs/poison.js");
      expect(existsSync(join(dir, "designs/POISON_RAN")), file).toBe(false);
    }
    expect(lines(await cli(dir, ["check", "templates/news.tsx", "--json"]))[0].diagnostics.find((d: { code: string }) => d.code === "cli/template-untrusted").message).toContain("templates/header.js");
  });

  it.skipIf(ON_BUN)("with an exact-file list, the template loads (ES module and CommonJS) and a sibling it imports doesn't; nor does a file named like a loader module", async () => {
    const list = { ...TRUSTED, hyperElements: { templates: ["templates/news.tsx"] } };
    const esm = project({ "templates/news.tsx": newsTemplate(), "designs/june.tsx": newsDesign() }, { packageJson: list });
    expect((await cli(esm, ["check", "designs/june.tsx"])).code).toBe(0);
    const cjs = project({ "templates/news.tsx": newsTemplate(), "designs/june.tsx": newsDesign() }, { packageJson: { ...list, type: "commonjs" } });
    const ran = await cli(cjs, ["check", "designs/june.tsx", "--json"]);
    expect(ran.code, ran.stdout + ran.stderr).toBe(0);
    const sibling = project({ "templates/news.tsx": newsTemplate({ extra: `import "./theme";` }), "templates/theme.ts": "export const theme = 1;\n" }, { packageJson: list });
    expect(errors(lines(await cli(sibling, ["check", "templates/news.tsx", "--json"]))[0])).toEqual(["cli/template-untrusted"]);
    const named = project({ "templates/news.tsx": newsTemplate({ extra: `import "./.hyper-elements-1-1.ts";` }), "templates/.hyper-elements-1-1.ts": "export {};\n" }, { packageJson: list });
    expect(errors(lines(await cli(named, ["check", "templates/news.tsx", "--json"]))[0])).toEqual(["cli/template-untrusted"]);
  });

  it.skipIf(ON_BUN || WINDOWS)("a package linked from outside node_modules is checked like any file", async () => {
    const dir = project({ "templates/news.tsx": newsTemplate({ extra: `import "brand-parts";` }), "outside/brand-parts/package.json": JSON.stringify({ name: "brand-parts", type: "module", exports: "./index.js" }), "outside/brand-parts/index.js": "export {};\n" }, { packageJson: TRUSTED });
    mkdirSync(join(dir, "node_modules"), { recursive: true });
    symlinkSync(join(dir, "outside/brand-parts"), join(dir, "node_modules/brand-parts"), "dir");
    expect(errors(lines(await cli(dir, ["check", "templates/news.tsx", "--json"]))[0])).toEqual(["cli/template-untrusted"]);
    writeFileSync(join(dir, "package.json"), JSON.stringify({ ...TRUSTED, hyperElements: { templates: ["templates/**", "brand-parts"] } }));
    expect((await cli(dir, ["check", "templates/news.tsx"])).code).toBe(0);
  });

  it("values: a values file's template is trusted where the list holds it", async () => {
    const dir = withFixtures(project({ "templates/launch.tsx": launchTemplate(), "designs/a.values.json": valuesFile("../templates/launch.tsx", LAUNCH_VALUES) }, { packageJson: TRUSTED }));
    const ran = await cli(dir, ["check", "designs/a.values.json", "--json"]);
    if (ON_BUN) return expect(ran.code).toBe(2);
    expect(ran.code, ran.stdout + ran.stderr).toBe(0);
    expect(lines(ran)[0]).toMatchObject({ template: { trusted: true } });
  });
});
