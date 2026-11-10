/**
 * Themes: tokens a template's styles refer to, defaults for each component (by a prop's value too), variants, named
 * styles, and overrides for one kind of root. A theme is data, read here when a template is read: what it gives a
 * node is merged into the node's own style before its condition blocks are lifted, so a merged block is read like an
 * authored one, and the tree the writers get holds values only.
 *
 * Which token a reference names is decided where it's used, against that place's environment: the theme's tokens with
 * each enclosing scope's (`tokens` on a Section, Row, Column or Grid) over them.
 */
import { CONDITIONS, CONDITION_NAMES } from "./conditions";
import type { ComponentDefinition, StyleSpecs } from "./define";
import type { Diagnostics } from "./diagnostics";
import { color, fontFamily, length, lineHeight, radius as radiusKind, type Kind } from "./kinds";
import type { Json } from "./model";
import { a, nearest, show } from "./nearest";
import { length as cssLength, radius as cssRadius } from "./writers/shared/css";

export const TOKEN_GROUPS = ["colors", "spacing", "fontSizes", "lineHeights", "fonts", "radii"] as const;
export type TokenGroup = (typeof TOKEN_GROUPS)[number];

/** The kinds of root a theme's `formats` override it for. */
export const THEME_FAMILIES = { Email: "email", Page: "page", Document: "document", Canvas: "canvas" } as const;
export type ThemeFamily = (typeof THEME_FAMILIES)[keyof typeof THEME_FAMILIES];

/** Groups other libraries' themes have that Elements will take when the styles that use them exist. */
const NOT_YET: Record<string, string> = {
  shadows: "shadows aren't a token group yet: they come with box shadows",
  keyframes: "keyframes aren't a token group yet: they come with animations",
};

const THEME_KEYS = [...TOKEN_GROUPS, "components", "styles", "formats"];

