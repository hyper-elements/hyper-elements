/**
 * `preview`: an Email as each email client draws it, from the project's @hyper-elements/email-clients
 * (`renderInEmailClients()`), one file per client and variant. The parent writes the files, and draws them in a
 * browser where `--findings` asks. The previews it skips (a client with no model, a dark mode not measured) are `info`
 * diagnostics, `cli/preview-skipped`.
 */
import { errorLine } from "../errors";
import { cliDiagnostic, elementsErrorDiagnostics, hasErrors, UsageFailure, type CommandResult, type TemplateContext } from "./shared";

export async function previewTemplate(context: TemplateContext): Promise<CommandResult> {
  const { element, root, options, emailClients } = context;
  if (!emailClients?.renderInEmailClients) {
    return {
      status: "error",
      usage: true,
      diagnostics: [
        cliDiagnostic(
          "email-clients-missing",
          "error",
          "preview draws an email as each email client does with @hyper-elements/email-clients, which isn't installed where this template is",
          "npm i -D @hyper-elements/email-clients",
        ),
      ],
    };
  }
  if (root !== "Email") {
    return { status: "skipped", diagnostics: [cliDiagnostic("not-an-email", "info", `preview draws an Email as the email clients do; this template's root is ${root === null ? "none Elements knows" : `a ${root}`}`)] };
  }
  let result;
  try {
    result = await emailClients.renderInEmailClients(element, {
      ...(options.clients ? { emailClients: options.clients } : {}),
      ...(options.dark ? { dark: true } : {}),
      ...(options.fonts ? { fonts: options.fonts } : {}),
    });
  } catch (error) {
    const diagnostics = elementsErrorDiagnostics(error);
    if (diagnostics) return { status: "error", diagnostics };
    // A client it doesn't know (--clients): what the run was asked can't be done.
    if (error instanceof TypeError && options.clients) {
      throw new UsageFailure(errorLine(error).replace(/^\[Elements\] /, "").replace("renderInEmailClients({ emailClients })", "--clients"));
    }
    throw error;
  }
  const skipped = result.skipped.map((skip) => ({
    ...cliDiagnostic("preview-skipped", "info", `No ${skip.dark ? "dark " : ""}preview of ${skip.client}: ${skip.reason}`),
    clients: [skip.client],
  }));
  const diagnostics = [...result.diagnostics, ...skipped];
  return {
    status: hasErrors(diagnostics) ? "error" : "ok",
    diagnostics,
    previews: result.previews.map(({ id, client, filename, html }) => ({ id, client, filename, html })),
  };
}
