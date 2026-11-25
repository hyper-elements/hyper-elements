// Renders a newsletter made from the template (designs/newsletter.tsx, whose root is the template) with Hyper
// Elements, to out/email.html, and prints its problems: the template's own checks, its rules and Elements' (the
// template refuses a design that breaks one, and nothing is written).
//   node tools/render.mjs [designs/newsletter.tsx] [--out out/email.html] [--json]
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { realpathSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const run = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** A design module rendered: { html, diagnostics } or { refused: diagnostics } or { error }. */
export async function renderDesign(file, { out = join(run, "out/email.html") } = {}) {
  const req = createRequire(join(run, "package.json"));
  const engineReq = createRequire(realpathSync(req.resolve("@hyper-elements/react")));
  await mkdir(join(run, ".cache"), { recursive: true });
  const entry = join(run, ".cache", `entry-${process.pid}-${Math.random().toString(36).slice(2)}.tsx`);
  const spec = relative(dirname(entry), file).split("\\").join("/").replace(/\.tsx?$/, "");
  await writeFile(entry, `import Design from "${spec.startsWith(".") ? spec : `./${spec}`}";\nimport { formatDiagnostics, render } from "@hyper-elements/react";\nexport { formatDiagnostics };\nexport default () => render(<Design />);\n`);
  const bundle = entry.replace(/\.tsx$/, ".cjs");
  try {
    await build({
      entryPoints: [entry], outfile: bundle, bundle: true, platform: "node", format: "cjs", jsx: "automatic", logLevel: "silent",
      plugins: [{ name: "one-react", setup(b) { b.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, ({ path }) => ({ path: engineReq.resolve(path) })); } }],
    });
  } catch (e) {
    return { error: e.errors?.map((x) => `${x.location?.file ?? ""}:${x.location?.line ?? ""} ${x.text}`).join("\n") ?? e.message };
  }
  const mod = createRequire(import.meta.url)(bundle);
  try {
    const { html, diagnostics } = await mod.default();
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, html);
    return { html, diagnostics, format: mod.formatDiagnostics };
  } catch (e) {
    if (e.diagnostics) return { refused: e.diagnostics, format: mod.formatDiagnostics };
    return { error: e.stack ?? e.message };
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const file = resolve(run, args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--out") ?? "designs/newsletter.tsx");
  const outAt = args.indexOf("--out");
  const r = await renderDesign(file, outAt > -1 ? { out: resolve(run, args[outAt + 1]) } : {});
  const json = args.includes("--json");
  if (r.error) console.error(r.error);
  if (r.refused) console.error(r.format(r.refused));
  if (r.html) {
    const shown = r.diagnostics.filter((d) => d.severity !== "info");
    if (shown.length) console.log(r.format(shown));
    console.log(`Rendered ${relative(run, outAt > -1 ? resolve(run, args[outAt + 1]) : join(run, "out/email.html"))} (${r.html.length} bytes).`);
  }
  if (json) console.log(JSON.stringify({ ok: !!r.html, diagnostics: r.diagnostics ?? r.refused ?? [] }));
  process.exit(r.html ? 0 : 1);
}
