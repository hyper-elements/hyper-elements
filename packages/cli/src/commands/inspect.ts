/**
 * `inspect`: what a template holds, as inspect() gives it (each component, what it's given, whether its root takes
 * it, the problems found on it). The child has already inspected the template to find its root: that result is
 * sent as it is. A template with errors is `error`, as `check` has it.
 */
import type { CommandResult, TemplateContext } from "./shared";

export async function inspectTemplate(context: TemplateContext): Promise<CommandResult> {
  const { inspection } = context;
  return { status: inspection.valid ? "ok" : "error", diagnostics: inspection.diagnostics, inspection };
}
