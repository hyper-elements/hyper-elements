/**
 * `prop`: the helpers an element's props and a template's fields are made with, one per value kind, and lists, lists
 * of blocks and objects of them. Each describes a value and its limits, checked by its kind; nothing here renders.
 * This folder imports only the engine, never React or the render that collects a design (`properties.test.ts`).
 */
import {
  asset,
  blocks,
  boolean,
  color,
  date,
  enumOf,
  fontFamily,
  fontWeight,
  length,
  link,
  list,
  number,
  object,
  prop as defineProp,
  text,
  type InputOf,
  type Json,
  type Kind,
  type LengthUnit,
  type OutputOf,
  type PropSpec,
  type PropSpecs,
} from "@hyper-elements/core";

/**
 * What a prop's helper takes besides what its kind does: what the prop is called, whether it's required, its default.
 * An element's prop has a label; an option of a property of a team's own (`defineProperty()`) needs none. There's no
 * editor to name: a prop is edited with its kind's, or is a property of a team's own.
 */
type PropOptions<K extends Kind<any, any>, R extends boolean, D, L extends string | undefined> = Omit<PropSpec<K, R>, "kind" | "default" | "label" | "editor"> & {
  label?: L;
  default?: D;
};

/**
 * What a helper makes. `required`, `default` and `label` keep their literal types: the first two for `render`'s props,
 * the last so an element's prop with no label is an error where it's written.
 */
type Made<K extends Kind<any, any>, R extends boolean, D, L> = Omit<PropSpec<K, R>, "default" | "label"> & { default: D; label: Said<L> };
/** The label as it's given, and nothing else: where a prop is written in an element's `props`, that it's a prop there doesn't make it one with a label. */
type Said<L> = [L][L extends any ? 0 : never];

declare const TAKES_TOKEN: unique symbol;
/** Type only: a prop whose kind takes a theme's token in JSX (a color, a length, a font), its value where the instance is. */
export type TakesToken = { readonly [TAKES_TOKEN]: true };

/** A helper for one value kind. `X` is what it takes besides (a number's `min`; a property's own options). */
type KindHelper<K extends Kind<any, any>, X = unknown, Mark = unknown> = <const R extends boolean = false, const D extends OutputOf<K> | undefined = undefined, const L extends string | undefined = undefined>(
  options: PropOptions<K, R, D, L> & X
) => Made<K, R, D, L> & Mark;

/** A text's kind: any text, or one of the texts its `enum` lists. */
type TextKind<V> = V extends readonly string[] ? Kind<V[number], V[number]> : Kind<string, string>;
type LengthKind<U extends LengthUnit> = ReturnType<typeof length<U>>;

/**
 * `prop`'s helpers a property of a team's own can be made on (`defineProperty()`'s `base`), each taking `X` besides
 * and making its prop with `Mark` besides (a property's: which property it is).
 */
export interface Helpers<X = unknown, Mark = unknown> {
  /** Text: at most `maxLength` characters, and with `pattern` (a regular expression's source, matched with `u`), text it finds something in; or one of the texts its `enum` lists. */
  text: <const V extends readonly string[] | undefined = undefined, const R extends boolean = false, const D extends OutputOf<TextKind<V>> | undefined = undefined, const L extends string | undefined = undefined>(
    options: PropOptions<TextKind<V>, R, D, L> & { /** The texts it may be, where it's one of a few. */ enum?: V; maxLength?: number; pattern?: string } & X
  ) => Made<TextKind<V>, R, D, L> & Mark;
  /** A calendar date, as YYYY-MM-DD ("2026-12-03"). */
  date: KindHelper<ReturnType<typeof date>, X, Mark>;
  color: KindHelper<ReturnType<typeof color>, { /** Whether it may be see-through (default true): with false, an rgba, an 8-digit hex or "transparent" is refused. */ transparency?: boolean } & X, TakesToken & Mark>;
  image: KindHelper<ReturnType<typeof asset>, X, Mark>;
  link: KindHelper<ReturnType<typeof link>, X, Mark>;
  boolean: KindHelper<ReturnType<typeof boolean>, X, Mark>;
  fontFamily: KindHelper<ReturnType<typeof fontFamily>, X, TakesToken & Mark>;
  fontWeight: KindHelper<ReturnType<typeof fontWeight>, X, Mark>;
  number: KindHelper<Kind<number, number>, { min?: number; max?: number; integer?: boolean } & X, Mark>;
  length: <const U extends LengthUnit = "px", const R extends boolean = false, const D extends OutputOf<LengthKind<U>> | undefined = undefined, const L extends string | undefined = undefined>(
    options: PropOptions<LengthKind<U>, R, D, L> & { units?: readonly U[]; min?: number } & X
  ) => Made<LengthKind<U>, R, D, L> & TakesToken & Mark;
}

