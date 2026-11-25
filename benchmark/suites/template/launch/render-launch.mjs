// Renders the launch graphic in each of its formats: for each, tools/render.mjs (the image suite's, the same in every
// kit) runs cards/render.tsx with LAUNCH_FORMAT set, and its out/card.png and out/card.trace.json become
// out/<format>.png and out/<format>.trace.json. out/render.json says how each went: drawn, or why not.
//   node tools/render-launch.mjs [--formats square,landscape]
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const run = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const brand = JSON.parse(readFileSync(join(run, "tools/brand-launch.json"), "utf8"));
const at = process.argv.indexOf("--formats");
const formats = at > -1 ? process.argv[at + 1].split(",") : Object.keys(brand.formats);
const report = {};
let failed = 0;
for (const format of formats) {
  for (const f of [`${format}.png`, `${format}.trace.json`, "card.png", "card.trace.json"]) await rm(join(run, "out", f), { force: true });
  const r = spawnSync(process.execPath, [join(run, "tools/render.mjs")], { cwd: run, env: { ...process.env, LAUNCH_FORMAT: format }, encoding: "utf8", maxBuffer: 1 << 26 });
  const said = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim();
  if (r.status === 0 && existsSync(join(run, "out/card.png"))) {
    await rename(join(run, "out/card.png"), join(run, "out", `${format}.png`));
    await rename(join(run, "out/card.trace.json"), join(run, "out", `${format}.trace.json`));
    report[format] = { ok: true, said: said.slice(0, 2000) };
    console.log(`${format}: rendered out/${format}.png${said ? `\n${said}` : ""}`);
  } else {
    failed++;
    report[format] = { ok: false, said: said.slice(0, 4000) || `the render exited with ${r.status}` };
    console.error(`${format}: not rendered\n${said}`);
  }
}
await writeFile(join(run, "out/render.json"), JSON.stringify(report, null, 2));
process.exit(failed ? 1 : 0);
