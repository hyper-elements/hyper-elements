// The `open` checks (task 10, a brief with no exact copy). tools/checks/open/spec.json:
//
//   { "file": "out/email.html", "uses": ["<Button", "<MergeTag"], "width": 375 }
//
// The render found no errors or warnings (out/diagnostics.json: an Image without its file's size warns); the sources
// use each component named; and in Chromium nothing scrolls sideways at the phone width, every image loads, and
// there's at least one link.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { open, reporter } from "./check-lib.mjs";

const tools = dirname(fileURLToPath(import.meta.url));
const run = resolve(tools, "..");
const spec = JSON.parse(readFileSync(join(tools, "checks/open/spec.json"), "utf8"));
const { check, finish } = reporter();
const file = join(run, spec.file ?? "out/email.html");
if (!existsSync(file)) {
  check("output exists", false, `${spec.file ?? "out/email.html"} was not found`);
  finish();
}

const diagnostics = existsSync(join(run, "out/diagnostics.json")) ? JSON.parse(readFileSync(join(run, "out/diagnostics.json"), "utf8")) : null;
const bad = (diagnostics ?? []).filter((d) => d.severity === "error" || d.severity === "warning");
check("no errors or warnings", diagnostics !== null && bad.length === 0, diagnostics === null ? "out/diagnostics.json was not found: render again" : bad.map((d) => `${d.severity} ${d.code} at ${d.path}`).slice(0, 3).join("; "));

const src = existsSync(join(run, "src")) ? readdirSync(join(run, "src"), { recursive: true }).filter((f) => /\.tsx?$/.test(f)).map((f) => readFileSync(join(run, "src", f), "utf8")).join("\n") : "";
for (const u of spec.uses ?? []) check(`uses ${u.slice(1)}`, src.includes(u), `no ${u} in src/`);

const { browser, page, at } = await open(file);
const width = spec.width ?? 375;
await at(width);
const sw = await page.evaluate(() => document.documentElement.scrollWidth);
check(`fits ${width}px`, sw <= width + 1, `scrolls sideways at ${width}px (${sw}px wide)`);
const imgs = await page.evaluate(() => [...document.images].map((i) => ({ src: i.getAttribute("src"), loaded: i.complete && i.naturalWidth > 0 })));
const broken = imgs.filter((i) => !i.loaded);
check("every image loads", broken.length === 0, `didn't load: ${broken.map((i) => i.src).slice(0, 3).join(", ")}`);
const links = await page.evaluate(() => [...document.querySelectorAll("a[href]")].length);
check("has a link", links > 0, "no link");
await browser.close();
finish();
