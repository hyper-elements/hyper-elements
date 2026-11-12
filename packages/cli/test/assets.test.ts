/**
 * A Document's and a Canvas's fonts and images, loaded by the CLI from what the template names (assets.ts): relative
 * and root-relative paths, data: URIs and http(s) URLs (from a local server), the cache, --refresh and --offline, and
 * what's left out with `cli/asset`, the renderer's own diagnostic following. Most use a Canvas, which renders on Node
 * and on Bun; a Document's PDF is Node's only (decision in render.ts), so its tests run on Node.
 */
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { answer, canvas, cli, documentTemplate, fixture, lines, link, MODULES, ON_BUN, project, serve, WINDOWS, withFixtures, type Server } from "./helpers";

const REGULAR = `{ family: "Inter", src: "../fonts/Inter-Regular.ttf", weight: 400 }`;
const BOLD = `{ family: "Inter", src: "../fonts/Inter-Bold.ttf", weight: 700 }`;
const codes = (line: { diagnostics: Array<{ code: string }> }) => line.diagnostics.map((d) => d.code);
const entry = (cache: string, url: string) => join(cache, createHash("sha256").update(url).digest("hex"));

let servers: Server[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) await server.close();
});
async function server(routes: Parameters<typeof serve>[0]): Promise<Server> {
  const made = await serve(routes);
  servers.push(made);
  return made;
}

describe("where a source is read from", () => {
  it("a relative path, from the template's folder", async () => {
    const dir = withFixtures(project({ "cards/card.tsx": canvas(`[${REGULAR}]`, `<Text>Card</Text><Image src={{ src: "../images/flag.png", width: 32, height: 32 }} alt="Flag" style={{ width: 32 }} />`) }));
    const ran = await cli(dir, ["render", "cards", "--json"]);
    expect(ran.code, ran.stdout + ran.stderr).toBe(0);
    expect(lines(ran)[0]).toMatchObject({ root: "Canvas", status: "ok", outputs: ["out/card.png"], diagnostics: [] });
    expect(readFileSync(join(dir, "out/card.png")).subarray(1, 4).toString()).toBe("PNG");
  });

  it("a root-relative path, from --public", async () => {
    const dir = project({ "cards/card.tsx": canvas(`[{ family: "Inter", src: "/fonts/Inter-Regular.ttf" }]`, `<Text>Card</Text><Image src="/images/flag.png" alt="Flag" style={{ width: 32 }} />`) });
    withFixtures(dir, "static");
    const ran = await cli(dir, ["render", "cards", "--json", "--public", "static"]);
    expect(ran.code, ran.stdout + ran.stderr).toBe(0);
    expect(lines(ran)[0]).toMatchObject({ status: "ok", outputs: ["out/card.png"], diagnostics: [] });
  });

  it("a root-relative path, from the public/ folder beside the nearest package.json, by default", async () => {
    const dir = project({ "app/package.json": `{ "name": "app", "type": "module" }`, "app/cards/card.tsx": canvas(`[{ family: "Inter", src: "/fonts/Inter-Regular.ttf" }]`, `<Text>Card</Text><Image src="/images/flag.png?v=2" alt="Flag" style={{ width: 32 }} />`) });
    withFixtures(dir, "app/public");
    const ran = await cli(dir, ["render", "app/cards", "--json"]);
    expect(ran.code, ran.stdout + ran.stderr).toBe(0);
    expect(lines(ran)[0]).toMatchObject({ status: "ok", diagnostics: [] });
  });

  it("a root-relative path with no public folder: left out, and the renderer says what's missing", async () => {
    const dir = withFixtures(project({ "cards/card.tsx": canvas(`[${REGULAR}]`, `<Text>Card</Text><Image src="/images/flag.png" alt="Flag" style={{ width: 32 }} />`) }));
    const ran = await cli(dir, ["render", "cards", "--json"]);
    expect(ran.code).toBe(1);
    const line = lines(ran)[0];
    expect(codes(line)).toEqual(["cli/asset", "image/image"]);
    expect(line.diagnostics[0]).toMatchObject({ severity: "warning", path: "" });
    expect(line.diagnostics[0].message).toContain("/images/flag.png");
    expect(line.diagnostics[0].fix).toContain("--public");
  });

  it("a scheme-relative URL or another scheme: left out with cli/asset", async () => {
    const dir = withFixtures(
      project({ "cards/card.tsx": canvas(`[${REGULAR}, { family: "Mono", src: "//fonts.example.com/mono.ttf" }, { family: "Serif", src: "ftp://fonts.example.com/serif.ttf" }]`) }),
    );
    const ran = await cli(dir, ["render", "cards", "--json"]);
    expect(ran.code, ran.stdout + ran.stderr).toBe(0);
    const line = lines(ran)[0];
    expect(codes(line).slice(0, 2)).toEqual(["cli/asset", "cli/asset"]);
    expect(line.diagnostics[0].message).toContain("//fonts.example.com/mono.ttf");
    expect(line.diagnostics[0].message).toContain("scheme-relative");
    expect(line.diagnostics[1].message).toContain("doesn't load ftp: URLs");
    // The renderer's own diagnostic follows, for each family it wasn't given.
    expect(codes(line).slice(2)).toEqual(["image/font", "image/font"]);
  });
});