/** A token's or a group's name: letters and digits, so its path is also a CSS custom property's name. */
const NAME = /^(?:[A-Za-z][A-Za-z0-9]*|[0-9]+)$/;
/** A named style's or a variant's name. */
const STYLE_NAME = /^[A-Za-z][A-Za-z0-9_-]*$/;
/** A reference inside a theme: the W3C Design Tokens format's alias, the whole string. */
const ALIAS = /^\{([A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*)\}$/;
const CORNERS = ["topLeft", "topRight", "bottomRight", "bottomLeft"];
const MODES = new Set(["base", "dark"]);

const lengthKind = length(["px"]);
const GROUP_KIND: Record<TokenGroup, Kind<any, Json>> = {
  colors: color(),
  spacing: lengthKind,
  fontSizes: lengthKind,
  lineHeights: lineHeight(),
  fonts: fontFamily(),
  radii: radiusKind(),
};
const GROUP_LIMIT: Partial<Record<TokenGroup, (value: Json) => string | undefined>> = {
  fontSizes: (value) => (typeof value === "number" && value <= 0 ? "a font size is more than 0" : undefined),
};

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Names a theme can't give a token, a group, a named style or a variant: they reach into JavaScript's own objects. */
const RESERVED = new Set(["__proto__", "constructor", "prototype"]);
const reserved = (name: string) => `${show(name)} is a name JavaScript keeps for its own objects: choose another`;
const withoutKey = (object: Record<string, unknown>, key: string): Record<string, unknown> => Object.fromEntries(Object.entries(object).filter(([name]) => name !== key));
/** A key's value only where the object holds it itself, never one it inherits ("constructor"). */
const ownValue = <T>(object: Record<string, T>, key: string): T | undefined => (Object.prototype.hasOwnProperty.call(object, key) ? object[key] : undefined);
/** A key set as the object's own, even "__proto__". */
function put<T>(object: Record<string, T>, key: string, value: T): T {
  Object.defineProperty(object, key, { value, writable: true, enumerable: true, configurable: true });
  return value;
}

/** A theme as a template gives it (`defineTheme()`'s data): checked when the template is read. */
export type ThemeData = { [key: string]: Json };

/** The token a reference names, if it is one: `{ $token: "colors.primary" }`, or inside a theme `"{colors.primary}"`. */
export function referenceOf(value: unknown, aliases: boolean): string | undefined {
  if (isObject(value)) {
    const keys = Object.keys(value);
    return keys.length === 1 && keys[0] === "$token" && typeof value.$token === "string" ? value.$token : undefined;
  }
  if (aliases && typeof value === "string") return ALIAS.exec(value)?.[1];
  return undefined;
}

/**
 * For a value that won't parse, where a template holds a theme's alias (`"{colors.night}"`, read only inside a theme):
 * what to write instead. Empty if it holds none.
 */
export function aliasHint(value: unknown): string {
  const find = (inner: unknown): string | undefined =>
    typeof inner === "string" ? ALIAS.exec(inner)?.[1] : Array.isArray(inner) ? inner.map(find).find(Boolean) : isObject(inner) ? Object.values(inner).map(find).find(Boolean) : undefined;
  const path = find(value);
  return path ? `. "{${path}}" is a token only inside a theme: in a template write token("${path}")` : "";
}

/** Whether a value holds a `{ $token }` anywhere (a template's style or prop). */
export function holdsToken(value: unknown): boolean {
  if (referenceOf(value, false) !== undefined) return true;
  if (Array.isArray(value)) return value.some(holdsToken);
  if (isObject(value)) return Object.values(value).some(holdsToken);
  return false;
}

const isModes = (value: unknown) => isObject(value) && Object.keys(value).length > 0 && Object.keys(value).every((key) => MODES.has(key));

/** Whether a value in a token group is a token (not a group of them): one grammar, for reading and for the types. */
function isToken(group: TokenGroup, value: unknown, aliases: boolean): boolean {
  if (typeof value === "string" || typeof value === "number" || Array.isArray(value)) return true;
  if (referenceOf(value, aliases) !== undefined) return true;
  return group === "radii" && isObject(value) && Object.keys(value).length > 0 && Object.keys(value).every((key) => CORNERS.includes(key));
}

/** One object merged over another: objects key by key at every depth, anything else replaced. */
export function mergeTheme<T extends Json>(base: T, over: Json | undefined): T {
  if (over === undefined) return base;
  if (!isObject(base) || !isObject(over)) return over as T;
  const out: Record<string, Json> = { ...base };
  for (const [key, value] of Object.entries(over)) put(out, key, Object.prototype.hasOwnProperty.call(out, key) ? mergeTheme(out[key], value) : value);
  return out as T;
}

interface TokenEntry {
  group: TokenGroup;
  /** Its value (a kind's output), or the path of the token it refers to. */
  value: Json;
  reference?: string;
  /** Where it's written, for messages. */
  at: string;
}

type Resolved = { ok: true; value: Json; group: TokenGroup } | { ok: false; code: string; message: string };

/**
 * The tokens a place in a template sees: the theme's, with every enclosing scope's over them. References are kept
 * as written and resolved here, against these, so a theme's alias and a component default both follow a scope.
 */
export class ThemeEnvironment {
  private constructor(
    /** The theme, checked, with its root's `formats` merged: what the document keeps. */
    readonly theme: ThemeData,
    private readonly tokens: ReadonlyMap<string, TokenEntry>,
    /** Where the theme is in the template, for messages ("root.theme"). */
    readonly at: string
  ) {}

  static of(theme: ThemeData, at: string): ThemeEnvironment {
    const tokens = new Map<string, TokenEntry>();
    for (const group of TOKEN_GROUPS) flatten(group, theme[group], group, `${at}.${group}`, tokens, true);
    return new ThemeEnvironment(theme, tokens, at);
  }

  static empty(): ThemeEnvironment {
    return new ThemeEnvironment({}, new Map(), "root.theme");
  }

  /** This environment with a scope's tokens (values, read already) over it. */
  with(scope: Record<string, Json>, at: string): ThemeEnvironment {
    const tokens = new Map(this.tokens);
    for (const group of TOKEN_GROUPS) flatten(group, scope[group], group, `${at}.${group}`, tokens, false);
    return new ThemeEnvironment(this.theme, tokens, this.at);
  }

  has(path: string): boolean {
    return this.tokens.has(path);
  }

  paths(): string[] {
    return [...this.tokens.keys()];
  }

  resolve(path: string, seen: string[] = []): Resolved {
    const entry = this.tokens.get(path);
    if (!entry) {
      const meant = nearest(path, this.tokens.keys());
      const known = this.tokens.size ? "" : ": the template has no theme";
      return { ok: false, code: "theme/missing-token", message: `There's no token "${path}"${meant ? `: did you mean "${meant}"?` : known}` };
    }
    if (entry.reference === undefined) return { ok: true, value: entry.value, group: entry.group };
    if (seen.includes(path)) return { ok: false, code: "theme/cycle", message: `The tokens ${[...seen, path].join(" → ")} refer to each other in a loop` };
    const target = this.resolve(entry.reference, [...seen, path]);
    if (!target.ok) return target;
    if (!sameKind(target.group, entry.group)) return { ok: false, code: "theme/value", message: `"${path}" is in ${entry.group} but refers to "${entry.reference}", in ${target.group}` };
    return { ok: true, value: target.value, group: entry.group };
  }

  /** Every token's value here, as nested groups: what a template's own component's render reads. */
  view(): Record<string, Json> {
    const out: Record<string, Json> = {};
    for (const path of this.tokens.keys()) {
      const resolved = this.resolve(path);
      if (!resolved.ok) continue;
      const parts = path.split(".");
      let into = out;
      for (const part of parts.slice(0, -1)) {
        const next = ownValue(into, part);
        into = (isObject(next) ? next : put(into, part, {})) as Record<string, Json>;
      }
      put(into, parts[parts.length - 1], resolved.value);
    }
    return out;
  }

  /** Each token as a CSS custom property (`--colors-primary`) and its value, where it resolves. */
  customProperties(): Map<string, string> {
    const out = new Map<string, string>();
    for (const path of this.tokens.keys()) {
      const resolved = this.resolve(path);
      if (!resolved.ok) continue;
      const value = resolved.group === "radii" ? cssRadius(resolved.value) : resolved.group === "spacing" || resolved.group === "fontSizes" ? cssLength(resolved.value) : String(resolved.value);
      if (value !== undefined) out.set(`--${path.replace(/\./g, "-")}`, value);
    }
    return out;
  }
}

const sameKind = (a: TokenGroup, b: TokenGroup) => a === b || ((a === "spacing" || a === "fontSizes") && (b === "spacing" || b === "fontSizes"));

function flatten(group: TokenGroup, tree: Json | undefined, path: string, at: string, into: Map<string, TokenEntry>, aliases: boolean): void {
  if (tree === undefined) return;
  if (isToken(group, tree, aliases)) {
    const reference = referenceOf(tree, aliases);
    into.set(path, reference !== undefined ? { group, value: null, reference, at } : { group, value: tree, at });
    return;
  }
  if (!isObject(tree)) return;
  for (const [name, value] of Object.entries(tree)) flatten(group, value, `${path}.${name}`, `${at}.${name}`, into, aliases);
}

/** Which token groups a value's position takes, by its kind and where in the value it is (a border's color). */
function groupsAt(kind: string, keyPath: readonly string[]): readonly TokenGroup[] {
  const leaf = keyPath[keyPath.length - 1];
  switch (kind) {
    case "color":
      return ["colors"];
    case "length":
      return ["spacing", "fontSizes"];
    case "insets":
      return ["spacing"];
    case "radius":
      return ["radii"];
    case "fontFamily":
      return ["fonts"];
    case "lineHeight":
      return ["lineHeights"];
    case "border":
    case "line":
      return leaf === "color" ? ["colors"] : leaf === "width" ? ["spacing"] : [];
    default:
      return [];
  }
}

export interface Problem {
  code: string;
  message: string;
  /** Where, after the value's own path ("", ".color", "[1]"). */
  at: string;
}

/**
 * A value with every reference in it replaced by the token's value, checked against the position it's in: `kind`,
 * the kind of the style or prop it's for. `aliases`: whether `"{colors.primary}"` is a reference (inside a theme).
 */
export function resolveValue(value: unknown, environment: ThemeEnvironment | undefined, kind: string, aliases: boolean, problems: Problem[], keyPath: string[] = []): unknown {
  const reference = referenceOf(value, aliases);
  const at = keyPath.map((key) => (/^\d+$/.test(key) ? `[${key}]` : `.${key}`)).join("");
  if (reference !== undefined) {
    if (!environment) {
      problems.push({ code: "theme/missing-token", message: `There's no token "${reference}": the template has no theme`, at });
      return undefined;
    }
    const resolved = environment.resolve(reference);
    if (!resolved.ok) {
      problems.push({ code: resolved.code, message: resolved.message, at });
      return undefined;
    }
    const groups = groupsAt(kind, keyPath);
    if (!groups.includes(resolved.group)) {
      const takes = groups.length ? `a token from ${groups.join(" or ")}` : "no token";
      problems.push({ code: "theme/value", message: `"${reference}" is in ${resolved.group}, and this takes ${takes}`, at });
      return undefined;
    }
    return resolved.value;
  }
  if (Array.isArray(value)) return value.map((item, index) => resolveValue(item, environment, kind, aliases, problems, [...keyPath, String(index)]));
  if (isObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) out[key] = resolveValue(inner, environment, kind, aliases, problems, [...keyPath, key]);
    return out;
  }
  return value;
}

