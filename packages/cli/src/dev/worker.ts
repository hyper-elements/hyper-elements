/**
 * `dev`, in the child process: what the page shows of one template. An Email's or a Page's HTML (an Email's plain text
 * too, and its email client checks where the project has @hyper-elements/email-clients), a Document's PDF, a Canvas's
 * image, as `render` writes them; and an Email's previews in the email clients, as `preview` writes them. The parent
 * writes the files in its own folder and serves them.
 */
import { previewTemplate } from "../commands/preview";
import { renderTemplate } from "../commands/render";
import { elementsErrorDiagnostics, hasErrors, withPluginNotes, type CommandResult, type TemplateContext } from "../commands/shared";
import type { Diagnostic } from "../protocol";

export async function devTemplate(context: TemplateContext): Promise<CommandResult> {
  const { element, root, elements } = context;
  if (root !== "Email") return renderTemplate(context);
  // An Email: rendered with the email client checks where the project has them, and lint's, as `check --rendered` gives them.
  const made = await context.plugins();
  let result;
  try {
    result = await elements.render(element, made.plugins.length ? { plugins: made.plugins } : {});
  } catch (error) {
    const diagnostics = elementsErrorDiagnostics(error);
    if (diagnostics) return { status: "error", diagnostics: withPluginNotes(diagnostics, made) };
    throw error;
  }
  const diagnostics: Diagnostic[] = withPluginNotes(result.diagnostics, made);
  const outputs = { html: result.html, txt: result.text };
  if (hasErrors(diagnostics) || !context.emailClients?.renderInEmailClients) return { status: hasErrors(diagnostics) ? "error" : "ok", diagnostics, outputs };
  // The previews: what renderInEmailClients() says that the checks above didn't, once.
  const previews = await previewTemplate(context);
  const said = new Set(diagnostics.map((d) => JSON.stringify(d)));
  for (const d of previews.diagnostics) if (!said.has(JSON.stringify(d))) diagnostics.push(d);
  return { status: hasErrors(diagnostics) ? "error" : "ok", diagnostics, outputs, previews: previews.previews, ...(previews.usage ? { usage: true } : {}) };
}
