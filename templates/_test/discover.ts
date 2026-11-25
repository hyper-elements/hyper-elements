/** Every template (with its designs), sample brand and company brand in the folder, found from the files. */
import { existsSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { createElement, type ReactElement } from "react";
import { templateRequest, type Template } from "@hyper-elements/react/template";
import type { Brand, RecreationMeta } from "../_brand";
import { ROOT } from "../_scripts/assets";
export { valuesIn } from "../_scripts/links";

/** The folders designs live in, and the root each one's designs return. */
export const ROOT_FOLDERS = { emails: "Email", pages: "Page", documents: "Document", images: "Canvas" } as const;
export type RootFolder = keyof typeof ROOT_FOLDERS;

export const pascal = (name: string) => name.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
export const camel = (name: string) => pascal(name).replace(/^./, (c) => c.toLowerCase());

/** The folder's own folders, that aren't a root folder: `_brands`, `_assets`, … */
export const SHARED = (name: string) => name.startsWith("_") || name.startsWith(".") || name === "node_modules";

/** A design made from a template: `<root folder>/<name>/designs/<design>.tsx`, `<Newsletter … />`. */
export interface TemplateDesign {
  name: string;
  file: string;
  label: string;
  /** The values it gives its template, as its root recorded them (a slot's JSX stays JSX). */
  values: Record<string, unknown>;
}

/** A template: `<root folder>/<name>/template.tsx`, exporting the function named for its folder (`newsletter`), which
 * makes it from a brand, and that template in a sample brand as its default. */
export interface TemplateInfo {
  folder: RootFolder;
  root: (typeof ROOT_FOLDERS)[RootFolder];
  name: string;
  /** `<root folder>/<name>`. */
  key: string;
  file: string;
  /** The template, made from a brand. */
  make: (brand: Brand) => Template;
  /** Its `meta`: who made it, where it isn't the project, and what it recreates, for a recreation. */
  meta: { author?: string; recreates?: RecreationMeta };
  designs: TemplateDesign[];
}

export async function templates(): Promise<TemplateInfo[]> {
  const out: TemplateInfo[] = [];
  for (const folder of Object.keys(ROOT_FOLDERS) as RootFolder[]) {
    const dir = join(ROOT, folder);
    for (const name of readdirSync(dir).filter((f) => existsSync(join(dir, f, "template.tsx"))).sort()) {
      const file = join(dir, name, "template.tsx");
      const module = (await import(file)) as Record<string, unknown>;
      const make = module[camel(name)];
      if (typeof make !== "function") throw new Error(`${folder}/${name}/template.tsx exports no ${camel(name)}(brand)`);
      const designs: TemplateDesign[] = [];
      const designDir = join(dir, name, "designs");
      for (const design of (existsSync(designDir) ? readdirSync(designDir) : []).filter((f) => f.endsWith(".tsx")).sort()) {
        const designFile = join(designDir, design);
        const own = (await import(designFile)) as { default: () => ReactElement; meta?: { label?: string } };
        const request = templateRequest(createElement(own.default));
        if (!request.props) throw new Error(`${relativeKey(designFile)} isn't a design made from its template: ${request.diagnostics.map((d) => d.message).join("; ")}`);
        designs.push({ name: basename(design, ".tsx"), file: designFile, label: own.meta?.label ?? basename(design, ".tsx"), values: request.props });
      }
      out.push({ folder, root: ROOT_FOLDERS[folder], name, key: `${folder}/${name}`, file, make: make as TemplateInfo["make"], meta: (module.meta ?? {}) as TemplateInfo["meta"], designs });
    }
  }
  return out;
}

const relativeKey = (file: string) => file.slice(ROOT.length + 1);


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
