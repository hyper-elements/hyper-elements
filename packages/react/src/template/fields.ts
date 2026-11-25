/**
 * A template's fields: the `prop` helpers' specs (text, date, list, object, …) and `field.image()`, an image spec with
 * the rules only a template checks. Specs compose: a list keeps its `item`, an object its `fields`, so a rule inside a
 * list of objects (`stories[1].image`) is read wherever it is.
 */
import type { Json, Kind, PropSpec, PropSpecs } from "@hyper-elements/core";
import { prop, type FieldInput, type FieldValue } from "@hyper-elements/react";
import { slot } from "./slots";

/** An image field's value: its file's URL or path, and the file's size in px (what its rules are checked against). */
export interface ImageValue {
  src: string;
  width: number;
  height: number;
}

/** The image types a rule can name. */
export type ImageType = "png" | "jpeg" | "gif" | "svg" | "webp";

/** What a template asks of an image: checked against its declared size, its file, and where it's drawn. */
export interface ImageRules {
  /** `contain`: shown whole, at its own aspect. `cover`: fills its region, cropped from the center. */
  fit?: "contain" | "cover";
  /** Its width over its height, at least `min` and at most `max`. */
  aspect?: { min?: number; max?: number };
  minWidth?: number;
  minHeight?: number;
  accepts?: readonly ImageType[];
  transparent?: "required" | "forbidden";
  /** A `cover` image's most cut from either side, as a share of its width or height (0.6: 60%). */
  maxCrop?: number;
}

const RULE_KEYS = ["fit", "aspect", "minWidth", "minHeight", "accepts", "transparent", "maxCrop"] as const;

type ImageOptions<R extends boolean> = Omit<PropSpec<Kind<any, any>, R>, "kind" | "default"> & ImageRules;

/** An image field's spec: `prop.image()`'s, with its rules beside it (data the core kind never sees). */
export type ImageSpec<R extends boolean = boolean> = PropSpec<Kind<ImageValue, ImageValue & Json>, R> & { default: undefined; image: ImageRules };

/** Fields only a template checks. */
export const field = {
  /**
   * JSX the filler writes, inside limits the template sets: the components it may use (`allow`, or `"all"` less
   * `deny`), how it may be styled (`styles`), and how many of each (`count`). The template places it inside a built-in
   * bound to it: `<Section field="body">{v.body}</Section>`.
   */
  slot,
  /**
   * An image, given as `{ src, width, height }` (the file's size in px), with the rules a template checks: against
   * the size given, the file (the CLI, `checkLayout()`), and where the template draws it (bound with `field`).
   */
  image<const R extends boolean = false>(options: ImageOptions<R>): ImageSpec<R> {
    const rules: ImageRules = {};
    const rest: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(options)) {
      if ((RULE_KEYS as readonly string[]).includes(key)) {
        if (value !== undefined) (rules as Record<string, unknown>)[key] = Array.isArray(value) ? [...value] : typeof value === "object" && value !== null ? { ...value } : value;
      } else rest[key] = value;
    }
    checkRules(rules, String(options.label));
    return { ...prop.image(rest as never), image: rules } as unknown as ImageSpec<R>;
  },
};

function checkRules(rules: ImageRules, label: string): void {
  const wrong = (what: string) => {
    throw new TypeError(`[Elements] field.image() for "${label}": ${what}`);
  };
  if (rules.fit !== undefined && rules.fit !== "contain" && rules.fit !== "cover") wrong(`fit is "contain" or "cover", not ${JSON.stringify(rules.fit)}`);
  if (rules.maxCrop !== undefined && (typeof rules.maxCrop !== "number" || !(rules.maxCrop >= 0 && rules.maxCrop < 1))) wrong(`maxCrop is a share from 0 to under 1, not ${JSON.stringify(rules.maxCrop)}`);
  if (rules.maxCrop !== undefined && rules.fit !== "cover") wrong("maxCrop is for a cover image (fit: \"cover\")");
  for (const key of ["minWidth", "minHeight"] as const) if (rules[key] !== undefined && !(typeof rules[key] === "number" && rules[key]! > 0)) wrong(`${key} is a number of px, not ${JSON.stringify(rules[key])}`);
  const { min, max } = rules.aspect ?? {};
  if ((min !== undefined && !(min > 0)) || (max !== undefined && !(max > 0)) || (min !== undefined && max !== undefined && min > max)) wrong("aspect is { min, max }, each a width over a height above 0, min no more than max");
  if (rules.transparent !== undefined && rules.transparent !== "required" && rules.transparent !== "forbidden") wrong(`transparent is "required" or "forbidden", not ${JSON.stringify(rules.transparent)}`);
  for (const type of rules.accepts ?? []) if (!["png", "jpeg", "gif", "svg", "webp"].includes(type)) wrong(`accepts lists png, jpeg, gif, svg or webp, not ${JSON.stringify(type)}`);
}

