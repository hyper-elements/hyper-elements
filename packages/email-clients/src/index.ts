/**
 * @hyper-elements/email-clients: the email client checks for Hyper Elements, and previews of how each client draws an
 * email. Builds on core's public API only; the models of the clients are @hyper-elements/email-client-models'.
 *
 * The checks, as a plugin for validate() and render():
 *
 *   validate(<Welcome />, { plugins: [await emailClients()] });
 *
 * The previews: one self-contained HTML file per email client, which draws the email as that client does when opened
 * in Chromium and lists what the client changed:
 *
 *   const { previews } = await renderInEmailClients(<Welcome />, { emailClients: ["outlook", "gmail"] });
 *   for (const p of previews) await writeFile(`out/${p.filename}`, p.html);
 */
import type React from "react";
import type { Diagnostic, ElementsPlugin, RenderOptions } from "@hyper-elements/react";
import { checkCore, versionMismatch } from "./core";
import { checkComputers, checkWidths, DEFAULT_PREVIEW_CLIENTS, variantsOf, type Computer, type PreviewClient, type PreviewVariant, type Skipped } from "./clients";
import { checkClients, EMAIL_CLIENTS, type EmailClient } from "./email-clients";
import { emailClients, PLUGIN_NAME } from "./plugin";
import { loadModelsPackage } from "./models";
import { RUNTIME } from "./runtime.generated";
import { FONT_ORIGIN, fontSources, readPackageFont, unnamed, type ReadFont } from "./fonts";
import { previewFile } from "./shell";

export { BLOCK_MAP_VERSIONS, CORE_RANGE, MODEL_PROTOCOLS, PLUGIN_APIS } from "./core";
export { COMPUTERS, DEFAULT_PREVIEW_CLIENTS, PREVIEW_CLIENTS, WEBMAIL, type Computer, type PreviewClient, type PreviewVariant, type Skipped } from "./clients";
export { DEFAULT_EMAIL_CLIENTS, EMAIL_CLIENTS, type EmailClient, type EmailClientInfo, type EmailClientMeasurement } from "./email-clients";
export { emailClients, PLUGIN_NAME, type EmailClientsPluginOptions } from "./plugin";

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

export interface EmailClientPreview extends PreviewVariant {
  /** The preview file: open it in Chromium. */
  html: string;
}

export interface EmailClientsResult {
  /** One file per client and variant, in the order asked for, light before dark. */
  previews: EmailClientPreview[];
  /** What wasn't previewed, and why: a client with no model, a dark mode not measured. */
  skipped: Skipped[];
  /** render()'s diagnostics, with the email client checks for the clients previewed. (What a preview finds is in the file, once it's opened.) */
  diagnostics: Diagnostic[];
}

/**
 * An <Email> as each email client draws it: one HTML preview file per client (and dark variant). Rejects with an
 * ElementsError where the template has errors, as render() does, or isn't an Email (`email-clients/not-an-email`); and
 * with an Error named `email-clients/version-mismatch` where the installed @hyper-elements/react can't map the email.
 * render() gets the caller's plugins and the email client checks for the clients previewed, unless the caller passed
 * them already.
 */
export async function renderInEmailClients(element: React.ReactElement, options: EmailClientsOptions = {}): Promise<EmailClientsResult> {
  const core = checkCore();
  const models = await loadModelsPackage();
  // The models' browser script, for the preview's CSP: its sha256 is the package's own.
  const script = { script: models.SCRIPT, sha256: models.SCRIPT_SHA256 };
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
  const fontOrigin = fonts === "url" ? FONT_ORIGIN : null;
  // Each font file read once, however many previews inline it.
  const cache = new Map<string, Promise<string>>();
  const read: ReadFont = (file) => cache.get(file) ?? (cache.set(file, readPackageFont(file)), cache.get(file)!);
  // A stand-in for a family the email chooses (Inter) only where it names it: the rest of classic Outlook's fonts are half.
  const skip = unnamed(rendered.html);
  const previews = await Promise.all(
    variants.map(async (variant) => {
      const { filename: _, ...rest } = variant;
      const info = EMAIL_CLIENTS[variant.client];
      const config = {
        ...rest,
        name: info.name,
        blocks,
        fontOrigin,
        fontSources: await fontSources(variant.client, fonts, read, skip.files, variant.computer),
        faces: models.facesToLoad(variant.client, variant.computer).filter((face) => !skip.families.some((family) => face.endsWith(`"${family}"`))),
        leftOut: skip.families,
        standIns: models.standIns(variant.client, variant.computer),
        elements: info.measured?.elements ?? null,
        runtime: RUNTIME.sha256,
        models: { script: script.sha256, protocol: models.PROTOCOL },
      };
      return { ...variant, html: previewFile(rendered.html, config, { runtime: RUNTIME, models: script }) };
    })
  );
  return { previews, skipped, diagnostics: rendered.diagnostics };
}
