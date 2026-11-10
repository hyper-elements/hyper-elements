// How the skill suite grades a run, from evidence the agent can't write.
//
// - The grading pass: the run's sources rendered in a fresh, pristine directory whose files the render can't change,
//   and only then the checker copied in and run. A checker that exits without its JSON result is a harness error,
//   not the task's failure.
// - Tamper hashes: the run's tools, docs, specs and engine, hashed before and after the session. Any change is
//   `tampered`.
// - The static scan: the sources parsed with TypeScript. A child process, a worker, a write through fs or a hold on the
//   process (process.on, once, exit) is `tampered`; what a template can read that the replay doesn't pin (the clock
//   through `performance`, `process`, `crypto`, a Node module, a path, a stack, a blob URL) is `readsUnpinned`,
//   context for a maintainer, never a mark.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { chmod, cp, mkdir, readdir, readFile, stat } from "node:fs/promises";
import { builtinModules } from "node:module";
import { join, relative } from "node:path";
import ts from "typescript";
import { briefOf, installChecker, kitOf, makeRun, runOf, suiteOf } from "./make-run.mjs";
import { GUARDED } from "./claude.mjs";

const sha256 = (data) => createHash("sha256").update(data).digest("hex");

/** Every file under each of `paths` in `dir` (folders walked, links not followed), as { path: sha256 }. */
async function hashTree(dir, paths) {
  const out = {};
  const walk = async (p) => {
    const full = join(dir, p);
    let s;
    try { s = await stat(full); } catch { return; }
    if (s.isDirectory()) for (const e of (await readdir(full)).sort()) await walk(join(p, e));
    else out[p] = sha256(await readFile(full));
  };
  for (const p of paths) await walk(p);
  return out;
}

/** What tamper hashes cover: what the agent is told not to change (GUARDED, in claude.mjs). */
export { GUARDED };
// node_modules is denied to edits as a whole, and hashed only where the engine is.
export const guardHashes = (dir) => hashTree(dir, GUARDED.map((g) => (g === "node_modules" ? "node_modules/@hyper-elements" : g)));

/** The paths whose hash differs between two `guardHashes`, added or removed. */
export function changedGuards(before, after) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((p) => before[p] !== after[p]).sort();
}

const WRITES = new Set(["writeFile", "appendFile", "createWriteStream", "rename", "unlink", "rm", "rmdir", "mkdir", "copyFile", "cp", "symlink", "truncate", "open"].flatMap((f) => [f, `${f}Sync`]));
const NODE = new Set(builtinModules.flatMap((m) => [m, `node:${m}`]));
const FS = new Set(["fs", "node:fs", "fs/promises", "node:fs/promises"]);
const SPAWNS = new Set(["child_process", "node:child_process", "worker_threads", "node:worker_threads"]);

/**
 * Scans the sources (`{ path: text }`) with TypeScript's parser: `tampered`, the calls and imports no template needs,
 * and `readsUnpinned`, what it reads that the replay doesn't pin. It looks at calls and imports, never at text, so copy
 * that says "rm" passes, and so does a template reading its fonts with fs.
 */
