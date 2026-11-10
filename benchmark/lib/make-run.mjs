// Makes a fresh run directory: runs/<kit>__<brief>__<rep>/, the kit's files plus the brief and the checker.
//   node lib/make-run.mjs <suite> <kit> <brief> [rep] [root]
//
// What a suite adds is in suites/<suite>/suite.json (the prompt, the checker's files, folders copied into each run);
// what a kit adds in its kit.json (the files the agent writes, the docs it imports, and for the skill suite the engine,
// the docs set and whether the Skill tool is allowed); what a brief changes in its `run` (`runOf`). No JSON file of
// the suite's is copied.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readlinkSync, realpathSync } from "node:fs";
import { cp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const bench = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// The images the email briefs use are the website's own (apps/website/public/img), served to the checker as assets.orbit.dev.
export const ASSETS = join(bench, "..", "apps", "website", "public", "img");
export const ENGINES = join(bench, "engines");
export const DOCS_SETS = join(bench, "docs-sets");

/**
 * The folder runs are made in while their session lasts: `fromEnv` (BENCH_RUN_ROOT), else the system's temporary
 * folder. One under a path the sessions are denied (on Linux the temporary folder is /tmp) is refused.
 */
export function runRootOf(fromEnv, denied) {
  const root = resolve(fromEnv || tmpdir());
  let real = root;
  try { real = realpathSync(root); } catch {}
  const under = denied.find((d) => [root, real].some((p) => p === d || p.startsWith(d.replace(/\/$/, "") + "/")));
  if (under) throw new Error(`the run root ${root} is under ${under}, which the sessions can't read. Set BENCH_RUN_ROOT to a folder outside ${under}.`);
  return root;
}

export async function suiteOf(suite) {
  const dir = join(bench, "suites", suite);
  return { dir, ...JSON.parse(await readFile(join(dir, "suite.json"), "utf8")) };
}

/**
 * A kit's settings. One that `extends` another kit is that kit's files and settings, with its own files copied over
 * them and its own settings over theirs (`dirs`: every folder copied, the base first).
 */
export async function kitOf(suite, kit) {
  const dir = join(bench, "suites", suite, "kits", kit);
  const own = JSON.parse(await readFile(join(dir, "kit.json"), "utf8"));
  const base = own.extends ? await kitOf(suite, own.extends) : { docs: [], dirs: [] };
  return { ...base, ...own, dir, dirs: [...base.dirs, dir] };
}

export async function briefOf(suite, briefId) {
  const s = await suiteOf(suite);
  return JSON.parse(await readFile(join(s.dir, "briefs", `${briefId}.json`), "utf8"));
}

/**
 * What a run of this brief with this kit uses: the suite's settings, the kit's sources, and whatever the brief's `run`
 * replaces. `render` is the command's arguments to `node` (the suite's string form is one argument).
 */
export function runOf(s, k, brief) {
  const r = brief.run ?? {};
  const pick = (key, fallback) => (r[key] !== undefined ? r[key] : fallback);
  const render = pick("render", s.render);
  return {
    prompt: pick("prompt", s.prompt),
    render: Array.isArray(render) ? render : [render],
    checker: pick("checker", s.checker),
    folders: pick("folders", s.folders ?? []),
    specs: pick("specs", s.specs),
    sources: pick("sources", k.sources),
    conventions: pick("conventions", s.conventions),
    files: { ...(s.files ?? {}), ...(r.files ?? {}) },
    allowedTools: r.allowedTools ?? [],
    start: r.start ?? {},
    git: !!r.git,
    kits: r.kits ?? null,
    requires: r.requires ?? null,
    startRenders: r.startRenders !== false,
  };
}

/** Where a kit's docs come from: its docs set, else its engine, else the package in node_modules. */
export function docsDirOf(k) {
  if (k.docsFrom) return join(DOCS_SETS, k.docsFrom);
  if (k.engine) return join(ENGINES, k.engine, "@hyper-elements/react");
  return join(bench, "node_modules/@hyper-elements/react");
}

/**
 * `isolated`: a real copy of node_modules instead of a link to the benchmark's, for agent runs (which run outside the
 * repository, so no solution is in reach). The checker's own runs (selftest, runtime facts) keep the link, unless the
 * kit names an engine, which goes over the copy's @hyper-elements/react.
 */
export async function makeRun(suite, kit, briefId, rep, root = join(bench, "runs"), { isolated = false, extra = {}, checker = true } = {}) {
  const s = await suiteOf(suite);
  const k = await kitOf(suite, kit);
  const brief = await briefOf(suite, briefId);
  const run = runOf(s, k, brief);
  const dir = join(root, `${kit}__${briefId}__${rep}`);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  for (const from of k.dirs) await cp(from, dir, { recursive: true, filter: (f) => basename(f) !== "kit.json" });
  await mkdir(join(dir, "tools"), { recursive: true });
  // A kit's docs (Hyper Elements' agent guide), from the installed package, its engine or its docs set, as its docs
  // tell users to set it up.
  const docsDir = docsDirOf(k);
  if (k.docs.length) {
    await mkdir(join(dir, "docs"), { recursive: true });
    for (const f of k.docs) await cp(join(docsDir, f), join(dir, "docs", f));
  }
  // The skill, where a project's skills are (Claude Code loads them with --setting-sources project).
  if (k.allowSkill) {
    await mkdir(join(dir, ".claude/skills/hyper-elements"), { recursive: true });
    await cp(join(docsDir, "SKILL.md"), join(dir, ".claude/skills/hyper-elements/SKILL.md"));
  }
  // The conventions (CLAUDE.md), the same in every kit of a suite apart from the guide's import.
  if (run.conventions) {
    const text = await readFile(join(s.dir, run.conventions), "utf8");
    await writeFile(join(dir, "CLAUDE.md"), text.trimEnd() + "\n" + (k.docs.includes("GUIDE.md") ? "\n@docs/GUIDE.md\n" : ""));
  }
  // The suite's own folders (fonts, images, tools), without their manifests and the scripts that made them. A folder
  // may be another suite's ("../image/fonts"): it's copied under its own name.
  for (const folder of run.folders) await cp(join(s.dir, folder), join(dir, basename(folder)), { recursive: true, filter: (f) => !["MANIFEST.json", "make.mjs"].includes(basename(f)) });
  // Then its files, each at its path, over a folder's file of the same name (the skill suite's own image render tool).
  for (const [to, from] of Object.entries(run.files)) {
    await mkdir(dirname(join(dir, to)), { recursive: true });
    await cp(join(s.dir, from), join(dir, to));
  }
  // The images an email brief names, copied into the run (images/), so its checker reads nothing outside it.
  if (s.ownAssets) {
    const assets = join(dir, "images");
    const names = [...new Set([...JSON.stringify(brief).matchAll(/assets\.orbit\.dev\/img\/([\w.-]+\.(?:png|jpe?g|gif|webp))/g)].map((m) => m[1]))];
    for (const name of names) {
      if (!existsSync(join(ASSETS, name))) throw new Error(`the brief names ${name}, which isn't in ${ASSETS}`);
      await mkdir(assets, { recursive: true });
      await cp(join(ASSETS, name), join(assets, name));
    }
  }
  await mkdir(join(dir, "out"), { recursive: true });
  if (checker) await installChecker(dir, s, run, brief, extra);
  await writeFile(join(dir, "BRIEF.md"), `# ${brief.title}\n\n${brief.brief}\n`);
  await writeFile(join(dir, "package.json"), JSON.stringify({ name: s.packageName ?? suite, private: true, ...(s.moduleType ? { type: s.moduleType } : {}) }, null, 2) + "\n");
  // Files the session starts from (a template to change), then, for a brief that asks, one commit of them.
  for (const [to, from] of Object.entries(run.start)) {
    await mkdir(dirname(join(dir, to)), { recursive: true });
    await cp(join(s.dir, from), join(dir, to));
  }
  if (run.git) {
    const env = { ...process.env, GIT_AUTHOR_NAME: "Bench", GIT_AUTHOR_EMAIL: "bench@example.com", GIT_AUTHOR_DATE: "2026-01-01T00:00:00Z", GIT_COMMITTER_NAME: "Bench", GIT_COMMITTER_EMAIL: "bench@example.com", GIT_COMMITTER_DATE: "2026-01-01T00:00:00Z" };
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir, env });
    execFileSync("git", ["add", "-A"], { cwd: dir, env });
    execFileSync("git", ["commit", "-q", "-m", "Start"], { cwd: dir, env });
  }
  if (isolated || k.engine) cloneTree(join(bench, "node_modules"), join(dir, "node_modules"));
  else await symlink(join(bench, "node_modules"), join(dir, "node_modules"));
  if (k.engine) {
    const engine = join(ENGINES, k.engine, "@hyper-elements/react");
    if (!existsSync(engine)) throw new Error(`no engine "${k.engine}": install it with \`node lib/setup.mjs --as ${k.engine}\``);
    await rm(join(dir, "node_modules/@hyper-elements/react"), { recursive: true, force: true });
    await mkdir(join(dir, "node_modules/@hyper-elements"), { recursive: true });
    await cp(engine, join(dir, "node_modules/@hyper-elements/react"), { recursive: true });
  }
  return dir;
}

