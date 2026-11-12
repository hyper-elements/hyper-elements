/**
 * What each command does with a template's element, in the child process.
 */
import type { ElementsMain } from "../elements";
import type { ChildOptions, Diagnostic, ResultMessage, Root } from "../protocol";

export interface TemplateContext {
  element: unknown;
  root: Root | null;
  elements: ElementsMain;
  options: ChildOptions;
  /** The template's file (absolute) and the run's folder. */
  file: string;
  cwd: string;
  /** Loads a module as the template resolves it (through its loader module): Elements' other entries. */
  load(specifier: string): Promise<unknown>;
  /** Resolves a specifier as the template does: a file URL or a path. */
  resolve(specifier: string): string;
  /** email-clients' plugin, where the template's project has email-clients (made once per process). */
  plugin(): Promise<{ plugin?: unknown; diagnostics: Diagnostic[] }>;
}

export type CommandResult = Pick<ResultMessage, "status" | "diagnostics" | "outputs" | "binary" | "error" | "usage">;

/** Whether diagnostics hold an error. */
export function hasErrors(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === "error");
}

/** An ElementsError (from any copy of Elements): its diagnostics. */
export function elementsErrorDiagnostics(error: unknown): Diagnostic[] | undefined {
  const value = error as { name?: unknown; diagnostics?: unknown } | null;
  return value && value.name === "ElementsError" && Array.isArray(value.diagnostics) ? (value.diagnostics as Diagnostic[]) : undefined;
}

/** A CLI diagnostic: `cli/…`, at no path in the template. */
export function cliDiagnostic(code: string, severity: Diagnostic["severity"], message: string, fix?: string): Diagnostic {
  return { code: `cli/${code}`, severity, message, path: "", ...(fix ? { fix } : {}) };
}
