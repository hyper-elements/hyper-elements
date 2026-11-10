/**
 * Reading the tree a template's JSX was collected into: validated against the
 * component definitions and normalized (values in their canonical form, ids
 * checked).
 */
import { CONDITION_NAMES, CONDITIONS, shownAnywhere } from "./conditions";
import type { ComponentDefinition, RootName, StyleSpecs } from "./define";
import { Diagnostics, ElementsError, type Diagnostic } from "./diagnostics";
import { type Child, type ElementsDocument, type Json, type Node } from "./model";
import { CUSTOM_TYPE, propsWithDefaults, registryOf, type ComponentsOption, type Registry } from "./registry";
import { a, nearest } from "./nearest";
import { COMPONENTS } from "./components";
import { aliasHint, holdsToken, readScope, readTheme, resolveValue, scopePaths, themedStyle, themeNames, ThemeEnvironment, type Problem, type ThemeData } from "./theme";

export interface CheckResult {
  /** The document with what could be read, or null when there's no usable root. */
  document: ElementsDocument | null;
  diagnostics: Diagnostic[];
}

const NODE_KEYS = ["id", "type", "props", "style", "mobile", "hover", "hidden", "children", "variant", "tokens", "theme"];
/** The body text styles a box passes down, each with the role a theme sets it with. */
const BODY_ROLES = { color: ["color", "colors.foreground"], fontFamily: ["font", "fonts.body"], fontSize: ["size", "fontSizes.body"], lineHeight: ["line height", "lineHeights.body"] } as const;
type InheritedKey = keyof typeof BODY_ROLES;
const INHERITED = Object.keys(BODY_ROLES) as InheritedKey[];
/** The components that take `tokens`: a scope over what they hold. */
const SCOPES = new Set(["Section", "Row", "Column", "Grid"]);
/** An id is written into HTML ids and CSS selectors. */
const ID = /^[A-Za-z][A-Za-z0-9_-]*$/;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

interface Context {
  d: Diagnostics;
  registry: Registry;
  /**
   * Inside a custom component's expansion (see expand.ts): the instance's id, put before the ids its
   * render writes, or null when the instance has none (those ids are then dropped: a block used many
   * times can't own an id). Undefined outside one.
   */
  idPrefix?: string | null;
  /** Ids taken so far: an id is unique in a template. */
  used: Set<string>;
  /** The template's root: which conditions its nodes may have (phone styles only under one with a phone width). */
  root: ComponentDefinition | undefined;
  /**
   * `authored`: a template as written (collected JSX, or what a custom component renders), whose theme is merged into
   * each node as it's read. `normalized`: a document read already (it has `theme`), which is read as it is.
   */
  mode: "authored" | "normalized";
  /** The tokens this place sees: the theme's, with every enclosing scope's over them. */
  environment?: ThemeEnvironment;
  /** The root's theme, read (authored). */
  theme?: ThemeData;
  /** A theme given at the document's top level of a template (authored): read as its root's. */
  documentTheme?: unknown;
  /** A scope was read (a template with scopes and no theme still gets a document theme, empty). */
  sawScope?: boolean;
  /** The color and font an ancestor sets itself, which a theme's component default could stop reaching its descendants. */
  inherited?: Partial<Record<InheritedKey, { value: Json; at: string }>>;
  /** What `theme/inherited` has said, once each. */
  warned?: Set<string>;
}

