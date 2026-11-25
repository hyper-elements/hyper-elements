/**
 * A Canvas measured with its fonts, before it's drawn: each fitted Heading's and Text's size chosen (the largest of its
 * sizes at which its lines, its widest word and its fixed-height ancestors all fit), each node's box read back by its
 * path, the text no given font covers, and what runs past the Canvas. What `layoutImage()` returns and what
 * `renderImage()` draws by.
 */
import { fontStack, lineHeightPx, satoriLayout, satoriMissing, satoriWidest, satoriWords, writeCanvas, type DrawnCanvas, type Font, type LaidOutBox, type Style } from "@hyper-elements/core/image";
import type { Diagnostic, ResolvedNode } from "@hyper-elements/react";

export interface LaidOutNode {
  path: string;
  id?: string;
  /** The template field it shows (its own `field`). */
  field?: string;
  /** Its field and those of the runs drawn inside it (a Span's, a Link's). */
  fields: string[];
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** A block of text's lines, from its content height over its line height. */
  lines?: number;
  /** A block of text's font size, as drawn. */
  fontSize?: number;
}

export interface FitResult {
  path: string;
  field?: string;
  /** The sizes in its list that fit with this text. */
  sizes: number[];
  /** The size it's drawn at: the largest that fits, or null where none does. */
  chosen: number | null;
  /** The size above the chosen one, which doesn't fit: its lines, and the word too wide for it where one is. */
  next?: { size: number; lines: number; widestWord?: string };
}

export interface GlyphResult {
  path: string;
  field?: string;
  /** The characters no given font covers. */
  text: string;
  language: string;
}

export interface ImageLayout {
  width: number;
  height: number;
  scale: number;
  nodes: LaidOutNode[];
  fits: FitResult[];
  glyphs: GlyphResult[];
  diagnostics: Diagnostic[];
}

type Sides = { top: number; right: number; bottom: number; left: number };
const sides = (value: unknown): Sides => (value && typeof value === "object" ? (value as Sides) : { top: 0, right: 0, bottom: 0, left: 0 });
const borderWidth = (node: ResolvedNode, side: keyof Sides) => {
  const line = (node.style.border as Record<string, { width?: number; style?: string } | undefined> | undefined)?.[side];
  return line && line.style !== "none" ? (line.width ?? 0) : 0;
};
/** The px of a box that aren't its content, up and down, and across. */
const frame = (node: ResolvedNode) => {
  const padding = sides(node.style.padding);
  return {
    top: padding.top + borderWidth(node, "top"),
    bottom: padding.bottom + borderWidth(node, "bottom"),
    left: padding.left + borderWidth(node, "left"),
    right: padding.right + borderWidth(node, "right"),
  };
};

const shown = (node: ResolvedNode) => !node.hidden?.desktop;
const childNodes = (node: ResolvedNode) => node.children.filter((child): child is ResolvedNode => typeof child !== "string" && shown(child));
const INLINE = new Set(["Span", "Link", "LineBreak", "MergeTag"]);
const TEXT_BLOCKS = new Set(["Heading", "Text", "ListItem", "Button", "Link", "TableCell", "Html", "Video"]);

/** A node's text as it wraps: its own and its runs', with a line break where a LineBreak is (an inline Image has none). */
function wrappingText(node: ResolvedNode): string {
  const parts: string[] = [];
  const visit = (n: ResolvedNode) => {
    for (const child of n.children) {
      if (typeof child === "string") parts.push(child);
      else if (child.type === "LineBreak") parts.push("\n");
      else if (shown(child) && child.type !== "Image") visit(child);
    }
  };
  visit(node);
  return parts.join("");
}

/** A text's pieces between the spaces a line breaks at: what a message names (a no-break space holds its words together). */
const piecesOf = (text: string): string[] => [...new Set(text.split(/[ \t\n\r\u1680\u2000-\u2006\u2008-\u200a\u2028\u2029\u205f\u3000]+/).filter(Boolean))];

const textOf = (node: ResolvedNode): string => {
  const parts: string[] = [];
  const visit = (n: ResolvedNode) => {
    for (const child of n.children) {
      if (typeof child === "string") parts.push(child);
      else if (shown(child) && child.type !== "Image" && (INLINE.has(child.type) || n === node)) visit(child);
    }
  };
  visit(node);
  return parts.join("");
};

