// The image checker's own test, before any agent runs (no API):
//
//   node suites/image/check/selftest.mjs [--only refs,perturb,negative] [--kits he,satori,vercel-og] [--briefs blog,quote]
//
// 1. refs: each kit's reference solution of each brief (suites/image/reference) must pass every check.
// 2. perturb: the references with font sizes and padding changed, words intact: OCR must read ≥ 99% of the texts.
// 3. negative: references broken on purpose (a typo, invisible text, a wrong color, size or font, a square avatar, a
//    PNG not written by the render tool…) must each fail the check named, so a green check means it can see each.
import { spawn } from "node:child_process";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { briefsOf, makeRun } from "../../../lib/make-run.mjs";

const bench = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const refs = join(bench, "suites/image/reference");
const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : def; };
const only = arg("only", "refs,perturb,negative").split(",");
const kits = arg("kits", "he,playwright,canvas").split(",");
const briefs = arg("briefs", "all") === "all" ? await briefsOf("image") : arg("briefs").split(",");
const root = join(bench, "runs", "selftest");
await rm(root, { recursive: true, force: true });

function sh(cmd, args, cwd) {
  return new Promise((done) => {
    const p = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => done({ code, out, err }));
  });
}

const cardOf = async (kit, brief) => {
  const own = join(refs, kit, brief, "card.tsx");
  // The Playwright kit draws the Satori cards (HTML and CSS) where it has none of its own.
  return readFile(existsSync(own) ? own : join(refs, "satori", brief, "card.tsx"), "utf8");
};

/** Renders a kit's reference of a brief, edited, in a fresh run directory, and checks it: { render, check }. */
async function attempt(name, kit, brief, { card = (s) => s, render = (s) => s, after, isolated = false } = {}) {
  const base = isolated ? mkdtempSync(join(tmpdir(), "selftest-")) : root;
  const dir = await makeRun("image", kit, brief, name, base, { isolated });
  await mkdir(join(dir, "cards"), { recursive: true });
  await writeFile(join(dir, "cards/card.tsx"), card(await cardOf(kit, brief)));
  await writeFile(join(dir, "cards/render.tsx"), render(await readFile(join(refs, kit, "render.tsx"), "utf8")));
  // In a run as an agent gets it (isolated): the commands CLAUDE.md names must work, `npx tsc` among them.
  const tsc = isolated ? await sh("npx", ["tsc", "--noEmit"], dir) : null;
  const r = await sh("node", ["tools/render.mjs"], dir);
  if (after) await after(dir);
  const c = await sh("node", ["tools/check.mjs", "--json"], dir);
  let check = null;
  try { check = JSON.parse(c.out.trim().split("\n").pop()); } catch {}
  if (isolated) await rm(base, { recursive: true, force: true });
  return { dir, tsc, render: r, check };
}

/** A replacement that must apply: a broken negative control must not pass by not breaking anything. */
const sub = (from, to) => (s) => {
  if (!s.includes(from)) throw new Error(`selftest: "${from}" isn't in the reference`);
  return s.replaceAll(from, to);
};

let failures = 0;
const fail = (msg) => { failures++; console.log(`  ✗ ${msg}`); };

if (only.includes("refs")) {
  console.log("References, each in a run as an agent gets it: they type-check, render and pass every check.");
  for (const brief of briefs) for (const kit of kits) {
    const { tsc, render, check } = await attempt("ref", kit, brief, { isolated: true });
    if (tsc.code !== 0) { fail(`${kit} ${brief}: npx tsc --noEmit failed: ${(tsc.out + tsc.err).slice(0, 300)}`); continue; }
    if (render.code !== 0) { fail(`${kit} ${brief}: the render failed: ${render.err.slice(0, 300)}`); continue; }
    if (!check?.pass) fail(`${kit} ${brief}: ${check ? check.results.filter((r) => !r.ok).map((r) => `${r.name} — ${r.detail}`).join(" | ") : "the check didn't run"}`);
    else console.log(`  ✓ ${kit} ${brief} (${check.total} checks, OCR passes ${check.measures.ocrPasses})`);
  }
}

if (only.includes("perturb")) {
  console.log("Perturbed references: OCR must read the texts (≥ 99%).");
  const scale = (k) => (s) => s.replace(/fontSize: (\d+)/g, (_, n) => `fontSize: ${Math.round(n * k)}`);
  const pad = (d) => (s) => s.replace(/padding: (64|72|80)\b/g, (_, n) => `padding: ${Number(n) + d}`);
  const variants = { "size0.9": scale(0.9), "size0.95": scale(0.95), "size1.05": scale(1.05), "size1.1": scale(1.1), "pad-16": pad(-16), "pad+16": pad(16) };
  let read = 0, total = 0;
  for (const brief of briefs) for (const kit of kits.filter((k) => k !== "vercel-og")) for (const [name, edit] of Object.entries(variants)) {
    const { render, check } = await attempt(`p-${name}`, kit, brief, { card: edit });
    if (render.code !== 0) { console.log(`  · ${kit} ${brief} ${name}: didn't render (${render.err.split("\n")[0].slice(0, 120)})`); continue; }
    for (const [k, v] of Object.entries(check?.measures ?? {})) {
      if (!k.startsWith("ocr:")) continue;
      const [m, n] = v.split("/").map(Number);
      total++;
      if (m >= Math.ceil(0.9 * n)) read++;
      else console.log(`  · ${kit} ${brief} ${name}: OCR read ${v} words of "${k.slice(4)}"`);
    }
  }
  const rate = read / Math.max(1, total);
  console.log(`  OCR read ${read} of ${total} texts (${(rate * 100).toFixed(1)}%).`);
  if (rate < 0.99) fail(`OCR read ${(rate * 100).toFixed(1)}% of perturbed texts, under 99%`);
}

