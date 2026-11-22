// The templates (templates/ at the repository's root), as templates/_scripts/website.tsx wrote them into
// src/generated/gallery.json: every template in every sample brand, with its copyable files.
import data from "../generated/gallery.json";
import type { Example } from "./examples";

export interface BrandInfo {
  id: string;
  name: string;
  colors: Record<string, string>;
  /** The brand's block, as the single file and the playground's Brand menu write it. */
  block: string;
}
/** A real company's brand (`templates/_companies/<company>.ts`), shown only with its recreations. */
export interface CompanyInfo extends BrandInfo {
  company: string;
}
export interface TemplateInfo {
  /** `<folder>/<name>`. */
  key: string;
  id: string;
  folder: "emails" | "pages" | "documents" | "images";
  /** Its file's name: `sign-in-code`. */
  name: string;
  output: string;
  root: "Email" | "Page" | "Document" | "Canvas";
  label: string;
  description: string;
  author: string;
  /** A recreation: the company's id and name, what it rebuilds, and where the original can be seen. */
  recreates?: { companyId: string; company: string; what: string; original: string };
  file: string;
  /** The design as it's written, which takes its brand's type from ./brand: the same in every brand. A template's
   * code is the template, made from the brand in ./brand. */
  code: string;
  /** A template's designs, made from it: each one's name (its view's key in `byBrand`), label, file and code. */
  designs?: Array<{ name: string; label: string; file: string; code: string }>;
  /** Each field's label and limits, by its path, for the agent view. */
  guide?: Record<string, { label: string; kind: string; limits: string }>;
  byBrand: Record<string, { views: Record<string, View>; single: string; brandFile: string }>;
}
/** A view of a template in one brand: an Email's, Page's or Document's with the HTML file the gallery loads when that
 * brand is picked; a Canvas's with its size, as it's drawn in the visitor's browser (src/scripts/gallery-images.ts). */
export type View = Example & {
  preview?: string;
  size?: [number, number];
  /** For the agent view: the parts bound to a field (an email's by its block map, an image's by its layout), and an image's boxes. */
  areas?: Array<{ path: string; field: string }>;
  boxes?: Array<[string, number, number, number, number]>;
};

const gallery = data as unknown as { assets: string; brands: BrandInfo[]; companies: CompanyInfo[]; templates: TemplateInfo[] };

export const brands = gallery.brands;
export const galleryTemplates = gallery.templates;

/** The brands a template is shown in: its company's own first, where it's a recreation, then the samples. */
export const brandsFor = (t: TemplateInfo): BrandInfo[] => {
  const own = gallery.companies.find((c) => c.company === t.recreates?.companyId);
  return own ? [own, ...brands] : brands;
};
export const templateUrl = (t: TemplateInfo) => `/templates/${t.folder}/${t.name}`;
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
/** A template's preview in a brand: a design's, or a template's first design's. */
export const firstView = (t: TemplateInfo, brand: string): View | undefined => {
  const views = t.byBrand[brand]?.views;
  return views && (views.default ?? views[t.designs?.[0]?.name ?? ""]);
};

/** The same text always gives the same number (FNV-1a): a fixed shuffle that doesn't follow the names' order. */
const hash = (text: string) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
};

/**
 * The gallery's order: its outputs, companies and sample brands mixed, so the first rows show the range. Each place
 * takes the template that fits best: each output, and the recreations, spread over the whole gallery by their share, no company's recreation
 * within six places of another of its own, no two recreations side by side, and where it can, not the output of the
 * card before (or the one before that). Ties fall to a fixed shuffle, so the order is the same on every build and
 * doesn't follow the names.
 */
export function mixed(list: readonly TemplateInfo[]): TemplateInfo[] {
  const left = [...list].sort((a, b) => hash(a.key) - hash(b.key));
  const total: Record<string, number> = {};
  const placed: Record<string, number> = {};
  // Each output, and the recreations and the sample brands' templates, by how many there are.
  const groups = (t: TemplateInfo) => [t.folder, t.recreates ? "recreation" : "sample"];
  for (const t of list) for (const g of groups(t)) total[g] = (total[g] ?? 0) + 1;
  const out: TemplateInfo[] = [];
  while (left.length) {
    const recent = out.slice(-6);
    const last = out[out.length - 1];
    const progress = (out.length + 1) / list.length;
    const cost = (t: TemplateInfo) => {
      let c = 0;
      const company = t.recreates?.companyId;
      if (company && recent.some((r) => r.recreates?.companyId === company)) c += 1000;
      if (last?.folder === t.folder) c += 40;
      if (out[out.length - 2]?.folder === t.folder) c += 15;
      if (last?.recreates && t.recreates) c += 40;
      // An output behind its share of the places so far goes sooner, and so does a recreation, or a sample brand's.
      c -= 300 * (progress - (placed[t.folder] ?? 0) / total[t.folder]!);
      const kind = groups(t)[1]!;
      c -= 200 * (progress - (placed[kind] ?? 0) / total[kind]!);
      return c;
    };
    let best = 0;
    for (let i = 1; i < left.length; i++) if (cost(left[i]!) < cost(left[best]!)) best = i;
    const [t] = left.splice(best, 1);
    out.push(t!);
    for (const g of groups(t!)) placed[g] = (placed[g] ?? 0) + 1;
  }
  return out;
}
