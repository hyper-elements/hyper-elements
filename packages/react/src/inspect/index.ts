/**
 * `@hyper-elements/react/inspect`: what each root takes, and what a template holds, as data, without rendering
 * anything. For an agent's tool call or an editor: "can I use this here?" before writing, and "is each part of this
 * template allowed in its root?" after. Read from the components' definitions, the same ones validation and the
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
  validateTemplate,
  CONDITION_NAMES,
  CUSTOM_TYPE,
  ROOT_NAMES,
  type ComponentDescription,
  type ConditionName,
  type CustomDefinition,
  type Diagnostic,
  type PropertyDescription,
  type RootName,
  type StyleGroup,
} from "@unlayer-internal/elements-core";
import { collectTemplate, type JsonNode } from "../primitives/collect";

export type { ComponentDescription, ConditionName, Diagnostic, PropertyDescription, RootName, StyleGroup };

/** The shape of what this entry returns: a new version is a new shape. */
export const INSPECT_VERSION = 1;

/** A template's own component (made with `component()`), described alongside the built-in ones. */
interface WithDefinition {
  definition: CustomDefinition<any>;
}

export interface DescribeOptions {
  /** Only what this root takes, with phone styles only under a root that has phones. */
  root?: RootName;
  /** A template's own components (made with `component()`), described with the built-in ones. */
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

export interface ComponentsDescription {
  version: typeof INSPECT_VERSION;
  /** The root it's narrowed to, if one was given. */
  root?: RootName;
  /** The roots a template can have. */
  roots: RootName[];
  /** Each component, with its props and styles: their kinds, groups, defaults and the roots that take them. */
  components: ComponentDescription[];
  /** The style blocks a component may have besides its own style, and the roots that take each. */
  conditions: ConditionDescription[];
}

/** The core's options: the definitions of the components given, and the root. */
const coreOptions = (options: DescribeOptions) => ({ components: (options.components ?? []).map((component) => component.definition), ...(options.root ? { root: options.root } : {}) });

/**
 * Every component a template can use (the built-in ones and those given), each with its props and styles: what
 * each takes, its group, its default, and the roots that take it. With `root`, only what that root takes.
 */
export function describeComponents(options: DescribeOptions = {}): ComponentsDescription {
  const conditions = describeConditions(coreOptions(options));
  return {
    version: INSPECT_VERSION,
    ...(options.root ? { root: options.root } : {}),
    roots: options.root ? [options.root] : [...ROOT_NAMES],
    components: describeAll(coreOptions(options)),
    conditions: options.root ? conditions.filter((condition) => condition.roots.includes(options.root!)).map((condition) => ({ ...condition, roots: [options.root!] })) : conditions,
  };
}

/** One component, as `describeComponents()` describes it; undefined where there's no such component, or `root` doesn't take it. */
export function describeComponent(type: string, options: DescribeOptions = {}): (ComponentDescription & { version: typeof INSPECT_VERSION }) | undefined {
  const described = describeOne(type, coreOptions(options));
  return described && { version: INSPECT_VERSION, ...described };
}

export interface InspectedNode {
  /** Where it is, as diagnostics say it: "root", "root.children[2]". */
  path: string;
  type: string;
  id?: string;
  /** The roots its component may go in. */
  roots: RootName[];
  /** Whether the template's root takes it. */
  allowed: boolean;
  /** What it's given, as written: "props.href", "style.padding", "mobile.fontSize", "hover.color", "hidden.mobile". */
  given: string[];
  /** The problems found on it (its props, styles and blocks, and what it renders), not on its children. */
  problems: Diagnostic[];
}

export interface Inspection {
  version: typeof INSPECT_VERSION;
  /** The template's root, or null where it has none Elements knows. */
  root: RootName | null;
  /** No errors (there may be warnings and notes), as `validate()` says. */
  valid: boolean;
  /**
   * Each component in the template, in document order, as written: one its root doesn't take is here too, with
   * `allowed: false` and its error in `problems`. Each `path` is the one diagnostics give.
   */
  nodes: InspectedNode[];
  /** Everything found, as `validate()` finds it. */
  diagnostics: Diagnostic[];
}

/**
 * What a template holds, as data: each component, what it's given, whether its root takes it, and the problems
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
  // The tree as collected, not as read: reading leaves out a component its root doesn't take (and merges text), and
  // what's listed here is every component written, at the paths diagnostics name.
  if (document && collected) visit(collected, "root");
  return { version: INSPECT_VERSION, root, valid: !diagnostics.some((d) => d.severity === "error"), nodes, diagnostics };
}

/**
 * The keys a node was given, by where they're written. A condition's block written in `style` (`style={{ mobile: { … } }}`)
 * is the condition's, as reading takes it; a template's own component takes no condition, so in its style it's a style.
 */
function given(node: JsonNode): string[] {
  const keys = (prefix: string, values: unknown) => (values && typeof values === "object" && !Array.isArray(values) ? Object.keys(values).map((key) => `${prefix}.${key}`) : []);
  const style = node.style && typeof node.style === "object" && !Array.isArray(node.style) ? (node.style as Record<string, unknown>) : {};
  const lifts = !CUSTOM_TYPE.test(node.type);
  const own = Object.keys(style).filter((key) => !(lifts && CONDITION_NAMES.has(key)));
  const condition = (name: string) => [...keys(name, node[name]), ...(lifts ? keys(name, style[name]) : [])];
  return [...keys("props", node.props), ...own.map((key) => `style.${key}`), ...condition("mobile"), ...condition("hover"), ...keys("hidden", node.hidden)];
}

/** Whether a diagnostic's path is on a node itself (or what it renders), not on one of its children. */
function on(diagnostic: string, node: string): boolean {
  if (diagnostic === node) return true;
  if (!diagnostic.startsWith(node)) return false;
  const rest = diagnostic.slice(node.length);
  return (rest.startsWith(".") || rest.startsWith("(")) && !rest.startsWith(".children[");
}
