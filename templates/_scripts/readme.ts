/**
 * Writes `templates/README.md` from the folder: every design by its output, and the sample brands.
 *   pnpm --filter ./templates readme
 */
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ROOT } from "./assets";
import { ROOT_FOLDERS, brands, companies, designs } from "../_test/discover";

const HEADINGS = { emails: "Emails", pages: "Pages", documents: "PDFs", images: "Images" } as const;

export async function readme(): Promise<string> {
  const [all, owned, brandList] = [await designs(), await companies(), await brands()];
  const lines = [
    "# Templates",
    "",
    "Ready-made [Hyper Elements](https://hyperelements.dev) designs: emails, web pages, PDFs and images, each one plain JSX",
    "of Elements' own elements. None of them carries a brand: each takes its colors, fonts, logo and company details",
    "from a brand it's given, and is tested in every sample brand for readable text and a layout that fits.",
    "",
    "**To use one,** open it on [hyperelements.dev/templates](https://hyperelements.dev/templates), pick a sample brand,",
    "and copy it with its `brand.ts` (or as one file). It imports only Elements' own packages. Put your own brand in",
    "`brand.ts`, and change anything else you like.",
    "",
    "**To add one,** see [CONTRIBUTING.md](./CONTRIBUTING.md).",
    "",
    "This file is written by `pnpm --filter ./templates readme`. Don't edit it by hand.",
    "",
  ];
  for (const folder of Object.keys(ROOT_FOLDERS) as Array<keyof typeof ROOT_FOLDERS>) {
    const inFolder = all.filter((t) => t.folder === folder);
    if (!inFolder.length) continue;
    lines.push(`## ${HEADINGS[folder]}`, "");
    for (const t of inFolder) {
      const company = t.meta.recreates && owned.find((o) => o.id === t.meta.recreates!.company)!.brand.name;
      const notes = [company ? `a recreation of ${company}'s ${t.meta.recreates!.what}` : "", t.meta.author ? `by ${t.meta.author}` : ""].filter(Boolean);
      lines.push(`- [${t.meta.label}](./${t.key}.tsx): ${t.meta.description}${notes.length ? ` (${notes.join(", ")})` : ""}`);
    }
    lines.push("");
  }
  lines.push("## Sample brands", "", "Every design is tested in each of these invented brands. None is a real company.", "");
  for (const { id, brand } of brandList) lines.push(`- **${brand.name}** ([\`_brands/${id}.ts\`](./_brands/${id}.ts))`);
  lines.push("");
  return lines.join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(ROOT, "_scripts", "readme.ts")) {
  writeFileSync(join(ROOT, "README.md"), await readme());
  console.log("templates/README.md");
}
