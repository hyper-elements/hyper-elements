/**
 * What a template's check finds once its design is built: the design's own problems (`validate()`), and what only the
 * template knows, read from the design laid out (`prepare()`): its root and its format's size, its bindings (a node's
 * `field` that names no field, an image with rules that nothing shows), and how each bound image is shown (distorted,
 * or cropped past what its rules allow). These catch a template's own mistakes, not only bad values.
 */
import type { CustomDefinition, Diagnostic, PropSpecs, ResolvedNode, RootName } from "@hyper-elements/core";
import { prepare, readFragment, slotMark, snapshot, validate, type FragmentCapture, type Snapshot } from "@hyper-elements/react";
import React from "react";
import { fieldAt, imagePaths, type ImageRules } from "./fields";
import { decideRules, pluginsOf, type RuleResult, type TemplateRules } from "./rules";
import { isSlot, isStoredSlot, preflight, type BrandMap, type ResolvedSlot } from "./slots";

export const TEMPLATE_RECORD = Symbol.for("hyper-elements.template");

/** A format: a Canvas's size (and its pixels per px), or a Document's page. */
export interface Format {
  width?: number;
  height?: number;
  scale?: number;
  size?: "A3" | "A4" | "A5" | "Letter" | "Legal" | "Tabloid";
  orientation?: "portrait" | "landscape";
}

/** What a template is, read: what its checks need. */
export interface Definition {
  id: string;
  version: string;
  label: string;
  root: RootName;
  formats?: Record<string, Format>;
  fields: PropSpecs;
  render(values: unknown, context: { format: string | undefined }): React.ReactElement;
}

export interface Built {
  /** The design, as a snapshot, where the render gave one. */
  snapshot?: Snapshot;
  /** The design's own problems, as `validate()` finds them. */
  design: Diagnostic[];
  /** What the template found in it, and its required rules' findings. */
  own: Diagnostic[];
  /** It laid out, for what reads its boxes (describe()'s regions). */
  root?: ResolvedNode | null;
  /** Each required rule's result. */
  rules: RuleResult[];
}

/** What building a design needs beside its values: the template's slots, the brand-valued styles, its rules. */
export interface BuildContext {
  slots: readonly ResolvedSlot[];
  brand: BrandMap;
  rules: TemplateRules;
  /** Captures for slots stored as `{ module }`, by path. */
  fragments?: Readonly<Record<string, FragmentCapture>>;
}

const error = (code: string, message: string, path: string, extra: Partial<Diagnostic> = {}): Diagnostic => ({ code, severity: "error", message, path, ...extra });

/**
 * The design built from checked values for one format, and checked. Each slot's value is a mark when the render runs
 * (the template never sees its content), its content is captured on its own and spliced in, and the preflight checks
 * it before anything is read: what's checked and rendered is the one snapshot this returns.
 */
export function build(definition: Definition, values: Record<string, unknown>, format: string | undefined, context: BuildContext): Built {
  const marked: Record<string, unknown> = { ...values };
  const fragments: Record<string, React.ReactElement | FragmentCapture> = {};
  const problems: Diagnostic[] = [];
  for (const slot of context.slots) {
    const value = values[slot.path];
    if (value === undefined) continue;
    marked[slot.path] = slotMark(slot.path);
    if (React.isValidElement(value)) fragments[slot.path] = value;
    else if (isStoredSlot(value) && "fragment" in value) {
      try {
        fragments[slot.path] = readFragment(value.fragment);
      } catch (thrown) {
        problems.push(...((thrown as { diagnostics?: Diagnostic[] }).diagnostics ?? []).map((d) => ({ ...d, path: `values.${slot.path}` })));
      }
    } else if (context.fragments?.[slot.path]) fragments[slot.path] = context.fragments[slot.path];
  }
  if (problems.length) return { design: [], own: problems, rules: [] };
  let element: unknown;
  try {
    element = definition.render(marked, { format });
  } catch (thrown) {
    return { design: [], own: [error("template/render", `${definition.id}'s render threw: ${thrown instanceof Error ? thrown.message : String(thrown)}`, "root")], rules: [] };
  }
  if (!React.isValidElement(element)) return { design: [], own: [error("template/render", `${definition.id}'s render returns its root as JSX (<${definition.root}>…</${definition.root}>), not ${element === null ? "null" : typeof element}`, "root")], rules: [] };
  if ((element.type as unknown as Record<symbol, unknown> | null)?.[TEMPLATE_RECORD]) {
    return { design: [], own: [error("template/root", `${definition.id}'s render returns another template: it returns a ${definition.root}`, "root")], rules: [] };
  }
  const bind: Record<string, readonly CustomDefinition<any>[]> = {};
  for (const slot of context.slots) bind[slot.path] = [...slot.customs.values()];
  const snap = snapshot(element, {
    fragments,
    bind,
    preflight: (path, capture, host, marks) => {
      const slot = context.slots.find((s) => s.path === path);
      return slot ? preflight({ slot, brand: context.brand, id: definition.id }, capture, host, marks) : [];
    },
  });
  // The design's own checks, with the template's plugins (lint's findings are its rules' to raise).
  const checked = validate(snap, { plugins: pluginsOf(context.rules) });
  const own: Diagnostic[] = [];
  if (!checked.valid) return { snapshot: snap, design: checked.diagnostics, own, rules: [] };
  const { root } = prepare(snap);
  if (!root) return { snapshot: snap, design: checked.diagnostics, own, rules: [] };
  if (root.type !== definition.root) own.push(error("template/root", `${definition.id} is a ${definition.root}: its render returned a ${root.type}`, "root"));
  if (format !== undefined) own.push(...formatProblems(definition, format, root));
  own.push(...bindingProblems(definition, values, root, new Set(context.slots.map((slot) => slot.path))));
  const decided = decideRules(context.rules, { id: definition.id, root: definition.root, ...(format !== undefined ? { format } : {}), validated: checked.diagnostics, laidOut: root });
  own.push(...decided.diagnostics);
  return { snapshot: snap, design: checked.diagnostics.filter((d) => !decided.raised.has(d)), own, root, rules: decided.results };
}

