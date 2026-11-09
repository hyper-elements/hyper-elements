/**
 * The primitives as React components, made from their definitions: their
 * props' types come from the same definitions that validate them.
 */
import type React from "react";
import {
  Button as ButtonDefinition,
  Column as ColumnDefinition,
  Divider as DividerDefinition,
  Email as EmailDefinition,
  Heading as HeadingDefinition,
  Html as HtmlDefinition,
  Image as ImageDefinition,
  LineBreak as LineBreakDefinition,
  Link as LinkDefinition,
  List as ListDefinition,
  ListItem as ListItemDefinition,
  MergeTag as MergeTagDefinition,
  Page as PageDefinition,
  Text as TextDefinition,
  Row as RowDefinition,
  Section as SectionDefinition,
  Social as SocialDefinition,
  Menu as MenuDefinition,
  Grid as GridDefinition,
  Layer as LayerDefinition,
  Document as DocumentDefinition,
  DocumentPage as DocumentPageDefinition,
  PageBreak as PageBreakDefinition,
  PageHeader as PageHeaderDefinition,
  PageFooter as PageFooterDefinition,
  PageNumber as PageNumberDefinition,
  Canvas as CanvasDefinition,
  Svg as SvgDefinition,
  Rect as RectDefinition,
  Circle as CircleDefinition,
  Ellipse as EllipseDefinition,
  Line as LineDefinition,
  Polygon as PolygonDefinition,
  Path as PathDefinition,
  Video as VideoDefinition,
  Span as SpanDefinition,
  Table as TableDefinition,
  TableCell as TableCellDefinition,
  TableRow as TableRowDefinition,
  type ComponentDefinition,
  type PropsInput,
  type InputOf,
  type StyleInput,
  type StyleSpecs,
} from "@unlayer-internal/elements-core";
import { collectingPrimitives, recordPrimitive } from "./collect";
import type { StyleName, ThemeInput, Token, Tokenized, VariantProp } from "./theme";

/** The props of a primitive: its semantic props, plus its style, phone and hover styles, and children. */
export type PrimitiveProps<D> = D extends ComponentDefinition<infer P, any, any> ? PropsInput<P> & Extras<StyleOf<D>, ConditionStyles<D>> : never;

/** The styles that may be set on phones: those whose definition says `mobile: true`. */
type MobileKeys<S extends StyleSpecs> = { [K in keyof S]-?: S[K] extends { mobile: true } ? K : never }[keyof S];

/** A condition's block of the styles `K`; where it takes none, nothing can be set in it. A value may be a token. */
type Block<S extends StyleSpecs, K> = [K] extends [never] ? never : { [Q in K & keyof S]?: Tokenized<InputOf<S[Q]["kind"]>> };

/**
 * A component's condition blocks in `style`: `mobile` with the styles it takes on phones, `hover` with its hover
 * styles (from its definition's list). Where a component takes none, the block is `never`: no value but `undefined`.
 */
export type ConditionStyles<D> = D extends ComponentDefinition<any, infer S, infer H> ? { mobile?: Block<S, MobileKeys<S>>; hover?: Block<S, H[number]> } : never;

/** What every primitive takes beside its own props. */
interface Extras<Style, Conditions> {
  /** Stable id; one is assigned in document order when it's left out. */
  id?: string;
  /**
   * Its style, and inside it its styles on phones (`mobile`) and on hover (`hover`), where it takes them. A value may be
   * a theme's token (`token("colors.primary")`), and `apply` merges the theme's named styles under it, in order.
   */
  style?: Style & Conditions & { apply?: readonly StyleName[] };
  hidden?: { mobile?: boolean; desktop?: boolean };
  children?: React.ReactNode;
}

/** A built-in's variants: the theme's for its component, a name or a list merged in order. */
interface Variant<C extends string> {
  variant?: VariantProp<C>;
}

/** A root's theme. */
interface Themed {
  /** The template's theme (`defineTheme()`): its tokens, each component's defaults and variants, and named styles. */
  theme?: ThemeInput;
}

/** A scope's tokens: over the theme's for it and what it holds (an inverted band: `{ colors: { background, foreground } }`). */
type ScopeTree = { [name: string]: string | number | Token | readonly (string | number)[] | ScopeTree };
interface Scoped {
  tokens?: { colors?: ScopeTree; spacing?: ScopeTree; fontSizes?: ScopeTree; fonts?: ScopeTree; radii?: ScopeTree };
}

