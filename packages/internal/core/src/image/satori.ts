/**
 * The image model (model.ts) drawn by Satori (the boxes laid out by Yoga, the text drawn as paths) and resvg (that
 * SVG as pixels): the only file that imports an engine. Another engine is another file like this one, drawing the
 * same canvas; the writer doesn't change.
 */
import { Resvg } from "@resvg/resvg-js";
import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import satori from "satori";
import type { Block, Engine, Picture, Run } from "./model";

/** The tree without styles left undefined (Satori reads every key it's given) and empty children. */
function clean(node: ReactNode): ReactNode {
  if (Array.isArray(node)) return node.map(clean);
  if (!isValidElement(node)) return node;
  const { style, children, ...props } = (node as ReactElement<{ style?: Record<string, unknown>; children?: ReactNode }>).props;
  const kept = style && Object.fromEntries(Object.entries(style).filter(([, value]) => value !== undefined && value !== null));
  const list = ([] as ReactNode[]).concat(children ?? []).filter((child) => child !== null && child !== undefined && child !== false).map(clean);
  return createElement(node.type as string, { ...props, key: node.key, ...(kept ? { style: kept } : {}) }, ...list);
}

const picture = (item: Picture, key?: number): ReactElement => createElement("img", { key, src: item.src, alt: item.alt, style: item.style });

const run = (item: Run, key: number): ReactNode => {
  if (typeof item === "string") return item;
  if (item.kind === "span") return createElement("span", { key, style: item.style }, ...item.runs.map(run));
  return picture(item, key);
};

/** A line break, as the model writes one (a `LineBreak`): a run of its own, among a block's runs or a Span's. */
const BREAK = "\n";

/**
 * A run split at the line breaks it holds: a Span or a Link with one is drawn once on each line, as a browser draws
 * an inline box a `<br>` breaks (its color, underline and background on each part), and each break is one of the
 * block's own runs.
 */
function atBreaks(item: Run): Run[] {
  if (typeof item === "string" || item.kind !== "span") return [item];
  const parts: Run[] = [];
  let line: Run[] = [];
  const end = () => {
    if (line.length > 0) parts.push({ ...item, runs: line });
    line = [];
  };
  for (const held of item.runs.flatMap(atBreaks)) {
    if (held !== BREAK) line.push(held);
    else {
      end();
      parts.push(BREAK);
    }
  }
  end();
  return parts;
}

/**
 * A block's runs, each line break drawn as one in Yoga. Each run is a flex item, and a line of them a flex line: a
 * break in a run's text would break that run's own box, the run after it carrying on beside the box ("See our today"
 * with "site" under "our", for `See <Span>our<LineBreak />site</Span> today`), and a break between two Spans would
 * break nothing. So a break is an item of its own, as wide as the block, which the next items wrap below. A line
 * with nothing on it (a break at the block's start, or right after another) holds a space, so it's a line high, as
 * it is in the HTML outputs.
 */
function lines(runs: Run[]): ReactNode[] {
  const drawn: ReactNode[] = [];
  let empty = true;
  for (const [key, item] of runs.flatMap(atBreaks).entries()) {
    if (item !== BREAK) {
      drawn.push(run(item, key));
      empty = false;
      continue;
    }
    if (empty) drawn.push(" ");
    drawn.push(createElement("div", { key, style: { flexBasis: "100%", height: 0 } }));
    empty = true;
  }
  return drawn;
}

const block = (item: Block, key?: number): ReactElement => {
  switch (item.kind) {
    case "box":
      return createElement("div", { key, style: item.style }, ...item.children.map(block));
    case "text":
      return createElement("div", { key, style: item.style }, ...lines(item.runs));
    case "image":
      return picture(item, key);
    case "drawing":
      return createElement(
        "svg",
        { key, width: item.width, height: item.height, viewBox: item.viewBox, xmlns: "http://www.w3.org/2000/svg" },
        ...item.shapes.map((shape, i) => createElement(shape.kind, { key: i, ...shape.attributes }))
      );
  }
};

