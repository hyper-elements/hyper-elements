/**
 * Design checks for a template: what makes a reader turn an email down, found before anyone sees it. A visible
 * `{{merge tag}}`, a table that keeps four columns on a phone, faint text, an image without alt text, a phone number
 * that can split across lines. Each is a warning that says what to write instead; none is an error, and rendering
 * doesn't run them.
 *
 *   const { diagnostics } = check(<Receipt />);
 *
 * An entry of its own, so the main entry and /builder keep their size budgets; it imports this package by name (the
 * main entry's `prepare()`, not a copy of it). The preview command runs it on every preview.
 */
import { designChecks } from "@unlayer-internal/elements-core/check";
import { prepare, type Diagnostic } from "@hyper-elements/react";
import type { ReactElement } from "react";

export interface CheckOptions {
  /** The phone width to check a layout at, in px (375 by default). */
  phoneWidth?: number;
}

export interface CheckResult {
  /** The template's design warnings (`design/…`), or its errors where it can't be laid out. */
  diagnostics: Diagnostic[];
}

/**
 * A template's design problems, as warnings: `design/merge-tag-visible`, `design/table-columns`, `design/contrast`,
 * `design/alt` and `design/phone-number`. A template with errors gives its errors instead (as `validate()` does).
 */
export function check(element: ReactElement, options: CheckOptions = {}): CheckResult {
  const { root, diagnostics } = prepare(element);
  if (!root) return { diagnostics: diagnostics.filter((d) => d.severity === "error") };
  return { diagnostics: designChecks(root, options) };
}

export type { Diagnostic };
