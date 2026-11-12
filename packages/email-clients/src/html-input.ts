/**
 * renderInEmailClients() given an HTML email as a string, however it was made (MJML, React Email, by hand, an email
 * builder's export): the same previews, with no core and no React loaded. Nothing this module reaches imports them.
 */
import { checkComputers, checkWidths, DEFAULT_PREVIEW_CLIENTS, variantsOf, type Computer, type EmailClientPreview, type PreviewClient, type Skipped } from "./clients";
import { APPROXIMATE_FOR_HTML, checkClients, EMAIL_CLIENTS, type EmailClient } from "./email-clients";
import { forgetModelsPackage, loadModelsPackage, type Models } from "./models";
import { NO_BLOCKS, previewsOf } from "./previews";
import { checkProtocol } from "./protocol";

/** The options renderInEmailClients(html) takes: the preview options, not render()'s. */
const HTML_OPTIONS: readonly string[] = ["emailClients", "dark", "fonts", "widths", "computers"];

/** The preview options (renderInEmailClients()'s, without render()'s). */
export interface HtmlOptions {
  emailClients?: readonly EmailClient[];
  dark?: boolean;
  fonts?: "url" | "inline";
  widths?: Partial<Record<PreviewClient, number>>;
  computers?: readonly Computer[];
}

/** Throws unless `html` is a whole email: a string with an `<html>` and a `<body>` tag outside comments. */
export function checkWholeEmail(html: unknown, call = "renderInEmailClients(html)"): asserts html is string {
  if (typeof html !== "string") throw new TypeError(`[Elements] ${call} takes the email's HTML as a string, not ${html === null ? "null" : typeof html}`);
  const markup = html.replace(/<!--[\s\S]*?(?:-->|$)/g, "");
  if (!/<html[\s>]/i.test(markup) || !/<body[\s>/]/i.test(markup)) {
    throw new TypeError(`[Elements] ${call} takes a whole email, from <html> to </html>: this has no ${/<html[\s>]/i.test(markup) ? "<body>" : "<html>"} tag`);
  }
}

/** Throws on options that aren't an object, or name one HTML doesn't take (render()'s, for one). */
function checkOptions(options: unknown, call: string, allowed: readonly string[]): void {
  if (!options || typeof options !== "object" || Array.isArray(options)) throw new TypeError(`[Elements] ${call} takes its options as an object`);
  const unknown = Object.keys(options).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new TypeError(`[Elements] ${call} takes ${allowed.join(", ")}; not ${unknown.map((key) => JSON.stringify(key)).join(", ")}`);
}

/** The models package, checked: an import that fails is tried again on the next call. */
async function models(): Promise<Models> {
  let loaded: Models;
  try {
    loaded = await loadModelsPackage();
  } catch (error) {
    forgetModelsPackage();
    throw error;
  }
  checkProtocol(loaded.PROTOCOL);
  return loaded;
}

/**
 * An HTML email as each email client draws it: one preview file per client (and dark variant). The HTML is previewed as
 * given (it's what a client receives), as data inside the file: none of its scripts, handlers or navigation run.
 */
export async function previewHtml(html: string, options: HtmlOptions = {}): Promise<{ previews: EmailClientPreview[]; skipped: Skipped[]; diagnostics: [] }> {
  checkWholeEmail(html);
  checkOptions(options, "renderInEmailClients(html, options)", HTML_OPTIONS);
  const { emailClients: clients = DEFAULT_PREVIEW_CLIENTS, dark = false, fonts = "url", widths, computers } = options;
  checkWidths(widths);
  checkComputers(computers);
  checkClients(clients, "renderInEmailClients({ emailClients })");
  const loaded = await models();
  const { variants, skipped } = variantsOf(clients, dark, EMAIL_CLIENTS, widths, computers);
  // HTML not built with Hyper Elements: approximate where the models are weak on it, or haven't been measured on it.
  const marked = variants.map((variant) => (APPROXIMATE_FOR_HTML.includes(variant.id) ? { ...variant, approximate: true } : variant));
  const previews = await previewsOf(html, NO_BLOCKS, marked, loaded, { fonts, source: "html" });
  return { previews, skipped, diagnostics: [] };
}
