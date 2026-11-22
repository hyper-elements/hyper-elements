/**
 * Writes `templates/README.md` from the folder: every template by its output, with its designs, and the sample brands.
 *   pnpm --filter ./templates readme
 */
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ROOT } from "./assets";
import { ROOT_FOLDERS, brands, companies, templates } from "../_test/discover";

const HEADINGS = { emails: "Emails", pages: "Pages", documents: "PDFs", images: "Images" } as const;

export async function readme(): Promise<string> {
  const [owned, brandList, made] = [await companies(), await brands(), await templates()];
  const lines = [
    "# Templates",
    "",
    "Ready-made [Hyper Elements](https://hyperelements.dev) templates: emails, web pages, PDFs and images. Each is a",
    "template (`template()` from `@hyper-elements/react/template`): what stays the same is locked, and what changes is a",
    "field, with the limits and rules every design made from it is checked against. None of them carries a brand: each",
    "is made from one (`newsletter(brand)`), which gives it its colors, fonts, logo, company details and the domains its",
    "links may go to.",
    "",
    "```text",
    "emails/newsletter/",
    "  template.tsx          newsletter(brand) makes the template; its default export is made from a sample brand",
    "  designs/*.tsx         designs made from it: <Newsletter subject=\"…\" body={…} />",
    "```",
    "",
    "**To use one,** open it on [hyperelements.dev/templates](https://hyperelements.dev/templates), pick a sample brand,",
    "and copy the template with its `brand.ts` (or as one file). Put your own brand in `brand.ts`, then write designs",
    "from it, and check them: `npx hyper-elements describe template.tsx` lists its fields, and `npx hyper-elements check`",
    "checks a design against them.",
    "",
    "This file is written by `pnpm --filter ./templates readme`. Don't edit it by hand.",
    "",
  ];
  for (const folder of Object.keys(ROOT_FOLDERS) as Array<keyof typeof ROOT_FOLDERS>) {
    const templatesHere = made.filter((t) => t.folder === folder);
    if (!templatesHere.length) continue;
    lines.push(`## ${HEADINGS[folder]}`, "");
    // A template, made from a brand, and the designs made from it.
    for (const t of templatesHere) {
      const tpl = t.make(brandList[0]!.brand);
      const company = t.meta.recreates && owned.find((o) => o.id === t.meta.recreates!.company)?.brand.name;
      const notes = [company ? `a recreation of ${company}'s ${t.meta.recreates!.what}` : "", t.meta.author ? `by ${t.meta.author}` : ""].filter(Boolean);
      lines.push(`- [${tpl.label}](./${t.key}/template.tsx): ${tpl.description ?? ""}${notes.length ? ` (${notes.join(", ")})` : ""}. Designs: ${t.designs.map((d) => `[${d.label}](./${t.key}/designs/${d.name}.tsx)`).join(", ")}`);
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
