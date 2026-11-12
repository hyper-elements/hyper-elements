/**
 * Property discovery: what a component takes and how each thing is edited, as
 * plain data for editors, docs and agents. Each component, prop and style says
 * which roots take it, read from the definitions (the same ones validation reads).
 */
import { CONDITIONS, type ConditionName } from "./conditions";
import { registryOf, type ComponentsOption, type Registry } from "./registry";
import { styleGroup } from "./styles";
import { ROOT_NAMES, type Category, type ComponentDefinition, type RootName, type StyleGroup, type Support, type SupportByTarget, type Target } from "./define";
import type { EditorKind, JsonSchema } from "./kinds";
import type { Json } from "./model";

export interface PropertyDescription {
  /** "props.href", "style.padding", "hover.color". */
  path: string;
  label: string;
  description?: string;
  kind: string;
  accepts: string;
  editor: EditorKind;
  /** The editor its prop names (`editor: "counter"`), for an app that has one of that name; another shows `editor`. */
  namedEditor?: string;
  editable: boolean;
  required: boolean;
  default?: Json;
  inherited: boolean;
  mobile: boolean;
  /** The roots it may be given under: those of its component's that it's declared for. */
  roots: RootName[];
  /** A style's group ("Typography", "Spacing", …); props have none. */
  group?: StyleGroup;
  schema: JsonSchema;
}

export interface ComponentDescription {
  type: string;
  label: string;
  description: string;
  categories: readonly Category[];
  properties: PropertyDescription[];
  children: { text: boolean; categories: readonly Category[]; types: readonly string[] };
  targets: Target[];
  /** The roots it may go in: those whose output it renders to, whose children reach it, and that it's declared for. */
  roots: RootName[];
  /** Editor groups: the paths each shows, or the composite editor and the paths it covers. */
  groups: Array<{ title: string; paths: readonly string[]; composite?: string }>;
}

export interface DescribeOptions extends ComponentsOption {
  /**
   * Only what this root takes: the components it can hold, and of each the props and styles it can be given there,
   * with phone styles only under a root that has phones.
   */
  root?: RootName;
}

export function describeComponent(type: string, options?: DescribeOptions): ComponentDescription | undefined {
  const registry = registryOf(options);
  const definition = registry.get(type);
  if (!definition) return undefined;
  const described = describe(definition, registry, reachable(registry));
  return options?.root ? forRoot(described, options.root, registry) : described;
}

/** Every built-in component a template can use, and the custom ones given; with `root`, those that root takes. */
export function describeComponents(options?: DescribeOptions): ComponentDescription[] {
  const registry = registryOf(options);
  const reach = reachable(registry);
  const all = registry.all().map((definition) => describe(definition, registry, reach));
  const root = options?.root;
  if (!root) return all;
  return all.flatMap((description) => forRoot(description, root, registry) ?? []);
}

/** Each condition (phones, hover) and the roots it may be set under. */
export function describeConditions(options?: ComponentsOption): Array<{ name: ConditionName; on: string; roots: RootName[] }> {
  const registry = registryOf(options);
  return CONDITIONS.map((condition) => ({
    name: condition.name,
    on: condition.on,
    roots: rootDefinitions(registry)
      .filter((root) => !condition.roots || condition.roots(root))
      .map((root) => root.type as RootName),
  }));
}

/** A description narrowed to one root, or undefined where that root doesn't take the component. */
function forRoot(description: ComponentDescription, root: RootName, registry: Registry): ComponentDescription | undefined {
  if (!description.roots.includes(root)) return undefined;
  const responsive = !!registry.get(root)?.responsive;
  return {
    ...description,
    roots: [root],
    properties: description.properties
      .filter((property) => property.roots.includes(root))
      .map((property) => ({ ...property, roots: [root], mobile: property.mobile && responsive })),
  };
}

/** The built-in roots, in ROOT_NAMES' order. */
function rootDefinitions(registry: Registry): ComponentDefinition[] {
  return ROOT_NAMES.flatMap((name) => registry.get(name) ?? []);
}

/** Whether a parent's children rules take a child (as validation reads them). */
function holds(parent: ComponentDefinition, child: ComponentDefinition): boolean {
  return !!parent.children.types?.includes(child.type) || child.categories.some((category) => parent.children.categories?.includes(category));
}

