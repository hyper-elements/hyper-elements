/**
 * `check`: validate() with email-clients' plugin where the template's project has @hyper-elements/email-clients;
 * with `--rendered`, render() as well (writing nothing), for the checks only the written HTML has.
 */
import { elementsErrorDiagnostics, hasErrors, type CommandResult, type TemplateContext } from "./shared";

export async function checkTemplate(context: TemplateContext): Promise<CommandResult> {
  const { element, elements, options } = context;
  const { plugin, diagnostics: notes } = await context.plugin();
  const plugins = plugin ? { plugins: [plugin] } : {};
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
  diagnostics = [...diagnostics, ...notes];
  return { status: hasErrors(diagnostics) ? "error" : "ok", diagnostics };
}
