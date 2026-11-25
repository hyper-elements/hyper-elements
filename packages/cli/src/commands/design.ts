/**
 * `design new <template> -o <name.values.json>` and `design set <name.values.json> field=value…`, in the parent: what's
 * given read (the values, each value set, each image's file and source), the template loaded in a child that checks
 * the values in every format and returns the values file, and the file written atomically (nothing written where they
 * fail, unless --draft). Exit 0 written, 1 where the values fail (the file left as it was), 2 where the run can't do
 * what it was asked. With `--json`, one line: the file, its template, what changed, the diagnostics.
 */
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { UsageError, type Args } from "../args";
import { writeAtomically } from "../destinations";
import { displayPath, resolveImport, staticImports, type Input } from "../inputs";
import { cleanFiles, ownToken, parseToken } from "../loader-module";
import { formatDiagnostics } from "../output";
import type { DesignRequest, Diagnostic } from "../protocol";
import { runCapture, runChild, templateChildOptions, type Io, type RunState } from "../run";
import { readTrust, trusted, untrusted } from "../trust";
import { envelopeProblem, templateModule } from "../values-files";

const realOr = (path: string) => {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
};

/** A JSON file's object, or a usage error saying what it's for. */
function readObject(path: string, cwd: string, what: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(resolve(cwd, path), "utf8"));
  } catch (error) {
    throw new UsageError(`${what} ${path}: ${(error as Error).message}`);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new UsageError(`${what} ${path} is a JSON object`);
  return value as Record<string, unknown>;
}

/** `field=value`'s value: `@path` an image file, else JSON where it parses (3, true, ["a"]), else the text. */
function valueOf(text: string, cwd: string): { value?: unknown; file?: string } {
  if (text.startsWith("@")) return { file: resolve(cwd, text.slice(1)) };
  try {
    return { value: JSON.parse(text) };
  } catch {
    return { value: text };
  }
}