const SNAPSHOT = Symbol.for("hyper-elements.snapshot");

/**
 * A snapshot with its template and the required rules it couldn't decide (measured ones): a writer given it refuses
 * it until one that can decide them does (Decision 31).
 */
export function withTemplate(snap: Snapshot, template: { id: string; version: string }, rules: readonly RuleResult[]): Snapshot {
  const data = (snap as unknown as Record<symbol, Record<string, unknown>>)[SNAPSHOT];
  const pending = rules.filter((rule) => rule.status === "not-run" && rule.source === "core").map((rule) => ({ rule: rule.rule, ...(rule.format ? { format: rule.format } : {}), decidedBy: "@hyper-elements/react/image's renderImage()" }));
  const out = { kind: "hyper-elements.snapshot" as const };
  Object.defineProperty(out, SNAPSHOT, { value: Object.freeze({ ...data, template, ...(pending.length ? { pending: Object.freeze(pending) } : {}) }) });
  return Object.freeze(out);
}

/** A Canvas the format's size, a Document on the format's page. */
function formatProblems(definition: Definition, name: string, root: ResolvedNode): Diagnostic[] {
  const format = definition.formats?.[name];
  if (!format) return [];
  const out: Diagnostic[] = [];
  const differs = (key: "width" | "height" | "size" | "orientation") => format[key] !== undefined && root.props[key] !== format[key];
  for (const key of ["width", "height", "size", "orientation"] as const) {
    if (differs(key)) out.push(error("template/format", `The ${name} format's ${key} is ${JSON.stringify(format[key])}; the ${root.type} its render built has ${JSON.stringify(root.props[key])}`, `root.props.${key}`));
  }
  return out;
}

/** Every node, with the one that holds it. */
function walk(node: ResolvedNode, visit: (node: ResolvedNode, parent: ResolvedNode | undefined) => void, parent?: ResolvedNode): void {
  visit(node, parent);
  for (const child of node.children) if (typeof child !== "string") walk(child, visit, node);
}

/** The box an image bound to a field is shown in: its Layer's, where it's a Layer's base (drawn as a cover), else its own. */
export function shownBox(node: ResolvedNode, parent: ResolvedNode | undefined, file: { width?: number; height?: number }): { box?: [number, number]; base: boolean } {
  const height = (n: ResolvedNode) => (typeof n.style.height === "number" ? n.style.height : undefined);
  const firstShown = parent?.children.find((child): child is ResolvedNode => typeof child !== "string" && !child.hidden?.desktop);
  if (parent?.type === "Layer" && firstShown === node && height(parent) !== undefined) {
    return { box: parent.width !== null ? [parent.width, height(parent)!] : undefined, base: true };
  }
  if (node.width === null) return { base: false };
  const own = height(node) ?? (file.width && file.height ? (node.width * file.height) / file.width : undefined);
  return { box: own === undefined ? undefined : [node.width, own], base: false };
}

/** The share a cover image loses to fill a box: of its width where it's wider than the box, else of its height. */
export function coverCrop(file: { width: number; height: number }, box: [number, number]): { share: number; side: "width" | "height" } {
  const [fileAspect, boxAspect] = [file.width / file.height, box[0] / box[1]];
  return fileAspect > boxAspect ? { share: 1 - boxAspect / fileAspect, side: "width" } : { share: 1 - fileAspect / boxAspect, side: "height" };
}

