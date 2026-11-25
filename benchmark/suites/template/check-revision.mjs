// The template suite's revision check, copied in as tools/check.mjs: the changed launch graphic checked as any is
// (tools/check-launch.mjs), and its locality against where it started (tools/start/, the finished launch):
//
// - only the change is redrawn: in each format, every pixel outside the changed field's region (the spec's
//   launch.changed) is the start's;
// - artwork unchanged: the design still names the same artwork file, and that file's bytes are the provider's.
//
//   node tools/check.mjs [--json]
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readPng } from "./pixels.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const run = resolve(here, "..");
const json = process.argv.includes("--json");
const brand = JSON.parse(readFileSync(join(here, "brand-launch.json"), "utf8"));
const formats = Object.keys(brand.formats);
const node = (args) => spawnSync(process.execPath, args, { cwd: run, encoding: "utf8", maxBuffer: 1 << 26 });
const last = (text) => {
  try {
    return JSON.parse(text.trim().split("\n").pop());
  } catch {
    return null;
  }
};

const launch = last(node([join(here, "check-launch.mjs"), "--json"]).stdout) ?? { pass: false, results: [{ name: "the launch check ran", ok: false, detail: "it gave no result" }], measures: {} };
const results = [...launch.results];
const measures = { ...launch.measures };
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail: ok ? "" : detail });

// The start drawn as it was, the change set aside meanwhile: designs/ and out/ swapped, then put back.
const aside = join(run, ".cache/revision");
rmSync(aside, { recursive: true, force: true });
mkdirSync(aside, { recursive: true });
const before = {};
if (existsSync(join(here, "start/designs")) && formats.every((f) => existsSync(join(run, "out", `${f}.png`)))) {
  renameSync(join(run, "designs"), join(aside, "designs"));
  cpSync(join(run, "out"), join(aside, "out"), { recursive: true });
  try {
    cpSync(join(here, "start/designs"), join(run, "designs"), { recursive: true });
    const drawn = node([join(here, "render-launch.mjs")]);
    for (const f of formats) if (existsSync(join(run, "out", `${f}.png`))) before[f] = readPng(readFileSync(join(run, "out", `${f}.png`)));
    if (drawn.status !== 0) check("the start draws", false, (drawn.stderr || drawn.stdout).slice(0, 400));
  } finally {
    rmSync(join(run, "designs"), { recursive: true, force: true });
    renameSync(join(aside, "designs"), join(run, "designs"));
    rmSync(join(run, "out"), { recursive: true, force: true });
    cpSync(join(aside, "out"), join(run, "out"), { recursive: true });
  }
}
for (const format of formats) {
  const spec = JSON.parse(readFileSync(join(here, `spec-${format}.json`), "utf8"));
  const changed = spec.launch.regions[spec.launch.changed];
  const a = before[format];
  if (!a || !existsSync(join(run, "out", `${format}.png`))) {
    check(`${format}: only the change is redrawn`, false, "there's no start or no result to compare");
    continue;
  }
  const b = readPng(readFileSync(join(run, "out", `${format}.png`)));
  let outside = 0, box = null;
  for (let y = 0; y < b.height; y++) {
    for (let x = 0; x < b.width; x++) {
      const i = (y * b.width + x) * 3;
      if (a.rgb[i] === b.rgb[i] && a.rgb[i + 1] === b.rgb[i + 1] && a.rgb[i + 2] === b.rgb[i + 2]) continue;
      box = box ? { left: Math.min(box.left, x), top: Math.min(box.top, y), right: Math.max(box.right, x + 1), bottom: Math.max(box.bottom, y + 1) } : { left: x, top: y, right: x + 1, bottom: y + 1 };
      const within = x >= changed.left - 2 && x < changed.left + changed.width + 2 && y >= changed.top - 2 && y < changed.top + changed.height + 2;
      if (!within) outside++;
    }
  }
  measures[`changed:${format}`] = box;
  check(`${format}: only the change is redrawn`, box !== null && outside === 0, box === null ? "nothing changed" : `${outside} pixels changed outside the ${spec.launch.changed}' region (between ${box.left},${box.top} and ${box.right},${box.bottom})`);
}
{
  const spec = JSON.parse(readFileSync(join(here, `spec-${formats[0]}.json`), "utf8"));
  const source = readdirSync(join(run, "designs")).map((f) => readFileSync(join(run, "designs", f), "utf8")).join("\n");
  const file = join(run, spec.launch.artworkSrc);
  const sha = existsSync(file) ? createHash("sha256").update(readFileSync(file)).digest("hex") : null;
  check("artwork unchanged", source.includes(spec.launch.artworkSrc) && sha === spec.launch.artworkSha256, !source.includes(spec.launch.artworkSrc) ? `the design no longer names ${spec.launch.artworkSrc}` : `${spec.launch.artworkSrc} isn't the provider's file`);
}

const failed = results.filter((r) => !r.ok);
if (json) console.log(JSON.stringify({ pass: failed.length === 0, total: results.length, failed: failed.length, results, measures }));
else {
  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.ok ? "" : ` — ${r.detail}`}`);
  console.log(failed.length ? `\n${failed.length} of ${results.length} checks failed.` : `\nAll ${results.length} checks passed.`);
}
process.exit(failed.length ? 1 : 0);
