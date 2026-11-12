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
  /** email-clients' plugin, where the template's project has email-clients (made once per process). */
  plugin(): Promise<{ plugin?: unknown; diagnostics: Diagnostic[] }>;
}

export type CommandResult = Pick<ResultMessage, "status" | "diagnostics" | "outputs" | "error">;

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
