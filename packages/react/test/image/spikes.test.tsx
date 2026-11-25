/**
 * What Satori can tell the image entry about a Canvas before it draws one: three questions text fitting depends on,
 * settled against the engine itself and kept as tests, so a Satori upgrade that changes an answer fails here first.
 *
 * 1. Each drawn block, keyed by its node's path (the Satori element's `key`), comes back from `onNodeDetected` with
 *    its box, and a block's lines are its content height (its height less vertical padding and borders) over its line
 *    height. Checked against the lines of ink resvg draws in that box: for a Text with padding and a border, for
 *    runs in the block's own style (a Span, a Link), and for runs in another size.
 * 2. Every distinct word measured at once, each in its own unconstrained flex item, is as wide as it is laid out alone
 *    (its advance width, what Satori wraps by). A node's box doesn't show a word wider than it; the probe does.
 * 3. `loadAdditionalAsset` is called only for characters no given font covers, and answering it with no font leaves
 *    the image's bytes as they are without it.
 *
 * The blocks are drawn as satori.ts draws them, with keys added (here, not yet in the adapter). Fonts are Liberation
 * Sans, as pdf.js ships it, standing in for each family a Canvas names.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import satori, { type SatoriNode, type SatoriOptions } from "satori";
import { writeCanvas, type Block, type DrawnCanvas, type Font, type Picture, type Run } from "@hyper-elements/core/image";
import type { ResolvedNode } from "@hyper-elements/core";
import { Canvas, Column, Heading, Link, prepare, Span, Text } from "@hyper-elements/react";
import { gallery } from "../../src/primitives/examples/gallery";
import { stress } from "../../src/primitives/examples/stress";

const STANDARD = join(dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json")), "standard_fonts");
const file = (name: string) => {
  const bytes = readFileSync(join(STANDARD, name));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
};
const REGULAR = file("LiberationSans-Regular.ttf");
const BOLD = file("LiberationSans-Bold.ttf");

/** Liberation Sans as `family`, at 400 and 700. */
const faces = (family: string): Font[] => [
  { family, data: REGULAR, weight: 400, style: "normal" },
  { family, data: BOLD, weight: 700, style: "normal" },
];

// ─── Drawing, as satori.ts does, with each node's block keyed ─────────────────

/** The blocks' keys: the block that is a node's own, by its path, for the containers whose blocks are their children's. */
function keys(canvas: DrawnCanvas, root: ResolvedNode): Map<Block, string> {
  const out = new Map<Block, string>();
  const shown = (node: ResolvedNode) => node.children.filter((c): c is ResolvedNode => typeof c !== "string" && !c.hidden?.desktop);
  const walk = (blocks: Block[], node: ResolvedNode) => {
    // The writer leaves out an Image with no file; the gallery's and these Canvases have none, so blocks and nodes pair.
    shown(node).forEach((child, i) => {
      const drawn = blocks[i];
      if (!drawn) return;
      out.set(drawn, child.path);
      if (drawn.kind === "box" && ["Column", "Section", "Row"].includes(child.type)) walk(drawn.children, child);
    });
  };
  walk(canvas.children, root);
  return out;
}

function element(canvas: DrawnCanvas, keyed: Map<Block, string>): ReactElement {
  const picture = (item: Picture, key?: string | number) => createElement("img", { key, src: item.src, alt: item.alt, style: item.style });
  const run = (item: Run, i: number): ReactNode => {
    if (typeof item === "string") return item;
    if (item.kind === "span") return createElement("span", { key: i, style: item.style }, ...item.runs.map(run));
    return picture(item, i);
  };
  const block = (item: Block, i: number): ReactElement => {
    const key = keyed.get(item) ?? i;
    switch (item.kind) {
      case "box":
        return createElement("div", { key, style: item.style }, ...item.children.map(block));
      case "text":
        return createElement("div", { key, style: item.style }, ...item.runs.map(run));
      case "image":
        return picture(item, key);
      case "drawing":
        return createElement("svg", { key, width: item.width, height: item.height, viewBox: item.viewBox, xmlns: "http://www.w3.org/2000/svg" }, ...item.shapes.map((shape, j) => createElement(shape.kind, { key: j, ...shape.attributes })));
    }
  };
  return clean(createElement("div", { style: canvas.style }, ...canvas.children.map(block))) as ReactElement;
}

