/**
 * What each command does with a template's element, in the child process.
 */
import type { ElementsMain, EmailClientsModule } from "../elements";
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
  /**
   * The plugins to check it with: email-clients' where the template's project has email-clients, and lint's for an Email
   * or a Page unless `--no-lint` (each made once per process), with what the CLI says about them.
   */
  plugins(): Promise<{ plugins: unknown[]; diagnostics: Diagnostic[] }>;
  /** The project's email-clients, where it has it (loaded for `check` and `preview`). */
  emailClients?: EmailClientsModule;
  /** inspect()'s result, which the child reads the root from. */
  inspection: { root: string | null; valid: boolean; diagnostics: Diagnostic[] };
}

export type CommandResult = Pick<ResultMessage, "status" | "diagnostics" | "outputs" | "binary" | "error" | "previews" | "inspection" | "usage">;

/** What the run was asked can't be done for this template (exit 2). */
export class UsageFailure extends Error {}

/** Whether diagnostics hold an error. */
export function hasErrors(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === "error");
}

/**
 * What the CLI says about the plugins, after what Elements found: without the note on lint's copy where the template has
 * errors (core runs no plugin's checks then).
 */
export function withPluginNotes(diagnostics: readonly Diagnostic[], notes: readonly Diagnostic[]): Diagnostic[] {
  const ran = hasErrors(diagnostics) ? notes.filter((d) => d.code !== "cli/lint-copy") : notes;
  return [...diagnostics, ...ran];
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
