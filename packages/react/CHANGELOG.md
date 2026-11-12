# @hyper-elements/react

Versions before 0.3.0 were published as `@unlayer/react-elements`.

## Unreleased

### What a PDF or an image looks for

`@hyper-elements/react/pdf` and `@hyper-elements/react/image` export `templateAssets(element)`: the fonts and images
`renderPdf()` and `renderImage()` look for in a template, so a tool can load them and give them in `fonts` and
`images`. It returns `{ fonts, images }`: the root's own `fonts` faces as the template gives them (family, `src`,
weight or weight range, style), and each image's URL once, in the order it's drawn: an Image's `src`, and in a
Document a Video's thumbnail (its own, or a YouTube video's). It reads the template with the walks the renderers make,
so the two can't differ, and rejects a template as they do (with errors, or another root). `renderPdf()` and
`renderImage()` are unchanged.

### Fixed

- **A Table's free column in classic Outlook.** Beside columns with their own px, an Email wrote the column with no
  width as `width: auto`, for every client to give it what's left. Word reads `width: auto` as no width, leaves the
  cell's `width` attribute unused and gives the column the widest column's width, so its text wrapped in a narrow
  column. Classic Outlook now gets its own `<col>` and opening tag for that column, with the width attribute alone,
  which Word scales to the table with the others; every other client reads `width: auto` as before.

## 0.4.1

### Fixed

- **A Layer's picture in Gmail and Outlook.com.** An Email wrote the picture as `background-image:url("…")`, and Gmail
  and Outlook.com on the web drop a whole `style` attribute that has a quoted `url()` in it: the picture showed at its
  own size from its top left corner, uncropped, with square corners. The URL is now unquoted, with the characters an
  unquoted URL can't hold (quotes, parentheses, a backslash, whitespace) percent-encoded. Classic Outlook (VML) and the
  cell's `background` attribute are unchanged.

## 0.4.0

### ⚠️ Breaking (0.4.0): email client checks move to `@hyper-elements/email-clients`

This package now checks the template, and what its own writers can't write. What each email client removes or changes
in the HTML (classic Outlook's square corners and missing widths, Gmail's clip, caniemail's tables, the checks on an
Html block's CSS) comes from `@hyper-elements/email-clients`, through a plugin:

```tsx
import { emailClients } from "@hyper-elements/email-clients";

validate(<Welcome />, { plugins: [await emailClients()] });
render(<Welcome />, { plugins: [await emailClients({ clients: ["gmail", "outlook"] })] });
```

- **Removed:** the `emailClients` option of `validate()`, `render()` and `prepare()`; `EMAIL_CLIENTS`,
  `DEFAULT_EMAIL_CLIENTS` and the types `EmailClient`, `EmailClientInfo` and `EmailClientMeasurement`. Code that still
  passes `emailClients` gets an `email/clients-moved` note with the replacement, until 0.5.
- **New:** `plugins` on `validate()` and `render()`, with `PLUGIN_API` and the types `ElementsPlugin`, `PluginInput`,
  `PluginNode`, `PluginOutput` and `PluginDiagnostic`. A plugin's `check` sees a frozen copy of the laid-out template,
  its `checkOutput` the written HTML and which root wrote it. Core checks what a plugin returns (`plugin/invalid`, `plugin/unsupported`,
  `plugin/duplicate`, `plugin/failed`), and a plugin can't make a render fail.
- **Without the plugin,** an Email gets one note, `email/more-checks`, saying where the client checks are;
  `plugins: []` leaves it out. Pages, Documents and Canvases are unchanged.
- **The codes that moved** keep their codes and messages, through the plugin: `email/outlook-degraded`,
  `email/width`, `email/image-width`, `email/phone-styles`, `email/image-format`, `email/font-fallback`,
  `email/html-css`, `email/size`, `email/style-size`, and the client notes that were `email/degraded`.
- **Unchanged:** every template's HTML, text, layout, design and PDF. `prepare()` takes no options, and
  `Diagnostic.clients` is `readonly string[]`.
- `overflow: "hidden"` on a Column or a Grid without a box of its own gets an `email/degraded` note: the Email writer
  cuts content off on a box, which it writes only for a background, padding, a border, a width or a height.
- `@hyper-elements/migrate` 0.3.0 needs 0.4: its peer range is `^0.4.0`. Projects on Elements 0.3 keep migrate 0.2.

### Themes

A theme is the brand, written once and given to any root: `<Email theme={brand}>`, `<Page theme={brand}>`. Templates
without one render as they did.

- New: `defineTheme({ colors, spacing, fontSizes, lineHeights, fonts, radii, components, styles, formats })`, frozen data. Tokens
  are grouped, may nest (`colors.gray.900`) and refer to each other as `"{colors.primary}"`, the W3C Design Tokens
  format's alias. A token, a group, a named style or a variant can't be named `__proto__`, `constructor` or
  `prototype`. `extendTheme(base, overrides)` merges one over another, objects key by key, and its type is the merged
  theme's (an overridden value too), so it can be registered.
- New: `token("colors.primary")` in a template, for a style's value or part of one
  (`border: { width: 1, style: "solid", color: token("colors.border") }`), and for a `component()`'s color, length
  and font props (its types take a token there only). `brand.tokens.colors.primary` is the same, typed.
- New: roles. With the theme defining them, `colors.background` is the root's background, and `colors.foreground`,
  `fonts.body`, `fontSizes.body` and `lineHeights.body` its body text's color, font, size and line height, which Text,
  table cells and list items inherit; `fonts.heading` is a Heading's font; `colors.primary` and
  `colors.primaryForeground` a Button's colors and `fontSizes.body` its size (a theme that defines it makes Buttons
  that size, not 14px); `colors.primary` a Link's; `colors.border` a Divider's.
