/**
 * @hyper-elements/email-client-models (closed, free to use; see its LICENSE): what this package uses of its Node
 * entry. It ships no types of its own.
 */
declare module "@hyper-elements/email-client-models" {
  /** The message format its browser script and checks read; this package refuses one it doesn't know. */
  export const PROTOCOL: number;
  /** Compiles the WebAssembly module, once: every call below needs it. */
  export function ready(): Promise<void>;
  /** The checks only captures found, on core's PluginInput (synchronous, after ready()). */
  export function check(input: { root: unknown }): Array<{ code: string; severity: "info" | "warning"; message: string; path: string; nodeId?: string; clients: string[]; fix?: string; see?: string }>;
  /**
   * The checks only captures found, on a whole email's HTML (1.8.0 and later; undefined before): at most one entry per
   * pattern, at its first match, with classic Outlook's conditional comments blanked (synchronous, after ready()).
   */
  export const checkHtml: ((input: { html: string }) => Array<{ code: "email/html-css"; severity: "info"; message: string; clients: string[]; fix: string; line: number | null }>) | undefined;
  /** Its build's markers and protocol. */
  export function about(): { protocol: number; build: string[] };
  /** The open font files a client's preview loads (this package gives each its URL). */
  export function fontFiles(client: string, computer?: "windows" | "mac"): string[];
  /** The faces a preview frame waits for before measuring ("style weight 16px family"). */
  export function facesToLoad(client: string, computer?: "windows" | "mac"): string[];
  /** The stand-in families a client draws with, which the system font check passes over. */
  export function standIns(client: string, computer?: "windows" | "mac"): string[];
  /** The browser script a preview inlines (it sets EmailClientModels), and its sha256 for the preview's CSP. */
  export const SCRIPT: string;
  export const SCRIPT_SHA256: string;
}