/** satori.ts's: no undefined styles (Satori reads every key) and no empty children. */
function clean(node: ReactNode): ReactNode {
  if (Array.isArray(node)) return node.map(clean);
  if (!isValidElement(node)) return node;
  const { style, children, ...props } = (node as ReactElement<{ style?: Record<string, unknown>; children?: ReactNode }>).props;
  const kept = style && Object.fromEntries(Object.entries(style).filter(([, value]) => value !== undefined && value !== null));
  const list = ([] as ReactNode[]).concat(children ?? []).filter((child) => child !== null && child !== undefined && child !== false).map(clean);
  return createElement(node.type as string, { ...props, key: node.key, ...(kept ? { style: kept } : {}) }, ...list);
}

const satoriFonts = (fonts: Font[]) => fonts.map((font) => ({ name: font.family, data: font.data, weight: font.weight, style: font.style }));

/** A Canvas laid out by the writer and drawn by Satori with its blocks keyed: the SVG, each keyed box, the tree. */
async function layout(template: ReactElement, fonts: Font[], options: Partial<SatoriOptions> = {}) {
  const root = prepare(template).root!;
  const families = new Set(fonts.map((font) => font.family.toLowerCase()));
  const canvas = writeCanvas(root, { families, fallback: fonts[0].family, fonts, image: () => undefined });
  const boxes = new Map<string, SatoriNode>();
  const svg = await satori(element(canvas, keys(canvas, root)), {
    width: canvas.width,
    height: canvas.height,
    fonts: satoriFonts(fonts),
    ...options,
    onNodeDetected: (node) => {
      // A block with no key comes back as "null" (React's key, as a string); the keyed ones are paths.
      if (typeof node.key === "string" && node.key.startsWith("root")) boxes.set(node.key, node);
      options.onNodeDetected?.(node);
    },
  } as SatoriOptions);
  return { svg, boxes, root, canvas };
}

const find = (node: ResolvedNode, path: string): ResolvedNode | undefined =>
  node.path === path ? node : node.children.map((c) => (typeof c === "string" ? undefined : find(c, path))).find(Boolean);

/** Its height less its vertical padding and borders: the height of its lines. */
function contentHeight(box: SatoriNode, node: ResolvedNode): number {
  const padding = node.style.padding as { top: number; bottom: number } | undefined;
  const border = node.style.border as { top?: { width: number }; bottom?: { width: number } } | undefined;
  return box.height - (padding?.top ?? 0) - (padding?.bottom ?? 0) - (border?.top?.width ?? 0) - (border?.bottom?.width ?? 0);
}

/** Lines of ink inside a box (rows with dark pixels, a line where they touch), from resvg's pixels. */
function inkLines(svg: string, box: { left: number; top: number; width: number; height: number }): number {
  const image = new Resvg(svg, { font: { loadSystemFonts: false } }).render();
  const { width, pixels } = image;
  let lines = 0;
  let inLine = false;
  for (let y = Math.ceil(box.top); y < Math.floor(box.top + box.height); y++) {
    let ink = false;
    for (let x = Math.ceil(box.left); x < Math.floor(box.left + box.width) && !ink; x++) {
      const i = (y * width + x) * 4;
      // Any color but the white behind it: a Link's blue too.
      ink = 765 - pixels[i] - pixels[i + 1] - pixels[i + 2] > 120;
    }
    if (ink && !inLine) lines++;
    inLine = ink;
  }
  return lines;
}

// ─── 1. Keys and lines ────────────────────────────────────────────────────────