if (only.includes("negative")) {
  console.log("Negative controls: each must fail the check named.");
  const controls = [
    { name: "a one-letter typo", kit: "playwright", brief: "blog", card: sub("times in half", "times in hall"), expect: /^copy "title"/ },
    { name: "text in the background's color", kit: "playwright", brief: "blog", card: sub('lineHeight: 1.15, color: "#ffffff"', 'lineHeight: 1.15, color: "#0f172a"'), expect: /^shows "title"/ },
    { name: "text near an edge", kit: "he", brief: "event", card: sub("padding: 64,", "padding: [64, 64, 64, 16],"), expect: /^shows "(eyebrow|title|date)"/ },
    { name: "a title over the author", kit: "playwright", brief: "blog", card: sub('lineHeight: 1.15, color: "#ffffff" }}', 'lineHeight: 1.15, color: "#ffffff", position: "absolute", top: 380, left: 80 }}'), expect: /^(no overlapping text|"title" above "name")/ },
    { name: "the wrong background", kit: "he", brief: "blog", card: sub('backgroundColor: "#0f172a"', 'backgroundColor: "#111827"'), expect: /^background/ },
    { name: "the wrong size", kit: "playwright", brief: "quote", card: sub("height: 675", "height: 630"), expect: /^size/ },
    { name: "no logo", kit: "playwright", brief: "blog", card: sub('<img src={assets["orbit-logo-white.png"]} width={126} height={64} />', "<div />"), expect: /^image "logo"/ },
    { name: "the logo at 200px", kit: "he", brief: "quote", card: sub("style={{ width: 100, flex", "style={{ width: 160, flex"), expect: /^image "logo"/ },
    { name: "a square avatar", kit: "playwright", brief: "blog", card: sub("style={{ borderRadius: 32 }}", ""), expect: /^image "avatar"/ },
    { name: "a pill in the wrong color", kit: "he", brief: "launch", card: sub('backgroundColor: "#6d5efc"', 'backgroundColor: "#4f46e5"'), expect: /^fill around "cta"/ },
    { name: "Inter where Lora is asked", kit: "playwright", brief: "quote", card: sub('fontFamily: "Lora"', 'fontFamily: "Inter"'), expect: /^font "quote"/ },
    { name: "no bold file", kit: "he", brief: "podcast", render: sub('{ family: "Inter", src: await readFile("fonts/Inter-Bold.ttf"), weight: 700 },', ""), expect: /^font "title"/ },
    // The canvas kit: its text, fonts and colors as drawn.
    { name: "canvas: a one-letter typo", kit: "canvas", brief: "blog", card: sub("times in half", "times in hall"), expect: /^copy "title"/ },
    { name: "canvas: Inter where Lora is asked", kit: "canvas", brief: "quote", card: sub('family: "Lora", italic: true', 'family: "Inter", italic: true'), expect: /^font "quote"/ },
    { name: "canvas: no bold file", kit: "canvas", brief: "podcast", render: sub('GlobalFonts.registerFromPath("fonts/Inter-Bold.ttf", "Inter");', ""), expect: /^font "(episode|title|show)"/ },
    { name: "canvas: the title in the wrong color", kit: "canvas", brief: "event", card: sub('{ size: 80, weight: 700, color: "#ffffff" }', '{ size: 80, weight: 700, color: "#e5e7eb" }'), expect: /^font "title"/ },
    { name: "canvas: the logo left out", kit: "canvas", brief: "blog", card: sub('image(ctx, await load("orbit-logo-white.png"), P, P, 126, 64);', ""), expect: /^image "logo"/ },
    // The Playwright kit: what the page shows, its font files, and the network off.
    { name: "playwright: a font from the network", kit: "playwright", brief: "blog", render: sub('url(data:font/ttf;base64,${(await readFile(`fonts/${file}`)).toString("base64")})', 'url(https://fonts.gstatic.com/s/inter/v13/${file})'), expect: /^font "/ },
    { name: "playwright: no @font-face (the system's fonts)", kit: "playwright", brief: "podcast", render: sub('`@font-face { font-family: "${family}"', '`@font-face { font-family: "${family}-unused"'), expect: /^font "/ },
    { name: "playwright: text hidden with CSS", kit: "playwright", brief: "quote", card: sub('<div style={{ display: "flex", fontSize: 24, color: "#6b7280" }}>', '<div style={{ display: "none", fontSize: 24, color: "#6b7280" }}>'), expect: /^copy "role"/ },
    { name: "a PNG not written by the render", kit: "he", brief: "launch", after: (dir) => copyFile(join(dir, "assets/orbit-card-bg.png"), join(dir, "out/card.png")), expect: /^rendered by tools\/render\.mjs/ },
  ];
  for (const c of controls) {
    const { render, check } = await attempt(`n-${c.name.replace(/\W+/g, "-")}`, c.kit, c.brief, c);
    const failed = check?.results?.filter((r) => !r.ok) ?? [];
    if (!check) fail(`${c.name}: the check didn't run (render: ${render.err.slice(0, 200)})`);
    else if (failed.some((r) => c.expect.test(r.name))) console.log(`  ✓ ${c.name}: ${failed.filter((r) => c.expect.test(r.name)).map((r) => `${r.name} — ${r.detail}`)[0]}`);
    else fail(`${c.name}: passed${failed.length ? ` (failed only ${failed.map((r) => r.name).join(", ")})` : ""}`);
  }
}

console.log(failures ? `\n${failures} selftest failure(s).` : "\nSelftest passed.");
process.exit(failures ? 1 : 0);
