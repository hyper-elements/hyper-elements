/**
 * A Section: one element across the window, its content kept to the content
 * width by its inline padding, however wide the window is.
 */
import { h } from "../jsx";
import { px, textDeclarations } from "../shared/css";
import type { Component } from "./context";
import { FLEX_ALIGN, pageLayout, stackOf } from "./layout";

type Sides = { top: number | string; right: number | string; bottom: number | string; left: number | string };

export const Section: Component = ({ node, style, parent: root, classes, children }) => {
  const { top, right, bottom, left } = (style.padding as Sides | undefined) ?? { top: 0, right: 0, bottom: 0, left: 0 };
  // The side padding: at least as given, more where the window is wider than the content. Inside calc()
  // and max() every length has its unit (a bare 0 there makes the whole declaration invalid).
  // On a Page a side may be in rem, em or calc(): written as it is.
  const length = (value: number | string) => (typeof value === "number" ? `${Math.round(value * 100) / 100}px` : value);
  const edge = (value: number | string) => (typeof value === "number" ? px(value) : value);
  const side = (padding: number | string) => `max(${length(padding)}, calc((100% - ${length(root.width ?? 0)}) / 2 + ${length(padding)}))`;
  return (
    <section
      id={node.id}
      class={classes()}
      style={[stackOf(node), pageLayout(node) && { alignItems: FLEX_ALIGN[style.alignItems as string] }, { padding: `${edge(top)} ${side(right)} ${edge(bottom)} ${side(left)}`, backgroundColor: style.backgroundColor, border: style.border }, textDeclarations(node.text, root.text)]}
    >
      {children()}
    </section>
  );
};
