// The template suite's launch graphic check, every kit the same: each format's image (out/<format>.png, from
// tools/render-launch.mjs) against its spec (tools/spec-<format>.json), with the image suite's checker
// (tools/image-check.mjs: the exact copy and its font, size and color from the trace; the logo and the screenshot found
// by cross-correlation, whole, at their widths; the text read by OCR, on at most its lines, in the safe margin), and
// Orbit's launch rules besides:
//
// - only Inter: every text the trace has is drawn with one of the brand's font files;
// - inside its regions: nothing is drawn outside the logo's, headline's, features', date's and art's regions;
// - artwork fills its region: the artwork covers the art region around the screenshot;
// - screenshot shape: the screenshot is drawn at a shape the brand takes (1.2:1 to 2:1).
//
// Each format's outcome is in `measures.outcomes`: "failed" (it wasn't drawn: the render said why), "correct" (drawn,
// every check passed) or "escaped" (drawn, and something's wrong: a violation that got through).
//
//   node tools/check.mjs [--json] [--formats square,landscape]
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deltaE, lab, parseColor, pixel, readPng } from "./pixels.mjs";
import { fontFor, runsOf } from "./trace.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const run = resolve(here, "..");
const json = process.argv.includes("--json");
const at = process.argv.indexOf("--formats");
const brand = JSON.parse(readFileSync(join(here, "brand-launch.json"), "utf8"));
const formats = at > -1 ? process.argv[at + 1].split(",") : Object.keys(brand.formats);
const rendered = existsSync(join(run, "out/render.json")) ? JSON.parse(readFileSync(join(run, "out/render.json"), "utf8")) : {};

const results = [];
const measures = { outcomes: {} };
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail: ok ? "" : detail });

