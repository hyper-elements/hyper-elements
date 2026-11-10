/**
 * A Box (Decision 6): the element its `as` names, a flex column with its gap until its page styles lay it out
 * otherwise (display, flexDirection, grid…), which `write()` adds after these. Directly in a Page it spans the window,
 * its own maxWidth and padding setting its content's width; a maxWidth keeps it centered there.
 */
import { h } from "../jsx";
import { textDeclarations } from "../shared/css";
import type { Component } from "./context";
import { box, FLEX_ALIGN, pageLayout, stackOf } from "./layout";

export const Box: Component = ({ node, parent, placement, classes, children }) => {
  const Tag = (node.props.as as string | undefined) ?? "div";
  const top = parent.type === "Page" && parent.path === "root";
  return (
    <Tag
      id={node.id}
      class={classes()}
      dir={node.props.dir as string | undefined}
      style={[
        placement,
        top && node.style.maxWidth !== undefined && { width: "100%", alignSelf: "center" },
        stackOf(node),
        // In a stack its children are each placed (alignSelf); as a flex row or a grid, its alignItems places them.
        pageLayout(node) && { alignItems: FLEX_ALIGN[node.style.alignItems as string] },
        box(node, parent.type !== "Row"),
        textDeclarations(node.text, parent.text),
      ]}
    >
      {children()}
    </Tag>
  );
};