/** The types each root's children rules reach, at any depth (a Text's Span in a Column in a Page). */
function reachable(registry: Registry): Map<string, Set<string>> {
  const all = registry.all();
  const out = new Map<string, Set<string>>();
  for (const root of rootDefinitions(registry)) {
    const seen = new Set<string>([root.type]);
    const queue = [root];
    while (queue.length) {
      const parent = queue.shift()!;
      for (const child of all) {
        if (seen.has(child.type) || child.categories.includes("root") || !holds(parent, child)) continue;
        seen.add(child.type);
        queue.push(child);
      }
    }
    out.set(root.type, seen);
  }
  return out;
}

/** The roots a component may go in (see ComponentDescription.roots). */
export function componentRoots(definition: ComponentDefinition, options?: ComponentsOption | Registry, reach = reachable(registryOf(options))): RootName[] {
  const registry = registryOf(options);
  return rootDefinitions(registry)
    .filter((root) => reach.get(root.type)?.has(definition.type))
    .filter((root) => Object.keys(definition.targets).some((target) => target in root.targets))
    .filter((root) => !definition.roots || definition.roots.includes(root.type as RootName))
    .map((root) => root.type as RootName);
}

function describe(definition: ComponentDefinition, registry: Registry, reach: Map<string, Set<string>>): ComponentDescription {
  const roots = componentRoots(definition, registry, reach);
  const within = (declared: readonly RootName[] | undefined) => (declared ? roots.filter((root) => declared.includes(root)) : roots);
  const properties: PropertyDescription[] = [];
  for (const [key, spec] of Object.entries(definition.props)) {
    properties.push({
      path: `props.${key}`,
      label: spec.label,
      ...(spec.description ? { description: spec.description } : {}),
      kind: spec.kind.name,
      accepts: spec.kind.accepts,
      editor: spec.kind.editor,
      ...(spec.editor ? { namedEditor: spec.editor } : {}),
      editable: spec.editable !== false,
      required: !!spec.required,
      ...(spec.default !== undefined ? { default: spec.default } : {}),
      inherited: false,
      mobile: false,
      roots: within(spec.roots),
      schema: spec.kind.jsonSchema(),
    });
  }
  const defaults = (definition.defaultStyle ?? {}) as Record<string, Json>;
  const hover = new Set<string>(definition.hover ?? []);
  // A phone style no output it renders to shows, whatever its value (a Page root's phone font size): not listed as one.
  const targets = Object.keys(definition.targets) as Target[];
  const unshownOnPhones = (key: string) => {
    const declared = (definition.conditionSupport?.mobile as Record<string, SupportByTarget> | undefined)?.[key];
    return !!declared && targets.every((target) => ([] as Support[]).concat(declared[target] ?? []).some((rule) => rule.level === "none" && !rule.values && !rule.when));
  };
  for (const [key, spec] of Object.entries(definition.style)) {
    const group = styleGroup(key, spec);
    const base = {
      label: spec.label,
      ...(spec.description ? { description: spec.description } : {}),
      kind: spec.kind.name,
      accepts: spec.kind.accepts,
      editor: spec.kind.editor,
      editable: spec.editable !== false,
      required: false,
      inherited: !!spec.inherited,
      mobile: !!spec.mobile && !unshownOnPhones(key),
      roots: within(spec.roots),
      ...(group ? { group } : {}),
      schema: spec.kind.jsonSchema(),
    };
    properties.push({ path: `style.${key}`, ...base, ...(defaults[key] !== undefined ? { default: defaults[key] } : {}) });
    if (hover.has(key)) properties.push({ path: `hover.${key}`, ...base, label: `${spec.label} on hover`, mobile: false });
  }
  return {
    type: definition.type,
    label: definition.label,
    description: definition.description,
    categories: definition.categories,
    properties,
    children: { text: !!definition.children.text, categories: definition.children.categories ?? [], types: definition.children.types ?? [] },
    targets: Object.keys(definition.targets) as Target[],
    roots,
    groups: (definition.editor?.groups ?? []).map((group) =>
      "composite" in group ? { title: group.title, paths: group.composite.covers, composite: group.composite.editor } : { title: group.title, paths: group.paths }
    ),
  };
}