- New: `components.X` gives every X its default style; `by: { level: { 1: { … } } }` by one prop's value (a type
  scale); `variants`, picked with the new `variant` prop on each built-in component but the roots
  (`variant={["outline", "small"]}` merges in order).
- New: named styles, `styles: { card: { … } }`, applied with `style={{ apply: ["card"] }}`; a named style, a variant or
  a default may apply others. A key an element sets in its own style also replaces that key's phone and hover values
  from the theme.
- New: `tokens` on a Section, Row, Column or Grid overrides tokens for what it holds, and sets the roles it names on
  itself: an inverted band is `<Section tokens={{ colors: { background: "#111827", foreground: "#ffffff" } }}>`.
- New: `formats: { email, page, document, canvas }` overrides the theme for one kind of root. What a root doesn't take
  is left out (a theme's phone styles in a Document).
- New: `component()`'s render gets a second argument, `{ theme }`, the tokens' values where the instance is.
- New: a Page writes its tokens as CSS custom properties (`--colors-primary`; a scope's where they differ), for its own
  CSS and `Html` blocks. Elements' own styles are written as values, as in every output.
- New: `interface Register { theme: typeof brand }` (in `declare module "@hyper-elements/react"`) types every token's
  path, variant and named style; without it they're strings, checked when the template is read.
- New: `theme/schema`, `theme/missing-token`, `theme/value`, `theme/cycle`, `variant/unknown`, `style/unknown-name` and
  `style/apply-place` errors, and the `theme/inherited` warning (a theme's default for a component replaces the body
  text's color, font, size or line height a box sets for what it holds). A `className`, `class`, `sx` or `variants` prop's error points to `variant`
  and `apply`.
- New: `inspect()` lists the theme (its tokens, the roles it defines, its named styles and variants), so
  `INSPECT_VERSION` is 2. `toDesign()` writes a theme's values and says it keeps no theme.
- Docs: `GUIDE.md` and the agent skill have a Themes section, and the README's template uses a theme.

### Where each block is in an Email's HTML

Each entry of `render(email, { blockMap: true })`'s `blocks` now also says its block's component, as laid out
(`type`: `Heading`, `Button`, a Grid's `Row`), so a tool can tell blocks apart without the template.
`BLOCK_MAP_VERSION` is 2; 0.3.1 wrote format 1, without `type`.

### Fixes

- **PDF:** a PDF's text (what's copied, searched and read aloud) no longer loses letters after another PDF in the
  same process. Once a PDF drew a letter only with an accent ("Café", no plain "e"), every later PDF drawn with that
  font wrote that letter as nothing or a control character in its text: "Peter Jones" was copied as "tr Jons". The
  pages looked right. react-pdf keeps one font for the process, and the plain letter's glyph, made as part of the
  accented one, kept no character; it now gets its character the first time it's drawn.
- **Image:** content that overflows a Canvas by more than the Canvas's own size (an image or a box twice its height
  down) no longer ends the process. resvg panicked on it, which nothing could catch, so one card took a server down.
  What lies that far out is cut off as before, and the PNG is the same; the SVG is unchanged.
- **Email:** an image URL written into CSS can't add CSS. A line break or form feed in a Layer's image URL ended its
  `url("…")` and let what followed style the cell (in a browser, a box over the whole window, and a request to another
  site); a form feed in a font's URL did the same to the stylesheet, in every root. Both are encoded now.
- **Plain text:** a service's tag typed into a large heading (`{{first_name}}`, `{% if vip %}`, `<%= name %>`,
  `*|FNAME|*`) is written as typed, as the HTML has it, instead of in capitals that its service doesn't read.
- **TypeScript:** a CommonJS project (`"module": "node16"` or `"nodenext"`) gets the CommonJS declarations each entry
  ships (`.d.cts`), instead of the ES module ones, which TypeScript refused to `require` (TS1479).

### Docs

- Image output: name satori's range when installing (pnpm and yarn otherwise add a newer satori than `/image` is built
  for, with only a warning, and it draws some Canvases wrong); in Next.js, list the engines in
  `serverExternalPackages`; and limit the length of text from users, as Satori lays out all of it.

