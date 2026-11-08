/**
 * The email clients Elements checks an Email for. Four were captured showing Elements 0.3.0 emails they weren't tuned
 * on (unlayer/email-renderer), which says how closely each is measured; what's known of the rest is from caniemail's
 * tables (caniemail.com, MIT), which test the CSS and HTML each client keeps. Either way a problem is said at its own
 * severity; only one Elements assumes, unchecked, is a note.
 */
import type { ClientFields, Diagnostic, Diagnostics, Severity } from "./diagnostics";

export type EmailClient =
  | "outlook"
  | "outlook-com"
  | "outlook-mac"
  | "outlook-app"
  | "gmail"
  | "gmail-app"
  | "gmail-app-other"
  | "apple-mail"
  | "yahoo"
  | "aol"
  | "samsung-email"
  | "thunderbird"
  | "protonmail"
  | "fastmail"
  | "hey"
  | "gmx"
  | "web-de"
  | "orange"
  | "sfr"
  | "laposte"
  | "free-fr"
  | "t-online-de"
  | "mail-ru"
  | "ionos"
  | "wp-pl"
  | "rainloop";

export interface EmailClientMeasurement {
  /** The Elements version whose emails were captured. */
  elements: string;
  /** The client captured. */
  against: string;
  /** When (an ISO date). */
  captured: string;
  /** Of the words in emails it wasn't tuned on, the share a model of the client draws within 4px of the client. */
  wordsWithin4px: number;
  /** Of neighbouring word pairs, the share on the same line, or on different lines, in both. */
  lineBreaks: number;
}

export interface EmailClientInfo {
  name: string;
  /** The widths it shows an email at, where it's been measured. */
  widths: { desktop?: number; phone?: number };
  /** Whether its dark mode was measured. */
  dark: boolean;
  /** Whether its model is an approximation (words placed within 4px well short of all of them). */
  approximate: boolean;
  /** Its captures; null where what's known of it is caniemail's. */
  measured: EmailClientMeasurement | null;
}

const captured = (against: string, wordsWithin4px: number, lineBreaks: number): EmailClientMeasurement => ({ elements: "0.3.0", against, captured: "2026-11-08", wordsWithin4px, lineBreaks });

/** A client known from caniemail's tables, not captured. */
const tables = (name: string): EmailClientInfo => ({ name, widths: {}, dark: false, approximate: true, measured: null });

export const EMAIL_CLIENTS: Readonly<Record<EmailClient, EmailClientInfo>> = {
  outlook: { name: "Classic Outlook", widths: { desktop: 820 }, dark: false, approximate: true, measured: captured("Outlook 16.0.20527 for Windows, 96 DPI", 0.85, 0.983) },
  "outlook-com": { name: "Outlook.com and new Outlook", widths: { desktop: 820 }, dark: false, approximate: false, measured: captured("Outlook on the web", 1, 1) },
  "outlook-mac": tables("Outlook for Mac"),
  "outlook-app": tables("Outlook app (iOS and Android)"),
  gmail: { name: "Gmail", widths: { desktop: 820 }, dark: false, approximate: false, measured: captured("Gmail on the web", 1, 1) },
  "gmail-app": { name: "Gmail app", widths: { phone: 375 }, dark: false, approximate: true, measured: null },
  "gmail-app-other": { name: "Gmail app, another account", widths: { phone: 375 }, dark: false, approximate: true, measured: null },
  "apple-mail": { name: "Apple Mail", widths: { desktop: 820 }, dark: true, approximate: false, measured: captured("Mail 16 on macOS 26", 0.999, 0.999) },
  yahoo: tables("Yahoo Mail"),
  aol: tables("AOL Mail"),
  "samsung-email": tables("Samsung Email"),
  thunderbird: tables("Thunderbird"),
  protonmail: tables("Proton Mail"),
  fastmail: tables("Fastmail"),
  hey: tables("HEY"),
  gmx: tables("GMX"),
  "web-de": tables("WEB.DE"),
  orange: tables("Orange"),
  sfr: tables("SFR"),
  laposte: tables("La Poste"),
  "free-fr": tables("Free"),
  "t-online-de": tables("T-Online"),
  "mail-ru": tables("Mail.ru"),
  ionos: tables("IONOS (1&1)"),
  "wp-pl": tables("WP Poczta"),
  rainloop: tables("RainLoop"),
};

/**
 * What's checked when no clients are named: the ones most email is read in (the four captured, the Gmail and Outlook
 * apps, Outlook for Mac, Yahoo, AOL and Samsung Email). The others only when named.
 */
export const DEFAULT_EMAIL_CLIENTS: readonly EmailClient[] = ["outlook", "outlook-com", "outlook-mac", "outlook-app", "gmail", "gmail-app", "gmail-app-other", "apple-mail", "yahoo", "aol", "samsung-email"];

/** caniemail's page about a feature (its slug, as in the page's address). */
export const caniemail = (feature: string): string => `https://www.caniemail.com/features/${feature}/`;

/** Throws on what isn't a list of email clients (an option given wrong, not a template's problem). */
export function checkEmailClients(clients: unknown): void {
  if (clients === undefined) return;
  const unknown = Array.isArray(clients) ? clients.filter((c) => !Object.prototype.hasOwnProperty.call(EMAIL_CLIENTS, c as string)) : [clients];
  if (unknown.length) throw new TypeError(`[Elements] emailClients takes a list of ${Object.keys(EMAIL_CLIENTS).join(", ")}, not ${unknown.map((c) => JSON.stringify(c)).join(", ")}`);
}

/**
 * The diagnostics for the email clients asked for: one about some clients is kept where they meet the selection, with
 * its clients narrowed to them; one about none in particular is always kept. Diagnostics equal in code, path, severity
 * and message are one, with the clients of both.
 */
export function forEmailClients(diagnostics: readonly Diagnostic[], selection: readonly EmailClient[] = DEFAULT_EMAIL_CLIENTS): Diagnostic[] {
  const out: Diagnostic[] = [];
  const seen = new Map<string, Diagnostic>();
  for (const d of diagnostics) {
    if (!d.clients) {
      out.push(d);
      continue;
    }
    const clients = d.clients.filter((c) => selection.includes(c));
    if (!clients.length) continue;
    const key = JSON.stringify([d.code, d.path, d.severity, d.message]);
    const same = seen.get(key);
    if (same) same.clients = [...new Set([...same.clients!, ...clients])];
    else {
      const kept = { ...d, clients };
      seen.set(key, kept);
      out.push(kept);
    }
  }
  return out;
}

/** One problem with some email clients, as a diagnostic at its severity; where Elements assumes it, unchecked, a note. */
export function addForClients(d: Diagnostics, code: string, severity: Severity, message: string, path: string, nodeId: string | undefined, extra: ClientFields & { assumed?: boolean }): void {
  const { assumed, ...fields } = extra;
  if (assumed) d.add(code, "info", `${message} (not checked)`, path, nodeId, fields);
  else d.add(code, severity, message, path, nodeId, fields);
}
