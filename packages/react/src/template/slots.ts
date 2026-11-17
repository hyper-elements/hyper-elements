/**
 * Slots: JSX the filler writes, inside limits the template sets. A slot's content is collected on its own and
 * spliced in at its mark (Decision 29's snapshot), and its preflight runs on the captured content before anything is
 * read or expanded: which elements it may use (built-ins by type, a custom element by its definition, never its
 * name), how it may be styled (`"none"`, `"theme"` or `"free"`), how many of each (`count`), and no `attrs`, scopes
 * or bindings of its own.
 */
import type { CustomDefinition, Diagnostic, Json, Kind, PropSpec, RootName } from "@hyper-elements/core";
import type { CapturedNode, FragmentCapture } from "@hyper-elements/react";
import { describeElements } from "@hyper-elements/react/inspect";
import React from "react";

/** How a slot's content may be styled: only the theme's named styles and variants, every brand value a token, or anything. */
export type SlotStyles = "none" | "theme" | "free";

/** An element a slot allows: a built-in (`Text`) or a custom element, given as the element itself. */
export type SlotComponent = React.ComponentType<any>;

export interface SlotOptions<R extends boolean> {
  label: string;
  required?: R;
  description?: string;
  guidance?: string;
  /** The elements its content may use, or `"all"` (every built-in its root takes but the roots and Html), with custom elements beside it. */
  allow: "all" | ReadonlyArray<SlotComponent | "all">;
  /** With `"all"`: built-ins it leaves out. */
  deny?: readonly SlotComponent[];
  /** How its content may be styled (default `"theme"`). */
  styles?: SlotStyles;
  /** How many of a type its content may hold, by type name: `{ Button: { min: 1, max: 2 } }`. */
  count?: Record<string, { min?: number; max?: number }>;
}

/** A slot as it's stored: its content's module, or its content captured (Decision 24). */
export type StoredSlot = { module: string } | { fragment: FragmentCapture };

/** What a slot's spec holds besides a prop spec's. */
export interface SlotRules {
  allow: ReadonlyArray<SlotComponent | "all">;
  deny: readonly SlotComponent[];
  styles: SlotStyles;
  count: Readonly<Record<string, { min?: number; max?: number }>>;
}

/** A slot's spec: what a template's fields hold for one. Its value is the content: a React element. */
export type SlotSpec<R extends boolean = boolean> = PropSpec<Kind<React.ReactElement, never>, R> & { default: undefined; slot: SlotRules };

const STORED_SCHEMA = {
  oneOf: [
    { type: "object", required: ["module"], properties: { module: { type: "string", minLength: 1 } }, additionalProperties: false },
    { type: "object", required: ["fragment"], properties: { fragment: { type: "object" } }, additionalProperties: false },
  ],
};

/** A slot's kind: what template() reads, never core (it takes the content, an element, or its stored form). */
const SLOT_KIND = Object.freeze({
  name: "slot",
  editor: "text" as const,
  accepts: "JSX (a React element), or stored as { module } or { fragment }",
  parse: (input: unknown) => ({ ok: true as const, value: input as never }),
  jsonSchema: () => STORED_SCHEMA,
});

export function slot<const R extends boolean = false>(options: SlotOptions<R>): SlotSpec<R> {
  const { allow, deny, styles, count, ...rest } = options;
  const list = allow === "all" ? ["all" as const] : [...(allow ?? [])];
  const rules: SlotRules = Object.freeze({ allow: Object.freeze(list), deny: Object.freeze([...(deny ?? [])]), styles: styles ?? "theme", count: Object.freeze(JSON.parse(JSON.stringify(count ?? {}))) });
  return { ...rest, kind: SLOT_KIND, slot: rules } as unknown as SlotSpec<R>;
}

export const isSlot = (spec: PropSpec): spec is SlotSpec => typeof (spec as { slot?: unknown }).slot === "object";
export const isStoredSlot = (value: unknown): value is StoredSlot =>
  typeof value === "object" && value !== null && !React.isValidElement(value) && (typeof (value as { module?: unknown }).module === "string" || typeof (value as { fragment?: unknown }).fragment === "object");

