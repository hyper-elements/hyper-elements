// Renders src/template.tsx, whose default export is a component that returns the template's root, with Hyper Elements.
//
//   node tools/render.mjs          an Email: render() to out/email.html, and its plain text to out/email.txt
//   node tools/render.mjs --page   a Page: render() to out/page.html
//   node tools/render.mjs --pdf    a Document: renderPdf() to out/document.pdf, with Inter from fonts/
//
// It prints every diagnostic, one a line, as `severity code at path: message` (formatDiagnostics()), whether the render
// passed or failed, and exits 1 on errors. Its last line is the harness's: `[render] ok …` or `[render] failed …`.
import { build } from "esbuild";
import { existsSync, realpathSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { clockBanner, inputsHash, resultLine, takeSecret, treeHash } from "./bench-runtime.mjs";

const secret = takeSecret();
const run = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const inputs = inputsHash(run);
const fail = (...message) => {
  if (message.length) console.error(...message);
  console.log(resultLine(secret, "render", "failed", inputs));
  process.exit(1);
};
const mode = process.argv.includes("--pdf") ? "pdf" : process.argv.includes("--page") ? "page" : "email";
const req = createRequire(join(run, "package.json"));
const engine = realpathSync(req.resolve("@hyper-elements/react"));
const engineReq = createRequire(engine);

const source = ["src/template.tsx", "src/template.ts"].find((f) => existsSync(join(run, f)));
if (!source) fail("src/template.tsx was not found.");

await mkdir(join(run, ".cache"), { recursive: true });
await mkdir(join(run, "out"), { recursive: true });
const entry = join(run, ".cache/entry.tsx");
const imports = mode === "pdf"
  ? `import { formatDiagnostics } from "@hyper-elements/react";\nimport { renderPdf } from "@hyper-elements/react/pdf";`
  : `import { formatDiagnostics, render } from "@hyper-elements/react";`;
const call = mode === "pdf" ? "renderPdf(<Template />, { fonts })" : "render(<Template />)";
await writeFile(entry, `import Template from "../${source.replace(/\.tsx?$/, "")}";\n${imports}\nexport { formatDiagnostics };\nexport default (fonts) => ${call};\n`);
const out = join(run, ".cache/bundle.mjs");
try {
  await build({
    entryPoints: [entry], outfile: out, bundle: true, platform: "node", format: "esm", jsx: "automatic", logLevel: "silent",
    // react-pdf stays external, as the package's own build keeps it: bundled, PDFKit's asset lookup through
    // import.meta.url throws.
    external: ["@react-pdf/renderer"],
    // The clock and randomness pinned before anything the template runs.
    banner: { js: `import { createRequire as __benchRequire } from "node:module"; const require = __benchRequire(import.meta.url);\n${clockBanner()}` },
    plugins: [{ name: "one-react", setup(b) { b.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, ({ path }) => ({ path: engineReq.resolve(path) })); } }],
  });
} catch (e) {
  fail(e.errors?.map((x) => `${x.location?.file ?? ""}:${x.location?.line ?? ""} ${x.text}`).join("\n") ?? e.message);
}

const file = { email: "out/email.html", page: "out/page.html", pdf: "out/document.pdf" }[mode];
// A failed render leaves no output behind from an earlier one. out/diagnostics.json lists what this render found.
await rm(join(run, file), { force: true });
if (mode === "email") await rm(join(run, "out/email.txt"), { force: true });
const record = (diagnostics) => writeFile(join(run, "out/diagnostics.json"), JSON.stringify(diagnostics.map(({ code, severity, path, message }) => ({ code, severity, path, message })), null, 2));
const fonts = mode === "pdf"
  ? await Promise.all([["Inter-Regular.ttf", 400], ["Inter-Bold.ttf", 700]].map(async ([f, weight]) => ({ family: "Inter", weight, src: new Uint8Array(await readFile(join(run, "fonts", f))) })))
  : undefined;
let bundle;
try {
  // Imported once a process, with no query: its URL shows in a stack the template prints, the same in a replay.
  bundle = await import(pathToFileURL(out).href);
  const result = await bundle.default(fonts);
  if (mode === "pdf") await writeFile(join(run, file), result.pdf);
  else await writeFile(join(run, file), result.html);
  if (mode === "email") await writeFile(join(run, "out/email.txt"), result.text);
  await record(result.diagnostics);
  if (result.diagnostics.length) console.log(bundle.formatDiagnostics(result.diagnostics));
  console.log(`Rendered ${file} (${mode === "pdf" ? result.pdf.length : result.html.length} bytes).`);
} catch (e) {
  await record(e?.diagnostics ?? [{ code: "render/crash", severity: "error", path: "", message: String(e?.message ?? e) }]);
  fail(e?.diagnostics && bundle ? bundle.formatDiagnostics(e.diagnostics) : (e?.stack ?? String(e)));
}
console.log(resultLine(secret, "render", "ok", inputs, treeHash(run, ["out"])));
