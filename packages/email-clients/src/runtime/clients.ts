/**
 * Each email client's sequence, as email-renderer's scorer runs it: what's done to the email as a string (the block
 * paths written in at the step the client's processing keeps them), then, once the client's version has loaded in its
 * frame, what's done to the frame's document.
 */
import type { BlockMapEntry } from "@hyper-elements/react";
import { markPaths } from "./marks";
import { resolveConditionalComments } from "./renderer/conditional.mjs";
import { createOutlookRules, type OutlookBreak } from "./renderer/rules.js";
import { gmail, gmailClip } from "./renderer/clients/gmail.js";
import { outlookCom } from "./renderer/clients/outlook-com.js";
import { appleMail, settleAppleMail } from "./renderer/clients/apple-mail.js";

export type Client = "outlook" | "outlook-com" | "gmail" | "gmail-app" | "gmail-app-other" | "apple-mail";

/** What the client removed or changed, by what: `{ "position": 2 }`. */
export type Removed = Record<string, number>;

export interface Processed {
  /** The client's version of the email, with the block paths in it. */
  html: string;
  removed: Removed;
  /** Gmail's clip: the UTF-8 byte offset it cut at. */
  cut: number | null;
  /** What the frame step needs. */
  frameStep: (win: Window) => FrameReport;
}

export interface FrameReport {
  /** Classic Outlook's line breaks: each break its rules made, with how much more room the line needed for the word (≤ 0; null where the browser's own break was kept). */
  breaks?: OutlookBreak[];
}

const OFFICE_XML = /<xml>[\s\S]*?<\/xml>/gi;
const GMAIL_PROFILE = { gmail: "gmail-web", "gmail-app": "gmail-app", "gmail-app-other": "gmail-app-other" } as const;

/** The client's version of `html` (render()'s compact HTML), its block paths written in by `entries`. */
export function processForClient(client: Client, html: string, entries: readonly BlockMapEntry[], { dark = false } = {}): Processed {
  const none = () => ({});
  switch (client) {
    case "outlook": {
      // Markers first, then the conditional comments as Outlook reads them (a string step, before any parsing), then
      // Office's <xml> islands dropped; the rules run on the loaded frame.
      const resolved = resolveConditionalComments(markPaths(html, entries)).replace(OFFICE_XML, "");
      return {
        html: resolved,
        removed: {},
        cut: null,
        frameStep: (win) => {
          // At 96 DPI: what the captures were scored at.
          return { breaks: createOutlookRules(win, { deviceScale: 1 }).apply().breaks };
        },
      };
    }
    case "gmail":
    case "gmail-app":
    case "gmail-app-other": {
      // The clip on the unmarked bytes (102,400 of them), the markers in what it kept.
      const clip = gmailClip(html);
      const drawn = gmail(markPaths(clip.kept, entries, clip.cut ?? Number.POSITIVE_INFINITY), GMAIL_PROFILE[client], { clipped: clip.clipped, size: clip.size });
      return { html: drawn.html, removed: drawn.removed, cut: clip.clipped ? clip.cut : null, frameStep: none };
    }
    case "outlook-com": {
      const drawn = outlookCom(markPaths(html, entries));
      return { html: drawn.html, removed: drawn.removed, cut: null, frameStep: none };
    }
    case "apple-mail": {
      const drawn = appleMail(markPaths(html, entries), { dark, script: false });
      return {
        html: drawn.html,
        removed: drawn.changed,
        cut: null,
        frameStep: (win) => {
          settleAppleMail(win.document, drawn);
          return {};
        },
      };
    }
  }
}
