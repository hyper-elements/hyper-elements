// Installs Hyper Elements for the benchmark, from a built checkout of the engine.
//
//   HYPER_ELEMENTS_PACKAGE=/path/to/checkout/packages/react node lib/setup.mjs
//     into node_modules, under its published name (the email and image suites)
//   HYPER_ELEMENTS_PACKAGE=/path/to/checkout/packages/react node lib/setup.mjs --as candidate
//     builds the checkout first, then installs it as a named engine, engines/<name>/@hyper-elements/react, with its
//     SKILL.md and a fingerprint of the build's inputs (the skill suite's kits name an engine)
//   node lib/setup.mjs --docs-from v0.3.0 --as release
//     GUIDE.md, REFERENCE.md and SKILL.md as they were at a git ref, into docs-sets/<name>/ (a kit's `docsFrom`)
//
// The first form also installs the checkout's command line, packages/cli, where it's built (the email suite's `he-cli`
// kit runs it): node_modules/@hyper-elements/cli and node_modules/.bin/hyper-elements.
//
// Its dist/ is copied (renamed), its agent guide copied with the package's new name, and the checkout's commit recorded
// (source.json), so every result says which engine code made it.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { chmod, copyFile, cp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deniedPaths } from "./claude.mjs";
import { runRootOf } from "./make-run.mjs";

const bench = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = { "GUIDE.md": "packages/react/GUIDE.md", "REFERENCE.md": "packages/react/REFERENCE.md", "SKILL.md": "skills/hyper-elements/SKILL.md" };
const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const git = (cwd, ...args) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", maxBuffer: 1 << 28 }).trim();
/** The old package name, in builds and docs from before the rename. */
const renamed = (text) => text.replaceAll("@unlayer/react-elements", "@hyper-elements/react");
const docText = (text) => renamed(text).replace(/^<!-- Written from the component definitions.*\n/m, "");

/**
 * What a candidate engine was built from: the commit, the uncommitted changes and the untracked files, over the whole
 * repository except what no package build reads (apps/, examples/, tests/ and the benchmark itself, whose runs and
 * results change between batches). The root build configuration (tsconfig.base.json, package.json, pnpm-lock.yaml) is
 * in scope. The harness computes it again before a batch and refuses a `candidate` engine whose fingerprint differs.
 */
export function fingerprint(checkout) {
  const scope = ["--", ".", ":(exclude)apps", ":(exclude)examples", ":(exclude)tests", ":(exclude)benchmark"];
  const h = createHash("sha256");
  h.update(git(checkout, "rev-parse", "HEAD") + "\n");
  h.update(git(checkout, "diff", "HEAD", "--binary", ...scope) + "\n");
  for (const f of git(checkout, "ls-files", "--others", "--exclude-standard", "-z", ...scope).split("\0").filter(Boolean).sort()) {
    h.update(`${f}\0`);
    h.update(readFileSync(join(checkout, f)));
  }
  return h.digest("hex");
}

/** Where the skill suite's sessions find Playwright's browsers: .browsers at the run root. */
export function browsersPath() {
  return join(runRootOf(process.env.BENCH_RUN_ROOT, deniedPaths(bench)), ".browsers");
}

/** Every file under a folder, as { path: sha256 }. */
export async function hashes(dir, prefix = "") {
  const out = {};
  for (const e of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = join(dir, e.name);
    if (e.isDirectory()) Object.assign(out, await hashes(p, `${prefix}${e.name}/`));
    else out[`${prefix}${e.name}`] = sha256(await readFile(p));
  }
  return out;
}

