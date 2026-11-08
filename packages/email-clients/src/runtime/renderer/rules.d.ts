// Types for rules.js (email-renderer, copied unchanged): classic Outlook's rules, run on a loaded frame's window.
export interface OutlookBreak {
  block: Element;
  word: string;
  /** How much more room the line needed for the word to stay on it (≤ 0), or null for a break kept from the browser's own layout. */
  margin: number | null;
}
export interface OutlookRules {
  apply(without?: string[], with_?: string[]): { applied: string[]; breaks: OutlookBreak[] };
  missingFonts(): string[];
  names: string[];
}
export function createOutlookRules(win: Window, options?: { deviceScale?: number; squeeze?: number; hang?: number }): OutlookRules;
