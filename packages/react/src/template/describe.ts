/**
 * A template described for whoever fills it, before they start: its formats, every field (its kind, whether it's
 * required, its schema, its image rules and guidance), a JSON Schema of its values, and, for each image the template
 * shows, its region in each format and the smallest image that serves every one. Synchronous, and declared only:
 * what needs fonts or files is `checkLayout()`'s.
 */
import type { JsonSchema, PropSpec, PropSpecs, RootName } from "@hyper-elements/core";
import { coverCrop, regionsOf, type Definition, type Format } from "./checks";
import { imageRules, isBlocks, isList, isObjectSpec, specsOf, type ImageRules } from "./fields";
import { CORE_RULES, type LintRuleDescriptor, type TemplateRules } from "./rules";
import { isSlot, type ResolvedSlot } from "./slots";

/** The shape of what `describe()` returns: a new version is a new shape. */
export const DESCRIBE_VERSION = 1;

export interface FieldDescription extends Omit<ImageRules, "fit"> {
  /** Its path (`headline`); a list's items and an object's fields too (`stories[].image`). */
  path: string;
  /** "text", "list", "object", "date", "choice", "image", "link", "number", … */
  kind: string;
  label: string;
  description?: string;
  guidance?: string;
  required: boolean;
  default?: unknown;
  schema: JsonSchema;
  /** An image the template shows: its box in each format, and the pixels that box needs at the format's scale. */
  regions?: Record<string, { box: [number, number]; pixels: [number, number] } | "measured by check">;
  /**
   * An image's fit (`"contain"`, `"cover"`); or, for text a Canvas fits, by format, the sizes it may be drawn at and the
   * lines it may take, from its bound node's fit.
   */
  fit?: "contain" | "cover" | Record<string, { sizes?: number[]; maxLines?: number }>;
  /** A cover image: the smallest size that fills every format's region without upscaling, and what each crops. */
  suggested?: { width: number; height: number; crop: Record<string, string> };
  /** A field of a block type (`body[].image`): that block's type. */
  block?: string;
  /** A slot: the components its content may use, by type (`"all"`, with what it denies and the set it resolves to). */
  allow?: string[] | "all";
  deny?: string[];
  allowed?: string[];
  styles?: "none" | "theme" | "free";
  count?: Record<string, { min?: number; max?: number }>;
}

/** The rules a template requires, as whoever fills it reads them before starting. */
export interface RulesDescription {
  lint: Array<{ id: string; summary: string; fix: string }>;
  core: Array<{ code: string; stage: "read" | "measured" }>;
  links?: TemplateRules["links"];
  /** The hosts every image loads from. */
  images?: TemplateRules["images"];
  root?: string[];
}

export interface TemplateDescription {
  version: typeof DESCRIBE_VERSION;
  id: string;
  templateVersion: string;
  label: string;
  description?: string;
  root: RootName;
  guidance?: string;
  formats?: Record<string, Format>;
  fields: FieldDescription[];
  rules: RulesDescription;
  /** The theme's tokens by group, which slot content uses (`token("colors.primary")`), as inspect() lists them. */
  theme: unknown;
  /** A JSON Schema of the values. */
  valuesSchema: JsonSchema;
  /** What's fixed: everything not a field. */
  fixed: string;
}

const KIND_NAMES: Record<string, string> = { enum: "choice", asset: "image" };

/** A spec's own JSON Schema, a list's and an object's from their children (so a schema says what each holds). */
export function schemaOf(spec: PropSpec): JsonSchema {
  if (isList(spec)) {
    const own = spec.kind.jsonSchema() as { minItems?: number; maxItems?: number };
    return { type: "array", items: schemaOf(spec.item), ...(own.minItems !== undefined ? { minItems: own.minItems } : {}), ...(own.maxItems !== undefined ? { maxItems: own.maxItems } : {}) };
  }
  if (isObjectSpec(spec)) return valuesSchemaOf(spec.fields);
  if (isBlocks(spec)) {
    const own = spec.kind.jsonSchema() as { minItems?: number; maxItems?: number };
    const oneOf = Object.entries(spec.blocks).map(([type, branch]) => {
      const fields = valuesSchemaOf(branch.fields) as { properties: Record<string, unknown>; required?: string[] };
      return { type: "object", required: ["type", ...(fields.required ?? [])], properties: { type: { const: type }, ...fields.properties }, additionalProperties: false };
    });
    return { type: "array", items: { oneOf }, ...(own.minItems !== undefined ? { minItems: own.minItems } : {}), ...(own.maxItems !== undefined ? { maxItems: own.maxItems } : {}) };
  }
  if (imageRules(spec)) {
    return { type: "object", required: ["src", "width", "height"], properties: { src: { type: "string", minLength: 1 }, width: { type: "number", exclusiveMinimum: 0 }, height: { type: "number", exclusiveMinimum: 0 } }, additionalProperties: false };
  }
  // Required text isn't empty: check() refuses a blank one as it refuses one that's missing.
  if (spec.required && spec.kind.name === "text") return { ...(spec.kind.jsonSchema() as object), minLength: 1 };
  return spec.kind.jsonSchema();
}

/** A JSON Schema of fields' values: an object of exactly those, the required ones required. */
export function valuesSchemaOf(fields: PropSpecs): JsonSchema {
  const required = Object.entries(fields).filter(([, spec]) => spec.required).map(([name]) => name);
  return {
    type: "object",
    additionalProperties: false,
    ...(required.length ? { required } : {}),
    properties: Object.fromEntries(Object.entries(fields).map(([name, spec]) => [name, schemaOf(spec)])),
  };
}

