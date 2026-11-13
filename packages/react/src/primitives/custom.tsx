/**
 * Custom components: a named block made of primitives, with its own typed
 * props and editors, kept as one node in the document and expanded when it's
 * rendered.
 */
import type React from "react";
import {
  asset,
  boolean,
  color,
  defineCustomComponent,
  enumOf,
  fontFamily,
  fontWeight,
  formatDiagnostics,
  length,
  link,
  number,
  prop as defineProp,
  text,
  OWN_EDITOR,
  type CustomDefinition,
  type ExpandProps,
  type InputOf,
  type Json,
  type Kind,
  type LengthUnit,
  type OutputOf,
  type PropSpec,
  type PropSpecs,
  type PropsInput,
} from "@hyper-elements/core";
import { collectingPrimitives, collectNodes, recordPrimitive, registerUsed } from "./collect";
import type { Token } from "./theme";

/**
 * What a prop's helper takes besides what its kind does: what the prop is called, whether it's required, its default.
 * A component's prop has a label; an option of a property of a team's own (`defineProperty()`) needs none.
 */
type PropOptions<K extends Kind<any, any>, R extends boolean, D, L extends string | undefined> = Omit<PropSpec<K, R>, "kind" | "default" | "label" | "editor"> & {
  label?: L;
  default?: D;
  /** One of the editing app's own editors, by its name, where the kind's own isn't the one wanted (`"counter"`). */
  editor?: string;
};

/**
 * What a helper makes. `required`, `default` and `label` keep their literal types: the first two for `render`'s props,
 * the last so a component's prop with no label is an error where it's written.
 */
type Made<K extends Kind<any, any>, R extends boolean, D, L> = Omit<PropSpec<K, R>, "default" | "label"> & { default: D; label: Said<L> };
/** The label as it's given, and nothing else: where a prop is written in a component's `props`, that it's a prop there doesn't make it one with a label. */
type Said<L> = [L][L extends any ? 0 : never];

declare const TAKES_TOKEN: unique symbol;
/** Type only: a prop whose kind takes a theme's token in JSX (a color, a length, a font), its value where the instance is. */
type TakesToken = { readonly [TAKES_TOKEN]: true };

/** A helper for one value kind. `X` is what it takes besides (a number's `min`; a property's own options). */
type KindHelper<K extends Kind<any, any>, X = unknown, Mark = unknown> = <const R extends boolean = false, const D extends OutputOf<K> | undefined = undefined, const L extends string | undefined = undefined>(
  options: PropOptions<K, R, D, L> & X
) => Made<K, R, D, L> & Mark;

/** A text's kind: any text, or one of the texts its `enum` lists. */
type TextKind<V> = V extends readonly string[] ? Kind<V[number], V[number]> : Kind<string, string>;
type LengthKind<U extends LengthUnit> = ReturnType<typeof length<U>>;

/** `prop`'s helpers a property of a team's own can be made on (`defineProperty()`'s `base`), each taking `X` besides. */
interface Helpers<X = unknown> {
  text: <const V extends readonly string[] | undefined = undefined, const R extends boolean = false, const D extends OutputOf<TextKind<V>> | undefined = undefined, const L extends string | undefined = undefined>(
    options: PropOptions<TextKind<V>, R, D, L> & { /** The texts it may be, where it's one of a few. */ enum?: V } & X
  ) => Made<TextKind<V>, R, D, L>;
  color: KindHelper<ReturnType<typeof color>, X, TakesToken>;
  image: KindHelper<ReturnType<typeof asset>, X>;
  link: KindHelper<ReturnType<typeof link>, X>;
  boolean: KindHelper<ReturnType<typeof boolean>, X>;
  fontFamily: KindHelper<ReturnType<typeof fontFamily>, X, TakesToken>;
  fontWeight: KindHelper<ReturnType<typeof fontWeight>, X>;
  number: KindHelper<Kind<number, number>, { min?: number; max?: number; integer?: boolean } & X>;
  length: <const U extends LengthUnit = "px", const R extends boolean = false, const D extends OutputOf<LengthKind<U>> | undefined = undefined, const L extends string | undefined = undefined>(
    options: PropOptions<LengthKind<U>, R, D, L> & { units?: readonly U[]; min?: number } & X
  ) => Made<LengthKind<U>, R, D, L> & TakesToken;
}

