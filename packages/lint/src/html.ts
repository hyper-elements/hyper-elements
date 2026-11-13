/**
 * `@hyper-elements/lint/html`: the rules HTML can show, on any HTML email, however it was made. It needs nothing else:
 * no Elements, no React, no parser.
 *
 *     const { diagnostics } = lintHtml(html);
 */
import { checkHtml } from "./html-rules";
import { settingsOf, type LintOptions } from "./options";
import { ruleById } from "./rules";
import { readHtml } from "./tokenize";

export type { LintOptions } from "./options";

/** A finding in HTML: where it is by line and column (from 1), and what to do. */
export interface HtmlDiagnostic {
  /** `lint/<rule>`. */
  code: string;
  severity: "info" | "warning";
  message: string;
  line: number;
  column: number;
  fix: string;
  see: string;
}

/**
 * Lints HTML: an `<img>` without `alt`, a link with nothing to name it, words that don't say where it goes or a target
 * that goes nowhere (or runs a script), an empty heading, `role="button"` on a link; on a whole document (with an
 * `<html>` or a `<body>`) the heading order, one `<h1>`, the language and the title. Outlook's conditional comments
 * are skipped. Takes `lint()`'s options; throws a `TypeError` for one it doesn't know.
 */
export function lintHtml(html: string, options?: LintOptions): { diagnostics: HtmlDiagnostic[] } {
  const { settings } = settingsOf(options, "lintHtml()");
  if (typeof html !== "string") throw new TypeError(`[lint] lintHtml() takes HTML as a string, not ${html === null ? "null" : typeof html}`);
  const tree = readHtml(html);
  const on = (id: string, scope: "both" | "document") => settings.get(id) !== "off" && (ruleById(id)!.html === scope || ruleById(id)!.html === "both");
  const diagnostics = checkHtml(tree, on).map(({ id, message, line, column }) => {
    const rule = ruleById(id)!;
    return { code: `lint/${id}`, severity: settings.get(id) as "info" | "warning", message, line, column, fix: rule.fix, see: rule.see };
  });
  return { diagnostics };
}
