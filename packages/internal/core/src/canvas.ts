/**
 * Images: a Canvas is a fixed-size root, its children laid out in it as on a page, written as an
 * image by @hyper-elements/react/image (and as HTML by render(), to look at); an Svg draws shapes (Rect, Circle, Ellipse,
 * Line, Polygon, Path) in a box of its own, on a page, in a Canvas and in a PDF. In an Email, a Canvas (and an Svg on its
 * own) is a picture: a PNG file the email links to, drawn by @hyper-elements/react/image (writers/email/pictures.ts).
 */
import { defineComponent, prop, type PropSpecs, type SupportByTarget } from "./define";
import { color, length, number, text } from "./kinds";
import { ROOT_DEFAULT_STYLE, ROOT_PROPS, ROOT_STYLE, SURFACE_ROLES, TEXT_EDITOR } from "./roots";
import { boxStyle, css, layoutStyle, pick, placementStyle } from "./styles";

/** Drawn as the image itself, and into a picture in an Email (a Canvas's, an Svg's and its shapes'). */
const DRAWN: SupportByTarget = { web: { level: "full", source: "writer" }, email: { level: "full", source: "writer" } };
const coordinate = (label: string, description?: string) => prop(number(), { support: DRAWN, label, ...(description ? { description } : {}), default: 0 });
const size = (label: string) => prop(number({ min: 0 }), { support: DRAWN, label, required: true });

/** Styles with no phone value of their own. */
const drawnOnce = <S extends Record<string, object>>(styles: S) =>
  Object.fromEntries(Object.entries(styles).map(([key, spec]) => [key, { ...spec, mobile: false }])) as unknown as { [K in keyof S]: Omit<S[K], "mobile"> & { mobile: false } };

export const Canvas = defineComponent({
  type: "Canvas",
  roles: SURFACE_ROLES,
  label: "Canvas",
  description:
    "An image of a fixed size (a social card, a banner): its children laid out in it as on a page. Written as PNG or SVG with @hyper-elements/react/image; in an Email, a linked PNG (render()'s assets).",
  categories: ["root", "block"],
  props: {
    width: prop(length(["px"], { min: 1 }), { support: DRAWN, label: "Width", description: "The image's width, in px.", default: 1200 }),
    height: prop(length(["px"], { min: 1 }), { support: DRAWN, label: "Height", description: "The image's height, in px: what's past it is cut.", default: 630 }),
    alt: prop(text(), { roots: ["Email"], support: DRAWN, label: "Alternate text", description: "In an Email: what it shows, read out by screen readers and shown where images don't load." }),
    ...ROOT_PROPS,
  },
  // No phone styles: as an image, and as a picture in an Email, it's drawn once (shrunk to fit on a phone).
  style: drawnOnce({ ...ROOT_STYLE, padding: boxStyle.padding, justifyContent: layoutStyle.justifyContent }),
  defaultStyle: ROOT_DEFAULT_STYLE,
  children: { categories: ["section", "layout", "block"] },
  sizing: "none",
  targets: { web: {}, email: {} },
  // A root of its own, or a picture in an Email.
  roots: ["Email"],
  notAllowed: { code: "element/not-supported", message: (root) => `A Canvas is a root, or a picture in an Email: it can't be inside ${root === "Email" ? "an" : "a"} ${root}` },
  editor: {
    groups: [
      { title: "Canvas", paths: ["props.width", "props.height", "props.alt", "style.backgroundColor", "style.padding"] },
      { title: "Layout", paths: ["style.gap", "style.alignItems", "style.justifyContent"] },
      TEXT_EDITOR,
    ],
  },
});