declare const BASE: unique symbol;
/** Type only: which of `prop`'s helpers one is, so `defineProperty()` knows what its `base` makes. */
type Based<N> = { readonly [BASE]?: N };

type Given = { readonly [option: string]: any };
const made = (kind: Kind<any, any>, options: Given) => defineProp(kind, options as never);

const helpers = {
  text: ({ enum: values, ...rest }: Given) => {
    if (values !== undefined && !(Array.isArray(values) && values.length > 0 && values.every((value) => typeof value === "string"))) {
      throw new Error(`[Elements] A text's enum lists the texts it may be (["$", "€"]), not ${JSON.stringify(values)}`);
    }
    return made(values ? enumOf(values as readonly string[]) : text(), rest);
  },
  color: (options: Given) => made(color(), options),
  image: (options: Given) => made(asset(), options),
  link: (options: Given) => made(link(), options),
  boolean: (options: Given) => made(boolean(), options),
  fontFamily: (options: Given) => made(fontFamily(), options),
  fontWeight: (options: Given) => made(fontWeight(), options),
  number: ({ min, max, integer, ...rest }: Given) => made(number({ min, max, integer }), rest),
  length: ({ units, min, ...rest }: Given) => made(length(units, { min }), rest),
};

/** Props of a custom component, by value kind. */
export const prop = {
  ...helpers,
  choice: (values: readonly (string | number)[], options: Given) => made(enumOf(values), options),
} as unknown as { [N in keyof Helpers]: Helpers[N] & Based<N> } & {
  choice: <const V extends readonly (string | number)[], const R extends boolean = false, const D extends V[number] | undefined = undefined, const L extends string | undefined = undefined>(
    values: V,
    options: PropOptions<Kind<V[number], V[number]>, R, D, L>
  ) => Made<Kind<V[number], V[number]>, R, D, L>;
};

/** What every helper takes, and what some take besides: a property's own options are named otherwise. */
const EVERY = ["label", "description", "required", "default", "roots", "editable", "support"];
const BESIDES: { readonly [base: string]: readonly string[] } = { text: ["enum"], number: ["min", "max", "integer"], length: ["units", "min"] };

/** A property's own options, each made with one of `prop`'s helpers. */
type OptionSpecs = { readonly [option: string]: { readonly kind: Kind<any, any>; readonly required?: boolean; readonly default?: unknown } };
type Needed<O extends OptionSpecs> = { [K in keyof O]: Exclude<O[K]["required"], undefined> extends true ? K : never }[keyof O];
type Held<O extends OptionSpecs> = { [K in keyof O]: Exclude<O[K]["required"], undefined> extends true ? K : [O[K]["default"]] extends [undefined] ? never : K }[keyof O];
/** A property's own options as a prop gives them: a required one must be given. A prop made of one names no other editor. */
type OptionsInput<O extends OptionSpecs> = { [K in Needed<O>]: InputOf<O[K]["kind"]> } & { [K in Exclude<keyof O, Needed<O>>]?: InputOf<O[K]["kind"]> } & { editor?: never; editorOptions?: never };
/** And as its editor is given them: one that's required or has a default is always there. */
type OptionsOf<O extends OptionSpecs> = { [K in Held<O>]: OutputOf<O[K]["kind"]> } & { [K in Exclude<keyof O, Held<O>>]?: OutputOf<O[K]["kind"]> };
/** The value a property made on a helper holds. */
type Value<N extends keyof Helpers> = OutputOf<ReturnType<Helpers[N]>["kind"]>;

