/**
 * `outline`: a template laid out, as text (outline()). Text only: the parent prints it.
 */
import { elementsErrorDiagnostics, type CommandResult, type TemplateContext } from "./shared";

export async function outlineTemplate(context: TemplateContext): Promise<CommandResult> {
  const { element, elements } = context;
  try {
    return { status: "ok", diagnostics: [], outputs: { outline: elements.outline(element) } };
  } catch (error) {
    const diagnostics = elementsErrorDiagnostics(error);
    if (diagnostics) return { status: "error", diagnostics };
    throw error;
  }
}
