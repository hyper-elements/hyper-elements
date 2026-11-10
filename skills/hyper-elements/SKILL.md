---
name: hyper-elements
description: Write emails, web pages, printed documents, PDFs and images in code with Hyper Elements (@hyper-elements/react), React components that render email-safe HTML, responsive page HTML, print HTML, PDFs and PNG or SVG images. Use when writing or changing an Elements template, or when asked to build an email, page, document, PDF or image in code with Elements.
---

# Hyper Elements

<!-- Written from the component definitions by packages/react/src/primitives/reference.ts: don't edit by hand. Regenerate with UPDATE_REFERENCE=1 pnpm --filter @hyper-elements/react test reference -->

Write emails, web pages, printed documents, PDFs and images in code with Hyper Elements (`npm install @hyper-elements/react`). This is the package's own guide to its components at `@hyper-elements/react` (GUIDE.md in the package), written from their definitions: everything needed to write a template, in short. Every prop's and style's details, with its default: `node_modules/@hyper-elements/react/REFERENCE.md`.

## Templates from Unlayer Elements

A project may have templates written with Unlayer Elements: they import `Body`, `ColumnLayouts` or `renderToHtml()` from `@unlayer/react-elements`, and use `values`, `layout`, `html` and style props such as `backgroundColor="#fff"`. Those components aren't in Hyper Elements, a new package: these are its components.

- Move them with the codemod: `npx @hyper-elements/migrate src/emails --from unlayer-elements` lists what it would change, `--write` replaces the files (only those git can restore) and `--report notes.md` writes what it noted. It rewrites the imports and the JSX, and keeps props, loops and conditions. The new components render with `await render(element)`, which is async, in place of `renderToHtml()`. More: `npx @hyper-elements/migrate --help`.
- What the codemod can't move is listed, and the file is left as it was: rewrite that part by hand with these components.
- Then `npm install @hyper-elements/react`, and remove `@unlayer/react-elements` once nothing imports it.
- Templates in React Email: `npx @hyper-elements/migrate src/emails` writes them in these components and checks each against its original.

## How a template is written

