// The `styles` checks, for an Email or a Page, each read in Chromium: tools/checks/styles/spec.json.
//
//   { "file": "out/page.html",
//     "styles": [{ "text", "width", "property", "value" }],   the computed style of the element holding the text
//     "hovers": [{ "text", "property", "value" }],            while the pointer is over the link or button with that text
//     "gaps":   [{ "above", "below", "width", "min" }],       the space between two texts, in px
//     "hidden": [{ "text", "width" }],                        not shown at that width
//     "bands":  [{ "text", "width", "background" }] }         the background behind the text spans the window
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { open, reporter, styleChecks } from "./check-lib.mjs";

const tools = dirname(fileURLToPath(import.meta.url));
const run = resolve(tools, "..");
const spec = JSON.parse(readFileSync(join(tools, "checks/styles/spec.json"), "utf8"));
const { check, finish } = reporter();
const file = join(run, spec.file ?? "out/email.html");
if (!existsSync(file)) {
  check("output exists", false, `${spec.file ?? "out/email.html"} was not found`);
  finish();
}
const { browser, page, at } = await open(file);
await styleChecks(page, at, spec, check);
await browser.close();
finish();
