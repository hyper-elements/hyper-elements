// The template suite's launch authoring check, copied in as tools/check.mjs: a reference launch (tools/values.json),
// written as the kit's design (tools/reference-design.mjs: designs/launch.tsx for the template, designs/launch.json
// for the others), drawn in both formats with the template the agent wrote, and checked as any launch is
// (tools/check-launch.mjs). The template works when that passes.
//   node tools/check.mjs [--json]
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const run = resolve(here, "..");
const values = JSON.parse(readFileSync(join(here, "values.json"), "utf8"));
const { files } = await import(pathToFileURL(join(here, "reference-design.mjs")).href);
for (const [path, text] of Object.entries(files(values))) {
  mkdirSync(dirname(join(run, path)), { recursive: true });
  writeFileSync(join(run, path), text);
}
const drawn = spawnSync(process.execPath, [join(here, "render-launch.mjs")], { cwd: run, encoding: "utf8", maxBuffer: 1 << 26 });
if (!process.argv.includes("--json")) process.stdout.write(drawn.stdout);
const checked = spawnSync(process.execPath, [join(here, "check-launch.mjs"), ...process.argv.slice(2)], { cwd: run, encoding: "utf8", maxBuffer: 1 << 26 });
process.stdout.write(checked.stdout);
process.stderr.write(checked.stderr);
process.exit(checked.status ?? 1);