// ─── Reading a theme ────────────────────────────────────────────────────────

export interface ThemeReadContext {
  d: Diagnostics;
  /** Each component's definition, by type. */
  definition(type: string): ComponentDefinition | undefined;
  /** Every built-in component's type. */
  types(): readonly string[];
}

/**
 * A theme checked: its shape, every token's name and value (unused ones too), every reference, and with its root's
 * `formats` merged over it. Null where it isn't a theme at all.
 */
export function readTheme(input: unknown, at: string, rootType: string, context: ThemeReadContext): ThemeData | null {
  const { d } = context;
  if (!isObject(input)) {
    d.error("theme/schema", `A theme is an object (defineTheme({ colors, spacing, fontSizes, lineHeights, fonts, radii, components, styles, formats })), not ${show(input)}`, at);
    return null;
  }
  const checked = checkThemeShape(input, at, context, true);
  const family = THEME_FAMILIES[rootType as keyof typeof THEME_FAMILIES] as ThemeFamily | undefined;
  const formats = isObject(checked.formats) ? checked.formats : undefined;
  const { formats: _, ...rest } = checked;
  const merged = family && formats?.[family] !== undefined ? mergeTheme(rest as Json, formats[family]) : (rest as Json);
  const theme = merged as ThemeData;
  // References between tokens: each resolves, with no loop, to a token of its kind; under this root, and under every
  // other root its formats are for (a shared theme is checked wherever it's read).
  const check = (data: ThemeData, where: (path: string) => string) => {
    const environment = ThemeEnvironment.of(data, at);
    for (const path of environment.paths()) {
      const resolved = environment.resolve(path);
      if (!resolved.ok) d.error(resolved.code, resolved.message, where(path));
    }
  };
  check(theme, (path) => `${at}.${path}`);
  for (const [other, overrides] of Object.entries(formats ?? {})) {
    if (other === family || !isObject(overrides)) continue;
    check(mergeTheme(rest as Json, overrides) as ThemeData, (path) => (holds(overrides, path) ? `${at}.formats.${other}.${path}` : `${at}.${path}`));
  }
  return theme;
}

/** Whether a theme's data sets the token at `path` ("colors.primary") itself. */
function holds(data: Record<string, Json>, path: string): boolean {
  let at: Json | undefined = data;
  for (const part of path.split(".")) at = isObject(at) ? ownValue(at as Record<string, Json>, part) : undefined;
  return at !== undefined;
}

