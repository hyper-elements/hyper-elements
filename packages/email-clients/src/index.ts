/**
 * @hyper-elements/email-clients: the email client checks for Hyper Elements, and previews of how each client draws an
 * email. Builds on core's public API only; the models of the clients are @hyper-elements/email-client-models'.
 *
 * The checks, as a plugin for validate() and render():
 *
 *   validate(<Welcome />, { plugins: [await emailClients()] });
 *
 * The previews: one self-contained HTML file per email client, which draws the email as that client does when opened
 * in Chromium and lists what the client changed, of a template or of any HTML email:
 *
 *   const { previews } = await renderInEmailClients(<Welcome />, { emailClients: ["outlook", "gmail"] });
 *   const { previews } = await renderInEmailClients(await readFile("welcome.html", "utf8"));
 *   for (const p of previews) await writeFile(`out/${p.filename}`, p.html);
 *
 * HTML needs neither React nor @hyper-elements/react (optional peers): only a template loads core.
 */
import type React from "react";
import type { Diagnostic, ElementsPlugin, RenderOptions } from "@hyper-elements/react";
import { checkCore, loadCore, versionMismatch } from "./core";
import { checkComputers, checkWidths, DEFAULT_PREVIEW_CLIENTS, variantsOf, type Computer, type EmailClientPreview, type PreviewClient, type Skipped } from "./clients";
import { checkClients, EMAIL_CLIENTS, type EmailClient } from "./email-clients";
import { emailClients, PLUGIN_NAME } from "./plugin";
import { loadModelsPackage } from "./models";
import type { EmailHtmlDiagnostic } from "./html";
import { previewHtml } from "./html-input";
import { previewsOf } from "./previews";

export { BLOCK_MAP_VERSIONS, CORE_RANGE, MODEL_PROTOCOLS, PLUGIN_APIS } from "./core";
export { COMPUTERS, DEFAULT_PREVIEW_CLIENTS, PREVIEW_CLIENTS, WEBMAIL, type Computer, type EmailClientPreview, type PreviewClient, type PreviewVariant, type Skipped } from "./clients";
export { DEFAULT_EMAIL_CLIENTS, EMAIL_CLIENTS, type EmailClient, type EmailClientInfo, type EmailClientMeasurement } from "./email-clients";
export { emailClients, PLUGIN_NAME, type EmailClientsPluginOptions } from "./plugin";
export type { EmailHtmlDiagnostic } from "./html";

export interface EmailClientsOptions extends Omit<RenderOptions, "pretty" | "blockMap"> {
  /** The email clients to preview (default: the four captured: classic Outlook, Outlook.com, Gmail and Apple Mail). */
  emailClients?: readonly EmailClient[];
  /** Also a dark preview, for the clients whose dark mode was measured (Apple Mail). */
  dark?: boolean;
  /** Where the preview's stand-in fonts come from: a URL (default), or inlined in each file, to draw offline. */
  fonts?: "url" | "inline";
  /**
   * The width (px) a client's preview draws the email at, where it isn't the client's own: `{ "outlook-com": 540 }` for
   * Outlook.com's reading pane beside its message list. Outlook.com and Gmail on the web still apply the email's media
   * queries at a desktop window's width, as they do (models 1.4.0 and later), so a narrow pane keeps the desktop styles.
   */
  widths?: Partial<Record<PreviewClient, number>>;
  /**
   * The computers Outlook.com and Gmail on the web are previewed as read on (default both): `"windows"` resolves each
   * font stack against Windows' fonts, as Chrome there does (Georgia where a Mac has Didot), `"mac"` draws with the
   * fonts of the Mac the preview is opened on. Each is a preview of its own: `outlook-com` (Windows), `outlook-com.mac`.
   */
  computers?: readonly Computer[];
}

export interface EmailClientsResult<D = Diagnostic> {
  /** One file per client and variant, in the order asked for, light before dark. */
  previews: EmailClientPreview[];
  /** What wasn't previewed, and why: a client with no model, a dark mode not measured. */
  skipped: Skipped[];
  /**
   * The email client checks for the clients previewed: render()'s diagnostics, with the plugin's, for a template; for
   * HTML, what's found in it, each with its line. (What a preview finds is in the file, once it's opened.)
   */
  diagnostics: D[];
}

/**
 * An email as each email client draws it: one HTML preview file per client (and dark variant).
 *
 * Given an <Email>, it renders it: it rejects with an ElementsError where the template has errors, as render() does, or
 * isn't an Email (`email-clients/not-an-email`), and with an Error named `email-clients/version-mismatch` where
 * @hyper-elements/react isn't installed or can't map the email. render() gets the caller's plugins and the email client
 * checks for the clients previewed, unless the caller passed them already.
 *
 * Given an HTML email as a string (the whole email, from <html> to </html>), it previews it as given, as data in the
 * file, with the preview options only (emailClients, dark, fonts, widths, computers): a fragment, or render()'s options,
 * is a TypeError. It loads no core and no React. HTML not built with Hyper Elements is emulated less closely in some
 * clients: those previews are approximate. It rejects with the import's error where @hyper-elements/email-client-models
 * can't be loaded, and with `email-clients/version-mismatch` where the one installed speaks another protocol.
 */
export function renderInEmailClients(html: string, options?: Pick<EmailClientsOptions, "emailClients" | "dark" | "fonts" | "widths" | "computers">): Promise<EmailClientsResult<EmailHtmlDiagnostic>>;
export function renderInEmailClients(element: React.ReactElement, options?: EmailClientsOptions): Promise<EmailClientsResult>;
export async function renderInEmailClients(input: React.ReactElement | string, options: EmailClientsOptions = {}): Promise<EmailClientsResult | EmailClientsResult<EmailHtmlDiagnostic>> {
  if (typeof input === "string") return previewHtml(input, options as Parameters<typeof previewHtml>[1]);
  const element = input;
  const core = checkCore(await loadCore());
  const models = await loadModelsPackage();
  const { emailClients: clients = DEFAULT_PREVIEW_CLIENTS, dark = false, fonts = "url", plugins = [], widths, computers, ...renderOptions } = options;
  checkWidths(widths);
  checkComputers(computers);
  checkClients(clients, "renderInEmailClients({ emailClients })");
  const { variants, skipped } = variantsOf(clients, dark, EMAIL_CLIENTS, widths, computers);
  const own: ElementsPlugin[] = plugins.some((plugin) => plugin?.name === PLUGIN_NAME) ? [] : [await emailClients({ clients })];
  // The compact HTML: white space changes how some clients draw an email. A core that passed the check gives a block
  // map for an Email, and none for another root: only an Email is previewed.
  const rendered = await core.render(element, { ...renderOptions, plugins: [...plugins, ...own], pretty: false, blockMap: true });
  const blocks = rendered.blocks;
  if (!blocks) {
    throw new core.ElementsError([{ code: "email-clients/not-an-email", severity: "error", message: "renderInEmailClients() previews an Email; this template's root is another (a Page, a Document or a Canvas)", path: "root" }]);
  }
  // The findings read each block's component from its entry: a map without them (a core whose BLOCK_MAP_VERSION
  // claims a format it doesn't write) would leave them silently empty.
  if (!blocks.entries.every((entry) => typeof entry.type === "string")) throw versionMismatch(["block types in render()'s blockMap"]);
  const previews = await previewsOf(rendered.html, blocks, variants, models, { fonts, source: "render" });
  return { previews, skipped, diagnostics: rendered.diagnostics };
}