/** Validates and normalizes a document; never throws. */
export function checkDocument(input: unknown, options?: ComponentsOption | Registry): CheckResult {
  const registry = registryOf(options);
  const d = new Diagnostics();
  if (!isObject(input)) {
    d.error("document/invalid", "A document is an object: { root: { type: \"Email\", … } }", "");
    return { document: null, diagnostics: d.list };
  }
  const extra = Object.keys(input).filter((key) => key !== "root" && key !== "theme" && key !== "merged");
  for (const key of extra) d.error("document/unknown-key", `"${key}" isn't part of a document (root)`, key);
  if (input.merged !== undefined && input.merged !== true) d.error("document/unknown-key", `merged is true, on a document read already (its theme merged into its nodes), not ${JSON.stringify(input.merged)}`, "merged");

  const rootDefinition = isObject(input.root) && typeof input.root.type === "string" ? registry.get(input.root.type) : undefined;
  // A document read already keeps its theme, with `merged`: what a custom component renders is read against it when
  // it's expanded. A theme at a template's top level without it is read as its root's.
  const merged = input.merged === true && input.theme !== undefined;
  const context: Context = { d, registry, used: new Set(), root: rootDefinition, mode: merged ? "normalized" : "authored", documentTheme: merged ? undefined : input.theme };
  let theme: ThemeData | undefined;
  if (merged) {
    theme = readTheme(input.theme, "theme", rootDefinition?.type ?? "", themeContext(d, registry)) ?? undefined;
    if (theme) context.environment = ThemeEnvironment.of(theme, "theme");
  }
  const root = input.root === undefined ? null : readNode(input.root, "root", null, context);
  if (input.root === undefined) d.error("document/root", 'A document has a root: { type: "Email" }, "Page", …', "root");
  if (context.mode === "authored") theme = context.theme ?? (context.sawScope ? {} : undefined);
  return { document: root ? (theme !== undefined ? { root, theme, merged: true } : { root }) : null, diagnostics: once(d.list) };
}

