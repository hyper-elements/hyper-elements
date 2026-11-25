// Renders a React Email module (emails/email.tsx by default) to out/email.html.
//   node tools/render.mjs [emails/email.tsx] [--out out/email.html]
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const run = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** A module whose default export is the email, rendered: { html } or { error }. */
export async function renderEmail(file, { out = join(run, "out/email.html") } = {}) {
  await mkdir(join(run, ".cache"), { recursive: true });
  const entry = join(run, ".cache", `entry-${process.pid}-${Math.random().toString(36).slice(2)}.tsx`);
  const spec = relative(dirname(entry), file).split("\\").join("/").replace(/\.tsx?$/, "");
  await writeFile(entry, `import Email from "${spec.startsWith(".") ? spec : `./${spec}`}";\nimport { render } from "@react-email/render";\nexport default () => render(<Email />);\n`);
  const bundle = entry.replace(/\.tsx$/, ".cjs");
  try {
    await build({ entryPoints: [entry], outfile: bundle, bundle: true, platform: "node", format: "cjs", jsx: "automatic", logLevel: "silent", packages: "external" });
  } catch (e) {
    return { error: e.errors?.map((x) => `${x.location?.file ?? ""}:${x.location?.line ?? ""} ${x.text}`).join("\n") ?? e.message };
  }
  try {
    const html = await createRequire(import.meta.url)(bundle).default();
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, html);
    return { html };
  } catch (e) {
    return { error: e.stack ?? e.message };
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const outAt = args.indexOf("--out");
  const file = resolve(run, args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--out") ?? "emails/email.tsx");
  const r = await renderEmail(file, outAt > -1 ? { out: resolve(run, args[outAt + 1]) } : {});
  if (r.error) console.error(r.error);
  else console.log(`Rendered out/email.html (${r.html.length} bytes).`);
  process.exit(r.html ? 0 : 1);
}
