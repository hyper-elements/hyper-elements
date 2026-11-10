// The `text` checks: each of the spec's strings is in the plain-text output (out/email.txt, render()'s `text`).
// tools/checks/text/spec.json: { "contains": ["…"] }
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { reporter } from "./check-lib.mjs";

const tools = dirname(fileURLToPath(import.meta.url));
const run = resolve(tools, "..");
const spec = JSON.parse(readFileSync(join(tools, "checks/text/spec.json"), "utf8"));
const { check, finish } = reporter();
const file = join(run, spec.file ?? "out/email.txt");
if (!existsSync(file)) {
  check("plain text exists", false, `${spec.file ?? "out/email.txt"} was not found`);
  finish();
}
const norm = (s) => s.replace(/[   ]/g, " ").replace(/\s+/g, " ").trim();
const text = norm(readFileSync(file, "utf8"));
for (const t of spec.contains) check(`plain text has "${t}"`, text.includes(norm(t)), "missing from the plain-text version");
finish();