export function scanSources(sources) {
  const tampered = [], readsUnpinned = [];
  for (const [file, text] of Object.entries(sources)) {
    if (!/\.[cm]?[jt]sx?$/.test(file)) continue;
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const at = (node) => `${file}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`;
    const modules = [];
    const fsNames = new Set();
    // First the imports: which modules, and the names fs's functions go by here.
    const imports = (node) => {
      let spec = null;
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        spec = node.moduleSpecifier.text;
        const clause = node.importClause;
        if (FS.has(spec) && clause) {
          if (clause.name) fsNames.add(clause.name.text);
          const b = clause.namedBindings;
          if (b && ts.isNamespaceImport(b)) fsNames.add(b.name.text);
          if (b && ts.isNamedImports(b)) for (const e of b.elements) if (WRITES.has((e.propertyName ?? e.name).text)) fsNames.add(`=${e.name.text}`);
        }
      } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) spec = node.moduleSpecifier.text;
      else if (ts.isCallExpression(node) && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])
        && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require"))) {
        spec = node.arguments[0].text;
        if (FS.has(spec) && ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) fsNames.add(node.parent.name.text);
      } else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require"))) {
        tampered.push(`${at(node)}: an import of a computed module`);
      }
      if (spec !== null) modules.push([spec, node]);
      ts.forEachChild(node, imports);
    };
    imports(sf);
    for (const [spec, node] of modules) {
      if (SPAWNS.has(spec)) tampered.push(`${at(node)}: imports ${spec}`);
      else if (NODE.has(spec)) readsUnpinned.push(`${at(node)}: imports ${spec}`);
    }
    // Then every call and reference.
    const visit = (node) => {
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        if (ts.isPropertyAccessExpression(callee)) {
          const obj = callee.expression, name = callee.name.text;
          if (ts.isIdentifier(obj) && obj.text === "process" && ["on", "once", "exit", "addListener", "prependListener"].includes(name)) tampered.push(`${at(node)}: process.${name}()`);
          if (WRITES.has(name) && ts.isIdentifier(obj) && fsNames.has(obj.text)) tampered.push(`${at(node)}: ${obj.text}.${name}()`);
          if (WRITES.has(name) && ts.isPropertyAccessExpression(obj) && ts.isIdentifier(obj.expression) && fsNames.has(obj.expression.text) && obj.name.text === "promises") tampered.push(`${at(node)}: ${obj.expression.text}.promises.${name}()`);
          if (name === "createObjectURL" && ts.isIdentifier(obj) && obj.text === "URL") readsUnpinned.push(`${at(node)}: URL.createObjectURL()`);
        } else if (ts.isIdentifier(callee) && fsNames.has(`=${callee.text}`)) tampered.push(`${at(node)}: ${callee.text}()`);
      }
      if (ts.isIdentifier(node) && ["performance", "process", "crypto", "__dirname", "__filename"].includes(node.text)) {
        const p = node.parent;
        // A name in its own right (`x.process`, `{ process: 1 }`, a declaration), not a reference to the global.
        const isName = (ts.isPropertyAccessExpression(p) && p.name === node) || (ts.isPropertyAssignment(p) && p.name === node)
          || (ts.isBindingElement(p) && (p.propertyName === node || p.name === node)) || (ts.isVariableDeclaration(p) && p.name === node)
          || (ts.isParameter(p) && p.name === node) || ts.isImportSpecifier(p) || (ts.isJsxAttribute(p) && p.name === node)
          || (ts.isPropertySignature(p) && p.name === node) || (ts.isMethodDeclaration(p) && p.name === node);
        if (!isName) readsUnpinned.push(`${at(node)}: ${node.text}`);
      }
      if (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword) readsUnpinned.push(`${at(node)}: import.meta`);
      if (ts.isPropertyAccessExpression(node) && node.name.text === "stack") readsUnpinned.push(`${at(node)}: .stack`);
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return { tampered: [...new Set(tampered)], readsUnpinned: [...new Set(readsUnpinned)] };
}

/** Every file under each of a kit's `sources` ("src/", or a path), as { path: text }. */
export async function sourcesOf(dir, sources) {
  const files = [];
  for (const f of sources) {
    if (!f.endsWith("/")) { if (existsSync(join(dir, f))) files.push(f); continue; }
    if (!existsSync(join(dir, f))) continue;
    for (const e of await readdir(join(dir, f), { recursive: true, withFileTypes: true })) if (e.isFile()) files.push(relative(dir, join(e.parentPath ?? e.path, e.name)));
  }
  return Object.fromEntries(await Promise.all(files.sort().map(async (f) => [f, await readFile(join(dir, f), "utf8")])));
}