// ─── Resolving a slot when the template is defined ──────────────────────────

const PRIMITIVE = Symbol.for("@hyper-elements/react/primitive");
const ROOTS = ["Email", "Page", "Document", "Canvas"];
const CUSTOM_TYPE = /^[a-z][a-z0-9-]*\.[A-Z][A-Za-z0-9]*$/;

/** A built-in element's type, or a custom element's definition. */
function identify(component: unknown): { builtIn: string } | { custom: CustomDefinition<any> } | undefined {
  const type = component && (typeof component === "function" || typeof component === "object") ? (component as Record<symbol, unknown>)[PRIMITIVE] : undefined;
  if (typeof type === "string") return { builtIn: type };
  const definition = (component as { definition?: CustomDefinition<any> } | undefined)?.definition;
  if (definition && typeof definition.type === "string" && CUSTOM_TYPE.test(definition.type)) return { custom: definition };
  return undefined;
}

/** A slot's rules, resolved for the template's root: the built-in types it allows, and its custom elements by type. */
export interface ResolvedSlot {
  path: string;
  label: string;
  required: boolean;
  builtIns: ReadonlySet<string>;
  customs: ReadonlyMap<string, CustomDefinition<any>>;
  all: boolean;
  denied: readonly string[];
  styles: SlotStyles;
  count: Readonly<Record<string, { min?: number; max?: number }>>;
}

const problem = (code: string, message: string, path: string): Diagnostic => ({ code, severity: "error", message, path });

/** Every built-in a root may hold at some depth (as describeElements({ root }) lists them), but the roots and Html. */
export function allUnder(root: RootName): string[] {
  return describeElements({ root }).elements
    .map((c) => c.type)
    .filter((type) => !ROOTS.includes(type) && type !== "Html" && !CUSTOM_TYPE.test(type));
}

/** A slot's `allow` and `deny` read for the template's root, with the problems a template is refused for. */
export function resolveSlot(path: string, spec: SlotSpec, root: RootName): { slot?: ResolvedSlot; problems: Diagnostic[] } {
  const problems: Diagnostic[] = [];
  const at = `fields.${path}`;
  const builtIns = new Set<string>();
  const customs = new Map<string, CustomDefinition<any>>();
  let all = false;
  if (!spec.slot.allow.length) problems.push(problem("template/slot-allow", `The slot ${path}'s allow lists the elements its content may use, or "all"`, `${at}.allow`));
  for (const entry of spec.slot.allow) {
    if (entry === "all") {
      all = true;
      continue;
    }
    const found = identify(entry);
    if (!found) problems.push(problem("template/slot-allow", `The slot ${path}'s allow holds elements (Text, a custom element of yours) or "all", not ${typeof entry === "string" ? JSON.stringify(entry) : String(entry)}`, `${at}.allow`));
    else if ("builtIn" in found) builtIns.add(found.builtIn);
    else if (customs.has(found.custom.type) && customs.get(found.custom.type) !== found.custom)
      problems.push(problem("template/slot-allow", `The slot ${path}'s allow has two different custom elements named ${found.custom.type}: its content names one by type, so one may be allowed`, `${at}.allow`));
    else customs.set(found.custom.type, found.custom);
  }
  const denied: string[] = [];
  if (spec.slot.deny.length && !all) problems.push(problem("template/slot-allow", `The slot ${path}'s deny leaves built-ins out of "all": beside a list of allowed elements, it says nothing (list only what's allowed)`, `${at}.deny`));
  for (const entry of spec.slot.deny) {
    const found = identify(entry);
    if (found && "custom" in found) problems.push(problem("template/slot-allow", `The slot ${path}'s deny holds built-ins only: "all" allows no custom element of yours, so leave ${found.custom.type} out of allow instead`, `${at}.deny`));
    else if (found) denied.push(found.builtIn);
    else problems.push(problem("template/slot-allow", `The slot ${path}'s deny holds built-in elements (Table, Video)`, `${at}.deny`));
  }
  if (all) for (const type of allUnder(root)) if (!denied.includes(type)) builtIns.add(type);
  // A root and Html are never slot content, listed or not.
  for (const type of [...ROOTS, "Html"]) builtIns.delete(type);
  if (!["none", "theme", "free"].includes(spec.slot.styles)) problems.push(problem("template/slot-allow", `The slot ${path}'s styles is "none", "theme" or "free", not ${JSON.stringify(spec.slot.styles)}`, `${at}.styles`));
  for (const [type, limits] of Object.entries(spec.slot.count)) {
    const bad = !limits || typeof limits !== "object" || [limits.min, limits.max].some((n) => n !== undefined && !(Number.isInteger(n) && n >= 0)) || (limits.min !== undefined && limits.max !== undefined && limits.min > limits.max);
    if (bad) problems.push(problem("template/slot-allow", `The slot ${path}'s count of ${type} is { min, max }, whole numbers, min no more than max`, `${at}.count.${type}`));
  }
  return {
    problems,
    slot: { path, label: spec.label, required: !!spec.required, builtIns, customs, all, denied, styles: spec.slot.styles, count: spec.slot.count },
  };
}

