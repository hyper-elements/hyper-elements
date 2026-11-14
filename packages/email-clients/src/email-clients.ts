/**
 * The email clients the plugin checks an Email for (moved from core in 0.4.0, unchanged). Four were captured showing
 * Elements 0.3.0 emails they weren't tuned on, which says how closely each is measured; what's known of the rest is
 * from caniemail's tables (caniemail.com, MIT), which test the CSS and HTML each client keeps. Either way a problem is
 * said at its own severity; only one Elements assumes, unchecked, is a note.
 */
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
  "outlook-mac": { name: "Outlook for Mac", widths: { desktop: 820 }, dark: true, approximate: true, measured: null },
  "outlook-app": tables("Outlook app (iOS and Android)"),
  gmail: { name: "Gmail", widths: { desktop: 820 }, dark: false, approximate: false, measured: captured("Gmail on the web", 1, 1) },
  "gmail-app": { name: "Gmail app", widths: { phone: 380 }, dark: false, approximate: true, measured: null },
  "gmail-app-other": { name: "Gmail app, another account", widths: { phone: 380 }, dark: false, approximate: true, measured: null },
  "apple-mail": { name: "Apple Mail", widths: { desktop: 820, phone: 393 }, dark: true, approximate: false, measured: captured("Mail 16 on macOS 26", 0.999, 0.999) },
  // Yahoo Mail and AOL Mail on the web (models 1.11.0): their message panes, 758px and 869px, in a 1440px window. AOL's
  // dark mode leaves the email as it is, so its dark preview is its light one.
  yahoo: { name: "Yahoo Mail", widths: { desktop: 758 }, dark: true, approximate: false, measured: null },
  aol: { name: "AOL Mail", widths: { desktop: 869 }, dark: true, approximate: true, measured: null },
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

/**
 * The previews (by id) that are approximate for HTML not built with Hyper Elements: those under 95% on such emails in
 * the latest benchmark (classic Outlook, the Gmail app, Apple Mail's dark mode), and those not measured on them (the
 * Gmail app with another account, Gmail and Outlook.com read on a Mac, Apple Mail and the Gmail app on an iPhone, and
 * Yahoo Mail, AOL Mail and Outlook for Mac, each measured on two).
 * A release that moves one over the line changes this list and the docs' numbers together.
 */
export const APPROXIMATE_FOR_HTML: readonly string[] = ["outlook", "gmail-app", "apple-mail.dark", "gmail-app-other", "gmail.mac", "outlook-com.mac", "apple-mail.iphone", "apple-mail.iphone.dark", "gmail-app.iphone", "yahoo", "yahoo.mac", "yahoo.dark", "yahoo.mac.dark", "aol", "aol.mac", "aol.dark", "aol.mac.dark", "outlook-mac", "outlook-mac.dark"];

/** caniemail's page about a feature (its slug, as in the page's address). */
export const caniemail = (feature: string): string => `https://www.caniemail.com/features/${feature}/`;

/** Throws on what isn't a list of email clients (an option given wrong, not a template's problem). */
export function checkClients(clients: unknown, option = "clients"): asserts clients is readonly EmailClient[] | undefined {
  if (clients === undefined) return;
  const unknown = Array.isArray(clients) ? clients.filter((c) => !Object.prototype.hasOwnProperty.call(EMAIL_CLIENTS, c as string)) : [clients];
  if (unknown.length) throw new TypeError(`[Elements] ${option} takes a list of ${Object.keys(EMAIL_CLIENTS).join(", ")}, not ${unknown.map((c) => JSON.stringify(c)).join(", ")}`);
}

/** A diagnostic that may name the clients it's about. */
export interface ClientDiagnostic {
  code: string;
  severity: "info" | "warning";
  message: string;
  path: string;
  nodeId?: string;
  clients?: readonly string[];
  fix?: string;
  see?: string;
}

/**
 * The diagnostics for the email clients asked for: one about some clients is kept where they meet the selection, with
 * its clients narrowed to them; one about none in particular is always kept. Equal ones (code, path, severity and
 * message) are merged by core, with the clients of both, as it does every plugin's.
 */
export function forClients<D extends ClientDiagnostic>(diagnostics: readonly D[], selection: readonly string[] = DEFAULT_EMAIL_CLIENTS): D[] {
  const out: D[] = [];
  for (const d of diagnostics) {
    if (!d.clients) out.push(d);
    else {
      const clients = d.clients.filter((c) => selection.includes(c));
      if (clients.length) out.push({ ...d, clients });
    }
  }
  return out;
}