declare const BASE: unique symbol;
/** Type only: which of `prop`'s helpers one is, so `defineProperty()` knows what its `base` makes. */
export type Based<N> = { readonly [BASE]?: N };

export type Given = { readonly [option: string]: any };
const made = (kind: Kind<any, any>, options: Given) => defineProp(kind, options as never);

/** What every helper takes, and what some take besides: a property's own options are named otherwise. */
export const EVERY = ["label", "description", "guidance", "required", "default", "roots", "editable", "support"];
export const BESIDES: { readonly [helper: string]: readonly string[] } = {
  text: ["enum", "maxLength", "pattern"],
  color: ["transparency"],
  number: ["min", "max", "integer"],
  length: ["units", "min"],
  list: ["min", "max"],
  blocks: ["min", "max"],
};

/**
 * What a helper is given, where it takes all of it. One it doesn't take is refused where it's written, as a type error
 * is, for a caller with no types: a name mistyped would be dropped without a word. An editor named by its name is one
 * of those: a prop is edited with its kind's editor, or is a property of a team's own.
 */
function takes(helper: string, given: Given | undefined): Given {
  const taken = [...EVERY, ...(BESIDES[helper] ?? [])];
  for (const key of Object.keys(given ?? {})) {
    if (key === "editor" || key === "editorOptions") {
      throw new Error(`[Elements] prop.${helper} takes no ${key}: a prop is edited with its kind's editor, or is a property of your own, made with defineProperty() (price: currency({ label: "Price", symbol: "€" }))`);
    }
    if (!taken.includes(key)) throw new Error(`[Elements] prop.${helper} has no option named ${key} (it takes ${taken.join(", ")})`);
  }
  return given ?? {};
}

export const helpers = {
  text: (given: Given) => {
    const { enum: values, maxLength, pattern, ...rest } = takes("text", given);
    if (values !== undefined && !(Array.isArray(values) && values.length > 0 && values.every((value) => typeof value === "string"))) {
      throw new Error(`[Elements] A text's enum lists the texts it may be (["$", "€"]), not ${JSON.stringify(values)}`);
    }
    if (values !== undefined && (maxLength !== undefined || pattern !== undefined)) {
      throw new Error(`[Elements] A text with an enum is one of the texts it lists: it takes no ${maxLength !== undefined ? "maxLength" : "pattern"}`);
    }
    if (values) return made(enumOf(values as readonly string[]), rest);
    // Compiled once, with only `u`: a `g` or `y` flag would make the same text pass, then fail (test() keeps its place).
    return made(text({ maxLength, ...(pattern !== undefined ? { pattern: new RegExp(pattern, "u") } : {}) }), rest);
  },
  date: (given: Given) => made(date(), takes("date", given)),
  color: (given: Given) => {
    const { transparency, ...rest } = takes("color", given);
    if (transparency !== undefined && typeof transparency !== "boolean") throw new Error(`[Elements] A color's transparency is true or false, not ${JSON.stringify(transparency)}`);
    return made(color({ transparency }), rest);
  },
  image: (given: Given) => made(asset(), takes("image", given)),
  link: (given: Given) => made(link(), takes("link", given)),
  boolean: (given: Given) => made(boolean(), takes("boolean", given)),
  fontFamily: (given: Given) => made(fontFamily(), takes("fontFamily", given)),
  fontWeight: (given: Given) => made(fontWeight(), takes("fontWeight", given)),
  number: (given: Given) => {
    const { min, max, integer, ...rest } = takes("number", given);
    return made(number({ min, max, integer }), rest);
  },
  length: (given: Given) => {
    const { units, min, ...rest } = takes("length", given);
    return made(length(units, { min }), rest);
  },
};

// ─── Composed values: lists and objects of fields ───────────────────────────

