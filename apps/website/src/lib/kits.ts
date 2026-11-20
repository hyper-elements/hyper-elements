// The community templates (templates/ at the repository's root), as templates/_scripts/website.tsx wrote them into
// src/generated/kits.json: every template in every sample brand, by format, with its copyable single file.
import data from "../generated/kits.json";
import type { Example } from "./examples";

export interface BrandInfo {
  id: string;
  name: string;
  colors: Record<string, string>;
  /** The brand's block, as the single file and the playground's Brand menu write it. */
  block: string;
}
export interface KitInfo {
  id: string;
  name: string;
  description: string;
  author: string;
  tags?: string[];
  recreates?: { company: string };
  brand?: BrandInfo;
}
export interface TemplateInfo {
  key: string;
  id: string;
  kit: string;
  folder: "emails" | "pages" | "documents" | "images";
  output: string;
  root: "Email" | "Page" | "Document" | "Canvas";
  category: string;
  label: string;
  description: string;
  author: string;
  /** A recreation: the company, what it rebuilds, and where the original can be seen. */
  recreates?: { company: string; what: string; original: string };
  /** A design has one size: none. */
  formats: string[];
  file: string;
  /** The design as it's written, which takes its brand's type from ./brand: the same in every brand. */
  code: string;
  byBrand: Record<string, { views: Record<string, View>; single: string; brandFile: string }>;
}
/** A view of a template in one brand, with the file the gallery loads it from when that brand is picked: its HTML
 * (images and assets already pointed at this site), or a Canvas's PNG. */
export type View = Example & { preview?: string };
export interface CategoryInfo {
  label: string;
  group: string;
  useWhen: string;
  avoidWhen: string;
  roots: string[];
}

const kits = data as unknown as { assets: string; brands: BrandInfo[]; kits: KitInfo[]; templates: TemplateInfo[]; categories: Record<string, CategoryInfo> };

export const brands = kits.brands;
export const kitList = kits.kits;
export const kitTemplates = kits.templates;
export const kitCategories = kits.categories;
export const GROUPS = ["Account", "Billing", "Orders", "Launches", "Content", "Events", "Social", "People", "Records", "Marketing"];

/** The brands a template is shown in: its kit's own first, where it's a recreation, then the samples. */
export const brandsFor = (t: TemplateInfo): BrandInfo[] => {
  const own = kitList.find((k) => k.id === t.kit)?.brand;
  return own ? [own, ...brands] : brands;
};
export const templateUrl = (t: TemplateInfo) => `/templates/${t.kit}/${t.folder}/${t.category}`;
// Page sizes at 96px to the inch, portrait: [width, height].
const PAGE_SIZES: Record<string, [number, number]> = { A3: [1123, 1587], A4: [794, 1123], A5: [559, 794], LETTER: [816, 1056], LEGAL: [816, 1344] };
/** How wide a template's preview is drawn before it's scaled to fit: a Document at its own page's width (from the
 * `@page` rule its print HTML writes, landscape or portrait), with room for the preview's margin around it. */
export const previewWidth = (t: TemplateInfo, brand?: string): number => {
  if (t.root === "Page") return 1200;
  if (t.root === "Canvas") return 1200;
  if (t.root === "Email") return 680;
  const html = firstView(t, brand ?? Object.keys(t.byBrand)[0]!)?.html ?? "";
  const page = /@page\s*\{[^}]*size:\s*([A-Za-z0-9]+)\s*(landscape|portrait)?/i.exec(html);
  const size = page ? PAGE_SIZES[page[1]!.toUpperCase()] : undefined;
  if (!size) return 820;
  return (page![2]?.toLowerCase() === "landscape" ? size[1] : size[0]) + 26;
};
/** The first view of a template in a brand: its first format. */
export const firstView = (t: TemplateInfo, brand: string): View => {
  const views = t.byBrand[brand]?.views ?? {};
  return views[t.formats[0] ?? "default"] ?? Object.values(views)[0];
};
