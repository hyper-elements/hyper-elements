/**
 * What validation, resolution and conversion found: one list, each entry
 * naming the node (by id where it has one) and the path to the value.
 */

export type Severity = "error" | "warning" | "info";

export interface Diagnostic {
  /** Stable, for tools to match on: "prop/unknown", "layout/overflow", … */
  code: string;
  severity: Severity;
  message: string;
  /** Where in the input: `root.children[1].style.padding`. */
  path: string;
  /** The node's id, once it has one. */
  nodeId?: string;
  /** The email clients it's about (a plugin's, such as email-clients'); absent: none in particular. */
  clients?: readonly string[];
  /** What to change. */
  fix?: string;
  /** Where to see more about it (an https URL). */
  see?: string;
}

/** What a diagnostic may add: the email clients it's about, what to change, where to see more. */
export interface ClientFields {
  clients?: readonly string[];
  fix?: string;
  see?: string;
}

export class Diagnostics {
  readonly list: Diagnostic[] = [];

  add(code: string, severity: Severity, message: string, path: string, nodeId?: string, extra: ClientFields = {}): void {
    const d: Diagnostic = { code, severity, message, path };
    if (nodeId !== undefined) d.nodeId = nodeId;
    if (extra.clients) d.clients = [...extra.clients];
    if (extra.fix) d.fix = extra.fix;
    if (extra.see) d.see = extra.see;
    this.list.push(d);
  }

  error(code: string, message: string, path: string, nodeId?: string): void {
    this.add(code, "error", message, path, nodeId);
  }

  warning(code: string, message: string, path: string, nodeId?: string, extra?: ClientFields): void {
    this.add(code, "warning", message, path, nodeId, extra);
  }

  get hasErrors(): boolean {
    return this.list.some((d) => d.severity === "error");
  }
}

export function hasErrors(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === "error");
}

/** One line per diagnostic, for error messages and logs: with the email clients it's about, what to change and how to see it, where it says. */
export function formatDiagnostics(diagnostics: readonly Diagnostic[]): string {
  return diagnostics
    .map((d) => `${d.severity} ${d.code} at ${d.path}: ${d.message}${d.clients ? ` [${d.clients.join(", ")}]` : ""}${d.fix ? ` Fix: ${d.fix}` : ""}${d.see ? ` See: ${d.see}` : ""}`)
    .join("\n");
}

/** Thrown where a template with errors can't be rendered (`validate()` lists the problems without throwing). */
export class ElementsError extends Error {
  readonly diagnostics: Diagnostic[];

  constructor(diagnostics: Diagnostic[]) {
    const errors = diagnostics.filter((d) => d.severity === "error");
    super(`[Elements] The template has ${errors.length} error${errors.length === 1 ? "" : "s"}:\n${formatDiagnostics(errors)}`);
    this.name = "ElementsError";
    this.diagnostics = diagnostics;
  }
}
