/**
 * `@hyper-elements/lint` in the CLI: the project's copy where the template (or the HTML file) resolves one, else the
 * CLI's own (a dependency), with an `info` note, `cli/lint-copy`, on each input that used it. A project's copy that's
 * there but can't be used (it fails to load, or has no `lint` or `lintHtml`) is passed over for the CLI's own too, with
 * a warning saying why: a broken lint never stops a template from rendering. Lint imports nothing of Elements or React
 * at run time, so the CLI's copy runs safely beside the project's Elements.
 *
 * The copy that runs checks what the options mean (the parent checked only their shape): a rule, severity or kind it
 * doesn't know throws a TypeError saying so (`[lint] …`), which the run reports as a usage error (exit 2) naming that
 * copy and its version.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { cliDiagnostic } from "./commands/shared";
import { errorLine } from "./errors";
import type { Input } from "./inputs";
import type { LintConfig } from "./lint-config";
import { esmExport, installedAbove } from "./packages";
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

/** A copy of lint: whose it is, its version, and what the CLI says about it (on the CLI's own copy). */
export interface LintCopy<T> {
  module: T;
  version: string;
  own: boolean;
  /** `cli/lint-copy`: the CLI's own copy was used, and why. */
  note?: Diagnostic;
}

let ownVersion: string | undefined;
/** The CLI's own copy's version, read once. */
export function ownLintVersion(): string {
  if (ownVersion === undefined) {
    const manifest = createRequire(import.meta.url).resolve(`${LINT}/package.json`);
    ownVersion = (JSON.parse(readFileSync(manifest, "utf8")) as { version?: string }).version ?? "of an unknown version";
  }
  return ownVersion;
}

/**
 * The note on an input checked with the CLI's own copy: an `info` where the project has none, a `warning` naming why
 * where its copy couldn't be used.
 */
export function lintCopyNote(version: string, failure?: string): Diagnostic {
  return failure
    ? cliDiagnostic("lint-copy", "warning", `This project's ${LINT} couldn't be used (${failure}): the CLI's own copy (${version}) checked it`, `reinstall ${LINT}, or remove it to use the CLI's`)
    : cliDiagnostic("lint-copy", "info", `${LINT} isn't installed where this is: the CLI's own copy (${version}) checked it`, `npm i -D ${LINT} to choose its version`);
}

/** Whether a copy of lint threw for options it doesn't take (its own `[lint]` TypeError), not for a fault of its own. */
export function isOptionsError(error: unknown): boolean {
  return error instanceof TypeError && /^\[lint\] /.test(error.message);
}

/** What a copy of lint threw for options it doesn't take, as the run's usage error. */
export function lintUsage(error: unknown, copy: { version: string; own: boolean }): string {
  const message = errorLine(error).replace(/^\[lint\] /, "");
  return `${copy.own ? "the CLI's" : "the project's"} ${LINT} ${copy.version}: ${message[0]!.toLowerCase()}${message.slice(1)}`;
}

const bun = typeof (process.versions as Record<string, string | undefined>).bun === "string";

let ownPlugin: Promise<LintModule> | undefined;
/** The CLI's own plugin entry, imported once. */
export async function ownLint(failure?: string): Promise<LintCopy<LintModule>> {
  ownPlugin ??= import(LINT) as Promise<LintModule>;
  const version = ownLintVersion();
  return { module: await ownPlugin, version, own: true, note: lintCopyNote(version, failure) };
}

const htmlCopies = new Map<string, Promise<LintHtmlModule>>();
let ownHtml: Promise<LintHtmlModule> | undefined;

/** The lintHtml an HTML file is checked with: the copy its folder resolves, else (or where it can't be used) the CLI's own. */
async function lintHtmlFor(file: string): Promise<LintCopy<LintHtmlModule>> {
  let failure: string | undefined;
  let manifestPath: string | undefined;
  try {
    if (!bun || installedAbove(dirname(file), LINT)) manifestPath = createRequire(file).resolve(`${LINT}/package.json`);
  } catch {
    // Not installed there.
  }
  if (manifestPath) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
      const entry = esmExport(dirname(manifestPath), manifest, "./html");
      if (!entry) throw new Error("it has no ./html entry: lint 0.1.0 and later do");
      let loading = htmlCopies.get(entry);
      if (!loading) htmlCopies.set(entry, (loading = import(pathToFileURL(entry).href) as Promise<LintHtmlModule>));
      const module = await loading;
      if (typeof module?.lintHtml !== "function") throw new Error("its ./html entry has no lintHtml");
      return { module, version: typeof manifest.version === "string" ? manifest.version : "of an unknown version", own: false };
    } catch (error) {
      failure = errorLine(error);
    }
  }
  ownHtml ??= import(`${LINT}/html`) as Promise<LintHtmlModule>;
  const version = ownLintVersion();
  return { module: await ownHtml, version, own: true, note: lintCopyNote(version, failure) };
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
  const notes = copy.note ? [copy.note] : [];
  let found;
  try {
    found = copy.module.lintHtml(html, config);
  } catch (error) {
    if (isOptionsError(error)) return { diagnostics: notes, error: lintUsage(error, copy) };
    throw error;
  }
  // Lines as lint counts them, and HTML reads them: ended by \n, \r\n or a lone \r.
  const lines = html.split(/\r\n|\r|\n/);
  const diagnostics: Diagnostic[] = found.diagnostics.map(({ code, severity, message, line, fix, see }) => {
    const shown = excerpt(lines, line);
    return { code, severity, message, path: "html", line, ...(shown ? { excerpt: shown } : {}), ...(fix ? { fix } : {}), ...(see ? { see } : {}) };
  });
  return { diagnostics: [...diagnostics, ...notes] };
}
