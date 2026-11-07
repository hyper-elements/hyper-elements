// Compiles emails/email.mjml with MJML to out/email.html.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const run = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mjml2html = createRequire(join(run, "package.json"))("mjml");
const file = join(run, "emails/email.mjml");
await mkdir(join(run, "out"), { recursive: true });
try {
  const { html, errors } = await mjml2html(await readFile(file, "utf8"), { filePath: file, validationLevel: "soft" });
  for (const e of errors ?? []) console.log(`warning line ${e.line} <${e.tagName}>: ${e.message}`);
  await writeFile(join(run, "out/email.html"), html);
  console.log(`Rendered out/email.html (${html.length} bytes).`);
} catch (e) {
  for (const x of e.errors ?? []) console.error(`error line ${x.line} <${x.tagName}>: ${x.message}`);
  if (!e.errors) console.error(e.stack ?? e.message);
  process.exit(1);
}
