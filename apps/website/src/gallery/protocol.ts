// What the templates pages (src/scripts/gallery-images.ts) and their image worker (worker.ts) say to each other.
export interface DrawImage {
  id: number;
  /** An image template's design, by its key: "images/og-card/launch". */
  design: string;
  /** A brand's id, as the pages name it: "orbit", or "spotify-original" for a company's. */
  brand: string;
}

export type DrawnImage = { id: number; ok: true; svg: string } | { id: number; ok: false; message: string };
