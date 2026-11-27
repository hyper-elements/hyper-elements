/**
 * A paginator runs in a browser as it does in Node: createPaginator(), bundled for a browser (react-pdf's browser build,
 * no Node module or global), paginates each Document in Chromium to the same plan, to the bit, as in Node, and lays it
 * out with its lines to the same layout (each line's box and each caret in it) and draws it to the same SVG; and as it's
 * typed into, a keystroke at a time.
 */
import { build } from "esbuild";
import { chromium, type Browser } from "playwright";
import { fileURLToPath } from "node:url";
import { createPaginator } from "../../../src/pdf";
import { arabic } from "../arabic";
import { designs, report, typing } from "./paginated";

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => browser?.close());

/** The entry bundled as a browser loads it: a classic script. */
async function bundle(): Promise<string> {
  const result = await build({
    entryPoints: [fileURLToPath(new URL("./paginator.entry.tsx", import.meta.url))],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: "es2022",
    jsx: "automatic",
    logLevel: "silent",
    // This package's main entry, from its source, as src/pdf imports it by name.
    alias: { "@hyper-elements/react": fileURLToPath(new URL("../../../src/primitives/index.ts", import.meta.url)) },
    // A classic script has no import.meta.url, which react-pdf's PDF library makes a URL from when it loads (for a file
    // it reads only for PDF/A): an address, as a bundler gives an ES module (the website's playground does the same).
    define: { "process.env.NODE_ENV": '"production"', __HYPER_ELEMENTS_CJS__: "false", "import.meta.url": '"https://elements.invalid/"' },
  });
  return result.outputFiles[0].text;
}

it("paginates and lays out each Document in a browser as in Node, to the same plan and layout, as it's typed into", async () => {
  const script = await bundle();
  // Nothing of Node's is in the bundle.
  expect(script).not.toMatch(/\brequire\(["']node:|\bBuffer\.from\(/);
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("about:blank");
  await page.addScriptTag({ content: script });
  // It loads as a script does, with no error.
  expect(errors.join("\n")).toBe("");
  const inBrowser = JSON.parse(await page.evaluate((bytes) => window.paginateAll(bytes), Array.from(arabic)));
  expect(errors).toEqual([]);

  const paginator = await createPaginator({ fonts: [{ family: "Noto Arabic", src: arabic }] });
  const plans = Object.fromEntries(Object.entries(designs).map(([name, design]) => [name, paginator.paginate(design)]));
  const typed = typing.map((text) => paginator.paginate(report(80, text), { diagnostics: false }).plan);
  const layouts = Object.fromEntries(Object.entries(designs).map(([name, design]) => [name, paginator.paginate(design, { diagnostics: false, layout: true, svg: true })]));
  for (const name of Object.keys(designs)) expect(plans[name].plan.pages.length, name).toBeGreaterThan(1);
  // Each laid out with its lines: where each line is, and each caret in it.
  for (const name of Object.keys(designs)) expect(layouts[name].layout!.nodes.some((node) => node.lineBoxes?.length), name).toBe(true);
  for (const name of Object.keys(designs)) expect(layouts[name].svg, name).toHaveLength(plans[name].plan.pages.length);
  expect(inBrowser).toEqual(JSON.parse(JSON.stringify({ plans, typed, layouts })));
});