// Each component's props and style have names of their own (HeadingProps, HeadingStyle), so a type error names them
// ("'marginBottom' does not exist in type 'HeadingStyle'") rather than spelling out every style the component takes.
type StyleOf<D> = D extends ComponentDefinition<any, infer S, any> ? { [K in keyof S]?: Tokenized<InputOf<S[K]["kind"]>> } : never;
type PropsOf<D, Style> = D extends ComponentDefinition<infer P, any, any> ? PropsInput<P> & Extras<Style, ConditionStyles<D>> : never;

/** Marks a primitive's component type. */
export const PRIMITIVE = Symbol.for("@hyper-elements/react/primitive");

function createPrimitive<D extends ComponentDefinition<any, any>>(definition: D): React.FC<PrimitiveProps<D>> {
  const Primitive = (props: PrimitiveProps<D>): React.ReactElement => {
    const collection = collectingPrimitives();
    if (!collection) {
      throw new Error(
        `[Elements] <${definition.type}> is part of a template: render the template with render(), not this component on its own`
      );
    }
    return recordPrimitive(collection, definition.type, props as Record<string, unknown>);
  };
  Primitive.displayName = definition.type;
  (Primitive as unknown as Record<symbol, string>)[PRIMITIVE] = definition.type;
  return Primitive;
}

export const Email: React.FC<EmailProps> = createPrimitive(EmailDefinition);
export const Page: React.FC<PageProps> = createPrimitive(PageDefinition);
export const Section: React.FC<SectionProps> = createPrimitive(SectionDefinition);
export const Row: React.FC<RowProps> = createPrimitive(RowDefinition);
export const Column: React.FC<ColumnProps> = createPrimitive(ColumnDefinition);
export const Text: React.FC<TextProps> = createPrimitive(TextDefinition);
export const Heading: React.FC<HeadingProps> = createPrimitive(HeadingDefinition);
export const Span: React.FC<SpanProps> = createPrimitive(SpanDefinition);
export const Link: React.FC<LinkProps> = createPrimitive(LinkDefinition);
export const Button: React.FC<ButtonProps> = createPrimitive(ButtonDefinition);
export const Image: React.FC<ImageProps> = createPrimitive(ImageDefinition);
export const Divider: React.FC<DividerProps> = createPrimitive(DividerDefinition);
export const LineBreak: React.FC<LineBreakProps> = createPrimitive(LineBreakDefinition);
export const MergeTag: React.FC<MergeTagProps> = createPrimitive(MergeTagDefinition);
export const List: React.FC<ListProps> = createPrimitive(ListDefinition);
export const ListItem: React.FC<ListItemProps> = createPrimitive(ListItemDefinition);
export const Table: React.FC<TableProps> = createPrimitive(TableDefinition);
export const TableRow: React.FC<TableRowProps> = createPrimitive(TableRowDefinition);
export const TableCell: React.FC<TableCellProps> = createPrimitive(TableCellDefinition);
export const Social: React.FC<SocialProps> = createPrimitive(SocialDefinition);
export const Menu: React.FC<MenuProps> = createPrimitive(MenuDefinition);
export const Grid: React.FC<GridProps> = createPrimitive(GridDefinition);
export const Layer: React.FC<LayerProps> = createPrimitive(LayerDefinition);
/** A printed document; `Document.Page` is one of its pages. */
export const Document: React.FC<DocumentProps> & { Page: React.FC<DocumentPageProps> } = Object.assign(createPrimitive(DocumentDefinition), { Page: createPrimitive(DocumentPageDefinition) });
export const PageBreak: React.FC<PageBreakProps> = createPrimitive(PageBreakDefinition);
export const PageHeader: React.FC<PageHeaderProps> = createPrimitive(PageHeaderDefinition);
export const PageFooter: React.FC<PageFooterProps> = createPrimitive(PageFooterDefinition);
export const PageNumber: React.FC<PageNumberProps> = createPrimitive(PageNumberDefinition);
export const Canvas: React.FC<CanvasProps> = createPrimitive(CanvasDefinition);
export const Svg: React.FC<SvgProps> = createPrimitive(SvgDefinition);
export const Rect: React.FC<RectProps> = createPrimitive(RectDefinition);
export const Circle: React.FC<CircleProps> = createPrimitive(CircleDefinition);
export const Ellipse: React.FC<EllipseProps> = createPrimitive(EllipseDefinition);
export const Line: React.FC<LineProps> = createPrimitive(LineDefinition);
export const Polygon: React.FC<PolygonProps> = createPrimitive(PolygonDefinition);
export const Path: React.FC<PathProps> = createPrimitive(PathDefinition);
export const Video: React.FC<VideoProps> = createPrimitive(VideoDefinition);
/** Markup written as it is (the builder's HTML block), given as `html` or as JSX in it. */
export const Html = createPrimitive(HtmlDefinition) as unknown as React.FC<HtmlProps>;

