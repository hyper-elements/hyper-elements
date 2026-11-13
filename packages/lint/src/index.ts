/**
 * `@hyper-elements/lint`: what makes an email or a page hard to read, as a plugin for Elements' `validate()` and
 * `render()`. It reads the laid-out template it's handed and imports nothing at run time (Elements' types only), so
 * it runs wherever Elements does, with whichever copy of Elements calls it.
 *
 *     const { diagnostics } = await render(<Welcome />, { plugins: [lint()] });
 */
import type { ElementsPlugin, PluginInput } from "@hyper-elements/react";
import { settingsOf, type LintOptions } from "./options";
import { lintInput } from "./template";

export { rules, type LintRoot, type Rule, type RuleSetting } from "./rules";
export type { LintOptions } from "./options";

/** This package's version, for a tool to say which copy it ran. */
export const version: string = __VERSION__;

/**
 * The lint plugin: `validate(template, { plugins: [lint()] })`. Its findings are `email/lint-<rule>` on an Email and
 * `page/lint-<rule>` on a Page, warnings and notes only; a Document or a Canvas gets none. Throws a `TypeError` for an
 * option it doesn't know (a rule, a severity, a kind).
 */
export function lint(options?: LintOptions): ElementsPlugin {
  const { settings, kind } = settingsOf(options, "lint()");
  return Object.freeze({ name: "lint", api: 1 as const, check: (input: PluginInput) => lintInput(input, settings, kind) });
}
