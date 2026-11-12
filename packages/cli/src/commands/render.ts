/**
 * `render`: a template's output, as its root says. An Email's HTML and plain text, a Page's HTML; a Document's print
 * HTML and a Canvas's HTML until the CLI writes their PDF and image. The parent writes the files.
 */
import { cliDiagnostic, elementsErrorDiagnostics, hasErrors, type CommandResult, type TemplateContext } from "./shared";

/** The files `render` writes for each root, by extension. */
export const RENDER_OUTPUTS: Record<string, string[]> = {
  Email: ["html", "txt"],
  Page: ["html"],
  Document: ["html"],
  Canvas: ["html"],
};

/** Every extension `render` may write, reserved for each input before any template runs. */
export const ALL_RENDER_OUTPUTS = ["html", "txt"];

export async function renderTemplate(context: TemplateContext): Promise<CommandResult> {
  const { element, root, elements, options } = context;
  try {
    const result = await elements.render(element, options.pretty ? { pretty: true } : {});
    const diagnostics = [...result.diagnostics];
    if (root === "Document" || root === "Canvas") {
      diagnostics.push(
        cliDiagnostic(
          "html-only",
          "info",
          root === "Document"
            ? "This is the Document's print HTML: the CLI writes its PDF (.pdf) in a later release"
            : "This is the Canvas's HTML: the CLI writes its image (.png, .svg) in a later release",
        ),
      );
    }
    const outputs: Record<string, string> = { html: result.html };
    if (root === "Email") outputs.txt = result.text;
    return { status: hasErrors(diagnostics) ? "error" : "ok", diagnostics, outputs };
  } catch (error) {
    const diagnostics = elementsErrorDiagnostics(error);
    if (diagnostics) return { status: "error", diagnostics };
    throw error;
  }
}
