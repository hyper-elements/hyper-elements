/**
 * `defineProperty()`: a property of a team's own, one of `prop`'s helpers with an editor of the team's own. Data, as
 * the helpers are: it imports only them and the engine.
 */
import { OWN_EDITOR, type InputOf, type Json, type Kind, type OutputOf } from "@hyper-elements/core";
import { BESIDES, EVERY, helpers, prop, type Based, type Given, type Helpers } from "./prop";

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
 * What a property's prop says of its editor, as its type: which property it is (its name, as it's written) and its
 * options as the prop has them. So an editing app can tell from an element's props, as types, which properties it
 * needs editors for. The value is the one the prop holds at run time.
 */
type PropertyMark<Name extends string, O> = { readonly editor: { readonly name: Name; readonly options: O } };

/**
 * A property of a team's own: one of `prop`'s helpers with an editor of the team's own, and what that editor takes. As
 * a template knows it, it's data (its name, the helper it's made on, its options), with no control: that's each editing
 * app's, registered under the name (in Unlayer's builder, `registerTools()`'s `editors`), so a template renders with
 * none. Called, it's a prop: `price: currency({ label: "Price", min: 0, symbol: "$" })`.
 */
export interface PropertyDefinition<V = any, O = { [option: string]: Json }, Name extends string = string> {
  /** A namespace, a dot, a word: "acme.currency". What an editing app registers its editor under. */
  readonly name: Name;
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
 * limits, whoever writes it. Its own options say how it's edited, each checked by its kind as a prop is. Its name, as
 * it's written, stays in the types of the property, of each prop it makes and of an element with one
 * (`price.editor.name` is `"acme.currency"`), with the prop's options as its editor is given them.
 */
export function defineProperty<const Name extends string, const N extends keyof Helpers, const O extends OptionSpecs = {}>(definition: {
  name: Name;
  base: Based<N>;
  options?: O;
}): Helpers<OptionsInput<O>, PropertyMark<Name, OptionsOf<O>>>[N] & PropertyDefinition<Value<N>, OptionsOf<O>, Name> {
  const { name } = definition;
  const specs: OptionSpecs = definition.options ?? {};
  if (!OWN_EDITOR.test(String(name))) throw new Error(`[Elements] A property's name is a namespace, a dot and a word ("acme.currency"), not ${JSON.stringify(name)}`);
  const base = (Object.keys(helpers) as Array<keyof typeof helpers>).find((helper) => helpers[helper] === (definition.base as unknown));
  if (!base) {
    throw new Error(`[Elements] The property ${name} is made on one of prop's helpers (${Object.keys(helpers).map((helper) => `prop.${helper}`).join(", ")})${(definition.base as unknown) === prop.choice ? ": for one of a few values, prop.text with an enum" : ""}`);
  }
  const taken = [...EVERY, ...(BESIDES[base] ?? [])];
  for (const [option, spec] of Object.entries(specs) as Array<[string, OptionSpecs[string] | undefined]>) {
    if (taken.includes(option) || option === "editor") throw new Error(`[Elements] The property ${name} can't have an option named ${option}: that's its prop's`);
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
