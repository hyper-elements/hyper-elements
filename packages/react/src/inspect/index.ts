/**
 * `@hyper-elements/react/inspect`: what each root takes, and what a template holds, as data, without rendering
 * anything. For an agent's tool call or an editor: "can I use this here?" before writing, and "is each part of this
 * template allowed in its root?" after. Read from the elements' definitions, the same ones validation and the
 * generated guide read, so the three agree. Synchronous; it loads no engine, browser or network.
 *
 * Every result carries `version`: its shape changes only with a new version.
 */
import React from "react";
import {
  componentRoots,
  describeComponent as describeOne,
  describeComponents as describeAll,
  describeConditions,
  Registry,
  ThemeEnvironment,
  validateTemplate,
  CONDITION_NAMES,
  CUSTOM_TYPE,
  ROOT_NAMES,
  type ComponentDescription as Described,
  type ConditionName,
  type CustomDefinition,
  type Diagnostic,
  type Json,
  type PropertyDescription,
  type RootName,
  type StyleGroup,
} from "@hyper-elements/core";
import { collectTemplate, type JsonNode } from "../primitives/collect";

export type { ConditionName, Diagnostic, PropertyDescription, RootName, StyleGroup };

/** An element (a built-in one, or a template's own), with its props and styles, as `describeElements()` gives it. */
export type ElementDescription = Described;
/** @deprecated Renamed `ElementDescription`. */
export type ComponentDescription = Described;

/** The shape of what this entry returns: a new version is a new shape. */
export const INSPECT_VERSION = 2;

/** A template's own element (made with `defineElement()`), described alongside the built-in ones. */
interface WithDefinition {
  definition: CustomDefinition<any>;
}

export interface DescribeOptions {
  /** Only what this root takes, with phone styles only under a root that has phones. */
  root?: RootName;
  /** A template's own elements (made with `defineElement()`), described with the built-in ones. */
  elements?: readonly WithDefinition[];
  /** @deprecated Renamed `elements`. Given with it, an element in `elements` wins over one of the same type here. */
  components?: readonly WithDefinition[];
}

export interface ConditionDescription {
  /** "mobile", "hover": the block of `style` it's written in. */
  name: ConditionName;
  /** "on phones", "on hover". */
  on: string;
  /** The roots it may be set under. */
  roots: RootName[];
}

export interface ElementsDescription {
  version: typeof INSPECT_VERSION;
  /** The root it's narrowed to, if one was given. */
  root?: RootName;
  /** The roots a template can have. */
  roots: RootName[];
  /** Each element, with its props and styles: their kinds, groups, defaults and the roots that take them. */
  elements: ElementDescription[];
  /** The style blocks an element may have besides its own style, and the roots that take each. */
  conditions: ConditionDescription[];
}

/** @deprecated Renamed `ElementsDescription`, whose list is `elements`: what `describeComponents()` returns. */
export type ComponentsDescription = Omit<ElementsDescription, "elements"> & { components: ElementDescription[] };

/**
 * The core's options: the definitions of the elements given, and the root. One of a type given in `elements` is
 * taken over one of that type in `components`; two different ones of a type in the same option are refused, as before.
 */
const coreOptions = (options: DescribeOptions) => {
  const elements = (options.elements ?? []).map((element) => element.definition);
  const types = new Set(elements.map((definition) => definition.type));
  const components = (options.components ?? []).map((element) => element.definition).filter((definition) => !types.has(definition.type));
  return { components: [...elements, ...components], ...(options.root ? { root: options.root } : {}) };
};

/**
 * Every element a template can use (the built-in ones and those given), each with its props and styles: what
 * each takes, its group, its default, and the roots that take it. With `root`, only what that root takes.
 */
