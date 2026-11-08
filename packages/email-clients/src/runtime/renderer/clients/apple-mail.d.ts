// Types for apple-mail.js (email-renderer, copied unchanged).
export interface AppleMailResult {
  html: string;
  mode: "light" | "own" | "filter";
  dark: boolean;
  changed: Record<string, number>;
}
export const MAIL_DARK_BACKGROUND: string;
export const MAIL_DARK_LINK: string;
export function appleMail(html: string, options?: { dark?: boolean; script?: boolean }): AppleMailResult;
export function settleAppleMail(document: Document, result: Omit<AppleMailResult, "html">): void;
