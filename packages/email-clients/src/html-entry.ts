/**
 * @hyper-elements/email-clients/html: the email client emulator for any HTML email, however it was made (MJML, React
 * Email, by hand, an email builder's export). It needs neither React nor @hyper-elements/react: nothing this entry
 * reaches imports them, in code or in types.
 *
 *   const html = await readFile("welcome.html", "utf8");
 *   const { previews } = await renderInEmailClients(html, { emailClients: ["outlook", "gmail-app"] });
 *   for (const p of previews) await writeFile(`out/${p.filename}`, p.html);
 *
 * Each preview is a self-contained HTML page that shows the email as that client does when Chromium opens it, and lists
 * what the client changed. HTML not built with Hyper Elements is emulated less closely in some clients: those previews
 * say they're approximate.
 */
import { checkComputers, checkWidths, DEFAULT_PREVIEW_CLIENTS, variantsOf, type Computer, type EmailClientPreview, type PreviewClient, type Skipped } from "./clients";
import { APPROXIMATE_FOR_HTML, checkClients, EMAIL_CLIENTS, type EmailClient } from "./email-clients";
import { forgetModelsPackage, loadModelsPackage, type Models } from "./models";
import { NO_BLOCKS, previewsOf } from "./previews";
import { checkProtocol } from "./protocol";

export { COMPUTERS, DEFAULT_PREVIEW_CLIENTS, PREVIEW_CLIENTS, WEBMAIL, type Computer, type EmailClientPreview, type PreviewClient, type PreviewVariant, type Skipped } from "./clients";
export { APPROXIMATE_FOR_HTML, DEFAULT_EMAIL_CLIENTS, EMAIL_CLIENTS, type EmailClient, type EmailClientInfo, type EmailClientMeasurement } from "./email-clients";

export interface EmailHtmlOptions {
  /** The email clients to preview (default: the four captured: classic Outlook, Outlook.com, Gmail and Apple Mail). */
  emailClients?: readonly EmailClient[];
  /** Also a dark preview, for the clients whose dark mode was measured (Apple Mail). */
  dark?: boolean;
  /** Where the preview's stand-in fonts come from: a URL (default), or inlined in each file, to draw offline. */
  fonts?: "url" | "inline";
  /**
   * The width (px) a client's preview draws the email at, where it isn't the client's own: `{ "outlook-com": 540 }` for
   * Outlook.com's reading pane beside its message list.
   */
  widths?: Partial<Record<PreviewClient, number>>;
  /** The computers Outlook.com and Gmail on the web are previewed as read on (default both): `outlook-com` (Windows), `outlook-com.mac`. */
  computers?: readonly Computer[];
}

/** Something found in the HTML: where it is (its line and an excerpt), and the clients it's about. */
export interface EmailHtmlDiagnostic {
  code: string;
  severity: "info" | "warning";
  message: string;
  /** The clients it's about. A diagnostic about the checks themselves (they couldn't all run) has none. */
  clients?: string[];
  fix?: string;
  see?: string;
  path: "html";
  /** The line in the given HTML (from 1), or null for a diagnostic about the email as a whole or the checks. */
  line: number | null;
  /** Up to 80 characters of that line. */
  excerpt?: string;
}

export interface EmailHtmlResult {
  /** One file per client and variant, in the order asked for, light before dark. */
  previews: EmailClientPreview[];
  /** What wasn't previewed, and why: a client with no model, a dark mode not measured. */
  skipped: Skipped[];
  /** What was found in the HTML for the clients previewed. (What a preview finds is in the file, once it's opened.) */
  diagnostics: EmailHtmlDiagnostic[];
}

/** The options renderInEmailClients(html) takes. */
const HTML_OPTIONS: readonly string[] = ["emailClients", "dark", "fonts", "widths", "computers"];

/** Throws unless `html` is a whole email: a string with an `<html>` and a `<body>` tag outside comments. */
export function checkWholeEmail(html: unknown, call = "renderInEmailClients(html)"): asserts html is string {
  if (typeof html !== "string") throw new TypeError(`[Elements] ${call} takes the email's HTML as a string, not ${html === null ? "null" : typeof html}`);
  const markup = html.replace(/<!--[\s\S]*?(?:-->|$)/g, "");
  if (!/<html[\s>]/i.test(markup) || !/<body[\s>/]/i.test(markup)) {
    throw new TypeError(`[Elements] ${call} takes a whole email, from <html> to </html>: this has no ${/<html[\s>]/i.test(markup) ? "<body>" : "<html>"} tag`);
  }
}

/** Throws on options that aren't an object, or name one the HTML entry doesn't take (render()'s, for one). */
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
 * Rejects with a TypeError for something that isn't a whole email or an option it doesn't take; with the import's error
 * where @hyper-elements/email-client-models can't be loaded; and with an Error named `email-clients/version-mismatch`
 * where the one installed speaks another protocol.
 */
export async function renderInEmailClients(html: string, options: EmailHtmlOptions = {}): Promise<EmailHtmlResult> {
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