describe("data: URIs", () => {
  it.skipIf(ON_BUN)("a Document whose only font is a data: face is drawn in it, with no pdf/font", async () => {
    const uri = `data:font/ttf;base64,${fixture("fonts/Inter-Regular.ttf").toString("base64")}`;
    const dir = project({ "docs/invoice.tsx": documentTemplate(`[{ family: "Inter", src: ${JSON.stringify(uri)} }]`, "<Text>Invoice 1042, with thanks</Text>") });
    const ran = await cli(dir, ["render", "docs", "--json"]);
    expect(ran.code, ran.stdout + ran.stderr).toBe(0);
    expect(lines(ran)[0]).toMatchObject({ root: "Document", status: "ok", outputs: ["out/invoice.pdf"], diagnostics: [] });
    const pdf = readFileSync(join(dir, "out/invoice.pdf")).toString("latin1");
    expect(pdf).toMatch(/\/BaseFont \/[A-Z]{6}\+Inter/);
    expect(pdf).not.toContain("Helvetica");
  });

  it("a Canvas with a data: regular and a fetched bold of one family draws both, with no image/font-weight", async () => {
    const site = await server({ "/Inter-Bold.ttf": answer(fixture("fonts/Inter-Bold.ttf"), "font/ttf") });
    const uri = `data:font/ttf;base64,${fixture("fonts/Inter-Regular.ttf").toString("base64")}`;
    const children = `<Text>Regular</Text><Text style={{ fontWeight: 700 }}>Bold</Text>`;
    const dir = withFixtures(
      project({
        "cards/mixed.tsx": canvas(`[{ family: "Inter", src: ${JSON.stringify(uri)}, weight: 400 }, { family: "Inter", src: "${site.url}/Inter-Bold.ttf", weight: 700 }]`, children),
        "cards/files.tsx": canvas(`[${REGULAR}, ${BOLD}]`, children),
      }),
    );
    const ran = await cli(dir, ["render", "cards", "--json"]);
    expect(ran.code, ran.stdout + ran.stderr).toBe(0);
    for (const line of lines(ran).slice(0, 2)) expect(line).toMatchObject({ status: "ok", diagnostics: [] });
    // The same image as with both faces' files: each weight drawn in its own.
    expect(readFileSync(join(dir, "out/mixed.png")).equals(readFileSync(join(dir, "out/files.png")))).toBe(true);
  });
});

