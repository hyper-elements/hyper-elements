/**
 * Design checks: what makes a reader turn an email down, found in a template laid out (`prepareTemplate`'s tree). They
 * are warnings, separate from rendering's diagnostics: `check()` in `@hyper-elements/react/check` runs them, and
 * the preview command runs it on every preview. Each one fires only where its problem is there, and says what to
 * write instead. None measures text: a table's phone widths are worked out from the layout's rules, not from glyphs.
 *
 * Each check was kept because, run over earlier agent-built emails, it fired where reviewers named its problem.
 * Two that didn't were left out: small text (under 12px fired as often on emails reviewers liked) and text in a
 * narrow box on phones (it fired on side-by-side layouts reviewers asked for, and missed the ones they called cramped).
 */
import type { Diagnostic } from "../diagnostics";
import type { Json } from "../model";
import type { ResolvedNode } from "../resolve";
import { contrastRatio, over, parseRgba, type Rgba } from "./color";

export { contrastRatio, parseRgba, type Rgba } from "./color";

/** A phone's width in px: the content of an Email or a Page fills it. */
export const PHONE_WIDTH = 375;
/** A table with this many columns or more keeps them all on a phone, each too narrow for an item's name. */
const MANY_COLUMNS = 4;
/** Under this contrast with what's behind it, text can't be read easily (WCAG asks 3:1 of large text, 4.5:1 of the rest). */
export const LOW_CONTRAST = 3;

/** The blocks that hold text a reader reads. */
const TEXT_BLOCKS = new Set(["Text", "Heading", "ListItem", "TableCell", "Button"]);
const WHITE: Rgba = [255, 255, 255, 1];
const TAG = /\{\{\s*[\w.-]+\s*\}\}/;
/** A phone number, its parts joined by spaces or hyphens, breaking or not: "+1 (503) 555-0142", "020 7946 0018". */
const PHONE_NUMBER = /(?:\+\d{1,3}[ .\-\u00a0\u2011]?)?(?:\(\d{2,4}\)[ .\-\u00a0\u2011]?|\d{2,4}[ .\-\u00a0\u2011])\d{2,4}[ .\-\u00a0\u2011]\d{3,5}(?!\d)/g;

const isNode = (child: ResolvedNode | string): child is ResolvedNode => typeof child !== "string";

/** The words a block shows, its MergeTags as `{{name}}`. */
function words(node: ResolvedNode): string {
  return node.children.map((child) => (isNode(child) ? (child.type === "MergeTag" ? `{{${String(child.props.name)}}}` : child.type === "LineBreak" ? " " : words(child)) : child)).join("");
}

/** A length in px, or a share of `of` ("50%"); undefined when it isn't one. */
function length(value: Json | undefined, of: number): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return undefined;
  const px = /^(-?[\d.]+)(px)?$/.exec(value.trim());
  if (px) return Number(px[1]);
  const share = /^([\d.]+)%$/.exec(value.trim());
  return share ? (Number(share[1]) / 100) * of : undefined;
}

/** A box's side insets (padding and border) on phones: its phone padding replaces its own. */
function sides(node: ResolvedNode): number {
  const side = (insets: Json | undefined, key: "left" | "right"): number => {
    if (typeof insets === "number") return insets;
    if (insets && typeof insets === "object" && !Array.isArray(insets)) return Number((insets as Record<string, Json>)[key]) || 0;
    if (Array.isArray(insets)) return Number(insets[insets.length === 4 ? (key === "left" ? 3 : 1) : 1] ?? insets[0]) || 0;
    return 0;
  };
  const border = (value: Json | undefined, key: "left" | "right"): number => {
    const side = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, Json>)[key] : undefined;
    return side && typeof side === "object" && !Array.isArray(side) ? Number((side as Record<string, Json>).width) || 0 : 0;
  };
  const padding = node.mobile?.padding ?? node.style.padding;
  const frame = node.mobile?.border ?? node.style.border;
  return side(padding, "left") + side(padding, "right") + border(frame, "left") + border(frame, "right");
}

/** A box's width on phones in px, given what its parent gives it there. In a Row or a Grid that stacks on phones it fills that width (`filled`), whatever its desktop width. */
function outer(node: ResolvedNode, available: number, filled: boolean): number {
  const own = length(node.mobile?.width, available) ?? (node.type === "Section" || filled ? undefined : length(node.style.width, available));
  const most = length(node.mobile?.maxWidth ?? node.style.maxWidth, available);
  return Math.max(0, Math.min(available, own ?? available, most ?? available));
}

/** A node as the checks walk it: a Table and its rows carry its columns' phone widths. */
type Walked = ResolvedNode & { columnsOnPhone?: number[] };

/** What each child of a box gets on phones, in px. */
function childWidths(node: Walked, content: number): Map<ResolvedNode, number> {
  // (A Row or Grid that stacks gives each child the whole width: see `stacks`.)
  const shown = node.children.filter(isNode).filter((child) => !child.hidden?.mobile);
  const out = new Map<ResolvedNode, number>();
  const gap = length(node.mobile?.gap ?? node.style.gap, content) ?? 0;
  if (node.type === "Row" && node.props.stackOnMobile === false && shown.length > 1) {
    // Side by side on phones: children that ask a phone width keep it, the rest share what's left as on desktop.
    const fixed = shown.filter((child) => length(child.mobile?.width, content) !== undefined);
    const left = content - gap * (shown.length - 1) - fixed.reduce((sum, child) => sum + (length(child.mobile?.width, content) ?? 0), 0);
    const sharing = shown.filter((child) => !fixed.includes(child));
    const total = sharing.reduce((sum, child) => sum + (child.width ?? 0), 0);
    for (const child of fixed) out.set(child, length(child.mobile?.width, content)!);
    for (const child of sharing) out.set(child, Math.max(0, total > 0 && child.width ? (left * child.width) / total : left / sharing.length));
    return out;
  }
  if (node.type === "Grid" && node.props.stackOnMobile === false) {
    const columns = Number(node.props.columns) || 1;
    for (const child of shown) out.set(child, Math.max(0, (content - gap * (columns - 1)) / columns));
    return out;
  }
  if (node.type === "TableRow" && Array.isArray(node.columnsOnPhone)) {
    let column = 0;
    for (const cell of shown) {
      const span = Number(cell.props.colSpan) || 1;
      out.set(cell, node.columnsOnPhone.slice(column, column + span).reduce((sum: number, width: number) => sum + width, 0));
      column += span;
    }
    return out;
  }
  for (const child of shown) out.set(child, content);
  return out;
}