export function describeElements(options: DescribeOptions = {}): ElementsDescription {
  const conditions = describeConditions(coreOptions(options));
  return {
    version: INSPECT_VERSION,
    ...(options.root ? { root: options.root } : {}),
    roots: options.root ? [options.root] : [...ROOT_NAMES],
    elements: describeAll(coreOptions(options)),
    conditions: options.root ? conditions.filter((condition) => condition.roots.includes(options.root!)).map((condition) => ({ ...condition, roots: [options.root!] })) : conditions,
  };
}

/** One element, as `describeElements()` describes it; undefined where there's no such element, or `root` doesn't take it. */
export function describeElement(type: string, options: DescribeOptions = {}): (ElementDescription & { version: typeof INSPECT_VERSION }) | undefined {
  const described = describeOne(type, coreOptions(options));
  return described && { version: INSPECT_VERSION, ...described };
}

/** @deprecated Renamed `describeElements()`, which gives the list as `elements`: this gives it as `components`, as before. */
export function describeComponents(options: DescribeOptions = {}): ComponentsDescription {
  // The list renamed in its place, so its keys come in the order they did.
  return Object.fromEntries(Object.entries(describeElements(options)).map(([key, value]) => [key === "elements" ? "components" : key, value])) as unknown as ComponentsDescription;
}

/** @deprecated Renamed `describeElement()`: the same function. */
export const describeComponent = describeElement;

export interface InspectedNode {
  /** Where it is, as diagnostics say it: "root", "root.children[2]". */
  path: string;
  type: string;
  id?: string;
  /** The roots its element may go in. */
  roots: RootName[];
  /** Whether the template's root takes it. */
  allowed: boolean;
  /** What it's given, as written: "props.href", "style.padding", "mobile.fontSize", "hover.color", "hidden.mobile". */
  given: string[];
  /** The problems found on it (its props, styles and blocks, and what it renders), not on its children. */
  problems: Diagnostic[];
}

/** A template's theme, as `inspect()` lists it: what an agent can refer to. */
export interface ThemeDescription {
  /** Each token, its group, and its value at the root (null where it doesn't resolve). */
  tokens: Array<{ path: string; group: string; value: Json | null }>;
  /** The roles it defines: the tokens built-in elements read ("colors.primary" for a Button). */
  roles: string[];
  /** Its named styles' names, for `style={{ apply: [...] }}`. */
  styles: string[];
  /** Each element it gives defaults: its variants' names, and the prop its `by` styles go by. */
  elements: Array<{ type: string; variants: string[]; by?: string }>;
  /** @deprecated Renamed `elements`: the same list, kept for readers of this version. */
  components: Array<{ type: string; variants: string[]; by?: string }>;
}

export interface Inspection {
  version: typeof INSPECT_VERSION;
  /** The template's theme (with its root's `formats`), or null where it has none. */
  theme: ThemeDescription | null;
  /** The template's root, or null where it has none Elements knows. */
  root: RootName | null;
  /** No errors (there may be warnings and notes), as `validate()` says. */
  valid: boolean;
  /**
   * Each element in the template, in document order, as written: one its root doesn't take is here too, with
   * `allowed: false` and its error in `problems`. Each `path` is the one diagnostics give.
   */
  nodes: InspectedNode[];
  /** Everything found, as `validate()` finds it. */
  diagnostics: Diagnostic[];
}

/**
 * What a template holds, as data: each element, what it's given, whether its root takes it, and the problems
 * found on it. It checks what `validate()` checks, without rendering.
 */
