/** A Row: a flex row, each child placed by its width or share (`rowPlacement`); stacked on phones by a class, unless `stackOnMobile` is false. */
import { h } from "../jsx";
import { textDeclarations } from "../shared/css";
import type { Component } from "./context";
import { box, FLEX_ALIGN, JUSTIFY, inRow, pageLayout } from "./layout";

export const Row: Component = ({ node, style, parent, placement, classes, children }) => (
  <div
    id={node.id}
    class={classes()}
    dir={node.props.dir as string | undefined}
    style={[
      placement,
      {
        display: "flex",
        gap: style.gap,
        // Across a Row laid out as a column by its page styles, alignItems places what has its own size, as in a Column.
        alignItems: inRow(node) || pageLayout(node) === "grid" ? FLEX_ALIGN[style.alignItems as string] : undefined,
        justifyContent: JUSTIFY[style.justifyContent as string],
        flexWrap: style.flexWrap === "wrap" || style.flexWrap === "words" ? "wrap" : undefined,
      },
      box(node, !inRow(parent)),
      textDeclarations(node.text, parent.text),
    ]}
  >
    {children()}
  </div>
);
