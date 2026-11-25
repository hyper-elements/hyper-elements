// The authoring checker's adapter for Hyper Elements: a body (TSX, the body slot's content) given to the kit's
// newsletter template, rendered. The template refuses a body it doesn't allow (a diagnostic); otherwise the HTML.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderDesign } from "./render.mjs";

const run = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** { html } where the newsletter took the body, { refused: [codes] } where it didn't, or { error }. */
export async function apply({ body, imports, preview, heading }, out) {
  await mkdir(join(run, ".cache"), { recursive: true });
  const file = join(run, ".cache", `body-${Math.random().toString(36).slice(2)}.tsx`);
  await writeFile(
    file,
    `import Newsletter from "../templates/newsletter";\nimport { ${imports} } from "@hyper-elements/react";\nexport default () => <Newsletter preview={${JSON.stringify(preview)}} heading={${JSON.stringify(heading)}} body={${body}} />;\n`,
  );
  const r = await renderDesign(file, { out });
  if (r.refused) return { refused: r.refused.filter((d) => d.severity === "error").map((d) => d.code) };
  if (r.error) return { error: r.error };
  return { html: r.html };
}