/** Copies a built packages/react into `dest` under the published name. */
async function install(src, dest, { skill } = {}) {
  await rm(dest, { recursive: true, force: true });
  await mkdir(join(dest, "dist"), { recursive: true });
  // A copy, not a link: a run's node_modules is a copy of this one, and nothing in it may point back into the checkout
  // (an agent could follow a link to the engine's source or the benchmark's own files). The entries import the main
  // one by the package's name; renamed here, it's the same file under the published name.
  for (const f of await readdir(join(src, "dist"))) {
    const from = join(src, "dist", f);
    if (/\.(js|cjs|d\.ts|d\.cts)$/.test(f)) await writeFile(join(dest, "dist", f), renamed(await readFile(from, "utf8")));
    else await copyFile(from, join(dest, "dist", f));
  }
  const { version } = JSON.parse(await readFile(join(src, "package.json"), "utf8"));
  const entry = (name) => ({ types: `./dist/${name}.d.ts`, import: `./dist/${name}.js`, require: `./dist/${name}.cjs` });
  // `inspect` too: the command line reads a template's root with it.
  const entries = ["image", "pdf", "builder", "inspect"].filter((e) => existsSync(join(src, "dist", `${e}.js`)));
  await writeFile(join(dest, "package.json"), JSON.stringify({
    name: "@hyper-elements/react", version,
    exports: { ".": entry("primitives"), ...Object.fromEntries(entries.map((e) => [`./${e}`, entry(e)])), "./package.json": "./package.json" },
    peerDependencies: { react: ">=18", "react-dom": ">=18", satori: "^0.33.5", "@resvg/resvg-js": "^2.6.2", "@react-pdf/renderer": "^4.9.0" },
  }, null, 2));
  for (const f of ["GUIDE.md", "REFERENCE.md"]) await writeFile(join(dest, f), docText(await readFile(join(src, f), "utf8")));
  if (skill) await writeFile(join(dest, "SKILL.md"), docText(await readFile(skill, "utf8")));
  return version;
}

/**
 * Copies a built packages/cli into node_modules, its bin linked from node_modules/.bin (a link inside node_modules,
 * which a run's copy keeps). Its dependencies are the benchmark's own: tsx and TypeScript (playwright-core and
 * @hyper-elements/email-clients serve what the kit doesn't run: drawn previews and HTML emails).
 */
export async function installCli(src, nodeModules) {
  const dest = join(nodeModules, "@hyper-elements/cli");
  await rm(dest, { recursive: true, force: true });
  await cp(join(src, "dist"), join(dest, "dist"), { recursive: true });
  const { name, version, type, bin, engines } = JSON.parse(await readFile(join(src, "package.json"), "utf8"));
  await writeFile(join(dest, "package.json"), JSON.stringify({ name, version, type, bin, engines }, null, 2));
  await mkdir(join(nodeModules, ".bin"), { recursive: true });
  for (const [command, file] of Object.entries(bin)) {
    await chmod(join(dest, file), 0o755);
    await rm(join(nodeModules, ".bin", command), { force: true });
    await symlink(join("..", "@hyper-elements/cli", file), join(nodeModules, ".bin", command));
  }
  return version;
}

