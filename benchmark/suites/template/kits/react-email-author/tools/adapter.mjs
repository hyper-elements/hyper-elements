// The authoring checker's adapter for React Email: a body (TSX) put in the kit's Layout, rendered. React Email takes
// any body: there's nothing for it to refuse.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderEmail } from "./render.mjs";

const run = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function apply({ body, imports, preview, heading }, out) {
  await mkdir(join(run, ".cache"), { recursive: true });
  const file = join(run, ".cache", `body-${Math.random().toString(36).slice(2)}.tsx`);
  await writeFile(
    file,
    `import { Layout, palette, styles } from "../emails/brand";\nimport { ${imports} } from "@react-email/components";\nvoid palette; void styles;\nexport default () => <Layout preview={${JSON.stringify(preview)}} heading={${JSON.stringify(heading)}}>{${body}}</Layout>;\n`,
  );
  const r = await renderEmail(file, { out });
  return r.error ? { error: r.error } : { html: r.html };
}