describe("1. each block keyed by its node's path, and its lines from its content height", () => {
  const fonts = faces("Liberation Sans");
  const WORDS = "Ferries leave Oban for Stornoway every morning, and the timetable for the summer is out now";
  const canvas = (children: ReactNode) => (
    <Canvas width={600} height={500} style={{ backgroundColor: "#ffffff", color: "#000000", fontFamily: "Liberation Sans", padding: 20 }}>
      <Column style={{ width: 320 }}>{children}</Column>
    </Canvas>
  );

  /** Lines by content height (rounded to the nearest), lines of ink, and the unrounded quotient. */
  async function lines(template: ReactElement, path: string) {
    const { svg, boxes, root } = await layout(template, fonts);
    const box = boxes.get(path)!;
    const node = find(root, path)!;
    expect(box, `the block keyed ${path}`).toBeDefined();
    const padding = (node.style.padding as { top: number; right: number; bottom: number; left: number } | undefined) ?? { top: 0, right: 0, bottom: 0, left: 0 };
    const border = (node.style.border as Record<string, { width: number } | undefined> | undefined) ?? {};
    const inside = {
      left: box.left + padding.left + (border.left?.width ?? 0),
      top: box.top + padding.top + (border.top?.width ?? 0),
      width: box.width - padding.left - padding.right - (border.left?.width ?? 0) - (border.right?.width ?? 0),
      height: contentHeight(box, node),
    };
    // Satori lays each line at its line height rounded to the nearest px (the next test), so that's what lines are of.
    const quotient = contentHeight(box, node) / Math.round(node.text.lineHeightPx);
    return { counted: Math.round(quotient), quotient, ink: inkLines(svg, inside), box, node };
  }

  it("keys every block by its node's path, and the box is the one laid out", async () => {
    const template = canvas(<Text style={{ fontSize: 20 }}>{WORDS}</Text>);
    const { boxes, root } = await layout(template, fonts);
    expect([...boxes.keys()]).toEqual(["root.children[0]", "root.children[0].children[0]"]);
    const text = boxes.get("root.children[0].children[0]")!;
    // Inside the Canvas's 20px padding, at the Column's width.
    expect([text.left, text.top, text.width]).toEqual([20, 20, find(root, "root.children[0].children[0]")!.width ?? 320]);
  });

  it("lays each line at its line height rounded to the nearest px, however many lines", async () => {
    // So a count over the unrounded line height is off by up to half a px a line: 4 lines at 28.6px are 116px, past
    // Decision 10's "4 × 28.6 + 0.5". A line height of n.5 rounds up.
    for (const [lineHeight, perLine] of [[28.2, 28], [28.5, 29], [28.6, 29], [33.49, 33], [33.5, 34], [20.9, 21]]) {
      for (const count of [1, 3, 7]) {
        let height = Number.NaN;
        await satori(
          createElement("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-start" } },
            createElement("div", { key: "t", style: { display: "flex", flexWrap: "wrap", width: 70, fontFamily: "Liberation Sans", fontSize: 22, lineHeight: `${lineHeight}px` } }, Array(count).fill("word").join(" "))),
          { width: 600, fonts: satoriFonts(fonts), onNodeDetected: (node) => node.key === "t" && (height = node.height) } as SatoriOptions
        );
        expect(height, `${count} lines at ${lineHeight}px`).toBe(count * perLine);
      }
    }
  });

  it("counts a Text's lines with padding and a border, exactly", async () => {
    const template = canvas(
      <Text style={{ fontSize: 22, lineHeight: 1.3, padding: [14, 18], border: { width: 3, style: "solid", color: "#cc0000" } }}>{WORDS}</Text>
    );
    const { counted, quotient, ink } = await lines(template, "root.children[0].children[0]");
    expect(ink).toBeGreaterThan(2);
    expect(counted).toBe(ink);
    expect(quotient).toBe(counted);
  });

  it("counts runs in the block's own style (a Span, a Link) exactly", async () => {
    const template = canvas(
      <Heading level={2} style={{ fontSize: 26, lineHeight: 1.25 }}>
        Ferries leave <Span style={{ color: "#333333" }}>Oban for Stornoway</Span> every morning, and the{" "}
        <Link href="https://merrow.example/summer">summer timetable</Link> is out now
      </Heading>
    );
    const { counted, quotient, ink } = await lines(template, "root.children[0].children[0]");
    expect(ink).toBeGreaterThan(2);
    expect(counted).toBe(ink);
    expect(quotient).toBe(counted);
  });

  it("can't count runs in another size from the block's line height: a line holding one is taller (fit/inline ships)", async () => {
    // A Heading with a Span at another size and a Link: the Span's line is as tall as its own line height, so the
    // content height over the Heading's line height isn't the number of lines.
    const template = canvas(
      <Heading level={2} style={{ fontSize: 26, lineHeight: 1.25 }}>
        Ferries leave <Span style={{ fontSize: 44 }}>Oban</Span> for <Span style={{ fontSize: 44 }}>Stornoway</Span> every
        morning, and the <Link href="https://merrow.example/summer">summer timetable</Link> is{" "}
        <Span style={{ fontSize: 44 }}>out now</Span>
      </Heading>
    );
    const { counted, quotient, ink } = await lines(template, "root.children[0].children[0]");
    expect(ink).toBeGreaterThan(2);
    // Each line holding a larger run is taller than the Heading's line height, so the count runs over: by at least a
    // line once two of them are, which is past the one line Decision 10 allows. Mixed sizes are fit/inline.
    expect(counted).toBeGreaterThan(ink);
    expect(Math.abs(quotient - ink)).toBeGreaterThan(1);
  });
});

