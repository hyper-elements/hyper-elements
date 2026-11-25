/**
 * A template's formats in the CLI (Decision 20): each format of a values file is an input of its own, with a file
 * named `<stem>.<format>.<ext>`; --template-format narrows them and --format keeps its meaning (png or svg); a values
 * file that's wrong fails as itself, never by checking nothing.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canvas, cli, copyElements, LAUNCH_VALUES, launchTemplate, lines, makePng, project, valuesFile, withFixtures } from "./helpers";

/** The errors' codes (a template loaded with no trusted list also has its warning, cli/template-untrusted). */
const codes = (line: { diagnostics: Array<{ code: string; severity: string }> }) => line.diagnostics.filter((d) => d.severity === "error").map((d) => d.code);
const FONTS = `[{ family: "Inter", src: "../fonts/Inter-Regular.ttf", weight: 400 }]`;
const launchProject = (files: Record<string, string> = {}) => withFixtures(project({ "templates/launch.tsx": launchTemplate(), "designs/a.values.json": valuesFile("../templates/launch.tsx", LAUNCH_VALUES), ...files }));

describe("formats", () => {
  it("two formats are two lines and two files, <stem>.<format>.png", async () => {
    const dir = launchProject();
    const ran = await cli(dir, ["render", "designs", "--json"]);
    expect(ran.code, ran.stdout + ran.stderr).toBe(0);
    const [square, wide, summary] = lines(ran);
    expect(square).toMatchObject({ file: "designs/a.values.json", templateFormat: "square", outputs: ["out/designs/a.square.png"] });
    expect(wide).toMatchObject({ file: "designs/a.values.json", templateFormat: "wide", outputs: ["out/designs/a.wide.png"] });
    expect(summary.summary.templates).toBe(2);
  });

  it("--template-format narrows them, and --format svg is every input's image format, values files and designs mixed", async () => {
    const dir = launchProject({ "cards/card.tsx": canvas(FONTS) });
    const narrowed = await cli(dir, ["render", "designs/a.values.json", "--template-format", "square", "--format", "svg", "--json"]);
    expect(narrowed.code, narrowed.stdout + narrowed.stderr).toBe(0);
    expect(lines(narrowed)[0]).toMatchObject({ templateFormat: "square", outputs: ["out/designs/a.square.svg"] });
    expect(readdirSync(join(dir, "out/designs"))).toEqual(["a.square.svg"]);

    const mixed = await cli(dir, ["render", "designs", "cards", "--format", "svg", "--out", "mixed", "--json"]);
    expect(mixed.code, mixed.stdout + mixed.stderr).toBe(0);
    expect(lines(mixed).slice(0, 3).flatMap((line) => line.outputs).sort()).toEqual(["mixed/cards/card.svg", "mixed/designs/a.square.svg", "mixed/designs/a.wide.svg"]);

    const unlisted = await cli(dir, ["render", "designs/a.values.json", "--template-format", "tall", "--json"]);
    expect(unlisted.code).toBe(1);
    expect(codes(lines(unlisted)[0])).toEqual(["cli/template-format"]);
  });

  it("one format that fails leaves the other written, and the run exits 1", async () => {
    const dir = launchProject({ "designs/a.values.json": valuesFile("../templates/launch.tsx", { ...LAUNCH_VALUES, art: { src: "../images/small.png", width: 40, height: 40 } }) });
    writeFileSync(join(dir, "images/small.png"), makePng(40, 40));
    const ran = await cli(dir, ["render", "designs", "--json"]);
    expect(ran.code).toBe(1);
    const [square, wide] = lines(ran);
    expect(square).toMatchObject({ templateFormat: "square", status: "error", outputs: [] });
    expect(codes(square)).toEqual(["template/asset-pixels"]);
    expect(wide).toMatchObject({ templateFormat: "wide", status: "ok", outputs: ["out/designs/a.wide.png"] });
    expect(existsSync(join(dir, "out/designs/a.square.png"))).toBe(false);
  });

  it("a values file that's wrong fails as itself (exit 1): no formats for a template with some, not JSON, no template", async () => {
    const dir = launchProject({
      "designs/a.values.json": valuesFile("../templates/launch.tsx", LAUNCH_VALUES, { formats: null }),
      "designs/b.values.json": "{ not json",
      "designs/c.values.json": JSON.stringify({ version: 1, values: {} }),
      "designs/d.values.json": valuesFile("/abs/launch.tsx", LAUNCH_VALUES),
    });
    const ran = await cli(dir, ["check", "designs", "--json"]);
    expect(ran.code).toBe(1);
    const found = lines(ran).slice(0, 4);
    expect(found.map((line) => [line.file, line.status, codes(line)[0]])).toEqual([
      ["designs/a.values.json", "error", "template/format"],
      ["designs/b.values.json", "error", "cli/values-file"],
      ["designs/c.values.json", "error", "cli/values-file"],
      ["designs/d.values.json", "error", "cli/values-file"],
    ]);
  });

  it("outline and --stdout take one input: a values file of two formats needs --template-format (exit 2)", async () => {
    const dir = launchProject();
    const outline = await cli(dir, ["outline", "designs/a.values.json"]);
    expect(outline.code).toBe(2);
    expect(outline.stderr).toContain("--template-format");
    const one = await cli(dir, ["outline", "designs/a.values.json", "--template-format", "wide"]);
    expect(one.code, one.stderr).toBe(0);
    expect(one.stdout).toContain("Canvas 400px");
    const stdout = await cli(dir, ["render", "designs/a.values.json", "--stdout"]);
    expect(stdout.code).toBe(2);
    expect(stdout.stderr).toContain("--template-format");
    const module = await cli(dir, ["outline", "templates/launch.tsx"]);
    expect(module.code).toBe(2);
    expect(module.stdout + module.stderr).toContain("cli/template-format");
  });

  it("--scale 4 makes check fail an image that passes at the format's scale", async () => {
    const dir = launchProject();
    expect((await cli(dir, ["check", "designs/a.values.json"])).code).toBe(0);
    const scaled = await cli(dir, ["check", "designs/a.values.json", "--scale", "4", "--json"]);
    expect(scaled.code).toBe(1);
    const [square] = lines(scaled);
    expect(codes(square)).toEqual(["template/asset-pixels"]);
    expect(square.regions.art.square).toEqual({ box: [32, 32], pixels: [128, 128] });
  });

  it("names that collide are refused before anything is written", async () => {
    const dir = launchProject({ "designs/a.square.tsx": canvas(FONTS) });
    const ran = await cli(dir, ["render", "designs"]);
    expect(ran.code).toBe(2);
    expect(ran.stderr).toContain("designs/a.square.tsx and designs/a.values.json would both write out/designs/a.square.");
    expect(existsSync(join(dir, "out"))).toBe(false);
  });

  it("render of a template module is cli/render-template (exit 2)", async () => {
    const dir = launchProject();
    const ran = await cli(dir, ["render", "templates/launch.tsx", "--json"]);
    expect(ran.code).toBe(2);
    expect(lines(ran)[0]).toMatchObject({ input: "template", status: "error", outputs: [], template: { id: "acme.Launch" } });
    expect(codes(lines(ran)[0])).toEqual(["cli/render-template"]);
    expect(existsSync(join(dir, "out"))).toBe(false);
  });

  it("check of a Canvas values file without the image engines is cli/engine-missing (exit 2)", async () => {
    const dir = withFixtures(project({ "templates/launch.tsx": launchTemplate(), "designs/a.values.json": valuesFile("../templates/launch.tsx", LAUNCH_VALUES) }, { modules: ["react", "react-dom"] }));
    copyElements(dir);
    const ran = await cli(dir, ["check", "designs/a.values.json", "--json"]);
    expect(ran.code).toBe(2);
    expect(codes(lines(ran)[0])).toEqual(["cli/engine-missing"]);
    expect(lines(ran)[0].diagnostics[0].fix).toContain("satori");
  });

  it("reads a values file's JSON once, as the parent checked it", async () => {
    const dir = launchProject();
    const before = readFileSync(join(dir, "designs/a.values.json"));
    expect((await cli(dir, ["check", "designs"])).code).toBe(0);
    expect(readFileSync(join(dir, "designs/a.values.json")).equals(before)).toBe(true);
  });
});