/** The template described, with the regions read from `example` laid out in each format (`laidOut`). */
export function describeTemplate(
  definition: Definition & { description?: string; guidance?: string; slots: readonly ResolvedSlot[]; rules: TemplateRules; theme: unknown },
  laidOut: Array<{ format: string | undefined; values: Record<string, unknown>; root: import("@hyper-elements/core").ResolvedNode }>
): TemplateDescription {
  const regions = new Map<string, Record<string, { box: [number, number]; pixels: [number, number] } | "measured by check">>();
  const fitted = new Map<string, Record<string, { sizes?: number[]; maxLines?: number }>>();
  for (const { format, root } of laidOut) {
    const visit = (node: import("@hyper-elements/core").ResolvedNode) => {
      const fit = node.props.fit as { sizes?: number[]; maxLines?: number } | undefined;
      if (node.field && fit) {
        const pattern = node.field.replace(/\[\d+\]/g, "[]");
        const byFormat = fitted.get(pattern) ?? {};
        byFormat[format ?? "default"] ??= fit;
        fitted.set(pattern, byFormat);
      }
      for (const child of node.children) if (typeof child !== "string") visit(child);
    };
    visit(root);
  }
  for (const { format, values, root } of laidOut) {
    const scale = (format !== undefined && definition.formats?.[format]?.scale) || 1;
    for (const [path, region] of regionsOf(definition, values, root, scale)) {
      // A list's items share their pattern's entry (`stories[].image`): the first one shown says it.
      const pattern = path.replace(/\[\d+\]/g, "[]");
      const byFormat = regions.get(pattern) ?? {};
      byFormat[format ?? "default"] ??= region;
      regions.set(pattern, byFormat);
    }
  }
  const fields = specsOf(definition.fields).map(({ path, spec, block }): FieldDescription => {
    const rules = imageRules(spec);
    const kind = rules ? "image" : (KIND_NAMES[spec.kind.name] ?? spec.kind.name);
    const slot = isSlot(spec) ? definition.slots.find((s) => s.path === path) : undefined;
    const out: FieldDescription = {
      path,
      kind,
      label: spec.label,
      ...(spec.description ? { description: spec.description } : {}),
      required: !!spec.required,
      ...(spec.default !== undefined ? { default: spec.default } : {}),
      schema: schemaOf(spec),
      ...(rules ?? {}),
      ...(spec.guidance ? { guidance: spec.guidance } : {}),
      ...(block ? { block } : {}),
      ...(slot
        ? {
            allow: slot.all ? "all" : [...slot.builtIns, ...slot.customs.keys()],
            ...(slot.all ? { deny: [...slot.denied], ...(slot.customs.size ? { allowCustom: [...slot.customs.keys()] } : {}) } : {}),
            allowed: [...slot.builtIns, ...slot.customs.keys()],
            styles: slot.styles,
            count: { ...slot.count },
          }
        : {}),
    };
    if (fitted.has(path)) out.fit = fitted.get(path);
    const shown = regions.get(path);
    if (shown) {
      out.regions = shown;
      if (rules?.fit === "cover") {
        const suggested = suggest(shown);
        if (suggested) out.suggested = suggested;
      }
    }
    return out;
  });
  return {
    version: DESCRIBE_VERSION,
    id: definition.id,
    templateVersion: definition.version,
    label: definition.label,
    ...(definition.description ? { description: definition.description } : {}),
    root: definition.root,
    ...(definition.guidance ? { guidance: definition.guidance } : {}),
    ...(definition.formats ? { formats: definition.formats } : {}),
    fields,
    rules: describeRules(definition.rules),
    theme: definition.theme ?? null,
    valuesSchema: valuesSchemaOf(definition.fields),
    fixed: "Everything not listed: the layout, typography, colors, the fixed text and images, and the arrangement per format.",
  };
}

/** The smallest image that covers every region at its pixels without upscaling, and the share each crops. */
function suggest(regions: Record<string, { box: [number, number]; pixels: [number, number] } | "measured by check">): FieldDescription["suggested"] {
  const sized = Object.entries(regions).filter((entry): entry is [string, { box: [number, number]; pixels: [number, number] }] => entry[1] !== "measured by check");
  if (!sized.length) return undefined;
  const width = Math.max(...sized.map(([, region]) => region.pixels[0]));
  const height = Math.max(...sized.map(([, region]) => region.pixels[1]));
  const crop: Record<string, string> = {};
  for (const [format, region] of sized) {
    const { share, side } = coverCrop({ width, height }, region.box);
    crop[format] = share < 0.005 ? "crops nothing" : `cuts ${Math.round(share * 100)}% of the ${side}`;
  }
  return { width, height, crop };
}

/** Each required rule as it's read before writing: a lint rule's summary and fix from lint's own descriptors. */
function describeRules(rules: TemplateRules): RulesDescription {
  const descriptors = ((rules.plugins?.lint as { rules?: readonly LintRuleDescriptor[] } | undefined)?.rules ?? []) as readonly LintRuleDescriptor[];
  return {
    lint: (rules.require?.lint ?? []).map((id) => {
      const found = descriptors.find((d) => d.id === id);
      return { id, summary: found?.summary ?? "", fix: found?.fix ?? "" };
    }),
    core: (rules.require?.core ?? []).map((code) => ({ code, stage: CORE_RULES[code]?.stage ?? "read" })),
    ...(rules.links ? { links: rules.links } : {}),
    ...(rules.images?.domains ? { images: rules.images } : {}),
    ...(rules.root ? { root: Object.keys(rules.root) } : {}),
  };
}