const percent = (share: number) => `${Math.round(share * 100)}%`;

/**
 * Every node the template itself wrote, with the one that holds it. What's under a slot's host is the slot's content:
 * its fields are its own (template/slot-field), never a binding the template reads.
 */
function walkOwn(root: ResolvedNode, slots: ReadonlySet<string>, visit: (node: ResolvedNode, parent: ResolvedNode | undefined) => void): void {
  const inSlot = new Set<ResolvedNode>();
  walk(root, (node, parent) => {
    if (inSlot.has(node)) {
      for (const child of node.children) if (typeof child !== "string") inSlot.add(child);
      return;
    }
    if (node.field && slots.has(node.field)) for (const child of node.children) if (typeof child !== "string") inSlot.add(child);
    visit(node, parent);
  });
}

function bindingProblems(definition: Definition, values: Record<string, unknown>, root: ResolvedNode, slots: ReadonlySet<string>): Diagnostic[] {
  const out: Diagnostic[] = [];
  const bound = new Map<string, Array<{ node: ResolvedNode; parent?: ResolvedNode }>>();
  walkOwn(root, slots, (node, parent) => {
    if (!node.field) return;
    if (!fieldAt(definition.fields, values, node.field)) {
      out.push(error("template/unknown-binding", `field="${node.field}" names no field of ${definition.id} with a value here`, `${node.path}.field`, { field: node.field }));
      return;
    }
    bound.set(node.field, [...(bound.get(node.field) ?? []), { node, parent }]);
  });
  for (const { path, rules, value } of imagePaths(definition.fields, values)) {
    const shown = bound.get(path) ?? [];
    if (!shown.length) {
      out.push({ code: "template/unbound", severity: "warning", message: `The image field ${path} has rules, but no node shows it with field="${path}": how it's shown can't be checked`, path: `values.${path}`, field: path });
      continue;
    }
    for (const { node, parent } of shown) if (node.type === "Image") out.push(...imageProblems(path, rules, value as { width: number; height: number }, node, parent));
  }
  return out;
}

function imageProblems(path: string, rules: ImageRules, file: { width: number; height: number }, node: ResolvedNode, parent: ResolvedNode | undefined): Diagnostic[] {
  const { box, base } = shownBox(node, parent, file);
  const at = node.path;
  if (rules.fit === "contain") {
    if (base) return [error("template/asset-cropped", `${path} is shown whole (fit: "contain"), but it's its Layer's base, which is drawn to cover the Layer: it's cropped`, at, { field: path, fix: "Put it over the Layer's base, sized with fitInside()" })];
    if (box) {
      const [shown, own] = [box[0] / box[1], file.width / file.height];
      if (Math.abs(shown / own - 1) > 0.01) {
        return [error("template/asset-distorted", `${path} is ${file.width}×${file.height} but shown at ${Math.round(box[0])}×${Math.round(box[1])}: it's stretched (fit: "contain" keeps its aspect)`, at, { field: path, fix: "Size it with fitInside(image, box)" })];
      }
    }
  }
  if (rules.fit === "cover" && rules.maxCrop !== undefined && box) {
    const { share, side } = coverCrop(file, box);
    if (share > rules.maxCrop + 1e-9) {
      return [error("template/asset-cropped", `${path} loses ${percent(share)} of its ${side} to fill its ${Math.round(box[0])}×${Math.round(box[1])} box; it takes at most ${percent(rules.maxCrop)}`, at, { field: path })];
    }
  }
  return [];
}

/** Each bound image's box and pixels, for describe()'s regions: from the layout of `values` in one format. */
export function regionsOf(definition: Definition, values: Record<string, unknown>, root: ResolvedNode, scale: number): Map<string, { box: [number, number]; pixels: [number, number] } | "measured by check"> {
  const out = new Map<string, { box: [number, number]; pixels: [number, number] } | "measured by check">();
  walkOwn(root, new Set(Object.keys(definition.fields).filter((name) => isSlot(definition.fields[name]))), (node, parent) => {
    if (!node.field || node.type !== "Image" || out.has(node.field)) return;
    const found = fieldAt(definition.fields, values, node.field);
    const file = (found?.value ?? {}) as { width?: number; height?: number };
    const { box } = shownBox(node, parent, file);
    out.set(node.field, box ? { box: [round(box[0]), round(box[1])], pixels: [Math.round(box[0] * scale), Math.round(box[1] * scale)] } : "measured by check");
  });
  return out;
}

const round = (n: number) => Math.round(n * 100) / 100;
