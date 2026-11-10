// What the skill suite's render tools and checker share, so the harness can replay a session (lib/replay.mjs):
//
// - A result line per run, signed: `[render] ok <out> in=<inputs> mac=<hmac>`, `[render] failed in=… mac=…`,
//   `[check] pass in=… mac=…` or `[check] fail in=… mac=…`. `out` is the sha256 of what the render wrote to out/;
//   `inputs` the sha256 of the run's sources and out/ when the step started; `mac` an HMAC of the line under the run's
//   secret (BENCH_SECRET), which the tool reads at startup and removes from its environment before loading anything
//   the agent wrote.
// - The clock and randomness a template reads, pinned (BENCH_CLOCK, the batch's start in ms): a preamble before the
//   submitted code fixes `Date`, `Date.now()` and `Intl.DateTimeFormat` called with no date, and seeds `Math.random`.
import { createHash, createHmac } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/** The run's secret, taken out of the environment: no code this process loads later can read it there. */
export function takeSecret() {
  const secret = process.env.BENCH_SECRET ?? "";
  delete process.env.BENCH_SECRET;
  return secret;
}

/** Every file under each folder (sorted, links not followed), as relative paths and bytes, hashed in one sha256. */
export function treeHash(run, folders) {
  const h = createHash("sha256");
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name);
      const s = statSync(p);
      if (s.isDirectory()) walk(p);
      else { h.update(`${relative(run, p)}\0${s.size}\0`); h.update(readFileSync(p)); }
    }
  };
  for (const f of folders) walk(join(run, f));
  return h.digest("hex");
}

/** What a step reads: the sources (src/, cards/) and out/. */
export const inputsHash = (run) => treeHash(run, ["src", "cards", "out"]);

/** A signed result line. */
export function resultLine(secret, tool, verdict, inputs, out = null) {
  const body = `[${tool}] ${verdict}${out ? ` ${out}` : ""} in=${inputs}`;
  return `${body} mac=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

/** The preamble that pins the clock and randomness, as JavaScript to run before the submitted code. */
export function clockBanner(clock = process.env.BENCH_CLOCK) {
  if (!clock) return "";
  const t = Number(clock);
  return `(() => {
  const T = ${t}, RealDate = globalThis.Date;
  function PinnedDate(...a) { if (!new.target) return new RealDate(T).toString(); return a.length ? new RealDate(...a) : new RealDate(T); }
  PinnedDate.prototype = RealDate.prototype;
  PinnedDate.now = () => T; PinnedDate.UTC = RealDate.UTC; PinnedDate.parse = RealDate.parse;
  globalThis.Date = PinnedDate;
  let s = ${t % 4294967296} >>> 0;
  Math.random = () => { s = (s + 0x6d2b79f5) >>> 0; let x = s; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  const P = Intl.DateTimeFormat.prototype, format = Object.getOwnPropertyDescriptor(P, "format").get, parts = P.formatToParts;
  Object.defineProperty(P, "format", { configurable: true, get() { const f = format.call(this); return (d) => f(d === undefined ? T : d); } });
  P.formatToParts = function (d) { return parts.call(this, d === undefined ? T : d); };
})();`;
}
