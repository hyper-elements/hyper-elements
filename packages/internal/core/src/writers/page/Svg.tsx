/** An Svg as inline SVG, and its shapes and groups as SVG's, each with its id (what CSS finds it by): "transparent" paint as SVG's none. */
import type { ResolvedNode } from "../../resolve";
import { h } from "../jsx";
import { isNode, type Component } from "./context";
import { box } from "./layout";

const paint = (value: unknown) => (value === "transparent" ? "none" : (value as string | undefined));

/** A shape's attributes: its props, and how it's painted. */
export function shapeAttributes(node: ResolvedNode): Record<string, string | number | undefined> {
  const { style, props } = node;
  return {
    ...(props as Record<string, string | number | undefined>),
    fill: paint(style.fill),
    stroke: paint(style.stroke),
    "stroke-width": style.strokeWidth as number | undefined,
    opacity: style.opacity as number | undefined,
  };
}

const TAGS: Record<string, string> = { Rect: "rect", Circle: "circle", Ellipse: "ellipse", Line: "line", Polygon: "polygon", Path: "path" };

/** A shape, or a group with what it holds, as SVG. */
const drawn = (node: ResolvedNode): ReturnType<typeof h> =>
  node.type === "G"
    ? h("g", { id: node.id, transform: node.props.transform as string | undefined }, ...node.children.filter(isNode).map(drawn))
    : h(TAGS[node.type]!, { id: node.id, ...shapeAttributes(node) });

export const Svg: Component = ({ node, parent, placement, classes }) => {
  const { width, height, viewBox, title } = node.props as { width: number; height: number; viewBox?: string; title?: string };
  return (
    <svg
      id={node.id}
      class={classes()}
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox={viewBox ?? `0 0 ${width} ${height}`}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : "true"}
      // Its padding and border around the drawing, as the resolver counts them (a framed box is border-box elsewhere).
      style={[placement, { display: "block", flex: "none" }, { ...box(node, parent.type !== "Row"), boxSizing: undefined }]}
    >
      {node.children.filter(isNode).map(drawn)}
    </svg>
  );
};
