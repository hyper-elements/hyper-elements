/**
 * What a run says: text by default (diagnostics as formatDiagnostics() writes them), or with `--json` one line per
 * input and a summary line, on stdout, with nothing else there.
 */
import type { Command, Diagnostic, InputLine, Late, Root, SummaryLine } from "./protocol";

/** One input's outcome, as the parent has it once its child is done. */
export interface Outcome {
  file: string;
  root: Root | null;
  status: "ok" | "error" | "skipped";
  outputs: string[];
  diagnostics: Diagnostic[];
  /** `formatDiagnostics()` of `diagnostics`, from the template's Elements, where it loaded. */
  formatted?: string;
  error?: string;
}

/** As Elements' formatDiagnostics() writes them (packages/core/src/diagnostics.ts), for diagnostics no Elements formatted. */
export function formatDiagnostics(diagnostics: readonly Diagnostic[]): string {
  return diagnostics
    .map((d) => `${d.severity} ${d.code} at ${d.path}: ${d.message}${d.clients ? ` [${d.clients.join(", ")}]` : ""}${d.fix ? ` Fix: ${d.fix}` : ""}${d.see ? ` See: ${d.see}` : ""}`)
    .join("\n");
}

export function inputLine(command: Command, outcome: Outcome): InputLine {
  return {
    version: 1,
    command,
    file: outcome.file,
    input: "template",
    root: outcome.root,
    status: outcome.status,
    outputs: outcome.outputs,
    diagnostics: outcome.diagnostics,
    ...(outcome.error !== undefined ? { error: outcome.error } : {}),
  };
}

export function inputText(outcome: Outcome): string {
  const mark = outcome.status === "ok" ? "✓" : outcome.status === "error" ? "✗" : "-";
  let head = `${mark} ${outcome.file}`;
  if (outcome.root) head += ` (${outcome.root})`;
  if (outcome.status === "skipped") head += " skipped";
  if (outcome.error !== undefined) head += `: ${outcome.error}`;
  if (outcome.outputs.length) head += ` → ${outcome.outputs.join(", ")}`;
  const formatted = outcome.diagnostics.length ? (outcome.formatted ?? formatDiagnostics(outcome.diagnostics)) : "";
  const body = formatted ? formatted.split("\n").map((line) => `    ${line}\n`).join("") : "";
  return `${head}\n${body}`;
}

function groupName(late: Late): string {
  const parts = [late.group.package ?? "no package", ...(late.group.tsconfig ? [late.group.tsconfig] : [])];
  return parts.join(", ");
}

export function summaryText(summary: SummaryLine): string {
  const { templates, errors, warnings, skipped, late } = summary.summary;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  let text = `${plural(templates, "template")}: ${plural(errors, "error")}, ${plural(warnings, "warning")}, ${skipped} skipped\n`;
  for (const item of late) {
    text +=
      item.kind === "throw"
        ? `✗ template code threw outside a render (${groupName(item)}): ${item.message}\n`
        : `✗ the child process for ${groupName(item)} ended badly after its results (${item.reason}: ${item.detail})\n`;
  }
  return text;
}
