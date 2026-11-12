/**
 * Which previews a call writes: one per email client asked for that has a model to draw with (@hyper-elements/email-client-models),
 * at the width EMAIL_CLIENTS gives it, and a dark one where its dark mode was measured. The rest are skipped,
 * each with the reason.
 */
import type { EmailClient, EmailClientInfo } from "./email-clients";

/** The email clients there's a model to preview with. */
export const PREVIEW_CLIENTS = ["outlook", "outlook-com", "gmail", "gmail-app", "gmail-app-other", "apple-mail"] as const satisfies readonly EmailClient[];

export type PreviewClient = (typeof PREVIEW_CLIENTS)[number];

/** The clients previewed when none are named: the four captured. */
export const DEFAULT_PREVIEW_CLIENTS: readonly PreviewClient[] = ["outlook", "outlook-com", "gmail", "apple-mail"];

/** The computer a webmail client is read on: its fonts are what an email's font stacks resolve against. */
export type Computer = "windows" | "mac";
export const COMPUTERS: readonly Computer[] = ["windows", "mac"];

/** The webmail clients, read in a browser on either computer: a preview each, on Windows as `<client>`, on a Mac as `<client>.mac`. */
export const WEBMAIL: readonly PreviewClient[] = ["outlook-com", "gmail"];

export interface PreviewVariant {
  /** `<client>`, `<client>.mac` (webmail read on a Mac) or `<client>.dark`. */
  id: string;
  client: PreviewClient;
  /** For webmail (Outlook.com, Gmail on the web), the computer it's read on. */
  computer?: Computer;
  /** Desktop (820px), or a phone (380px, the width the Gmail app on Android lays an email out at) for the Gmail apps. */
  variant: "desktop" | "phone";
  dark: boolean;
  /** The width the client shows the email at, in px. */
  width: number;
  /** `<id>.html`. */
  filename: string;
  /** Its model is an approximation (classic Outlook, and the clients not captured): the preview says so. */
  approximate: boolean;
}

export interface EmailClientPreview extends PreviewVariant {
  /** The preview file: open it in Chromium. */
  html: string;
}

export interface Skipped {
  client: EmailClient;
  dark: boolean;
  reason: string;
}

const previewable = (client: EmailClient): client is PreviewClient => (PREVIEW_CLIENTS as readonly string[]).includes(client);

/** The narrowest and widest a preview draws an email at. */
export const PREVIEW_WIDTHS = { min: 240, max: 2560 } as const;

/** Throws on `computers` that isn't a list of them. */
export function checkComputers(computers: unknown): asserts computers is readonly Computer[] | undefined {
  if (computers === undefined) return;
  if (!Array.isArray(computers) || !computers.length || computers.some((c) => !COMPUTERS.includes(c))) {
    throw new TypeError(`[Elements] renderInEmailClients({ computers }) takes a list of ${COMPUTERS.map((c) => JSON.stringify(c)).join(" and ")}, not ${JSON.stringify(computers)}`);
  }
}

/** Throws on `widths` that aren't a width in px for clients there's a model of. */
export function checkWidths(widths: unknown): asserts widths is Partial<Record<PreviewClient, number>> | undefined {
  if (widths === undefined) return;
  if (!widths || typeof widths !== "object" || Array.isArray(widths)) throw new TypeError(`[Elements] renderInEmailClients({ widths }) takes an object of widths by client, such as { "outlook-com": 540 }`);
  for (const [client, width] of Object.entries(widths)) {
    if (!previewable(client as EmailClient)) throw new TypeError(`[Elements] renderInEmailClients({ widths }) has ${JSON.stringify(client)}, which isn't a client there's a model of: ${PREVIEW_CLIENTS.join(", ")}`);
    if (typeof width !== "number" || !Number.isFinite(width) || width < PREVIEW_WIDTHS.min || width > PREVIEW_WIDTHS.max) {
      throw new TypeError(`[Elements] renderInEmailClients({ widths }) gives ${client} ${JSON.stringify(width)}: a width is a number of px from ${PREVIEW_WIDTHS.min} to ${PREVIEW_WIDTHS.max}`);
    }
  }
}

/** The previews of `clients` (checked by checkClients: in their order, each once, light before dark), and what's skipped. */
export function variantsOf(clients: readonly EmailClient[], dark: boolean, info: Readonly<Record<EmailClient, EmailClientInfo>>, widthsAsked: Partial<Record<PreviewClient, number>> = {}, computers: readonly Computer[] = COMPUTERS): { variants: PreviewVariant[]; skipped: Skipped[] } {
  const variants: PreviewVariant[] = [];
  const skipped: Skipped[] = [];
  for (const client of [...new Set(clients)]) {
    const { name, widths, approximate } = info[client];
    if (!previewable(client)) {
      skipped.push({ client, dark: false, reason: `${name} has no model to draw with: what's known of it is caniemail's tables` });
      continue;
    }
    const variant = widths.desktop !== undefined ? "desktop" : "phone";
    const width = Math.round(widthsAsked[client] ?? widths[variant] ?? (variant === "desktop" ? 820 : 380));
    const light = { id: client, client, variant, dark: false, width, filename: `${client}.html`, approximate } as const;
    if (WEBMAIL.includes(client)) {
      // A preview for each computer it's read on: Windows as `<client>`, a Mac as `<client>.mac`.
      for (const computer of [...new Set(computers)]) {
        const id = computer === "windows" ? client : `${client}.mac`;
        variants.push({ ...light, id, computer, filename: `${id}.html` });
      }
    } else variants.push(light);
    if (!dark) continue;
    if (info[client].dark) variants.push({ ...light, id: `${client}.dark`, dark: true, filename: `${client}.dark.html` });
    else skipped.push({ client, dark: true, reason: `${name}'s dark mode isn't measured` });
  }
  return { variants, skipped };
}