describe("http(s) sources and the cache", () => {
  it("fetches once and caches in the nearest node_modules/.cache; --refresh fetches again", async () => {
    const site = await server({ "/Inter-Regular.ttf": answer(fixture("fonts/Inter-Regular.ttf"), "font/ttf"), "/flag.png": answer(fixture("images/flag.png"), "image/png") });
    const font = `${site.url}/Inter-Regular.ttf`;
    const dir = project({ "cards/card.tsx": canvas(`[{ family: "Inter", src: "${font}" }]`, `<Text>Card</Text><Image src="${site.url}/flag.png" alt="Flag" style={{ width: 32 }} />`) });
    const cache = join(dir, "node_modules/.cache/hyper-elements");

    const first = await cli(dir, ["render", "cards", "--json"]);
    expect(first.code, first.stdout + first.stderr).toBe(0);
    expect(lines(first)[0]).toMatchObject({ status: "ok", diagnostics: [] });
    expect(site.hits.get("/Inter-Regular.ttf")).toBe(1);
    expect(existsSync(entry(cache, font))).toBe(true);
    expect(existsSync(entry(cache, `${site.url}/flag.png`))).toBe(true);
    // Only whole entries: no temporary files left.
    expect(readdirSync(cache).filter((name) => name.endsWith(".tmp"))).toEqual([]);
    const image = readFileSync(join(dir, "out/card.png"));

    const second = await cli(dir, ["render", "cards", "--json"]);
    expect(second.code).toBe(0);
    expect(site.hits.get("/Inter-Regular.ttf")).toBe(1);
    expect(readFileSync(join(dir, "out/card.png")).equals(image)).toBe(true);

    const refreshed = await cli(dir, ["render", "cards", "--json", "--refresh"]);
    expect(refreshed.code).toBe(0);
    expect(site.hits.get("/Inter-Regular.ttf")).toBe(2);
    expect(site.hits.get("/flag.png")).toBe(2);
  });

  // On Bun, a template with no node_modules above it gets packages Bun installs itself (its auto-install), not NODE_PATH's.
  it.skipIf(ON_BUN)("caches in the OS's cache folder where no node_modules is above the template", async () => {
    const site = await server({ "/Inter-Regular.ttf": answer(fixture("fonts/Inter-Regular.ttf"), "font/ttf") });
    const font = `${site.url}/Inter-Regular.ttf`;
    // A CommonJS template finding its packages through NODE_PATH, in a folder named other than node_modules.
    const dir = project(
      {
        "cards/card.cjs": `const { createElement: h } = require("react");
const { Canvas, Text } = require("@hyper-elements/react");
module.exports = function Card() {
  return h(Canvas, { width: 300, height: 150, fonts: [{ family: "Inter", src: ${JSON.stringify(font)} }], style: { fontFamily: "Inter" } }, h(Text, null, "Card"));
};
`,
      },
      { modules: [], packageJson: { name: "fixture", private: true } },
    );
    // Its packages are in lib/node_modules, which isn't above the template.
    for (const name of ["react", "react-dom", "@hyper-elements/react"]) link(join(dir, "lib"), name, MODULES[name]);
    const home = join(dir, "home");
    mkdirSync(home);
    const env = { NODE_PATH: join(dir, "lib", "node_modules"), HOME: home, USERPROFILE: home, XDG_CACHE_HOME: join(home, "xdg"), LOCALAPPDATA: join(home, "local") };
    const ran = await cli(dir, ["render", "cards/card.cjs", "--json"], { env });
    expect(ran.code, ran.stdout + ran.stderr).toBe(0);
    expect(lines(ran)[0]).toMatchObject({ status: "ok", diagnostics: [] });
    const os = process.platform === "win32" ? join(home, "local") : process.platform === "darwin" ? join(home, "Library", "Caches") : join(home, "xdg");
    expect(existsSync(entry(join(os, "hyper-elements"), font))).toBe(true);
    expect(existsSync(join(dir, "lib", "node_modules", ".cache"))).toBe(false);
  });

  it("a cache folder it can't write is read from only, with one note", async () => {
    if (WINDOWS || process.getuid?.() === 0) return;
    const site = await server({ "/Inter-Regular.ttf": answer(fixture("fonts/Inter-Regular.ttf"), "font/ttf"), "/Inter-Bold.ttf": answer(fixture("fonts/Inter-Bold.ttf"), "font/ttf") });
    const dir = project({ "cards/card.tsx": canvas(`[{ family: "Inter", src: "${site.url}/Inter-Regular.ttf", weight: 400 }, { family: "Inter", src: "${site.url}/Inter-Bold.ttf", weight: 700 }]`) });
    const cache = join(dir, "node_modules/.cache/hyper-elements");
    mkdirSync(cache, { recursive: true });
    chmodSync(cache, 0o555);
    try {
      const ran = await cli(dir, ["render", "cards", "--json"]);
      expect(ran.code, ran.stdout + ran.stderr).toBe(0);
      const line = lines(ran)[0];
      expect(codes(line)).toEqual(["cli/asset"]);
      expect(line.diagnostics[0]).toMatchObject({ severity: "info" });
      expect(line.diagnostics[0].message).toContain("can't be written");
      expect(readdirSync(cache)).toEqual([]);
    } finally {
      chmodSync(cache, 0o755);
    }
  });

  it("a 404 is left out with cli/asset, and the renderer's own diagnostic follows", async () => {
    const site = await server({ "/Inter-Regular.ttf": answer(fixture("fonts/Inter-Regular.ttf"), "font/ttf") });
    const dir = project({
      "cards/font.tsx": canvas(`[{ family: "Inter", src: "${site.url}/Inter-Regular.ttf" }, { family: "Mono", src: "${site.url}/mono.ttf" }]`),
      "cards/image.tsx": canvas(`[{ family: "Inter", src: "${site.url}/Inter-Regular.ttf" }]`, `<Text>Card</Text><Image src="${site.url}/missing.png" alt="Missing" style={{ width: 32 }} />`),
    });
    const ran = await cli(dir, ["render", "cards", "--json"]);
    expect(ran.code).toBe(1);
    const [font, image] = lines(ran);
    expect(font).toMatchObject({ status: "ok", outputs: ["out/font.png"] });
    expect(codes(font)).toEqual(["cli/asset", "image/font"]);
    expect(font.diagnostics[0].message).toContain(`${site.url}/mono.ttf`);
    expect(font.diagnostics[0].message).toContain("404");
    expect(font.diagnostics[1].message).toContain("Mono");
    expect(image).toMatchObject({ status: "error", outputs: [] });
    expect(codes(image)).toEqual(["cli/asset", "image/image"]);
    expect(image.diagnostics[0].message).toContain(`${site.url}/missing.png`);
    // Nothing cached for a failure.
    expect(existsSync(entry(join(dir, "node_modules/.cache/hyper-elements"), `${site.url}/mono.ttf`))).toBe(false);
  });

  it("a response cut short isn't cached, and is left out", async () => {
    let cut = true;
    const bytes = fixture("fonts/Inter-Regular.ttf");
    const site = await server({
      "/Inter-Regular.ttf": (_req, res) => {
        if (!cut) return answer(bytes, "font/ttf")(_req, res);
        res.writeHead(200, { "content-type": "font/ttf", "content-length": bytes.length });
        res.write(bytes.subarray(0, 1000), () => res.destroy());
      },
    });
    const font = `${site.url}/Inter-Regular.ttf`;
    const dir = project({ "cards/card.tsx": canvas(`[{ family: "Inter", src: "${font}" }]`) });
    const cache = join(dir, "node_modules/.cache/hyper-elements");
    const ran = await cli(dir, ["render", "cards", "--json"]);
    expect(ran.code).toBe(1);
    expect(codes(lines(ran)[0])).toEqual(["cli/asset", "image/font", "image/font"]);
    expect(existsSync(entry(cache, font))).toBe(false);
    cut = false;
    const again = await cli(dir, ["render", "cards", "--json"]);
    expect(again.code, again.stdout + again.stderr).toBe(0);
    expect(existsSync(entry(cache, font))).toBe(true);
  });

  it("--offline: a URL not in the cache fails the template with cli/offline; one in it is used", async () => {
    const site = await server({ "/Inter-Regular.ttf": answer(fixture("fonts/Inter-Regular.ttf"), "font/ttf") });
    const dir = project({ "cards/card.tsx": canvas(`[{ family: "Inter", src: "${site.url}/Inter-Regular.ttf" }]`) });
    const offline = await cli(dir, ["render", "cards", "--json", "--offline"]);
    expect(offline.code).toBe(1);
    expect(lines(offline)[0]).toMatchObject({ status: "error", outputs: [], diagnostics: [{ code: "cli/offline", severity: "error" }] });
    expect(lines(offline)[0].diagnostics[0].message).toContain(`${site.url}/Inter-Regular.ttf`);
    expect(site.hits.size).toBe(0);
    expect(existsSync(join(dir, "out"))).toBe(false);

    expect((await cli(dir, ["render", "cards", "--json"])).code).toBe(0);
    const cached = await cli(dir, ["render", "cards", "--json", "--offline"]);
    expect(cached.code).toBe(0);
    expect(site.hits.get("/Inter-Regular.ttf")).toBe(1);
  });

  it("a stylesheet URL (Google Fonts' css2) is left out, asking for the font file's own URL", async () => {
    const site = await server({
      "/css2": answer(`@font-face { font-family: 'Inter'; src: url(https://fonts.example.com/inter.ttf) format('truetype'); }`, "text/css; charset=utf-8"),
    });
    const dir = withFixtures(project({ "cards/card.tsx": canvas(`[${REGULAR}, { family: "Display", src: "${site.url}/css2?family=Display" }]`) }));
    const ran = await cli(dir, ["render", "cards", "--json"]);
    expect(ran.code, ran.stdout + ran.stderr).toBe(0);
    const line = lines(ran)[0];
    expect(codes(line)).toEqual(["cli/asset", "image/font"]);
    expect(line.diagnostics[0].message).toContain("stylesheet");
    expect(line.diagnostics[0].fix).toContain("font file's own URL");
  });
});

