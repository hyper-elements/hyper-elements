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
import { facesToLoad, FACES, FONT_ORIGIN, fontCss, fontSources, OUTLOOK_COM_FILES, PROBE, PROBE_WIDTHS, readPackageFont, type ReadFont } from "./fonts";
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
  // The compact HTML: white space changes how some clients draw an email. A core that passed the check gives a block
  // map for an Email, and none for another root: only an Email is previewed.
  const rendered = await core.render(element, { ...renderOptions, emailClients, pretty: false, blockMap: true });
  const blocks = rendered.blocks;
  if (!blocks) {
    throw new core.ElementsError([{ code: "email-clients/not-an-email", severity: "error", message: "renderInEmailClients() previews an Email; this template's root is another (a Page, a Document or a Canvas)", path: "root" }]);
  }
  const fontOrigin = fonts === "url" ? FONT_ORIGIN : null;
  // Each font file read once, however many previews inline it.
  const cache = new Map<string, Promise<string>>();
  const read: ReadFont = (file) => cache.get(file) ?? (cache.set(file, readPackageFont(file)), cache.get(file)!);
  const previews = await Promise.all(
    variants.map(async (variant) => {
      const { filename: _, ...rest } = variant;
      const sources = await fontSources(variant.client, fonts, read);
      const info = core.EMAIL_CLIENTS[variant.client];
      const config = {
        ...rest,
        name: info.name,
        blocks,
        fontOrigin,
        fontCss: fontCss(variant.client, sources),
        faces: facesToLoad(variant.client),
        standIns: [...new Set(FACES[variant.client].map((face) => face.family)), ...(variant.client === "outlook" ? ["Aptos Stand-in"] : [])],
        outlookComFonts: variant.client === "outlook-com" ? Object.fromEntries(Object.entries(OUTLOOK_COM_FILES).map(([name, file]) => [name, sources[file]!])) : {},
        probe: { text: PROBE, widths: PROBE_WIDTHS },
        elements: info.measured?.elements ?? null,
        runtime: RUNTIME.sha256,
      };
      return { ...variant, html: previewFile(rendered.html, config, RUNTIME) };
    })
  );
  return { previews, skipped, diagnostics: rendered.diagnostics };
}
