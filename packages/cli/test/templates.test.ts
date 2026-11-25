/**
 * Templates in the CLI, the loop an agent runs end to end: describe a template, make a design from it (design new),
 * check it (its values, its assets against their files, fit in both formats), render it (one file per format), then
 * change one value later (design set). What's refused leaves the file as it was; a draft isn't rendered.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, decodePng, differingBox, LAUNCH_VALUES, launchTemplate, lines, makePng, pngSize, project, valuesFile, withFixtures } from "./helpers";

/** The errors' codes (a template loaded with no trusted list also has its warning, cli/template-untrusted). */
const codes = (line: { diagnostics: Array<{ code: string; severity: string }> }) => line.diagnostics.filter((d) => d.severity === "error").map((d) => d.code);
const json = (dir: string, file: string) => JSON.parse(readFileSync(join(dir, file), "utf8"));

/** A project with the launch template and the fixtures' fonts and images. */
const launchProject = (files: Record<string, string> = {}) => withFixtures(project({ "templates/launch.tsx": launchTemplate(), ...files }));

describe("the agent loop", () => {
  it("describe, design new, check, render", async () => {
    const dir = launchProject({ "brief.json": JSON.stringify({ headline: "Orbit is here", launchDate: "2026-12-03" }), "source.json": JSON.stringify({ kind: "generated", provider: "test" }) });

    const described = await cli(dir, ["describe", "templates/launch.tsx", "--json"]);
    expect(described.code, described.stderr).toBe(0);
    const description = JSON.parse(described.stdout);
    expect(description).toMatchObject({ id: "acme.Launch", templateVersion: "1.0.0", root: "Canvas", formats: { square: { scale: 2 }, wide: {} } });
    expect(description.fields.map((f: { path: string }) => f.path)).toEqual(["headline", "launchDate", "locale", "art"]);
    expect(description.valuesSchema).toMatchObject({ type: "object" });
    const text = await cli(dir, ["describe", "templates/launch.tsx"]);
    expect(text.stdout).toContain("Launch card (acme.Launch 1.0.0, a Canvas)");
    expect(text.stdout).toContain("art (image, required): Art");

    const made = await cli(dir, ["design", "new", "templates/launch.tsx", "-o", "designs/orbit.values.json", "--values", "brief.json", "--set", "art=@images/tide.png", "--source", "art=source.json", "--json"]);
    expect(made.code, made.stdout + made.stderr).toBe(0);
    expect(JSON.parse(made.stdout)).toMatchObject({ command: "design", file: "designs/orbit.values.json", status: "ok", template: { id: "acme.Launch", version: "1.0.0" }, changed: ["headline", "launchDate", "locale", "art"] });
    const file = json(dir, "designs/orbit.values.json");
    expect(file.template).toMatchObject({ module: "../templates/launch.tsx", id: "acme.Launch", version: "1.0.0" });
    expect(file.template.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(file.formats).toEqual(["square", "wide"]);
    // The size read from the file, its path relative to the values file, a default written out.
    expect(file.values).toEqual({ headline: "Orbit is here", launchDate: "2026-12-03", locale: "en-US", art: { src: "../images/tide.png", width: 64, height: 64 } });
    expect(file.assets.art).toEqual({ sha256: expect.stringMatching(/^[0-9a-f]{64}$/), source: { kind: "generated", provider: "test" } });

    const checked = await cli(dir, ["check", "designs/orbit.values.json", "--json"]);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    const [square, wide] = lines(checked);
    expect(square).toMatchObject({ input: "values", file: "designs/orbit.values.json", templateFormat: "square", root: "Canvas", status: "ok", template: { id: "acme.Launch", version: "1.0.0" } });
    expect(wide).toMatchObject({ templateFormat: "wide", status: "ok" });
    expect(square.regions.art.square).toEqual({ box: [32, 32], pixels: [64, 64] });
    expect(wide.regions.art.wide).toEqual({ box: [32, 32], pixels: [32, 32] });
    expect(square.fits).toEqual([expect.objectContaining({ field: "headline", chosen: 40 })]);
    // What a reviewer checks by eye is listed, and never fails the run.
    expect(square.review).toEqual(expect.arrayContaining([expect.objectContaining({ field: "art" })]));
    expect(codes(square).filter((code) => code.startsWith("web/"))).toEqual([]);

    const rendered = await cli(dir, ["render", "designs/orbit.values.json", "--base", "designs", "--out", "out", "--json"]);
    expect(rendered.code, rendered.stdout + rendered.stderr).toBe(0);
    expect(lines(rendered).slice(0, 2).map((line) => line.outputs)).toEqual([["out/orbit.square.png"], ["out/orbit.wide.png"]]);
    // Each at its format's size and scale.
    expect(pngSize(readFileSync(join(dir, "out/orbit.square.png")))).toEqual({ width: 600, height: 600 });
    expect(pngSize(readFileSync(join(dir, "out/orbit.wide.png")))).toEqual({ width: 400, height: 200 });
  });

  it("a set the template refuses exits 1 and leaves the file's bytes as they were", async () => {
    const dir = launchProject({ "designs/orbit.values.json": valuesFile("../templates/launch.tsx", LAUNCH_VALUES) });
    const before = readFileSync(join(dir, "designs/orbit.values.json"));
    for (const set of ["headline=" + "x".repeat(61), "art=@fonts/OFL-Inter.txt", "nope=1", "launchDate=yesterday"]) {
      const ran = await cli(dir, ["design", "set", "designs/orbit.values.json", set, "--json"]);
      expect(ran.code, `${set}: ${ran.stdout}${ran.stderr}`).toBe(1);
      expect(JSON.parse(ran.stdout)).toMatchObject({ status: "error", changed: [] });
      expect(readFileSync(join(dir, "designs/orbit.values.json")).equals(before)).toBe(true);
    }
  });

  it("a set of the date changes that value alone, and the image only inside the date's box", async () => {
    const dir = launchProject();
    expect((await cli(dir, ["design", "new", "templates/launch.tsx", "-o", "designs/orbit.values.json", "--set", "headline=Orbit is here", "--set", "launchDate=2026-12-03", "--set", "art=@images/tide.png"])).code).toBe(0);
    const before = json(dir, "designs/orbit.values.json");
    expect((await cli(dir, ["render", "designs/orbit.values.json", "--out", "before"])).code).toBe(0);

    const set = await cli(dir, ["design", "set", "designs/orbit.values.json", "launchDate=2026-12-10"]);
    expect(set.code, set.stdout + set.stderr).toBe(0);
    expect(set.stdout).toContain("changed launchDate");
    const after = json(dir, "designs/orbit.values.json");
    expect(after.values).toEqual({ ...before.values, launchDate: "2026-12-10" });
    expect(after.assets).toEqual(before.assets);
    expect(after.template).toEqual(before.template);

    expect((await cli(dir, ["render", "designs/orbit.values.json", "--out", "after"])).code).toBe(0);
    for (const [format, scale] of [["square", 2], ["wide", 1]] as const) {
      const box = differingBox(decodePng(readFileSync(join(dir, `before/designs/orbit.${format}.png`))), decodePng(readFileSync(join(dir, `after/designs/orbit.${format}.png`))));
      // The date's line starts at 164px: padding 16, the 100px headline band, the 32px image and two gaps of 8.
      expect(box, format).not.toBeNull();
      expect(box![1], format).toBeGreaterThanOrEqual(164 * scale - 1);
    }
  });

  it("a draft is written with what's missing, isn't rendered, and a set that completes it clears both", async () => {
    const dir = launchProject();
    const strict = await cli(dir, ["design", "new", "templates/launch.tsx", "-o", "designs/draft.values.json", "--set", "headline=Orbit"]);
    expect(strict.code).toBe(1);
    expect(strict.stderr).toContain("template/required");

    const draft = await cli(dir, ["design", "new", "templates/launch.tsx", "-o", "designs/draft.values.json", "--set", "headline=Orbit", "--draft", "--json"]);
    expect(draft.code, draft.stdout + draft.stderr).toBe(0);
    expect(JSON.parse(draft.stdout)).toMatchObject({ status: "draft", missing: ["launchDate", "art"] });
    expect(json(dir, "designs/draft.values.json")).toMatchObject({ draft: true, missing: ["launchDate", "art"], values: { headline: "Orbit" } });

    const rendered = await cli(dir, ["render", "designs/draft.values.json", "--json"]);
    expect(rendered.code).toBe(1);
    expect(lines(rendered).slice(0, 2).map(codes)).toEqual([["cli/draft"], ["cli/draft"]]);
    const checked = await cli(dir, ["check", "designs/draft.values.json", "--json"]);
    expect(checked.code).toBe(1);
    expect(codes(lines(checked)[0])).toContain("template/required");

    const filled = await cli(dir, ["design", "set", "designs/draft.values.json", "launchDate=2026-12-03", "art=@images/tide.png"]);
    expect(filled.code, filled.stdout + filled.stderr).toBe(0);
    const file = json(dir, "designs/draft.values.json");
    expect(file.draft).toBeUndefined();
    expect(file.missing).toBeUndefined();
    expect((await cli(dir, ["render", "designs/draft.values.json"])).code).toBe(0);
  });

  it("a values file in another folder reads its images relative to itself, and --offline needs nothing fetched", async () => {
    const dir = launchProject({ "work/deep/a.values.json": valuesFile("../../templates/launch.tsx", { ...LAUNCH_VALUES, art: { src: "../../images/tide.png", width: 64, height: 64 } }) });
    const ran = await cli(dir, ["render", "work/deep/a.values.json", "--offline", "--json"]);
    expect(ran.code, ran.stdout + ran.stderr).toBe(0);
    expect(lines(ran).slice(0, 2).map((line) => line.outputs)).toEqual([["out/work/deep/a.square.png"], ["out/work/deep/a.wide.png"]]);
    expect((await cli(dir, ["check", "work/deep/a.values.json", "--offline"])).code).toBe(0);
  });

  it("a template older than the one a values file records is template/version", async () => {
    const dir = launchProject({ "designs/new.values.json": valuesFile("../templates/launch.tsx", LAUNCH_VALUES, { version: "1.2.0" }) });
    const ran = await cli(dir, ["check", "designs/new.values.json", "--json"]);
    expect(ran.code).toBe(1);
    expect(lines(ran).slice(0, 2).map(codes)).toEqual([["template/version"], ["template/version"]]);
  });

  it("a template module is checked with its example in each format; its diagnostics say which", async () => {
    const dir = launchProject();
    const ran = await cli(dir, ["check", "templates/launch.tsx", "--json"]);
    expect(ran.code, ran.stdout + ran.stderr).toBe(0);
    const [line] = lines(ran);
    expect(line).toMatchObject({ input: "template", status: "ok", template: { id: "acme.Launch" } });
    expect(Object.keys(line.regions.art)).toEqual(["square", "wide"]);
    expect(line.fits.map((fit: { templateFormat: string }) => fit.templateFormat)).toEqual(["square", "wide"]);

    // A 40×40 example image: enough for the wide format's 32px at 1×, not the square's at 2×.
    writeFileSync(join(dir, "images/small.png"), makePng(40, 40));
    writeFileSync(join(dir, "templates/launch.tsx"), launchTemplate().replace('src: "../images/tide.png", width: 64, height: 64 } }', 'src: "../images/small.png", width: 40, height: 40 } }'));
    const small = await cli(dir, ["check", "templates/launch.tsx", "--json"]);
    expect(small.code).toBe(1);
    expect(lines(small)[0].diagnostics.filter((d: { severity: string }) => d.severity === "error")).toEqual([expect.objectContaining({ code: "template/asset-pixels", templateFormat: "square", field: "art" })]);
    const text = await cli(dir, ["check", "templates/launch.tsx"]);
    expect(text.stdout).toContain("[square] error template/asset-pixels");
    expect(text.stdout).toContain("art (square): 32×32, needs 64×64px");
  });
});
