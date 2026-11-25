// The authoring checker's adapter for hand-written HTML: a body (HTML) put where the kit's starter file says, its
// preview and heading filled in. HTML takes any body: there's nothing for it to refuse.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const run = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function apply({ body, preview, heading }, out) {
  let starter;
  try {
    starter = await readFile(join(run, "emails/starter.html"), "utf8");
  } catch (e) {
    return { error: `emails/starter.html: ${e.message}` };
  }
  if (!/<!-- BODY[\s\S]*?-->/.test(starter)) return { error: "emails/starter.html has no <!-- BODY … --> comment to put a body in" };
  const html = starter.replace(/<!-- BODY[\s\S]*?-->/, body).replaceAll("{{preview}}", preview).replaceAll("{{heading}}", heading);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, html);
  return { html };
}
