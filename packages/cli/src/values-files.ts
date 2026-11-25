/**
 * Values files (a design as data) as a run's inputs, in the parent: each file's shape checked before anything runs
 * (`cli/values-file`), its template module resolved from its folder, and the file expanded into one input per format
 * it lists, narrowed by `--template-format` (Decision 20). The child reads the values against the template.
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, isAbsolute, resolve } from "node:path";
import { cliDiagnostic } from "./commands/shared";
import type { Input } from "./inputs";
import type { Diagnostic } from "./protocol";

const FORMAT = /^[a-z][a-z0-9-]*$/;

export type Expanded = { inputs: Input[] } | { error: Diagnostic };

const fail = (message: string, fix?: string): Expanded => ({ error: cliDiagnostic("values-file", "error", message, fix) });

/** A values file's template module, from its folder: a relative path, or a package specifier. Undefined where none resolves. */
export function templateModule(valuesFile: string, module: string): string | undefined {
  if (module.startsWith("./") || module.startsWith("../")) {
    const path = resolve(dirname(valuesFile), module);
    return existsSync(path) ? path : undefined;
  }
  try {
    return createRequire(valuesFile).resolve(module);
  } catch {
    return undefined;
  }
}

/** The envelope's shape: version 1, the template's module, id and version, and the formats listed, each a name. */
export function envelopeProblem(envelope: unknown): string | undefined {
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) return "A values file is a JSON object";
  const file = envelope as Record<string, unknown>;
  if (file.version !== 1) return `A values file is version 1, not ${JSON.stringify(file.version)}`;
  const template = file.template as Record<string, unknown> | undefined;
  if (!template || typeof template !== "object" || ["module", "id", "version"].some((key) => typeof template[key] !== "string")) return "A values file's template is { module, id, version }, each a string";
  if (isAbsolute(template.module as string)) return `A values file names its template relative to itself (../templates/launch.tsx) or by package, not by an absolute path (${template.module})`;
  if (file.values === undefined || typeof file.values !== "object" || file.values === null || Array.isArray(file.values)) return "A values file's values are an object";
  if (file.formats !== undefined) {
    if (!Array.isArray(file.formats) || file.formats.some((f) => typeof f !== "string" || !FORMAT.test(f))) return 'A values file\'s formats are a list of format names ("square", "landscape")';
    if (new Set(file.formats).size !== file.formats.length) return "A values file lists each format once";
  }
  return undefined;
}

/** A values file read, checked and expanded into its inputs (ids from `nextId`). */
export function expandValues(input: Input, templateFormat: string | undefined, nextId: () => number): Expanded {
  let envelope: unknown;
  try {
    envelope = JSON.parse(readFileSync(input.file, "utf8"));
  } catch (error) {
    return fail(`${input.display} isn't JSON: ${(error as Error).message}`);
  }
  const problem = envelopeProblem(envelope);
  if (problem) return fail(problem);
  const file = envelope as { template: { module: string }; formats?: string[] };
  const module = templateModule(input.file, file.template.module);
  if (!module) return fail(`${input.display}'s template ${file.template.module} isn't found from its folder`, "give the template module's path relative to the values file, or install its package");
  const listed = file.formats ?? [];
  if (templateFormat !== undefined && listed.length && !listed.includes(templateFormat)) {
    return { error: cliDiagnostic("template-format", "error", `${input.display} lists the formats ${listed.join(", ")}, not ${templateFormat}`) };
  }
  const formats = templateFormat !== undefined ? [templateFormat] : listed.length ? listed : [undefined];
  const stem = basename(input.file).replace(/\.values\.json$/i, "");
  return {
    inputs: formats.map((format) => ({
      id: nextId(),
      file: module,
      real: module,
      display: input.display,
      kind: "values" as const,
      values: { file: input.file, envelope: envelope as Record<string, unknown> },
      ...(format !== undefined ? { templateFormat: format } : {}),
      output: { folder: dirname(input.file), stem },
    })),
  };
}
