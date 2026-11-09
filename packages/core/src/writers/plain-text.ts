/**
 * The plain-text version of a template (emails send it beside the HTML: spam
 * filters count against HTML-only mail), written from the tree rather than
 * read back out of the HTML. Same conventions as Elements 0.2's
 * renderToPlainText: large headings in capitals, a link as "text (url)", an
 * image as "[alt]", a divider as "---", blocks apart by a blank line; list
 * items as "- " or "1. " (nested ones indented), a table's rows a line each,
 * its cells apart by " | "; a Row that wraps (a Menu) a line of what's in it.
 */
import { shownAnywhere } from "../conditions";
import { htmlText } from "../markup";
import { linkParts, type LinkValue } from "../kinds";
import type { ResolvedDocument, ResolvedNode } from "../resolve";

export interface TextOptions {
  /** How a merge tag is written (default `{{name}}`). */
  mergeTag?: (name: string) => string;
}

/** An email service's tag typed into text (`{{name}}`, `{% if vip %}`, `<%= name %>`, `*|FNAME|*`), by its ends: its service reads it case by case. */
const SERVICE_TAGS = [
  ["{{", "}}"],
  ["{%", "%}"],
  ["<%", "%>"],
  ["*|", "|*"],
] as const;

/**
 * Text in capitals, apart from the service tags typed into it: each from its opening to the first close after it,
 * the earliest first. Each end's next place is kept and only ever looked for further on, so the text is read once
 * and a run of openings with no close (text from users) costs what any text does.
 */
function capitals(text: string): string {
  const next: Record<string, number> = {};
  const find = (end: string, from: number) => (next[end] === -1 || next[end] >= from ? next[end] : (next[end] = text.indexOf(end, from)));
  let out = "";
  for (let at = 0; ; ) {
    let tag: [number, number] | undefined;
    for (const [open, close] of SERVICE_TAGS) {
      const start = find(open, at);
      const end = start < 0 ? -1 : find(close, start + open.length);
      if (end >= 0 && (!tag || start < tag[0])) tag = [start, end + close.length];
    }
    if (!tag) return out + text.slice(at).toUpperCase();
    out += text.slice(at, tag[0]).toUpperCase() + text.slice(tag[0], tag[1]);
    at = tag[1];
  }
}

export function renderText(resolved: ResolvedDocument, options: TextOptions = {}): string {
  const tag = options.mergeTag ?? ((name: string) => `{{${name}}}`);

  // `upper`: a large heading's words in capitals. Only its words: a merge tag (a MergeTag or one typed in) or a URL in
  // it is written as it is.
  const inline = (node: ResolvedNode, upper = false): string =>
    node.children
      .map((child) => {
        if (typeof child === "string") return upper ? capitals(child) : child;
        if (!shownAnywhere(child)) return "";
        switch (child.type) {
          case "LineBreak":
            return "\n";
          case "MergeTag":
            return tag(child.props.name as string);
          case "Link":
            return withHref(child, upper);
          case "Image":
            return image(child, upper);
          default:
            return inline(child, upper);
        }
      })
      .join("");

  /** A link as "text (url)", or its URL alone where that's its text. */
  const withHref = (node: ResolvedNode, upper = false): string => {
    const { href } = linkParts(node.props.href as LinkValue);
    const clean = tidy(inline(node));
    return !clean || clean === href ? href : `${upper ? tidy(inline(node, true)) : clean} (${href})`;
  };

  const image = (node: ResolvedNode, upper = false): string => {
    const alt = (node.props.alt as string | undefined)?.trim();
    return alt ? `[${upper ? capitals(alt) : alt}]` : "";
  };

  const blocks = (node: ResolvedNode): string[] =>
    node.children.flatMap((child): string[] => {
      if (typeof child === "string" || !shownAnywhere(child)) return [];
      switch (child.type) {
        case "Heading":
          return [tidy(inline(child, Number(child.props.level) <= 2))];
        case "Text":
          return [tidy(inline(child))];
        case "Button":
          return [withHref(child)];
        case "Link":
          return [withHref(child)];
        case "Image":
          return [image(child)];
        case "Divider":
          return ["---"];
        case "List":
          return [list(child, "")];
        case "Table":
          return [table(child)];
        case "Video":
          return [`${tidy(String(child.props.title))} (${child.props.src})`];
        case "Svg":
          return child.props.title ? [`[${tidy(String(child.props.title))}]`] : [];
        case "Row": {
          // A Row that wraps its children as words wrap (a Menu's links and separators) is a line of them.
          const parts = blocks(child);
          return child.style.flexWrap === "wrap" && parts.every((part) => !part.includes("\n")) ? [parts.filter(Boolean).join(" ")] : parts;
        }
        // A Document's header and footer are on every page: its text is its pages' content, once.
        case "PageHeader":
        case "PageFooter":
          return [];
        case "Html": {
          const words = htmlText(child);
          return words ? [words] : [];
        }
        default:
          return blocks(child);
      }
    });

  const shown = (node: ResolvedNode) => shownAnywhere(node);

  const list = (node: ResolvedNode, indent: string): string =>
    node.children
      .filter((child): child is ResolvedNode => typeof child !== "string" && shown(child))
      .map((item, index) => {
        const marker = node.props.type === "number" ? `${Number(node.props.start) + index}. ` : "- ";
        // The item's text and the Lists in it, in their order: text after a List goes under it, lined up with the first.
        const lines: string[] = [];
        let run: ResolvedNode["children"] = [];
        const flush = () => {
          const text = tidy(inline({ ...item, children: run }));
          if (text) lines.push(`${indent}${lines.length ? " ".repeat(marker.length) : marker}${text}`);
          run = [];
        };
        for (const child of item.children) {
          if (typeof child === "string" || child.type !== "List") {
            run.push(child);
            continue;
          }
          flush();
          if (!lines.length) lines.push(`${indent}${marker}`.trimEnd());
          if (shown(child)) lines.push(list(child, `${indent}  `));
        }
        flush();
        return (lines.length ? lines : [`${indent}${marker}`.trimEnd()]).join("\n");
      })
      .join("\n");

  const table = (node: ResolvedNode): string =>
    node.children
      .filter((row): row is ResolvedNode => typeof row !== "string" && shown(row))
      .map((row) =>
        row.children
          .filter((cell): cell is ResolvedNode => typeof cell !== "string" && shown(cell))
          .map((cell) => tidy(inline(cell)))
          .join(" | ")
      )
      .join("\n");

  return blocks(resolved.root)
    .filter((block) => block.length > 0)
    .join("\n\n");
}

/** Spaces collapsed and each line trimmed, as a reader of plain text expects. */
function tidy(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/[^\S\n]+/g, " ").trim())
    .join("\n")
    .trim();
}