- Import from `@hyper-elements/react`. A template has one root: `Email`, `Page`, `Document` or `Canvas`.
- Styles go in `style={{ … }}`, never as props: `<Heading style={{ fontSize: 24, color: "#111827" }}>`. A number is px; `padding` takes `16`, `[12, 24]` or `"12px 24px"`. A box's text styles are inherited by what it holds.
- There are no margins: space between blocks is their parent's `gap` (`<Column style={{ gap: 16 }}>`), space inside a box its `padding`.
- A root, a `Section` and a `Column` stack their children. A `Row` puts its children side by side (each `Column` at its `style.width`, or an equal share) and stacks them on phones. `Grid columns={3}` makes rows of three. A `Section` is a band whose background spans the window; a `Column` with a background is a card.
- Text is components, not HTML: `Heading level={1}` and `Text` hold text; inside them `Span` styles a run, `Link href` links one, `LineBreak` breaks the line and `MergeTag name` writes a merge tag. No raw HTML (`<b>`, `<br>`, `<div>`) and no `html` prop.
- `Image src={{ src, width, height }}` (the file's size in px) with `alt`; `style.width` sets the size shown.
- Lists: `<List type="number">` of `ListItem`s. Tables: a `Table` of `TableRow`s (`header` on the first) of `TableCell`s, with `cellPadding` and `rowBorder` in the Table's `style`.
- Phones: `style={{ fontSize: 24, mobile: { fontSize: 20 } }}` (the styles listed under "Phones", where `text` is fontSize, lineHeight, letterSpacing and textAlign), `hidden={{ mobile: true }}`; in an Email or a Page. Hover: `style={{ hover: { backgroundColor: "#374151" } }}` (those under "Hover").
- `await render(element)` gives `{ html, text, diagnostics }`; errors throw an `ElementsError` with the same `diagnostics`. `validate(element)` runs the checks without rendering; `outline(element)` prints the laid-out template (each block, its width, its text).
- An Email's warnings name the email clients they're about (`clients`), with a `fix` and a `see` link. The clients most email is read in are checked; `emailClients: [...DEFAULT_EMAIL_CLIENTS, "gmx"]` checks more.

```tsx
import { writeFile } from "node:fs/promises";
import { ElementsError, formatDiagnostics, render } from "@hyper-elements/react";
import Welcome from "./welcome";

try {
  const { html, diagnostics } = await render(<Welcome />);
  await writeFile("welcome.html", html);
  console.log(formatDiagnostics(diagnostics)); // warnings, each with its email clients and fix
} catch (e) {
  if (!(e instanceof ElementsError)) throw e;
  console.error(formatDiagnostics(e.diagnostics));
  process.exitCode = 1;
}
```

## Common mistakes

Each of these made an agent's first try fail:

- `<Email backgroundColor="#fff">` → `<Email style={{ backgroundColor: "#fff" }}>`. Styles never go as props.
- `<Email style={{ width: 600, padding: 24 }}>` → `<Email width={600}>`, with the padding on a `Column` (a card) or a `Section` (a band) inside it. A root's width is a prop, and a root has no padding.
- `items={[{ text: "Home", link: "/" }]}` → `items={[{ text: "Home", href: "/" }]}`. A `Menu`'s items are `{ text, href }`, a `Social`'s icons `{ name, href }`.
- `style={{ marginBottom: 16 }}` → `gap: 16` on the parent. There are no margins.
- `ColumnLayouts`, `layout`, `headingType`, `altText`, `html` are Unlayer Elements' props, not these: a `Row` of `Column`s, `level`, `alt`, and text as children.
- `<Image src="https://example.com/logo.png">` → `src={{ src: "https://example.com/logo.png", width: 240, height: 80 }}`, the file's size. Without it, Outlook shows the file at its own size.
- `mobile={{ fontSize: 20 }}`, `hover={{ … }}`, `_hover` or `md: { … }` → `style={{ fontSize: 24, mobile: { fontSize: 20 }, hover: { … } }}`. Phone and hover styles are blocks of `style`, and there's one breakpoint: phones.
- `className="secondary"` or `sx={…}` → `variant="secondary"` (the theme's) or `style={{ apply: ["card"] }}`.

## Themes

A theme is the brand, written once: `defineTheme({ colors, spacing, fontSizes, lineHeights, fonts, radii, components, styles, formats })`, given to a root as `theme`.

- In a template `token("colors.primary")` is a token's value, or part of one (`border: { width: 1, style: "solid", color: token("colors.border") }`); inside a theme, and only there, a token is `"{colors.primary}"`: everywhere in a template (a root's `style`, a scope's `tokens`) it is `token()`. Names are letters and digits: nest `gray.900`.
- Roles: `colors.background` is the root's background; `colors.foreground`, `fonts.body`, `fontSizes.body` and `lineHeights.body` are its body text (color, font, size and line height), which Text, table cells and list items inherit: set body text here, not on `Text` (a style on `Text` misses table cells). `fonts.heading` is a Heading's font, `colors.primary` and `colors.primaryForeground` a Button's (`colors.primary` a Link's) and `fontSizes.body` its size too, `colors.border` a Divider's.
- `components.Button: { … }` is every Button's default style; `by: { level: { 1: { fontSize: 40 } } }` sets one by a prop's value (a type scale); `variants: { secondary: { … } }` are picked with `variant="secondary"` (a list merges in order).
- `styles: { card: { … } }` are named styles: `style={{ apply: ["card"], padding: 8 }}`. A key an element sets itself also replaces the theme's phone and hover values for it.
- `tokens` on a Section, Row, Column, Grid or Box overrides tokens inside it: an inverted band is `<Section tokens={{ colors: { background: "#111827", foreground: "#ffffff" } }}>`.
- `formats: { email: { … } }` overrides it for one kind of root; `extendTheme(base, overrides)` makes a brand's or a customer's theme from a shared one; `declare module "@hyper-elements/react" { interface Register { theme: typeof brand } }` types every name.

## Pages

A `Page` takes CSS's own layout, with typed styles: on a Page only (elsewhere they're `style/not-supported`).

