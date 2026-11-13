/**
 * The email client models: @hyper-elements/email-client-models' browser script, which the preview inlines before the
 * runtime. It sets `EmailClientModels`: what each client does to the email, and what's found in what it draws. The
 * runtime owns the frames, the markers, the fonts' files and the images (plan email-client-models, D4).
 */
import type { Diagnostic } from "@hyper-elements/react";

export type Client = "outlook" | "outlook-com" | "gmail" | "gmail-app" | "gmail-app-other" | "apple-mail" | "apple-mail-ios" | "gmail-app-ios" | "yahoo" | "aol";

export interface Processed {
  /** The client's version of the email, with the block paths in it. */
  html: string;
  /** What the client removed or changed, by what: `{ "position": 2 }`. */
  removed: Record<string, number>;
  /** Gmail's clip: the UTF-8 byte offset it cut at, and the email's size in bytes. */
  cut: number | null;
  size?: number;
  /** What runs on the loaded frame; its report goes to `findings`. */
  frameStep: (win: Window) => FrameReport;
}

/** Opaque to the runtime: classic Outlook's line breaks, handed back to `findings`. */
export type FrameReport = Record<string, unknown>;

export type Missing = { kind: "font" | "substituted"; family: string };

export interface EmailClientModels {
  PROTOCOL: number;
  /** Compiles the WebAssembly module (once): every call below needs it. */
  ready(): Promise<void>;
  process(client: Client, html: string, options: { mark: (html: string, limit?: number) => string; dark?: boolean; fonts?: Record<string, string>; computer?: "windows" | "mac" }): Processed;
  findings(client: Client, options: { shown: Document; baseline: Document; report?: FrameReport; types: ReadonlyMap<string, string>; dark?: boolean }): Array<Diagnostic & { selector?: string }>;
  fontCss(client: Client, sources: Record<string, string>): string;
  checkSystemFonts(doc: Document, options: { loaded: Iterable<string>; standIns?: Iterable<string>; webFonts?: Iterable<string> }): { missing: Missing[]; fonts: Array<{ family: string; verified: "present" | "widths" }> };
}

/** The models' API, once its module is compiled. */
export async function loadModels(protocol: number): Promise<EmailClientModels> {
  const models = (globalThis as { EmailClientModels?: EmailClientModels }).EmailClientModels;
  if (!models) throw new Error("the email client models' script didn't run (the preview's CSP refused it, or it was removed)");
  if (models.PROTOCOL !== protocol) throw new Error(`the email client models speak protocol ${models.PROTOCOL}; this preview reads ${protocol}`);
  await models.ready();
  return models;
}