/**
 * The checker, in a run: its files (a path, copied into tools/, or { from, to }, to a path in the run, another suite's
 * file or a subfolder of tools/), the brief's specs, and the files the harness made for this batch (`extra`: task 7's
 * baseline), each at its path. The grading pass installs it only after the render has exited.
 */
export async function installChecker(dir, s, run, brief, extra = {}) {
  const assets = s.ownAssets ? join(dir, "images") : ASSETS;
  for (const f of run.checker) {
    const { from, to } = typeof f === "string" ? { from: f, to: join("tools", basename(f)) } : f;
    const text = (await readFile(join(s.dir, from), "utf8")).replace('"__ASSETS__"', JSON.stringify(assets));
    await mkdir(dirname(join(dir, to)), { recursive: true });
    await writeFile(join(dir, to), text);
  }
  await writeSpecs(run.specs, brief.specs ?? brief.spec, dir);
  for (const [to, from] of Object.entries(extra)) {
    await mkdir(dirname(join(dir, to)), { recursive: true });
    await cp(from, join(dir, to));
  }
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

/**
 * A brief's spec. No `specs`: one, in tools/spec.json. An object: one per output, each where it says. "by-check" (the
 * skill suite): one per check the brief names, `email` in tools/spec.json as the email checker reads it, and each
 * other in tools/checks/<check>/spec.json.
 */
async function writeSpecs(layout, specs, dir) {
  if (!layout) return writeFile(join(dir, "tools", "spec.json"), JSON.stringify(specs, null, 2));
  const to = layout === "by-check"
    ? Object.fromEntries(Object.keys(specs).map((c) => [c, c === "email" ? "tools/spec.json" : `tools/checks/${c}/spec.json`]))
    : layout;
  for (const [part, path] of Object.entries(to)) {
    if (!specs[part]) throw new Error(`the brief has no spec for ${part}`);
    await mkdir(dirname(join(dir, path)), { recursive: true });
    await writeFile(join(dir, path), JSON.stringify(specs[part], null, 2));
  }
}

/** Phase 2 of a suite with changes: CHANGES.md and the changed specs, written into a finished run. */
export async function applyChanges(suite, briefId, dir) {
  const s = await suiteOf(suite);
  const brief = await briefOf(suite, briefId);
  if (!brief.changes) throw new Error(`${briefId} has no changes`);
  await writeFile(join(dir, "CHANGES.md"), `# ${brief.changes.title}\n\n${brief.changes.brief}\n`);
  await writeSpecs(s.specs, brief.changes.specs, dir);
}

/**
 * The briefs `--briefs` selects: "all", a list, or, for a suite with `groups`, a group's name or a list. A suite with
 * groups doesn't take "all" (its migration brief isn't a core task).
 */
export async function briefsOf(suite, selection = "all") {
  const s = await suiteOf(suite);
  const every = (await readdir(join(s.dir, "briefs"))).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort();
  if (s.groups) {
    if (selection === "all") throw new Error(`the ${suite} suite takes a group (${Object.keys(s.groups).join(", ")}) or a list of briefs, not "all"`);
    if (s.groups[selection]) return s.groups[selection];
  } else if (selection === "all") return every;
  const list = selection.split(",");
  const unknown = list.filter((b) => !every.includes(b));
  if (unknown.length) throw new Error(`no brief ${unknown.join(", ")} in the ${suite} suite`);
  return list;
}

/**
 * A batch's jobs, [kit, brief, rep], each kit interleaved so a slow patch of the API doesn't land on one of them. A
 * brief with `run.kits` (`briefKits[brief]`) runs only in those kits, and a task a kit's engine can't run (`na[kit]`)
 * isn't run there.
 */
export function jobsOf(kits, briefs, reps, briefKits = {}, na = {}) {
  const jobs = [];
  for (let rep = 0; rep < reps; rep++) for (const brief of briefs) for (const kit of kits) {
    if (briefKits[brief] && !briefKits[brief].includes(kit)) continue;
    if (na[kit]?.includes(brief)) continue;
    jobs.push([kit, brief, rep]);
  }
  return jobs;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [suite, kit, brief, rep = "0", root] = process.argv.slice(2);
  console.log(await makeRun(suite, kit, brief, rep, root && resolve(root)));
}
