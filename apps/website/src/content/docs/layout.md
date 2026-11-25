---
title: "Layout"
description: "Arrange blocks with Section, Row, Column, Grid and Layer. Space with gap and padding, size with widths and flex shares, and stack on phones."
---

Five elements arrange blocks: `Section`, `Row`, `Column`, `Grid` and `Layer`. None is required, since a root stacks its children. Reach for them when you want bands, columns, cards or words over an image.

<figure class="diagram"><img src="/generated/core-concepts/layout-row.svg" width="880" height="308" alt="A Row of three Columns on desktop, 180px, 259px and 129px wide with 16px gaps between them, and the same Row on a phone, its Columns stacked at full width"></figure>

That is this Row, in a 600px email:

<!-- example: layout/row.tsx -->
```tsx
const box = {
  backgroundColor: "#eef2ff",
  padding: [16, 0],
  borderRadius: 8,
  textAlign: "center",
} as const;

<Email width={600}>
  <Row style={{ gap: 16 }}>
    <Column style={{ ...box, width: 180 }}>
      <Text>Fixed</Text>
    </Column>
    <Column style={{ ...box, flex: 2 }}>
      <Text>Two shares</Text>
    </Column>
    <Column style={box}>
      <Text>One share</Text>
    </Column>
  </Row>
</Email>
```

The fixed Column takes 180px and the two gaps take 32px. The other two share the 388px left, two to one. On a phone, the Row stacks its Columns at full width.

You don't need a browser to see the widths. [`outline()`](/docs/rendering#outline) prints them:

<!-- output: rowOutline -->
```text
Email 600px
  Row 600px: 3 side by side, stacked on phones
    Column 180px: background #eef2ff
      Text 180px "Fixed"
    Column 259px: background #eef2ff
      Text 259px "Two shares"
    Column 129px: background #eef2ff
      Text 129px "One share"
```

## Which one to use