// ─── The preflight ──────────────────────────────────────────────────────────

/** The kinds whose values carry the brand, and the styles that do whatever their kind. */
const BRAND_KINDS = new Set(["color", "fontFamily", "insets", "radius", "border", "line"]);
const BRAND_STYLES = new Set(["fontSize", "lineHeight", "letterSpacing", "gap", "rowGap"]);
/** A custom element's prop that takes a theme's token (`prop.color`, `prop.fontFamily`): brand-valued. */
const BRAND_PROP_KINDS = new Set(["color", "fontFamily"]);

/** By built-in type: its brand-valued styles and props, each with its kind's name. */
export interface BrandMap {
  styles: Map<string, Map<string, string>>;
  props: Map<string, Map<string, string>>;
}

/** The brand-valued styles and props of every built-in, read from their definitions' kinds. */
export function brandMap(): BrandMap {
  const styles = new Map<string, Map<string, string>>();
  const props = new Map<string, Map<string, string>>();
  for (const component of describeElements().elements) {
    const s = new Map<string, string>();
    const p = new Map<string, string>();
    for (const property of component.properties) {
      const [where, key] = property.path.split(".") as [string, string];
      const brand = BRAND_KINDS.has(property.kind) || (where === "style" && BRAND_STYLES.has(key));
      if (!brand) continue;
      if (where === "style") s.set(key, property.kind);
      else if (where === "props") p.set(key, property.kind);
    }
    styles.set(component.type, s);
    props.set(component.type, p);
  }
  return { styles, props };
}

const isToken = (value: unknown): boolean => typeof value === "object" && value !== null && !Array.isArray(value) && typeof (value as { $token?: unknown }).$token === "string" && Object.keys(value).length === 1;
const isZero = (value: unknown) => value === 0 || value === "0" || value === "0px";

/** Why a brand value isn't a token where the theme's are required, or undefined where it's fine. */
function untokened(value: Json | undefined, kind: string): string | undefined {
  if (value === undefined || isToken(value)) return undefined;
  if (kind === "border" || kind === "line") {
    if (typeof value === "string") return "a border written as a string (its color a literal): write it as an object, its color a token()";
    if (typeof value !== "object" || value === null || Array.isArray(value)) return "not a token()";
    const sides = "width" in value || "style" in value || "color" in value || !Object.keys(value).length ? [value] : Object.values(value);
    for (const side of sides) {
      // A side is read as the whole border is: a string holds a literal color, as "3px solid #ff0000" does for every side.
      if (typeof side === "string") return "a border side written as a string (its color a literal): write it as an object, its color a token()";
      if (side === null || typeof side !== "object" || Array.isArray(side)) return "not a token()";
      const color = (side as Record<string, Json>).color;
      if (color === undefined) return "a border side with no color (it's drawn black): give its color as a token()";
      if (!isToken(color)) return "a border whose color isn't a token()";
    }
    return undefined;
  }
  if (kind === "insets" || kind === "radius") {
    if (isZero(value)) return undefined;
    const parts = Array.isArray(value) ? value : typeof value === "object" && value !== null ? Object.values(value) : [value];
    return parts.every((part) => isToken(part) || isZero(part)) ? undefined : "a literal: each side a token() or 0";
  }
  return "a literal";
}

