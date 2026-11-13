/** The template rules, over the tree as a reader gets it (tree.ts). */
import type { PluginDiagnostic, PluginInput, PluginNode } from "@hyper-elements/react";
import { genericWords, meaninglessAlt, mergeSyntaxIn, targetProblem } from "./checks";
import { contrast, hex, over, parseColor } from "./color";
import type { Settings } from "./options";
import { quote } from "./quote";
import { ruleById, rules } from "./rules";
import { hrefOf, imagesIn, nameOf, ownsText, readTree, WIDTHS, wordsOf, type Info, type Tree, type Width } from "./tree";

/** Right-to-left languages, by their primary subtag. */
const RTL = new Set(["ar", "fa", "he", "ur", "yi", "ps", "sd", "ug", "dv", "ckb"]);
/** What can say "unsubscribe" in a link, a button or a merge tag. */
const UNSUBSCRIBE = /unsubscribe|opt[ -]out|manage preferences/i;
/** The components whose text is body text: what `text-size` checks (and the inline components inside them). */
const BODY = new Set(["Text", "ListItem", "TableCell"]);
/** The components that hold their children as text. */
const HOLDS_TEXT = new Set(["Text", "Heading", "Span", "Link", "Button", "TableCell", "ListItem"]);
const MIN_SIZE = 14;
const ORDER = new Map(rules.map((r, i) => [r.id, i]));

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const px = (n: number) => `${Math.round(n * 100) / 100}px`;
const widthsText = (widths: Width[]) => (widths.length === 2 ? "" : widths[0] === "mobile" ? " on phones" : " on desktop");

export interface Found {
  id: string;
  node: PluginNode;
  /** Where in reading order: findings are listed by node, then by rule. */
  at: number;
  message: string;
  /** A path below the node's (`props.alt`), where the finding is about one of its values. */
  under?: string;
}

/** Every template rule's findings on a tree, in reading order. */
export function checkTree(tree: Tree, kind: "marketing" | "transactional" | undefined, on: (id: string) => boolean): Found[] {
  const found: Found[] = [];
  const seen = new Set<string>();
  const index = new Map(tree.nodes.map((info, i) => [info.node, i]));
  // What each node's run got, so a run inside text (a Span) doesn't repeat what the run around it got.
  const ofRun = new Map<PluginNode, Set<string>>();
  const add = (id: string, node: PluginNode, message: string, under?: string) => {
    if (!on(id)) return;
    const key = `${id}\u0000${node.path}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ id, node, at: index.get(node) ?? 0, message, ...(under ? { under } : {}) });
  };
  const addRun = (info: Info, id: string, message: string) => {
    const parent = info.parent && HOLDS_TEXT.has(info.node.type) && HOLDS_TEXT.has(info.parent.node.type) ? ofRun.get(info.parent.node) : undefined;
    let own = ofRun.get(info.node);
    if (!own) ofRun.set(info.node, (own = new Set()));
    own.add(`${id}\u0000${message}`);
    if (!parent?.has(`${id}\u0000${message}`)) add(id, info.node, message);
  };
  const root = tree.root.node;
  const isEmail = tree.rootType === "Email";

  // The root's own.
  const lang = text(root.props.lang);
  if (!lang) add("lang", root, `The ${tree.rootType} has no lang, so screen readers guess its language`, "props.lang");
  else if (RTL.has(lang.toLowerCase().split(/[-_]/)[0]!) && !text(root.props.dir)) {
    add("dir", root, `Its language, ${quote(lang)}, is written right to left, but the ${tree.rootType} has no dir`, "props.dir");
  }
  if (!isEmail && !text(root.props.title)) add("title", root, "The Page has no title for the browser's tab and for screen readers", "props.title");
  if (isEmail) {
    const preview = text(root.props.previewText);
    if (!preview) add("preview-text", root, "The Email has no previewText, so inboxes show its first words after the subject", "props.previewText");
    else if ([...preview].length < 30) {
      const n = [...preview].length;
      add("preview-text", root, `The Email's previewText is ${n} character${n === 1 ? "" : "s"} (${quote(preview)}): inboxes fill the rest with its first words`, "props.previewText");
    }
  }
  if (isEmail && kind === "marketing") {
    const has = tree.nodes.some(({ node }) => {
      if (node.type === "MergeTag") return UNSUBSCRIBE.test(String(node.props.name ?? ""));
      if (node.type !== "Link" && node.type !== "Button") return false;
      return UNSUBSCRIBE.test(nameOf(node)) || UNSUBSCRIBE.test(hrefOf(node) ?? "");
    });
    if (!has) add("unsubscribe", root, "This marketing email has no link to unsubscribe or manage preferences");
  }

  // Headings, at each width over the ones shown there; a heading's finding names the widths it's found at.
  const headings = new Map<PluginNode, Map<string, { widths: Width[]; message: (where: string) => string }>>();
  for (const width of WIDTHS) {
    let previous: number | undefined;
    let ones = 0;
    const note = (node: PluginNode, id: string, message: (where: string) => string) => {
      let byId = headings.get(node);
      if (!byId) headings.set(node, (byId = new Map()));
      const entry = byId.get(id);
      if (entry) entry.widths.push(width);
      else byId.set(id, { widths: [width], message });
    };
    for (const info of tree.nodes) {
      if (info.node.type !== "Heading" || !info.visible[width]) continue;
      const level = Number(info.node.props.level) || 1;
      const before = previous;
      if (before !== undefined && level > before + 1) note(info.node, "heading-order", (where) => `This level-${level} heading follows a level-${before} one${where}: a screen reader's list of headings skips a level`);
      if (level === 1 && ++ones > 1) note(info.node, "heading-one", (where) => `This is a second level-1 heading${where}`);
      previous = level;
    }
  }
  for (const [node, byId] of headings) for (const [id, { widths, message }] of byId) add(id, node, message(widthsText(widths)), "props.level");

  for (const info of tree.nodes) {
    const { node } = info;
    switch (node.type) {
      case "Heading":
        if (!wordsOf(node)) add("heading-empty", node, "This heading has no words");
        break;
      case "Link":
      case "Button": {
        const label = text(node.props["aria-label"]);
        const words = wordsOf(node);
        const what = node.type === "Link" ? "link" : "button";
        if (!nameOf(node)) {
          if (node.type === "Link" && imagesIn(node).length) add("image-alt", node, "This link holds only images with no alt: a screen reader has nothing to read out for it");
          else add("link-empty", node, `This ${what} has no words, aria-label or title: nothing names it`);
        } else if (!label && words && genericWords(words)) {
          add("link-text", node, `The ${node.type} says ${quote(words)}: a screen reader lists links by their words alone`);
        }
        const href = hrefOf(node);
        const problem = href === undefined ? undefined : targetProblem(href);
        if (problem) add("link-target", node, `This ${what} ${problem}`, "props.href");
        break;
      }
      case "Image": {
        const alt = text(node.props.alt);
        if (meaninglessAlt(alt)) add("alt-text", node, `The image's alt, ${quote(alt)}, says nothing about what it shows`, "props.alt");
        break;
      }
      case "Video":
        if (node.props.title === "Video") add("video-title", node, 'The video\'s title is the default, "Video"', "props.title");
        break;
    }
    // Merge syntax typed into text: on the block that holds it, once.
    if (HOLDS_TEXT.has(node.type) && !(info.parent && HOLDS_TEXT.has(info.parent.node.type))) {
      const syntax = mergeSyntaxIn(wordsOf(node, { mergeTags: false }));
      if (syntax) add("merge-syntax", node, `The text holds ${quote(syntax)}, typed by hand: a MergeTag writes the sending service's syntax`);
    }
    if (ownsText(node)) runChecks(info, addRun);
  }
  return found.sort((a, b) => a.at - b.at || ORDER.get(a.id)! - ORDER.get(b.id)!);
}