- `<Box as="header">` is its general element (`as`: div, section, header, footer, nav, main, article, aside, figure, figcaption, blockquote, address, ul, ol, li). A flex column with its `gap` until its styles say otherwise: `display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(16rem, 1fr))"`, or `flexDirection: "row"` (a flex box is a column unless it says row). Directly in a Page it spans the window, like a Section; give it `maxWidth` and `padding` for its content.
- Lengths on a Page also take rem, em, %, vw, vh and calc(), min(), max(), clamp(): `fontSize: "clamp(2rem, 5vw, 3.5rem)"`, `padding: "4rem 1.5rem"`. A number is still px.
- Page style groups, as components list them: *layout* display, flexDirection, flexWrap, gridTemplateColumns, gridTemplateRows, gridTemplateAreas, gridAutoFlow, rowGap, columnGap, alignContent, justifyItems; *place* alignSelf, justifySelf, order, flexGrow, flexShrink, flexBasis, gridColumn, gridRow, gridArea; *size* minHeight, maxHeight, aspectRatio; *picture* objectFit, objectPosition; *position* position, top, right, bottom, left, inset, zIndex; *sides* paddingTop, paddingRight, paddingBottom, paddingLeft; *wrap* whiteSpace, textOverflow, lineClamp; *background* backgroundImage, backgroundSize, backgroundPosition, backgroundRepeat; *border* borderTop, borderRight, borderBottom, borderLeft, borderColor, borderStyle, borderWidth, outline; *effects* opacity, boxShadow, transform, transformOrigin, transition, filter, backdropFilter, mixBlendMode, maskImage, cursor, pointerEvents.
- `Span as="strong"` (strong, em, code, kbd, time, mark, abbr, sup, sub, small, cite, q) gives a run its meaning.
- Section, Row, Column and Grid still work on a Page, and stay the way to write an email.

## A whole template

```tsx
import { Button, Column, defineTheme, Email, Heading, Image, Link, List, ListItem, MergeTag, Text, Row, Span, Table, TableCell, TableRow, token } from "@hyper-elements/react";

// The brand, once: every Email, Page, Document and Canvas that takes it is on brand.
const acme = defineTheme({
  colors: { background: "#f4f4f5", foreground: "#18181b", primary: "#111827", primaryForeground: "#ffffff", muted: "#71717a", border: "#e4e4e7" },
  fonts: { body: "Inter, Arial, sans-serif" },
  components: {
    Heading: { by: { level: { 1: { fontSize: 24, mobile: { fontSize: 20 } } } } },
    Button: { borderRadius: 6, hover: { backgroundColor: "#374151" } },
  },
  styles: { card: { backgroundColor: "#ffffff", padding: 32, gap: 16, borderRadius: 8 } },
});

export default function Receipt() {
  return (
    <Email theme={acme} previewText="Your Acme receipt" style={{ gap: 16 }}>
      <Image src={{ src: "https://example.com/logo.png", width: 240, height: 80 }} alt="Acme" style={{ width: 120 }} />
      <Column style={{ apply: ["card"] }}>
        <Heading level={1}>
          Thanks for your order, <MergeTag name="first_name" />
        </Heading>
        <Text>
          Order <Span style={{ fontWeight: 700 }}>#10482</Span> ships tomorrow. <Link href="https://example.com/orders/10482">Track it</Link>.
        </Text>
        <Table style={{ cellPadding: [8, 0], rowBorder: { width: 1, style: "solid", color: token("colors.border") } }}>
          <TableRow header>
            <TableCell>Item</TableCell>
            <TableCell style={{ textAlign: "right" }}>Price</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Linen shirt</TableCell>
            <TableCell style={{ textAlign: "right" }}>$48.00</TableCell>
          </TableRow>
        </Table>
        <Row style={{ gap: 16 }}>
          <Column>
            <Text style={{ fontWeight: 700 }}>Shipping to</Text>
            <Text>Ada Lovelace, London</Text>
          </Column>
          <Column>
            <Text style={{ fontWeight: 700 }}>Next steps</Text>
            <List type="number">
              <ListItem>We pack it</ListItem>
              <ListItem>You track it</ListItem>
            </List>
          </Column>
        </Row>
        <Button href="https://example.com/orders/10482">View your order</Button>
      </Column>
      <Text style={{ fontSize: 12, color: token("colors.muted"), textAlign: "center" }}>Acme Inc., 1 Market St, San Francisco</Text>
    </Email>
  );
}
```