export interface PreflightContext {
  slot: ResolvedSlot;
  brand: BrandMap;
  /** The template's id, for messages. */
  id: string;
}

/**
 * A slot's content checked as captured, before anything is read: its host, its elements, its styles and scopes, its
 * attributes and bindings, and its counts. Diagnostics carry the document's paths.
 */
export function preflight(context: PreflightContext, capture: FragmentCapture, host: { node: CapturedNode; path: string } | null, marks: number): Diagnostic[] {
  const { slot, brand } = context;
  const out: Diagnostic[] = [];
  const at = `values.${slot.path}`;
  if (marks !== 1 || !host) {
    return [problem("template/slot-host", `${context.id}'s render places the slot ${slot.path} ${marks === 0 ? "nowhere" : `${marks} times`}: once, as the content of a node bound to it (<Section field="${slot.path}">{v.${slot.path}}</Section>)`, at)];
  }
  if (CUSTOM_TYPE.test(host.node.type) || host.node.field !== slot.path) {
    return [problem("template/slot-host", `The slot ${slot.path} is placed in a ${host.node.type} that isn't bound to it: its host is a built-in with field="${slot.path}"`, host.path)];
  }
  const definitions = new Map<string, CustomDefinition<any>>();
  for (const definition of (capture as unknown as Record<symbol, readonly CustomDefinition<any>[] | undefined>)[Symbol.for("hyper-elements.fragment.definitions")] ?? []) definitions.set(definition.type, definition);
  const counts = new Map<string, number>();
  const allowed = [...slot.builtIns].concat([...slot.customs.keys()]);
  const list = allowed.length > 12 ? `${allowed.slice(0, 12).join(", ")}, …` : allowed.join(", ");
  // `hidden`: the widths at which something that holds the node hides it (a node inside a hidden one isn't shown either).
  const visit = (node: CapturedNode, path: string, hidden: { mobile: boolean; desktop: boolean }) => {
    const custom = CUSTOM_TYPE.test(node.type);
    if (node.type === "#slot") return;
    // Which elements: built-ins by type, a custom element by its definition, never its name.
    if (ROOTS.includes(node.type) || node.type === "Html") {
      out.push(problem("template/slot-element", `A slot's content can't hold ${node.type === "Html" ? "an Html block" : `a ${node.type}`}: ${context.id}'s ${slot.path} takes ${list}`, path));
      return;
    }
    if (custom) {
      const genuine = slot.customs.get(node.type);
      const own = definitions.get(node.type);
      if (!genuine) {
        out.push(problem("template/slot-element", `${node.type} isn't one of the elements ${context.id}'s ${slot.path} takes (${list})`, path));
        return;
      }
      if (own && own !== genuine) {
        out.push(problem("template/slot-element", `This ${node.type} isn't the template's: it was defined by the slot's content. ${slot.path} takes the template's own ${node.type}`, path));
        return;
      }
    } else if (!slot.builtIns.has(node.type)) {
      out.push(
        problem(
          "template/slot-element",
          slot.denied.includes(node.type) ? `${context.id} denies ${node.type} in ${slot.path}` : `A ${node.type} isn't one of the elements ${context.id}'s ${slot.path} takes (${list})`,
          path
        )
      );
      return;
    }
    const hiddenAt = { mobile: hidden.mobile || !!node.hidden?.mobile, desktop: hidden.desktop || !!node.hidden?.desktop };
    const shown = !(hiddenAt.mobile && hiddenAt.desktop);
    if (shown) counts.set(node.type, (counts.get(node.type) ?? 0) + 1);
    // No attributes: id and hidden go through id and hidden, which validation, counting and lint read.
    if (node.props && "attrs" in node.props) out.push(problem("template/slot-attrs", `A slot's content can't set attrs (they can hide it or take another node's id): use id and hidden`, `${path}.props.attrs`));
    if (node.field !== undefined) out.push({ code: "template/slot-field", severity: "info", message: `field="${node.field}" inside the slot ${slot.path} is the content's own: the template reads no binding there`, path: `${path}.field` });
    if (slot.styles !== "free") {
      for (const key of ["tokens", "theme"] as const) if (node[key] !== undefined) out.push(problem("template/slot-tokens", `A slot's content can't set ${key}: they'd change what the theme's tokens mean inside it`, `${path}.${key}`));
      out.push(...styleProblems(node, path, context, custom ? definitions.get(node.type) ?? slot.customs.get(node.type) : undefined));
    }
    node.children.forEach((child, i) => typeof child !== "string" && visit(child, `${path}.children[${i}]`, hiddenAt));
  };
  host.node.children.forEach((child, i) => typeof child !== "string" && visit(child, `${host.path}.children[${i}]`, { mobile: false, desktop: false }));
  for (const [type, { min, max }] of Object.entries(slot.count)) {
    const n = counts.get(type) ?? 0;
    if ((min !== undefined && n < min) || (max !== undefined && n > max)) {
      out.push(problem("template/slot-count", `The slot ${slot.path} holds ${n} ${type}${n === 1 ? "" : "s"}; ${context.id} takes ${min !== undefined && max !== undefined ? (min === max ? `exactly ${min}` : `${min} to ${max}`) : min !== undefined ? `at least ${min}` : `at most ${max}`}`, host.path));
    }
  }
  return out;
}