function checkThemeShape(input: Record<string, unknown>, at: string, context: ThemeReadContext, top: boolean): Record<string, Json> {
  const { d } = context;
  const out: Record<string, Json> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    const where = `${at}.${key}`;
    if (NOT_YET[key]) {
      d.error("theme/schema", NOT_YET[key], where);
      continue;
    }
    if (!THEME_KEYS.includes(key) || (key === "formats" && !top)) {
      const meant = nearest(key, THEME_KEYS);
      d.error("theme/schema", `"${key}" isn't part of a theme${meant ? `: did you mean "${meant}"?` : ` (it has ${THEME_KEYS.join(", ")})`}`, where);
      continue;
    }
    if (!isObject(value)) {
      d.error("theme/schema", `A theme's ${key} is an object, not ${show(value)}`, where);
      continue;
    }
    if ((TOKEN_GROUPS as readonly string[]).includes(key)) {
      const group = readGroup(key as TokenGroup, value, where, d);
      if (group) out[key] = group;
    } else if (key === "components") out.components = readComponents(value, where, context);
    else if (key === "styles") out.styles = readNamedStyles(value, where, d);
    else {
      const formats: Record<string, Json> = {};
      for (const [family, theme] of Object.entries(value)) {
        if (!Object.values(THEME_FAMILIES).includes(family as ThemeFamily)) {
          d.error("theme/schema", `"${family}" isn't a kind of root: formats are for email, page, document and canvas`, `${where}.${family}`);
          continue;
        }
        if (!isObject(theme)) {
          d.error("theme/schema", `formats.${family} is part of a theme, as an object`, `${where}.${family}`);
          continue;
        }
        formats[family] = checkThemeShape(theme, `${where}.${family}`, context, false);
      }
      out.formats = formats;
    }
  }
  return out;
}

/** A token group: names checked, each token's value read by its group's kind, references kept as written. */
function readGroup(group: TokenGroup, tree: Record<string, unknown>, at: string, d: Diagnostics): Record<string, Json> | undefined {
  const out: Record<string, Json> = {};
  for (const [name, value] of Object.entries(tree)) {
    if (value === undefined) continue;
    const where = `${at}.${name}`;
    if (!NAME.test(name)) {
      const nested = name.replace(/[-_.]/g, ".");
      d.error("theme/schema", `A token's name is letters and digits, not ${show(name)}${/[-_.]/.test(name) ? `: nest it instead (${nested})` : ""}`, where);
      continue;
    }
    if (RESERVED.has(name)) {
      d.error("theme/schema", reserved(name), where);
      continue;
    }
    if (group === "radii" && CORNERS.includes(name)) {
      d.error("theme/schema", `${name} is a corner: in radii it names part of a token's value ({ topLeft, topRight, … }), not a token or a group`, where);
      continue;
    }
    if (isModes(value)) {
      d.error("theme/schema", `A token has one value: modes such as { base, dark } come with dark mode, later`, where);
      continue;
    }
    if (isToken(group, value, true)) {
      const token = readToken(group, value, where, d, true);
      if (token !== undefined) out[name] = token;
    } else if (isObject(value)) {
      const inner = readGroup(group, value, where, d);
      if (inner) out[name] = inner;
    } else d.error("theme/schema", `${show(value)} isn't a token`, where);
  }
  return out;
}

function readToken(group: TokenGroup, value: unknown, at: string, d: Diagnostics, aliases: boolean): Json | undefined {
  if (referenceOf(value, aliases) !== undefined) return value as Json;
  const parsed = GROUP_KIND[group].parse(value);
  if (!parsed.ok) {
    d.error("theme/schema", `A token in ${group}: ${parsed.message}${aliases ? "" : aliasHint(value)}`, at);
    return undefined;
  }
  const limit = GROUP_LIMIT[group]?.(parsed.value);
  if (limit) {
    d.error("theme/schema", `A token in ${group}: ${limit}, not ${show(value)}`, at);
    return undefined;
  }
  return parsed.value;
}

/** What a style block in a theme holds besides styles. */
const BLOCK_KEYS = new Set(["apply"]);

/** A style block in a theme: an object, its `apply` a list of names, its condition blocks objects; values are read where it's used. */
function readBlock(value: unknown, at: string, d: Diagnostics, allowed: { by?: boolean; variants?: boolean } = {}): Record<string, Json> | undefined {
  if (!isObject(value)) {
    d.error("theme/schema", `A style in a theme is an object of styles, not ${show(value)}`, at);
    return undefined;
  }
  const out: Record<string, Json> = {};
  for (const [key, inner] of Object.entries(value)) {
    if (inner === undefined) continue;
    const where = `${at}.${key}`;
    if (key === "apply") {
      if (!Array.isArray(inner) || inner.some((name) => typeof name !== "string")) d.error("theme/schema", `apply is a list of named styles' names, not ${show(inner)}`, where);
      else out.apply = inner as Json[];
    } else if ((key === "by" && allowed.by) || (key === "variants" && allowed.variants)) {
      out[key] = inner as Json;
    } else if (CONDITION_NAMES.has(key)) {
      if (!isObject(inner)) d.error("theme/schema", `${key} is a block of styles, not ${show(inner)}`, where);
      else {
        if ("apply" in inner) d.error("style/apply-place", `apply goes at the top of a style, not inside ${key}`, `${where}.apply`);
        const { apply: _, ...rest } = inner;
        out[key] = rest as Json;
      }
    } else put(out, key, inner as Json);
  }
  return out;
}

function readNamedStyles(value: Record<string, unknown>, at: string, d: Diagnostics): Record<string, Json> {
  const out: Record<string, Json> = {};
  for (const [name, style] of Object.entries(value)) {
    if (style === undefined) continue;
    if (!STYLE_NAME.test(name)) {
      d.error("theme/schema", `A named style's name starts with a letter and holds letters, digits, "_" and "-", not ${show(name)}`, `${at}.${name}`);
      continue;
    }
    if (RESERVED.has(name)) {
      d.error("theme/schema", reserved(name), `${at}.${name}`);
      continue;
    }
    const block = readBlock(style, `${at}.${name}`, d);
    if (block) out[name] = block;
  }
  return out;
}

