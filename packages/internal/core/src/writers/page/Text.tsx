/**
 * A Text: a `<p>` with the text styles that differ from its parent's. A
 * Heading is the same with its own tag.
 */
import type { ResolvedNode, ResolvedText } from "../../resolve";
import { Fragment, h, type Html } from "../jsx";
import { textDeclarations } from "../shared/css";
import type { Props, Component } from "./context";
import { runsBetween } from "./flowed";
import { box } from "./layout";

/** Runs with nothing in them a browser draws: spaces only, or nothing (in a Span or a Link, or not). */
const blank = (runs: Array<ResolvedNode | string>): boolean => runs.every((run) => (typeof run === "string" ? !run.trim() : (run.type === "Span" || run.type === "Link") && blank(run.children)));

/** Points in px (a point is 4/3 px), to a thousandth. */
const px = (points: number) => `${Math.round((points / 0.75) * 1000) / 1000}px`;

/**
 * A block of text cut between pages (a Plan's part of it, flowed.ts): its lines one under another, each as measured,
 * on a line of its own that doesn't wrap, with the room its spaces between words were given (in px: a point is 4/3 px),
 * and its hyphen where it ends in a broken word. A line with nothing drawn in it (between two line breaks, or spaces
 * only) is as tall as it was measured, as in the PDF: a browser draws a line of nothing 0 tall.
 */
function lines(node: ResolvedNode, render: Props["render"]): Html {
  const { lines: measured, page } = node.flowed!;
  return (
    <>
      {measured.map((line) => {
        const runs = runsBetween(node.children, line.start, line.end, page);
        return (
          <span style={{ display: "block", whiteSpace: "nowrap", wordSpacing: line.wordSpacing ? px(line.wordSpacing) : undefined, height: blank(runs) ? px(line.height) : undefined }}>
            {runs.map((child) => (typeof child === "string" ? child : render(child, [])))}
            {line.hyphenated ? "-" : ""}
          </span>
        );
      })}
    </>
  );
}

/**
 * A block of text as `Tag`; `always`: the text styles written even where inherited (a heading's size and weight: the
 * browser has its own).
 */
export const textBlock = ({ node, style, parent, placement, classes, children, render }: Props, Tag: string, always: ReadonlyArray<keyof ResolvedText> = []): Html => (
  <Tag
    id={node.id}
    class={classes()}
    dir={node.props.dir as string | undefined}
    style={[placement, { margin: 0 }, textDeclarations(node.text, parent.text, always), { textDecoration: style.textDecoration }, box(node, parent.type !== "Row")]}
  >
    {node.flowed ? lines(node, render) : children()}
  </Tag>
);

export const Text: Component = (props) => textBlock(props, "p");