function sh(cmd, args, opts) {
  return new Promise((done) => {
    const p = spawn(cmd, args, { ...opts, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    const t = opts.timeout ? setTimeout(() => p.kill("SIGKILL"), opts.timeout) : null;
    p.on("close", (code, signal) => (t && clearTimeout(t), done({ code, signal, out, err })));
  });
}

/** Read-only, recursively, except the folders in `keep` (links aren't followed). */
async function lock(dir, keep) {
  const walk = async (p) => {
    const s = await stat(p).catch(() => null);
    if (!s) return;
    if (s.isDirectory()) {
      if (keep.includes(p)) return;
      for (const e of await readdir(p)) await walk(join(p, e));
      await chmod(p, 0o555);
    } else await chmod(p, s.mode & 0o555);
  };
  await walk(dir);
}

/** Makes everything under `dir` writable again (to remove it). */
export async function unlock(dir) {
  const walk = async (p) => {
    const s = await stat(p).catch(() => null);
    if (!s) return;
    await chmod(p, s.isDirectory() ? 0o755 : s.mode | 0o200);
    if (s.isDirectory()) for (const e of await readdir(p)) await walk(join(p, e));
  };
  await walk(dir);
}

/**
 * The grading pass. A fresh run directory of the same kit and brief, with no checker yet; the session's sources copied
 * in; everything but out/ and .cache/ made read-only; the render run as a child process; and only after it exits the
 * checker files and specs copied in and run. Returns what the render printed and found, and the checker's verdict:
 * `pass` (rendered with no errors, and every check passed), or `harnessError` when the checker gave no JSON result.
 */
export async function gradingPass({ suite = "skill", kit, brief, sourcesFrom, root, extra = {}, env = process.env, timeoutMs = 240_000 }) {
  const s = await suiteOf(suite);
  const k = await kitOf(suite, kit);
  const b = await briefOf(suite, brief);
  const run = runOf(s, k, b);
  const dir = await makeRun(suite, kit, brief, "grade", root, { isolated: true, checker: false });
  const sources = await sourcesOf(sourcesFrom, run.sources);
  for (const f of Object.keys(sources)) {
    await mkdir(join(dir, f, ".."), { recursive: true });
    await cp(join(sourcesFrom, f), join(dir, f));
  }
  await mkdir(join(dir, "out"), { recursive: true });
  await mkdir(join(dir, ".cache"), { recursive: true });
  await lock(dir, [join(dir, "out"), join(dir, ".cache")]);
  const render = await sh(process.execPath, run.render, { cwd: dir, env, timeout: timeoutMs });
  // Only now, the checker: a template's code can't replace a checker that isn't there yet.
  await chmod(dir, 0o755);
  await unlock(join(dir, "tools"));
  await installChecker(dir, s, run, b, extra);
  const diagnostics = existsSync(join(dir, "out/diagnostics.json")) ? JSON.parse(await readFile(join(dir, "out/diagnostics.json"), "utf8")) : null;
  const result = { dir, sources: Object.keys(sources), render: { code: render.code, signal: render.signal, out: render.out.slice(-4000), err: render.err.slice(-4000) }, diagnostics };
  if (render.code !== 0) return { ...result, pass: false, rendered: false, failed: ["render: the sources don't render"] };
  const check = await sh(process.execPath, ["tools/check.mjs", "--json"], { cwd: dir, env, timeout: timeoutMs });
  let verdict = null;
  try { verdict = JSON.parse(check.out.trim().split("\n").pop()); } catch {}
  if (!verdict || !Array.isArray(verdict.results)) return { ...result, rendered: true, pass: false, harnessError: `the checker gave no result: ${(check.err || check.out).slice(-600)}` };
  return {
    ...result, rendered: true, pass: !!verdict.pass, verdict,
    failed: verdict.results.filter((r) => !r.ok).map((r) => `${r.name}: ${r.detail}`),
    warningsLeft: diagnostics ? diagnostics.filter((d) => d.severity === "warning").length : null,
  };
}