export const Svg = defineComponent({
  type: "Svg",
  label: "Vector drawing",
  description:
    "Shapes (Rect, Circle, Ellipse, Line, Polygon, Path) drawn in a box of its own: its width and height, and the coordinates its viewBox gives them. In an Email, a linked PNG (render()'s assets).",
  categories: ["block"],
  props: {
    width: size("Width"),
    height: size("Height"),
    viewBox: prop(text({ maxLength: 100 }), { support: DRAWN, label: "View box", description: 'The shapes\' coordinates in it, as "x y width height" (its width and height by default).' }),
    title: prop(text({ maxLength: 200 }), { support: DRAWN, label: "Title", description: "What it shows, read out by screen readers." }),
  },
  style: {
    ...pick(boxStyle, "padding", "backgroundColor", "border", "borderRadius"),
    ...placementStyle,
    // In an Email, a picture as wide as its drawing: a share of a Row isn't drawn.
    flex: {
      ...placementStyle.flex,
      support: {
        web: placementStyle.flex.support.web,
        email: { level: "none", shows: "its own width: an Svg in a Row is as wide as its drawing", when: (value) => value !== "none" && value !== 0, source: "writer", fix: "leave flex out, and set the Svg's width" },
      },
    },
  },
  children: { categories: ["shape"] },
  sizing: "shrink",
  // In an Email, a picture: a Canvas the size of its box (writers/email/pictures.ts).
  targets: { web: {}, email: {} },
  editor: { groups: [{ title: "Drawing", paths: ["props.width", "props.height", "props.viewBox", "props.title"] }] },
});

/** How a shape is painted (in an Email, into its Svg's picture). */
const PAINT = {
  fill: { kind: color(), label: "Fill", description: 'Its inside ("transparent" for none).', support: { web: css, email: DRAWN.email! } },
  stroke: { kind: color(), label: "Stroke", description: "Its outline's color.", support: { web: css, email: DRAWN.email! } },
  strokeWidth: { kind: number({ min: 0 }), label: "Stroke width", support: { web: css, email: DRAWN.email! } },
  opacity: { kind: number({ min: 0, max: 1 }), label: "Opacity", support: { web: css, email: DRAWN.email! } },
};
const PAINT_DEFAULT = { fill: "#000000" } as const;

const shape = <const P extends PropSpecs>(type: string, label: string, description: string, props: P) =>
  defineComponent({ type, label, description, categories: ["shape"], props, style: PAINT, defaultStyle: PAINT_DEFAULT, children: {}, sizing: "none", targets: { web: {}, email: {} } });

export const Rect = shape("Rect", "Rectangle", "A rectangle at x, y in its Svg, rounded by rx.", {
  x: coordinate("X"),
  y: coordinate("Y"),
  width: size("Width"),
  height: size("Height"),
  rx: prop(number({ min: 0 }), { support: DRAWN, label: "Corner radius" }),
});
export const Circle = shape("Circle", "Circle", "A circle centered at cx, cy in its Svg.", { cx: coordinate("Center X"), cy: coordinate("Center Y"), r: size("Radius") });
export const Ellipse = shape("Ellipse", "Ellipse", "An ellipse centered at cx, cy in its Svg.", { cx: coordinate("Center X"), cy: coordinate("Center Y"), rx: size("Radius across"), ry: size("Radius down") });
export const Line = shape("Line", "Line", "A straight line from x1, y1 to x2, y2 in its Svg (drawn by its stroke).", {
  x1: coordinate("Start X"),
  y1: coordinate("Start Y"),
  x2: coordinate("End X"),
  y2: coordinate("End Y"),
});
export const Polygon = shape("Polygon", "Polygon", 'A closed shape through its points ("0,0 40,0 20,30"), in its Svg.', {
  points: prop(text({ maxLength: 10000 }), { support: DRAWN, label: "Points", required: true }),
});
export const Path = shape("Path", "Path", "A shape drawn by an SVG path (d), in its Svg.", {
  d: prop(text({ maxLength: 100000 }), { support: DRAWN, label: "Path", description: 'SVG path data ("M0 0 L40 0 L20 30 Z").', required: true }),
});

/** The shapes, by type. */
export const SHAPES = [Rect, Circle, Ellipse, Line, Polygon, Path];