export interface EmailStyle extends StyleOf<typeof EmailDefinition> {}
export interface EmailProps extends PropsOf<typeof EmailDefinition, EmailStyle>, Themed {}
export interface PageStyle extends StyleOf<typeof PageDefinition> {}
export interface PageProps extends PropsOf<typeof PageDefinition, PageStyle>, Themed {}
export interface SectionStyle extends StyleOf<typeof SectionDefinition> {}
export interface SectionProps extends PropsOf<typeof SectionDefinition, SectionStyle>, Variant<"Section">, Scoped {}
export interface RowStyle extends StyleOf<typeof RowDefinition> {}
export interface RowProps extends PropsOf<typeof RowDefinition, RowStyle>, Variant<"Row">, Scoped {}
export interface ColumnStyle extends StyleOf<typeof ColumnDefinition> {}
export interface ColumnProps extends PropsOf<typeof ColumnDefinition, ColumnStyle>, Variant<"Column">, Scoped {}
export interface TextStyle extends StyleOf<typeof TextDefinition> {}
export interface TextProps extends PropsOf<typeof TextDefinition, TextStyle>, Variant<"Text"> {}
/** @deprecated Use `TextProps`. It stays under Elements 0.2's name for modules that import it: the migration leaves their type imports in place. */
export type ParagraphProps = TextProps;
export interface HeadingStyle extends StyleOf<typeof HeadingDefinition> {}
export interface HeadingProps extends PropsOf<typeof HeadingDefinition, HeadingStyle>, Variant<"Heading"> {}
export interface SpanStyle extends StyleOf<typeof SpanDefinition> {}
export interface SpanProps extends PropsOf<typeof SpanDefinition, SpanStyle>, Variant<"Span"> {}
export interface LinkStyle extends StyleOf<typeof LinkDefinition> {}
export interface LinkProps extends PropsOf<typeof LinkDefinition, LinkStyle>, Variant<"Link"> {}
export interface ButtonStyle extends StyleOf<typeof ButtonDefinition> {}
export interface ButtonProps extends PropsOf<typeof ButtonDefinition, ButtonStyle>, Variant<"Button"> {}
export interface ImageStyle extends StyleOf<typeof ImageDefinition> {}
export interface ImageProps extends PropsOf<typeof ImageDefinition, ImageStyle>, Variant<"Image"> {}
export interface DividerStyle extends StyleOf<typeof DividerDefinition> {}
export interface DividerProps extends PropsOf<typeof DividerDefinition, DividerStyle>, Variant<"Divider"> {}
export interface LineBreakStyle extends StyleOf<typeof LineBreakDefinition> {}
export interface LineBreakProps extends PropsOf<typeof LineBreakDefinition, LineBreakStyle>, Variant<"LineBreak"> {}
export interface MergeTagStyle extends StyleOf<typeof MergeTagDefinition> {}
export interface MergeTagProps extends PropsOf<typeof MergeTagDefinition, MergeTagStyle>, Variant<"MergeTag"> {}
export interface ListStyle extends StyleOf<typeof ListDefinition> {}
export interface ListProps extends PropsOf<typeof ListDefinition, ListStyle>, Variant<"List"> {}
export interface ListItemStyle extends StyleOf<typeof ListItemDefinition> {}
export interface ListItemProps extends PropsOf<typeof ListItemDefinition, ListItemStyle>, Variant<"ListItem"> {}
export interface TableStyle extends StyleOf<typeof TableDefinition> {}
export interface TableProps extends PropsOf<typeof TableDefinition, TableStyle>, Variant<"Table"> {}
export interface TableRowStyle extends StyleOf<typeof TableRowDefinition> {}
export interface TableRowProps extends PropsOf<typeof TableRowDefinition, TableRowStyle>, Variant<"TableRow"> {}
export interface TableCellStyle extends StyleOf<typeof TableCellDefinition> {}
export interface TableCellProps extends PropsOf<typeof TableCellDefinition, TableCellStyle>, Variant<"TableCell"> {}
export interface SocialStyle extends StyleOf<typeof SocialDefinition> {}
export interface SocialProps extends PropsOf<typeof SocialDefinition, SocialStyle>, Variant<"Social"> {}
export interface MenuStyle extends StyleOf<typeof MenuDefinition> {}
export interface MenuProps extends PropsOf<typeof MenuDefinition, MenuStyle>, Variant<"Menu"> {}
export interface GridStyle extends StyleOf<typeof GridDefinition> {}
export interface GridProps extends PropsOf<typeof GridDefinition, GridStyle>, Variant<"Grid">, Scoped {}
export interface LayerStyle extends StyleOf<typeof LayerDefinition> {}
export interface LayerProps extends PropsOf<typeof LayerDefinition, LayerStyle>, Variant<"Layer"> {}
export interface DocumentStyle extends StyleOf<typeof DocumentDefinition> {}
export interface DocumentProps extends PropsOf<typeof DocumentDefinition, DocumentStyle>, Themed {}
export interface DocumentPageStyle extends StyleOf<typeof DocumentPageDefinition> {}
export interface DocumentPageProps extends PropsOf<typeof DocumentPageDefinition, DocumentPageStyle>, Variant<"DocumentPage"> {}
export interface PageBreakStyle extends StyleOf<typeof PageBreakDefinition> {}
export interface PageBreakProps extends PropsOf<typeof PageBreakDefinition, PageBreakStyle>, Variant<"PageBreak"> {}
export interface PageHeaderStyle extends StyleOf<typeof PageHeaderDefinition> {}
export interface PageHeaderProps extends PropsOf<typeof PageHeaderDefinition, PageHeaderStyle>, Variant<"PageHeader"> {}
export interface PageFooterStyle extends StyleOf<typeof PageFooterDefinition> {}
export interface PageFooterProps extends PropsOf<typeof PageFooterDefinition, PageFooterStyle>, Variant<"PageFooter"> {}
export interface PageNumberStyle extends StyleOf<typeof PageNumberDefinition> {}
export interface PageNumberProps extends PropsOf<typeof PageNumberDefinition, PageNumberStyle>, Variant<"PageNumber"> {}
export interface CanvasStyle extends StyleOf<typeof CanvasDefinition> {}
export interface CanvasProps extends PropsOf<typeof CanvasDefinition, CanvasStyle>, Themed {}
export interface SvgStyle extends StyleOf<typeof SvgDefinition> {}
export interface SvgProps extends PropsOf<typeof SvgDefinition, SvgStyle>, Variant<"Svg"> {}
export interface RectStyle extends StyleOf<typeof RectDefinition> {}
export interface RectProps extends PropsOf<typeof RectDefinition, RectStyle>, Variant<"Rect"> {}
export interface CircleStyle extends StyleOf<typeof CircleDefinition> {}
export interface CircleProps extends PropsOf<typeof CircleDefinition, CircleStyle>, Variant<"Circle"> {}
export interface EllipseStyle extends StyleOf<typeof EllipseDefinition> {}
export interface EllipseProps extends PropsOf<typeof EllipseDefinition, EllipseStyle>, Variant<"Ellipse"> {}
export interface LineStyle extends StyleOf<typeof LineDefinition> {}
export interface LineProps extends PropsOf<typeof LineDefinition, LineStyle>, Variant<"Line"> {}
export interface PolygonStyle extends StyleOf<typeof PolygonDefinition> {}
export interface PolygonProps extends PropsOf<typeof PolygonDefinition, PolygonStyle>, Variant<"Polygon"> {}
export interface PathStyle extends StyleOf<typeof PathDefinition> {}
export interface PathProps extends PropsOf<typeof PathDefinition, PathStyle>, Variant<"Path"> {}
export interface VideoStyle extends StyleOf<typeof VideoDefinition> {}
export interface VideoProps extends PropsOf<typeof VideoDefinition, VideoStyle>, Variant<"Video"> {}
export interface HtmlStyle extends StyleOf<typeof HtmlDefinition> {}
export type HtmlProps = Omit<PropsOf<typeof HtmlDefinition, HtmlStyle>, "html" | "children"> &
  // As a string, or as JSX, which React writes.
  ({ html: string; children?: undefined } | { html?: undefined; children: React.ReactNode });
