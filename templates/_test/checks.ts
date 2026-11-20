/**
 * The checks the matrix runs on a design's laid-out tree, as a plugin passed to `validate()`, whose `check` sees the
 * tree for every root. A plugin's diagnostics are warnings at most, so this one records what it finds in its own list.
 *
 * - neutral: with a probe brand, every color and font in the tree is one of the probe's tokens
 * - pairs: with a probe brand, text is drawn only in the brand's checked pairs, on its painted background
 * - contrast: with a real brand, text and its painted background are at least 4.5:1 (3:1 for large text that isn't fitted)
 * - no `Html`, and images only from the assets folder
 */
import type { ElementsPlugin, PluginNode } from "@hyper-elements/react";
import { ASSETS, PAIRS, contrast, rgbOf } from "../_brand";

export interface Finding {
  check: "neutral" | "pairs" | "contrast" | "html" | "image";
  path: string;
  message: string;
}

const ALLOWED_COLORS = new Set(["transparent", "inherit", "currentcolor"]);
const COLOR_KEY = /color$|^color|^fill$|^stroke$|^background$/i;
const PAIR_SET = new Set(PAIRS.map(([text, background]) => `${text}/${background}`));

/** Every color-valued style in a node's style, phone and hover blocks, nested values included, by key path. */
function colorsOf(node: PluginNode): Array<{ at: string; value: string }> {
  const out: Array<{ at: string; value: string }> = [];
  const visit = (value: unknown, at: string, key: string) => {
    if (typeof value === "string") {
      if (COLOR_KEY.test(key)) out.push({ at, value });
      return;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) for (const [k, v] of Object.entries(value)) visit(v, `${at}.${k}`, k);
  };
  for (const [block, style] of [["style", node.style], ["hover", node.hover], ["mobile", node.mobile]] as const) {
    if (style) for (const [key, value] of Object.entries(style)) visit(value, `${node.path}.${block}.${key}`, key);
  }
  return out;
}

const hasWords = (node: PluginNode) => node.children.some((child) => typeof child === "string" && child.trim());
const isLarge = (node: PluginNode) => !node.props.fit && (node.text.fontSize >= 24 || (node.text.fontSize >= 18.66 && node.text.fontWeight >= 700));
const opaque = (color: unknown): color is string => typeof color === "string" && !ALLOWED_COLORS.has(color.toLowerCase());

export interface CheckOptions {
  /** A probe's colors by value ("#010111" → "background"), and its two font stacks. */
  probe?: { names: Map<string, string>; fonts: Set<string> };
  /** A real brand: the contrast check. */
  contrast?: boolean;
}

/** The plugin, and the list it fills. */
export function checker(options: CheckOptions): { plugin: ElementsPlugin; findings: Finding[] } {
  const findings: Finding[] = [];
  const add = (check: Finding["check"], path: string, message: string) => findings.push({ check, path, message });
  const plugin: ElementsPlugin = {
    name: "templates-folder-checks",
    api: 1,
    check({ root }) {
      // The backgrounds every Document page paints, for headers and footers drawn on each.
      const pages = root.type === "Document" ? root.children.filter((c): c is PluginNode => typeof c !== "string" && c.type === "Document.Page") : [];
      const walk = (node: PluginNode, chain: PluginNode[]) => {
        const ancestors = [...chain, node];
        if (node.type === "Html") add("html", node.path, "An Html block: raw markup is outside every check, so designs hold none");
        const src = node.type === "Image" ? (typeof node.props.src === "string" ? node.props.src : (node.props.src as { src?: string } | undefined)?.src) : undefined;
        if (src !== undefined && !src.startsWith(ASSETS)) add("image", node.path, `${src} isn't under ${ASSETS}`);
        if (options.probe) {
          for (const { at, value } of colorsOf(node)) {
            if (!ALLOWED_COLORS.has(value.toLowerCase()) && !options.probe.names.has(value.toLowerCase())) add("neutral", at, `${value} isn't one of the brand's colors`);
          }
          const family = node.style.fontFamily;
          if (typeof family === "string" && !options.probe.fonts.has(family)) add("neutral", `${node.path}.style.fontFamily`, `${family} isn't one of the brand's fonts`);
        }
        if (hasWords(node)) {
          const background = paintedBackgrounds(ancestors, root, pages);
          if (!background.length) add(options.probe ? "pairs" : "contrast", node.path, "Its painted background can't be known (text inside a Layer needs a background set on its own box)");
          for (const bg of background) {
            const fg = node.text.color;
            if (options.probe) {
              const [text, under] = [options.probe.names.get(fg.toLowerCase()), options.probe.names.get(bg.toLowerCase())];
              if (!text || !under || !PAIR_SET.has(`${text}/${under}`)) add("pairs", node.path, `Text in ${text ?? fg} on ${under ?? bg} isn't one of the brand's pairs`);
            }
            if (options.contrast && rgbOf(fg) && rgbOf(bg)) {
              const ratio = contrast(fg, bg);
              const needed = isLarge(node) ? 3 : 4.5;
              if (ratio < needed) add("contrast", node.path, `${fg} on ${bg} is ${ratio.toFixed(2)}:1; this text needs ${needed}:1`);
            }
          }
        }
        for (const child of node.children) if (typeof child !== "string") walk(child, ancestors);
      };
      walk(root, []);
      return [];
    },
  };
  return { plugin, findings };
}

/**
 * The colors painted behind a node's text: the nearest opaque background up the tree, from the node itself. Inside a
 * Layer, later children paint over earlier ones, so a background must be set between the text and the Layer's child
 * holding it, or none can be known. A page header or footer is painted on every page: against each page's background.
 */
function paintedBackgrounds(ancestors: PluginNode[], root: PluginNode, pages: PluginNode[]): string[] {
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const node = ancestors[i];
    if (opaque(node.style.backgroundColor)) return [node.style.backgroundColor];
    const parent = ancestors[i - 1];
    if (parent?.type === "Layer") return [];
    if (node.type === "PageHeader" || node.type === "PageFooter") {
      const rootBg = opaque(root.style.backgroundColor) ? [root.style.backgroundColor] : [];
      const pageBgs = pages.map((page) => (opaque(page.style.backgroundColor) ? page.style.backgroundColor : rootBg[0])).filter(opaque);
      return [...new Set([...rootBg, ...pageBgs])];
    }
  }
  return [];
}
