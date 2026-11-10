---
title: "Styles, phones and hover"
description: "Style components with style={{ }} using CSS names, set phone and hover styles in its mobile and hover blocks, set where a Page's phones start, show blocks on one size with hidden, and load fonts."
---

Every component takes its styles in `style={{ }}`, with CSS's property names and values. Inside it, the `mobile` block holds its styles on phones and the `hover` block its styles under the pointer. `hidden` shows a block on one size only.

```tsx
<Heading level={1} style={{ fontSize: 32, color: "#111827", mobile: { fontSize: 24, textAlign: "center" } }}>
  Welcome
</Heading>
```

## style

Styles go in `style`, never as props. `<Email backgroundColor="#fff">` is an error whose message tells you to write `style={{ backgroundColor: "#fff" }}`.

- **A number is px.** `padding: 16` is 16px, `fontSize: 15` is 15px.
- **Names are CSS's** where the meaning is the same: `alignItems`, `justifyContent: "space-between"`, `textTransform`, `borderRadius`. Where a behavior isn't CSS, it's a prop (`<Row stackOnMobile={false}>`).
- **Each component takes its own list.** A style a component doesn't take is an error (`style/unknown`), which names what to use instead where there's an equivalent. Each component's page lists its styles, with their defaults.
- **A value may be a theme's token**, `color: token("colors.primary")`, and `apply` merges a theme's named styles under the rest: `style={{ apply: ["card"], gap: 16 }}`. See [Themes](/docs/themes).

### Values

