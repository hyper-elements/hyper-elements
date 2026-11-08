// Makes a fresh run directory: runs/<kit>__<brief>__<rep>/, the kit's files plus the brief and the checker.
//   node lib/make-run.mjs <suite> <kit> <brief> [rep] [root]
//
// What a suite adds is in suites/<suite>/suite.json (the prompt, the checker's files, folders copied into each run);
// what a kit adds in its kit.json (the files the agent writes, the docs it imports). Neither JSON file is copied.
import { execFileSync } from "node:child_process";
import { readdirSync, readlinkSync, realpathSync } from "node:fs";
import { cp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const bench = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// The images the email briefs use are the site's own (public/img), served to the checker as assets.orbit.dev.
export const ASSETS = join(bench, "..", "public", "img");

export async function suiteOf(suite) {
  const dir = join(bench, "suites", suite);
  return { dir, ...JSON.parse(await readFile(join(dir, "suite.json"), "utf8")) };
}

export async function kitOf(suite, kit) {
  const dir = join(bench, "suites", suite, "kits", kit);
  return { dir, docs: [], ...JSON.parse(await readFile(join(dir, "kit.json"), "utf8")) };
}

/**
 * `isolated`: a real copy of node_modules instead of a link to the benchmark's, for agent runs (which run outside the
 * repository, so no solution is in reach). The checker's own runs (selftest, runtime facts) keep the link.
 */
export async function makeRun(suite, kit, briefId, rep, root = join(bench, "runs"), { isolated = false } = {}) {
  const s = await suiteOf(suite);
  const k = await kitOf(suite, kit);
  const brief = JSON.parse(await readFile(join(s.dir, "briefs", `${briefId}.json`), "utf8"));
  const dir = join(root, `${kit}__${briefId}__${rep}`);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  await cp(k.dir, dir, { recursive: true, filter: (f) => basename(f) !== "kit.json" });
  await mkdir(join(dir, "tools"), { recursive: true });
  // A kit's docs (Hyper Elements' agent guide), from the installed package, as its docs tell users to set it up.
  if (k.docs.length) {
    await mkdir(join(dir, "docs"), { recursive: true });
    for (const f of k.docs) await cp(join(bench, "node_modules/@hyper-elements/react", f), join(dir, "docs", f));
  }
  // The suite's own folders (fonts, images, tools), without their manifests and the scripts that made them. A folder
  // may be another suite's ("../image/fonts"): it's copied under its own name.
  for (const folder of s.folders ?? []) await cp(join(s.dir, folder), join(dir, basename(folder)), { recursive: true, filter: (f) => !["MANIFEST.json", "make.mjs"].includes(basename(f)) });
  // The checker's files: a path (copied into tools/), or { from, to } (to a path in the run, another suite's file or a
  // subfolder of tools/).
  for (const f of s.checker) {
    const { from, to } = typeof f === "string" ? { from: f, to: join("tools", basename(f)) } : f;
    const text = (await readFile(join(s.dir, from), "utf8")).replace('"__ASSETS__"', JSON.stringify(ASSETS));
    await mkdir(dirname(join(dir, to)), { recursive: true });
    await writeFile(join(dir, to), text);
  }
  await mkdir(join(dir, "out"), { recursive: true });
  await writeSpecs(s, brief.specs ?? brief.spec, dir);
  await writeFile(join(dir, "BRIEF.md"), `# ${brief.title}\n\n${brief.brief}\n`);
  await writeFile(join(dir, "package.json"), JSON.stringify({ name: s.packageName ?? suite, private: true, ...(s.moduleType ? { type: s.moduleType } : {}) }, null, 2) + "\n");
  if (isolated) cloneTree(join(bench, "node_modules"), join(dir, "node_modules"));
  else await symlink(join(bench, "node_modules"), join(dir, "node_modules"));
  return dir;
}

/**
 * A copy of a folder that costs next to nothing where the filesystem clones files (APFS on macOS, Btrfs or XFS with
 * reflinks on Linux), else a plain copy. Links are kept as links (`node_modules/.bin`'s scripts find their packages
 * through them), and every one must point inside the copy: one pointing out is an error, not a way back.
 */
function cloneTree(from, to) {
  if (process.platform === "darwin") execFileSync("cp", ["-cR", from, to]);
  else execFileSync("cp", ["-R", "--reflink=auto", from, to]);
  const root = realpathSync(to);
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isSymbolicLink()) {
        const target = resolve(dirname(p), readlinkSync(p));
        if (!target.startsWith(to + "/") && !target.startsWith(root + "/")) throw new Error(`${p} links out of the run's node_modules, to ${target}`);
      } else if (e.isDirectory()) walk(p);
    }
  };
  walk(to);
}

/** A brief's spec: one, in tools/spec.json, or one per output, each where the suite's `specs` says. */
async function writeSpecs(s, specs, dir) {
  if (!s.specs) return writeFile(join(dir, "tools", "spec.json"), JSON.stringify(specs, null, 2));
  for (const [part, to] of Object.entries(s.specs)) {
    if (!specs[part]) throw new Error(`the brief has no spec for ${part}`);
    await mkdir(dirname(join(dir, to)), { recursive: true });
    await writeFile(join(dir, to), JSON.stringify(specs[part], null, 2));
  }
}

/** Phase 2 of a suite with changes: CHANGES.md and the changed specs, written into a finished run. */
export async function applyChanges(suite, briefId, dir) {
  const s = await suiteOf(suite);
  const brief = JSON.parse(await readFile(join(s.dir, "briefs", `${briefId}.json`), "utf8"));
  if (!brief.changes) throw new Error(`${briefId} has no changes`);
  await writeFile(join(dir, "CHANGES.md"), `# ${brief.changes.title}\n\n${brief.changes.brief}\n`);
  await writeSpecs(s, brief.changes.specs, dir);
}

export async function briefsOf(suite) {
  const s = await suiteOf(suite);
  return (await readdir(join(s.dir, "briefs"))).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [suite, kit, brief, rep = "0", root] = process.argv.slice(2);
  console.log(await makeRun(suite, kit, brief, rep, root && resolve(root)));
}
