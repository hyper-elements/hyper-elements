/**
 * Page HTML (`<Page>`) from a laid-out template: one element per node, its
 * styles inline, flexbox for the root, Rows and Columns. The only stylesheet
 * is what inline styles can't do: phone overrides, hiding, hover, and fonts.
 *
 * Each component is written by its own file here (Button.tsx, Row.tsx, …), in
 * JSX that writes strings (../jsx.ts), from one props object (context.ts);
 * `layout.tsx` and `styles.tsx` are what they share.
 */
import type { Diagnostic } from "../../diagnostics";
import type { ResolvedDocument, ResolvedNode } from "../../resolve";
import { Fragment, h, Html, withStylesheet } from "../jsx";
import { Stylesheet } from "../shared/classes";
import { attrs, css, escapeAttr, escapeText, styleAttr, type Declarations } from "../shared/css";
import { pageDeclarations } from "../../css-serialize";
import { fontFaces } from "../shared/fonts";
import { isNode, type PageOptions, type Props, type Component } from "./context";
import { alignSelf, layerPlacement, pageLayout, rowPlacement } from "./layout";
import { Box } from "./Box";
import { classesFor } from "./styles";
import { Button } from "./Button";
import { Column } from "./Column";
import { Divider } from "./Divider";
import { Heading } from "./Heading";
import { HtmlBlock } from "./Html";
import { Image } from "./Image";
import { LineBreak } from "./LineBreak";
import { Link } from "./Link";
import { List } from "./List";
import { ListItem } from "./ListItem";
import { MergeTag } from "./MergeTag";
import { Page } from "./Page";
import { Text } from "./Text";
import { Row } from "./Row";
import { Layer } from "./Layer";
import { Document, documentCss } from "./Document";
import { PageNumber } from "./PageNumber";
import { Canvas } from "./Canvas";
import { Svg } from "./Svg";
import { Section } from "./Section";
import { Span } from "./Span";
import { Table } from "./Table";
import { TableCell } from "./TableCell";
import { TableRow } from "./TableRow";
import { Video } from "./Video";

export type { PageOptions } from "./context";

export interface PageHtml {
  /** The whole document, from `<!DOCTYPE html>`. */
  html: string;
  /** What goes in `<head>`: meta tags, the title, the stylesheet. */
  head: string;
  /** What goes in `<body>`. */
  body: string;
  /** The `<body>`'s own style (the window's background), for a page that embeds `body`. */
  bodyStyle: string;
}

/** At and below this window width a Page is on a phone, unless its `breakpoints` say otherwise. */
export const PAGE_PHONE_WIDTH = 480;

/** The window width at and below which a Page's phone styles apply: its `breakpoints.mobile`, or 480. */
export function pagePhoneWidth(root: ResolvedNode): number {
  const mobile = (root.props.breakpoints as { mobile?: number } | undefined)?.mobile;
  return typeof mobile === "number" ? mobile : PAGE_PHONE_WIDTH;
}

/** A Page whose phone width is at or above its content width: its phone styles apply to windows the content fills. */
export function pageBreakpoints(root: ResolvedNode): Diagnostic[] {
  const mobile = (root.props.breakpoints as { mobile?: number } | undefined)?.mobile;
  const width = typeof root.props.width === "number" ? root.props.width : undefined;
  if (root.type !== "Page" || typeof mobile !== "number" || width === undefined || mobile < width) return [];
  return [
    {
      code: "page/phone-width",
      severity: "warning",
      message: `Its phone styles apply to every window up to ${mobile}px, wider than its ${width}px content: on those, the content is at its full width with its phone styles. Set breakpoints.mobile below ${width}`,
      path: "root.props.breakpoints",
    },
  ];
}

/** The components. (The root, `Page`, is called on its own.) */
const COMPONENTS: Record<string, Component> = {
  Section,
  Row,
  Column,
  Box,
  Layer,
  // A Document's header and footer, and a page, are stacks in their box.
  PageHeader: Column,
  PageFooter: Column,
  DocumentPage: Column,
  PageNumber,
  Svg,
  Text,
  Heading,
  Span,
  Link,
  Button,
  Image,
  Divider,
  LineBreak,
  MergeTag,
  List,
  ListItem,
  Table,
  TableRow,
  TableCell,
  Video,
  Html: HtmlBlock,
};