/** The fields of a node and of the runs drawn inside it. */
function fieldsOf(node: ResolvedNode): string[] {
  const out = node.field ? [node.field] : [];
  const visit = (n: ResolvedNode) => {
    for (const child of n.children) if (typeof child !== "string" && INLINE.has(child.type)) (child.field && out.push(child.field), visit(child));
  };
  visit(node);
  return out;
}

const walk = (node: ResolvedNode, visit: (node: ResolvedNode, ancestors: ResolvedNode[]) => void, ancestors: ResolvedNode[] = []): void => {
  visit(node, ancestors);
  for (const child of childNodes(node)) walk(child, visit, [...ancestors, node]);
};

interface Context {
  root: ResolvedNode;
  fonts: Font[];
  families: ReadonlySet<string>;
  fallback: string;
  image: (src: string) => string | undefined;
}

const canvasFor = (context: Context, sizes: ReadonlyMap<string, number>): DrawnCanvas =>
  writeCanvas(context.root, { families: context.families, fallback: context.fallback, fonts: context.fonts, image: context.image, sizes });

/** The family a stack is drawn in, as the writer picks it. */
const familyOf = (context: Context, stack: string) => fontStack(stack).find((family) => context.families.has(family.toLowerCase())) ?? context.fallback;

/** A node's text style at a size, as the writer draws its words. */
function wordStyle(context: Context, node: ResolvedNode, size: number): Style {
  const text = node.text;
  return {
    fontFamily: familyOf(context, String(text.fontFamily)),
    fontSize: `${size}px`,
    fontWeight: text.fontWeight,
    fontStyle: text.fontStyle,
    ...(text.letterSpacing ? { letterSpacing: `${text.letterSpacing}px` } : {}),
    ...(text.textTransform !== "none" ? { textTransform: text.textTransform } : {}),
  };
}

/** Lines in a box: its content height over its line height in px, rounded as Satori rounds each line's (half up). */
const linesIn = (node: ResolvedNode, box: LaidOutBox, size: number) => {
  const { top, bottom } = frame(node);
  const perLine = Math.round(lineHeightPx(node.text.lineHeight, size));
  return perLine > 0 ? Math.round((box.height - top - bottom) / perLine) : 0;
};

/** Why a fitted node's inline runs can't be counted (a run in another size, family, weight or line height), or undefined. */
function inlineProblem(node: ResolvedNode): string | undefined {
  let problem: string | undefined;
  const visit = (n: ResolvedNode) => {
    for (const child of childNodes(n)) {
      if (!INLINE.has(child.type) || child.type === "LineBreak" || child.type === "MergeTag") continue;
      const [a, b] = [child.text, node.text];
      if (a.fontSize !== b.fontSize || String(a.fontFamily) !== String(b.fontFamily) || a.fontWeight !== b.fontWeight || a.lineHeightPx !== b.lineHeightPx) problem ??= `its ${child.type} at ${child.path} is in another size, font, weight or line height`;
      visit(child);
    }
  };
  visit(node);
  return problem;
}

const severity = (strict: boolean): Diagnostic["severity"] => (strict ? "error" : "warning");
const where = (node: ResolvedNode) => ({ path: node.path, ...(node.id ? { nodeId: node.id } : {}), ...(node.field ? { field: node.field } : {}) });

/**
 * The Canvas measured: each fitted node's size chosen in document order (each with the sizes chosen before it), then
 * the whole laid out once more at those sizes for its boxes, its missing glyphs and its overflow.
 */