/** Each diagnostic once: a theme's problem is found at every node that uses it. */
function once(list: Diagnostic[]): Diagnostic[] {
  const seen = new Set<string>();
  return list.filter((diagnostic) => {
    const key = `${diagnostic.code}\n${diagnostic.path}\n${diagnostic.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function themeContext(d: Diagnostics, registry: Registry) {
  return { d, definition: (type: string) => (Object.prototype.hasOwnProperty.call(COMPONENTS, type) ? registry.get(type) : undefined), types: () => Object.keys(COMPONENTS) };
}

/** Validates and normalizes a document, throwing an `ElementsError` if it has errors. */
export function parseDocument(input: unknown, options?: ComponentsOption | Registry): ElementsDocument {
  const { document, diagnostics } = checkDocument(input, options);
  if (!document || diagnostics.some((x) => x.severity === "error")) throw new ElementsError(diagnostics);
  return document;
}

/**
 * One node read as the child of `parent` would be: what a custom component
 * expands to. Ids its render writes go after the instance's id (`idPrefix`),
 * and mustn't take one of `taken`.
 */
export function checkFragment(
  input: unknown,
  options: {
    parent: ComponentDefinition;
    root: ComponentDefinition | undefined;
    idPrefix: string | null;
    taken: ReadonlySet<string>;
    registry: Registry;
    path: string;
    /** The tokens the instance sees (its theme with its enclosing scopes'), which what it renders is read against. */
    environment?: ThemeEnvironment;
  }
): { node: Node | null; diagnostics: Diagnostic[] } {
  const d = new Diagnostics();
  const context: Context = { d, registry: options.registry, idPrefix: options.idPrefix, used: new Set(options.taken), root: options.root, mode: "authored", environment: options.environment };
  const node = readNode(input, options.path, options.parent, context);
  return { node, diagnostics: once(d.list) };
}

/** "an Email or a Page", "a Document": the roots something is for, in a message. */
export function rootList(roots: readonly string[]): string {
  const named = roots.map((root) => a(root).replace(/^A/, "a"));
  return named.length > 1 ? `${named.slice(0, -1).join(", ")} or ${named[named.length - 1]}` : named[0] ?? "no root";
}

/**
 * Whether a root takes what's declared for `roots` (a component's, a prop's, a style's): undefined is every root, and
 * so is a root Elements doesn't know (its own error says so).
 */
function rootTakes(roots: readonly RootName[] | undefined, root: ComponentDefinition | undefined): boolean {
  return !roots || !root || roots.includes(root.type as RootName);
}

/** Whether a component and a root share an output: where they don't, it's the output's `target/unsupported`, as today. */
function sharesOutput(definition: ComponentDefinition, root: ComponentDefinition): boolean {
  return Object.keys(definition.targets).some((target) => target in root.targets);
}

function allowedIn(parent: ComponentDefinition, child: ComponentDefinition): boolean {
  const rule = parent.children;
  return !!rule.types?.includes(child.type) || child.categories.some((category) => rule.categories?.includes(category));
}

/** Where each component's props and styles are listed: the guide the package ships. */
const GUIDE = "@hyper-elements/react/GUIDE.md";
/** A message, then where to look the component up. */
const seeing = (message: string, type: string) => `${message}${/[?.]$/.test(message) ? "" : "."} See ${type} in ${GUIDE}`;

/** What's wrong with a prop the component doesn't have, and what to write instead. */
/** Breakpoint names other libraries use (Tailwind's, Chakra's, Bootstrap's), which Elements doesn't have. */
const OTHER_BREAKPOINTS = new Set(["base", "initial", "xs", "sm", "md", "lg", "xl", "2xl", "tablet", "desktop", "wide", "small", "medium", "large"]);

/**
 * Where a key that names a condition goes, written the way another library writes it (`_hover`, `":hover"`,
 * `hoverStyle`, `$sm`, `md`, `@media …`) or as a prop (`mobile={…}`): what an agent or a person coming from Chakra,
 * Tailwind, Stitches or Tamagui tries first. Undefined: it isn't one.
 */
function conditionHint(definition: ComponentDefinition, key: string): string | undefined {
  const name = key
    .trim()
    .replace(/^(&?:+|_+|\$|@)/, "")
    .replace(/Style$/, "")
    .toLowerCase();
  const own = CUSTOM_TYPE.test(definition.type);
  const hoverStyles = definition.hover ?? [];
  const toHover = own
    ? `a template's own component takes only its place in a Row in its style: set hover styles in what it renders`
    : hoverStyles.length
      ? `hover styles go in its style's hover block, style={{ hover: { … } }} (it takes ${hoverStyles.join(", ")})`
      : `${a(definition.type).replace(/^A/, "a")} takes no hover styles (a Button's and a Link's colors do)`;
  const toPhone = own
    ? `a template's own component takes only its place in a Row in its style: set phone styles in what it renders`
    : `phone styles go in its style's mobile block, style={{ mobile: { … } }}`;
  if (name === "hover") return toHover;
  if (name === "mobile" || name === "phone" || name === "phones" || key.trim().startsWith("@media")) return toPhone;
  if (name === "focus" || name === "focus-visible" || name === "focusvisible" || name === "focus-within") {
    return hoverStyles.length && !own ? `keyboard focus gets its hover styles: set them in style={{ hover: { … } }}` : `there are no focus styles; keyboard focus gets a Button's and a Link's hover styles`;
  }
  if (OTHER_BREAKPOINTS.has(name)) {
    return `Elements has one breakpoint, phones: desktop styles go in style itself, phone styles in its mobile block, style={{ mobile: { … } }} (a Page sets where phones start with breakpoints={{ mobile }})`;
  }
  if (name === "active" || name === "pressed" || name === "press" || name === "visited" || name === "dark" || name === "light" || name === "print") {
    return `there are no ${name} styles: Elements has phone styles (mobile) and hover styles (hover) in style`;
  }
  return undefined;
}

/** Props other libraries style a component with. */
const STYLING_PROPS = new Set(["className", "class", "sx", "variants", "css"]);

function unknownProp(definition: ComponentDefinition, key: string, environment?: ThemeEnvironment): string {
  if (STYLING_PROPS.has(key) && !CUSTOM_TYPE.test(definition.type) && !definition.categories.includes("root")) {
    const { variants, styles } = themeNames(environment?.theme, definition.type);
    const theme = environment?.theme
      ? `${variants.length ? `its variants: ${variants.join(", ")}` : `the theme gives a ${definition.type} no variants`}; ${styles.length ? `the theme's named styles: ${styles.join(", ")}` : "the theme has no named styles"}`
      : "the template has no theme";
    return `${a(definition.type)} has no prop "${key}": a theme styles it with variant="…" or style={{ apply: ["…"] }} (${theme})`;
  }
  const condition = conditionHint(definition, key);
  if (condition) return `${a(definition.type)} has no prop "${key}": ${condition}`;
  if (Object.prototype.hasOwnProperty.call(definition.style, key)) return `${a(definition.type)} has no prop "${key}": it's a style, style={{ ${key}: … }}`;
  const known = Object.keys(definition.props);
  const meant = nearest(key, known);
  return seeing(`${a(definition.type)} has no prop "${key}"${meant ? `: did you mean "${meant}"?` : known.length ? ` (it has ${known.join(", ")})` : ""}`, definition.type);
}

function placementMessage(parent: ComponentDefinition, child: ComponentDefinition): string {
  if (child.categories.includes("section")) return `A ${child.type} goes directly in an Email or Page, not in a ${parent.type}`;
  if (child.categories.includes("root")) return `A ${child.type} is a root: it can't be inside a ${parent.type}`;
  const takes = [...(parent.children.text ? ["text"] : []), ...(parent.children.categories ?? []).map((c) => `${c} components`), ...(parent.children.types ?? [])];
  return takes.length ? seeing(`A ${parent.type} takes ${takes.join(", ")}; a ${child.type} can't go in it`, parent.type) : `A ${parent.type} has no children`;
}

function readNode(input: unknown, path: string, parent: ComponentDefinition | null, context: Context): Node | null {
  const { d } = context;
  if (!isObject(input)) {
    d.error("node/invalid", `Expected a component ({ "type": … }), not ${JSON.stringify(input) ?? String(input)}`, path);
    return null;
  }
  if (typeof input.type !== "string") {
    d.error("node/type", 'A component has a "type" ("Row", "Heading", …)', `${path}.type`);
    return null;
  }
  const definition = context.registry.get(input.type);
  if (!definition) {
    const custom = CUSTOM_TYPE.test(input.type);
    d.error(
      "node/unknown-type",
      custom ? `"${input.type}" is a custom component this document wasn't given: pass it in the components option` : `"${input.type}" isn't a component Elements knows`,
      `${path}.type`
    );
    return null;
  }
  if (!parent && !definition.categories.includes("root")) {
    d.error("root/invalid", `A document's root is an Email or Page, not a ${definition.type}`, `${path}.type`);
    return null;
  }
  if (parent && !allowedIn(parent, definition)) {
    d.error("children/not-allowed", placementMessage(parent, definition), path);
    return null;
  }
  const root = context.root;
  if (root && !rootTakes(definition.roots, root) && sharesOutput(definition, root)) {
    const { code, message } = definition.notAllowed ?? {
      code: "component/not-supported",
      message: (under: string) => `${a(definition.type)} goes in ${rootList(definition.roots ?? [])}, not in ${a(under).replace(/^A/, "a")}`,
    };
    d.error(code, message(root.type), path);
    return null;
  }

  // Only what the author writes: an id is theirs (an anchor, a reference), never generated.
  let id: string | undefined;
  if (input.id !== undefined) {
    if (typeof input.id !== "string" || !ID.test(input.id)) {
      d.error("id/invalid", `An id starts with a letter and holds letters, digits, "_" and "-", not ${JSON.stringify(input.id)}`, `${path}.id`);
    } else if (context.idPrefix === null) {
      d.add("id/dropped", "info", `The id "${input.id}" is left out: inside a custom component, ids are kept only when the component is given one (a block used many times can't own an id)`, `${path}.id`);
    } else {
      const full = context.idPrefix ? `${context.idPrefix}-${input.id}` : input.id;
      if (context.used.has(full)) d.error("id/duplicate", `The id "${full}" is already used by another component`, `${path}.id`);
      else {
        id = full;
        context.used.add(full);
      }
    }
  }

  for (const key of Object.keys(input)) {
    if (!NODE_KEYS.includes(key)) d.error("node/unknown-key", `"${key}" isn't part of a component (${NODE_KEYS.join(", ")})`, `${path}.${key}`, id);
  }

  const node: Node = id === undefined ? { type: definition.type } : { id, type: definition.type };
  const custom = CUSTOM_TYPE.test(definition.type);
  const isRoot = definition.categories.includes("root");
  const saved = { environment: context.environment, inherited: context.inherited };

  // The template's theme, on its root (or at the document's top level, read as the root's).
  let themeInput = input.theme;
  let themeAt = `${path}.theme`;
  if (!parent && context.documentTheme !== undefined) {
    if (themeInput !== undefined) d.error("theme/schema", "A template has one theme: it's given both at the document's top level and on its root", "theme");
    else [themeInput, themeAt] = [context.documentTheme, "theme"];
  }
  if (themeInput !== undefined) {
    if (parent || context.mode === "normalized") d.error("prop/unknown", `${a(definition.type)} has no prop "theme": a theme goes on the template's root`, `${path}.theme`, id);
    else {
      const theme = readTheme(themeInput, themeAt, definition.type, themeContext(d, context.registry));
      if (theme) {
        context.theme = theme;
        context.environment = ThemeEnvironment.of(theme, themeAt);
      }
    }
  }

  // A scope: tokens over the theme's, for this node and what's in it.
  let scope: Record<string, Json> | undefined;
  if (input.tokens !== undefined) {
    if (!SCOPES.has(definition.type)) {
      d.error("prop/unknown", `${a(definition.type)} has no prop "tokens": a Section, Row, Column or Grid takes tokens, for itself and what's in it`, `${path}.tokens`, id);
    } else {
      scope = readScope(input.tokens, `${path}.tokens`, context.environment, d, id);
      if (scope && Object.keys(scope).length) {
        node.tokens = scope;
        context.environment = (context.environment ?? ThemeEnvironment.empty()).with(scope, `${path}.tokens`);
        context.sawScope = true;
      } else scope = undefined;
    }
  }

  if (input.variant !== undefined && (isRoot || custom || !Object.keys(definition.style).length)) {
    d.error("prop/unknown", `${a(definition.type)} has no prop "variant"${isRoot ? ": a root has no variants (its theme sets its style)" : ""}`, `${path}.variant`, id);
  }

  const props = readProps(input.props, definition, `${path}.props`, id, d, context.root, context);
  if (props) node.props = props;

  // The theme merged into the node's style, as if the author had written it: then read as an authored style is.
  let themedInput = input.style;
  let origins: Map<string, string> | undefined;
  let from: Map<string, string> | undefined;
  if (context.mode === "authored" && !custom && (context.environment || input.variant !== undefined || (isObject(input.style) && ("apply" in input.style || holdsToken(input.style))))) {
    const themed = themedStyle(input.style, isRoot ? undefined : input.variant, {
      d,
      environment: context.environment,
      definition,
      props: propsWithDefaults(definition, node.props),
      roles: isRoot || !SCOPES.has(definition.type) ? "all" : scope ? scopePaths(scope) : new Set<string>(),
      conditionAllowed: (name) => {
        const condition = CONDITIONS.find((c) => c.name === name);
        return !condition?.roots || condition.roots(context.root);
      },
      styleAllowed: (key) => {
        const spec = Object.prototype.hasOwnProperty.call(definition.style, key) ? definition.style[key] : undefined;
        return !spec || rootTakes(spec.roots, context.root);
      },
      path,
      id,
    });
    themedInput = themed.style;
    origins = themed.origins;
    from = themed.from;
  } else if (custom && isObject(input.style) && "apply" in input.style) {
    d.error("style/apply-place", `A template's own component takes no named styles: apply them in what it renders, or give it a prop for them`, `${path}.style.apply`, id);
    const { apply: _, ...rest } = input.style;
    themedInput = rest;
  }

  // A condition's block written inside `style` (`style={{ mobile: { … } }}`) is read as the condition's own; a template's
  // own component (`acme.Card`) takes no condition, so in its style a block is an unknown style, as anything else is.
  const lifted: Partial<Record<string, unknown>> = {};
  let styleInput = themedInput;
  if (isObject(styleInput) && !CUSTOM_TYPE.test(definition.type)) {
    const rest: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(styleInput)) {
      if (CONDITION_NAMES.has(key)) lifted[key] = value;
      else rest[key] = value;
    }
    styleInput = rest;
  }

  const style = readStyles(styleInput, definition, definition.style, `${path}.style`, id, d, "style", () => true, undefined, context.root, origins && { origins, prefix: "" });
  if (style) node.style = style;

  for (const condition of CONDITIONS) {
    const inStyle = lifted[condition.name];
    const given = input[condition.name];
    if (inStyle !== undefined && given !== undefined) {
      d.error(
        "style/twice",
        `${condition.name} is given twice: as ${condition.name}={…} and in style. Give it once, in style: style={{ ${condition.name}: { … } }}`,
        `${path}.style.${condition.name}`,
        id
      );
      continue;
    }
    let value = inStyle ?? given;
    if (value === undefined) continue;
    const at = inStyle !== undefined ? `${path}.style.${condition.name}` : `${path}.${condition.name}`;
    if (condition.roots && !condition.roots(context.root)) {
      if (condition.notAllowed) d.error(condition.notAllowed.code, condition.notAllowed.message, at, id);
      continue;
    }
    // One level deep: a condition inside a condition's block (hover on phones) isn't something Elements writes.
    if (isObject(value) && Object.keys(value).some((key) => CONDITION_NAMES.has(key))) {
      const own: Record<string, unknown> = {};
      for (const [key, inner] of Object.entries(value)) {
        if (CONDITION_NAMES.has(key)) d.error("style/nested", `${key} can't be set inside ${condition.name}: a block holds styles, not another block`, `${at}.${key}`, id);
        else own[key] = inner;
      }
      value = own;
    }
    const read = readStyles(value, definition, definition.style, at, id, d, condition.name, (spec, key) => condition.allows(spec, key, definition), condition.for, context.root, origins && { origins, prefix: `${condition.name}.` });
    if (read) node[condition.name] = read;
  }

  // A theme's default for a component replaces the body text an ancestor sets itself: said once, with the role to use.
  // A Heading's and a Button's size are their own (a type scale, a Button's role), not the body's.
  if (from) {
    for (const key of INHERITED) {
      if ((key === "fontSize" || key === "lineHeight") && (definition.type === "Heading" || definition.type === "Button")) continue;
      const above = context.inherited?.[key];
      const value = node.style?.[key];
      if (value === undefined || from.get(key) !== "default" || !above || JSON.stringify(above.value) === JSON.stringify(value)) continue;
      const said = `${above.at}\n${key}`;
      if (context.warned?.has(said)) continue;
      (context.warned ??= new Set()).add(said);
      d.warning(
        "theme/inherited",
        `The theme's ${definition.type} ${key} replaces the ${key} ${above.at} sets for what it holds: a theme sets body text's ${BODY_ROLES[key][0]} with ${BODY_ROLES[key][1]} (on the root, or in a scope's tokens), which is inherited`,
        `${path}.style.${key}`,
        id
      );
    }
  }
  // What it passes down that it sets itself (or that its scope does).
  for (const key of INHERITED) {
    const value = node.style?.[key];
    const source = from?.get(key) ?? "own";
    if (value !== undefined && source !== "default" && (source !== "role" || scope)) context.inherited = { ...context.inherited, [key]: { value, at: path } };
  }

  if (input.hidden !== undefined) {
    const hidden = readHidden(input.hidden, `${path}.hidden`, id, context);
    if (hidden) node.hidden = hidden;
  }

  const children = readChildren(input.children, definition, `${path}.children`, id, context);
  if (children.length) node.children = children;
  context.environment = saved.environment;
  context.inherited = saved.inherited;
  return node;
}

function readProps(input: unknown, definition: ComponentDefinition, path: string, id: string | undefined, d: Diagnostics, root: ComponentDefinition | undefined, context?: Context): Record<string, Json> | undefined {
  const out: Record<string, Json> = {};
  if (input !== undefined && !isObject(input)) {
    d.error("props/invalid", "props is an object", path, id);
    input = undefined;
  }
  for (const [key, value] of Object.entries((input as Record<string, unknown> | undefined) ?? {})) {
    if (value === undefined) continue;
    const spec = Object.prototype.hasOwnProperty.call(definition.props, key) ? definition.props[key] : undefined;
    if (!spec) {
      d.error("prop/unknown", unknownProp(definition, key, context?.environment), `${path}.${key}`, id);
      continue;
    }
    if (!rootTakes(spec.roots, root)) {
      d.error("prop/not-supported", `${a(definition.type)}'s "${key}" is for ${rootList(spec.roots!)}, not ${a(root!.type).replace(/^A/, "a")}`, `${path}.${key}`, id);
      continue;
    }
    // A token in a template's prop (a template's own component's color): its value where the node is.
    let given: unknown = value;
    if (context?.mode === "authored" && holdsToken(value)) {
      const problems: Problem[] = [];
      given = resolveValue(value, context.environment, spec.kind.name, false, problems);
      for (const problem of problems) d.error(problem.code, problem.message, `${path}.${key}${problem.at}`, id);
      if (problems.length) continue;
    }
    const parsed = spec.kind.parse(given);
    if (parsed.ok) {
      if (!spec.kind.empty?.(parsed.value)) out[key] = parsed.value;
    } else d.error("prop/invalid", `${key}: ${parsed.message}${aliasHint(value)}`, `${path}.${key}`, id);
  }
  for (const [key, spec] of Object.entries(definition.props)) {
    if (spec.required && !(key in out) && !(isObject(input) && input[key] !== undefined)) {
      d.error("prop/required", `A ${definition.type} needs "${key}" (${spec.kind.accepts})`, `${path}.${key}`, id);
    }
  }
  return Object.keys(out).length ? out : undefined;
}

const UNSUPPORTED_CSS: Record<string, string> = {
  margin: "use the parent's gap for space between siblings, or padding for space inside",
  marginTop: "use the parent's gap, or padding",
  marginBottom: "use the parent's gap, or padding",
  marginLeft: "use padding",
  marginRight: "use padding",
  display: "the component sets it",
  position: "use a Layer for content placed over other content",
  backgroundImage: "put a Layer around it, its first child an Image (the Layer's height crops it to cover), the rest over it",
  background: "backgroundColor for a color; for an image, a Layer: its first child an Image, the rest over it",
  float: "use a Row to put things side by side",
  // Names Elements used before it took CSS's.
  align: "it's alignItems now",
  justify: 'it\'s justifyContent now ("between" is "space-between")',
  wrap: "a Row stays side by side on phones with its stackOnMobile prop set to false; flexWrap wraps it on the web",
  color: "a Divider's line is its borderTop, with its color",
  thickness: 'a Divider\'s line is borderTop now: "1px solid #bbbbbb"',
  lineStyle: 'a Divider\'s line is borderTop now: "1px solid #bbbbbb"',
};

/** What to write instead of a style a component doesn't take, after a colon; or nothing. */
function styleHint(definition: ComponentDefinition, specs: StyleSpecs, key: string): string {
  if (Object.prototype.hasOwnProperty.call(definition.props, key)) return `: it's a prop, ${key}={…}`;
  if (key === "padding" && definition.categories.includes("root")) return ": a root has no padding; put it on a Column (a card) or a Section (a band) inside it";
  if (UNSUPPORTED_CSS[key]) return `: ${UNSUPPORTED_CSS[key]}`;
  const condition = conditionHint(definition, key);
  if (condition) return `: ${condition}`;
  const meant = nearest(key, Object.keys(specs));
  return meant ? `: did you mean "${meant}"?` : "";
}

function readStyles(
  input: unknown,
  definition: ComponentDefinition,
  specs: StyleSpecs,
  path: string,
  id: string | undefined,
  d: Diagnostics,
  what: string,
  allowed: (spec: StyleSpecs[string], key: string) => boolean,
  /** For a condition, what can be set for it is set "for phones". */
  forLabel?: string,
  /** The template's root: a style declared for other roots is an error under it. */
  root?: ComponentDefinition,
  /** Where each key came from, where a theme gave it ("mobile.padding": the theme's path): diagnostics name it. */
  from?: { origins: Map<string, string>; prefix: string }
): Record<string, Json> | undefined {
  const at = (key: string) => from?.origins.get(`${from.prefix}${key}`) ?? `${path}.${key}`;
  if (input === undefined) return undefined;
  if (!isObject(input)) {
    d.error(`${what}/invalid`, `${what} is an object of style properties`, path, id);
    return undefined;
  }
  const out: Record<string, Json> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    const spec = Object.prototype.hasOwnProperty.call(specs, key) ? specs[key] : undefined;
    if (!spec) {
      d.error("style/unknown", seeing(`"${key}" isn't a style ${a(definition.type).replace(/^A/, "a")} takes${styleHint(definition, specs, key)}`, definition.type), at(key), id);
      continue;
    }
    if (!rootTakes(spec.roots, root)) {
      d.error("style/not-supported", `${a(definition.type)}'s "${key}" is for ${rootList(spec.roots!)}, not ${a(root!.type).replace(/^A/, "a")}`, at(key), id);
      continue;
    }
    if (!allowed(spec, key)) {
      d.error(`${what}/not-allowed`, `"${key}" can't be set ${forLabel ?? "here"}`, at(key), id);
      continue;
    }
    const parsed = spec.kind.parse(value);
    if (parsed.ok) out[key] = parsed.value;
    else d.error(`${what}/invalid`, `${key}: ${parsed.message}${aliasHint(value)}`, at(key), id);
  }
  return Object.keys(out).length ? out : undefined;
}