/** A node's styles and brand-valued props, against the slot's style policy. */
function styleProblems(node: CapturedNode, path: string, context: PreflightContext, custom: CustomDefinition<any> | undefined): Diagnostic[] {
  const out: Diagnostic[] = [];
  const { slot, brand } = context;
  const none = slot.styles === "none";
  const blocks: Array<[string, Record<string, Json> | undefined]> = [
    ["style", node.style],
    ["mobile", (node.mobile ?? (node.style?.mobile as Record<string, Json> | undefined)) as Record<string, Json> | undefined],
    ["hover", (node.hover ?? (node.style?.hover as Record<string, Json> | undefined)) as Record<string, Json> | undefined],
  ];
  const styleKinds = brand.styles.get(node.type) ?? new Map<string, string>();
  for (const [where, block] of blocks) {
    if (!block) continue;
    const base = where === "style" ? `${path}.style` : node[where as "mobile" | "hover"] ? `${path}.${where}` : `${path}.style.${where}`;
    for (const [key, value] of Object.entries(block)) {
      if (key === "apply" || (where === "style" && (key === "mobile" || key === "hover"))) continue;
      if (none) {
        out.push(problem("template/slot-style", `${context.id}'s ${slot.path} takes no styles of its own (styles: "none"): use the theme's named styles (style={{ apply: [...] }}) and variants, not ${key}`, `${base}.${key}`));
        continue;
      }
      const kind = styleKinds.get(key);
      const why = kind ? untokened(value, kind) : undefined;
      if (why) out.push(problem("template/slot-style", `${key} is ${why}: ${context.id}'s ${slot.path} takes the theme's tokens for it (token("…"))`, `${base}.${key}`));
    }
  }
  const propKinds = custom
    ? new Map(Object.entries(custom.props as Record<string, PropSpec>).filter(([, spec]) => BRAND_PROP_KINDS.has(spec.kind.name)).map(([name, spec]) => [name, spec.kind.name] as [string, string]))
    : (brand.props.get(node.type) ?? new Map<string, string>());
  // fit sets a font size (Decision 10): a brand value, so not in content under "none" or "theme".
  if (node.props && "fit" in node.props) out.push(problem("template/slot-style", `fit sets a font size, which ${context.id}'s ${slot.path} takes from the theme: fitting inside a slot is the template's`, `${path}.props.fit`));
  for (const [key, value] of Object.entries(node.props ?? {})) {
    const kind = propKinds.get(key);
    if (!kind) continue;
    if (none) out.push(problem("template/slot-style", `${key} is a brand value, which ${context.id}'s ${slot.path} doesn't take (styles: "none"), even as a token`, `${path}.props.${key}`));
    else {
      const why = untokened(value, kind);
      if (why) out.push(problem("template/slot-style", `${key} is ${why}: ${context.id}'s ${slot.path} takes the theme's tokens for it (token("…"))`, `${path}.props.${key}`));
    }
  }
  return out;
}