export function inspect(element: React.ReactElement): Inspection {
  if (!React.isValidElement(element)) {
    throw new TypeError(`[Elements] inspect() takes a template as JSX (<Email>…</Email>, <Page>…</Page>), not ${element === null ? "null" : typeof element}`);
  }
  const { document, diagnostics: read, components, collected } = collectTemplate(element);
  const failed = read.some((d) => d.severity === "error");
  const diagnostics = [...read, ...(document && !failed ? validateTemplate(document, { components }).diagnostics : [])];
  const registry = new Registry(components);
  const rootType = document?.root.type;
  const root = rootType && (ROOT_NAMES as readonly string[]).includes(rootType) ? (rootType as RootName) : null;
  const nodes: InspectedNode[] = [];
  const visit = (node: JsonNode, path: string) => {
    const definition = registry.get(node.type);
    const roots = definition ? componentRoots(definition, registry) : [];
    nodes.push({
      path,
      type: node.type,
      ...(typeof node.id === "string" && node.id ? { id: node.id } : {}),
      roots,
      allowed: !!root && roots.includes(root),
      given: given(node),
      problems: diagnostics.filter((diagnostic) => on(diagnostic.path, path)),
    });
    (Array.isArray(node.children) ? node.children : []).forEach((child, index) => {
      if (child && typeof child === "object") visit(child, `${path}.children[${index}]`);
    });
  };
  // The tree as collected, not as read: reading leaves out an element its root doesn't take (and merges text), and
  // what's listed here is every element written, at the paths diagnostics name.
  if (document && collected) visit(collected, "root");
  return { version: INSPECT_VERSION, root, theme: describeTheme(document?.theme, registry), valid: !diagnostics.some((d) => d.severity === "error"), nodes, diagnostics };
}

/** A theme, as `inspect()` lists it. */
function describeTheme(theme: { [key: string]: Json } | undefined, registry: Registry): ThemeDescription | null {
  if (!theme) return null;
  const environment = ThemeEnvironment.of(theme, "root.theme");
  const tokens = environment.paths().map((path) => {
    const resolved = environment.resolve(path);
    return { path, group: path.split(".")[0], value: resolved.ok ? resolved.value : null };
  });
  const roles = [...new Set(registry.all().flatMap((definition) => Object.values(definition.roles ?? {})))].filter((path) => environment.has(path));
  const isObject = (value: unknown): value is Record<string, Json> => typeof value === "object" && value !== null && !Array.isArray(value);
  // A read theme gives each element under one of its two names: `elements`, or `components`, its name before.
  const defaults = { ...(isObject(theme.components) ? theme.components : {}), ...(isObject(theme.elements) ? theme.elements : {}) };
  const elements = Object.entries(defaults).map(([type, given]) => {
    const own = isObject(given) ? given : {};
    const by = isObject(own.by) ? Object.keys(own.by)[0] : undefined;
    return { type, variants: isObject(own.variants) ? Object.keys(own.variants) : [], ...(by ? { by } : {}) };
  });
  return { tokens, roles, styles: isObject(theme.styles) ? Object.keys(theme.styles) : [], elements, components: elements };
}

/**
 * The keys a node was given, by where they're written. A condition's block written in `style` (`style={{ mobile: { … } }}`)
 * is the condition's, as reading takes it; a template's own element takes no condition, so in its style it's a style.
 */
function given(node: JsonNode): string[] {
  const keys = (prefix: string, values: unknown) => (values && typeof values === "object" && !Array.isArray(values) ? Object.keys(values).map((key) => `${prefix}.${key}`) : []);
  const style = node.style && typeof node.style === "object" && !Array.isArray(node.style) ? (node.style as Record<string, unknown>) : {};
  const lifts = !CUSTOM_TYPE.test(node.type);
  const own = Object.keys(style).filter((key) => !(lifts && CONDITION_NAMES.has(key)));
  const condition = (name: string) => [...keys(name, node[name]), ...(lifts ? keys(name, style[name]) : [])];
  const themed = ["variant", "tokens", "theme"].filter((key) => node[key] !== undefined);
  return [...keys("props", node.props), ...themed, ...own.map((key) => `style.${key}`), ...condition("mobile"), ...condition("hover"), ...keys("hidden", node.hidden)];
}

/** Whether a diagnostic's path is on a node itself (or what it renders), not on one of its children. */
function on(diagnostic: string, node: string): boolean {
  if (diagnostic === node) return true;
  if (!diagnostic.startsWith(node)) return false;
  const rest = diagnostic.slice(node.length);
  return (rest.startsWith(".") || rest.startsWith("(")) && !rest.startsWith(".children[");
}