// ─── 2. Words in one probe ────────────────────────────────────────────────────

/** A word's style, as the writer gives its block of text: what its advance width depends on. */
type WordStyle = Partial<Record<"fontFamily" | "fontSize" | "fontWeight" | "fontStyle" | "letterSpacing" | "textTransform", string | number>>;
const styleKey = (style: WordStyle) => JSON.stringify([style.fontFamily, style.fontSize, style.fontWeight, style.fontStyle, style.letterSpacing, style.textTransform]);

/** Each block of text's words with its style (a span's over its block's), from the writer's model. */
function words(canvas: DrawnCanvas): Array<{ word: string; style: WordStyle }> {
  const out: Array<{ word: string; style: WordStyle }> = [];
  const pick = (style: Record<string, unknown>): WordStyle =>
    Object.fromEntries(["fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing", "textTransform"].filter((k) => style[k] !== undefined).map((k) => [k, style[k]])) as WordStyle;
  const runs = (items: Run[], style: WordStyle) => {
    for (const item of items) {
      if (typeof item === "string") for (const word of item.split(/\s+/).filter(Boolean)) out.push({ word, style });
      else if (item.kind === "span") runs(item.runs, { ...style, ...pick(item.style) });
    }
  };
  const blocks = (items: Block[], inherited: WordStyle) => {
    for (const item of items) {
      if (item.kind === "text") runs(item.runs, { ...inherited, ...pick(item.style) });
      else if (item.kind === "box") blocks(item.children, { ...inherited, ...pick(item.style) });
    }
  };
  blocks(canvas.children, pick(canvas.style));
  return out;
}

/** The fonts each family a Canvas names is drawn in here. */
function standIns(template: ReactElement): Font[] {
  const root = prepare(template).root!;
  const families = new Set<string>(["Liberation Sans", ...((root.props.fonts as Array<{ family: string }> | undefined) ?? []).map((f) => f.family)]);
  return [...families].flatMap(faces);
}

async function widths(items: Array<{ word: string; style: WordStyle }>, fonts: Font[]): Promise<number[]> {
  const found = new Map<string, number>();
  await satori(
    createElement(
      "div",
      { style: { display: "flex", flexDirection: "column", alignItems: "flex-start" } },
      ...items.map(({ word, style }, i) => createElement("div", { key: `w${i}`, style: { display: "flex", ...style } }, word))
    ),
    { width: 100000, fonts: satoriFonts(fonts), onNodeDetected: (node) => typeof node.key === "string" && found.set(node.key, node.width) } as SatoriOptions
  );
  return items.map((_, i) => found.get(`w${i}`)!);
}

/** A word laid out alone: the oracle, in the same metric. */
async function alone(word: string, style: WordStyle, fonts: Font[]): Promise<number> {
  let width = Number.NaN;
  await satori(createElement("div", { key: "w", style: { display: "flex", ...style } }, word), {
    width: 100000,
    fonts: satoriFonts(fonts),
    onNodeDetected: (node) => node.key === "w" && (width = node.width),
  } as SatoriOptions);
  return width;
}