function readComponents(value: Record<string, unknown>, at: string, context: ThemeReadContext): Record<string, Json> {
  const { d } = context;
  const out: Record<string, Json> = {};
  for (const [type, defaults] of Object.entries(value)) {
    if (defaults === undefined) continue;
    const where = `${at}.${type}`;
    const definition = context.definition(type);
    if (!definition || type.includes(".")) {
      const meant = nearest(type, context.types());
      d.error("theme/schema", `${show(type)} isn't a built-in component${meant ? `: did you mean "${meant}"?` : ""} (a template's own component is styled in its render)`, where);
      continue;
    }
    const isRoot = definition.categories.includes("root");
    if (isRoot && isObject(defaults) && defaults.variants !== undefined) {
      d.error("theme/schema", `${a(type)} has no variants: a template has one root, whose style the theme's ${type} defaults set`, `${where}.variants`);
    }
    const block = readBlock(isRoot && isObject(defaults) ? withoutKey(defaults, "variants") : defaults, where, d, { by: true, variants: !isRoot });
    if (!block) continue;
    if (block.by !== undefined) {
      const by = readBy(block.by, definition, `${where}.by`, d);
      if (by) block.by = by;
      else delete block.by;
    }
    if (block.variants !== undefined) {
      if (!isObject(block.variants)) {
        d.error("theme/schema", `variants is an object of named styles, not ${show(block.variants)}`, `${where}.variants`);
        delete block.variants;
      } else {
        const variants: Record<string, Json> = {};
        for (const [name, variant] of Object.entries(block.variants)) {
          if (!STYLE_NAME.test(name)) {
            d.error("theme/schema", `A variant's name starts with a letter and holds letters, digits, "_" and "-", not ${show(name)}`, `${where}.variants.${name}`);
            continue;
          }
          if (RESERVED.has(name)) {
            d.error("theme/schema", reserved(name), `${where}.variants.${name}`);
            continue;
          }
          const read = readBlock(variant, `${where}.variants.${name}`, d);
          if (read) variants[name] = read;
        }
        block.variants = variants;
      }
    }
    out[type] = block;
  }
  return out;
}

