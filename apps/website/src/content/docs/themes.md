---
title: "Themes"
description: "Write a brand once with defineTheme(): tokens referred to with token(), roles the built-in components read, defaults for each component, variants, named styles, scopes that change tokens for a band, overrides for one kind of root, and typed names."
---

A theme is the brand, written once. Give it to any root, and every Email, Page, Document and Canvas that takes it is on brand: its colors, fonts, sizes, each component's defaults, its variants and its named styles.

```tsx
import { defineTheme, token, Button, Email, Heading, Section, Text } from "@hyper-elements/react";

const brand = defineTheme({
  colors: { background: "#ffffff", foreground: "#111827", primary: "#0f766e", primaryForeground: "#ffffff", muted: "#f3f4f6", border: "#e5e7eb" },
  fonts: { body: "Inter, Arial, sans-serif", heading: "Georgia, serif" },
  fontSizes: { body: 16, small: 13 },
  lineHeights: { body: 1.6 },
  spacing: { md: 16, lg: 32 },
  components: {
    Heading: { by: { level: { 1: { fontSize: 36, mobile: { fontSize: 28 } }, 2: { fontSize: 24 } } } },
    Button: { borderRadius: 8, variants: { secondary: { backgroundColor: "{colors.muted}", color: "{colors.foreground}" } } },
  },
  styles: { card: { padding: "{spacing.lg}", gap: "{spacing.md}", mobile: { padding: "{spacing.md}" } } },
});

export default function Welcome() {
  return (
    <Email theme={brand}>
      <Section style={{ apply: ["card"] }}>
        <Heading level={1}>Welcome to Acme</Heading>
        <Text>Your account is ready.</Text>
        <Button href="https://example.com/start">Get started</Button>
        <Button href="https://example.com/docs" variant="secondary">Read the docs</Button>
      </Section>
      <Section tokens={{ colors: { background: "#111827", foreground: "#ffffff" } }} style={{ apply: ["card"] }}>
        <Text style={{ fontSize: token("fontSizes.small") }}>Acme Inc., 1 Market St, San Francisco</Text>
      </Section>
    </Email>
  );
}
```

Templates without a theme render as they always did. A theme only changes what it defines.

## defineTheme()

`defineTheme()` takes the theme's parts and returns it as frozen data. Every part is optional.

| Part | What it holds |
|------|---------------|
| `colors` | Colors: `primary: "#0f766e"` |
| `spacing` | Lengths for padding, gaps and borders: `md: 16` |
| `fontSizes` | Font sizes: `body: 16` |
| `lineHeights` | Line heights: `body: 1.6` |
| `fonts` | Font stacks: `body: "Inter, Arial, sans-serif"` |
| `radii` | Corner radii: `card: 8`, or `card: { topLeft: 8, topRight: 8 }` |
| `components` | Each built-in component's defaults, by one prop's value (`by`), and its `variants` |
| `styles` | Named styles, applied with `style={{ apply: [...] }}` |
| `formats` | Overrides for one kind of root: `email`, `page`, `document`, `canvas` |

The first six are tokens. A token's value is what the same style takes (a number is px), and it's checked when the template is read, whether a template uses it or not.

