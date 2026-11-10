/**
 * What a preview finds in what it draws that's the open runtime's: Gmail's clip (its 102 KB limit is public, and the
 * cut comes from the models' `process`). The drawn findings (classic Outlook's extra lines, Apple Mail's dark-mode
 * contrast) are the models' `findings`, with their thresholds.
 */
import type { BlockMapEntry, Diagnostic } from "@hyper-elements/react";

export type Finding = Diagnostic & { selector?: string };

/** email/size (Gmail): the email is clipped, at the block the clip cuts into. */
export function clipped(client: "gmail" | "gmail-app" | "gmail-app-other", cut: number, size: number, entries: readonly BlockMapEntry[]): Diagnostic {
  const at = entries.filter((e) => e.offset <= cut).reduce<BlockMapEntry | null>((best, e) => (!best || e.offset >= best.offset ? e : best), null);
  return {
    code: "email/size",
    severity: client === "gmail" ? "warning" : "info",
    message: `The email is ${Math.round(size / 1024)} KB; Gmail clips a message after ${Math.round(cut / 1024)} KB ("[Message clipped]"), here`,
    path: at?.path ?? "root",
    clients: [client],
    fix: "shorten the email, or move long sections to a page: what follows the clip is behind a link",
  };
}