/** `by`: one prop, a choice or a boolean, and a style for each of its values. */
function readBy(value: unknown, definition: ComponentDefinition, at: string, d: Diagnostics): Record<string, Json> | undefined {
  if (!isObject(value)) {
    d.error("theme/schema", `by is { prop: { value: style } }, not ${show(value)}`, at);
    return undefined;
  }
  const props = Object.keys(value);
  if (props.length !== 1) {
    d.error("theme/schema", `by names one prop (${props.join(", ") || "none"} given): other differences are variants`, at);
    return undefined;
  }
  const prop = props[0];
  const spec = Object.prototype.hasOwnProperty.call(definition.props, prop) ? definition.props[prop] : undefined;
  if (!spec || (spec.kind.name !== "enum" && spec.kind.name !== "boolean")) {
    const choices = Object.entries(definition.props)
      .filter(([, s]) => s.kind.name === "enum" || s.kind.name === "boolean")
      .map(([name]) => name);
    d.error("theme/schema", `by takes a ${definition.type}'s prop with a set of values${choices.length ? ` (${choices.join(", ")})` : `, and a ${definition.type} has none`}, not ${show(prop)}`, `${at}.${prop}`);
    return undefined;
  }
  const values = value[prop];
  if (!isObject(values)) {
    d.error("theme/schema", `by.${prop} is a style for each of its values, not ${show(values)}`, `${at}.${prop}`);
    return undefined;
  }
  // Each value one the prop can take: a style for another is never applied.
  const schema = spec.kind.jsonSchema() as { enum?: readonly unknown[] };
  const takes = spec.kind.name === "boolean" ? ["true", "false"] : (schema.enum ?? []).map(String);
  const out: Record<string, Json> = {};
  for (const [key, style] of Object.entries(values)) {
    if (!takes.includes(key)) {
      // A number a digit away isn't a typo of it (a level 7 isn't a 1).
      const meant = /^\d+$/.test(key) ? undefined : nearest(key, takes);
      d.error("theme/schema", `${a(definition.type)}'s ${prop} is never ${show(key)}${meant ? `: did you mean "${meant}"?` : ` (it's ${takes.join(", ")})`}`, `${at}.${prop}.${key}`);
      continue;
    }
    const block = readBlock(style, `${at}.${prop}.${key}`, d);
    if (block) out[key] = block;
  }
  return { [prop]: out };
}

// ─── Applying a theme to a node ─────────────────────────────────────────────

/** A source of a node's style, lowest first: what it sets, and where each of its keys is written (for messages). */
interface Source {
  base: Record<string, unknown>;
  blocks: Record<string, Record<string, unknown>>;
  origin: Map<string, string>;
  kind: "role" | "default" | "variant" | "named" | "own";
}

export interface ThemedStyle {
  /** The node's style, with its condition blocks inside, as if the author had written it. */
  style: Record<string, unknown> | undefined;
  /** Where each key ("padding", "mobile.padding") was written, where it's not the node's own style. */
  origins: Map<string, string>;
  /** Which source gave each base key. */
  from: Map<string, Source["kind"]>;
}

export interface ThemeNodeContext {
  d: Diagnostics;
  environment: ThemeEnvironment | undefined;
  /** The node's component. */
  definition: ComponentDefinition;
  /** Its props, read, with defaults (for `by`). */
  props: Record<string, Json>;
  /** The roles it applies: its component's every role (where the environment has the token), or a scope's, those it sets. */
  roles: "all" | ReadonlySet<string>;
  /** Whether a condition is taken under the template's root. */
  conditionAllowed(name: string): boolean;
  /** Whether a style is taken under the template's root. */
  styleAllowed(key: string): boolean;
  path: string;
  id: string | undefined;
}

/**
 * A node's style with its theme merged: roles, its component's defaults, those for its prop's value, its variants and
 * its named styles, then its own style, each condition block key by key. A key the node sets in its own base takes
 * that key out of every lower source's condition blocks (unless it sets it in that block too).
 */
export function themedStyle(own: unknown, variant: unknown, context: ThemeNodeContext): ThemedStyle {
  const { d, environment, definition, path, id } = context;
  const theme = environment?.theme;
  const components = isObject(theme?.components) ? theme.components : {};
  const defaults = isObject(ownValue(components, definition.type)) ? (ownValue(components, definition.type) as Record<string, Json>) : undefined;
  const themeAt = environment?.at ?? "root.theme";
  const sources: Source[] = [];

  // Roles.
  const roles = definition.roles ?? {};
  const role: Source = { base: {}, blocks: {}, origin: new Map(), kind: "role" };
  for (const [key, token] of Object.entries(roles)) {
    if (context.roles !== "all" && !context.roles.has(token)) continue;
    if (!environment?.has(token)) continue;
    const resolved = environment.resolve(token);
    if (!resolved.ok) continue;
    const [style, part] = key.split(".");
    if (!context.styleAllowed(style) || !definition.style[style]) continue;
    if (part) {
      const around = definition.defaultStyle?.[style];
      role.base[style] = { ...(isObject(around) ? around : {}), [part]: resolved.value };
    } else role.base[style] = resolved.value;
    role.origin.set(style, `${themeAt}.${token}`);
  }
  if (Object.keys(role.base).length) sources.push(role);

  const fromTheme = (block: Json | undefined, at: string, kind: Source["kind"]) => {
    if (block === undefined) return;
    const expanded = expandApply(block, at, theme, d, []);
    sources.push(themeSource(expanded, kind, environment, context));
  };

  // The component's defaults, and those for its prop's value.
  if (defaults) {
    const { by, variants: _, ...base } = defaults;
    fromTheme(base as Json, `${themeAt}.components.${definition.type}`, "default");
    if (isObject(by)) {
      const [prop, values] = Object.entries(by)[0] ?? [];
      const value = context.props[prop as string];
      if (prop && isObject(values) && value !== undefined && isObject(ownValue(values, String(value)))) fromTheme(ownValue(values, String(value)) as Json, `${themeAt}.components.${definition.type}.by.${prop}.${String(value)}`, "default");
    }
  }

  // Its variants.
  const variants = defaults && isObject(defaults.variants) ? defaults.variants : {};
  for (const [index, name] of namesOf(variant, `${path}.variant`, "variant", d, id).entries()) {
    const where = Array.isArray(variant) ? `${path}.variant[${index}]` : `${path}.variant`;
    if (!isObject(ownValue(variants, name))) {
      const known = Object.keys(variants);
      const meant = nearest(name, known);
      const has = known.length ? ` (it has ${known.join(", ")})` : theme ? `: the theme gives a ${definition.type} none` : ": the template has no theme";
      d.error("variant/unknown", `${a(definition.type)} has no variant "${name}"${meant ? `: did you mean "${meant}"?` : has}`, where, id);
      continue;
    }
    fromTheme(ownValue(variants, name) as Json, `${themeAt}.components.${definition.type}.variants.${name}`, "variant");
  }

  // Its own style, and the named styles it applies.
  const ownSource: Source = { base: {}, blocks: {}, origin: new Map(), kind: "own" };
  let apply: unknown;
  if (isObject(own)) {
    for (const [key, value] of Object.entries(own)) {
      if (value === undefined) continue;
      if (key === "apply") apply = value;
      else if (CONDITION_NAMES.has(key) && isObject(value)) {
        const block: Record<string, unknown> = {};
        for (const [inner, innerValue] of Object.entries(value)) {
          if (inner === "apply") d.error("style/apply-place", `apply goes at the top of a style, not inside ${key}`, `${path}.style.${key}.apply`, id);
          else block[inner] = resolveOwn(innerValue, inner, `${path}.style.${key}.${inner}`, context);
        }
        ownSource.blocks[key] = block;
      } else if (CONDITION_NAMES.has(key)) ownSource.blocks[key] = value as Record<string, unknown>;
      else put(ownSource.base, key, resolveOwn(value, key, `${path}.style.${key}`, context));
    }
  }
  if (apply !== undefined) {
    const styles = isObject(theme?.styles) ? theme.styles : {};
    for (const [index, name] of namesOf(apply, `${path}.style.apply`, "apply", d, id).entries()) {
      const where = `${path}.style.apply[${index}]`;
      if (!isObject(ownValue(styles, name))) {
        const known = Object.keys(styles);
        const meant = nearest(name, known);
        d.error("style/unknown-name", `There's no named style "${name}"${meant ? `: did you mean "${meant}"?` : known.length ? ` (the theme has ${known.join(", ")})` : theme ? ": the theme has no named styles" : ": the template has no theme"}`, where, id);
        continue;
      }
      fromTheme(ownValue(styles, name) as Json, `${themeAt}.styles.${name}`, "named");
    }
  }

  // What the node sets in its own base takes that key out of every lower source's blocks (not its own).
  for (const key of Object.keys(ownSource.base)) {
    for (const source of sources) {
      for (const [condition, block] of Object.entries(source.blocks)) if (key in block && !(ownSource.blocks[condition] && key in ownSource.blocks[condition])) delete block[key];
    }
  }
  sources.push(ownSource);

  const base: Record<string, unknown> = {};
  const blocks: Record<string, Record<string, unknown>> = {};
  const origins = new Map<string, string>();
  const from = new Map<string, Source["kind"]>();
  for (const source of sources) {
    for (const [key, value] of Object.entries(source.base)) {
      base[key] = value;
      from.set(key, source.kind);
      const origin = source.origin.get(key);
      if (origin) origins.set(key, origin);
      else origins.delete(key);
    }
    for (const [condition, block] of Object.entries(source.blocks)) {
      if (!isObject(block)) {
        blocks[condition] = block as never;
        continue;
      }
      const into = (blocks[condition] ??= {});
      for (const [key, value] of Object.entries(block)) {
        into[key] = value;
        const origin = source.origin.get(`${condition}.${key}`);
        if (origin) origins.set(`${condition}.${key}`, origin);
        else origins.delete(`${condition}.${key}`);
      }
    }
  }
  const style: Record<string, unknown> = { ...base };
  for (const condition of CONDITIONS) if (blocks[condition.name] !== undefined) style[condition.name] = blocks[condition.name];
  return { style: Object.keys(style).length || own !== undefined ? style : undefined, origins, from };
}

/** A name or a list of them, as `variant` and `apply` take. */
function namesOf(value: unknown, at: string, what: string, d: Diagnostics, id: string | undefined): string[] {
  if (value === undefined) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value) && value.every((name) => typeof name === "string")) return value as string[];
  d.error(what === "variant" ? "variant/unknown" : "style/unknown-name", `${what} is a name or a list of names, not ${show(value)}`, at, id);
  return [];
}