## A Canvas as an image

`renderImage(element, options)` (`@hyper-elements/react/image`) writes a `Canvas` as a PNG (`format: "svg"` an SVG, `scale: 2` twice the pixels). Nothing is fetched: `fonts` gives each font file by the family the template names (TTF, OTF or WOFF, not WOFF2; one per weight and style used), `images` each image file by the `src` the template gives. It gives `{ image, width, height, diagnostics }` (what it drew otherwise: a weight not given, a hover); errors throw an `ElementsError`.

```tsx
import { readFile } from "node:fs/promises";
import { Canvas, Heading, Image } from "@hyper-elements/react";
import { renderImage } from "@hyper-elements/react/image";

const { image, diagnostics } = await renderImage(
  <Canvas width={1200} height={630} style={{ padding: 64, gap: 24, fontFamily: "Inter", textAlign: "center", justifyContent: "center" }}>
    <Image src={{ src: "https://example.com/logo.png", width: 240, height: 80 }} alt="Acme" style={{ width: 120 }} />
    <Heading level={1} style={{ fontSize: 64 }}>Launch week</Heading>
  </Canvas>,
  {
    fonts: [{ family: "Inter", src: await readFile("Inter-Bold.ttf"), weight: 700 }],
    images: { "https://example.com/logo.png": await readFile("logo.png") },
  }
);
```

## Components

\* required. *text* styles: color, fontFamily, fontSize, fontWeight, fontStyle, lineHeight, letterSpacing, textAlign, textTransform. *box* styles: width, maxWidth, padding, backgroundColor, border, borderRadius. "On a Page": its page styles, by group (Pages, above).

### Roots

- **Email**: An email. Its children are stacked down the content width, centered in the window. Holds sections, layout, blocks. Props: width (a length (a number of px)), previewText (text), title (text), lang (text), dir (ltr|rtl|auto), fonts (fontFaces). Style: text, backgroundColor, gap, alignItems (start|center|end|stretch). Phones: text, gap.
- **Page**: A web page. Its children are stacked down the content width, centered in the window. Holds sections, layout, blocks. Props: width (a length (a number of px)), description (text), breakpoints (breakpoints), title (text), lang (text), dir (ltr|rtl|auto), fonts (fontFaces). Style: text, backgroundColor, gap, alignItems (start|center|end|stretch). Phones: gap.
- **Document**: A printed document: its children on pages of its size (Document.Page, or split by PageBreaks), a PageHeader and a PageFooter on each. Renders to print HTML, and to PDF with @hyper-elements/react/pdf. Holds sections, layout, blocks, Document.Page, PageBreak, PageHeader, PageFooter. Props: size (A3|A4|A5|Letter|Legal|Tabloid), orientation (portrait|landscape), margin (insets), title (text), lang (text), dir (ltr|rtl|auto), fonts (fontFaces). Style: text, backgroundColor, gap, alignItems (start|center|end|stretch).
- **Canvas**: An image of a fixed size (a social card, a banner): its children laid out in it as on a page. Written as PNG or SVG with @hyper-elements/react/image. Holds sections, layout, blocks. Props: width (a length (a number of px)), height (a length (a number of px)), title (text), lang (text), dir (ltr|rtl|auto), fonts (fontFaces). Style: text, backgroundColor, gap, alignItems (start|center|end|stretch), padding, justifyContent (start|center|end|space-between).

### Sections and layout