async function main() {
  const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : undefined; };
  const as = arg("as");
  const docsFrom = arg("docs-from");
  if (as !== undefined && !/^[a-z0-9][a-z0-9-]*$/.test(as)) throw new Error(`--as takes a name like "candidate" (got ${as})`);

  if (process.argv.includes("--browsers")) {
    // Playwright's Chromium at the run root (BENCH_RUN_ROOT/.browsers), where a sandboxed session can read it: its
    // usual place is under the home folder, which the sessions are denied.
    const browsers = browsersPath();
    execFileSync("npx", ["playwright", "install", "chromium"], { cwd: bench, stdio: "inherit", env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browsers } });
    console.log(`Chromium → ${browsers}`);
    return;
  }

  if (docsFrom) {
    // Docs from a git ref: fixed by the ref, so no fingerprint.
    if (!as) throw new Error("--docs-from needs --as <name>");
    const dest = join(bench, "docs-sets", as);
    await rm(dest, { recursive: true, force: true });
    await mkdir(dest, { recursive: true });
    const commit = git(bench, "rev-parse", `${docsFrom}^{commit}`);
    const files = {};
    for (const [name, path] of Object.entries(DOCS)) {
      const text = docText(git(bench, "show", `${commit}:${path}`) + "\n");
      await writeFile(join(dest, name), text);
      files[name] = sha256(text);
    }
    await writeFile(join(dest, "source.json"), JSON.stringify({ name: as, ref: docsFrom, commit, files }, null, 2) + "\n");
    console.log(`docs ${docsFrom} (${commit.slice(0, 10)}) → ${dest}`);
    return;
  }

  const src = process.env.HYPER_ELEMENTS_PACKAGE && resolve(process.env.HYPER_ELEMENTS_PACKAGE);
  if (!src) throw new Error("Set HYPER_ELEMENTS_PACKAGE to a built checkout's packages/react.");

  if (!as) {
    // As before: into node_modules, for the email and image suites.
    const dest = join(bench, "node_modules/@hyper-elements/react");
    const version = await install(src, dest);
    let source = { version };
    try { source = { version, commit: git(src, "rev-parse", "HEAD"), dirty: git(src, "status", "--porcelain", "--", ".", "../internal/core").length > 0 }; } catch {}
    await writeFile(join(dest, "source.json"), JSON.stringify(source, null, 2) + "\n");
    console.log(`@hyper-elements/react ${version} (${source.commit?.slice(0, 10) ?? "no git"}${source.dirty ? ", dirty" : ""}) → ${dest}`);
    // The command line, from the same checkout, where it's built.
    const cli = join(src, "..", "cli");
    if (existsSync(join(cli, "dist/bin.js"))) {
      const cliVersion = await installCli(cli, join(bench, "node_modules"));
      let cliSource = { version: cliVersion };
      try { cliSource = { version: cliVersion, commit: git(cli, "rev-parse", "HEAD"), dirty: git(cli, "status", "--porcelain", "--", ".", "../internal/template-loader").length > 0 }; } catch {}
      await writeFile(join(bench, "node_modules/@hyper-elements/cli/source.json"), JSON.stringify(cliSource, null, 2) + "\n");
      console.log(`@hyper-elements/cli ${cliVersion} → ${join(bench, "node_modules/@hyper-elements/cli")}`);
    } else {
      console.log(`No built @hyper-elements/cli at ${cli} (run pnpm build): the he-cli kit can't run without it.`);
    }
    return;
  }

  // A named engine: built first, so no batch runs on an old or partial build.
  const checkout = git(src, "rev-parse", "--show-toplevel");
  const root = join(bench, "engines", as);
  const dest = join(root, "@hyper-elements/react");
  try {
    execFileSync("pnpm", ["build"], { cwd: checkout, stdio: "inherit" });
    const before = fingerprint(checkout);
    const version = await install(src, dest, { skill: join(checkout, DOCS["SKILL.md"]) });
    if (fingerprint(checkout) !== before) throw new Error("the checkout changed while it was being installed");
    const source = {
      name: as, version, commit: git(checkout, "rev-parse", "HEAD"),
      dirty: git(checkout, "status", "--porcelain", "--", ".", ":(exclude)apps", ":(exclude)examples", ":(exclude)tests", ":(exclude)benchmark").length > 0,
      checkout, fingerprint: before,
      dist: await hashes(join(dest, "dist")),
      docs: Object.fromEntries(await Promise.all(["GUIDE.md", "REFERENCE.md", "SKILL.md"].map(async (f) => [f, sha256(await readFile(join(dest, f)))]))),
    };
    await writeFile(join(root, "source.json"), JSON.stringify(source, null, 2) + "\n");
    console.log(`engine ${as}: @hyper-elements/react ${version} (${source.commit.slice(0, 10)}${source.dirty ? ", dirty" : ""}) → ${dest}`);
  } catch (e) {
    await rm(root, { recursive: true, force: true });
    console.error(`setup --as ${as} failed: ${e.message}`);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
