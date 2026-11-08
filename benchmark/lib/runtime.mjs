// Runtime facts per image kit, measured once from the reference solutions (no agent, no API):
//
//   HYPER_ELEMENTS_PACKAGE=../packages/react node lib/runtime.mjs [--runs 20] [--warm 50]
//
// - install: what `npm install` of the kit's packages adds (bytes on disk, packages, any native binary). Hyper Elements is
//   installed from `npm pack` of the built checkout, with its peers, as a user would install it from npm.
// - cold start: a fresh node process importing the kit and rendering each brief's reference once (median of --runs).
// - warm render: the same render repeated in one process (median of --warm, after a first render).
// - output: the PNG's bytes, and whether two renders give the same bytes.
// Written to results/<stamp>-image-runtime.json with the machine's CPU, OS and Node version.
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { cpus, platform, release, arch, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { briefsOf, makeRun } from "./make-run.mjs";

const bench = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : def; };
const coldRuns = Number(arg("runs", "20"));
const warmRuns = Number(arg("warm", "50"));
const stamp = arg("stamp", new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19));
const pkg = JSON.parse(readFileSync(join(bench, "package.json"), "utf8")).dependencies;
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// ─── Install size ────────────────────────────────────────────────────────

function du(dir) {
  let bytes = 0, native = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) { bytes += statSync(p).size; if (e.name.endsWith(".node")) native.push(p.slice(p.indexOf("node_modules/") + 13)); }
    }
  };
  walk(dir);
  return { bytes, native };
}

