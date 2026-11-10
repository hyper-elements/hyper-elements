// Renders emails/email.tsx with Hyper Elements to out/email.html, and prints its problems (tools/print.mjs).
// --json: also prints them as JSON, on the last line.
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { print } from "./print.mjs";

const run = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const req = createRequire(join(run, "package.json"));
const engine = realpathSync(req.resolve("@hyper-elements/react"));
const engineReq = createRequire(engine);
await mkdir(join(run, ".cache"), { recursive: true });
await mkdir(join(run, "out"), { recursive: true });
const entry = join(run, ".cache/entry.tsx");
// The email client checks, where @hyper-elements/email-clients is installed beside Elements 0.4 or later (before 0.4
// they were Elements' own): its plugin, loaded from node_modules when the email is rendered.
const clients = (() => {
  try {
    return req.resolve("@hyper-elements/email-clients");
  } catch {
    return null;
  }
})();
const call = clients ? `render(<Template />, { plugins: [await (await import("@hyper-elements/email-clients")).emailClients()] })` : "render(<Template />)";
await writeFile(entry, `import Template from "../emails/email";\nimport { formatDiagnostics, render } from "@hyper-elements/react";\nexport { formatDiagnostics };\nexport default async () => ${call};\n`);
const out = join(run, ".cache/bundle.cjs");
try {
  await build({
    entryPoints: [entry], outfile: out, bundle: true, platform: "node", format: "cjs", jsx: "automatic", logLevel: "silent",
    plugins: [{ name: "one-react", setup(b) { b.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, ({ path }) => ({ path: engineReq.resolve(path) })); } }],
    external: ["@hyper-elements/email-clients"],
  });
} catch (e) {
  console.error(e.errors?.map((x) => `${x.location?.file ?? ""}:${x.location?.line ?? ""} ${x.text}`).join("\n") ?? e.message);
  process.exit(1);
}
const bundle = createRequire(import.meta.url)(out);
const json = process.argv.includes("--json");
try {
  const { html, diagnostics } = await bundle.default();
  await writeFile(join(run, "out/email.html"), html);
  if (diagnostics.length) console.log(print(diagnostics, bundle.formatDiagnostics));
  console.log(`Rendered out/email.html (${html.length} bytes).`);
  if (json) console.log(JSON.stringify({ ok: true, diagnostics }));
} catch (e) {
  if (e.diagnostics) console.error(print(e.diagnostics, bundle.formatDiagnostics));
  else console.error(e.stack ?? e.message);
  if (json) console.log(JSON.stringify({ ok: false, diagnostics: e.diagnostics ?? [] }));
  process.exit(1);
}