/** A spec that's a list of one item spec (`prop.list()`), which it keeps whole. */
export type ListSpec<I extends PropSpec = PropSpec> = PropSpec & { item: I };
/** A spec that's an object of field specs (`prop.object()`), which it keeps whole. */
export type ObjectSpec<F extends PropSpecs = PropSpecs> = PropSpec & { fields: F };

/** Whether a field must be given: it's required. */
type MustGive<S> = Exclude<S extends { required?: infer R } ? R : never, undefined> extends true ? true : false;
type Defaulted<S> = S extends { default: infer D } ? ([D] extends [undefined] ? false : true) : false;
/** Whether a field always has a value once read: it's required, it has a default, or it's a list (none is `[]`). */
type Always<S> = MustGive<S> extends true ? true : S extends { item: PropSpec } | { blocks: object } ? true : Defaulted<S>;

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
export type FieldInputs<F extends PropSpecs> = { [K in keyof F as MustGive<F[K]> extends true ? K : never]: FieldInput<F[K]> } & {
  [K in keyof F as MustGive<F[K]> extends true ? never : K]?: FieldInput<F[K]>;
};

/** What a list, a list of blocks or an object takes besides its parts: no default, and no editor named, as a helper's. */
type ComposedOptions<R extends boolean> = Omit<PropSpec<Kind<any, any>, R>, "kind" | "default" | "editor">;

/**
 * A list, a list of blocks and an object: each made of other props' specs, which it keeps whole, so no property of a
 * team's own is made on one. What each is given besides is checked as a helper's is.
 */
const composed = {
  list: (item: PropSpec, options: Given) => {
    const { min, max, ...rest } = takes("list", options);
    return { ...made(list(item.kind, { min, max }), rest), item };
  },
  blocks: (types: Record<string, ObjectSpec>, options: Given) => {
    const { min, max, ...rest } = takes("blocks", options);
    const kind = blocks(Object.fromEntries(Object.entries(types).map(([name, spec]) => [name, spec.kind])), { min, max });
    return { ...made(kind, rest), blocks: types };
  },
  object: (fields: PropSpecs, options: Given) => {
    const kind = object(Object.fromEntries(Object.entries(fields).map(([name, spec]) => [name, { kind: spec.kind, ...(spec.required ? { required: true } : {}), ...(spec.default !== undefined ? { default: spec.default } : {}) }])));
    return { ...made(kind, takes("object", options)), fields };
  },
};

/** Props of a custom element, and a template's fields, by value kind. */
export const prop = {
  ...helpers,
  ...composed,
  choice: (values: readonly (string | number)[], options: Given) => made(enumOf(values), takes("choice", options)),
} as unknown as { [N in keyof Helpers]: Helpers[N] & Based<N> } & {
  choice: <const V extends readonly (string | number)[], const R extends boolean = false, const D extends V[number] | undefined = undefined, const L extends string | undefined = undefined>(
    values: V,
    options: PropOptions<Kind<V[number], V[number]>, R, D, L>
  ) => Made<Kind<V[number], V[number]>, R, D, L>;
  /**
   * A list of `item`s, with as few as `min` and as many as `max`. In a template, one not given is `[]` (its `min`
   * applies to that too). The spec keeps `item` whole, so a template reads its rules (an image's).
   */
  list: <const I extends PropSpec, const R extends boolean = false>(
    item: I,
    options: ComposedOptions<R> & { min?: number; max?: number }
  ) => PropSpec<Kind<ReadonlyArray<FieldInput<I>>, Array<FieldValue<I>> & Json[]>, R> & { default: undefined; item: I };
  /**
   * A list of blocks the filler picks, orders and fills: each `{ type, …its fields }`, its type one of `types` (each a
   * `prop.object()` spec). A block type can't have a field named `type`. The spec keeps `blocks` whole.
   */
  blocks: <const B extends Record<string, ObjectSpec>, const R extends boolean = false>(
    types: B,
    options: ComposedOptions<R> & { min?: number; max?: number }
  ) => PropSpec<Kind<ReadonlyArray<BlockInput<B>>, Array<BlockValue<B>> & Json[]>, R> & { default: undefined; blocks: B };
  /** An object of named fields (a story's title, link and image). The spec keeps `fields` whole. */
  object: <const F extends PropSpecs, const R extends boolean = false>(fields: F, options: ComposedOptions<R>) => PropSpec<Kind<FieldInputs<F>, FieldValues<F> & Json>, R> & { default: undefined; fields: F };
};