- **Names are letters and digits**, so each token is also a CSS custom property's name. To group tokens, nest them: `colors: { gray: { 100: "#f3f4f6", 900: "#111827" } }` makes `colors.gray.100` and `colors.gray.900`. `gray-900` is an error that says to nest it.
- **One token refers to another** as `"{colors.primary}"`, the [W3C Design Tokens](https://www.designtokens.org/) format's alias: `link: "{colors.primary}"`. That works only inside a theme. A reference to a token that doesn't exist, to one in another group, or a loop of references, is an error.
- A token has one value. `{ base, dark }` values are an error until dark mode comes, as are groups Elements doesn't take yet (`shadows`, `keyframes`).

## token()

In a template, `token("colors.primary")` stands for a token's value, where a style or part of one takes it:

```tsx
<Column style={{ padding: token("spacing.lg"), border: { width: 1, style: "solid", color: token("colors.border") } }}>
  <Text style={{ color: token("colors.primary"), fontSize: token("fontSizes.small") }}>Paid</Text>
</Column>
```

A style takes tokens from the groups of its kind:

| Style | Takes tokens from |
|-------|-------------------|
| A color (`color`, `backgroundColor`, a border's `color`) | `colors` |
| A length (`fontSize`, `width`, `gap`, …) | `spacing`, `fontSizes` |
| `padding`, a border's `width` | `spacing` |
| `borderRadius` | `radii` |
| `fontFamily` | `fonts` |
| `lineHeight` | `lineHeights` |

A token from another group is an error (`theme/value`), and so is one that doesn't exist (`theme/missing-token`), with the token meant where it's a typo away. `brand.tokens.colors.primary` is the same as `token("colors.primary")`.

`"{colors.primary}"` in a template is a string, not a token: the error for it says to write `token("colors.primary")`.

## Roles

Some tokens are roles: where the theme defines them, the built-in components read them without the template naming them.

| Token | Is |
|-------|----|
| `colors.background` | The root's background |
| `colors.foreground` | Body text's color |
| `fonts.body` | Body text's font |
| `fontSizes.body` | Body text's size, and a Button's |
| `lineHeights.body` | Body text's line height |
| `fonts.heading` | A Heading's font |
| `colors.primary` | A Button's background, and a Link's color |
| `colors.primaryForeground` | A Button's text color |
| `colors.border` | A Divider's color |

Body text's styles are set on the root, and Text, table cells and list items inherit them. Set body text with these roles, not with a default for `Text`: a style on `Text` misses table cells and list items. Where a theme's default for a component replaces the color, font, size or line height a box sets for what it holds, `validate()` warns (`theme/inherited`).

## Component defaults

`components.Button: { … }` is every Button's default style. Styles inside it are written as in `style`, with `mobile` and `hover` blocks, and may refer to tokens.

```ts
components: {
  Button: { borderRadius: 8, padding: [12, 24], hover: { backgroundColor: "#115e59" } },
  Divider: { borderTop: { width: 2, style: "solid", color: "{colors.border}" } },
}
```

`by` sets a default by one of the component's props, a choice or a boolean. A type scale is a Heading's style by its level:

```ts
components: {
  Heading: { by: { level: { 1: { fontSize: 36, mobile: { fontSize: 28 } }, 2: { fontSize: 24 }, 3: { fontSize: 20 } } } },
}
```

A value the prop never has (a level 7) is an error. Other differences are variants.

## Variants

`variants` are a component's named versions, picked with its `variant` prop. A list merges in order:

```tsx
const brand = defineTheme({
  components: {
    Button: {
      variants: {
        secondary: { backgroundColor: "#f3f4f6", color: "#111827" },
        small: { padding: [6, 12], fontSize: 13 },
      },
    },
  },
});

<Button href="https://example.com" variant="secondary">Learn more</Button>
<Button href="https://example.com" variant={["secondary", "small"]}>Later</Button>
```

Every built-in component but the roots takes `variant`. A variant the theme doesn't give that component is an error that lists the ones it has.

## Named styles

`styles` are named styles any component can apply, in order, with `apply` at the top of its `style`:

```tsx
const brand = defineTheme({
  styles: {
    card: { backgroundColor: "#ffffff", padding: 32, borderRadius: 8, mobile: { padding: 16 } },
    quiet: { color: "#6b7280", fontSize: 13 },
  },
});

<Column style={{ apply: ["card"], gap: 16 }}>
  <Text style={{ apply: ["quiet"] }}>Ships in 2 days</Text>
</Column>
```

A named style, a variant or a component default may apply named styles too. Named styles that apply each other in a loop are an error. A template's own component takes no named styles: apply them in what it renders.

## Which wins

A component's style is merged from, lowest first:

1. Its roles
2. Its component's defaults, then its defaults by its prop's value (`by`)
3. Its variants, in order
4. Its named styles, in order
5. Its own `style`

Each `mobile` and `hover` block merges key by key the same way. A style the component sets itself, outside a block, also replaces the theme's phone and hover values for it: `style={{ padding: 8 }}` stays 8 on phones, whatever the theme's `mobile` says.

## Scopes

`tokens` on a Section, Row, Column or Grid changes tokens for itself and everything it holds. A scope that sets a role applies it to itself, so an inverted band is one prop:

```tsx
<Section tokens={{ colors: { background: "#111827", foreground: "#ffffff" } }}>
  <Text>White text on a dark band</Text>
  <Button href="https://example.com">Still the primary color</Button>
</Section>
```

Scopes nest. A reference in the theme follows them: with `link: "{colors.primary}"`, a scope that changes `colors.primary` changes `link` inside it too. A scope can refer to the tokens around it with `token()`. Scopes work without a theme.

## formats

`formats` overrides the theme for one kind of root, merged over the rest:

```ts
const brand = defineTheme({
  fontSizes: { body: 16 },
  formats: {
    document: { fontSizes: { body: 11 }, fonts: { body: "Georgia, serif" } },
    email: { components: { Button: { borderRadius: 4 } } },
  },
});
```

What a root can't show is left out of the theme there: a theme's phone and hover styles do nothing in a Document. Every root's overrides are checked whichever root reads the theme.

## extendTheme()

`extendTheme(base, overrides)` makes a theme from another, for a brand over a shared base or a customer over a brand. Objects merge key by key at every depth, and anything else (a value, a list) is replaced:

```ts
const customer = extendTheme(brand, { colors: { primary: "#b91c1c" }, fonts: { body: "Helvetica, Arial, sans-serif" } });
```

## Your own components

A [component()](/docs/custom-components)'s color, length and font props take a token like a style does. Its `render` gets the theme's tokens where the instance is, scopes included, as values in its second argument:

```tsx
const Badge = component({
  type: "acme.Badge",
  label: "Badge",
  props: { tint: prop.color({ label: "Tint" }) },
  render: ({ tint }, { theme }) => (
    <Text style={{ backgroundColor: tint ?? String(theme.colors?.muted ?? "#f3f4f6"), padding: [2, 8] }}>New</Text>
  ),
});

<Badge tint={token("colors.primary")} />
```

## Typed names

Register your theme, once in your app, to type every token, variant and named style:

```ts
declare module "@hyper-elements/react" {
  interface Register {
    theme: typeof brand;
  }
}
```

Then `token("colors.primry")`, `variant="tertiary"` and `apply: ["crad"]` are type errors. Without a registered theme they're strings, checked when the template is read. A theme made with `extendTheme()` can be registered too.

## What's written

A theme's values are written into each output as values, as if the template had set them: an email, a PDF and an image hold no theme.

- **A Page** also writes its tokens as CSS custom properties (`--colors-primary`, `--fontSizes-body`) on its root, and a scope's where they differ, for your own CSS and `Html` blocks.
- **The visual editor** gets the values each block has. `toDesign()` says it keeps no theme.
- **`inspect()`** lists the theme: its tokens and their values, the roles it defines, its named styles and each component's variants.

Every theme problem is a [diagnostic](/docs/diagnostics) with the path to the token, style or variant it's about: `root.theme.components.Button.variants.ghost`.