describe("2. words measured in one probe, in advance widths", () => {
  const canvases: Array<[string, ReactElement]> = [
    ["gallery slowSignalsCard", gallery.slowSignalsCard],
    ["stress canvasShapes", stress.canvasShapes.template as ReactElement],
  ];

  it.each(canvases)("measures every distinct word of the %s as it is laid out alone, to 0.5px", async (_, template) => {
    const fonts = standIns(template);
    const root = prepare(template).root!;
    const canvas = writeCanvas(root, { families: new Set(fonts.map((f) => f.family.toLowerCase())), fallback: fonts[0].family, fonts, image: () => undefined });
    const distinct = [...new Map(words(canvas).map((item) => [`${styleKey(item.style)} ${item.word}`, item])).values()];
    expect(distinct.length).toBeGreaterThan(5);
    const probed = await widths(distinct, fonts);
    for (const [i, { word, style }] of distinct.entries()) {
      expect(Math.abs(probed[i] - (await alone(word, style, fonts))), `"${word}" at ${style.fontSize}`).toBeLessThanOrEqual(0.5);
    }
  });

  it("sees a word its box doesn't: one whose ink crosses its box's right edge is wider than its content width", async () => {
    // Chosen by its ink, not its advance width: a word drawn in a box narrower than it, whose ink resvg finds well
    // past the box's right edge. The box Satori gives the node is the container's width; the probe shows the word.
    const fonts = faces("Liberation Sans");
    const word = "Donaudampfschifffahrtsgesellschaft";
    const style: WordStyle = { fontFamily: "Liberation Sans", fontSize: "40px", fontWeight: 400 };
    const template = (
      // No background: resvg's bounding box is then the word's ink alone.
      <Canvas width={900} height={200} style={{ color: "#000000", fontFamily: "Liberation Sans" }}>
        <Column style={{ width: 400 }}>
          <Text style={{ fontSize: 40 }}>{word}</Text>
        </Column>
      </Canvas>
    );
    const { svg, boxes, root } = await layout(template, fonts);
    const path = "root.children[0].children[0]";
    const box = boxes.get(path)!;
    const content = find(root, path)!.contentWidth!;
    const ink = new Resvg(svg, { font: { loadSystemFonts: false } }).getBBox()!;
    // Its ink runs well past the box, which stays at the Column's width.
    expect(box.width).toBe(400);
    expect(content).toBe(400);
    expect(ink.x + ink.width).toBeGreaterThan(box.left + box.width + 100);
    // The probe's advance width says it doesn't fit, as its ink does.
    const [probed] = await widths([{ word, style }], fonts);
    expect(probed).toBeGreaterThan(content + 100);
    expect(Math.abs(probed - (ink.x + ink.width - box.left))).toBeLessThan(10);
  });
});

// ─── 3. Characters no font covers ─────────────────────────────────────────────

describe("3. loadAdditionalAsset", () => {
  const fonts = satoriFonts(faces("Liberation Sans"));
  const text = (content: string) => (
    <div style={{ display: "flex", width: 600, height: 120, backgroundColor: "#ffffff", color: "#000000", fontFamily: "Liberation Sans", fontSize: 32 }}>{content}</div>
  );
  async function draw(content: string, load?: SatoriOptions["loadAdditionalAsset"]) {
    const calls: Array<[string, string]> = [];
    const svg = await satori(text(content), {
      width: 600,
      height: 120,
      fonts,
      ...(load ? { loadAdditionalAsset: async (language: string, segment: string) => (calls.push([language, segment]), load(language, segment)) } : {}),
    } as SatoriOptions);
    const png = new Resvg(svg, { font: { loadSystemFonts: false } }).render().asPng();
    return { svg, png: Buffer.from(png), calls };
  }

  it("isn't called for text the given fonts cover", async () => {
    const { calls } = await draw("Summer timetable, out now: Oban → Stornoway, £12 – 08:30", async () => []);
    expect(calls).toEqual([]);
  });

  it("is called with only the characters no given font covers", async () => {
    const { calls } = await draw("Launch إطلاق 🚀 now", async () => []);
    const asked = calls.map(([, segment]) => segment).join("");
    expect(calls.length).toBeGreaterThan(0);
    for (const char of ["إ", "ط", "ل", "ا", "ق", "🚀"]) expect(asked).toContain(char);
    for (const char of ["L", "a", "u", "n", "c", "h", "o", "w"]) expect(asked).not.toContain(char);
    expect(calls.map(([language]) => language)).toEqual(expect.arrayContaining(["emoji"]));
  });

  it("answered with no font, leaves the image's bytes as they are without it", async () => {
    for (const content of ["Launch إطلاق 🚀 now", "Summer timetable, out now"]) {
      const without = await draw(content);
      const answered = await draw(content, async () => []);
      expect(answered.svg).toBe(without.svg);
      expect(answered.png.equals(without.png)).toBe(true);
    }
  });
});
