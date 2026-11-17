/**
 * Which components a document may use: the built-in ones, and the custom
 * components a caller passes. A custom component is a definition like the
 * built-in ones, plus `expand`: what it is, as primitives.
 */
import { COMPONENTS } from "./components";
import { TARGETS, type ComponentDefinition, type PropSpec, type PropSpecs, type Target, type TargetSupport } from "./define";
import { deepFrozen, type OutputOf } from "./kinds";
import type { Diagnostic } from "./diagnostics";
import type { Json } from "./model";
import { placementStyle } from "./styles";

/** A namespace, a dot, a capitalized name: "acme.ProductCard". Built-in types never look like this. */
export const CUSTOM_TYPE = /^[a-z][a-z0-9-]*\.[A-Z][A-Za-z0-9]*$/;

/** Props that always have a value: required ones, and ones with a default (see `prop`). */
type RequiredOrDefaulted<P extends PropSpecs> = {
  [K in keyof P]: Exclude<P[K]["required"], undefined> extends true ? K : [P[K]["default"]] extends [undefined] ? never : K;
}[keyof P];

/** The props `expand` (or a `render`) gets: normalized, with defaults applied. */
export type ExpandProps<P extends PropSpecs> = { [K in RequiredOrDefaulted<P>]: OutputOf<P[K]["kind"]> } & {
  [K in Exclude<keyof P, RequiredOrDefaulted<P>>]?: OutputOf<P[K]["kind"]>;
};

/** What `expand` may do besides returning its node, and what it may read besides its props. */
export interface ExpandContext {
  /** Makes custom components the expansion uses known (ones not passed in the components option). */
  register(definition: CustomDefinition<any>): void;
  /** The node's style, with its definition's defaults: a built-in made of primitives (Social, Menu) styles them by it. */
  style: Record<string, Json>;
  /** Whether the template has phones (an Email or a Page): what's hidden on phones is only hidden there. */
  responsive: boolean;
  /** A problem found while expanding that doesn't stop it (a warning or a note), said once at the expansion's place. */
  report(diagnostic: Diagnostic): void;
  /** The theme's tokens where the node is (its scopes' over the theme's), resolved: groups of values. */
  theme: Record<string, Json>;
}

export interface CustomDefinition<P extends PropSpecs = PropSpecs> extends ComponentDefinition<P, typeof placementStyle> {
  custom: true;
  /**
   * The component as primitives: one node of the template tree
   * (`{ type, props, style, children }`). Pure: the same props give the same node.
   */
  expand(props: ExpandProps<P>, context: ExpandContext): unknown;
}

export interface CustomComponentSpec<P extends PropSpecs> {
  type: string;
  label: string;
  description?: string;
  props: P;
  /** Where it goes: where a block goes (default), or where a Section goes. */
  placement?: "block" | "section";
  expand(props: ExpandProps<P>, context: ExpandContext): unknown;
}

export function defineCustomComponent<const P extends PropSpecs>(spec: CustomComponentSpec<P>): CustomDefinition<P> {
  if (!CUSTOM_TYPE.test(spec.type)) {
    throw new Error(`[Elements] An element's type is a namespace, a dot and a capitalized name ("acme.ProductCard"), not ${JSON.stringify(spec.type)}`);
  }
  const section = spec.placement === "section";
  const props = ownSpecs(spec.props);
  const paths = Object.keys(props).map((key) => `props.${key}`);
  // Its own copies, frozen: no code that runs after it's made can change its props, defaults or expand.
  return Object.freeze({
    type: spec.type,
    label: spec.label,
    description: spec.description ?? spec.label,
    categories: section ? ["section"] : ["block"],
    props,
    style: section ? ({} as typeof placementStyle) : placementStyle,
    children: {},
    sizing: "stretch",
    // Rendered as the primitives it expands to, which are checked for each target themselves.
    targets: Object.fromEntries(TARGETS.map((target) => [target, {}])) as Record<Target, TargetSupport>,
    editor: paths.length ? { groups: [{ title: spec.label, paths }] } : undefined,
    custom: true,
    expand: spec.expand,
  }) as CustomDefinition<P>;
}

/**
 * Prop specs owned: a new record of shallow, frozen copies of each, their data (a default, a list's `item`, an object's
 * `fields`) copied and frozen too. A spec's `kind` is kept by reference: its parse() is code, and kinds are frozen.
 */
export function ownSpecs<P extends PropSpecs>(specs: P): P {
  const own = (spec: PropSpec): PropSpec => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(spec)) {
      if (key === "kind") out.kind = value;
      else if (key === "item") out.item = own(value as PropSpec);
      else if ((key === "fields" || key === "blocks") && value && typeof value === "object") out[key] = ownSpecs(value as PropSpecs);
      else out[key] = deepFrozen(value);
    }
    return Object.freeze(out) as unknown as PropSpec;
  };
  return Object.freeze(Object.fromEntries(Object.entries(specs).map(([name, spec]) => [name, own(spec)]))) as P;
}

export function isCustom(definition: ComponentDefinition): definition is CustomDefinition {
  return (definition as Partial<CustomDefinition>).custom === true;
}

export class Registry {
  private readonly custom = new Map<string, CustomDefinition>();

  constructor(components: readonly CustomDefinition<any>[] = []) {
    for (const definition of components) this.add(definition);
  }

  add(definition: CustomDefinition<any>): void {
    if (!isCustom(definition) || !CUSTOM_TYPE.test(definition.type)) {
      throw new Error(`[Elements] ${JSON.stringify((definition as { type?: unknown })?.type)} isn't a custom element (make one with defineElement())`);
    }
    const known = this.custom.get(definition.type);
    if (known && known !== definition) throw new Error(`[Elements] Two elements made with defineElement() are named ${definition.type}`);
    this.custom.set(definition.type, definition as CustomDefinition);
  }

  get(type: string): ComponentDefinition | undefined {
    if (Object.prototype.hasOwnProperty.call(COMPONENTS, type)) return COMPONENTS[type];
    return this.custom.get(type);
  }

  get customs(): CustomDefinition[] {
    return [...this.custom.values()];
  }

  all(): ComponentDefinition[] {
    return [...Object.values(COMPONENTS), ...this.custom.values()];
  }
}

/** The props of a node with its definition's defaults where it has none. */
export function propsWithDefaults(definition: ComponentDefinition, props: Record<string, Json> | undefined): Record<string, Json> {
  const out: Record<string, Json> = {};
  for (const [key, spec] of Object.entries(definition.props)) if (spec.default !== undefined) out[key] = spec.default as Json;
  return { ...out, ...props };
}

export interface ComponentsOption {
  /** Custom elements (made with `defineElement()`) the document may use. */
  components?: readonly CustomDefinition<any>[];
}

export function registryOf(options: ComponentsOption | Registry | undefined): Registry {
  return options instanceof Registry ? options : new Registry(options?.components);
}
