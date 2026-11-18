/** A Column: a flex column with its gap, in its box. */
import { h } from "../jsx";
import { textDeclarations } from "../shared/css";
import type { Component } from "./context";
import { box, FLEX_ALIGN, pageLayout, stackOf, inRow } from "./layout";

export const Column: Component = ({ node, parent, placement, classes, children }) => (
  <div id={node.id} class={classes()} style={[placement, stackOf(node), pageLayout(node) && { alignItems: FLEX_ALIGN[node.style.alignItems as string] }, box(node, !inRow(parent)), textDeclarations(node.text, parent.text)]}>
    {children()}
  </div>
);