export async function runDesign(args: Args, io: Io, state: RunState): Promise<number> {
  const { cwd } = io;
  const design = args.design!;
  const file = resolve(cwd, args.positional[1]);
  let module: string;
  let output: string;
  let previous: string | undefined;
  const request: Omit<DesignRequest, "output"> = {
    kind: design.action,
    sets: design.sets.map((set) => ({ path: set.path, ...valueOf(set.value, cwd) })),
    ...(design.draft ? { draft: true } : {}),
    ...(design.sources.length ? { sources: Object.fromEntries(design.sources.map((s) => [s.path, readObject(s.value, cwd, `--source ${s.path}=`)])) } : {}),
  };
  if (design.action === "new") {
    if (!existsSync(file)) throw new UsageError(`${args.positional[1]} isn't there: design new takes a template module.`);
    module = file;
    output = resolve(cwd, design.output!);
    request.values = design.values !== undefined ? readObject(design.values, cwd, "--values") : {};
  } else {
    output = file;
    try {
      previous = readFileSync(file, "utf8");
    } catch (error) {
      throw new UsageError(`${args.positional[1]}: ${(error as Error).message}`);
    }
    let envelope: unknown;
    try {
      envelope = JSON.parse(previous);
    } catch (error) {
      return fail(io, args, output, [{ code: "cli/values-file", severity: "error", message: `${args.positional[1]} isn't JSON: ${(error as Error).message}`, path: "" }]);
    }
    const problem = envelopeProblem(envelope);
    if (problem) return fail(io, args, output, [{ code: "cli/values-file", severity: "error", message: problem, path: "" }]);
    const named = (envelope as { template: { module: string } }).template.module;
    const found = templateModule(file, named);
    if (!found) return fail(io, args, output, [{ code: "cli/values-file", severity: "error", message: `${args.positional[1]}'s template ${named} isn't found from its folder`, path: "" }]);
    module = found;
    request.envelope = envelope as Record<string, unknown>;
  }

  const input: Input = { id: 0, file: module, real: module, display: displayPath(cwd, module) };
  const token = ownToken();
  state.token = token;
  state.folders.add(resolve(module, ".."));
  // --from: a TSX design's values, captured in a capture child (its slots as { fragment }), made from this template.
  if (design.from !== undefined) {
    const from = resolve(cwd, design.from);
    if (!existsSync(from)) throw new UsageError(`--from ${design.from} isn't there: it's a TSX design made from the template.`);
    state.folders.add(dirname(from));
    const imports = await staticImports(from, readFileSync(from, "utf8"));
    const reply = (await runCapture([{ id: 0, file: from, capture: { kind: "design", imports } }], from, args, token, io)).get(0);
    const notFrom = (message: string) => fail(io, args, output, [{ code: "cli/template-design", severity: "error", message, path: "" }]);
    if (reply?.type !== "captured-design") return notFrom(`--from ${design.from}: ${reply?.type === "capture-failed" ? reply.error : "its capture gave no template"}`);
    const used = typeof reply.specifier === "string" && imports.includes(reply.specifier) ? resolveImport(from, reply.specifier) : undefined;
    if (!used || realOr(used) !== realOr(module)) return notFrom(`--from ${design.from} is made from ${reply.template?.id ?? "another template"} (${String(reply.specifier)}), not ${args.positional[1]}`);
    if (!reply.values || typeof reply.values !== "object" || Array.isArray(reply.values)) return notFrom(`--from ${design.from}: its capture isn't a template design's`);
    // Its images are relative to the design; the values file's, to it: rewritten in the child, which knows the root.
    request.values = reply.values as Record<string, unknown>;
    request.valuesFolder = dirname(from);
    // Where its `assets` export says an image came from, unless --source says otherwise.
    const given = reply.assets as Record<string, { source?: unknown }> | undefined;
    const sources: Record<string, Record<string, unknown>> = {};
    for (const [path, entry] of Object.entries(given ?? {})) if (entry?.source && typeof entry.source === "object") sources[path] = entry.source as Record<string, unknown>;
    if (Object.keys(sources).length) request.sources = { ...sources, ...(request.sources ?? {}) };
  }
  // The template is loaded in a template child, guarded where the project lists its trusted templates (Decision 31).
  const trust = readTrust(cwd);
  if (trust.list && !trusted(module, trust.list)) return fail(io, args, output, [untrusted(displayPath(cwd, module), trust)]);
  const report = await runChild("design", [input], true, args, undefined, token, io, { design: { ...request, output } as DesignRequest, ...templateChildOptions(trust, [module]) });
  const own = parseToken(`// ${token}`)!;
  cleanFiles(state.folders, (owner) => !!owner && owner.host === own.host && owner.pid === own.pid && owner.random === own.random);
  const result = report.results.get(0);
  const shown = displayPath(cwd, output);
  if (!result) {
    io.stderr(`✗ design ${design.action}: ${report.ended?.error ?? "the template didn't finish"}\n`);
    return 2;
  }
  if (!result.designed) {
    if (result.usage) {
      io.stderr(`✗ design ${design.action}: ${result.diagnostics.length ? formatDiagnostics(result.diagnostics) : (result.error ?? "")}\n`);
      return 2;
    }
    return fail(io, args, output, result.diagnostics, result.error, result.template);
  }
  const { designed } = result;
  const text = `${JSON.stringify(designed.file, null, 2)}\n`;
  // Written only where something changed: a set that changes nothing leaves the file's bytes as they were.
  if (text !== previous) writeAtomically(output, text);
  if (args.json) {
    await io.stdout(
      `${JSON.stringify({
        version: 1,
        command: "design",
        file: shown,
        status: designed.valid ? "ok" : "draft",
        template: result.template,
        changed: designed.changed,
        ...(designed.missing ? { missing: designed.missing } : {}),
        diagnostics: result.diagnostics,
      })}\n`,
    );
  } else {
    const head = designed.valid ? `✓ ${shown}` : `- ${shown}: a draft, missing ${designed.missing?.join(", ") || "values"}`;
    let body = result.diagnostics.length ? formatDiagnostics(result.diagnostics).split("\n").map((line) => `    ${line}\n`).join("") : "";
    for (const path of designed.changed) body += `  ${design.action === "new" ? "set" : "changed"} ${path}\n`;
    await io.stdout(`${head}\n${body}`);
  }
  return 0;
}

/** The values failed (or the file couldn't be read): nothing written, exit 1. */
async function fail(io: Io, args: Args, output: string, diagnostics: Diagnostic[], error?: string, template?: { id: string; version: string }): Promise<number> {
  const shown = displayPath(io.cwd, output);
  if (args.json) {
    await io.stdout(`${JSON.stringify({ version: 1, command: "design", file: shown, status: "error", ...(template ? { template } : {}), changed: [], diagnostics, ...(error ? { error } : {}) })}\n`);
  } else {
    const body = diagnostics.length ? formatDiagnostics(diagnostics).split("\n").map((line) => `    ${line}\n`).join("") : "";
    io.stderr(`✗ ${shown}: not written${error ? `: ${error}` : ""}\n${body}`);
  }
  return 1;
}