## 0.3.1

### ⚠️ Breaking: phone and hover styles go in `style`

A component's phone and hover styles are blocks of its `style`, typed to what the component takes there. They replace
0.3.0's separate `mobile` and `hover` props, which are gone: a template that still has them fails with `prop/unknown`,
whose message says where each goes. To upgrade, move each prop's object into the component's `style`:

```tsx
// 0.3.0
<Heading style={{ fontSize: 32 }} mobile={{ fontSize: 24 }}>Title</Heading>
// 0.3.1
<Heading style={{ fontSize: 32, mobile: { fontSize: 24 } }}>Title</Heading>
<Button href="…" style={{ backgroundColor: "#111827", hover: { backgroundColor: "#374151" } }}>Go</Button>
```

Templates written by `@hyper-elements/migrate` 0.2.0 have the props too: migrate them again with 0.2.1, which writes
the new form.

### What's new

- `<Page breakpoints={{ mobile: 600 }}>` sets where a Page's phone styles start (480px where it isn't set).
- Hover styles apply on keyboard focus too. Each hover rule's class name changes.
- More is said about what an output doesn't show: hover in an email (a note: classic Outlook and some apps don't show
  it), and phone styles that were silently ignored (a Page root's phone text styles, a stacking Grid's phone `rowGap`,
  an email Image's or TableCell's phone `border`, an email phone `lineHeight: "normal"`).
- A warning inside a `component()`'s render is said at the component's place, instead of failing the render.

### Email clients in diagnostics

- New: a diagnostic about an Email's problems with particular email clients names them in `clients`, says what to
  change in `fix`, and, where it's known from caniemail.com's tables, links to its page there in `see`. All three are
  optional.
- New: 26 email clients. Four were measured, from captures of the real clients showing 0.3.0 emails (`"outlook"`,
  classic Outlook for Windows; `"outlook-com"`; `"gmail"`; `"apple-mail"`); what's known of the rest is from
  caniemail's tables (`"outlook-mac"`, `"outlook-app"`, `"gmail-app"`, `"gmail-app-other"`, `"yahoo"`, `"aol"`,
  `"samsung-email"`, `"thunderbird"`, `"protonmail"`, `"fastmail"`, `"hey"`, `"gmx"`, `"web-de"`, `"orange"`,
  `"sfr"`, `"laposte"`, `"free-fr"`, `"t-online-de"`, `"mail-ru"`, `"ionos"`, `"wp-pl"`, `"rainloop"`). A problem is
  reported at its own severity for either; only one Elements assumes, unchecked, is a note.
- New: `validate(element, { emailClients })`, `render(element, { emailClients })` and
  `prepare(element, { emailClients })` report problems for the clients named. The default is the clients most email is
  read in: the four measured, Outlook for Mac, the Outlook and Gmail apps, Yahoo, AOL and Samsung Email. `[]` leaves out every email client problem, not the email's own (`email/width`,
  `email/layer`). For a root that isn't an Email the option is ignored, with an `email/clients-ignored` note. An
  unknown client throws a `TypeError`.
