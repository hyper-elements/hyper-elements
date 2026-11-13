/**
 * `check`: validate() with email-clients' plugin where the template's project has @hyper-elements/email-clients, and
 * lint's (unless --no-lint); with `--rendered`, render() as well (writing nothing), for the checks only the written
 * HTML has.
 */
import { elementsErrorDiagnostics, hasErrors, withPluginNotes, type CommandResult, type TemplateContext } from "./shared";

export async function checkTemplate(context: TemplateContext): Promise<CommandResult> {
  const { element, elements, options } = context;
  const { plugins: list, diagnostics: notes } = await context.plugins();
  const plugins = list.length ? { plugins: list } : {};
  let diagnostics;
  if (options.rendered) {
    try {
      // render() gives what validate() does, and its plugins' checks of the written HTML.
      diagnostics = (await elements.render(element, plugins)).diagnostics;
    } catch (error) {
      diagnostics = elementsErrorDiagnostics(error);
      if (!diagnostics) throw error;
    }
  } else {
    diagnostics = elements.validate(element, plugins).diagnostics;
  }
  diagnostics = withPluginNotes(diagnostics, notes);
  return { status: hasErrors(diagnostics) ? "error" : "ok", diagnostics };
}
