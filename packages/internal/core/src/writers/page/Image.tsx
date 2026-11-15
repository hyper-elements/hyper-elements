/** An Image: a block, no wider than its parent; its width attribute in px where it's known, and on a Page its height with it where its file's size is. */
import { assetParts, type Asset } from "../../kinds";
import { h } from "../jsx";
import type { Component } from "./context";

export const Image: Component = ({ node, style, parent, root, placement, classes }) => {
  const { src, width: fileWidth, height: fileHeight } = assetParts(node.props.src as Asset);
  // A percentage is a share of its parent, not a size of its own.
  const width = typeof style.width !== "string" && node.width !== null ? node.width : undefined;
  // Under the children of a Layer with a height, it covers the Layer, cut at its sides or its top and bottom.
  const covers = parent.type === "Layer" && parent.style.height !== undefined && parent.children.find((c) => typeof c !== "string") === node;
  // On a Page, its height in proportion, so the page holds its place before the file arrives. A height of its own, or the Layer's, is the style's.
  // Both in px a browser lays out: a width or a height of millions isn't an image's, and past them a number is written with an exponent.
  const height = root.type === "Page" && !covers && style.height === undefined && width !== undefined && width < 1e7 && fileWidth && fileHeight ? Math.round((fileHeight * width) / fileWidth) : 0;
  return (
  <img
    id={node.id}
    class={classes()}
    src={src}
    alt={(node.props.alt as string) ?? ""}
    title={node.props.title as string | undefined}
    width={width}
    height={height >= 1 && height < 1e7 ? height : undefined}
    style={[
      placement,
      {
        display: "block",
        maxWidth: style.maxWidth ?? "100%",
        width: parent.type === "Row" ? undefined : style.width,
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