/**
 * A property of a team's own: one of `prop`'s helpers with an editor of the team's own, and what that editor takes. As
 * a template knows it, it's data (its name, the helper it's made on, its options), with no control: that's each editing
 * app's, registered under the name (in Unlayer's builder, `registerTools()`'s `editors`), so a template renders with
 * none. Called, it's a prop: `price: currency({ label: "Price", min: 0, symbol: "$" })`.
 */
export interface PropertyDefinition<V = any, O = { [option: string]: Json }> {
  /** A namespace, a dot, a word: "acme.currency". What an editing app registers its editor under. */
  readonly name: string;
  /** The helper of `prop` it's made on, by its name: "number". */
  readonly base: keyof Helpers;
  /** Its own options, each as it's defined. */
  readonly options: OptionSpecs;
  /** Type only: the value its editor is given, and its options as a prop has them. */
  readonly _editor?: { value: V; options: O };
}

/**
 * Defines a property of a team's own:
 *
 *     const currency = defineProperty({
 *       name: "acme.currency",
 *       base: prop.number,
 *       options: { symbol: prop.text({ enum: ["$", "€", "£"], default: "$" }) },
 *     });
 *
 * then `price: currency({ label: "Price", min: 0, symbol: "€" })`. The prop is its base's: a number, with a number's own
 * limits, whoever writes it. Its own options say how it's edited, each checked by its kind as a prop is.
 */
export function defineProperty<const N extends keyof Helpers, const O extends OptionSpecs = {}>(definition: { name: string; base: Based<N>; options?: O }): Helpers<OptionsInput<O>>[N] & PropertyDefinition<Value<N>, OptionsOf<O>> {
  const { name } = definition;
  const specs: OptionSpecs = definition.options ?? {};
  if (!OWN_EDITOR.test(String(name))) throw new Error(`[Elements] A property's name is a namespace, a dot and a word ("acme.currency"), not ${JSON.stringify(name)}`);
  const base = (Object.keys(helpers) as Array<keyof typeof helpers>).find((helper) => helpers[helper] === (definition.base as unknown));
  if (!base) {
    throw new Error(`[Elements] The property ${name} is made on one of prop's helpers (${Object.keys(helpers).map((helper) => `prop.${helper}`).join(", ")})${(definition.base as unknown) === prop.choice ? ": for one of a few values, prop.text with an enum" : ""}`);
  }
  const taken = [...EVERY, ...(BESIDES[base] ?? [])];
  for (const [option, spec] of Object.entries(specs) as Array<[string, OptionSpecs[string] | undefined]>) {
    if (taken.includes(option) || option === "editor" || option === "editorOptions") throw new Error(`[Elements] The property ${name} can't have an option named ${option}: that's its prop's`);
    if (typeof spec?.kind?.parse !== "function") throw new Error(`[Elements] The property ${name}: its option ${option} is made with one of prop's helpers (prop.text({ default: "$" })), not ${JSON.stringify(spec)}`);
    if (spec.default !== undefined) {
      const parsed = spec.kind.parse(spec.default);
      if (!parsed.ok) throw new Error(`[Elements] The property ${name}: the default of its option ${option}: ${parsed.message}`);
    }
  }
  const own = Object.keys(specs);
  const use = (given: Given = {}) => {
    const rest: { [option: string]: unknown } = {};
    for (const [key, value] of Object.entries(given)) {
      if (Object.prototype.hasOwnProperty.call(specs, key)) continue;
      if (key === "editor" || key === "editorOptions") throw new Error(`[Elements] The property ${name} is edited with its own editor: it takes no ${key}`);
      if (!taken.includes(key)) throw new Error(`[Elements] The property ${name} has no option named ${key} (it ${own.length ? `has ${own.join(", ")}, beside what` : "takes what"} prop.${base} takes)`);
      rest[key] = value;
    }
    const options: { [option: string]: Json } = {};
    for (const [option, spec] of Object.entries(specs)) {
      const value: unknown = given[option] ?? spec.default;
      if (value === undefined) {
        if (spec.required) throw new Error(`[Elements] The property ${name} needs its ${option}`);
        continue;
      }
      const parsed = spec.kind.parse(value);
      if (!parsed.ok) throw new Error(`[Elements] The property ${name}: its ${option}: ${parsed.message}`);
      options[option] = parsed.value;
    }
    const spec = helpers[base](rest);
    // (Its editor is said by its kind's: what an app with no editor by this name shows.)
    return { ...spec, editor: { name, edits: spec.kind.editor, options } };
  };
  // (A function's own name is its definition's.)
  return Object.defineProperties(use, { name: { value: name }, base: { value: base }, options: { value: specs } }) as never;
}

