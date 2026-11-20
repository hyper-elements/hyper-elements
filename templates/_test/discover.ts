/** Every design, sample brand and company brand in the folder, found from the files. */
import { readdirSync } from "node:fs";
import { basename, join } from "node:path";
import type { ReactElement } from "react";
import type { Brand, RecreationMeta } from "../_brand";
import { ROOT } from "../_scripts/assets";

/** The folders designs live in, and the root each one's designs return. */
export const ROOT_FOLDERS = { emails: "Email", pages: "Page", documents: "Document", images: "Canvas" } as const;
export type RootFolder = keyof typeof ROOT_FOLDERS;

/** What a design file says about itself, in its `meta` export. */
export interface DesignMeta {
  label: string;
  description: string;
  /** Who made it, where it isn't the project ("Hyper Elements"). */
  author?: string;
  /** A recreation's: the company, what it rebuilds, and where the original can be seen. */
  recreates?: RecreationMeta;
}

export interface DesignInfo {
  folder: RootFolder;
  root: (typeof ROOT_FOLDERS)[RootFolder];
  /** Its file's name: `sign-in-code`. */
  name: string;
  file: string;
  /** `<root folder>/<name>`. */
  key: string;
  meta: DesignMeta;
  /** The design, drawn in a brand. */
  Design: (props: { brand: Brand }) => ReactElement;
}

export const pascal = (name: string) => name.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");

/** The folder's own folders, that aren't a root folder: `_brands`, `_assets`, … */
export const SHARED = (name: string) => name.startsWith("_") || name.startsWith(".") || name === "node_modules";

export async function designs(): Promise<DesignInfo[]> {
  const out: DesignInfo[] = [];
  for (const folder of Object.keys(ROOT_FOLDERS) as RootFolder[]) {
    const dir = join(ROOT, folder);
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".tsx")).sort()) {
      const name = basename(file, ".tsx");
      const module = (await import(join(dir, file))) as { default: DesignInfo["Design"]; meta: DesignMeta };
      out.push({ folder, root: ROOT_FOLDERS[folder], name, file: join(dir, file), key: `${folder}/${name}`, meta: module.meta, Design: module.default });
    }
  }
  return out;
}

async function brandFiles(folder: string): Promise<Array<{ id: string; file: string; brand: Brand }>> {
  const dir = join(ROOT, folder);
  const out: Array<{ id: string; file: string; brand: Brand }> = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts")).sort()) {
    out.push({ id: basename(file, ".ts"), file: join(dir, file), brand: ((await import(join(dir, file))) as { brand: Brand }).brand });
  }
  return out;
}

/** The invented sample brands every design is drawn in. */
export const brands = () => brandFiles("_brands");

/** The real companies whose work a recreation rebuilds, by id: a recreation is drawn in its company's brand too. */
export const companies = () => brandFiles("_companies");