function sh(cmd, args, env) {
  return new Promise((done) => {
    const p = spawn(cmd, args, { cwd: run, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => done({ code, out, err }));
  });
}

/** A folder the image checker reads as a run: this format's image and trace, the fonts, and every image file. */
function stage(format) {
  const dir = join(run, ".cache", `check-${format}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, "out"), { recursive: true });
  mkdirSync(join(dir, "assets"), { recursive: true });
  copyFileSync(join(run, "out", `${format}.png`), join(dir, "out/card.png"));
  copyFileSync(join(run, "out", `${format}.trace.json`), join(dir, "out/card.trace.json"));
  symlinkSync(join(run, "fonts"), join(dir, "fonts"), "dir");
  for (const folder of ["assets", "art"]) {
    if (!existsSync(join(run, folder))) continue;
    for (const f of readdirSync(join(run, folder))) symlinkSync(join(run, folder, f), join(dir, "assets", f));
  }
  return dir;
}

const inflate = (b, d) => ({ left: b.left - d, top: b.top - d, right: b.left + b.width + d, bottom: b.top + b.height + d });
const inside = (x, y, b) => x >= b.left && x < b.right && y >= b.top && y < b.bottom;

for (const format of formats) {
  const png = join(run, "out", `${format}.png`);
  const said = rendered[format]?.said ?? "";
  if (!existsSync(png) || !existsSync(join(run, "out", `${format}.trace.json`))) {
    check(`${format}: drawn`, false, said ? `it wasn't drawn: ${said.split("\n").slice(0, 6).join(" | ").slice(0, 600)}` : `out/${format}.png wasn't written: run node tools/render-launch.mjs`);
    measures.outcomes[format] = "failed";
    continue;
  }
  const spec = JSON.parse(readFileSync(join(here, `spec-${format}.json`), "utf8"));
  const before = results.length;
  // The image suite's checks, on this format.
  const dir = stage(format);
  const image = await sh(process.execPath, [join(here, "image-check.mjs"), "--json"], { BENCH_RUN: dir, BENCH_SPEC: join(here, `spec-${format}.json`) });
  let verdict = null;
  try {
    verdict = JSON.parse(image.out.trim().split("\n").pop());
  } catch {
    check(`${format}: the image check ran`, false, (image.err || image.out).slice(0, 400));
  }
  for (const r of verdict?.results ?? []) results.push({ ...r, name: `${format}: ${r.name}` });
  measures[format] = verdict?.measures ?? null;

  // Orbit's launch rules.
  const img = readPng(readFileSync(png));
  const bg = lab(parseColor(brand.background));
  const L = spec.launch;
  const trace = JSON.parse(readFileSync(join(run, "out", `${format}.trace.json`), "utf8"));
  const files = new Map(readdirSync(join(run, "fonts")).map((f) => [createHash("sha256").update(readFileSync(join(run, "fonts", f))).digest("hex"), f]));
  const off = [];
  for (const r of runsOf(trace.tree ?? {})) {
    if (!String(r.text ?? "").trim()) continue;
    const face = fontFor(r.style ?? {}, trace.fonts ?? [], { fallback: (trace.engine ?? "satori") === "satori" });
    const file = face && files.get(face.sha256);
    if (!file || !L.fonts.includes(file)) off.push(`"${String(r.text).trim().slice(0, 30)}" in ${file ?? (face ? `${face.name} (not a file in fonts/)` : `a font that isn't loaded (${r.style?.fontFamily ?? "none"})`)}`);
  }
  check(`${format}: only Inter`, off.length === 0, [...new Set(off)].slice(0, 3).join("; "));

  const regions = Object.values(L.regions).map((b) => inflate(b, 2));
  let outside = 0, wrong = 0;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (regions.some((b) => inside(x, y, b))) continue;
      outside++;
      if (deltaE(lab(pixel(img, x, y)), bg) > 4) wrong++;
    }
  }
  measures[`outside:${format}`] = +(wrong / Math.max(1, outside)).toFixed(4);
  check(`${format}: inside its regions`, wrong / Math.max(1, outside) <= 0.002, `${(100 * wrong / Math.max(1, outside)).toFixed(1)}% of the card outside its regions isn't the background: something is drawn outside them (copy that overflows, or a part moved)`);

  const art = L.regions.art;
  const shot = inflate(L.shot, 4);
  let area = 0, covered = 0;
  for (let y = art.top + 2; y < art.top + art.height - 2; y++) {
    for (let x = art.left + 2; x < art.left + art.width - 2; x++) {
      if (inside(x, y, shot)) continue;
      area++;
      if (deltaE(lab(pixel(img, x, y)), bg) > 6) covered++;
    }
  }
  measures[`artwork:${format}`] = +(covered / Math.max(1, area)).toFixed(3);
  check(`${format}: artwork fills its region`, covered / Math.max(1, area) >= 0.85, `only ${Math.round((100 * covered) / Math.max(1, area))}% of the art region is drawn: the artwork doesn't cover it`);

  const box = verdict?.measures?.["image:screenshot"]?.box;
  if (box) {
    const aspect = box.width / box.height;
    const [min, max] = L.screenshotAspect;
    check(`${format}: screenshot shape`, aspect >= min - 0.02 && aspect <= max + 0.02, `the screenshot is drawn ${aspect.toFixed(2)}:1; Orbit's are ${min}:1 to ${max}:1`);
  }
  measures.outcomes[format] = results.slice(before).every((r) => r.ok) ? "correct" : "escaped";
}

const failed = results.filter((r) => !r.ok);
if (json) console.log(JSON.stringify({ pass: failed.length === 0, total: results.length, failed: failed.length, results, measures }));
else {
  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.ok ? "" : ` — ${r.detail}`}`);
  console.log(`Outcomes: ${Object.entries(measures.outcomes).map(([f, o]) => `${f} ${o}`).join(", ")}`);
  console.log(failed.length ? `\n${failed.length} of ${results.length} checks failed.` : `\nAll ${results.length} checks passed.`);
}
process.exit(failed.length ? 1 : 0);