/** A value of the node's own style with its tokens resolved, or as given where they don't resolve (reported). */
function resolveOwn(value: unknown, key: string, at: string, context: ThemeNodeContext): unknown {
  const spec = ownValue(context.definition.style, key);
  if (!spec || !holdsToken(value)) return value;
  const problems: Problem[] = [];
  const resolved = resolveValue(value, context.environment, spec.kind.name, false, problems);
  for (const problem of problems) context.d.error(problem.code, problem.message, at + problem.at, context.id);
  return problems.length ? undefined : resolved;
}

/** A block of a theme with the named styles it applies merged under it, each condition block key by key. */
function expandApply(block: Json, at: string, theme: ThemeData | undefined, d: Diagnostics, stack: string[]): { base: Record<string, Json>; blocks: Record<string, Record<string, Json>>; origin: Map<string, string> } {
  const out = { base: {} as Record<string, Json>, blocks: {} as Record<string, Record<string, Json>>, origin: new Map<string, string>() };
  if (!isObject(block)) return out;
  const styles = isObject(theme?.styles) ? theme.styles : {};
  const applied = Array.isArray(block.apply) ? (block.apply as string[]) : [];
  for (const [index, name] of applied.entries()) {
    const where = `${at}.apply[${index}]`;
    if (stack.includes(name)) {
      d.error("theme/cycle", `The named styles ${[...stack, name].join(" → ")} apply each other in a loop`, where);
      continue;
    }
    if (!isObject(ownValue(styles, name))) {
      const meant = nearest(name, Object.keys(styles));
      d.error("style/unknown-name", `There's no named style "${name}"${meant ? `: did you mean "${meant}"?` : ""}`, where);
      continue;
    }
    const inner = expandApply(ownValue(styles, name) as Json, `${themeRoot(at)}.styles.${name}`, theme, d, [...stack, name]);
    Object.assign(out.base, inner.base);
    for (const [condition, values] of Object.entries(inner.blocks)) Object.assign((out.blocks[condition] ??= {}), values);
    for (const [key, origin] of inner.origin) out.origin.set(key, origin);
  }
  for (const [key, value] of Object.entries(block)) {
    if (key === "apply" || key === "by" || key === "variants") continue;
    if (CONDITION_NAMES.has(key) && isObject(value)) {
      const into = (out.blocks[key] ??= {});
      for (const [inner, innerValue] of Object.entries(value)) {
        into[inner] = innerValue;
        out.origin.set(`${key}.${inner}`, `${at}.${key}.${inner}`);
      }
    } else {
      out.base[key] = value;
      out.origin.set(key, `${at}.${key}`);
    }
  }
  return out;
}

/** "root.theme" from a path inside it. */
function themeRoot(at: string): string {
  const index = at.search(/\.(components|styles)\./);
  return index < 0 ? at : at.slice(0, index);
}

/**
 * A theme's block as a source of a node's style: references resolved against the node's environment, and what its
 * root doesn't take left out (a theme is shared by every root: its phone styles do nothing in a Document).
 */
