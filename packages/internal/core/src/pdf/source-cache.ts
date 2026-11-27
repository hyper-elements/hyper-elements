/**
 * What's worked out from an image's source (a data URI: a size read from its header, a hash of its bytes), kept by
 * the source, the most recently used first: at most 1,000 sources, and at most 16 million characters of them between
 * them (a 1 MB file is 1.4 million as base64). A server rendering many Documents, each with its own large image, keeps
 * the last few, not the last 1,000 (the 1,000 a few GB); a page view paginated at each keystroke keeps its own
 * Document's images. A source longer than that (a file of 12 MB or more) is kept apart, the last one only: it doesn't
 * push the others out, and a header drawn on every page with it is worked out once.
 */
const caches = new Set<SourceCache<unknown>>();

export class SourceCache<V> {
  private readonly entries = new Map<string, V>();
  private kept = 0;
  /** The last source longer than `characters`, kept apart. */
  private large?: { src: string; value: V };

  constructor(
    readonly count = 1000,
    readonly characters = 16_000_000
  ) {
    caches.add(this as SourceCache<unknown>);
  }

  get(src: string): V | undefined {
    if (src.length > this.characters) return this.large?.src === src ? this.large.value : undefined;
    const value = this.entries.get(src);
    if (value !== undefined) {
      this.entries.delete(src);
      this.entries.set(src, value);
    }
    return value;
  }

  set(src: string, value: V): void {
    if (src.length > this.characters) {
      this.large = { src, value };
      return;
    }
    if (this.entries.has(src)) this.delete(src);
    this.entries.set(src, value);
    this.kept += src.length;
    while (this.entries.size > this.count || this.kept > this.characters) this.delete(this.entries.keys().next().value!);
  }

  private delete(src: string): void {
    this.entries.delete(src);
    this.kept -= src.length;
  }

  /** The characters of source it keeps, the one kept apart too. */
  get size(): number {
    return this.kept + (this.large?.src.length ?? 0);
  }
}

/** The most characters of source any one SourceCache keeps: for a test. */
export const sourcesKept = (): number => Math.max(0, ...[...caches].map((cache) => cache.size));
