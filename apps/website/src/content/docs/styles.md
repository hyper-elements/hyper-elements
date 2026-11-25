---
title: "Styles"
description: "Style elements with style={{ }} using CSS names. Phone styles go in its mobile block and hover styles in its hover block. Where phones start, hidden, fonts and text direction."
---

Every element takes its styles in `style={{ }}`, with CSS's property names and values wherever CSS has one for the job. Inside it, the `mobile` block holds its styles on phones and the `hover` block its styles under the pointer.

<figure class="diagram"><img src="/generated/core-concepts/styles-mobile.svg" width="880" height="240" alt="A card on desktop, its heading 32px at the left inside 32px of padding, and the same card on a phone, its heading 24px and centered inside 16px of padding"></figure>

<!-- example: styles/mobile.tsx -->
```tsx
<Column style={{ padding: 32, gap: 8, mobile: { padding: 16 } }}>
  <Heading
    level={1}
    style={{ fontSize: 32, mobile: { fontSize: 24, textAlign: "center" } }}
  >
    Welcome
  </Heading>
  <Text>Your account is ready.</Text>
</Column>
```

| You want | Use |
|----------|-----|
| A style | [`style={{ fontSize: 32 }}`](#style) |
| Another value on phones | [`style={{ mobile: { fontSize: 24 } }}`](#mobile) |
| A block on desktop only, or on phones only | [`hidden={{ mobile: true }}`](#hidden) |
| Another color under the pointer | [`style={{ hover: { backgroundColor } }}`](#hover) |

## style

Styles go in `style`, never as props. `<Email backgroundColor="#fff">` is an error whose message tells you to write `style={{ backgroundColor: "#fff" }}`.

- **A number is px.** `padding: 16` is 16px, `fontSize: 15` is 15px.
- **Names are CSS's** where the meaning is the same: `alignItems`, `justifyContent: "space-between"`, `textTransform`, `borderRadius`. Where a behavior isn't CSS, it's a prop (`<Row stackOnMobile={false}>`).
- **Each element takes its own list.** A style an element doesn't take is an error (`style/unknown`), which names what to use instead where there's an equivalent. Each element's page lists its styles, with their defaults.
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

<!-- example: styles/values.tsx -->
```tsx
<Column
  style={{
    padding: [24, 32],
    backgroundColor: "#ffffff",
    border: { width: 1, style: "solid", color: "#a1a1aa" },
    borderRadius: [16, 16, 0, 0],
  }}
>
  <Heading
    level={2}
    style={{
      fontWeight: "bold",
      lineHeight: "120%",
      textTransform: "uppercase",
    }}
  >
    Title
  </Heading>
  <Text style={{ lineHeight: "24px", border: { bottom: "1px solid #ccc" } }}>
    E = mc<Span style={{ verticalAlign: "super" }}>2</Span>
  </Text>
</Column>
```

<figure class="diagram"><img src="/generated/core-concepts/styles-values.svg" width="720" height="176" alt="A card with a 1px border, its top corners rounded and its bottom corners square, holding a title in capitals and a line of text with a rule under it and a superscript 2"></figure>

### Text styles are inherited

`color`, `fontFamily`, `fontSize`, `fontWeight`, `fontStyle`, `lineHeight`, `letterSpacing`, `textAlign` and `textTransform` pass down from the root to everything inside. Set your type once on the root:

```tsx
<Email
  style={{
    color: "#111827",
    fontFamily: "Inter, Arial, sans-serif",
    fontSize: 15,
    lineHeight: 1.6,
  }}
>
  {/* every block inherits these */}
</Email>
```

The root's defaults are `color: "#000000"`, `fontFamily: "Arial, Helvetica, sans-serif"`, `fontSize: 16`, `fontWeight: 400`, `lineHeight: 1.5` and `textAlign: "left"`. Some elements have their own: a Heading is bold at a line height of 1.25, a Button is white 14px text on `#0879a1`, a Link is `#0000ee` and underlined.

In an email, every text style is written on the text itself, since Outlook doesn't pass styles down through tables. That's done for you.

Box styles (`width`, `padding`, `backgroundColor`, `border`, `borderRadius` and the rest) aren't inherited.

A [theme](/docs/themes) sets the root's text styles for every design that takes it, with its roles: `colors.foreground`, `fonts.body`, `fontSizes.body` and `lineHeights.body`.

### No margins

Space between blocks is their parent's `gap`, and space inside a box is its `padding`. A margin is an error. See [Layout](/docs/layout#gap-and-padding).

## mobile

The `mobile` block of an element's `style` holds its styles on phones, in an Email or a Page. On a phone, they replace the element's own, as in the picture at the top of this page:

```tsx
<Heading style={{ fontSize: 32, mobile: { fontSize: 24 } }}>Welcome</Heading>
```

Phone styles are sizes, spacing and alignment: `fontSize`, `lineHeight`, `letterSpacing`, `textAlign`, `width`, `maxWidth`, `padding`, `border`, `gap`, `rowGap` and `alignSelf`. Each element takes the ones on its own list.

- **Colors and fonts stay the same on phones.** `mobile: { color: "#ff0000" }` is an error (`mobile/not-allowed`), and a type error in TypeScript, since the block is typed to the element's list.
- **A Document and a Canvas have no phone width.** Phone styles in one are an error (`mobile/not-supported`).
- **A Row stacks on phones without any phone styles.** See [Layout](/docs/layout#stacking-on-phones).

A few phone styles are accepted but not shown, and `validate()` warns about each:

- A Page root's own phone text styles. Set them on its Sections or Columns.
- A stacking Grid's phone `rowGap`. Its children are its phone `gap` apart.
- In an email, an Image's or a TableCell's phone `border`, and a phone `lineHeight` of `"normal"`.

### Where phones start

There is one breakpoint: a window is a phone or it isn't. In an email, it's one up to 20px wider than the content: 620px for a 600px email. On a page, it's one up to 480px wide, or up to the page's own `breakpoints.mobile`:

<figure class="diagram"><img src="/generated/core-concepts/styles-phones.svg" width="880" height="250" alt="Window widths from 0 to 1000px. A 600px Email takes its phone styles up to 620px wide, its width plus 20px. A Page takes them up to 480px wide, or up to its own breakpoints.mobile."></figure>

```tsx
<Page width={1200} breakpoints={{ mobile: 600 }}>
  <Column style={{ padding: 32, mobile: { padding: 16 } }}>…</Column>
</Page>
```

Phone styles and `hidden={{ mobile: true }}` apply at that width and below. `breakpoints.mobile` is a whole number of px from 240. One as wide as the page's content or wider is a warning (`page/phone-width`), since phone styles would then apply where the content is at full width.

An email's breakpoint follows its width and can't be set. Its phone styles are rules in its stylesheet, so they apply in the email clients that keep the stylesheet. A few drop it. There, a Row still stacks, once the window is too narrow to hold its children side by side, but `mobile` styles and `hidden` don't apply. See [Email](/docs/outputs/email#rows-that-stack-without-media-queries).

## hidden

`hidden` shows a block on one size only:

<figure class="diagram"><img src="/generated/core-concepts/styles-hidden.svg" width="880" height="199" alt="A card on desktop showing its desktop detail and not its phone detail, and the same card on a phone showing its phone detail and not its desktop detail"></figure>

<!-- example: styles/hidden.tsx -->
```tsx
<Text>Your order has shipped.</Text>
<Text hidden={{ mobile: true }}>Desktop detail: track it on the web.</Text>
<Text hidden={{ desktop: true }}>Phone detail: track it in the app.</Text>
```

Hidden on both, a block never shows, and `validate()` warns (`hidden/everywhere`).

## hover

The `hover` block holds a link's or a button's styles under the pointer:

```tsx
<Button
  href="https://example.com/buy"
  style={{ backgroundColor: "#111827", hover: { backgroundColor: "#374151" } }}
>
  Buy
</Button>

<Text>
  <Link
    href="https://example.com/help"
    style={{
      color: "#2563eb",
      textDecoration: "none",
      hover: { textDecoration: "underline" },
    }}
  >
    Help
  </Link>
</Text>
```

A Button takes `color` and `backgroundColor` on hover. A Link takes `color`, `textDecoration` and `backgroundColor`. Other elements take no `hover` block. Keyboard focus gets the same styles, so a link or button reached with Tab shows its hover colors.

In an email, `validate()` notes that hover doesn't show everywhere: classic Outlook for Windows and some apps and webmail leave the colors as they are. A PDF and an image can't show hover, and say so.

## Fonts

The root's `fonts` lists the font files the design loads, one face each:

```tsx
const fonts = [
  { family: "Inter", src: "https://example.com/400.woff2", weight: 400 },
  { family: "Inter", src: "https://example.com/700.woff2", weight: "bold" },
  { family: "Inter", src: "https://example.com/400i.woff2", style: "italic" },
];

<Email fonts={fonts} style={{ fontFamily: "Inter, Arial, sans-serif" }}>
```

A face is `{ family, src, format, weight, style }`. The format comes from the file's extension where you don't give it, and a variable font's weight is a range (`"100 900"`). Name the family in a `fontFamily` stack, before the fonts to show where it can't load. The browser picks the face for each weight and style.

- **On a page**, each face is an `@font-face` rule with `font-display: swap`.
- **In an email**, Apple Mail and iOS Mail load web fonts. Gmail and classic Outlook don't, and show the next font in the stack, so end each stack on a font every client has. `@hyper-elements/email-clients`' checks name the clients that don't load web fonts, and warn when a stack ends on one.
- **In a PDF or an image**, you pass the font files as bytes. See [PDF](/docs/outputs/pdf#fonts-and-images) and [Image](/docs/outputs/image#fonts-and-images).

## Text direction

A root's `dir` and a text block's own `dir` (Text, Heading, ListItem, TableCell, and a Row) set the direction. Text starts on that side unless you align it: a right-to-left email is right-aligned by default, and an Arabic paragraph in an English email sits on the right.

```tsx
<Email lang="ar" dir="rtl">
  <Text>مرحبا بك</Text>
</Email>
```

## What each output can't show

A familiar CSS name doesn't promise every output can show it. For each style, Elements knows whether each output shows it as asked, partly, or not at all, and `validate()` reports what your design's output can't do: a hover in a PDF, `justifyContent: "space-between"` in an email's Row.

What each email client does with the HTML is a separate set of checks, from the `@hyper-elements/email-clients` plugin: `validate(email, { plugins: [await emailClients()] })`. Rounded corners are the common case. Classic Outlook draws them square, and the plugin notes it:

```text
info email/outlook-degraded at root.children[0].style.borderRadius: borderRadius on this Column in classic Outlook: square corners
```

See [Diagnostics](/docs/diagnostics).
