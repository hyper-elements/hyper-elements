/**
 * A template module's component and its props.
 */

/** A module's default export (a CommonJS module arrives with its exports as the default). */
export function defaultExport(mod: Record<string, any>): unknown {
  let value = mod.default;
  if (value && typeof value === "object" && !("$$typeof" in value) && "default" in value) value = value.default;
  return value;
}

export interface TemplateComponent {
  /** The function that renders it, through `memo` and `forwardRef`. */
  component: any;
  /** What the module exported. */
  exported: any;
  /** Its `PreviewProps` (the first found, from the export inwards), else `{}`. */
  props: Record<string, unknown>;
  /** Whether it has `PreviewProps`. */
  previewed: boolean;
}

/**
 * The component a module's default export is (a function, or `memo` or `forwardRef` of one) and the `PreviewProps`
 * it carries, read on each wrapper; undefined where it isn't a component. Throws on a React wrapper it can't render
 * through (an element, a lazy component, a wrapper with nothing inside).
 */
export function templateComponent(value: any): TemplateComponent | undefined {
  const exported = value;
  let props: Record<string, unknown> | undefined;
  let wrapped = false;
  const seen = new Set<unknown>();
  while (value && !seen.has(value)) {
    seen.add(value);
    props ??= value.PreviewProps;
    if (typeof value === "function") return { component: value, exported, props: props ?? {}, previewed: props !== undefined };
    if (value.$$typeof === Symbol.for("react.memo")) { value = value.type; wrapped = true; }
    else if (value.$$typeof === Symbol.for("react.forward_ref")) { value = value.render; wrapped = true; }
    else if ("$$typeof" in Object(value)) throw new Error("unsupported React template wrapper");
    else if (wrapped) throw new Error("the React template wrapper has no renderable component");
    else return undefined;
  }
  if (wrapped) throw new Error("the React template wrapper has no renderable component");
  return undefined;
}
