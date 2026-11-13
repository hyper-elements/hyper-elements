/**
 * A Document's PDF and a Canvas's PNG or SVG: what `render` writes for them, the engines they need from the project,
 * an Elements from before templateAssets() (its HTML, as before), Bun (a Document's PDF isn't Node's byte for byte
 * there: exit 2), and the gallery's and stress set's Canvases whose fonts are WOFF2 only.
 */
import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { answer, canvas, cli, copyElements, documentTemplate, ENGINES, fixture, lines, ON_BUN, pngSize, project, REPO, serve, withFixtures, type Server } from "./helpers";

const FONTS = `[{ family: "Inter", src: "../fonts/Inter-Regular.ttf", weight: 400 }, { family: "Inter", src: "../fonts/Inter-Bold.ttf", weight: 700 }]`;
const codes = (line: { diagnostics: Array<{ code: string }> }) => line.diagnostics.map((d) => d.code);

let servers: Server[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) await server.close();
});

describe("a Document", () => {
  it.skipIf(ON_BUN)("writes its PDF; with --html, its print HTML too", async () => {
    const dir = withFixtures(project({ "docs/invoice.tsx": documentTemplate(FONTS, `<Text>Invoice</Text><Text style={{ fontWeight: 700 }}>Total</Text>`) }));
    const ran = await cli(dir, ["render", "docs", "--json"]);
    expect(ran.code, ran.stdout + ran.stderr).toBe(0);
    expect(lines(ran)[0]).toMatchObject({ root: "Document", status: "ok", outputs: ["out/docs/invoice.pdf"], diagnostics: [] });
    expect(readFileSync(join(dir, "out/docs/invoice.pdf")).subarray(0, 5).toString()).toBe("%PDF-");
    expect(existsSync(join(dir, "out/docs/invoice.html"))).toBe(false);

    const html = await cli(dir, ["render", "docs", "--json", "--html", "--out", "out2"]);
    expect(html.code, html.stdout + html.stderr).toBe(0);
    expect(lines(html)[0]).toMatchObject({ outputs: ["out2/docs/invoice.pdf", "out2/docs/invoice.html"], diagnostics: [] });
    expect(readFileSync(join(dir, "out2/docs/invoice.html"), "utf8")).toContain("Invoice");
    // The same PDF each time.
    expect(readFileSync(join(dir, "out2/docs/invoice.pdf")).equals(readFileSync(join(dir, "out/docs/invoice.pdf")))).toBe(true);
  });

  // react-pdf's text engine imports a package that names an `import` condition alone. A template compiled to
  // CommonJS is loaded through tsx's register, which compiled the dependency too and turned that import into a
  // `require`: every Document failed with ERR_PACKAGE_PATH_NOT_EXPORTED, in any project whose
  // package.json has no "type": "module" (what `npm init` writes). The dependency is left to Node, where Node can
  // `require` an ES module (20.19 and 22.12 on): before those it's tsx's as it was, and the PDF isn't written.
  it.skipIf(ON_BUN || !process.features.require_module)("writes its PDF in a CommonJS project, whose engine loads an ES module of its own", async () => {
    const dir = withFixtures(project({ "docs/invoice.tsx": documentTemplate(FONTS) }, { packageJson: { name: "fixture", private: true } }));
    const ran = await cli(dir, ["render", "docs", "--json"]);
    expect(ran.code, ran.stdout + ran.stderr).toBe(0);
    expect(lines(ran)[0]).toMatchObject({ root: "Document", status: "ok", outputs: ["out/docs/invoice.pdf"], diagnostics: [] });
    expect(readFileSync(join(dir, "out/docs/invoice.pdf")).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it.runIf(ON_BUN)("isn't written on Bun: exit 2, saying to use Node", async () => {
    const dir = withFixtures(project({ "docs/invoice.tsx": documentTemplate(FONTS) }));
    const ran = await cli(dir, ["render", "docs", "--json"]);
    expect(ran.code).toBe(2);
    expect(lines(ran)[0]).toMatchObject({ root: "Document", status: "error", outputs: [], diagnostics: [{ code: "cli/bun", severity: "error" }] });
    expect(lines(ran)[0].diagnostics[0].fix).toContain("Node");
    expect(existsSync(join(dir, "out"))).toBe(false);
  });
});

describe("a Canvas", () => {
  it("writes its PNG, at --scale, or its SVG with --format svg", async () => {
    const dir = withFixtures(project({ "cards/card.tsx": canvas(FONTS) }));
    const png = await cli(dir, ["render", "cards", "--json"]);
    expect(png.code, png.stdout + png.stderr).toBe(0);
    expect(lines(png)[0]).toMatchObject({ root: "Canvas", status: "ok", outputs: ["out/cards/card.png"], diagnostics: [] });
    expect(pngSize(readFileSync(join(dir, "out/cards/card.png")))).toEqual({ width: 300, height: 150 });

    const scaled = await cli(dir, ["render", "cards", "--json", "--scale", "2", "--out", "scaled"]);
    expect(scaled.code).toBe(0);
    expect(pngSize(readFileSync(join(dir, "scaled/cards/card.png")))).toEqual({ width: 600, height: 300 });

    const svg = await cli(dir, ["render", "cards", "--json", "--format", "svg", "--out", "svg"]);
    expect(svg.code).toBe(0);
    expect(lines(svg)[0]).toMatchObject({ outputs: ["svg/cards/card.svg"] });
    expect(readFileSync(join(dir, "svg/cards/card.svg"), "utf8")).toMatch(/^<svg/);
  });

  it("--stdout writes its image", async () => {
    const dir = withFixtures(project({ "cards/card.tsx": canvas(FONTS) }));
    const ran = await cli(dir, ["render", "cards/card.tsx", "--stdout"]);
    expect(ran.code, ran.stderr).toBe(0);
    expect(ran.stdout.slice(1, 4)).toBe("PNG");
    expect(existsSync(join(dir, "out"))).toBe(false);
  });

  it("with no font it can draw, fails with image/font", async () => {
    const dir = project({ "cards/card.tsx": canvas("[]") });
    const ran = await cli(dir, ["render", "cards", "--json"]);
    expect(ran.code).toBe(1);
    expect(lines(ran)[0]).toMatchObject({ status: "error", outputs: [], diagnostics: [{ code: "image/font", severity: "error" }] });
  });
});

it("--public must be a folder", async () => {
  const dir = withFixtures(project({ "cards/card.tsx": canvas(FONTS) }));
  const ran = await cli(dir, ["render", "cards", "--public", "nowhere"]);
  expect(ran.code).toBe(2);
  expect(ran.stderr).toContain("--public nowhere isn't a folder");
});

describe("the engines are the project's", () => {
  it("a Canvas without satori and @resvg/resvg-js: its error names them", async () => {
    const dir = withFixtures(project({ "cards/card.tsx": canvas(FONTS) }, { modules: ["react", "react-dom"] }));
    copyElements(dir);
    const ran = await cli(dir, ["render", "cards", "--json"]);
    expect(ran.code).toBe(1);
    expect(lines(ran)[0]).toMatchObject({ root: "Canvas", status: "error", outputs: [], diagnostics: [] });
    expect(lines(ran)[0].error).toBe("A Canvas's image needs satori and @resvg/resvg-js, not installed where this template is: npm i satori @resvg/resvg-js");
  });

  it("a Canvas with satori but not @resvg/resvg-js: its error names the one missing", async () => {
    const dir = withFixtures(project({ "cards/card.tsx": canvas(FONTS) }, { modules: { react: "react", "react-dom": "react-dom", satori: ENGINES.satori } }));
    copyElements(dir);
    const ran = await cli(dir, ["render", "cards", "--json"]);
    expect(ran.code).toBe(1);
    expect(lines(ran)[0].error).toBe("A Canvas's image needs @resvg/resvg-js, not installed where this template is: npm i @resvg/resvg-js");
  });

  it.skipIf(ON_BUN)("a Document without @react-pdf/renderer: its error names it", async () => {
    const dir = withFixtures(project({ "docs/invoice.tsx": documentTemplate(FONTS) }, { modules: ["react", "react-dom"] }));
    copyElements(dir);
    const ran = await cli(dir, ["render", "docs", "--json"]);
    expect(ran.code).toBe(1);
    expect(lines(ran)[0]).toMatchObject({ root: "Document", status: "error", outputs: [] });
    expect(lines(ran)[0].error).toBe("A Document's PDF needs @react-pdf/renderer, not installed where this template is: npm i @react-pdf/renderer");
  });

  it("with them, the copy renders as the linked package does", async () => {
    const dir = withFixtures(project({ "cards/card.tsx": canvas(FONTS) }, { modules: { react: "react", "react-dom": "react-dom", ...ENGINES } }));
    copyElements(dir);
    const ran = await cli(dir, ["render", "cards", "--json"]);
    expect(ran.code, ran.stdout + ran.stderr).toBe(0);
    expect(lines(ran)[0]).toMatchObject({ status: "ok", outputs: ["out/cards/card.png"], diagnostics: [] });
  });
});

describe("an Elements without templateAssets()", () => {
  for (const engines of [true, false]) {
    it(`writes a Document's and a Canvas's HTML as before, with a note naming the release that adds it (${engines ? "with" : "without"} the engines)`, async () => {
      const dir = withFixtures(
        project(
          { "docs/invoice.tsx": documentTemplate(FONTS), "docs/card.tsx": canvas(FONTS) },
          { modules: engines ? { react: "react", "react-dom": "react-dom", ...ENGINES } : ["react", "react-dom"] },
        ),
      );
      copyElements(dir, { templateAssets: false });
      const ran = await cli(dir, ["render", "docs", "--json"]);
      expect(ran.code, ran.stdout + ran.stderr).toBe(0);
      const [card, invoice] = lines(ran);
      expect(card).toMatchObject({ root: "Canvas", status: "ok", outputs: ["out/docs/card.html"] });
      expect(invoice).toMatchObject({ root: "Document", status: "ok", outputs: ["out/docs/invoice.html"] });
      for (const line of [card, invoice]) {
        expect(line.diagnostics).toEqual([expect.objectContaining({ code: "cli/html-only", severity: "info", message: expect.stringContaining("@hyper-elements/react 0.4.3 or later") })]);
      }
    });
  }
});

describe("the gallery's and stress set's templates with WOFF2 fonts only", () => {
  const EXAMPLES = join(REPO, "packages/react/src/primitives/examples");
  const toPackage = (source: string, site: string) => source.replace(/from "\.\.\/\.\.\/index"/g, 'from "@hyper-elements/react"').replaceAll("https://fonts.gstatic.com", site);

  async function gallery(): Promise<{ dir: string; site: Server }> {
    // The fonts' URLs, served here: each a WOFF2 file, as Google Fonts serves them.
    const site = await serve({ "*": answer(fixture("fonts/Inter-Regular.woff2"), "font/woff2") });
    servers.push(site);
    const read = (path: string) => toPackage(readFileSync(join(EXAMPLES, path), "utf8"), site.url);
    const dir = project({
      "lib/slow-signals-card.tsx": read("gallery/slow-signals-card.tsx"),
      "lib/pell-ashby-invoice.tsx": read("gallery/pell-ashby-invoice.tsx"),
      "lib/stress.tsx": read("stress/index.tsx"),
      "templates/slow-signals-card.tsx": `import { slowSignalsCard } from "../lib/slow-signals-card";\nexport default function Template() { return slowSignalsCard; }\n`,
      "templates/stress-canvas-shapes.tsx": `import { stress } from "../lib/stress";\nexport default function Template() { return (stress.canvasShapes as any).template; }\n`,
      "templates/pell-ashby-invoice.tsx": `import { pellAshbyInvoice } from "../lib/pell-ashby-invoice";\nexport default function Template() { return pellAshbyInvoice; }\n`,
      "templates/stress-document-pages.tsx": `import { stress } from "../lib/stress";\nexport default function Template() { return (stress.documentPages as any).template; }\n`,
    });
    // The stress set's picture, where its template names it (relative to the template).
    mkdirSync(join(dir, "templates/gallery/saltworks"), { recursive: true });
    cpSync(join(EXAMPLES, "gallery/assets/saltworks/low-water.png"), join(dir, "templates/gallery/saltworks/low-water.png"));
    return { dir, site };
  }

  it("a Canvas with no font it can draw fails with image/font (exit 1)", async () => {
    const { dir, site } = await gallery();
    const ran = await cli(dir, ["render", "templates/slow-signals-card.tsx", "templates/stress-canvas-shapes.tsx", "--json"]);
    expect(ran.code).toBe(1);
    for (const line of lines(ran).slice(0, 2)) {
      expect(line).toMatchObject({ root: "Canvas", status: "error", outputs: [] });
      expect(codes(line)).toContain("image/font");
      expect(line.diagnostics.filter((d: { code: string; message: string }) => d.code === "image/font" && d.message.includes("WOFF2")).length).toBeGreaterThan(0);
      expect(line.diagnostics.at(-1)).toMatchObject({ code: "image/font", severity: "error" });
    }
    expect(site.hits.size).toBeGreaterThan(0);
  });

  it.skipIf(ON_BUN)("a Document is drawn in standard PDF fonts, with pdf/font saying why", async () => {
    const { dir } = await gallery();
    const ran = await cli(dir, ["render", "templates/pell-ashby-invoice.tsx", "templates/stress-document-pages.tsx", "--json"]);
    expect(ran.code, ran.stdout + ran.stderr).toBe(0);
    const [invoice, pages] = lines(ran);
    expect(invoice).toMatchObject({ root: "Document", status: "ok", outputs: ["out/templates/pell-ashby-invoice.pdf"] });
    expect(pages).toMatchObject({ root: "Document", status: "ok", outputs: ["out/templates/stress-document-pages.pdf"] });
    for (const line of [invoice, pages]) {
      expect(new Set(codes(line))).toEqual(new Set(["pdf/font"]));
      expect(line.diagnostics.some((d: { message: string }) => d.message.includes("WOFF2"))).toBe(true);
    }
  });
});
