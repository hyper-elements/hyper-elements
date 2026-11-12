/**
 * renderInEmailClients() given an HTML email as a string, however it was made (MJML, React Email, by hand, an email
 * builder's export): the same previews, with no core and no React loaded. Nothing this module reaches imports them.
 */
import { checkComputers, checkWidths, DEFAULT_PREVIEW_CLIENTS, variantsOf, type Computer, type EmailClientPreview, type PreviewClient, type Skipped } from "./clients";
import { APPROXIMATE_FOR_HTML, checkClients, EMAIL_CLIENTS, forClients, type EmailClient } from "./email-clients";
import { documentNotes, type EmailHtmlDiagnostic } from "./html";
import { asError, loadModels } from "./load-models";
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
export async function previewHtml(html: string, options: HtmlOptions = {}): Promise<{ previews: EmailClientPreview[]; skipped: Skipped[]; diagnostics: EmailHtmlDiagnostic[] }> {
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
  // The checks for the clients previewed, as a template's render() gets them.
  return { previews, skipped, diagnostics: await checksOf(html, clients) };
}

/** A diagnostic about the checks themselves: no clients, no line. */
const aboutTheChecks = (severity: "info" | "warning", message: string, fix: string): EmailHtmlDiagnostic => ({ code: "email/captured-checks", severity, message, fix, path: "html", line: null });

/** The line's excerpt in `html`, as documentNotes() gives it. */
const excerptAt = (html: string, line: number | null) => (line === null ? {} : { excerpt: (html.split("\n")[line - 1] ?? "").trim().slice(0, 80) });

/**
 * The open checks on `html` (documentNotes()), and the models' captured ones where they can run (check({ html }), models
 * 1.8.0 and later), for `clients`, by line. Without them, or where the models can't run, a diagnostic about the checks
 * says so and the open checks stand; a protocol this package doesn't read throws.
 */
async function checksOf(html: string, clients: readonly EmailClient[]): Promise<EmailHtmlDiagnostic[]> {
  const found = documentNotes(html);
  const { models, unavailable } = await loadModels();
  if (unavailable) {
    found.push(aboutTheChecks("warning", `The captured email client checks didn't load (${unavailable.message}): only the checks from caniemail's tables ran`, "install @hyper-elements/email-client-models where it can load (it comes with this package): Node 20 or later, or a browser with WebAssembly"));
  } else {
    try {
      for (const entry of models.check({ html })) {
        found.push({ code: entry.code, severity: entry.severity, message: entry.message, clients: entry.clients as EmailClient[], ...(entry.fix ? { fix: entry.fix } : {}), path: "html", line: entry.line ?? null, ...excerptAt(html, entry.line ?? null) });
      }
    } catch (error) {
      const message = asError(error).message;
      // Models before 1.8.0 check only a template's tree: given HTML, they say there's no root.
      if (/\bno root$/.test(message)) found.push(aboutTheChecks("info", "The installed @hyper-elements/email-client-models checks only templates (1.8.0 and later check HTML too): only the checks from caniemail's tables ran", "update it: npm update @hyper-elements/email-client-models"));
      else found.push(aboutTheChecks("warning", `The captured email client checks failed on this email (${message}): only the checks from caniemail's tables ran`, "report it, with the email, to Hyper Elements"));
    }
  }
  return forClients(found, clients).sort((a, b) => (a.line ?? Infinity) - (b.line ?? Infinity));
}
