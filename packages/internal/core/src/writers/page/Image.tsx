/** An Image: a block, no wider than its parent; its width attribute in px where it's known. */
import { assetParts, type Asset } from "../../kinds";
import { h } from "../jsx";
import type { Component } from "./context";
import { pageLayout, inRow } from "./layout";

export const Image: Component = ({ node, style, parent, placement, classes }) => {
  // Under the children of a Layer with a height, it covers the Layer, cut at its sides or its top and bottom.
  const covers = parent.type === "Layer" && parent.style.height !== undefined && parent.children.find((c) => typeof c !== "string") === node;
  // In a Box, or a flex row or grid a Page's styles make, with no width of its own: its file's size, no wider than its
  // place, so the browser sizes it at every window as the resolver does at the base one (Decision 7).
  const file = assetParts(node.props.src as Asset);
  const own = (parent.type === "Box" || pageLayout(parent) !== undefined) && style.width === undefined && file.width !== undefined;
  return (
  <img
    id={node.id}
    class={classes()}
    src={assetParts(node.props.src as Asset).src}
    alt={(node.props.alt as string) ?? ""}
    title={node.props.title as string | undefined}
    // A percentage is a share of its parent, not a size of its own.
    width={own ? file.width : typeof style.width !== "string" && node.width !== null ? node.width : undefined}
    height={own ? file.height : undefined}
    style={[
      placement,
      {
        display: "block",
        maxWidth: style.maxWidth ?? "100%",
        width: inRow(parent) ? undefined : style.width,
        height: style.height ?? "auto",
        alignSelf: style.alignSelf,
        verticalAlign: style.verticalAlign,
        border: style.border,
        borderRadius: style.borderRadius,
      },
      covers && { width: "100%", height: "100%", maxWidth: "none", objectFit: "cover" },
    ]}
  />
  );
};
