/**
 * Diagnostics as text, as Elements' formatDiagnostics() writes them (packages/internal/core/src/diagnostics.ts), for those no
 * Elements formatted; one at no path in the template (the CLI's own, `cli/…`) says no place: `info cli/not-a-template:
 * …`, not `at :`.
 */
import type { Diagnostic } from "./protocol";

export function formatDiagnostic(d: Diagnostic): string {
  return `${d.severity} ${d.code}${d.path ? ` at ${d.path}` : ""}: ${d.message}${d.clients ? ` [${d.clients.join(", ")}]` : ""}${d.fix ? ` Fix: ${d.fix}` : ""}${d.see ? ` See: ${d.see}` : ""}`;
}

export function formatDiagnostics(diagnostics: readonly Diagnostic[]): string {
  return diagnostics.map(formatDiagnostic).join("\n");
}