function themeSource(block: ReturnType<typeof expandApply>, kind: Source["kind"], environment: ThemeEnvironment | undefined, context: ThemeNodeContext): Source {
  const source: Source = { base: {}, blocks: {}, origin: block.origin, kind };
  const resolve = (key: string, value: Json, origin: string) => {
    const spec = ownValue(context.definition.style, key);
    if (!spec) return value;
    const problems: Problem[] = [];
    const resolved = resolveValue(value, environment, spec.kind.name, true, problems);
    for (const problem of problems) context.d.error(problem.code, problem.message, origin + problem.at);
    return problems.length ? undefined : resolved;
  };
  for (const [key, value] of Object.entries(block.base)) {
    if (!context.styleAllowed(key)) continue;
    const resolved = resolve(key, value, block.origin.get(key) ?? "");
    if (resolved !== undefined) source.base[key] = resolved;
  }
  for (const [condition, values] of Object.entries(block.blocks)) {
    if (!context.conditionAllowed(condition)) continue;
    const into: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(values)) {
      if (!context.styleAllowed(key)) continue;
      const resolved = resolve(key, value, block.origin.get(`${condition}.${key}`) ?? "");
      if (resolved !== undefined) into[key] = resolved;
    }
    source.blocks[condition] = into;
  }
  return source;
}

/** A scope's tokens (`tokens` on a Section, Row, Column or Grid) read: names checked, each a value of its group's kind or a `token()` of the tokens around it. */
export function readScope(input: unknown, at: string, around: ThemeEnvironment | undefined, d: Diagnostics, id: string | undefined): Record<string, Json> | undefined {
  if (!isObject(input)) {
    d.error("theme/schema", `tokens is an object of token groups (${TOKEN_GROUPS.join(", ")}), not ${show(input)}`, at, id);
    return undefined;
  }
  const out: Record<string, Json> = {};
  for (const [group, tree] of Object.entries(input)) {
    if (tree === undefined) continue;
    if (!(TOKEN_GROUPS as readonly string[]).includes(group)) {
      const meant = nearest(group, TOKEN_GROUPS);
      d.error("theme/schema", NOT_YET[group] ?? `"${group}" isn't a token group${meant ? `: did you mean "${meant}"?` : ` (${TOKEN_GROUPS.join(", ")})`}`, `${at}.${group}`, id);
      continue;
    }
    if (!isObject(tree)) {
      d.error("theme/schema", `tokens.${group} is an object of tokens, not ${show(tree)}`, `${at}.${group}`, id);
      continue;
    }
    const read = readScopeGroup(group as TokenGroup, tree, `${at}.${group}`, group, around, d, id);
    if (read && Object.keys(read).length) out[group] = read;
  }
  return out;
}

function readScopeGroup(group: TokenGroup, tree: Record<string, unknown>, at: string, path: string, around: ThemeEnvironment | undefined, d: Diagnostics, id: string | undefined): Record<string, Json> | undefined {
  const out: Record<string, Json> = {};
  for (const [name, value] of Object.entries(tree)) {
    if (value === undefined) continue;
    const where = `${at}.${name}`;
    if (!NAME.test(name) || (group === "radii" && CORNERS.includes(name))) {
      d.error("theme/schema", `A token's name is letters and digits (and in radii not a corner's), not ${show(name)}`, where, id);
      continue;
    }
    if (RESERVED.has(name)) {
      d.error("theme/schema", reserved(name), where, id);
      continue;
    }
    if (isModes(value)) {
      d.error("theme/schema", "A token has one value: modes such as { base, dark } come with dark mode, later", where, id);
      continue;
    }
    if (isToken(group, value, false)) {
      const reference = referenceOf(value, false);
      if (reference !== undefined) {
        const resolved = around?.resolve(reference) ?? ({ ok: false, code: "theme/missing-token", message: `There's no token "${reference}": the template has no theme` } as const);
        if (!resolved.ok) d.error(resolved.code, resolved.message, where, id);
        else if (!sameKind(resolved.group, group)) d.error("theme/value", `"${reference}" is in ${resolved.group}, and ${path}.${name} is in ${group}`, where, id);
        else out[name] = resolved.value;
      } else {
        const token = readToken(group, value, where, d, false);
        if (token !== undefined) out[name] = token;
      }
    } else if (isObject(value)) {
      const inner = readScopeGroup(group, value, where, `${path}.${name}`, around, d, id);
      if (inner) out[name] = inner;
    } else d.error("theme/schema", `${show(value)} isn't a token`, where, id);
  }
  return out;
}

/** The token paths a scope sets ("colors.background"), for the roles it applies to its own node. */
export function scopePaths(scope: Record<string, Json>): Set<string> {
  const out = new Set<string>();
  const visit = (group: TokenGroup, tree: Json, path: string) => {
    if (isToken(group, tree, false)) out.add(path);
    else if (isObject(tree)) for (const [name, value] of Object.entries(tree)) visit(group, value, `${path}.${name}`);
  };
  for (const group of TOKEN_GROUPS) if (scope[group] !== undefined) visit(group, scope[group], group);
  return out;
}

/** Each named style's and variant's name in a theme, for hints. */
export function themeNames(theme: ThemeData | undefined, type: string): { variants: string[]; styles: string[] } {
  const components = isObject(theme?.components) ? theme.components : {};
  const own = isObject(components[type]) ? (components[type] as Record<string, Json>) : {};
  return { variants: isObject(own.variants) ? Object.keys(own.variants) : [], styles: isObject(theme?.styles) ? Object.keys(theme.styles) : [] };
}

/** The style keys each built-in takes, for a check that a named style's key is a style somewhere. */
export type { StyleSpecs };