/** The definitions among an SVG's top-level elements: what the drawn ones refer to, never drawn themselves. */
const DEFINITION = /^<(?:clipPath|mask|defs|pattern|linearGradient|radialGradient|filter|symbol|style)\b/;

/** An SVG's top-level elements, each as written. */
function topLevel(svg: string): { open: string; parts: string[] } {
  const open = svg.slice(0, svg.indexOf(">") + 1);
  const inner = svg.slice(open.length, svg.lastIndexOf("</svg>"));
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (const tag of inner.matchAll(/<(\/?)[A-Za-z][\w:-]*(?:"[^"]*"|'[^']*'|[^'">])*?(\/?)>/g)) {
    if (tag[1]) depth--;
    else if (!tag[2]) depth++;
    if (depth === 0) {
      parts.push(inner.slice(start, tag.index + tag[0].length));
      start = tag.index + tag[0].length;
    }
  }
  return { open, parts };
}

/**
 * The SVG without what's drawn far outside the canvas. resvg draws each layer (a box, text, an image: Satori gives
 * each a clip or a mask) in a region it limits to the canvas and twice its size on every side, and panics, ending
 * the process, for a layer wholly beyond that: content that overflows the canvas by more than its own height. What
 * lies there is cut off anyway, so the image is the same. Only where the content reaches that far; an SVG that doesn't
 * is drawn as it is.
 */
function withinReach(svg: string, resvg: Resvg, width: number, height: number): string | undefined {
  const box = resvg.getBBox();
  // A pixel short of the limit, as resvg widens each layer by 2px for its antialiasing.
  const reach = (side: number) => 2 * side - 4;
  const far = (b: { x: number; y: number; width: number; height: number }) =>
    b.y > reach(height) || b.x > reach(width) || b.y + b.height < -reach(height) || b.x + b.width < -reach(width);
  if (!box || !(box.y + box.height > reach(height) || box.x + box.width > reach(width) || box.y < -reach(height) || box.x < -reach(width))) return undefined;
  const { open, parts } = topLevel(svg);
  // Each definition by the ids in it, so a part is measured with only those it refers to (and those refer to), in
  // order: not every definition's images again for every part.
  const definitions = parts.flatMap((part, index) => (DEFINITION.test(part) ? [{ part, index }] : []));
  const byId = new Map(definitions.flatMap((definition) => Array.from(definition.part.matchAll(/\bid="([^"]+)"/g), (match) => [match[1], definition] as const)));
  const referred = (part: string): string => {
    const found = new Set<{ part: string; index: number }>();
    const visit = (text: string) => {
      for (const match of text.matchAll(/url\(#([^)"']+)\)|href="#([^"]+)"/g)) {
        const definition = byId.get(match[1] ?? match[2]);
        if (definition && !found.has(definition)) {
          found.add(definition);
          visit(definition.part);
        }
      }
    };
    visit(part);
    return [...found].sort((a, b) => a.index - b.index).map((definition) => definition.part).join("");
  };
  const kept = parts.filter((part) => {
    if (DEFINITION.test(part)) return true;
    const own = new Resvg(`${open}${referred(part)}${part}</svg>`, { font: { loadSystemFonts: false } }).getBBox();
    return !own || !far(own);
  });
  return `${open}${kept.join("")}</svg>`;
}

export const satoriResvg: Engine = async (canvas, output) => {
  const tree = clean(createElement("div", { style: canvas.style }, ...canvas.children.map(block)));
  const fonts = canvas.fonts.map((font) => ({ name: font.family, data: font.data, weight: font.weight, style: font.style }));
  const svg = await satori(tree as ReactElement, { width: canvas.width, height: canvas.height, fonts });
  if (output.format === "svg") return new TextEncoder().encode(svg);
  const options = { fitTo: { mode: "width" as const, value: Math.round(canvas.width * output.scale) }, font: { loadSystemFonts: false } };
  const resvg = new Resvg(svg, options);
  const trimmed = withinReach(svg, resvg, canvas.width, canvas.height);
  return new Uint8Array((trimmed === undefined ? resvg : new Resvg(trimmed, options)).render().asPng());
};