/** A Row or a Grid whose children go one under another on phones, each the whole width. */
const stacks = (node: ResolvedNode) => (node.type === "Row" || node.type === "Grid") && node.props.stackOnMobile !== false;

/**
 * The design checks of a template laid out. `phone` is false for a Document or a Canvas (they have no phone layout):
 * then only the checks that don't depend on one run.
 */
export function designChecks(root: ResolvedNode, options: { phoneWidth?: number } = {}): Diagnostic[] {
  const out: Diagnostic[] = [];
  const warn = (code: string, node: ResolvedNode, message: string, at = "") =>
    out.push({ code, severity: "warning", message, path: node.path + at, ...(node.id ? { nodeId: node.id } : {}) });
  const phone = root.type === "Email" || root.type === "Page";
  const phoneWidth = options.phoneWidth ?? PHONE_WIDTH;
  const rootBackground = parseRgba(root.style.backgroundColor);
  const page = rootBackground && rootBackground[3] === 1 ? rootBackground : WHITE;

  const visit = (node: Walked, available: number, background: Rgba | undefined, filled: boolean) => {
    if (node.hidden?.mobile && node.hidden?.desktop) return;
    const onPhone = phone && !node.hidden?.mobile;
    const width = node === root ? Math.min(available, length(root.props.width, available) ?? available) : outer(node, available, filled);
    const content = Math.max(0, width - sides(node));
    // What's behind it: its own background over its parent's; unknown under an image (a Layer's).
    const own = parseRgba(node.style.backgroundColor);
    const behind = node.type === "Layer" ? undefined : own && background ? over(own, background) : background;
    const text = TEXT_BLOCKS.has(node.type) ? words(node) : "";

    if (node.type === "MergeTag") {
      warn("design/merge-tag-visible", node, `<MergeTag name="${String(node.props.name)}" /> shows as {{${String(node.props.name)}}} until a sending service fills it in, and a reader of this design sees a placeholder. Write the text itself (a name, an address), or leave it out; a service's tag can go in a Link's href (href="{{unsubscribe_url}}"), where it doesn't show.`);
    }
    for (const child of node.children) {
      if (typeof child === "string" && TAG.test(child) && node.type !== "MergeTag") {
        warn("design/merge-tag-visible", node, `"${TAG.exec(child)![0]}" shows as written: a reader of this design sees a placeholder. Write the text itself, or leave it out; a sending service's tag can go in a Link's href, where it doesn't show.`);
        break;
      }
    }

    if (node.type === "Image") {
      const alt = node.props.alt;
      if (typeof alt !== "string" || !alt.trim()) warn("design/alt", node, `This Image has no alt text. Mail apps that block images show the alt text instead: say what it shows (alt="Stoneware mug, speckled oat"), a product thumbnail's name included.`, ".props.alt");
    }

    if (text.trim()) {
      const color = parseRgba(node.text.color);
      const back = node.type === "Button" ? (own ? over(own, behind ?? page) : undefined) : behind;
      if (color && back) {
        const ratio = contrastRatio(color, back);
        if (ratio < LOW_CONTRAST) warn("design/contrast", node, `This text's color has a contrast of ${ratio.toFixed(1)}:1 with what's behind it, which is hard to read. Use a darker or lighter color, ${LOW_CONTRAST}:1 at least (4.5:1 for body text is better).`, ".style.color");
      }
      for (const match of text.matchAll(PHONE_NUMBER)) {
        if (/[ -]/.test(match[0])) {
          warn("design/phone-number", node, `On a narrow screen "${match[0]}" can break at a space or a hyphen and split across two lines. Join its parts with non-breaking spaces and hyphens: ${match[0].replace(/ /g, "&nbsp;").replace(/-/g, "&#8209;")}.`);
          break;
        }
      }
    }

    if (onPhone && node.type === "Table") {
      const columns = Array.isArray(node.columns) ? node.columns : null;
      if (columns && columns.length) {
        const total = columns.reduce((sum, width) => sum + width, 0) || 1;
        const widths = columns.map((width) => (content * width) / total);
        (node as Walked).columnsOnPhone = widths;
        const narrowest = Math.min(...widths);
        if (columns.length >= MANY_COLUMNS) {
          warn("design/table-columns", node, `On phones this table keeps its ${columns.length} columns, the narrowest about ${Math.round(narrowest)}px wide, so their text breaks into short lines. Give line items two columns: the item with its quantity and unit price under its name, the amount on the right.`);
        }
      }
    }

    const children = childWidths(node, content);
    for (const child of node.children) {
      if (!isNode(child)) continue;
      if (node.type === "Table" && child.type === "TableRow") (child as Walked).columnsOnPhone = (node as Walked).columnsOnPhone;
      visit(child as Walked, children.get(child) ?? content, behind, stacks(node));
    }
  };
  visit(root as Walked, phoneWidth, page, false);
  return out;
}