describe("fonts", () => {
  it("a weight range is given at its lower bound", async () => {
    const dir = withFixtures(project({ "cards/card.tsx": canvas(`[{ family: "Inter", src: "../fonts/Inter-Regular.ttf", weight: "400 700" }]`, `<Text>Regular</Text><Text style={{ fontWeight: 700 }}>Bold</Text>`) }));
    const ran = await cli(dir, ["render", "cards", "--json"]);
    expect(ran.code, ran.stdout + ran.stderr).toBe(0);
    const line = lines(ran)[0];
    // Text at 400 has its face; text at 700 is drawn in the nearest, the range's lower bound.
    expect(codes(line)).toEqual(["image/font-weight"]);
    expect(line.diagnostics[0].message).toContain("at 700, which is given at 400 only");
  });

  it("a WOFF2 font: the renderer's warning comes through, and a Canvas with no other fails with image/font", async () => {
    const dir = withFixtures(project({ "cards/card.tsx": canvas(`[{ family: "Inter", src: "../fonts/Inter-Regular.woff2" }]`) }));
    const ran = await cli(dir, ["render", "cards", "--json"]);
    expect(ran.code).toBe(1);
    const line = lines(ran)[0];
    expect(line).toMatchObject({ status: "error", outputs: [] });
    // renderImage() says the file is WOFF2, then (as for a family it isn't given) that it loads no fonts, then that
    // the Canvas has none to draw with.
    expect(line.diagnostics).toEqual([
      expect.objectContaining({ code: "image/font", severity: "warning", message: expect.stringContaining("WOFF2") }),
      expect.objectContaining({ code: "image/font", severity: "warning" }),
      expect.objectContaining({ code: "image/font", severity: "error" }),
    ]);
  });

  it.skipIf(ON_BUN)("a WOFF2 font in a Document: the renderer's warning comes through, and the PDF is written", async () => {
    const dir = withFixtures(project({ "docs/invoice.tsx": documentTemplate(`[{ family: "Inter", src: "../fonts/Inter-Regular.woff2" }]`) }));
    const ran = await cli(dir, ["render", "docs", "--json"]);
    expect(ran.code, ran.stdout + ran.stderr).toBe(0);
    const line = lines(ran)[0];
    expect(line).toMatchObject({ status: "ok", outputs: ["out/invoice.pdf"] });
    expect(line.diagnostics).toEqual([expect.objectContaining({ code: "pdf/font", severity: "warning", message: expect.stringContaining("WOFF2") })]);
  });
});
