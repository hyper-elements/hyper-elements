/**
 * Writes `templates/README.md` from the folder: every design by group and category, the kits, and the sample brands.
 *   pnpm --filter ./templates readme
 */
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ROOT } from "./assets";
import { brands, categories, designs, kits } from "../_test/discover";

const GROUPS = ["Account", "Billing", "Orders", "Launches", "Content", "Events", "Social", "People", "Records", "Marketing"];
const OUTPUT = { emails: "email", pages: "page", documents: "PDF", images: "image" } as const;

export async function readme(): Promise<string> {
  const [all, cats, kitList, brandList] = [await designs(), await categories(), await kits(), await brands()];
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
    "## By category",
    "",
  ];
  for (const group of GROUPS) {
    const inGroup = cats.filter((c) => c.category.group === group && all.some((t) => t.category === c.id));
    if (!inGroup.length) continue;
    lines.push(`### ${group}`, "");
    for (const c of inGroup) {
      lines.push(`- **${c.category.label}** (\`${c.id}\`): ${c.category.useWhen}.`);
      for (const t of all.filter((x) => x.category === c.id)) {
        const kit = kitList.find((k) => k.id === t.kit)!;
        lines.push(`  - [${kit.kit.name}](./${t.kit}/${t.folder}/${t.category}.tsx), as ${OUTPUT[t.folder] === "image" ? "an image" : OUTPUT[t.folder] === "email" ? "an email" : `a ${OUTPUT[t.folder]}`}`);
      }
    }
    lines.push("");
  }
  lines.push("## Kits", "", "| Kit | What it is | Designs | By |", "|---|---|---|---|");
  for (const k of kitList) {
    const mine = all.filter((t) => t.kit === k.id).map((t) => `\`${t.folder}/${t.category}\``).join(", ");
    lines.push(`| [${k.kit.name}](./${k.id}) | ${k.kit.description} | ${mine} | ${k.kit.author} |`);
  }
  lines.push("", "## Sample brands", "", "Every design is tested in each of these invented brands. None is a real company.", "");
  for (const { id, brand } of brandList) lines.push(`- **${brand.name}** ([\`_brands/${id}.ts\`](./_brands/${id}.ts))`);
  lines.push("");
  return lines.join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(ROOT, "_scripts", "readme.ts")) {
  writeFileSync(join(ROOT, "README.md"), await readme());
  console.log("templates/README.md");
}
