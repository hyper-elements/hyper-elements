/**
 * What a run says: text by default (diagnostics as formatDiagnostics() writes them), or with `--json` one line per
 * input and a summary line, on stdout, with nothing else there.
 */
import { formatDiagnostics } from "./format";
import { previewLine } from "./preview";
import type { Command, Diagnostic, InputLine, InspectLine, Late, Preview, Root, SummaryLine, TemplateInfo } from "./protocol";

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
  /** `preview`: each preview written. */
  previews?: Preview[];
  /** `preview --findings`: the browser drawn with, or null where none was found. */
  browser?: string | null;
  reason?: "no-browser" | "no-playwright-core";
  /** `inspect`: inspect()'s result, or null where there's none. */
  inspection?: unknown;
  /** "html": an HTML email, checked or previewed as it is; "values": a values file (a template where it's not set). */
  input?: "template" | "html" | "values";
  /** A values file's format, where its template has formats. */
  templateFormat?: string;
  /** A values file's or a template module's template. */
  template?: TemplateInfo;
  /** What its template's check measured and found. */
  layout?: { fits?: unknown[]; regions?: Record<string, unknown>; rules?: unknown[]; review?: unknown[] };
}


export { formatDiagnostics };

/**
 * An HTML email's diagnostics, each at its file and line (`emails/welcome.html:12`), with the line's excerpt below it
 * where there is one.
 */
export function formatHtmlDiagnostics(file: string, diagnostics: readonly Diagnostic[]): string {
  return diagnostics
    .map((d) => {
      const at = typeof d.line === "number" ? `${file}:${d.line}` : file;
      const head = `${d.severity} ${d.code} at ${at}: ${d.message}${d.clients ? ` [${d.clients.join(", ")}]` : ""}${d.fix ? ` Fix: ${d.fix}` : ""}${d.see ? ` See: ${d.see}` : ""}`;
      return d.excerpt ? `${head}\n  ${d.excerpt}` : head;
    })
    .join("\n");
}

export function inputLine(command: Command, outcome: Outcome): InputLine | InspectLine {
  if (command === "inspect") {
    // inspect()'s result as it is; where there's none (a load failure, a skip), what the CLI found instead.
    const inspection = outcome.inspection ?? null;
    return {
      version: 1,
      command,
      file: outcome.file,
      status: outcome.status,
      inspection,
      ...(inspection === null ? { diagnostics: outcome.diagnostics } : {}),
      ...(outcome.error !== undefined ? { error: outcome.error } : {}),
    };
  }
  return {
    version: 1,
    command,
    file: outcome.file,
    input: outcome.input ?? "template",
    root: outcome.root,
    status: outcome.status,
    outputs: outcome.outputs,
    diagnostics: outcome.diagnostics,
    ...(outcome.error !== undefined ? { error: outcome.error } : {}),
    ...(command === "preview" && outcome.previews ? { previews: outcome.previews } : {}),
    ...(outcome.browser !== undefined ? { browser: outcome.browser } : {}),
    ...(outcome.reason ? { reason: outcome.reason } : {}),
    ...(outcome.templateFormat ? { templateFormat: outcome.templateFormat } : {}),
    ...(outcome.template ? { template: outcome.template } : {}),
    ...(outcome.layout?.fits?.length ? { fits: outcome.layout.fits } : {}),
    ...(outcome.layout?.regions && Object.keys(outcome.layout.regions).length ? { regions: outcome.layout.regions } : {}),
    ...(outcome.layout?.rules?.length ? { rules: outcome.layout.rules } : {}),
    ...(outcome.layout?.review?.length ? { review: outcome.layout.review } : {}),
  };
}

