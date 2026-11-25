// The authoring checker's adapter for MJML: a body (MJML sections) between the kit's header and footer, with its head,
// compiled. MJML takes any body that compiles: there's nothing for it to refuse.
import { writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderMjml } from "./render.mjs";

const run = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function apply({ body, preview, heading }, out) {
  const file = join(run, "emails", `.body-${Math.random().toString(36).slice(2)}.mjml`);
  await writeFile(
    file,
    `<mjml lang="en">\n  <mj-head>\n    <mj-include path="./head.mjml" />\n    <mj-preview>${preview}</mj-preview>\n  </mj-head>\n  <mj-body background-color="#f1f2f6" width="600px">\n    <mj-include path="./header.mjml" />\n    <mj-section><mj-column><mj-text font-size="28px" line-height="36px">${heading}</mj-text></mj-column></mj-section>\n${body}\n    <mj-include path="./footer.mjml" />\n  </mj-body>\n</mjml>\n`,
  );
  const r = await renderMjml(file, { out });
  return r.error ? { error: r.error } : { html: r.html };
}
