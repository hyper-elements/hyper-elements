// A template's code in a link: `#code=` is its UTF-8 text in base64url (easy to make by hand, or by an agent);
// `#z=` is the same text deflated first, which is what Share writes.

/** The longest code a link may carry, in characters, and the most a `#z=` may inflate to. */
export const MAX_CODE = 200_000;

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromBase64Url = (value: string): Uint8Array => {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

/** `code` as `#code=` carries it. */
export const encodeCode = (code: string): string => toBase64Url(new TextEncoder().encode(code));

async function pipe(bytes: Uint8Array, through: CompressionStream | DecompressionStream, limit: number): Promise<Uint8Array> {
  const reader = new Blob([bytes as BlobPart]).stream().pipeThrough(through).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    // A few bytes can inflate to gigabytes: stop reading at the limit.
    if (size > limit) {
      await reader.cancel();
      throw new Error("The link's code is too long");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/** `code` as `#z=` carries it, or undefined where this browser can't deflate. */
export async function compressCode(code: string): Promise<string | undefined> {
  if (typeof CompressionStream === "undefined") return undefined;
  return toBase64Url(await pipe(new TextEncoder().encode(code), new CompressionStream("deflate-raw"), 4 * MAX_CODE));
}

export interface LinkState {
  code?: string;
  /** Why the link's code couldn't be read. */
  problem?: string;
  root?: string;
  view?: string;
  device?: string;
  layout?: string;
  starter?: string;
}

/** What a link's hash says. The code is text to put in the editor: nothing here runs it. */
export async function readHash(hash: string): Promise<LinkState> {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const state: LinkState = {};
  for (const name of ["root", "view", "device", "layout", "starter"] as const) {
    const value = params.get(name);
    if (value && /^[a-z0-9-]{1,40}$/i.test(value)) state[name] = value.toLowerCase();
  }
  try {
    const z = params.get("z");
    const plain = params.get("code");
    if (z) {
      if (typeof DecompressionStream === "undefined") throw new Error("This browser can't read a compressed link");
      state.code = new TextDecoder("utf-8", { fatal: true }).decode(await pipe(fromBase64Url(z), new DecompressionStream("deflate-raw"), 4 * MAX_CODE));
    } else if (plain) {
      state.code = new TextDecoder("utf-8", { fatal: true }).decode(fromBase64Url(plain));
    }
    if (state.code !== undefined && state.code.length > MAX_CODE) throw new Error("The link's code is too long");
  } catch (error) {
    state.code = undefined;
    state.problem = error instanceof Error && /too long|can't read/.test(error.message) ? error.message : "The link's code couldn't be read";
  }
  return state;
}

/** A link that opens the playground with this code. */
export async function shareUrl(code: string, options: { view?: string; device?: string; layout?: string } = {}): Promise<string> {
  const params = new URLSearchParams();
  const z = await compressCode(code).catch(() => undefined);
  if (z) params.set("z", z);
  else params.set("code", encodeCode(code));
  for (const [name, value] of Object.entries(options)) if (value) params.set(name, value);
  const url = new URL(location.href);
  url.hash = params.toString();
  return url.href;
}
