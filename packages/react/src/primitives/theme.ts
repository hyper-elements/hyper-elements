/**
 * Themes in templates: `defineTheme()` makes one (data: colors, sizes, line heights, fonts and radii as tokens, defaults for each
 * component, variants, named styles, and overrides for one kind of root), a root takes it with `theme`, and a template
 * refers to its tokens with `token()`. Registering a theme (`interface Register { theme: typeof brand }`) types every
 * token's path, named style and variant; without one they're strings, checked when the template is read.
 */
import { mergeTheme, type Json } from "@hyper-elements/core";

/**
 * Register a theme to type its names everywhere:
 *
 * ```ts
 * declare module "@hyper-elements/react" {
 *   interface Register { theme: typeof brand }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Register {}

/** The registered theme, if there is one. */
export type RegisteredTheme = Register extends { theme: infer T } ? T : undefined;

/** A reference to a theme's token, in a template: `token("colors.primary")`. */
export interface Token<P extends string = string> {
  readonly $token: P;
}

type Corner = "topLeft" | "topRight" | "bottomRight" | "bottomLeft";
type Group = "colors" | "spacing" | "fontSizes" | "lineHeights" | "fonts" | "radii";

/** Whether a value in a token group is a token (not a group): the same grammar as when a theme is read. */
type IsToken<V, G> = V extends string | number | readonly unknown[] ? true : V extends { $token: string } ? true : G extends "radii" ? ([Exclude<keyof V, Corner>] extends [never] ? true : false) : false;
/** An object of `base` and modes: not a token, and not a group (refused when it's read). */
type IsModes<V> = V extends object ? ([Exclude<keyof V, "base" | "dark">] extends [never] ? true : false) : false;

type PathsIn<T, G, Prefix extends string> = {
  [K in keyof T & (string | number)]: IsModes<T[K]> extends true ? never : IsToken<T[K], G> extends true ? `${Prefix}.${K}` : PathsIn<T[K], G, `${Prefix}.${K}`>;
}[keyof T & (string | number)];

/** Every token's path in a theme: "colors.primary", "colors.gray.900". */
export type TokenPaths<T> = { [G in Group & keyof T]: PathsIn<T[G], G, G> }[Group & keyof T];

/** The token paths `token()` takes: the registered theme's, else any string. */
export type TokenPath = RegisteredTheme extends undefined ? string : TokenPaths<RegisteredTheme>;

/** A named style's name: the registered theme's, else any string. */
export type StyleName = RegisteredTheme extends undefined ? string : RegisteredTheme extends { styles: infer S } ? keyof S & string : never;

/** The variants' names a theme's type gives an element under one key (`elements`, or `components`, its name before). */
type VariantsUnder<T, K extends string, C extends string> = T extends { [G in K]: infer Defaults }
  ? C extends keyof Defaults
    ? Defaults[C] extends { variants: infer V }
      ? keyof V & string
      : never
    : never
  : never;

/**
 * A variant's name for an element: the registered theme's, else any string. Its variants under either key, as the
 * theme merges them; for each element named (`VariantName<"Button" | "Heading">` is either's).
 */
export type VariantName<C extends string> = RegisteredTheme extends undefined
  ? string
  : C extends string
    ? VariantsUnder<RegisteredTheme, "elements", C> | VariantsUnder<RegisteredTheme, "components", C>
    : never;

/** A component's `variant` prop: a name, or a list merged in order. */
export type VariantProp<C extends string> = VariantName<C> | readonly VariantName<C>[];

/** A value where a template may give a token instead: at the top, and in any part of an object or array form. */
export type Tokenized<T> = T extends readonly unknown[] ? { readonly [K in keyof T]: Tokenized<T[K]> } | Token : T extends object ? { [K in keyof T]: Tokenized<T[K]> } | Token : T | Token;

/** A reference inside a theme: the W3C Design Tokens format's alias, `"{colors.primary}"`. */
export type Alias = `{${string}}`;

type TokenTree = { [name: string]: string | number | readonly (string | number)[] | Alias | Token | { [key: string]: unknown } };

/** A style in a theme: styles (a value, or an alias anywhere in it), `apply`, and phone and hover blocks. */
export type ThemeStyle = { apply?: readonly string[]; mobile?: { [style: string]: unknown }; hover?: { [style: string]: unknown }; [style: string]: unknown };

/** An element's defaults in a theme: its style, by one prop's value (`by`), and its variants. */
export type ElementTheme = ThemeStyle & {
  by?: { [prop: string]: { [value: string]: ThemeStyle } };
  variants?: { [name: string]: ThemeStyle };
};
/** @deprecated Renamed `ElementTheme`. */
export type ComponentTheme = ElementTheme;

