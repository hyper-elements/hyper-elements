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

export interface PreviewVariant {
  /** `<client>` or `<client>.dark`. */
  id: string;
  client: PreviewClient;
  /** Desktop (820px), or a phone (375px) for the Gmail apps. */
  variant: "desktop" | "phone";
  dark: boolean;
  /** The width the client shows the email at, in px. */
  width: number;
  /** `<id>.html`. */
  filename: string;
  /** Its model is an approximation (classic Outlook, and the clients not captured): the preview says so. */
  approximate: boolean;
}

export interface Skipped {
  client: EmailClient;
  dark: boolean;
  reason: string;
}

const previewable = (client: EmailClient): client is PreviewClient => (PREVIEW_CLIENTS as readonly string[]).includes(client);

/** The previews of `clients` (in their order, each once, light before dark), and what's skipped. */
export function variantsOf(clients: readonly EmailClient[], dark: boolean, info: Readonly<Record<EmailClient, EmailClientInfo>>): { variants: PreviewVariant[]; skipped: Skipped[] } {
  const unknown = clients.filter((client) => !info[client]);
  if (unknown.length) throw new TypeError(`[Elements] renderInEmailClients() doesn't know the email client ${unknown.map((c) => JSON.stringify(c)).join(", ")}: the clients are EMAIL_CLIENTS' keys`);
  const variants: PreviewVariant[] = [];
  const skipped: Skipped[] = [];
  for (const client of [...new Set(clients)]) {
    const { name, widths, approximate } = info[client];
    if (!previewable(client)) {
      skipped.push({ client, dark: false, reason: `${name} has no model to draw with: what's known of it is caniemail's tables` });
      continue;
    }
    const variant = widths.desktop !== undefined ? "desktop" : "phone";
    const width = widths[variant] ?? (variant === "desktop" ? 820 : 375);
    const light = { id: client, client, variant, dark: false, width, filename: `${client}.html`, approximate } as const;
    variants.push(light);
    if (!dark) continue;
    if (info[client].dark) variants.push({ ...light, id: `${client}.dark`, dark: true, filename: `${client}.dark.html` });
    else skipped.push({ client, dark: true, reason: `${name}'s dark mode isn't measured` });
  }
  return { variants, skipped };
}
