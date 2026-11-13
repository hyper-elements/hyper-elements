/**
 * `@hyper-elements/lint` in the CLI: the project's copy where the template (or the HTML file) resolves one, else the
 * CLI's own (a dependency), with an `info` note, `cli/lint-copy`, on each input that used it. Lint imports nothing of
 * Elements or React at run time, so the CLI's copy runs safely beside the project's Elements.
 *
 * The copy that runs checks what the options mean (the parent checked only their shape): a rule, severity or kind it
 * doesn't know throws a TypeError, which the run reports as a usage error (exit 2) naming that copy and its version.
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { cliDiagnostic } from "./commands/shared";
import { errorLine } from "./errors";
import type { Input } from "./inputs";
import type { LintConfig } from "./lint-config";
import type { Diagnostic } from "./protocol";

export const LINT = "@hyper-elements/lint";

/** The plugin entry, of any version. */
export interface LintModule {
  lint(options?: LintConfig): unknown;
}

/** The HTML entry, of any version. */
export interface LintHtmlModule {
  lintHtml(html: string, options?: LintConfig): { diagnostics: Array<{ code: string; severity: "info" | "warning"; message: string; line: number; column: number; fix?: string; see?: string }> };
}

/** A copy of lint: whose it is and its version, for what the CLI says about it. */
export interface LintCopy<T> {
  module: T;
  version: string;
  own: boolean;
}

/** The CLI's own copy's version. */
export function ownLintVersion(): string {
  const manifest = createRequire(import.meta.url).resolve(`${LINT}/package.json`);
  return (JSON.parse(readFileSync(manifest, "utf8")) as { version?: string }).version ?? "of an unknown version";
}

/** The note on an input checked with the CLI's own copy. */
export function lintCopyNote(version: string): Diagnostic {
  return cliDiagnostic("lint-copy", "info", `${LINT} isn't installed where this is: the CLI's own copy (${version}) checked it`, `npm i -D ${LINT} to choose its version`);
}

/** What a copy of lint threw for options it doesn't take, as the run's usage error. */
export function lintUsage(error: unknown, copy: { version: string; own: boolean }): string {
  const message = errorLine(error).replace(/^\[lint\] /, "");
  return `${copy.own ? "the CLI's" : "the project's"} ${LINT} ${copy.version}: ${message[0]!.toLowerCase()}${message.slice(1)}`;
}

const bun = typeof (process.versions as Record<string, string | undefined>).bun === "string";

/** Whether a node_modules at or above `folder` holds `name` (Bun would otherwise resolve one from elsewhere). */
export function installedAbove(folder: string, name = LINT): boolean {
  for (let dir = folder; ; dir = dirname(dir)) {
    if (existsSync(join(dir, "node_modules", name, "package.json"))) return true;
    if (dirname(dir) === dir) return false;
  }
}

/** The ES module file of a package's export `subpath` (its `import` condition). */
function esmExport(folder: string, manifest: Record<string, unknown>, subpath: string): string | undefined {
  const exported = (manifest.exports as Record<string, unknown> | undefined)?.[subpath];
  const pick = (value: unknown): string | undefined => {
    if (typeof value === "string") return value;
    if (value && typeof value === "object") {
      const conditions = value as Record<string, unknown>;
      return pick(conditions.import) ?? pick(conditions.default);
    }
    return undefined;
  };
  const entry = pick(exported);
  return entry ? join(folder, entry) : undefined;
}

const htmlCopies = new Map<string, Promise<LintHtmlModule>>();
let ownHtml: Promise<LintHtmlModule> | undefined;

/** The lintHtml an HTML file is checked with: the copy its folder resolves, else the CLI's own. */
async function lintHtmlFor(file: string): Promise<LintCopy<LintHtmlModule>> {
  try {
    if (bun && !installedAbove(dirname(file))) throw new Error(`${LINT} isn't installed`);
    const manifestPath = createRequire(file).resolve(`${LINT}/package.json`);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
    const entry = esmExport(dirname(manifestPath), manifest, "./html");
    if (entry) {
      let loading = htmlCopies.get(entry);
      if (!loading) htmlCopies.set(entry, (loading = import(pathToFileURL(entry).href) as Promise<LintHtmlModule>));
      return { module: await loading, version: typeof manifest.version === "string" ? manifest.version : "of an unknown version", own: false };
    }
  } catch {
    // Not installed there (or a copy with no HTML entry): the CLI's own.
  }
  ownHtml ??= import(`${LINT}/html`) as Promise<LintHtmlModule>;
  return { module: await ownHtml, version: ownLintVersion(), own: true };
}

/** The line of `html` a finding is on, trimmed to 80 characters, as email-clients' HTML diagnostics show it. */
function excerpt(lines: string[], line: number): string | undefined {
  const text = lines[line - 1]?.trim();
  if (!text) return undefined;
  return text.length > 80 ? `${text.slice(0, 79)}…` : text;
}

/**
 * `check` of an HTML email: lintHtml() with the copy the file's folder resolves. Its findings as the CLI's HTML
 * diagnostics (`path: "html"`, the line and its excerpt); `error` where that copy refuses the options (exit 2).
 */
export async function lintHtmlInput(input: Input, html: string, config: LintConfig, probe?: (text: string) => void): Promise<{ diagnostics: Diagnostic[]; error?: string }> {
  const copy = await lintHtmlFor(input.file);
  probe?.(JSON.stringify({ file: input.display, lint: copy.own ? "cli" : "project", lintVersion: copy.version }));
  const notes = copy.own ? [lintCopyNote(copy.version)] : [];
  let found;
  try {
    found = copy.module.lintHtml(html, config);
  } catch (error) {
    if (error instanceof TypeError) return { diagnostics: notes, error: lintUsage(error, copy) };
    throw error;
  }
  const lines = html.split(/\r\n|\r|\n/);
  const diagnostics: Diagnostic[] = found.diagnostics.map(({ code, severity, message, line, fix, see }) => {
    const shown = excerpt(lines, line);
    return { code, severity, message, path: "html", line, ...(shown ? { excerpt: shown } : {}), ...(fix ? { fix } : {}), ...(see ? { see } : {}) };
  });
  return { diagnostics: [...diagnostics, ...notes] };
}
