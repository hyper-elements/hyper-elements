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
  type CustomDefinition,
  type ExpandProps,
  type Kind,
  type LengthUnit,
  type OutputOf,
  type PropSpec,
  type PropSpecs,
  type PropsInput,
} from "@unlayer-internal/elements-core";
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

/** Props of a custom component, by value kind. */
export const prop = {
  text: kindProp(() => text()),
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
