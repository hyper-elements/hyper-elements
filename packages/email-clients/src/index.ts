/**
 * @hyper-elements/email-clients: an <Email> as classic Outlook, Outlook.com, Gmail and Apple Mail draw it. One
 * self-contained HTML file per email client, which draws the email as that client does when opened in Chromium and
 * lists what the client changed. The library itself needs no browser; it builds on core's public API only.
 *
 *   const { previews } = await renderInEmailClients(<Welcome />, { emailClients: ["outlook", "gmail"] });
 *   for (const p of previews) await writeFile(`out/${p.filename}`, p.html);
 */
import type React from "react";
import type { Diagnostic, EmailClient, RenderOptions } from "@hyper-elements/react";
import { checkCore } from "./core";
import { DEFAULT_PREVIEW_CLIENTS, variantsOf, type PreviewVariant, type Skipped } from "./clients";
import { RUNTIME } from "./runtime.generated";
import { previewFile } from "./shell";

export { BLOCK_MAP_VERSIONS, CORE_RANGE } from "./core";
export { DEFAULT_PREVIEW_CLIENTS, PREVIEW_CLIENTS, type PreviewClient, type PreviewVariant, type Skipped } from "./clients";

export interface EmailClientsOptions extends Omit<RenderOptions, "pretty" | "blockMap"> {
  /** The email clients to preview (default: the four captured: classic Outlook, Outlook.com, Gmail and Apple Mail). */
  emailClients?: readonly EmailClient[];
  /** Also a dark preview, for the clients whose dark mode was measured (Apple Mail). */
  dark?: boolean;
  /** Where the preview's stand-in fonts come from: a URL (default), or inlined in each file, to draw offline. */
  fonts?: "url" | "inline";
}

export interface EmailClientPreview extends PreviewVariant {
  /** The preview file: open it in Chromium. */
  html: string;
}

export interface EmailClientsResult {
  /** One file per client and variant, in the order asked for, light before dark. */
  previews: EmailClientPreview[];
  /** What wasn't previewed, and why: a client with no model, a dark mode not measured. */
  skipped: Skipped[];
  /** render()'s diagnostics. (What a preview finds is in the file, once it's opened.) */
  diagnostics: Diagnostic[];
}

/**
 * An <Email> as each email client draws it: one HTML preview file per client (and dark variant). Rejects with an
 * ElementsError where the template has errors, as render() does, or isn't an Email (`email-clients/not-an-email`); and
 * with an Error named `email-clients/version-mismatch` where the installed @hyper-elements/react can't map the email.
 */
export async function renderInEmailClients(element: React.ReactElement, options: EmailClientsOptions = {}): Promise<EmailClientsResult> {
  const core = checkCore();
  const { emailClients = DEFAULT_PREVIEW_CLIENTS, dark = false, fonts = "url", ...renderOptions } = options;
  const { variants, skipped } = variantsOf(emailClients, dark, core.EMAIL_CLIENTS);
  // Only an Email is previewed (render() would write another root as a page).
  const { root } = core.prepare(element);
  if (root && root.type !== "Email") {
    throw new core.ElementsError([{ code: "email-clients/not-an-email", severity: "error", message: `renderInEmailClients() previews an Email; this template's root is a ${root.type}`, path: "root" }]);
  }
  // The compact HTML: white space changes how some clients draw an email.
  const rendered = await core.render(element, { ...renderOptions, emailClients, pretty: false, blockMap: true });
  const blocks = rendered.blocks!;
  const fontOrigin = fonts === "url" ? "https://cdn.jsdelivr.net" : null;
  const previews = variants.map((variant) => {
    const { filename: _, ...rest } = variant;
    return { ...variant, html: previewFile(rendered.html, { ...rest, name: core.EMAIL_CLIENTS[variant.client].name, blocks, fontOrigin }, RUNTIME) };
  });
  return { previews, skipped, diagnostics: rendered.diagnostics };
}
