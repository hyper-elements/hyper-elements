/** A Span: styled text inside text. Raised or lowered, a <sup> or <sub> with no line height of its own, so it doesn't push its line apart. */
import { h } from "../jsx";
import { textDeclarations } from "../shared/css";
import type { Component } from "./context";

const TAGS: Record<string, string> = { super: "sup", sub: "sub" };

export const Span: Component = ({ node, style, parent, classes, children }) => {
  // On a Page, `as` gives it its meaning (strong, em, code…); raised or lowered, it's a sup or a sub.
  const raised = TAGS[style.verticalAlign as string];
  const Tag = (node.props.as as string | undefined) ?? raised ?? "span";
  return (
    <Tag
      id={node.id}
      class={classes()}
      style={[
        textDeclarations(node.text, parent.text),
        // Written as another element (`as`), a raised or lowered run says so itself: only a sup or a sub is raised by its tag.
        { textDecoration: style.textDecoration, backgroundColor: style.backgroundColor, lineHeight: raised ? "0" : undefined, verticalAlign: raised && Tag !== raised ? style.verticalAlign : undefined },
      ]}
    >
      {children()}
    </Tag>
  );
};
