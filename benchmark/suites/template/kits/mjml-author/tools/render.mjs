// Compiles an MJML file (emails/email.mjml by default) to out/email.html, its mj-include paths from its folder (and
// only inside emails/).
//   node tools/render.mjs [emails/email.mjml] [--out out/email.html]
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const run = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function renderMjml(file, { out = join(run, "out/email.html") } = {}) {
  const mjml2html = createRequire(join(run, "package.json"))("mjml");
  try {
    // MJML 5 leaves mj-include out unless it's asked to read them: here, from the run's emails/ folder only.
    const { html, errors } = await mjml2html(await readFile(file, "utf8"), { filePath: file, validationLevel: "soft", ignoreIncludes: false, includePath: join(run, "emails") });
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, html);
    return { html, warnings: (errors ?? []).map((e) => `line ${e.line} <${e.tagName}>: ${e.message}`) };
  } catch (e) {
    return { error: (e.errors ?? []).map((x) => `line ${x.line} <${x.tagName}>: ${x.message}`).join("\n") || e.message };
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const outAt = args.indexOf("--out");
  const file = resolve(run, args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--out") ?? "emails/email.mjml");
  const r = await renderMjml(file, outAt > -1 ? { out: resolve(run, args[outAt + 1]) } : {});
  for (const w of r.warnings ?? []) console.log(`warning ${w}`);
  if (r.error) console.error(r.error);
  else console.log(`Rendered out/email.html (${r.html.length} bytes).`);
  process.exit(r.html ? 0 : 1);
}