/** What a node's component gets. `inRtl`: its parent's text runs right to left. */
function propsOf(node: ResolvedNode, parent: ResolvedNode, placement: Declarations, options: PageOptions, inRtl = false): Props {
  const rtl = node.props.dir === "rtl" || (inRtl && node.props.dir !== "ltr");
  const render: Props["render"] = (child, childPlacement) => write(child, node, childPlacement, options, rtl);
  return {
    node,
    style: node.style,
    parent,
    placement,
    classes: () => classesFor(node, parent),
    children: () => {
      // Text and the runs in it; else the nodes it lays out, each placed by its layout.
      if (node.definition.children.text) return <>{node.children.map((child) => (typeof child === "string" ? child : render(child, [])))}</>;
      const place = (child: ResolvedNode): Declarations => {
        // A flex row or a grid its page styles make it: each child keeps no width from its longest word (Decision 7), and
        // in a flex row its `flex` share is CSS's `<n> 1 0%` ("none": its own size), as in a Row.
        const layout = pageLayout(node);
        if (layout && node.type !== "Row") {
          const share = child.style.flex;
          const flex: Declarations = layout !== "flex" || share === undefined ? [] : share === "none" || share === 0 ? [["flex", "0 0 auto"]] : [["flex", `${share} 1 0%`]];
          return [...flex, ...(child.style.minWidth === undefined ? ([["min-width", "0"]] as Declarations) : [])];
        }
        const own = node.type === "Row" ? rowPlacement(child, node) : node.type === "Layer" ? layerPlacement(child) : alignSelf(child, node, rtl);
        return node.type === "Box" && child.style.minWidth === undefined && !own.some(([property]) => property === "min-width") ? [...own, ["min-width", "0"]] : own;
      };
      return <>{node.children.filter(isNode).map((child) => render(child, place(child)))}</>;
    },
    rtl,
    render,
    options,
  };
}

function write(node: ResolvedNode, parent: ResolvedNode, placement: Declarations, options: PageOptions, inRtl: boolean): Html {
  const component = COMPONENTS[node.type];
  if (!component) throw new Error(`[Elements] The page exporter can't render a ${node.type}`);
  return withPageStyles(component(propsOf(node, parent, placement, options, inRtl)), node);
}

/**
 * The node's element with its page styles (Decision 5) after its writer's own declarations, so that where the writer
 * also sets a CSS property (Column's display and flexDirection, Row's display) the authored value wins (Decision 7).
 */
function withPageStyles(element: Html, node: ResolvedNode): Html {
  const declarations = pageDeclarations(node.style, node.definition);
  if (!declarations.length) return element;
  const start = element.options.start ?? /^<[a-zA-Z][a-zA-Z0-9]*(?: [^\s="]+="[^"]*")*>/.exec(element.markup)?.[0];
  if (!start) throw new Error(`[Elements] A ${node.type}'s page styles go on its element`);
  // Its attributes in order, each a name and a double-quoted value with no quote in it (the writers escape every
  // value): only an attribute named style is its style, never text in another's value (an alt that says "style=").
  const tag = /^<[a-zA-Z][a-zA-Z0-9]*/.exec(start)![0];
  const attributes = [...start.slice(tag.length, -1).matchAll(/ ([^\s="]+)="([^"]*)"/g)].map(([, name, value]) => ({ name, value }));
  const text = escapeAttr(css(declarations));
  const own = attributes.find((attribute) => attribute.name === "style");
  if (own) own.value = `${own.value}${own.value ? ";" : ""}${text}`;
  else attributes.push({ name: "style", value: text });
  const styled = `${tag}${attributes.map(({ name, value }) => ` ${name}="${value}"`).join("")}>`;
  return new Html(styled + element.markup.slice(start.length), { ...element.options, ...(element.options.start ? { start: styled } : {}) });
}

export function renderPage(resolved: ResolvedDocument, options: PageOptions = {}): PageHtml {
  const root = resolved.root;
  const sheet = new Stylesheet(options.classPrefix);
  const fonts = fontFaces(root, { swap: true });
  const document = root.type === "Document";
  const writer = document ? Document : root.type === "Canvas" ? Canvas : Page;
  const body = withStylesheet(sheet, () => String(writer(propsOf(root, root, [], options))));

  // A Canvas and a Document are of a fixed size, whatever the window: no phone layout.
  const fixed = !root.definition.responsive;
  const phoneWidth = pagePhoneWidth(root);
  const stylesheet = [...fonts, sheet.css(fixed ? null : `@media (max-width: ${phoneWidth}px)`, fixed ? null : `@media (min-width: ${phoneWidth + 1}px)`), document ? documentCss(root) : ""].join("");
  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    typeof root.props.title === "string" ? `<title>${escapeText(root.props.title)}</title>` : "",
    typeof root.props.description === "string" ? `<meta${attrs({ name: "description", content: root.props.description })}>` : "",
    stylesheet ? `<style>${stylesheet}</style>` : "",
  ].join("");
  // A Document's background is its pages', not the window's.
  const background = document ? undefined : (root.style.backgroundColor as string | undefined);
  const bodyStyle = css([
    ["margin", "0"],
    ["background-color", background],
  ]);
  const html = `<!DOCTYPE html><html${attrs({ lang: root.props.lang as string | undefined, dir: root.props.dir as string | undefined })}><head>${head}</head><body${styleAttr([["margin", "0"], ["background-color", background]])}>${body}</body></html>`;
  return { html, head, body, bodyStyle };
}