export function inputText(outcome: Outcome): string {
  const mark = outcome.status === "ok" ? "✓" : outcome.status === "error" ? "✗" : "-";
  let head = `${mark} ${outcome.file}${outcome.templateFormat ? ` [${outcome.templateFormat}]` : ""}`;
  const html = outcome.input === "html";
  if (outcome.root) head += ` (${outcome.root})`;
  if (html) head += " (HTML)";
  if (outcome.status === "skipped") head += " skipped";
  if (outcome.error !== undefined) head += `: ${outcome.error}`;
  if (outcome.outputs.length && !outcome.previews) head += ` → ${outcome.outputs.join(", ")}`;
  if (outcome.browser) head += `, drawn in ${outcome.browser}`;
  const formatted = !outcome.diagnostics.length
    ? ""
    : html
      ? formatHtmlDiagnostics(outcome.file, outcome.diagnostics)
      : (outcome.formatted ?? formatDiagnostics(outcome.diagnostics));
  let body = formatted ? formatted.split("\n").map((line) => `    ${line}\n`).join("") : "";
  if (outcome.inspection) body = inspectionText(outcome.inspection) + body;
  // A required rule that failed, or didn't run, and what a reviewer checks by eye.
  for (const rule of (outcome.layout?.rules ?? []) as Array<{ rule: string; status: string; format?: string }>) {
    if (rule.status !== "passed") body += `  rule ${rule.rule}${rule.format ? ` (${rule.format})` : ""}: ${rule.status}\n`;
  }
  // check: each image's region at the scale it's drawn, and each fitted text's size.
  for (const [field, byFormat] of Object.entries((outcome.layout?.regions ?? {}) as Record<string, Record<string, { box: number[]; pixels: number[] }>>)) {
    for (const [format, region] of Object.entries(byFormat)) body += `  ${field} (${format}): ${region.box.map(Math.round).join("×")}, needs ${region.pixels.map(Math.round).join("×")}px\n`;
  }
  for (const fit of (outcome.layout?.fits ?? []) as Array<{ field?: string; path: string; chosen?: number | null; sizes: number[]; templateFormat?: string }>) {
    body += `  fit ${fit.field ?? fit.path}${fit.templateFormat ? ` (${fit.templateFormat})` : ""}: ${fit.chosen != null ? `${fit.chosen}px` : "no size fits"}${fit.sizes.length ? ` (fits at ${fit.sizes.join(", ")})` : ""}\n`;
  }
  for (const item of (outcome.layout?.review ?? []) as Array<{ field?: string; template?: string; guidance: string }>) body += `  review ${item.field ?? item.template}: ${item.guidance}\n`;
  for (const preview of outcome.previews ?? []) body += `  ${previewLine(preview)}\n`;
  return `${head}\n${body}`;
}

/** inspect()'s result, as text: each component, at its path, with what it's given. */
function inspectionText(inspection: unknown): string {
  const { nodes = [], theme } = inspection as { nodes?: Array<{ path: string; type: string; allowed: boolean; given: string[] }>; theme?: { tokens: unknown[]; styles: string[] } | null };
  let text = nodes.map((node) => `  ${node.path} ${node.type}${node.allowed ? "" : " (not allowed in this root)"}${node.given.length ? `: ${node.given.join(", ")}` : ""}\n`).join("");
  if (theme) text += `  theme: ${theme.tokens.length} tokens${theme.styles.length ? `, styles ${theme.styles.join(", ")}` : ""}\n`;
  return text;
}

function groupName(late: Late): string {
  const parts = [late.group.package ?? "no package", ...(late.group.tsconfig ? [late.group.tsconfig] : [])];
  return parts.join(", ");
}

/** The summary, as text: `noun` names what was run (designs; HTML emails, or both: inputs). */
export function summaryText(summary: SummaryLine, noun: "design" | "email" | "input" = "design"): string {
  const { templates, errors, warnings, skipped, late } = summary.summary;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  let text = `${plural(templates, noun)}: ${plural(errors, "error")}, ${plural(warnings, "warning")}, ${skipped} skipped\n`;
  for (const item of late) {
    text +=
      item.kind === "throw"
        ? `✗ design code threw outside a render (${groupName(item)}): ${item.message}\n`
        : `✗ the child process for ${groupName(item)} ended badly after its results (${item.reason}: ${item.detail})\n`;
  }
  return text;
}
