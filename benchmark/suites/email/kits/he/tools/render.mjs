// Renders emails/email.tsx with Hyper Elements to out/email.html.
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const run = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const req = createRequire(join(run, "package.json"));
const engine = realpathSync(req.resolve("@hyper-elements/react"));
const engineReq = createRequire(engine);
await mkdir(join(run, ".cache"), { recursive: true });
await mkdir(join(run, "out"), { recursive: true });
const entry = join(run, ".cache/entry.tsx");
// formatDiagnostics() prints each problem on a line, with the email clients it's about and what to change.
await writeFile(entry, `import Template from "../emails/email";\nimport { formatDiagnostics, render } from "@hyper-elements/react";\nexport { formatDiagnostics };\nexport default () => render(<Template />);\n`);
const out = join(run, ".cache/bundle.cjs");
try {
  await build({
    entryPoints: [entry], outfile: out, bundle: true, platform: "node", format: "cjs", jsx: "automatic", logLevel: "silent",
    plugins: [{ name: "one-react", setup(b) { b.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, ({ path }) => ({ path: engineReq.resolve(path) })); } }],
  });
} catch (e) {
  console.error(e.errors?.map((x) => `${x.location?.file ?? ""}:${x.location?.line ?? ""} ${x.text}`).join("\n") ?? e.message);
  process.exit(1);
}
const bundle = createRequire(import.meta.url)(out);
try {
  const { html, diagnostics } = await bundle.default();
  await writeFile(join(run, "out/email.html"), html);
  if (diagnostics.length) console.log(bundle.formatDiagnostics(diagnostics));
  console.log(`Rendered out/email.html (${html.length} bytes).`);
} catch (e) {
  if (e.diagnostics) console.error(bundle.formatDiagnostics(e.diagnostics));
  else console.error(e.stack ?? e.message);
  process.exit(1);
}