export async function measure(context: Context, options: { strict: boolean; scale: number }): Promise<{ layout: ImageLayout; sizes: Map<string, number> }> {
  const { root } = context;
  const diagnostics: Diagnostic[] = [];
  const sizes = new Map<string, number>();
  const fits: FitResult[] = [];
  const fitted: Array<{ node: ResolvedNode; ancestors: ResolvedNode[] }> = [];
  walk(root, (node, ancestors) => {
    if ((node.type === "Heading" || node.type === "Text") && node.props.fit) fitted.push({ node, ancestors });
  });
  // Each fitted node's smallest size: a node is tried with those after it at theirs, so one that can still shrink is
  // never why an earlier one doesn't fit (sizes are chosen in document order, the first taking the room it can).
  const smallest = new Map<string, number>();
  for (const { node } of fitted) {
    const given = (node.props.fit as { sizes?: number[] }).sizes;
    if (given?.length) smallest.set(node.path, Math.min(...given));
  }
  for (const { node, ancestors } of fitted) {
    const fit = node.props.fit as { sizes?: number[]; maxLines?: number };
    const inline = inlineProblem(node);
    if (inline) {
      diagnostics.push({ code: "fit/inline", severity: "error", message: `A fitted ${node.type} counts its lines by its own line height, and ${inline}: give its runs its own style, or fit it without them`, ...where(node) });
      continue;
    }
    const list = fit.sizes?.length ? fit.sizes : [node.text.fontSize];
    const text = wrappingText(node);
    const contentWidth = node.contentWidth ?? (node.width ?? 0) - frame(node).left - frame(node).right;
    const fixed = ancestors.filter((a) => typeof a.style.height === "number");
    const results: Array<{ size: number; fits: boolean; lines: number; widestWord?: string }> = [];
    for (const size of list) {
      // The fitted nodes after this one at their smallest: what they need at least, which this one's size leaves them.
      const trying = new Map([...smallest, ...sizes]).set(node.path, size);
      const { boxes } = await satoriLayout(canvasFor(context, trying), { natural: true });
      const box = boxes.get(node.path);
      if (!box) {
        results.push({ size, fits: false, lines: 0 });
        continue;
      }
      const lines = linesIn(node, box, size);
      // Its widest piece that can't break, as Satori breaks lines: a node's box doesn't grow with one, so it's measured.
      const style = wordStyle(context, node, size);
      const [widestPiece] = await satoriWidest([{ text, style }], context.fonts);
      const wordFits = widestPiece <= contentWidth + 0.5;
      // Named for the message: the widest of its pieces between spaces.
      let widest = { width: 0, word: "" };
      if (!wordFits) {
        const pieces = piecesOf(text);
        const widths = await satoriWords(pieces.map((piece) => ({ text: piece, style })), context.fonts);
        widest = widths.reduce((best, width, i) => (width > best.width ? { width, word: pieces[i] } : best), widest);
      }
      const linesFit = fit.maxLines === undefined || lines <= fit.maxLines;
      // Its fixed-height ancestors' content stays inside them.
      const insideFixed = fixed.every((ancestor) => {
        const outer = boxes.get(ancestor.path);
        if (!outer) return true;
        const bottom = outer.top + outer.height - frame(ancestor).bottom;
        return childNodes(ancestor).every((child) => {
          const inner = boxes.get(child.path);
          return !inner || inner.top + inner.height <= bottom + 0.5;
        });
      });
      results.push({ size, fits: linesFit && wordFits && insideFixed, lines, ...(wordFits ? {} : { widestWord: widest.word }) });
    }
    const chosenIndex = results.findIndex((r) => r.fits);
    const chosen = chosenIndex >= 0 ? results[chosenIndex].size : null;
    const above = chosenIndex > 0 ? results[chosenIndex - 1] : chosenIndex < 0 ? undefined : undefined;
    fits.push({
      path: node.path,
      ...(node.field ? { field: node.field } : {}),
      sizes: results.filter((r) => r.fits).map((r) => r.size),
      chosen,
      ...(above ? { next: { size: above.size, lines: above.lines, ...(above.widestWord ? { widestWord: above.widestWord } : {}) } } : {}),
    });
    if (chosen === null) {
      const last = results[results.length - 1];
      const cut = fit.maxLines && last.lines > fit.maxLines ? Math.ceil(textOf(node).length * (1 - fit.maxLines / last.lines)) : 0;
      const why = last.widestWord
        ? `"${last.widestWord}" is wider than its ${Math.round(contentWidth)}px even at ${last.size}px`
        : fit.maxLines && last.lines > fit.maxLines
          ? `it takes ${last.lines} lines at ${last.size}px, its smallest size, and fits ${fit.maxLines}: cut about ${cut} characters`
          : `it doesn't fit inside a box of fixed height at ${last.size}px, its smallest size`;
      diagnostics.push({ code: "image/fit", severity: "error", message: `This ${node.type} doesn't fit: ${why}`, ...where(node), fix: "Shorten the text, or give the template a smaller size" });
      sizes.set(node.path, last.size);
    } else sizes.set(node.path, chosen);
  }
  // The whole laid out once at the chosen sizes: boxes, missing glyphs, overflow.
  const canvas = canvasFor(context, sizes);
  const { boxes, missing } = await satoriLayout(canvas);
  const nodes: LaidOutNode[] = [];
  walk(root, (node) => {
    const box = boxes.get(node.path);
    if (!box) return;
    const textual = TEXT_BLOCKS.has(node.type) && node.children.some((c) => typeof c === "string" || INLINE.has(c.type));
    const size = sizes.get(node.path) ?? node.text.fontSize;
    nodes.push({
      path: node.path,
      ...(node.id ? { id: node.id } : {}),
      ...(node.field ? { field: node.field } : {}),
      fields: fieldsOf(node),
      type: node.type,
      x: box.left,
      y: box.top,
      width: box.width,
      height: box.height,
      ...(textual ? { lines: linesIn(node, box, size), fontSize: size } : {}),
    });
  });
  // Overflow, from the natural layout (nothing shrunk to fit the Canvas): a node whose box runs past it, outermost only.
  const width = Number(root.props.width);
  const height = Number(root.props.height);
  const natural = (await satoriLayout(canvas, { natural: true })).boxes;
  const over: Array<{ node: ResolvedNode; right: number; bottom: number }> = [];
  walk(root, (node, ancestors) => {
    if (node === root) return;
    const box = natural.get(node.path);
    if (!box || ancestors.some((a) => over.some((o) => o.node === a))) return;
    const right = box.left + box.width - width;
    const bottom = box.top + box.height - height;
    if (right > 0.5 || bottom > 0.5) over.push({ node, right, bottom });
  });
  // Said once, at the first node past the Canvas, with how many are and how far the furthest goes.
  if (over.length) {
    const [first] = over;
    const bottom = Math.max(...over.map((o) => o.bottom));
    const right = Math.max(...over.map((o) => o.right));
    const past = bottom > 0.5 ? `${Math.round(bottom)}px past its bottom` : `${Math.round(right)}px past its right edge`;
    const more = over.length > 1 ? ` and ${over.length - 1} more after it` : "";
    diagnostics.push({ code: "image/overflow", severity: severity(options.strict), message: `Content runs past the Canvas: this ${first.node.type}${more}, up to ${past}. What's past it is cut`, ...where(first.node) });
  }
  // Glyphs: each segment Satori asked a font for, matched to the text nodes holding it, each confirmed alone.
  const glyphs: GlyphResult[] = [];
  if (missing.length) {
    const chars = new Set(missing.flatMap((m) => [...m.segment]));
    const languages = new Map<string, string>();
    for (const m of missing) for (const c of m.segment) languages.set(c, m.language);
    const candidates: ResolvedNode[] = [];
    walk(root, (node) => {
      if (node.children.some((c) => typeof c === "string" && [...c].some((ch) => chars.has(ch)))) candidates.push(node);
    });
    const fittedPaths = new Set(fitted.map((f) => f.node.path));
    for (const node of candidates) {
      const text = textOf(node);
      const segments = await satoriMissing(text, wordStyle(context, node, sizes.get(node.path) ?? node.text.fontSize), context.fonts);
      const lacking = [...new Set(segments.flatMap((s) => [...s]).filter((c) => c.trim()))].join("");
      if (!lacking) continue;
      const language = languages.get([...lacking][0]) ?? "unknown";
      glyphs.push({ path: node.path, ...(node.field ? { field: node.field } : {}), text: lacking, language });
      diagnostics.push({
        code: "image/glyph",
        severity: options.strict || fittedPaths.has(node.path) ? "error" : "warning",
        message: `No font given draws "${lacking}" (${language}): it's drawn as an empty box. Give a font that covers it`,
        ...where(node),
      });
    }
  }
  // Strict: text whose stack names no given font, which would be drawn in the first given one.
  if (options.strict) {
    walk(root, (node) => {
      if (!node.children.some((c) => typeof c === "string" && c.trim())) return;
      const stack = fontStack(String(node.text.fontFamily));
      if (!stack.some((family) => context.families.has(family.toLowerCase()))) {
        diagnostics.push({ code: "image/font", severity: "error", message: `No font in this ${node.type}'s stack (${stack.join(", ")}) is given: it would be drawn in ${context.fallback}. Give its file in renderImage's fonts option`, ...where(node) });
      }
    });
  }
  return { layout: { width, height, scale: options.scale, nodes, fits, glyphs, diagnostics }, sizes };
}