/** What `defineTheme()` takes. */
export interface ThemeInput {
  colors?: TokenTree;
  spacing?: TokenTree;
  fontSizes?: TokenTree;
  lineHeights?: TokenTree;
  fonts?: TokenTree;
  radii?: TokenTree;
  /** Each built-in element's defaults: its style, by one prop's value (`by`), and its variants. */
  elements?: { [type: string]: ElementTheme };
  /** @deprecated Renamed `elements`. Still read; given with it, an element in `elements` wins. */
  components?: { [type: string]: ElementTheme };
  styles?: { [name: string]: ThemeStyle };
  formats?: { email?: Omit<ThemeInput, "formats">; page?: Omit<ThemeInput, "formats">; document?: Omit<ThemeInput, "formats">; canvas?: Omit<ThemeInput, "formats"> };
}

type TokenRefsIn<T, G, Prefix extends string> = {
  readonly [K in keyof T & (string | number)]: IsModes<T[K]> extends true ? never : IsToken<T[K], G> extends true ? Token<`${Prefix}.${K}`> : TokenRefsIn<T[K], G, `${Prefix}.${K}`>;
};

/** A theme's tokens as references, typed: `brand.tokens.colors.primary` is `token("colors.primary")`. */
export type TokenRefs<T> = { readonly [G in Group & keyof T]: TokenRefsIn<T[G], G, G> };

/** A theme: its data, and `tokens`, references to them (not part of its data). */
export type Theme<T = ThemeInput> = T & { readonly tokens: TokenRefs<T> };

/**
 * One theme's type with another's merged over it, as `extendTheme()` merges them: objects key by key at every depth,
 * anything else (a list, a value) replaced. Not `B & O`, where a value both set ("#000000" and "#ffffff") is `never`.
 */
type Merged<B, O> = [O] extends [readonly unknown[]]
  ? O
  : [B] extends [readonly unknown[]]
    ? O
    : [B, O] extends [object, object]
      ? { [K in keyof B | keyof O]: K extends keyof O ? (K extends keyof B ? Merged<B[K], O[K]> : O[K]) : K extends keyof B ? B[K] : never }
      : O;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function freeze<T>(value: T): T {
  if (isObject(value) || Array.isArray(value)) {
    for (const inner of Object.values(value)) freeze(inner);
    Object.freeze(value);
  }
  return value;
}

function clone(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(clone);
  if (isObject(value)) return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, clone(inner)]));
  return value;
}

const GROUPS: readonly Group[] = ["colors", "spacing", "fontSizes", "lineHeights", "fonts", "radii"];

/** References to every token in a theme, by path. */
function refs(theme: Record<string, unknown>): Record<string, unknown> {
  const visit = (tree: unknown, path: string): unknown => {
    if (!isObject(tree) || "$token" in tree || (path.startsWith("radii") && Object.keys(tree).every((key) => ["topLeft", "topRight", "bottomRight", "bottomLeft"].includes(key)))) return token(path);
    return Object.fromEntries(Object.entries(tree).map(([name, value]) => [name, visit(value, `${path}.${name}`)]));
  };
  return Object.fromEntries(GROUPS.filter((group) => isObject(theme[group])).map((group) => [group, visit(theme[group], group)]));
}

/**
 * A theme: tokens (`colors`, `spacing`, `fontSizes`, `lineHeights`, `fonts`, `radii`), each element's defaults (`elements`, with
 * `by` one prop's value and `variants`), named styles (`styles`), and overrides for one kind of root (`formats`).
 * Inside a theme, a token refers to another as `"{colors.primary}"`. Data, frozen; a root takes it with `theme`.
 */
export function defineTheme<const T extends ThemeInput>(theme: T): Theme<T> {
  const data = clone(theme) as Record<string, unknown>;
  Object.defineProperty(data, "tokens", { value: freeze(refs(data)), enumerable: false });
  return freeze(data) as unknown as Theme<T>;
}

/**
 * A theme with another merged over it (a brand's or a customer's over a shared one): objects key by key at every depth,
 * anything else (a list) replaced. An override can't remove a key.
 */
export function extendTheme<const B extends ThemeInput, const O extends ThemeInput>(base: B, overrides: O): Theme<Merged<B, O>> {
  // Each name is merged with its own (`elements` with `elements`, `components` with `components`), as its type says: an
  // element given under both is put under one where the theme is read.
  return defineTheme(mergeTheme(clone(base) as Json, clone(overrides) as Json) as ThemeInput) as unknown as Theme<Merged<B, O>>;
}

/** A reference to the theme's token at `path` ("colors.primary"), for a style or a prop: its value where it's used. */
export function token<const P extends TokenPath>(path: P): Token<P> {
  return Object.freeze({ $token: path }) as Token<P>;
}