function readHidden(input: unknown, path: string, id: string | undefined, context: Context): Node["hidden"] | undefined {
  const { d } = context;
  if (!context.root?.responsive) {
    d.error("hidden/not-supported", "Hiding on phones or desktops is for an Email or a Page", path, id);
    return undefined;
  }
  if (!isObject(input) || Object.entries(input).some(([key, value]) => (key !== "mobile" && key !== "desktop") || (value !== undefined && typeof value !== "boolean"))) {
    d.error("hidden/invalid", "hidden is { mobile?: boolean, desktop?: boolean }", path, id);
    return undefined;
  }
  const out: { mobile?: boolean; desktop?: boolean } = {};
  if (input.mobile === true) out.mobile = true;
  if (input.desktop === true) out.desktop = true;
  if (!shownAnywhere({ hidden: out })) d.warning("hidden/everywhere", "Hidden on phones and on desktops, it never shows", path, id);
  return Object.keys(out).length ? out : undefined;
}

function readChildren(input: unknown, definition: ComponentDefinition, path: string, id: string | undefined, context: Context): Child[] {
  const { d } = context;
  if (input === undefined) return [];
  if (!Array.isArray(input)) {
    d.error("children/invalid", "children is an array of components and text", path, id);
    return [];
  }
  const out: Child[] = [];
  input.forEach((child, index) => {
    const at = `${path}[${index}]`;
    if (typeof child === "string") {
      if (!child) return;
      if (definition.children.text) {
        const last = out[out.length - 1];
        if (typeof last === "string") out[out.length - 1] = last + child;
        else out.push(child);
      } else if (child.trim()) {
        d.error("children/text-not-allowed", `Text can't go straight in a ${definition.type}: put it in a Text or Heading`, at, id);
      }
      return;
    }
    const node = readNode(child, at, definition, context);
    if (!node) return;
    // A Document's header and footer are drawn on every page: it has one of each, and a second would replace the first.
    if (definition.type === "Document" && (node.type === "PageHeader" || node.type === "PageFooter") && out.some((other) => typeof other !== "string" && other.type === node.type)) {
      d.error("children/one-only", `A Document has one ${node.type}, drawn on every page: this is a second (put what both hold in one)`, at, node.id);
    }
    out.push(node);
  });
  return out;
}
