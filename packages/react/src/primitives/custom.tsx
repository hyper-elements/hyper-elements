/**
 * Custom elements: a named block made of primitives, with its own typed
 * props and editors, kept as one node in the document and expanded when it's
 * rendered.
 */
import type React from "react";
import {
  asset,
  boolean,
  color,
  blocks,
  date,
  defineCustomComponent,
  enumOf,
  fontFamily,
  fontWeight,
  formatDiagnostics,
  length,
  link,
  list,
  number,
  object,
  prop as defineProp,
  text,
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

type PropOptions<K extends Kind<any, any>, R extends boolean, D> = Omit<PropSpec<K, R>, "kind" | "default"> & { default?: D };

/** A prop helper for one value kind: `required` and `default` keep their literal types, for `render`'s props. */
function kindProp<K extends Kind<any, any>>(make: () => K) {
  return <const R extends boolean = false, const D extends OutputOf<K> | undefined = undefined>(options: PropOptions<K, R, D>) => defineProp(make(), options);
}

declare const TAKES_TOKEN: unique symbol;
/** Type only: a prop whose kind takes a theme's token in JSX (a color, a length, a font), its value where the instance is. */
type TakesToken = { readonly [TAKES_TOKEN]: true };

/** A prop helper for a kind that takes a theme's token. */
function tokenProp<K extends Kind<any, any>>(make: () => K) {
  return <const R extends boolean = false, const D extends OutputOf<K> | undefined = undefined>(options: PropOptions<K, R, D>) => defineProp(make(), options) as ReturnType<typeof defineProp<K, R, D>> & TakesToken;
}

// ─── Composed values: lists and objects of fields ───────────────────────────

/** A spec that's a list of one item spec (`prop.list()`), which it keeps whole. */
export type ListSpec<I extends PropSpec = PropSpec> = PropSpec & { item: I };
/** A spec that's an object of field specs (`prop.object()`), which it keeps whole. */
export type ObjectSpec<F extends PropSpecs = PropSpecs> = PropSpec & { fields: F };

type Given<S> = Exclude<S extends { required?: infer R } ? R : never, undefined> extends true ? true : false;
type Defaulted<S> = S extends { default: infer D } ? ([D] extends [undefined] ? false : true) : false;
/** Whether a field always has a value once read: it's required, it has a default, or it's a list (none is `[]`). */
type Always<S> = Given<S> extends true ? true : S extends { item: PropSpec } | { blocks: object } ? true : Defaulted<S>;

/** A block's value: its `type`, and its object spec's fields' values. */
type BlockValue<B> = { [K in keyof B]: B[K] extends { fields: infer G extends PropSpecs } ? { type: K } & FieldValues<G> : never }[keyof B];
type BlockInput<B> = { [K in keyof B]: B[K] extends { fields: infer G extends PropSpecs } ? { type: K } & FieldInputs<G> : never }[keyof B];
/** A spec that's a list of blocks (`prop.blocks()`), keeping each block type's object spec. */
export type BlocksSpec<B extends Record<string, ObjectSpec> = Record<string, ObjectSpec>> = PropSpec & { blocks: B };

/** A field's value once read: a list's an array of its item's, an object's its fields' (`FieldValues`). */
export type FieldValue<S> = S extends { blocks: infer B } ? Array<BlockValue<B>> : S extends { item: infer I } ? Array<FieldValue<I>> : S extends { fields: infer G extends PropSpecs } ? FieldValues<G> : S extends PropSpec<infer K> ? OutputOf<K> : never;
/** Fields' values once read: each that always has one (required, defaulted, or a list) present, the rest optional. */
export type FieldValues<F extends PropSpecs> = { [K in keyof F as Always<F[K]> extends true ? K : never]: FieldValue<F[K]> } & {
  [K in keyof F as Always<F[K]> extends true ? never : K]?: FieldValue<F[K]>;
};
/** A field's value as it's given. */
export type FieldInput<S> = S extends { blocks: infer B } ? ReadonlyArray<BlockInput<B>> : S extends { item: infer I } ? ReadonlyArray<FieldInput<I>> : S extends { fields: infer G extends PropSpecs } ? FieldInputs<G> : S extends PropSpec<infer K> ? InputOf<K> : never;
/** Fields' values as they're given: the required ones must be. */
export type FieldInputs<F extends PropSpecs> = { [K in keyof F as Given<F[K]> extends true ? K : never]: FieldInput<F[K]> } & {
  [K in keyof F as Given<F[K]> extends true ? never : K]?: FieldInput<F[K]>;
};

type ComposedOptions<R extends boolean> = Omit<PropSpec<Kind<any, any>, R>, "kind" | "default">;

/** Props of a custom element, and a template's fields, by value kind. */
export const prop = {
  /** Text: at most `maxLength` characters, and with `pattern` (a regular expression's source, matched with `u`), text it finds something in. */
  text: <const R extends boolean = false, const D extends string | undefined = undefined>(options: PropOptions<Kind<string, string>, R, D> & { maxLength?: number; pattern?: string }) => {
    const { maxLength, pattern, ...rest } = options;
    // Compiled once, with only `u`: a `g` or `y` flag would make the same text pass, then fail (test() keeps its place).
    return defineProp(text({ maxLength, ...(pattern !== undefined ? { pattern: new RegExp(pattern, "u") } : {}) }), rest);
  },
  /** A calendar date, as YYYY-MM-DD ("2026-12-03"). */
  date: kindProp(() => date()),
  /**
   * A list of `item`s, with as few as `min` and as many as `max`. In a template, one not given is `[]` (its `min`
   * applies to that too). The spec keeps `item` whole, so a template reads its rules (an image's).
   */
  list: <const I extends PropSpec, const R extends boolean = false>(item: I, options: ComposedOptions<R> & { min?: number; max?: number }) => {
    const { min, max, ...rest } = options;
    const spec = defineProp(list(item.kind, { min, max }), rest);
    return { ...spec, item } as unknown as PropSpec<Kind<ReadonlyArray<FieldInput<I>>, Array<FieldValue<I>> & Json[]>, R> & { default: undefined; item: I };
  },
  /**
   * A list of blocks the filler picks, orders and fills: each `{ type, …its fields }`, its type one of `types` (each a
   * `prop.object()` spec). A block type can't have a field named `type`. The spec keeps `blocks` whole.
   */
  blocks: <const B extends Record<string, ObjectSpec>, const R extends boolean = false>(types: B, options: ComposedOptions<R> & { min?: number; max?: number }) => {
    const { min, max, ...rest } = options;
    const kind = blocks(Object.fromEntries(Object.entries(types).map(([name, spec]) => [name, spec.kind])), { min, max });
    return { ...defineProp(kind, rest), blocks: types } as unknown as PropSpec<Kind<ReadonlyArray<BlockInput<B>>, Array<BlockValue<B>> & Json[]>, R> & { default: undefined; blocks: B };
  },
  /** An object of named fields (a story's title, link and image). The spec keeps `fields` whole. */
  object: <const F extends PropSpecs, const R extends boolean = false>(fields: F, options: ComposedOptions<R>) => {
    const kind = object(Object.fromEntries(Object.entries(fields).map(([name, spec]) => [name, { kind: spec.kind, ...(spec.required ? { required: true } : {}), ...(spec.default !== undefined ? { default: spec.default } : {}) }])));
    return { ...defineProp(kind, options), fields } as unknown as PropSpec<Kind<FieldInputs<F>, FieldValues<F> & Json>, R> & { default: undefined; fields: F };
  },
  color: tokenProp(() => color()),
  image: kindProp(() => asset()),
  link: kindProp(() => link()),
  boolean: kindProp(() => boolean()),
  fontFamily: tokenProp(() => fontFamily()),
  fontWeight: kindProp(() => fontWeight()),
  number: <const R extends boolean = false, const D extends number | undefined = undefined>(
    options: PropOptions<Kind<number, number>, R, D> & { min?: number; max?: number; integer?: boolean }
  ) => {
    const { min, max, integer, ...rest } = options;
    return defineProp(number({ min, max, integer }), rest);
  },
  length: <const U extends LengthUnit = "px", const R extends boolean = false, const D extends OutputOf<ReturnType<typeof length<U>>> | undefined = undefined>(
    options: PropOptions<ReturnType<typeof length<U>>, R, D> & { units?: readonly U[]; min?: number }
  ) => {
    const { units, min, ...rest } = options;
    return defineProp<ReturnType<typeof length<U>>, R, D>(length<U>(units, { min }), rest) as ReturnType<typeof defineProp<ReturnType<typeof length<U>>, R, D>> & TakesToken;
  },
  choice: <const V extends readonly (string | number)[], const R extends boolean = false, const D extends V[number] | undefined = undefined>(
    values: V,
    options: PropOptions<Kind<V[number], V[number]>, R, D>
  ) => defineProp(enumOf(values), options),
};

/** A prop's value in JSX: a color's, a length's or a font's may be a theme's token, its value where the instance is. */
type WithTokens<T, P> = { [K in keyof T]: K extends keyof P ? (P[K] extends TakesToken ? T[K] | Token : T[K]) : T[K] };

/** What a custom element takes in JSX: its props, and its place in a Row and its visibility. */
export type CustomProps<P extends PropSpecs> = WithTokens<PropsInput<P>, P> & {
  id?: string;
  style?: { flex?: number | "none" };
  hidden?: { mobile?: boolean; desktop?: boolean };
};

/** An element of your own, made with `defineElement()`: in JSX, `<PriceBand price={24} />`. */
export type CustomElement<P extends PropSpecs> = React.FC<CustomProps<P>> & { definition: CustomDefinition<P> };

/** What `defineElement()` takes. */
export interface ElementSpec<P extends PropSpecs> {
  /** A namespace, a dot, a capitalized name: "acme.ProductCard". */
  type: string;
  label: string;
  description?: string;
  props: P;
  /** Where it goes: where a block goes (default), or where a Section goes (and it renders a Section). */
  placement?: "block" | "section";
  /**
   * The element as primitives, from its props (normalized, defaults applied), and the theme's tokens where the
   * instance is (its scopes' over the theme's, as values), for values a render derives. Pure: no hooks or data, so it
   * can be rendered anywhere. Returns one element.
   */
  render(props: ExpandProps<P>, context: RenderContext): React.ReactElement;
}

/** What a custom element's render gets besides its props. */
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

/**
 * Defines an element of your own: a named block made of other elements, with its own typed props.
 *
 *     const PriceBand = defineElement({
 *       type: "acme.PriceBand",
 *       label: "Price band",
 *       props: { price: prop.number({ label: "Price", min: 0 }) },
 *       render: ({ price }) => <Text>{`$${price}`}</Text>,
 *     });
 */
export function defineElement<const P extends PropSpecs>(spec: ElementSpec<P>): CustomElement<P> {
  // Read once, now: changing the spec afterwards (its render included) changes nothing rendered.
  const render = spec.render;
  const definition = defineCustomComponent({
    type: spec.type,
    label: spec.label,
    description: spec.description,
    props: spec.props,
    placement: spec.placement,
    expand(props, context) {
      const { nodes, components, diagnostics } = collectNodes(render(props, { theme: ((context as { theme?: unknown }).theme ?? {}) as ThemeValues }));
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
      throw new Error(`[Elements] <${definition.type}> is part of a design: render the design with render(), not this element on its own`);
    }
    registerUsed(collection, definition);
    return recordPrimitive(collection, definition.type, props as Record<string, unknown>);
  };
  Custom.displayName = definition.type;
  // Its definition can't be replaced, and is frozen itself.
  Object.defineProperty(Custom, "definition", { value: definition, enumerable: true });
  return Custom as CustomElement<P>;
}

/** @deprecated Renamed `defineElement()`: the same function. */
export const component = defineElement;
/** @deprecated Renamed `CustomElement`. */
export type CustomComponent<P extends PropSpecs> = CustomElement<P>;
/** @deprecated Renamed `ElementSpec`. */
export type ComponentSpec<P extends PropSpecs> = ElementSpec<P>;
