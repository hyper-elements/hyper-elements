/**
 * The page's body: a `<main>` stacking its children at the content width,
 * centered; with Sections, the Sections span the window and the content
 * between them is kept to the content width.
 */
import type { ResolvedNode } from "../../resolve";
import { customPropertiesClass, h, type Style } from "../jsx";
import { textDeclarations } from "../shared/css";
import { runHidden } from "../shared/gaps";
import { isNode, type Component } from "./context";
import { alignSelf } from "./layout";
import { hidingClasses } from "./styles";

export const Page: Component = ({ node: root, style, rtl, render }) => {
  const width = root.width ?? 0;
  // A word too long for its line (a long link) breaks onto the next rather than widening the page past a phone's screen.
  const stack: Style = { display: "flex", flexDirection: "column", gap: style.gap };
  const wrap: Style = { overflowWrap: "break-word" };
  // The root's phone gap, between its children and in each run of them.
  const phone = root.mobile?.gap !== undefined ? { gap: root.mobile.gap } : undefined;
  const content = (children: ResolvedNode[]) => children.map((child) => render(child, alignSelf(child, root, rtl)));
  // The theme's tokens, as CSS custom properties for the page's own CSS and Html blocks.
  const tokens = customPropertiesClass(root.customProperties);
  const nodes = root.children.filter(isNode);
  // A Box written as the page's main, wherever it is: the page's own wrapper is a div then (a page has one main).
  const holdsMain = (node: ResolvedNode): boolean => (node.type === "Box" && node.props.as === "main") || node.children.some((child) => isNode(child) && holdsMain(child));
  const Main = nodes.some(holdsMain) ? "div" : "main";
  // A Section and a Box span the window.
  const spans = (node: ResolvedNode) => node.type === "Section" || node.type === "Box";
  if (!nodes.some(spans)) {
    return (
      <Main class={tokens} phone={phone} style={[{ maxWidth: width, margin: "0 auto" }, stack, wrap, textDeclarations(root.text, undefined)]}>
        {content(nodes)}
      </Main>
    );
  }

  // Sections and Boxes span the window: the other children are kept to the content width, in runs between them. A run
  // hides where all of its children do, so the gap beside it goes too.
  const parts: Array<ResolvedNode | ResolvedNode[]> = [];
  for (const node of nodes) {
    const last = parts[parts.length - 1];
    if (spans(node)) parts.push(node);
    else if (Array.isArray(last)) last.push(node);
    else parts.push([node]);
  }
  return (
    <Main class={tokens} phone={phone} style={[stack, wrap, textDeclarations(root.text, undefined)]}>
      {parts.map((part) =>
        Array.isArray(part) ? (
          <div class={hidingClasses(runHidden(part))} phone={phone} style={[{ width: "100%", maxWidth: width, margin: "0 auto" }, stack]}>
            {content(part)}
          </div>
        ) : (
          render(part, [])
        )
      )}
    </Main>
  );
};