/** A prop's value in JSX: a color's, a length's or a font's may be a theme's token, its value where the instance is. */
type WithTokens<T, P> = { [K in keyof T]: K extends keyof P ? (P[K] extends TakesToken ? T[K] | Token : T[K]) : T[K] };

/** What a custom component takes in JSX: its props, and its place in a Row and its visibility. */
export type CustomProps<P extends PropSpecs> = WithTokens<PropsInput<P>, P> & {
  id?: string;
  style?: { flex?: number | "none" };
  hidden?: { mobile?: boolean; desktop?: boolean };
};

export type CustomComponent<P extends PropSpecs> = React.FC<CustomProps<P>> & { definition: CustomDefinition<P> };

export interface ComponentSpec<P extends PropSpecs> {
  /** A namespace, a dot, a capitalized name: "acme.ProductCard". */
  type: string;
  label: string;
  description?: string;
  props: P;
  /** Where it goes: where a block goes (default), or where a Section goes (and it renders a Section). */
  placement?: "block" | "section";
  /**
   * The component as primitives, from its props (normalized, defaults applied), and the theme's tokens where the
   * instance is (its scopes' over the theme's, as values), for values a render derives. Pure: no hooks or data, so it
   * can be rendered anywhere. Returns one component.
   */
  render(props: ExpandProps<P>, context: RenderContext): React.ReactElement;
}

/** What a template's own component's render gets besides its props. */
export interface RenderContext {
  /** The theme's tokens where the instance is, as values: `theme.colors.primary`. Empty without a theme. */
  readonly theme: ThemeValues;
}

/** A theme's tokens as values, by group. */
export interface ThemeValues {
  readonly colors?: { readonly [name: string]: unknown };
  readonly spacing?: { readonly [name: string]: unknown };
  readonly fontSizes?: { readonly [name: string]: unknown };
  readonly lineHeights?: { readonly [name: string]: unknown };
  readonly fonts?: { readonly [name: string]: unknown };
  readonly radii?: { readonly [name: string]: unknown };
}

export function component<const P extends PropSpecs>(spec: ComponentSpec<P>): CustomComponent<P> {
  const definition = defineCustomComponent({
    type: spec.type,
    label: spec.label,
    description: spec.description,
    props: spec.props,
    placement: spec.placement,
    expand(props, context) {
      const { nodes, components, diagnostics } = collectNodes(spec.render(props, { theme: ((context as { theme?: unknown }).theme ?? {}) as ThemeValues }));
      for (const used of components) context.register(used);
      // An error stops it; a warning or a note (a deprecated prop) is said at the instance's place.
      if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) throw new Error(formatDiagnostics(diagnostics));
      for (const diagnostic of diagnostics) context.report(diagnostic);
      return nodes.length === 1 ? nodes[0] : nodes;
    },
  });
  const Custom = (props: CustomProps<P>): React.ReactElement => {
    const collection = collectingPrimitives();
    if (!collection) {
      throw new Error(`[Elements] <${spec.type}> is part of a template: render the template with render(), not this component on its own`);
    }
    registerUsed(collection, definition);
    return recordPrimitive(collection, spec.type, props as Record<string, unknown>);
  };
  Custom.displayName = spec.type;
  return Object.assign(Custom, { definition });
}