- **Section**: A band across the whole window, directly in an Email or Page: its background spans the window, its children are stacked at the content width. Holds layout, blocks. Style: text, backgroundColor, padding, border, gap, alignItems (start|center|end|stretch). On a Page: layout, place, size, position, sides, background, border, effects. Phones: text, padding, border, gap.
- **Row**: Lays its children out side by side. A child takes its width, or a share of what's left (its flex, 1 by default). Holds layout, blocks. Props: stackOnMobile (true or false), dir (ltr|rtl|auto). Style: text, box, flexWrap (nowrap|wrap|words), minWidth, height, overflow (visible|hidden), gap, alignItems (start|center|end|stretch), justifyContent (start|center|end|space-between), flex. On a Page: place, size, position, sides, background, border, effects, display, flexDirection, gridTemplateColumns, gridTemplateRows, gridTemplateAreas, gridAutoFlow, rowGap, columnGap, alignContent, justifyItems. Phones: text, width, maxWidth, padding, border, gap.
- **Column**: Stacks its children vertically, with its own spacing and box. Holds layout, blocks. Style: text, box, minWidth, height, overflow (visible|hidden), gap, alignItems (start|center|end|stretch), justifyContent (start|center|end|space-between), flex. On a Page: layout, place, size, position, sides, background, border, effects. Phones: text, width, maxWidth, padding, border, gap.
- **Box**: A page's general element: any structure, laid out with page styles (flex, grid, position). A flex column with its gap unless its display says otherwise; directly in a Page it spans the window, as a Section does, and its own maxWidth and padding set its content's width. Only in a Page. Holds layout, blocks. Props: as (div|section|header|footer|nav|main|article|aside|figure|figcaption|blockquote|address|ul|ol|li). Style: text, box, minWidth, height, overflow (visible|hidden), gap, alignItems (start|center|end|stretch), justifyContent (start|center|end|space-between), flex. On a Page: layout, place, size, position, sides, wrap, background, border, effects. Phones: text, width, maxWidth, padding, border, gap.
- **Grid**: Its children in columns of equal width, row after row; on phones, one under another. Holds layout, blocks. Props: columns (an integer from 1 to 12), stackOnMobile (true or false). Style: text, box, minWidth, height, overflow (visible|hidden), gap, rowGap, alignItems (start|center|end|stretch), flex. On a Page: place, size, position, background, border, effects. Phones: text, width, maxWidth, padding, border, gap, rowGap.
- **Layer**: Its children over each other, in one box as tall as the tallest: words on an image (a background image, its first child). In an email, an Image with one child over it. Holds layout, blocks. Style: text, width, minWidth, maxWidth, backgroundColor, border, borderRadius, height, alignItems (start|center|end|stretch), justifyItems (start|center|end|stretch), flex. On a Page: place, position, effects. Phones: text, width, maxWidth, border.

### Blocks