/** The checks on a run of text: contrast, and size for body text. Each names the widths it's found at, where not both. */
function runChecks(info: Info, add: (info: Info, id: string, message: string) => void) {
  const { node } = info;
  const color = parseColor(node.text.color);
  const weight = node.text.fontWeight;
  if (color) {
    const faint: Array<{ width: Width; message: string }> = [];
    for (const width of WIDTHS) {
      const under = info.under[width];
      if (!info.visible[width] || typeof under === "string") continue;
      const fg = color.a < 1 ? over(color, under) : color;
      const ratio = contrast(fg, under);
      const size = info.size[width];
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      const needs = large ? 3 : 4.5;
      if (ratio < needs) faint.push({ width, message: `This text is ${Math.floor(ratio * 100) / 100}:1 against its background (${hex(fg)} on ${hex(under)})%s: ${large ? "large" : "body"} text needs ${needs}:1` });
    }
    if (faint.length) add(info, "contrast", faint[0]!.message.replace("%s", widthsText(faint.map((f) => f.width))));
  }
  // Size: body text only (a Text, ListItem or TableCell, and the runs inside them), at each width it's shown.
  let block: Info = info;
  while ((block.node.type === "Span" || block.node.type === "Link") && block.parent && HOLDS_TEXT.has(block.parent.node.type)) block = block.parent;
  if (!BODY.has(block.node.type)) return;
  const small = WIDTHS.filter((width) => info.visible[width] && info.size[width] < MIN_SIZE);
  if (small.length) {
    const sizes = small.map((w) => px(info.size[w]));
    const said = sizes.length === 2 && sizes[0] !== sizes[1] ? `${sizes[0]} on desktop and ${sizes[1]} on phones` : `${sizes[0]}${widthsText(small)}`;
    add(info, "text-size", `This text is ${said}, under ${MIN_SIZE}px`);
  }
}

/** Findings as diagnostics core keeps: `email/lint-<id>` or `page/lint-<id>`, with the rule's severity, fix and docs. */
export function lintInput(input: PluginInput, settings: Settings, kind: "marketing" | "transactional" | undefined): PluginDiagnostic[] {
  const tree = readTree(input.root);
  if (!tree) return [];
  const prefix = tree.rootType === "Email" ? "email" : "page";
  const on = (id: string) => settings.get(id) !== "off" && ruleById(id)!.roots.includes(tree.rootType);
  return checkTree(tree, kind, on).map(({ id, node, message, under }) => {
    const rule = ruleById(id)!;
    const d: PluginDiagnostic = { code: `${prefix}/lint-${id}`, severity: settings.get(id) as "info" | "warning", message, path: under ? `${node.path}.${under}` : node.path, fix: rule.fix, see: rule.see };
    if (node.id) d.nodeId = node.id;
    return d;
  });
}