- New: `EMAIL_CLIENTS`, what's known of each client, with how closely the four were measured on 0.3.0 emails
  (classic Outlook 0.85 of words within 4px; Outlook.com, Gmail and Apple Mail about 1), and the types
  `EmailClient`, `EmailClientInfo`, `EmailClientMeasurement` and `ValidateOptions`. `DEFAULT_EMAIL_CLIENTS` lists the
  default ones, to report for them and more (`[...DEFAULT_EMAIL_CLIENTS, "gmx"]`).
- Docs: `GUIDE.md` and the agent skill say what an email's warnings name (`clients`, `fix`, `see`) and how to check
  more clients, with a script that renders an email and prints its problems with `formatDiagnostics()`.
- New: `email/phone-styles`, said once for an Email with phone styles or hidden content, for the clients that don't
  apply them on phones (the Gmail app with another account, some webmail): a note, or a warning where something hidden
  on desktop would then show nowhere. What a built-in component hides itself (a Menu's separators) doesn't count.
- New: `email/image-format`, a warning on an Image or a Video's thumbnail whose file is WebP (classic Outlook), AVIF
  or SVG, by its data: type, the format an image CDN is asked for (`?fm=webp`, `f_avif`, which wins over the file's
  extension) or its extension.
- New: `email/html-css`, a note on an Html block whose markup may have CSS or HTML an email client removes
  (`position`, CSS variables, gradients, box and text shadows, flex and grid, opacity, `object-fit`,
  `aspect-ratio`, a `<style>` in the body, newer color syntax, negative margins, `!IMPORTANT` in capitals, rgb()
  with spaces).
- New notes from caniemail's tables: `fontWeight` under 600 (other than 400) and `textTransform: "lowercase"` in
  classic Outlook; `borderRadius` in GMX, WEB.DE and Orange; `textDecoration` lines in the Gmail app with another
  account and some others; a root's `lang` and `dir` where webmail removes them.
- Changed: the note on hover in an email names the clients that don't show it (`clients`), and its message no longer
  does. `email/outlook-degraded` has `clients: ["outlook"]`; `email/font-fallback` names every client that loads no
  web font, and its advice moves from the message to `fix`; the web fonts note (`email/degraded` on `fonts`) names them
  too; `email/size` and `email/style-size` name Gmail and its apps, with a `fix`.
- Changed: `formatDiagnostics()` adds a diagnostic's clients, fix and where to see it to its line, so lines about
  email clients are longer.

### Where each block is in an Email's HTML

`render(email, { blockMap: true })` also returns `blocks`, for tools that preview an email: each block's place in the
template and the UTF-8 byte offset in `html` just after its outermost element's tag name
(`{ version, unit: "utf8", entries: [{ path, nodeId?, type, offset }] }`). The HTML is the same bytes as without the option.
`BLOCK_MAP_VERSION` says the format: 2, since each entry now says its component (`type`); 0.3.1's map, format 1, had
no `type`. With `pretty` it's an error (`render/block-map-pretty`). The types `BlockMap` and
`BlockMapEntry` are exported. Documented in REFERENCE.md.

### Which roots take each component, prop and style

Every component, prop and style now says which roots (`Email`, `Page`, `Document`, `Canvas`) take it. Templates that
validated before still validate, and render the same.

- New: `component/not-supported`, `prop/not-supported` and `style/not-supported`, errors for a component, prop or
  style under a root that doesn't take it, naming the roots that do. They're checked inside your own components too,
  against the root they're rendered in. A component no output of the root can draw is still `target/unsupported`, and
  a `PageNumber` outside a Document still `document/page-number`.
- New: a `component()`'s prop can be for some roots only: `prop.text({ label: "Motto", roots: ["Page"] })`.
- New: `@hyper-elements/react/inspect`, what each root takes and what a template holds, as data, without rendering.
  `describeComponents({ root })` lists the components a root takes, each prop and style with its kind, group
  (`Typography`, `Spacing`, …), default and roots, and the style blocks (`mobile`, `hover`) the root takes;
  `describeComponent(type, { root })` gives one. `inspect(element)` lists each component in a template with the roots
  that take it, whether its root does (`allowed`), what it's given and its problems, and every diagnostic `validate()`
  finds. Each result has a `version` (`INSPECT_VERSION`) that changes only with its shape.
- Docs: `REFERENCE.md` says where a component, prop or style isn't in every root ("Not in an Email.", "only in a
  Page"), and each style's group; `GUIDE.md` and the agent skill say it for Svg and PageNumber.

### Fixes

- **Email:** a `Button` narrower than its padding no longer draws its label a letter a line in Gmail and browsers. The
  email's `word-break: break-word`, there so a long link in text breaks rather than widen the email on phones, let the
  button size itself to one letter; its label now keeps its words whole (`word-break: normal` on the button's link) and
  the button grows to its longest word, as classic Outlook and Apple Mail already drew it. Found in captures of 0.3.0
  emails in Gmail on the web. Each button's link gains `word-break:normal` in its `style`; nothing else in the HTML
  changes.

## 0.3.0

### ⚠️ Breaking: every template written with Unlayer Elements has to migrate

Hyper Elements is a new package, `@hyper-elements/react`. The old syntax isn't in it, and there's no compatibility mode.
A name in both doesn't mean the code still works: `<Email>` is still there, but `<Email containerPadding={20}>` isn't,
and neither is `renderToHtml()`. `@unlayer/react-elements` stays at 0.2, so nothing changes until you move.

**To upgrade:** run `npx @hyper-elements/migrate src/emails --from unlayer-elements`. It lists what it would change; `--write`
replaces the templates (only those git can restore). It rewrites the imports and the JSX and keeps props, loops and
conditions; what it can't move is listed, and that file is left as it was to rewrite by hand.

| 0.2 | 0.3 |
|---|---|
| `renderToHtml(element)` | `const { html } = await render(element)` |
| `renderToPlainText(element)` | `const { text } = await render(element)` |
| `renderToJson(element)` | `const { design } = toDesign(element)`, from `@hyper-elements/react/builder` |
| `<Row layout="TwoEqual">`, `ColumnLayouts` | A `Row` of `Column`s |
| Styles as props (`backgroundColor="#000"`, `containerPadding`) | `style={{ backgroundColor: "#000" }}`, on the component they belong to |
| `headingType`, `altText` | `level`, `alt` |
| `<Paragraph>`, `ParagraphProps` | `<Text>`, `TextProps` (`ParagraphProps` stays as a deprecated alias) |

Also gone: `Body`, `UnlayerProvider`, `renderToHtmlParts` and the `values` prop. Designs saved in the builder aren't
affected: `fromDesign()` reads them, the older text tool's blocks included.

### What's new

A template has one root (`Email`, `Page`, `Document` or `Canvas`), its styles go in `style={{ }}`, and
`await render(element)` writes its HTML and plain text.

- New: the components, each with typed props and styles: `Section`, `Row`, `Column`, `Grid`, `Heading`, `Text`,
  `Span`, `Link`, `List`, `Button`, `Image`, `Divider`, `Menu`, `Social`, `Video`, `Table`, `Html`, page
  headers, footers and numbers for a `Document`, and shapes for a `Canvas`. `component()` and `prop()` make your own.
- New: `validate()` and `outline()` check a template without rendering it; `render()` returns its diagnostics.
- New: `Html`, markup written as it is (the builder's HTML block), given as `html` or as JSX in it.
- New: `@hyper-elements/react/builder`, `toDesign()` and `fromDesign()`, a template to the Unlayer builder's design
  JSON and back. What a text block's tool has no field for is drawn in the style of its own paragraph, and what else
  a tool has no field for is kept in the design as a hidden property of it; what the builder can't arrange comes back
  with the same look, flatter. `fromDesign()` takes a `toSafeHtml` for a
  design's markup.
- PDF and images: `@hyper-elements/react/pdf` and `@hyper-elements/react/image` write a `Document` as a PDF and
  a `Canvas` as a PNG or SVG, on the server, without a browser. Their engines (`@react-pdf/renderer`; `satori` and
  `@resvg/resvg-js`) are optional peer dependencies: install the ones you use. The main entry loads none.
- The package has no dependencies of its own (React is a peer): `@unlayer/exporters` and `@unlayer/types` are gone.
- Types for the main entry and `/builder` resolve under `moduleResolution: "node"` too.
- Docs: the READMEs, guides, examples and Storybook show the new components.

## 0.1.0

- Initial release
- React components for building emails, pages, and documents
- Server-side rendering support (Node.js, Next.js Server Components)
- Dependencies: @unlayer/exporters, @unlayer/types