| You want | Use |
|----------|-----|
| A background across the whole window | [`Section`](#section) |
| Blocks side by side | [`Row`](#row) |
| A card, or a group of blocks with its own spacing | [`Column`](#column) |
| Equal columns, row after row | [`Grid`](#grid) |
| Words over an image | [`Layer`](#layer) |

## Gap and padding

There are no margins. Space between blocks is their parent's `gap`. Space inside a box is its `padding`.

<figure class="diagram"><img src="/generated/core-concepts/layout-spacing.svg" width="720" height="287" alt="A card with its padding shaded on all four sides, 32px, and the gap between its heading, text and button shaded, 16px each"></figure>

<!-- example: layout/spacing.tsx -->
```tsx
<Column style={{ backgroundColor: "#ffffff", padding: 32, gap: 16 }}>
  <Heading level={2}>Your order</Heading>
  <Text>Ships tomorrow.</Text>
  <Button href="https://example.com/orders/10482">Track it</Button>
</Column>
```

A `gap` is the same between every child. Where one space should differ, either group the blocks that belong together in a Column with its own `gap`, or give a block `padding` on that side:

```tsx
<Column style={{ gap: 24 }}>
  <Column style={{ gap: 4 }}>
    <Heading level={2}>Your order</Heading>
    <Text>Ships tomorrow.</Text>
  </Column>
  <Button href="https://example.com/orders/10482">Track it</Button>
</Column>
```

`marginBottom` and the other margins are errors, and the message says to use the parent's `gap`, or `padding`. In an email, both are written as table cell padding, which holds up in classic Outlook (the Windows desktop app, which draws email with Word's engine and drops a good deal of CSS).

`padding` takes one number for every side, or a value for each: `[12, 24]` is 12px top and bottom, 24px left and right. [Styles](/docs/styles#values) lists every form.

## Section

A [`Section`](/docs/elements/section) is a band across the whole window. Its background spans the window, and its children are stacked at the content width.

<figure class="diagram"><img src="/generated/core-concepts/layout-section.svg" width="880" height="321" alt="An email in a window wider than its content: the Section's dark background spans the whole window, and its heading and the card below sit inside the 600px content width"></figure>

<!-- example: layout/section.tsx -->
```tsx
<Email width={600} style={{ backgroundColor: "#f4f4f5" }}>
  <Section
    style={{ backgroundColor: "#15132e", padding: [24, 40], color: "#ffffff" }}
  >
    <Heading level={2}>Acme weekly</Heading>
  </Section>
  <Section style={{ padding: [32, 40] }}>
    <Column style={{ backgroundColor: "#ffffff", padding: 24, gap: 8 }}>
      <Heading level={3}>This week</Heading>
      <Text>A Section is a band. A Column with a background is a card.</Text>
    </Column>
  </Section>
</Email>
```

The heading is 520px wide: the 600px content width less 40px of padding on each side.

A Section goes directly in a root, never inside a Column, a Row or another Section. For a background that stops at the content width, use a Column.

## Row

A [`Row`](/docs/elements/row) puts its children side by side. Each child takes its `width`, or a share of what's left: its `flex`, 1 by default.

```tsx
// Equal shares.
<Row style={{ gap: 16 }}>
  <Column>{/* content */}</Column>
  <Column>{/* content */}</Column>
</Row>

// A set width, and what's left.
<Row style={{ gap: 16 }}>
  <Column style={{ width: 180 }}>{/* content */}</Column>
  <Column>{/* content */}</Column>
</Row>

// Shares of two to one.
<Row style={{ gap: 16 }}>
  <Column style={{ flex: 2 }}>{/* content */}</Column>
  <Column>{/* content */}</Column>
</Row>
```

- `width` takes px, or a percentage of the Row's width: `"25%"` of a 600px Row is 150px.
- `flex: "none"` makes a child take its own size.
- `minWidth` and `maxWidth` hold a child's width where its share would go past them.

A Row's children don't have to be Columns. A Text, a Button or an Image can sit in a Row itself. Use a Column where one side holds more than one block.

### Stacking on phones

In an Email or a Page, a Row stacks its children at full width on phones. To keep them side by side, set `stackOnMobile={false}`:

```tsx
<Row stackOnMobile={false} style={{ gap: 12 }}>
  <Column><Text>Subtotal</Text></Column>
  <Column><Text style={{ textAlign: "right" }}>$48.00</Text></Column>
</Row>
```

Stacked, each child is as wide as the Row, whatever its `width` or `flex`, and the Row's `gap` is the space between them, as in the picture at the top of this page.

A phone is a window up to 20px wider than an email's content (620px for a 600px email), or up to 480px wide on a page. [Styles](/docs/styles#where-phones-start) has the details.

`flexWrap: "wrap"` lets children that don't fit go onto another line. In an email, it works only in a Row with `stackOnMobile={false}`.

## Column

A [`Column`](/docs/elements/column) stacks its children, with its own `gap`, `padding` and box. With a background, it's a card.

```tsx
<Column
  style={{
    backgroundColor: "#ffffff",
    padding: 24,
    gap: 12,
    border: "1px solid #e4e4e7",
    borderRadius: 8,
  }}
>
  <Heading level={3}>Pro plan</Heading>
  <Text>$12 a month</Text>
</Column>
```

Anything that stacks its children (a root, a Section, a Column) gives each child its full width. The exceptions are a child with a `width`, and a Button or an Image, which take their own size.

## Grid

A [`Grid`](/docs/elements/grid) puts its children in columns of equal width, row after row. On phones, they go one under another unless `stackOnMobile={false}`.

<figure class="diagram"><img src="/generated/core-concepts/layout-grid.svg" width="880" height="310" alt="A Grid of four cards in three columns on desktop, the fourth starting a second row, and the same Grid on a phone, one card under another"></figure>

<!-- example: layout/grid.tsx -->
```tsx
const card = { backgroundColor: "#eef2ff", padding: 16, borderRadius: 8 };

<Grid columns={3} style={{ gap: 16, rowGap: 24 }}>
  <Column style={card}><Text>One</Text></Column>
  <Column style={card}><Text>Two</Text></Column>
  <Column style={card}><Text>Three</Text></Column>
  <Column style={card}><Text>Four</Text></Column>
</Grid>
```

`columns` is 1 to 12, 2 by default. `gap` is the space across and down, and `rowGap` the space between rows where it differs. Every output draws a Grid, since it's laid out as Rows of Columns.

## Layer

A [`Layer`](/docs/elements/layer) puts its children over each other, in one box as tall as the tallest. Use it for words on an image.

<figure class="diagram"><img src="/generated/core-concepts/layout-layer.svg" width="720" height="312" alt="A Layer 240px tall: a photo covering it, and a heading over the photo at its bottom left"></figure>

<!-- example: layout/layer.tsx -->
```tsx
const photo = {
  src: "https://hyperelements.dev/img/gradient.png",
  width: 1200,
  height: 500,
};

<Layer style={{ height: 240, alignItems: "end" }}>
  <Image src={photo} alt="" />
  <Column style={{ padding: 32 }}>
    <Heading level={2} style={{ color: "#ffffff" }}>Spring collection</Heading>
  </Column>
</Layer>
```

With a `height`, the image under the other children covers the Layer, cut at its sides or at its top and bottom. `alignItems` places the children down the box (`"start"` by default), and `justifyItems` across it (`"stretch"` by default).

> **Note:** An email draws one shape of Layer: an Image as wide as the Layer with one child over it, as above. Any other shape is an error in an Email (`email/layer`).

## Alignment

`alignItems` places children across the layout's direction: vertically in a Row, horizontally in a Column. `justifyContent` places them along it. The values are CSS's: `"start"`, `"center"`, `"end"`, plus `"stretch"` for `alignItems` and `"space-between"` for `justifyContent`.

<figure class="diagram"><img src="/generated/core-concepts/layout-alignment.svg" width="720" height="240" alt="A Row whose logo and two lines of text are centered on each other vertically, and a Column whose heading and button are centered across it"></figure>

<!-- example: layout/alignment.tsx -->
```tsx
const logo = {
  src: "https://hyperelements.dev/img/orbit-logo.png",
  width: 252,
  height: 128,
};

<Row style={{ gap: 16, alignItems: "center" }}>
  <Column style={{ width: 128 }}>
    <Image src={logo} alt="Orbit" style={{ width: 128 }} />
  </Column>
  <Column>
    <Text style={{ fontWeight: 700 }}>Ada Lovelace</Text>
    <Text>Commented on your design</Text>
  </Column>
</Row>
<Column style={{ alignItems: "center", textAlign: "center", gap: 12 }}>
  <Heading level={2}>Centered by textAlign</Heading>
  <Button href="https://example.com">Centered by alignItems</Button>
</Column>
```

In a Column, `alignItems` moves the blocks that take their own size: a Button, an Image, a block with a `width`. A Heading or a Text fills the Column's width, so `alignItems` leaves its words where they were. Center those with `textAlign: "center"`.

A Button can place itself with `alignSelf` (`"start"`, `"center"` or `"end"`), whatever its parent's `alignItems`, and somewhere else on phones with `style={{ mobile: { alignSelf } }}`.

> **Note:** `justifyContent: "space-between"` isn't possible in a Row in an email. Its children start at the left, and `validate()` warns (`email/unsupported`).

## How widths are worked out

Before any HTML is written, Elements works out every box's width in px, from the root's width down. Every output is written from those widths, so an email (which needs px widths for Outlook's tables) and a page agree.

A Row's widths follow CSS flexbox: each child starts from its `width` or its own size, what's left is shared by `flex`, and a child that reaches its `minWidth` or `maxWidth` keeps it. Widths that don't fit are narrowed as a browser narrows them, with a warning (`layout/shrunk`). Minimum widths that can't fit are reported too (`layout/overflow`).

> **Warning:** Text isn't measured. A box can get less room than its words need: text in a few px, a label wider than its button. A page then overflows the box, while an email's table cell widens to its longest word and its neighbors give way. No diagnostic says so yet, so give boxes room for their words.