function install(specs) {
  const dir = mkdtempSync(join(tmpdir(), "bench-install-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "probe", private: true }));
  execFileSync("npm", ["install", "--no-audit", "--no-fund", "--ignore-scripts=false", ...specs], { cwd: dir, stdio: "ignore" });
  const lock = JSON.parse(readFileSync(join(dir, "package-lock.json"), "utf8"));
  const { bytes, native } = du(join(dir, "node_modules"));
  return { packages: Object.keys(lock.packages).filter((k) => k.startsWith("node_modules/")).length, bytes, native };
}

/** The Chromium Playwright launches headless (its headless shell), on disk. */
function browserBytes() {
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH ?? join(process.env.HOME, process.platform === "darwin" ? "Library/Caches/ms-playwright" : ".cache/ms-playwright");
  const want = JSON.parse(readFileSync(join(bench, "node_modules/playwright-core/browsers.json"), "utf8")).browsers.find((b) => b.name === "chromium-headless-shell");
  try { return du(join(cache, `chromium_headless_shell-${want.revision}`)).bytes; } catch { return null; }
}

const src = process.env.HYPER_ELEMENTS_PACKAGE && resolve(process.env.HYPER_ELEMENTS_PACKAGE);
if (!src) throw new Error("Set HYPER_ELEMENTS_PACKAGE to a built checkout's packages/react (it's packed for the install size).");
const packDir = mkdtempSync(join(tmpdir(), "bench-pack-"));
const tarball = join(packDir, execFileSync("npm", ["pack", "--pack-destination", packDir, src], { encoding: "utf8" }).trim().split("\n").pop());
const versions = (names) => names.map((n) => `${n}@${pkg[n]}`);
const kits = {
  he: { specs: [tarball, ...versions(["satori", "@resvg/resvg-js", "react", "react-dom"])], note: "the package (packed from the checkout, its name before the rename) with its peers satori, @resvg/resvg-js, react and react-dom" },
  playwright: { specs: versions(["playwright", "react", "react-dom"]), note: "playwright, with react and react-dom to write the HTML (its browser, downloaded by `npx playwright install chromium`, is outside node_modules: browserBytes)" },
  canvas: { specs: versions(["@napi-rs/canvas"]), note: "@napi-rs/canvas (Skia, a native binary per platform)" },
};
const facts = {};
for (const [kit, k] of Object.entries(kits)) {
  console.log(`install ${kit}…`);
  facts[kit] = { install: { ...install(k.specs), what: k.note, tarballBytes: kit === "he" ? statSync(tarball).size : undefined } };
  if (kit === "playwright") facts[kit].install.browserBytes = browserBytes();
}

// ─── Render times ────────────────────────────────────────────────────────

const refs = join(bench, "suites/image/reference");
const root = join(bench, "runs", "runtime");
const timer = `
const t0 = performance.now();
const m = await import(process.argv[1]);
const a = performance.now();
const png = await m.default();
const b = performance.now();
const warm = [];
for (let i = 0; i < Number(process.argv[2]); i++) { const s = performance.now(); await m.default(); warm.push(performance.now() - s); }
console.log(JSON.stringify({ importMs: a - t0, firstRenderMs: b - a, warm, bytes: png.length ?? png.byteLength, sha: (await import("node:crypto")).createHash("sha256").update(png).digest("hex") }));
`;
for (const kit of Object.keys(kits)) {
  facts[kit].briefs = {};
  for (const brief of await briefsOf("image")) {
    const dir = await makeRun("image", kit, brief, "runtime", root);
    // The Playwright kit draws the Satori cards (HTML and CSS) where it has none of its own.
    const card = readdirSync(join(refs, kit)).includes(brief) ? join(refs, kit, brief, "card.tsx") : join(refs, "satori", brief, "card.tsx");
    execFileSync("mkdir", ["-p", join(dir, "cards")]);
    writeFileSync(join(dir, "cards/card.tsx"), readFileSync(card));
    writeFileSync(join(dir, "cards/render.tsx"), readFileSync(join(refs, kit, "render.tsx")));
    // tools/render.mjs bundles it once; the bundle is what's timed, so esbuild isn't.
    execFileSync("node", ["tools/render.mjs"], { cwd: dir, stdio: "ignore" });
    const bundle = join(dir, ".cache", readdirSync(join(dir, ".cache")).filter((f) => f.startsWith("render-")).sort().pop());
    const cold = [];
    let last = null;
    for (let i = 0; i < coldRuns; i++) {
      const t0 = performance.now();
      const r = spawnSync("node", ["--input-type=module", "-e", timer, bundle, "0"], { cwd: dir, encoding: "utf8" });
      const wall = performance.now() - t0;
      if (r.status !== 0) throw new Error(`${kit} ${brief}: ${r.stderr.slice(0, 400)}`);
      last = JSON.parse(r.stdout.trim().split("\n").pop());
      cold.push({ wall, ...last });
    }
    const warm = JSON.parse(spawnSync("node", ["--input-type=module", "-e", timer, bundle, String(warmRuns)], { cwd: dir, encoding: "utf8" }).stdout.trim().split("\n").pop());
    facts[kit].briefs[brief] = {
      coldStartMs: +median(cold.map((c) => c.wall)).toFixed(1),
      importMs: +median(cold.map((c) => c.importMs)).toFixed(1),
      firstRenderMs: +median(cold.map((c) => c.firstRenderMs)).toFixed(1),
      warmRenderMs: +median(warm.warm).toFixed(1),
      pngBytes: last.bytes,
      sameBytes: new Set(cold.map((c) => c.sha)).size === 1 && cold[0].sha === warm.sha,
    };
    console.log(`${kit} ${brief}`, facts[kit].briefs[brief]);
  }
  const b = Object.values(facts[kit].briefs);
  facts[kit].median = Object.fromEntries(["coldStartMs", "importMs", "firstRenderMs", "warmRenderMs", "pngBytes"].map((k) => [k, +median(b.map((x) => x[k])).toFixed(1)]));
}

const out = join(bench, "results", `${stamp}-image-runtime.json`);
writeFileSync(out, JSON.stringify({
  stamp,
  machine: { cpu: cpus()[0]?.model, cores: cpus().length, os: `${platform()} ${release()} ${arch()}`, node: process.version },
  engine: JSON.parse(readFileSync(join(bench, "node_modules/@hyper-elements/react/source.json"), "utf8")),
  coldRuns, warmRuns, facts,
}, null, 2) + "\n");
console.log(`\n${out}`);
for (const [kit, f] of Object.entries(facts)) console.log(`${kit.padEnd(10)} ${(f.install.bytes / 1e6).toFixed(1)} MB, ${f.install.packages} packages${f.install.native.length ? ", native" : ""}; cold ${f.median.coldStartMs} ms, warm ${f.median.warmRenderMs} ms`);
