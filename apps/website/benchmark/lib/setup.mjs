// Installs Hyper Elements into node_modules under its published name, from a built checkout of the engine:
//   HYPER_ELEMENTS_PACKAGE=/path/to/checkout/packages/react node lib/setup.mjs
// Its dist/ is copied (renamed), its agent guide copied with the package's new name, and the checkout's commit recorded
// (source.json), so every result says which engine code made it. Once @hyper-elements/react is on npm, add it to
// package.json instead and skip this.
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const bench = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = process.env.HYPER_ELEMENTS_PACKAGE && resolve(process.env.HYPER_ELEMENTS_PACKAGE);
if (!src) throw new Error("Set HYPER_ELEMENTS_PACKAGE to a built checkout's packages/react.");
const dest = join(bench, "node_modules/@hyper-elements/react");
await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });
// A copy, not a link: a run's node_modules is a copy of this one, and nothing in it may point back into the checkout
// (an agent could follow a link to the engine's source or the benchmark's own files). The entries import the main
// one by the package's name; renamed here, it's the same file under the published name.
await mkdir(join(dest, "dist"), { recursive: true });
for (const f of await readdir(join(src, "dist"))) {
  const from = join(src, "dist", f);
  if (/\.(js|cjs|d\.ts|d\.cts)$/.test(f)) await writeFile(join(dest, "dist", f), (await readFile(from, "utf8")).replaceAll("@unlayer/react-elements", "@hyper-elements/react"));
  else await copyFile(from, join(dest, "dist", f));
}
const { version } = JSON.parse(await readFile(join(src, "package.json"), "utf8"));
const entry = (name) => ({ types: `./dist/${name}.d.ts`, import: `./dist/${name}.js`, require: `./dist/${name}.cjs` });
await writeFile(join(dest, "package.json"), JSON.stringify({
  name: "@hyper-elements/react", version,
  exports: { ".": entry("primitives"), "./image": entry("image"), "./pdf": entry("pdf"), "./package.json": "./package.json" },
  peerDependencies: { react: ">=18", "react-dom": ">=18", satori: "^0.33.5", "@resvg/resvg-js": "^2.6.2", "@react-pdf/renderer": "^4.9.0" },
}, null, 2));
for (const f of ["GUIDE.md", "REFERENCE.md"]) {
  const text = (await readFile(join(src, f), "utf8")).replaceAll("@unlayer/react-elements", "@hyper-elements/react").replace(/^<!-- Written from the component definitions.*\n/m, "");
  await writeFile(join(dest, f), text);
}
const git = (...args) => execFileSync("git", ["-C", src, ...args], { encoding: "utf8" }).trim();
let source = { version };
try {
  source = { version, commit: git("rev-parse", "HEAD"), dirty: git("status", "--porcelain", "--", ".", "../core").length > 0 };
} catch {}
await writeFile(join(dest, "source.json"), JSON.stringify(source, null, 2) + "\n");
console.log(`@hyper-elements/react ${version} (${source.commit?.slice(0, 10) ?? "no git"}${source.dirty ? ", dirty" : ""}) → ${dest}`);