// ─── The spec tree ──────────────────────────────────────────────────────────

export const isList = (spec: PropSpec): spec is PropSpec & { item: PropSpec } => typeof (spec as { item?: unknown }).item === "object";
export const isObjectSpec = (spec: PropSpec): spec is PropSpec & { fields: PropSpecs } => typeof (spec as { fields?: unknown }).fields === "object";
export const isBlocks = (spec: PropSpec): spec is PropSpec & { blocks: Record<string, PropSpec & { fields: PropSpecs }> } => typeof (spec as { blocks?: unknown }).blocks === "object";
export const imageRules = (spec: PropSpec): ImageRules | undefined => (spec as { image?: ImageRules }).image;
/** Whether an image spec asks anything of where it's drawn or of its file (a binding then lets it be checked). */
export const hasRules = (rules: ImageRules | undefined): boolean => !!rules && Object.keys(rules).length > 0;

/** Every spec in a tree of fields, with its path as a pattern (`stories[].image`; a block type's field with its `block`). */
export function specsOf(fields: PropSpecs, prefix = ""): Array<{ path: string; spec: PropSpec; block?: string }> {
  const out: Array<{ path: string; spec: PropSpec; block?: string }> = [];
  const visit = (spec: PropSpec, path: string, block?: string) => {
    out.push({ path, spec, ...(block ? { block } : {}) });
    if (isList(spec)) visit(spec.item, `${path}[]`);
    else if (isBlocks(spec)) for (const [type, child] of Object.entries(spec.blocks)) for (const [name, field] of Object.entries(child.fields)) visit(field, `${path}[].${name}`, type);
    else if (isObjectSpec(spec)) for (const [name, child] of Object.entries(spec.fields)) visit(child, `${path}.${name}`, block);
  };
  for (const [name, spec] of Object.entries(fields)) visit(spec, prefix ? `${prefix}.${name}` : name);
  return out;
}

/** The spec a field path names (`stories[1].image`), and its value in `values`, or undefined where it names none. */
export function fieldAt(fields: PropSpecs, values: unknown, path: string): { spec: PropSpec; value: unknown } | undefined {
  const steps = path.match(/[A-Za-z_][A-Za-z0-9_]*|\[\d+\]/g) ?? [];
  let specs: PropSpecs | undefined = fields;
  let spec: PropSpec | undefined;
  let value: unknown = values;
  for (const step of steps) {
    if (step.startsWith("[")) {
      if (!spec || !(isList(spec) || isBlocks(spec)) || !Array.isArray(value)) return undefined;
      const index = Number(step.slice(1, -1));
      if (index >= value.length) return undefined;
      if (isBlocks(spec)) {
        const type = (value[index] as { type?: string } | undefined)?.type;
        const block = type !== undefined && Object.prototype.hasOwnProperty.call(spec.blocks, type) ? spec.blocks[type] : undefined;
        if (!block) return undefined;
        [spec, value] = [block, value[index]];
      } else [spec, value] = [spec.item, value[index]];
    } else {
      if (spec) specs = isObjectSpec(spec) ? spec.fields : undefined;
      if (!specs || !Object.prototype.hasOwnProperty.call(specs, step)) return undefined;
      spec = specs[step];
      value = value && typeof value === "object" ? (value as Record<string, unknown>)[step] : undefined;
    }
  }
  return spec ? { spec, value } : undefined;
}

/** Every concrete path to an image with rules in some values (`artwork`, `stories[0].image`, `stories[2].image`). */
export function imagePaths(fields: PropSpecs, values: unknown): Array<{ path: string; rules: ImageRules; value: unknown }> {
  const out: Array<{ path: string; rules: ImageRules; value: unknown }> = [];
  const visit = (spec: PropSpec, value: unknown, path: string) => {
    const rules = imageRules(spec);
    if (rules) {
      if (value !== undefined) out.push({ path, rules, value });
    } else if (isList(spec)) (Array.isArray(value) ? value : []).forEach((item, index) => visit(spec.item, item, `${path}[${index}]`));
    else if (isBlocks(spec))
      (Array.isArray(value) ? value : []).forEach((item, index) => {
        const block = spec.blocks[(item as { type?: string })?.type ?? ""];
        if (block) visit(block, item, `${path}[${index}]`);
      });
    else if (isObjectSpec(spec) && value && typeof value === "object") for (const [name, child] of Object.entries(spec.fields)) visit(child, (value as Record<string, unknown>)[name], `${path}.${name}`);
  };
  for (const [name, spec] of Object.entries(fields)) visit(spec, values && typeof values === "object" ? (values as Record<string, unknown>)[name] : undefined, name);
  return out;
}

export type { FieldInput, FieldValue };
