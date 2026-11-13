// fflate's asynchronous functions, for the sandbox. fflate runs each on a Worker of its own, and the code the sandbox
// runs has no Worker (core.ts takes it away, so a template can't start one). react-pdf's PNG reader calls one
// (`inflate`) for a PNG with transparency. Here each does its work with fflate's synchronous function and answers on
// the next turn, as fflate's own do: the same bytes, without a Worker.
type Callback = (error: Error | null, data?: Uint8Array) => void;
type Async = (data: Uint8Array, options?: unknown | Callback, callback?: Callback) => () => void;

/** Each asynchronous function and its synchronous twin. Options go through only where they mean the same in both. */
const TWINS = {
  inflate: ["inflateSync", false],
  unzlib: ["unzlibSync", false],
  gunzip: ["gunzipSync", false],
  decompress: ["decompressSync", false],
  deflate: ["deflateSync", true],
  zlib: ["zlibSync", true],
  gzip: ["gzipSync", true],
} as const;

export function sync(real: Record<string, unknown>): Record<keyof typeof TWINS, Async> {
  const made = {} as Record<keyof typeof TWINS, Async>;
  for (const [name, [twin, options]] of Object.entries(TWINS) as Array<[keyof typeof TWINS, (typeof TWINS)[keyof typeof TWINS]]>) {
    made[name] = (data, given, callback) => {
      if (typeof given === "function") {
        callback = given as Callback;
        given = undefined;
      }
      if (typeof callback !== "function") throw new TypeError(`fflate's ${name}() needs a callback`);
      let result: Uint8Array | undefined;
      let error: Error | null = null;
      try {
        const run = real[twin] as (data: Uint8Array, options?: unknown) => Uint8Array;
        result = options && given !== undefined ? run(data, given) : run(data);
      } catch (caught) {
        error = caught instanceof Error ? caught : new Error(String(caught));
      }
      // fflate answers later, never in the call: so does this, and it can be called off like fflate's.
      let off = false;
      setTimeout(() => off || callback!(error, result), 0);
      return () => {
        off = true;
      };
    };
  }
  return made;
}