- **Svg**: Shapes (Rect, Circle, Ellipse, Line, Polygon, Path) drawn in a box of its own: its width and height, and the coordinates its viewBox gives them. Not in an Email. Holds shapes. Props: width* (a number from 0), height* (a number from 0), viewBox (text), title (text). Style: padding, backgroundColor, border, borderRadius, flex. On a Page: place. Phones: padding, border.
- **Text**: A paragraph of text. Holds text, inline, Image. Props: dir (ltr|rtl|auto). Style: text, box, textDecoration (none|underline|line-through), flex. On a Page: place, size, position, sides, wrap, background, border, effects. Phones: text, width, maxWidth, padding, border.
- **Heading**: A heading, from level 1 (the page's title) to 6. Holds text, inline. Props: level (1|2|3|4|5|6), dir (ltr|rtl|auto). Style: text, box, textDecoration (none|underline|line-through), flex. On a Page: place, size, position, sides, wrap, background, border, effects. Phones: text, width, maxWidth, padding, border.
- **Button**: A link drawn as a button. Holds text, Span, MergeTag, LineBreak. Props: href* (link), title (text), aria-label (text), attrs (attributes). Style: text, box, alignSelf (start|center|end), textDecoration (none|underline|line-through), boxSizing (border-box|content-box), flex. On a Page: position, border, effects, justifySelf, order, flexGrow, flexShrink, flexBasis, gridColumn, gridRow, gridArea. Hover: color, backgroundColor. Phones: text, alignSelf, width, maxWidth, padding, border.
- **Image**: An image in the content. Without a width it takes its own size, no wider than its parent. Props: src* (asset), alt (text), title (text). Style: alignSelf (start|center|end), width, maxWidth, height, border, borderRadius, flex, verticalAlign (top|middle). On a Page: picture, position, effects, justifySelf, order, flexGrow, flexShrink, flexBasis, gridColumn, gridRow, gridArea, aspectRatio. Phones: alignSelf, width, maxWidth, border.
- **Divider**: A horizontal line. Style: borderTop, width, padding. On a Page: place. Phones: width, padding.
- **List**: A bulleted or numbered list of ListItems. Its markers sit in a column of their own (indent) before the items. Holds ListItem. Props: type (bullet|number), start (an integer from 0). Style: text, width, maxWidth, padding, backgroundColor, border, gap, indent, flex. On a Page: place. Phones: text, width, maxWidth, padding, border, gap.
- **Table**: A table of data: TableRows of TableCells. Columns take their cells' widths; the rest share what's left. Holds TableRow. Style: text, width, maxWidth, backgroundColor, border, cellPadding, rowBorder, borderCollapse (separate|collapse), flex. On a Page: place. Phones: text, width, maxWidth, border.
- **Video**: A YouTube or Vimeo video: its player on a page; in an email (which can't play one), its thumbnail, linked to it. Props: src* (video), thumbnail (asset), title (text). Style: width, maxWidth, flex. On a Page: place. Phones: width, maxWidth.
- **Social**: Links to social profiles: a line of the networks' icons, each linked to its profile. Props: icons* (a list of icons, each { name, href }), iconType (circle|rounded|squared), size (an integer from 1). Style: gap, justifyContent (start|center|end), flex. Phones: gap.
- **Menu**: A line of links (a site's sections, a footer's), onto more lines where they don't fit, with a separator between them on desktop; or links down a column. Props: items* (a list of items, each { text, href }), separator (text), layout (horizontal|vertical). Style: color, fontFamily, fontSize, fontWeight, lineHeight, letterSpacing, textTransform (none|uppercase|lowercase|capitalize), separatorColor, padding, justifyContent (start|center|end), flex. Phones: fontSize, lineHeight, letterSpacing.
- **Html**: Markup written as it is, for what no component says (the builder's HTML block): in an email and on a page as given, nothing in it checked or escaped. A Document's PDF and a Canvas's image draw its plain text. Props: html* (text), text (text). On a Page: place.

### Inline

- **PageNumber**: In a Document's text: the number of the page it's on, or (total) how many pages there are. Only in a Document. Props: total (true or false).
- **Span**: Styled text inside text; raised or lowered (superscript, subscript) with verticalAlign. Holds text, inline. Props: as (strong|em|code|kbd|time|mark|abbr|sup|sub|small|cite|q). Style: color, fontFamily, fontSize, fontWeight, fontStyle (normal|italic), letterSpacing, textTransform (none|uppercase|lowercase|capitalize), textDecoration (none|underline|line-through), backgroundColor, verticalAlign (baseline|super|sub). On a Page: whiteSpace. Phones: fontSize, letterSpacing.
- **Link**: A link: text inside text, or around an Image. Holds text, inline, Image. Props: href* (link), title (text), aria-label (text), attrs (attributes). Style: color, fontFamily, fontSize, fontWeight, fontStyle (normal|italic), letterSpacing, textTransform (none|uppercase|lowercase|capitalize), textDecoration (none|underline|line-through), backgroundColor, flex. On a Page: place. Hover: color, textDecoration, backgroundColor. Phones: fontSize, letterSpacing.
- **LineBreak**: Starts a new line inside text.
- **MergeTag**: A value the sending service fills in (a name, a link), written in the service's own syntax. Props: name* (text).

### Parts

- **Document.Page**: One page of a Document (Document.Page in JSX): its children stacked down it, inside the Document's margins. Holds sections, layout, blocks. Style: text, backgroundColor, gap, alignItems (start|center|end|stretch).
- **PageBreak**: In a Document, where a page ends: what follows starts the next page.
- **PageHeader**: In a Document: drawn at the top of every page, inside its margins. Holds layout, blocks. Style: text, padding, backgroundColor, border, gap, alignItems (start|center|end|stretch).
- **PageFooter**: In a Document: drawn at the bottom of every page, inside its margins. Holds layout, blocks. Style: text, padding, backgroundColor, border, gap, alignItems (start|center|end|stretch).
- **ListItem**: An item of a List: text, and a List of its own to nest one. Holds text, inline, List. Props: dir (ltr|rtl|auto). Style: text, textDecoration (none|underline|line-through). Phones: text.
- **TableRow**: A row of a Table. A header row's cells are header cells, in bold. Holds TableCell. Props: header (true or false), footer (true or false). Style: text, backgroundColor, height. Phones: text.
- **TableCell**: A cell of a TableRow: text, and images. Its width sets its column's. Holds text, inline, Image. Props: colSpan (an integer from 1), dir (ltr|rtl|auto). Style: text, textDecoration (none|underline|line-through), padding, backgroundColor, border, width, verticalAlign (top|middle|bottom). Phones: text, padding, border.

### Shapes

- **Rect**: A rectangle at x, y in its Svg, rounded by rx. Props: x (a number), y (a number), width* (a number from 0), height* (a number from 0), rx (a number from 0). Style: fill, stroke, strokeWidth, opacity.
- **Circle**: A circle centered at cx, cy in its Svg. Props: cx (a number), cy (a number), r* (a number from 0). Style: fill, stroke, strokeWidth, opacity.
- **Ellipse**: An ellipse centered at cx, cy in its Svg. Props: cx (a number), cy (a number), rx* (a number from 0), ry* (a number from 0). Style: fill, stroke, strokeWidth, opacity.
- **Line**: A straight line from x1, y1 to x2, y2 in its Svg (drawn by its stroke). Props: x1 (a number), y1 (a number), x2 (a number), y2 (a number). Style: fill, stroke, strokeWidth, opacity.
- **Polygon**: A closed shape through its points ("0,0 40,0 20,30"), in its Svg. Props: points* (text). Style: fill, stroke, strokeWidth, opacity.
- **Path**: A shape drawn by an SVG path (d), in its Svg. Props: d* (text). Style: fill, stroke, strokeWidth, opacity.

## Values

- *fontFaces*: a list of { family, src, format, weight, style }
- *color*: a color ("#0879a1", "rgb(…)", "rgba(…)" or a CSS name)
- *fontFamily*: a font stack, as CSS writes it ("Inter, Arial, sans-serif")
- *fontWeight*: 100 to 900 in hundreds, "normal" or "bold"
- *lineHeight*: a multiple of the font size (1.5), a percentage ("150%"), px ("24px") or "normal" (the font's own)
- *breakpoints*: { mobile }: the phone width in px (from 240)
- *insets*: px for all sides, "8px 16px" (1 to 4 values), [v, h] or [t, r, b, l], or { top, right, bottom, left }
- *border*: "1px solid #ccc", { width, style, color } for all sides, or { top, right, bottom, left } with one of those each
- *radius*: px for every corner, [topLeft, topRight, bottomRight, bottomLeft], or { topLeft, topRight, bottomRight, bottomLeft }
- *flex*: a share of the free width (0 or more), or "none"
- *link*: a URL (http, https, mailto, tel, a path, or a merge tag) or { href, target }
- *attributes*: attributes by name, each a text value (no on… handlers, href or style)
- *asset*: an image URL (http, https or a data:image URI), or { src, width, height }
- *line*: "1px solid #ccc" or { width, style, color }
- *video*: a YouTube or Vimeo video's https link
