// The skill suite's copy of the image suite's render tool, with the clock and randomness pinned before the submitted
// code and a signed result line last (bench-runtime.mjs), so the harness can replay a session.
//
// Runs cards/render.tsx (or .ts), whose default export returns the image's PNG bytes, and writes out/card.png. The
// same file in every kit. It also writes out/card.trace.json, for tools/check.mjs: the text drawn, its fonts and the
// font files given, recorded by a stand-in for the kit's library (tools/tap.mjs for Satori, which Hyper Elements
// calls; tools/tap-canvas.mjs for @napi-rs/canvas; tools/tap-playwright.mjs for Playwright).
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { existsSync, realpathSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { clockBanner, inputsHash, resultLine, takeSecret, treeHash } from "./bench-runtime.mjs";

const secret = takeSecret();

const tools = dirname(fileURLToPath(import.meta.url));
const run = resolve(tools, "..");
const inputs = inputsHash(run);
const failed = () => console.log(resultLine(secret, "render", "failed", inputs));
const req = createRequire(join(run, "package.json"));
const entry = ["cards/render.tsx", "cards/render.ts"].map((f) => join(run, f)).find(existsSync);
if (!entry) {
  console.error("cards/render.tsx was not found.");
  failed();
  process.exit(1);
}

// One copy of React for the template and Hyper Elements (its own, when it's installed).
let reactFrom = req;
try { reactFrom = createRequire(realpathSync(req.resolve("@hyper-elements/react"))); } catch {}
const taps = { satori: join(tools, "tap.mjs"), "@napi-rs/canvas": join(tools, "tap-canvas.mjs"), playwright: join(tools, "tap-playwright.mjs") };

await mkdir(join(run, ".cache"), { recursive: true });
await mkdir(join(run, "out"), { recursive: true });
const out = join(run, ".cache", `render-${Date.now()}.mjs`);
try {
  await build({
    entryPoints: [entry], outfile: out, bundle: true, platform: "node", format: "esm", jsx: "automatic", logLevel: "silent",
    // Native and WebAssembly engines load at run time, from node_modules.
    external: ["@resvg/resvg-js", "satori", "@napi-rs/canvas", "playwright", "playwright-core"],
    banner: { js: `import { createRequire as __benchRequire } from "node:module"; const require = __benchRequire(import.meta.url);\n${clockBanner()}` },
    plugins: [{
      name: "bench",
      setup(b) {
        b.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, ({ path }) => ({ path: reactFrom.resolve(path) }));
        // Satori, @napi-rs/canvas and Playwright, through their taps, which record what's drawn.
        b.onResolve({ filter: /^(satori|@napi-rs\/canvas|playwright)$/ }, ({ path, importer }) => (Object.values(taps).includes(importer) ? { path, external: true } : { path: taps[path] }));
      },
    }],
  });
} catch (e) {
  console.error(e.errors?.map((x) => `${x.location?.file ?? ""}:${x.location?.line ?? ""} ${x.text}`).join("\n") ?? e.message);
  failed();
  process.exit(1);
}

// No network: a font or image is read from disk.
globalThis.fetch = async (input) => {
  throw new Error(`fetch(${typeof input === "string" ? input : input?.url ?? input}): the network is off`);
};
const warnings = [];
const warn = console.warn;
console.warn = (...args) => { warnings.push(args.map(String).join(" ")); warn(...args); };
globalThis.__benchTaps = [];

let bytes;
try {
  const mod = await import(pathToFileURL(out).href);
  if (typeof mod.default !== "function") throw new Error("cards/render.tsx's default export isn't a function");
  bytes = await mod.default();
  if (bytes && typeof bytes.arrayBuffer === "function" && !(bytes instanceof Uint8Array)) bytes = await bytes.arrayBuffer();
  if (bytes instanceof ArrayBuffer) bytes = new Uint8Array(bytes);
  if (!(bytes instanceof Uint8Array)) throw new Error("cards/render.tsx's default export didn't return the PNG's bytes (a Uint8Array, Buffer or ArrayBuffer)");
  const png = [0x89, 0x50, 0x4e, 0x47];
  if (!png.every((b, i) => bytes[i] === b)) throw new Error("cards/render.tsx returned bytes that aren't a PNG");
} catch (e) {
  if (Array.isArray(e?.diagnostics)) for (const d of e.diagnostics) console.error(`${d.severity ?? "error"} ${d.code} at ${d.path}: ${d.message}`);
  else console.error(e?.stack ?? String(e));
  failed();
  process.exit(1);
}

await writeFile(join(run, "out/card.png"), bytes);
// What drew it: Satori's last call (Hyper Elements, or Satori itself), or the canvas or Playwright stand-in's record.
const other = typeof globalThis.__benchTraceOf === "function" ? globalThis.__benchTraceOf() : null;
const call = other ?? globalThis.__benchTaps.at(-1) ?? null;
await writeFile(join(run, "out/card.trace.json"), JSON.stringify({
  png: createHash("sha256").update(bytes).digest("hex"),
  calls: other ? (other.screenshots ?? other.canvases ?? 1) : globalThis.__benchTaps.length,
  warnings,
  ...call,
}));
console.log(`Rendered out/card.png (${bytes.length} bytes).`);
console.log(resultLine(secret, "render", "ok", inputs, treeHash(run, ["out"])));
