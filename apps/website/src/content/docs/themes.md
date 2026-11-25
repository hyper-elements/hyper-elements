---
title: "Themes"
description: "Write a brand once with defineTheme() and give it to any root: tokens, roles the built-in elements read, each element's defaults and variants, named styles, and scopes that change tokens for one band."
---

A theme is the brand, written once. Give it to a root, and the design needs almost no styles of its own:

<!-- example: themes/welcome.tsx -->
```tsx
<Email theme={brand} lang="en" previewText="Your Acme account is ready.">
  <Section style={{ apply: ["card"] }}>
    <Heading level={1}>Welcome to Acme</Heading>
    <Text>Your account is ready.</Text>
    <Button href="https://example.com/start">Get started</Button>
    <Button href="https://example.com/docs" variant="secondary">
      Read the docs
    </Button>
  </Section>
  <Section
    tokens={{ colors: { background: "#15132e", foreground: "#ffffff" } }}
    style={{ padding: [24, 32] }}
  >
    <Text style={{ fontSize: token("fontSizes.small") }}>
      Acme Inc., 1 Market St, San Francisco
    </Text>
  </Section>
</Email>
```

<figure class="diagram"><img src="/generated/core-concepts/themes-welcome.svg" width="987" height="360" alt="The welcome email, each part labeled with what in the theme styles it: the card by a named style, the heading and text by roles, the buttons by a role and a variant, the dark band by a scope, and its small text by a token."></figure>

The design names no font, and no color but the band's. Each label in the picture is one part of the theme:

| Part | What it is |
|------|------------|
| [Tokens](#tokens) | The brand's values, by name: `colors.primary`, `spacing.lg` |
| [Roles](#roles) | The tokens built-in elements read by themselves: a Button's background is `colors.primary` |
| [Element defaults and variants](#element-defaults-and-variants) | How every Button looks, and its named versions |
| [Named styles](#named-styles) | A set of styles any element applies by name: a card |
| [Scopes](#scopes) | Other token values for one part of a design: a dark band |

The rest of this page writes that theme, a part at a time. A theme takes any root: the same one styles an Email, a Page, a Document and a Canvas. A design without a theme renders as it always did, and a theme changes only what it defines.

## Tokens

`defineTheme()`, from `@hyper-elements/react` like `token()`, takes the brand's values by name. These are its tokens:

<!-- example: themes/brand.ts -->
```tsx
export const brand = defineTheme({
  colors: {
    background: "#f4f4f5",
    foreground: "#15132e",
    primary: "#4f46e5",
    primaryForeground: "#ffffff",
    muted: "#e0e7ff",
    border: "#e4e4e7",
  },
  fonts: { body: "Helvetica, Arial, sans-serif", heading: "Georgia, serif" },
  fontSizes: { body: 16, small: 13 },
  lineHeights: { body: 1.6 },
  spacing: { md: 16, lg: 32 },
```

There are six groups of tokens: `colors`, `spacing`, `fontSizes`, `lineHeights`, `fonts` and `radii`. A token's value is what the same style takes, so a number is px.

In a design, `token("colors.primary")` stands for a token's value wherever a style takes one:

```tsx
<Text style={{ color: token("colors.primary") }}>Paid</Text>
```

Inside the theme, one token refers to another as `"{colors.primary}"`. That form is for the theme only. In a design it's a plain string, and the error for it says to write `token("colors.primary")`.

## Roles

Some token names are roles. Where the theme defines one, the built-in elements read it without the design naming it. That's why the welcome email's heading is in Georgia and its button is indigo.

| Token | Is |
|-------|----|
| `colors.background` | The root's background, and a scope's |
| `colors.foreground` | Body text's color, in the root and in a scope |
| `fonts.body` | Body text's font |
| `fontSizes.body` | Body text's size, and a Button's |
| `lineHeights.body` | Body text's line height |
| `fonts.heading` | A Heading's font |
| `colors.primary` | A Button's background, and a Link's color |
| `colors.primaryForeground` | A Button's text color |
| `colors.border` | A Divider's color |

Any other name (`muted`, `small`, `lg`) is yours, to use with `token()`.

Body text's styles are set on the root, and Text, table cells and list items inherit them. So set body text with these roles, not with a default for `Text`, which would miss table cells and list items.

## Element defaults and variants

`elements` holds each built-in element's default styles, written as in `style`, and its `variants`: named versions picked with the `variant` prop.

<!-- example: themes/brand.ts -->
```tsx
elements: {
  Heading: {
    by: {
      level: {
        1: { fontSize: 32, mobile: { fontSize: 26 } },
        2: { fontSize: 22 },
      },
    },
  },
  Button: {
    borderRadius: 8,
    variants: {
      secondary: {
        backgroundColor: "{colors.muted}",
        color: "{colors.foreground}",
      },
    },
  },
},
```

- **Every Button** gets `borderRadius: 8`.
- **`<Button variant="secondary">`** also gets the variant's colors. A list of variants merges in order: `variant={["secondary", "small"]}`.
- **`by`** sets a default by one of the element's props. Here it's a type scale: a Heading's size by its `level`.

A variant the theme doesn't give that element is an error that lists the ones it has.

## Named styles

`styles` holds sets of styles that any element applies by name, with `apply` in its `style`:

<!-- example: themes/brand.ts -->
```tsx
styles: {
  card: {
    backgroundColor: "#ffffff",
    padding: "{spacing.lg}",
    gap: "{spacing.md}",
    mobile: { padding: "{spacing.md}" },
  },
},
```

```tsx
<Section style={{ apply: ["card"] }}>…</Section>
<Column style={{ apply: ["card"], gap: 8 }}>…</Column>
```

The element's own styles go beside `apply` and win over it: the Column above has the card's padding and background, and its own `gap`.

Use a variant for a version of one element (a secondary Button), and a named style for a look several elements share (a card).

## Scopes

`tokens` on a Section, Row, Column or Grid changes token values for itself and everything inside it. It's called a scope. A scope that sets `colors.background` or `colors.foreground` takes them as its own background and text color, so the welcome email's dark band is one prop:

```tsx
<Section tokens={{ colors: { background: "#15132e", foreground: "#ffffff" } }}>
  <Text>White text on a dark band</Text>
  <Button href="https://example.com">Still the primary color</Button>
</Section>
```

Scopes nest, and they work in a design that has no theme.

## Which wins

An element's style is merged from these, each over the one before:

1. Its roles
2. Its element's defaults, then its defaults by a prop's value (`by`)
3. Its variants, in order
4. Its named styles, in order
5. Its own `style`

So a style written on the element always wins.

## Next

[Theme reference](/docs/themes/reference) has the rest: every part of `defineTheme()`, which tokens each style takes, overrides for one kind of root (`formats`), `extendTheme()`, tokens in your own elements, typed names, and what each output writes.
