/**
 * Custom elements: a named block made of primitives, with its own typed
 * props and editors, kept as one node in the document and expanded when it's
 * rendered. Their props are made with `prop`'s helpers and properties of a
 * team's own (`./properties`), which need neither React nor this render.
 */
import type React from "react";
import { defineCustomComponent, formatDiagnostics, type CustomDefinition, type ExpandProps, type PropSpecs, type PropsInput, type RootName } from "@hyper-elements/core";
import { collectingPrimitives, collectNodes, recordPrimitive, registerUsed } from "./collect";
import type { TakesToken } from "./properties/prop";
import type { Token } from "./theme";

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
   * The roots it goes in, so the formats it's for: `["Email", "Page"]`. Left out, every root. Under another root it's
   * an `element/not-supported` error, from `validate()` and `render()`.
   */
  roots?: readonly RootName[];
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
    roots: spec.roots,
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
