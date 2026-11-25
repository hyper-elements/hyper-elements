// What the Open Graph image generator's page (main.ts) and its worker (worker.ts) say to each other.
import type { Problem } from "./engine";

export interface DrawRequest {
  id: number;
  /** A design's name: "clean", "cover", … (engine.ts' DESIGNS). */
  design: string;
  /** The design's field values, as the form has them. */
  values: Record<string, unknown>;
  /** The visitor's photo and logo, by the src their values name ("./photo.jpg"). */
  uploads: Record<string, ArrayBuffer>;
  /** "svg" to show and to turn into PNG and JPEG on the page; "png" where the browser can't. */
  format: "svg" | "png";
}

export type DrawReply = { id: number; ok: true; image: ArrayBuffer; problems: Problem[] } | { id: number; ok: false; problems: Problem[] };

export type { Problem };