| Kind | What it takes |
|------|---------------|
| Color | `"#0879a1"`, `"rgb(…)"`, `"rgba(…)"` or a CSS name |
| Font family | A stack, as CSS writes it: `"Inter, Arial, sans-serif"` |
| Font weight | 100 to 900 in hundreds, `"normal"` or `"bold"` |
| Line height | A multiple of the font size (`1.5`), a percentage (`"150%"`), px (`"24px"`) or `"normal"` |
| Insets (`padding`, a Document's `margin`) | `16` for every side, `[v, h]`, `[top, h, bottom]`, `[top, right, bottom, left]`, `"8px 16px"` (1 to 4 values) or `{ top, right, bottom, left }` |
| Border | `"1px solid #ccc"`, `{ width, style, color }` for every side, or `{ top, right, bottom, left }` with one of those each |
| Radius | px for every corner, `[topLeft, topRight, bottomRight, bottomLeft]` or `{ topLeft, topRight, bottomRight, bottomLeft }` |
| Flex | A share of the free width (0 or more), or `"none"` |

```tsx
<Column
  style={{
    padding: [24, 32],
    backgroundColor: "#ffffff",
    border: { width: 1, style: "solid", color: "#e4e4e7" },
    borderRadius: [8, 8, 0, 0],
  }}
>
  <Heading level={2} style={{ fontWeight: "bold", lineHeight: "120%", textTransform: "uppercase" }}>
    Title
  </Heading>
  <Text style={{ lineHeight: "24px", border: { bottom: "1px solid #e4e4e7" } }}>
    E = mc<Span style={{ verticalAlign: "super" }}>2</Span>
  </Text>
</Column>
```

### Text styles are inherited

`color`, `fontFamily`, `fontSize`, `fontWeight`, `fontStyle`, `lineHeight`, `letterSpacing`, `textAlign` and `textTransform` pass down from the root to everything inside. Set your type once on the root:

```tsx
<Email style={{ color: "#111827", fontFamily: "Inter, Arial, sans-serif", fontSize: 15, lineHeight: 1.6 }}>
  {/* every block inherits these */}
</Email>
```

The root's defaults are `color: "#000000"`, `fontFamily: "Arial, Helvetica, sans-serif"`, `fontSize: 16`, `fontWeight: 400`, `lineHeight: 1.5` and `textAlign: "left"`. Some components have their own: a Heading is bold at a line height of 1.25, a Button is white 14px text on `#0879a1`, a Link is `#0000ee` and underlined.

In an email, every text style is written on the text itself, since Outlook doesn't pass styles down through tables. You don't have to think about it.

Box styles (`width`, `padding`, `backgroundColor`, `border`, `borderRadius` and the rest) aren't inherited.

A [theme](/docs/themes) sets the root's text styles for every template that takes it, with its roles: `colors.foreground`, `fonts.body`, `fontSizes.body` and `lineHeights.body`.

### No margins

There are no margins. Space between blocks is their parent's `gap`, and space inside a box is its `padding`. See [Layout](/docs/layout#gap-and-padding-no-margins).

## mobile

The `mobile` block of a component's `style` holds its styles on phones, in an Email or a Page:

```tsx
<Column style={{ padding: 32, mobile: { padding: 16 } }}>
  <Heading style={{ fontSize: 32, mobile: { fontSize: 24, textAlign: "center" } }}>Welcome</Heading>
</Column>
```

Each component takes a short list of phone styles, mostly sizes, spacing and alignment: `fontSize`, `lineHeight`, `letterSpacing`, `textAlign`, `width`, `maxWidth`, `padding`, `border`, `gap`, `rowGap`, `alignSelf`. The block is typed to the component's list, so TypeScript flags a style that isn't on it; `validate()` says so too (`mobile/not-allowed`). Phone styles in a Document or a Canvas, which have no phone width, are an error (`mobile/not-supported`).

Where an output takes a phone style but doesn't show it, `validate()` warns: a Page's own phone text styles (set them on its Sections or Columns), a stacking Grid's `rowGap` (its children are its phone `gap` apart), and in an email an Image's or a TableCell's phone `border`, and a phone `lineHeight` of `"normal"`.

Rows also stack on phones; see [Layout](/docs/layout#stacking-on-phones).

### Where phones start

In an email, phones are at or below the content width plus 20px. On a page, they're at or below 480px, or the page's own `breakpoints.mobile`:

```tsx
<Page width={1200} breakpoints={{ mobile: 600 }}>
  <Column style={{ padding: 32, mobile: { padding: 16 } }}>…</Column>
</Page>
```

Phone styles and `hidden={{ mobile: true }}` apply at and below it. It's a whole number of px from 240; one as wide as the page's content or wider is a warning (`page/phone-width`), since phone styles would then apply where the content is at full width.

## hidden

`hidden` shows a block on one size only:

```tsx
<Text hidden={{ mobile: true }}>Desktop detail</Text>
<Text hidden={{ desktop: true }}>Phone detail</Text>
```

Hidden on both, a block never shows, and `validate()` warns (`hidden/everywhere`).

## hover

The `hover` block holds a link's or a button's styles under the pointer:

```tsx
<Button href="https://example.com/buy" style={{ backgroundColor: "#111827", hover: { backgroundColor: "#374151" } }}>
  Buy
</Button>

<Text>
  <Link href="https://example.com/help" style={{ color: "#2563eb", textDecoration: "none", hover: { textDecoration: "underline" } }}>
    Help
  </Link>
</Text>
```

A Button takes `color` and `backgroundColor` on hover. A Link takes `color`, `textDecoration` and `backgroundColor`. Other components take no `hover` block. Keyboard focus gets the same styles, so a link or button reached with Tab shows its hover colors.

In an email, `validate()` notes that hover doesn't show everywhere: classic Outlook for Windows and some apps and webmail leave the colors as they are. A PDF and an image can't show hover, and say so.

## Fonts

The root's `fonts` lists the font files the template loads, one face each:

```tsx
<Email
  fonts={[
    { family: "Inter", src: "https://example.com/inter-400.woff2", weight: 400 },
    { family: "Inter", src: "https://example.com/inter-700.woff2", weight: "bold" },
    { family: "Inter", src: "https://example.com/inter-italic.woff2", style: "italic" },
  ]}
  style={{ fontFamily: "Inter, Arial, sans-serif" }}
>
```

A face is `{ family, src, format, weight, style }`. The format comes from the file's extension where you don't give it, and a variable font's weight is a range (`"100 900"`). Name the family in a `fontFamily` stack, before the fonts to show where it can't load. The browser picks the face for each weight and style.

- **On a page**, each face is an `@font-face` rule with `font-display: swap`.
- **In an email**, Apple Mail and iOS Mail load web fonts. Gmail and classic Outlook don't, and show the next font in the stack. `validate()` notes this (`email/degraded`), and warns when a stack ends on a web font (`email/font-fallback`), since a client that can't load it then picks its own.
- **In a PDF or an image**, you pass the font files as bytes. See [PDF](/docs/outputs/pdf#fonts-and-images) and [Image](/docs/outputs/image#fonts-and-images).

## Text direction

A root's `dir` and a text block's own `dir` (Text, Heading, ListItem, TableCell, and a Row) set the direction. Text starts on that side unless you align it: a right-to-left email is right-aligned by default, and an Arabic paragraph in an English email sits on the right.

```tsx
<Email lang="ar" dir="rtl">
  <Text>مرحبا بك</Text>
</Email>
```

## What each output can't show

A familiar CSS name doesn't promise every output can show it. Each style declares, for each output, whether it's shown as asked, shown everywhere but classic Outlook, shown partly, or not at all, and `validate()` reports what your template's output can't do. Rounded corners are the common case: classic Outlook draws them square, and you get a note.

```text
info email/outlook-degraded at root.children[0].style.borderRadius: borderRadius on this Column in classic Outlook: square corners
```

See [Diagnostics](/docs/diagnostics).
