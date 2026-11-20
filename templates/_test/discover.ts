/** Every kit, design, category and sample brand in the folder, found from the files, as the matrix tests them. */
import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import type { ReactElement } from "react";
import type { Brand, RecreationMeta } from "../_brand";
import { ROOT } from "../_scripts/assets";

export const ROOT_FOLDERS = { emails: "Email", pages: "Page", documents: "Document", images: "Canvas" } as const;
export type RootFolder = keyof typeof ROOT_FOLDERS;

/** Folders in `templates/` that aren't kits. */
export const NOT_KITS = (name: string) => name.startsWith("_") || name.startsWith(".") || name === "node_modules";

export interface KitInfo {
  id: string;
  dir: string;
  kit: { name: string; description: string; author: string; tags?: string[]; recreates?: { company: string } };
  /** A recreation kit's company brand. */
  brand?: Brand;
}

/** What a design file says about itself, in its `meta` export. */
export interface DesignMeta {
  label: string;
  description: string;
  author?: string;
  /** A recreation's: what it rebuilds, and where the original can be seen. */
  recreates?: RecreationMeta;
}

export interface DesignInfo {
  kit: string;
  folder: RootFolder;
  root: (typeof ROOT_FOLDERS)[RootFolder];
  category: string;
  file: string;
  /** `<kit>/<root folder>/<category>`. */
  key: string;
  meta: DesignMeta;
  /** The design, drawn in a brand. */
  Design: (props: { brand: Brand }) => ReactElement;
}

export const pascal = (name: string) => name.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
export const camel = (name: string) => pascal(name).replace(/^./, (c) => c.toLowerCase());

export function kitNames(): string[] {
  return readdirSync(ROOT).filter((name) => !NOT_KITS(name) && statSync(join(ROOT, name)).isDirectory()).sort();
}

export async function kits(): Promise<KitInfo[]> {
  const out: KitInfo[] = [];
  for (const id of kitNames()) {
    const dir = join(ROOT, id);
    const { kit } = await import(join(dir, "kit.ts"));
    const brandFile = join(dir, "brand.ts");
    const brand = existsSync(brandFile) ? ((await import(brandFile)) as { brand: Brand }).brand : undefined;
    out.push({ id, dir, kit, ...(brand ? { brand } : {}) });
  }
  return out;
}

export async function designs(): Promise<DesignInfo[]> {
  const out: DesignInfo[] = [];
  for (const kit of kitNames()) {
    for (const folder of Object.keys(ROOT_FOLDERS) as RootFolder[]) {
      const dir = join(ROOT, kit, folder);
      if (!existsSync(dir)) continue;
      for (const name of readdirSync(dir).filter((f) => f.endsWith(".tsx")).sort()) {
        const file = join(dir, name);
        const category = basename(name, ".tsx");
        const module = (await import(file)) as { default: DesignInfo["Design"]; meta: DesignMeta };
        out.push({ kit, folder, root: ROOT_FOLDERS[folder], category, file, key: `${kit}/${folder}/${category}`, meta: module.meta, Design: module.default });
      }
    }
  }
  return out;
}

export async function brands(): Promise<Array<{ id: string; brand: Brand }>> {
  const dir = join(ROOT, "_brands");
  const out: Array<{ id: string; brand: Brand }> = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts")).sort()) {
    out.push({ id: basename(file, ".ts"), brand: ((await import(join(dir, file))) as { brand: Brand }).brand });
  }
  return out;
}

export async function categories(): Promise<Array<{ id: string; file: string; category: Record<string, unknown> }>> {
  const dir = join(ROOT, "_categories");
  const out: Array<{ id: string; file: string; category: Record<string, unknown> }> = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts")).sort()) {
    const id = basename(file, ".ts");
    const module = (await import(join(dir, file))) as Record<string, Record<string, unknown>>;
    out.push({ id, file: join(dir, file), category: module[camel(id)] });
  }
  return out;
}
